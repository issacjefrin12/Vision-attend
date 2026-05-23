"""Session-based attendance service."""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from math import atan2, cos, radians, sin, sqrt
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import MAX_DISTANCE_KM
from app.models.attendance import Attendance, AttendanceStatus, AttendanceType
from app.models.academic_class import AcademicClass
from app.models.attendance_policy import AttendancePolicy
from app.models.attendance_session import AttendanceSession
from app.models.student import Student
from app.models.system_setting import SystemSetting
from app.models.user import User, UserRole
from app.models.timetable import Timetable
from app.services.notification_service import notification_service
from app.services.unknown_face_service import unknown_face_service
from app.services.esp32_serial_service import esp32_serial_service
from app.utils.timezone import now_ist_naive, today_ist

try:
    from app.ml.pipeline import face_pipeline
except ImportError:  # pragma: no cover - depends on optional ML deps
    face_pipeline = None


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points (Haversine)."""
    earth_radius_km = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


class SessionService:
    """Core session lifecycle and mark logic."""

    _geofence_key = "geofence_max_distance_km"

    async def _get_max_distance_km(self, db: AsyncSession) -> float:
        result = await db.execute(
            select(SystemSetting.value).where(SystemSetting.key == self._geofence_key)
        )
        raw_value = result.scalar_one_or_none()
        if raw_value is None:
            return MAX_DISTANCE_KM

        try:
            value = float(raw_value)
            if value <= 0:
                return MAX_DISTANCE_KM
            return value
        except (TypeError, ValueError):
            return MAX_DISTANCE_KM

    async def _resolve_timetable_id(
        self,
        db: AsyncSession,
        session: AttendanceSession,
        attendance_date: date,
    ) -> int | None:
        if not session.subject_id:
            return None

        day_name = attendance_date.strftime("%A")
        result = await db.execute(
            select(Timetable).where(
                and_(
                    Timetable.class_id == session.class_id,
                    Timetable.subject_id == session.subject_id,
                    Timetable.faculty_id == session.faculty_id,
                    Timetable.day_of_week == day_name,
                )
            )
        )
        rows = list(result.scalars().all())
        if not rows:
            return None

        now_time = now_ist_naive().time()
        for row in rows:
            if row.start_time <= now_time <= row.end_time:
                return row.id

        return rows[0].id

    async def _generate_unique_code(self, db: AsyncSession) -> str:
        for _ in range(20):
            code = f"{random.randint(0, 999999):06d}"
            exists = await db.execute(
                select(AttendanceSession.id).where(AttendanceSession.session_code == code)
            )
            if not exists.scalar_one_or_none():
                return code
        raise ValueError("Could not generate unique session code")

    async def create_session(
        self,
        db: AsyncSession,
        faculty: User,
        class_id: int,
        subject_id: int | None,
        session_type: str,
        duration_seconds: int,
        entry_mode: str = "code",
    ) -> AttendanceSession:
        now = now_ist_naive()

        if session_type not in {"entry", "hourly"}:
            raise ValueError("session_type must be 'entry' or 'hourly'")
        if session_type == "hourly" and not subject_id:
            raise ValueError("Hourly session requires subject_id")

        class_result = await db.execute(
            select(AcademicClass.id).where(AcademicClass.id == class_id)
        )
        if not class_result.scalar_one_or_none():
            raise ValueError("Selected class does not exist")

        # Timetable is used for suggestions in UI, not as a hard restriction for session start.

        active_conflict = await db.execute(
            select(AttendanceSession).where(
                and_(
                    AttendanceSession.class_id == class_id,
                    AttendanceSession.is_active == True,
                    AttendanceSession.expiry_time > now,
                )
            )
        )
        if active_conflict.scalar_one_or_none():
            raise ValueError("Only one active session per class is allowed")

        session = AttendanceSession(
            class_id=class_id,
            subject_id=subject_id,
            faculty_id=faculty.id,
            session_code=await self._generate_unique_code(db),
            session_type=session_type,
            duration_seconds=duration_seconds,
            start_time=now,
            expiry_time=now + timedelta(seconds=duration_seconds),
            is_active=True,
            entry_mode=entry_mode,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    async def validate_session(
        self,
        db: AsyncSession,
        session_code: str | None = None,
        session_id: int | None = None,
    ) -> AttendanceSession:
        if not session_code and not session_id:
            raise ValueError("session_code or session_id is required")

        query = select(AttendanceSession)
        if session_id:
            query = query.where(AttendanceSession.id == session_id)
        else:
            query = query.where(AttendanceSession.session_code == session_code)

        result = await db.execute(query)
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("Session not found")

        now = now_ist_naive()
        if not session.is_active or session.expiry_time <= now:
            if session.is_active and session.expiry_time <= now:
                session.is_active = False
                await db.commit()
            raise ValueError("Session is inactive or expired")
        return session

    async def close_session(
        self, db: AsyncSession, session_id: int, closed_by: User
    ) -> AttendanceSession:
        result = await db.execute(
            select(AttendanceSession).where(AttendanceSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("Session not found")

        if closed_by.role == UserRole.FACULTY and session.faculty_id != closed_by.id:
            raise ValueError("Faculty can close only own sessions")

        session.is_active = False
        await db.commit()
        await db.refresh(session)
        return session

    async def _validate_entry_policy(
        self, db: AsyncSession, student: Student, attendance_date: date
    ) -> None:
        if not student.class_id:
            return

        class_result = await db.execute(
            select(AcademicClass).where(AcademicClass.id == student.class_id)
        )
        academic_class = class_result.scalar_one_or_none()
        if not academic_class:
            return

        policy_result = await db.execute(
            select(AttendancePolicy).where(
                and_(
                    AttendancePolicy.department_id == academic_class.department_id,
                    AttendancePolicy.is_active == True,
                )
            )
        )
        policy = policy_result.scalar_one_or_none()
        if not policy:
            return

        now_time = now_ist_naive().time()
        if now_time < policy.entry_start_time or now_time > policy.entry_end_time:
            raise ValueError("Entry attendance is outside configured time window")

        entries_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.student_id == student.id,
                    Attendance.date == attendance_date,
                    Attendance.attendance_type == AttendanceType.ENTRY.value,
                )
            )
        )
        entries_count = entries_result.scalar() or 0
        if entries_count >= policy.max_entry_per_day:
            raise ValueError("Max entry attendance limit reached for today")

    async def mark_session(
        self,
        db: AsyncSession,
        image_base64: str,
        current_user: User,
        session_code: str | None = None,
        session_id: int | None = None,
        student_lat: float | None = None,
        student_lon: float | None = None,
    ) -> tuple[bool, str, Attendance | None, AttendanceSession | None, Student | None]:
        if face_pipeline is None:
            return False, "Face recognition service unavailable", None, None, None

        try:
            session = await self.validate_session(
                db=db, session_code=session_code, session_id=session_id
            )
        except ValueError as error:
            return False, str(error), None, None, None

        student_id, confidence, message = face_pipeline.recognize_student(image_base64)
        if not student_id:
            await unknown_face_service.log_unknown_face(
                db=db,
                course_id=session.subject_id,
                image_base64=image_base64,
                confidence=confidence,
            )
            esp32_serial_service.send_error()
            return False, message, None, session, None

        student_result = await db.execute(
            select(Student).where(
                and_(Student.id == student_id, Student.is_active == True)
            )
        )
        student = student_result.scalar_one_or_none()
        if not student:
            esp32_serial_service.send_error()
            return False, "Student not found", None, session, None

        esp32_serial_service.send_success(student.full_name)

        if current_user.role == UserRole.STUDENT:
            if student.user_id and student.user_id != current_user.id:
                return False, "Face does not match logged-in student", None, session, student
            if not student.user_id and current_user.email != student.email:
                return False, "Face does not match logged-in student", None, session, student
            if student_lat is None or student_lon is None:
                return (
                    False,
                    "Location access is required to mark attendance",
                    None,
                    session,
                    student,
                )

        if student.class_id is None or student.class_id != session.class_id:
            return (
                False,
                "Not your class. Session is restricted to another class.",
                None,
                session,
                student,
            )

        if current_user.role == UserRole.STUDENT:
            class_result = await db.execute(
                select(AcademicClass).where(AcademicClass.id == session.class_id)
            )
            academic_class = class_result.scalar_one_or_none()
            if (
                not academic_class
                or academic_class.latitude is None
                or academic_class.longitude is None
            ):
                return (
                    False,
                    "Classroom location not configured. Contact admin.",
                    None,
                    session,
                    student,
                )

            distance = distance_km(
                student_lat,
                student_lon,
                academic_class.latitude,
                academic_class.longitude,
            )
            max_distance_km = await self._get_max_distance_km(db)
            if distance > max_distance_km:
                return False, "You are not near the classroom", None, session, student

        attendance_date = today_ist()
        if session.session_type == "hourly":
            entry_check = await db.execute(
                select(Attendance.id).where(
                    and_(
                        Attendance.student_id == student.id,
                        Attendance.date == attendance_date,
                        Attendance.attendance_type == AttendanceType.ENTRY.value,
                    )
                )
            )
            if not entry_check.scalar_one_or_none():
                return (
                    False,
                    "Entry attendance is mandatory before hourly attendance",
                    None,
                    session,
                    student,
                )
        else:
            try:
                await self._validate_entry_policy(db=db, student=student, attendance_date=attendance_date)
            except ValueError as error:
                return False, str(error), None, session, student

        duplicate_check = await db.execute(
            select(Attendance.id).where(
                and_(
                    Attendance.student_id == student.id,
                    Attendance.session_id == session.id,
                )
            )
        )
        if duplicate_check.scalar_one_or_none():
            return False, "Attendance already marked for this session", None, session, student

        timetable_id = None
        if session.session_type == "hourly" and session.subject_id:
            timetable_id = await self._resolve_timetable_id(
                db=db,
                session=session,
                attendance_date=attendance_date,
            )

        attendance = Attendance(
            student_id=student.id,
            course_id=session.subject_id,
            timetable_id=timetable_id,
            session_id=session.id,
            attendance_type=(
                AttendanceType.ENTRY.value
                if session.session_type == "entry"
                else AttendanceType.SESSION.value
            ),
            date=attendance_date,
            check_in_time=now_ist_naive(),
            status=AttendanceStatus.PRESENT,
            confidence_score=confidence,
        )
        db.add(attendance)
        await db.flush()

        user_result = await db.execute(select(User).where(User.email == student.email))
        student_user = user_result.scalar_one_or_none()
        if student_user:
            label = "Entry attendance marked" if session.session_type == "entry" else "Hourly attendance marked"
            await notification_service.create_notification(
                db=db,
                user_id=student_user.id,
                title=label,
                message=(
                    f"{label} successfully for session code {session.session_code}."
                ),
                notification_type="attendance",
            )

        await db.commit()
        await db.refresh(attendance)
        return True, "Attendance marked", attendance, session, student

    async def get_session_mark_count(self, db: AsyncSession, session_id: int) -> int:
        result = await db.execute(
            select(func.count(Attendance.id)).where(Attendance.session_id == session_id)
        )
        return result.scalar() or 0


session_service = SessionService()
