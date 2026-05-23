"""Attendance router with face recognition."""
from datetime import date, time, timedelta, datetime
from typing import Dict, List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel

from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus, AttendanceType
from app.models.attendance_session import AttendanceSession
from app.models.student import Student
from app.models.course import Course
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.models.timetable import Timetable
from app.schemas.attendance import (
    AttendanceResponse, AttendanceStats,
    AttendanceMarkRequest, AttendanceMarkResponse,
    EntryStatusResponse, EntryStatusStudent,
    ManualAttendanceMarkRequest, ManualAttendanceMarkResponse,
    ClassStudentResponse,
    BulkAttendanceMarkRequest,
    BulkAttendanceMarkResponse,
)
from app.utils.security import get_current_faculty_or_admin, get_current_user
from app.utils.timezone import now_ist_naive, today_ist
from app.services.attendance_service import attendance_service
from app.services.export_service import export_service
from app.services.unknown_face_service import unknown_face_service


router = APIRouter(prefix="/attendance", tags=["Attendance"])


# Response models for user attendance
class UserAttendanceRecord(BaseModel):
    id: int
    course_name: str
    course_code: str
    date: str
    status: str
    check_in_time: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserAttendanceStats(BaseModel):
    attendance_percentage: float
    total_working_days: int
    present_count: int
    late_count: int
    absent_count: int
    total_classes: int


class SubjectAttendanceRow(BaseModel):
    course_id: int
    subject: str
    subject_code: str
    total_classes: int
    attended_classes: int
    absent_classes: int
    attendance_percentage: float
    below_threshold: bool


class CalendarDayStatus(BaseModel):
    date: str
    status: str


class DashboardNotification(BaseModel):
    id: str
    category: str
    message: str
    timestamp: str


WEEKDAY_TO_INDEX = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}
DEFAULT_ATTENDANCE_THRESHOLD = 75.0
DAY_NAME_TO_INDEX = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}
ATTENDANCE_GUARD_BEFORE_MINUTES = 10
ATTENDANCE_GUARD_AFTER_MINUTES = 10


def _get_date_range(month: Optional[str]) -> tuple[date, date]:
    """Resolve month filter (YYYY-MM) to concrete date range."""
    if month:
        year, m = map(int, month.split("-"))
        start_date = date(year, m, 1)
        if m == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, m + 1, 1) - timedelta(days=1)
        return start_date, end_date

    today = today_ist()
    return date(today.year, today.month, 1), today


def _normalize_schedule_days(schedule: Optional[dict]) -> Set[int]:
    """Convert course schedule day tokens (Mon/Tue/...) into weekday indexes."""
    if not schedule or not schedule.get("days"):
        return set()

    days: Set[int] = set()
    for token in schedule["days"]:
        if token in WEEKDAY_TO_INDEX:
            days.add(WEEKDAY_TO_INDEX[token])
    return days


async def _get_faculty_course_ids(db: AsyncSession, faculty_id: int) -> List[int]:
    result = await db.execute(
        select(Timetable.subject_id)
        .where(Timetable.faculty_id == faculty_id)
        .distinct()
    )
    return [row[0] for row in result.fetchall() if row[0] is not None]


async def _get_faculty_timetable_rows(db: AsyncSession, faculty_id: int):
    result = await db.execute(
        select(Timetable).where(Timetable.faculty_id == faculty_id)
    )
    return list(result.scalars().all())


async def _faculty_can_access_class(db: AsyncSession, faculty_id: int, class_id: int) -> bool:
    timetable_result = await db.execute(
        select(Timetable.id).where(
            and_(
                Timetable.faculty_id == faculty_id,
                Timetable.class_id == class_id,
            )
        ).limit(1)
    )
    if timetable_result.scalar_one_or_none():
        return True

    session_result = await db.execute(
        select(AttendanceSession.id).where(
            and_(
                AttendanceSession.faculty_id == faculty_id,
                AttendanceSession.class_id == class_id,
            )
        ).limit(1)
    )
    return session_result.scalar_one_or_none() is not None


async def _ensure_class_access(
    db: AsyncSession,
    current_user: User,
    class_id: int,
) -> None:
    if current_user.role == UserRole.ADMIN:
        return

    if current_user.role == UserRole.FACULTY:
        allowed = await _faculty_can_access_class(db, current_user.id, class_id)
        if allowed:
            return

    raise HTTPException(status_code=403, detail="You are not allowed to access this class")


def _count_timetable_occurrences(
    rows: List[Timetable],
    start_date: date,
    end_date: date,
) -> int:
    by_weekday: Dict[int, int] = {}
    for row in rows:
        weekday = DAY_NAME_TO_INDEX.get(row.day_of_week)
        if weekday is None:
            continue
        by_weekday[weekday] = by_weekday.get(weekday, 0) + 1

    total = 0
    cursor = start_date
    while cursor <= end_date:
        total += by_weekday.get(cursor.weekday(), 0)
        cursor += timedelta(days=1)
    return total


async def _get_student_for_user(db: AsyncSession, current_user: User) -> Student:
    """Map student login user to student profile using email."""
    result = await db.execute(
        select(Student).where(
            and_(
                Student.email == current_user.email,
                Student.is_active == True
            )
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=404,
            detail=(
                "Student profile not found. "
                "Create a student record with the same email as the user account."
            ),
        )
    return student


async def _build_student_subject_metrics(
    db: AsyncSession,
    student_id: int,
    student_class_id: int | None,
    start_date: date,
    end_date: date,
    threshold: float = DEFAULT_ATTENDANCE_THRESHOLD,
) -> Dict[str, object]:
    """Build subject-wise attendance strictly from student class timetable when available."""
    records_result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.student_id == student_id,
                Attendance.course_id.isnot(None),
                Attendance.date >= start_date,
                Attendance.date <= end_date,
            )
        )
    )
    student_records = records_result.scalars().all()

    timetable_rows: List[Timetable] = []
    if student_class_id is not None:
        timetable_rows_result = await db.execute(
            select(Timetable)
            .where(
                and_(
                    Timetable.class_id == student_class_id,
                    Timetable.subject_id.isnot(None),
                )
            )
        )
        timetable_rows = list(timetable_rows_result.scalars().all())

    # Source of subjects:
    # 1) Student class timetable (strict mode)
    # 2) Student attendance history (fallback when no class timetable exists)
    if timetable_rows:
        course_ids = sorted({row.subject_id for row in timetable_rows if row.subject_id is not None})
    else:
        course_ids = sorted({record.course_id for record in student_records if record.course_id is not None})

    if not course_ids:
        return {
            "subjects": [],
            "present_count": 0,
            "late_count": 0,
            "absent_count": 0,
            "attended_count": 0,
            "total_classes": 0,
            "all_class_dates": set(),
            "present_dates": set(),
        }

    courses_result = await db.execute(select(Course).where(Course.id.in_(course_ids)))
    course_map = {course.id: course for course in courses_result.scalars().all()}

    scheduled_count_by_course: Dict[int, int] = {course_id: 0 for course_id in course_ids}
    class_dates_by_course: Dict[int, Set[date]] = {course_id: set() for course_id in course_ids}

    if timetable_rows:
        for row in timetable_rows:
            course_id = row.subject_id
            if course_id not in class_dates_by_course:
                continue
            weekday_index = DAY_NAME_TO_INDEX.get(row.day_of_week)
            if weekday_index is None:
                continue

            cursor = start_date
            while cursor <= end_date:
                if cursor.weekday() == weekday_index:
                    scheduled_count_by_course[course_id] += 1
                    class_dates_by_course[course_id].add(cursor)
                cursor += timedelta(days=1)
    else:
        # Fallback for missing timetable rows: infer class dates from attendance history.
        sessions_result = await db.execute(
            select(Attendance.course_id, Attendance.date)
            .where(
                and_(
                    Attendance.course_id.in_(course_ids),
                    Attendance.date >= start_date,
                    Attendance.date <= end_date,
                )
            )
            .distinct()
        )
        for course_id, session_date in sessions_result.fetchall():
            if course_id not in class_dates_by_course:
                continue
            class_dates_by_course[course_id].add(session_date)

        for course_id in course_ids:
            scheduled_count_by_course[course_id] = len(class_dates_by_course[course_id])

    attended_count_by_course: Dict[int, int] = {course_id: 0 for course_id in course_ids}
    valid_course_ids = set(course_ids)

    subjects: List[SubjectAttendanceRow] = []
    total_classes = 0
    attended_count = 0
    late_count = 0
    all_class_dates: Set[date] = set()
    present_dates: Set[date] = set()

    for record in student_records:
        course_id = record.course_id
        if course_id not in valid_course_ids:
            continue
        if record.status not in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]:
            continue

        attended_count_by_course[course_id] += 1
        if record.status == AttendanceStatus.LATE:
            late_count += 1

        class_dates = class_dates_by_course.get(course_id, set())
        # In strict timetable mode, mark present day only if that day is actually scheduled.
        if not class_dates or record.date in class_dates:
            present_dates.add(record.date)

    for course_id in course_ids:
        course = course_map.get(course_id)
        if not course:
            continue

        class_dates = class_dates_by_course.get(course_id, set())
        course_total_classes = scheduled_count_by_course.get(course_id, 0)
        raw_course_attended = attended_count_by_course.get(course_id, 0)
        course_attended = min(raw_course_attended, course_total_classes) if course_total_classes > 0 else 0

        course_absent = max(0, course_total_classes - course_attended)
        attendance_percentage = round(
            (course_attended / course_total_classes * 100) if course_total_classes > 0 else 0.0,
            2,
        )

        subjects.append(
            SubjectAttendanceRow(
                course_id=course.id,
                subject=course.name,
                subject_code=course.code,
                total_classes=course_total_classes,
                attended_classes=course_attended,
                absent_classes=course_absent,
                attendance_percentage=attendance_percentage,
                below_threshold=attendance_percentage < threshold,
            )
        )

        total_classes += course_total_classes
        attended_count += course_attended
        all_class_dates.update(class_dates)

    absent_count = max(0, total_classes - attended_count)
    present_count = max(0, attended_count - late_count)

    return {
        "subjects": subjects,
        "present_count": present_count,
        "late_count": late_count,
        "absent_count": absent_count,
        "attended_count": attended_count,
        "total_classes": total_classes,
        "all_class_dates": all_class_dates,
        "present_dates": present_dates,
    }


def _build_calendar_status(
    start_date: date,
    end_date: date,
    all_class_dates: Set[date],
    present_dates: Set[date],
) -> List[CalendarDayStatus]:
    """Build per-day calendar status map for current student."""
    calendar: List[CalendarDayStatus] = []
    cursor = start_date

    while cursor <= end_date:
        if cursor in present_dates:
            status = "present"
        elif cursor in all_class_dates:
            status = "absent"
        else:
            status = "holiday"

        calendar.append(CalendarDayStatus(date=cursor.isoformat(), status=status))
        cursor += timedelta(days=1)

    return calendar


@router.post("/mark", response_model=AttendanceMarkResponse)
async def mark_attendance(
    request: AttendanceMarkRequest,
    class_start_time: Optional[str] = Query(None, description="Class start time HH:MM"),
    mode: str = Query("daily", description="Attendance mode: 'daily' (15 min threshold) or 'hourly' (10 min threshold)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Mark attendance using face recognition."""
    start_time = None
    if class_start_time:
        hours, minutes = map(int, class_start_time.split(":"))
        start_time = time(hours, minutes)

    resolved_timetable_id: Optional[int] = request.timetable_id

    if current_user.role == UserRole.FACULTY:
        today = today_ist()
        today_name = today.strftime("%A")
        timetable_result = await db.execute(
            select(Timetable).where(
                and_(
                    Timetable.faculty_id == current_user.id,
                    Timetable.subject_id == request.course_id,
                    Timetable.day_of_week == today_name,
                )
            )
        )
        rows = list(timetable_result.scalars().all())
        if not rows:
            raise HTTPException(
                status_code=400,
                detail="No timetable slot found for this course today."
            )

        now = now_ist_naive()
        matched = None
        for row in rows:
            window_start = datetime.combine(today, row.start_time) - timedelta(minutes=ATTENDANCE_GUARD_BEFORE_MINUTES)
            window_end = datetime.combine(today, row.end_time) + timedelta(minutes=ATTENDANCE_GUARD_AFTER_MINUTES)
            if window_start <= now <= window_end:
                matched = row
                break

        if not matched:
            raise HTTPException(
                status_code=400,
                detail="Attendance can only be marked during scheduled class time."
            )

        resolved_timetable_id = matched.id

        # Use timetable start time for late calculation unless explicitly provided.
        if start_time is None:
            start_time = matched.start_time
    elif request.timetable_id is not None:
        timetable_result = await db.execute(
            select(Timetable).where(Timetable.id == request.timetable_id)
        )
        timetable_row = timetable_result.scalar_one_or_none()
        if not timetable_row:
            raise HTTPException(
                status_code=400,
                detail="Timetable slot not found.",
            )
        if timetable_row.subject_id != request.course_id:
            raise HTTPException(
                status_code=400,
                detail="Timetable slot does not match course.",
            )
        if start_time is None:
            start_time = timetable_row.start_time
    
    # Set late threshold based on mode
    late_threshold_minutes = 15 if mode == "daily" else 10
    
    result = await attendance_service.mark_attendance_by_face(
        db,
        request.course_id,
        request.image_base64,
        start_time,
        late_threshold_minutes,
        resolved_timetable_id,
    )
    
    return result


@router.get("/entry-status", response_model=EntryStatusResponse)
async def get_entry_status(
    class_id: int = Query(..., description="Class ID"),
    target_date: Optional[date] = Query(None, description="Date in YYYY-MM-DD"),
    session_id: Optional[int] = Query(None, description="Attendance session ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Get entry attendance present/absent split for a class."""
    await _ensure_class_access(db=db, current_user=current_user, class_id=class_id)

    attendance_date = target_date or today_ist()

    session: AttendanceSession | None = None
    if session_id is not None:
        session_result = await db.execute(
            select(AttendanceSession).where(AttendanceSession.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.class_id != class_id:
            raise HTTPException(status_code=400, detail="Session does not belong to selected class")
        attendance_date = session.start_time.date()

    students_result = await db.execute(
        select(Student)
        .where(
            and_(
                Student.class_id == class_id,
                Student.is_active == True,
            )
        )
        .order_by(Student.full_name.asc())
    )
    all_students = list(students_result.scalars().all())

    attendance_rows_query = (
        select(Attendance, Student)
        .join(Student, Attendance.student_id == Student.id)
        .where(
            and_(
                Student.class_id == class_id,
                Student.is_active == True,
                Attendance.date == attendance_date,
            )
        )
        .order_by(Attendance.check_in_time.desc(), Attendance.id.desc())
    )
    if session:
        attendance_rows_query = attendance_rows_query.where(Attendance.session_id == session.id)
    else:
        attendance_rows_query = attendance_rows_query.where(
            Attendance.attendance_type == AttendanceType.ENTRY.value
        )

    attendance_rows_result = await db.execute(attendance_rows_query)

    present_map: Dict[int, EntryStatusStudent] = {}
    explicitly_absent_map: Dict[int, EntryStatusStudent] = {}
    for attendance, student in attendance_rows_result.fetchall():
        if student.id in present_map or student.id in explicitly_absent_map:
            continue
        row = EntryStatusStudent(
            id=student.id,
            student_id=student.student_id,
            register_no=student.register_no,
            full_name=student.full_name,
            status=attendance.status,
            check_in_time=attendance.check_in_time.strftime("%H:%M")
            if attendance.check_in_time
            else None,
            attendance_id=attendance.id,
            is_manual=attendance.is_manual,
        )
        if attendance.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]:
            present_map[student.id] = row
        else:
            explicitly_absent_map[student.id] = row

    present = sorted(present_map.values(), key=lambda item: item.full_name.lower())

    absent: List[EntryStatusStudent] = sorted(
        explicitly_absent_map.values(), key=lambda item: item.full_name.lower()
    )
    for student in all_students:
        if student.id in present_map or student.id in explicitly_absent_map:
            continue
        absent.append(
            EntryStatusStudent(
                id=student.id,
                student_id=student.student_id,
                register_no=student.register_no,
                full_name=student.full_name,
            )
        )
    absent.sort(key=lambda item: item.full_name.lower())

    return EntryStatusResponse(
        class_id=class_id,
        date=attendance_date.isoformat(),
        present=present,
        absent=absent,
    )


@router.post("/manual-mark", response_model=ManualAttendanceMarkResponse)
async def manual_mark_attendance(
    payload: ManualAttendanceMarkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Manually create/update attendance record for a student."""
    student_result = await db.execute(
        select(Student).where(
            and_(
                Student.id == payload.student_id,
                Student.is_active == True,
            )
        )
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    session_obj: AttendanceSession | None = None
    attendance_type = payload.type.value
    attendance_date = payload.date or today_ist()
    resolved_course_id = payload.course_id

    if payload.session_id is not None:
        session_result = await db.execute(
            select(AttendanceSession).where(AttendanceSession.id == payload.session_id)
        )
        session_obj = session_result.scalar_one_or_none()
        if not session_obj:
            raise HTTPException(status_code=404, detail="Session not found")
        if student.class_id is None or student.class_id != session_obj.class_id:
            raise HTTPException(status_code=400, detail="Student is not in this session class")

        await _ensure_class_access(
            db=db, current_user=current_user, class_id=session_obj.class_id
        )
        attendance_type = (
            AttendanceType.ENTRY.value
            if session_obj.session_type == AttendanceType.ENTRY.value
            else AttendanceType.SESSION.value
        )
        attendance_date = payload.date or session_obj.start_time.date()
        resolved_course_id = (
            payload.course_id if payload.course_id is not None else session_obj.subject_id
        )
    else:
        if student.class_id is None:
            raise HTTPException(status_code=400, detail="Student class mapping not found")
        await _ensure_class_access(db=db, current_user=current_user, class_id=student.class_id)

    now = now_ist_naive()

    if attendance_type == AttendanceType.SESSION.value and resolved_course_id is None:
        raise HTTPException(
            status_code=400,
            detail="course_id is required for session manual marking",
        )

    if resolved_course_id is not None:
        course_result = await db.execute(
            select(Course.id).where(Course.id == resolved_course_id)
        )
        if not course_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Course not found")

    existing_query = (
        select(Attendance)
        .where(
            and_(
                Attendance.student_id == payload.student_id,
                Attendance.date == attendance_date,
                Attendance.attendance_type == attendance_type,
            )
        )
        .order_by(Attendance.check_in_time.desc(), Attendance.id.desc())
    )
    if payload.session_id is not None:
        existing_query = existing_query.where(Attendance.session_id == payload.session_id)
    elif attendance_type == AttendanceType.SESSION.value:
        existing_query = existing_query.where(Attendance.course_id == resolved_course_id)

    existing_result = await db.execute(existing_query)
    attendance = existing_result.scalars().first()

    if attendance:
        attendance.status = payload.status
        attendance.is_manual = True
        if resolved_course_id is not None:
            attendance.course_id = resolved_course_id
        if payload.session_id is not None:
            attendance.session_id = payload.session_id
        attendance.attendance_type = attendance_type
        attendance.date = attendance_date
        attendance.check_in_time = now
        message = "Attendance updated manually"
    else:
        attendance = Attendance(
            student_id=payload.student_id,
            course_id=resolved_course_id,
            session_id=payload.session_id,
            attendance_type=attendance_type,
            date=attendance_date,
            check_in_time=now,
            status=payload.status,
            confidence_score=None,
            is_manual=True,
        )
        db.add(attendance)
        message = "Attendance marked manually"

    await db.commit()
    await db.refresh(attendance)

    return ManualAttendanceMarkResponse(
        success=True,
        message=message,
        attendance_id=attendance.id,
        student_id=attendance.student_id,
        status=attendance.status,
        type=AttendanceType(attendance_type),
        is_manual=attendance.is_manual,
    )


@router.get("/class/{class_id}/students", response_model=List[ClassStudentResponse])
async def list_class_students_for_attendance(
    class_id: int,
    session_id: Optional[int] = Query(None, description="Optional session id for current status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """List active students in class with current session status and attendance percentage."""
    await _ensure_class_access(db=db, current_user=current_user, class_id=class_id)

    session_obj: AttendanceSession | None = None
    if session_id is not None:
        session_result = await db.execute(
            select(AttendanceSession).where(AttendanceSession.id == session_id)
        )
        session_obj = session_result.scalar_one_or_none()
        if not session_obj:
            raise HTTPException(status_code=404, detail="Session not found")
        if session_obj.class_id != class_id:
            raise HTTPException(status_code=400, detail="Session does not belong to selected class")

    students_result = await db.execute(
        select(Student)
        .where(
            and_(
                Student.class_id == class_id,
                Student.is_active == True,
            )
        )
        .order_by(Student.full_name.asc())
    )
    students = list(students_result.scalars().all())
    if not students:
        return []

    student_ids = [student.id for student in students]

    total_sessions_result = await db.execute(
        select(func.count(AttendanceSession.id)).where(AttendanceSession.class_id == class_id)
    )
    total_sessions = total_sessions_result.scalar() or 0

    attended_count_result = await db.execute(
        select(Attendance.student_id, func.count(Attendance.id))
        .join(AttendanceSession, Attendance.session_id == AttendanceSession.id)
        .where(
            and_(
                AttendanceSession.class_id == class_id,
                Attendance.student_id.in_(student_ids),
                Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
            )
        )
        .group_by(Attendance.student_id)
    )
    attended_count_map = {
        student_id: count for student_id, count in attended_count_result.fetchall()
    }

    session_status_map: Dict[int, AttendanceStatus] = {}
    if session_obj is not None:
        session_attendance_result = await db.execute(
            select(Attendance)
            .where(
                and_(
                    Attendance.session_id == session_obj.id,
                    Attendance.student_id.in_(student_ids),
                )
            )
            .order_by(Attendance.id.desc())
        )
        for row in session_attendance_result.scalars().all():
            if row.student_id in session_status_map:
                continue
            session_status_map[row.student_id] = row.status

    rows: List[ClassStudentResponse] = []
    for student in students:
        attended = attended_count_map.get(student.id, 0)
        percentage = round((attended / total_sessions * 100) if total_sessions > 0 else 0.0, 2)
        rows.append(
            ClassStudentResponse(
                id=student.id,
                student_id=student.student_id,
                register_no=student.register_no,
                full_name=student.full_name,
                attendance_percentage=percentage,
                current_status=session_status_map.get(student.id, AttendanceStatus.PRESENT),
            )
        )

    return rows


@router.post("/bulk-mark", response_model=BulkAttendanceMarkResponse)
async def bulk_mark_attendance(
    payload: BulkAttendanceMarkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Bulk create/update attendance statuses for a single session."""
    if not payload.students:
        raise HTTPException(status_code=400, detail="students list cannot be empty")

    session_result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.id == payload.session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await _ensure_class_access(db=db, current_user=current_user, class_id=session.class_id)

    students_result = await db.execute(
        select(Student.id)
        .where(
            and_(
                Student.class_id == session.class_id,
                Student.is_active == True,
            )
        )
    )
    valid_student_ids = {row[0] for row in students_result.fetchall()}

    status_by_student: Dict[int, AttendanceStatus] = {}
    for item in payload.students:
        status_by_student[item.student_id] = item.status

    invalid_ids = [student_id for student_id in status_by_student if student_id not in valid_student_ids]
    if invalid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Some students do not belong to this class: {invalid_ids}",
        )

    attendance_type = (
        AttendanceType.ENTRY.value
        if session.session_type == AttendanceType.ENTRY.value
        else AttendanceType.SESSION.value
    )
    session_date = session.start_time.date()
    now = now_ist_naive()

    existing_result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.session_id == session.id,
                Attendance.student_id.in_(list(status_by_student.keys())),
            )
        )
    )
    existing_map = {row.student_id: row for row in existing_result.scalars().all()}

    updated_count = 0
    for student_id, status in status_by_student.items():
        attendance = existing_map.get(student_id)
        if attendance:
            attendance.status = status
            attendance.is_manual = True
            attendance.check_in_time = now
            attendance.course_id = session.subject_id
            attendance.attendance_type = attendance_type
            attendance.date = session_date
        else:
            db.add(
                Attendance(
                    student_id=student_id,
                    course_id=session.subject_id,
                    session_id=session.id,
                    attendance_type=attendance_type,
                    date=session_date,
                    check_in_time=now,
                    status=status,
                    confidence_score=None,
                    is_manual=True,
                )
            )
        updated_count += 1

    await db.commit()

    counts_result = await db.execute(
        select(Attendance.status, func.count(Attendance.id))
        .where(Attendance.session_id == session.id)
        .group_by(Attendance.status)
    )
    present_count = 0
    absent_count = 0
    for status, count in counts_result.fetchall():
        if status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]:
            present_count += count
        elif status == AttendanceStatus.ABSENT:
            absent_count += count

    return BulkAttendanceMarkResponse(
        success=True,
        message="Bulk attendance updated",
        session_id=session.id,
        updated_count=updated_count,
        present_count=present_count,
        absent_count=absent_count,
    )


@router.get("/my-stats", response_model=UserAttendanceStats)
async def get_my_attendance_stats(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's attendance statistics."""
    start_date, end_date = _get_date_range(month)

    # Student stats are based on student's own attendance profile.
    if current_user.role == UserRole.STUDENT:
        student = await _get_student_for_user(db, current_user)
        metrics = await _build_student_subject_metrics(
            db=db,
            student_id=student.id,
            student_class_id=student.class_id,
            start_date=start_date,
            end_date=end_date,
            threshold=DEFAULT_ATTENDANCE_THRESHOLD,
        )

        total_classes = int(metrics["total_classes"])
        attended_count = int(metrics["attended_count"])
        attendance_percentage = round(
            (attended_count / total_classes * 100) if total_classes > 0 else 0.0,
            2,
        )

        return UserAttendanceStats(
            attendance_percentage=attendance_percentage,
            total_working_days=total_classes,
            present_count=int(metrics["present_count"]),
            late_count=int(metrics["late_count"]),
            absent_count=int(metrics["absent_count"]),
            total_classes=total_classes,
        )

    # Faculty/Admin view: reporting over managed courses.
    course_query = select(Course)
    if current_user.role == UserRole.FACULTY:
        faculty_course_ids = await _get_faculty_course_ids(db, current_user.id)
        if not faculty_course_ids:
            return UserAttendanceStats(
                attendance_percentage=0,
                total_working_days=0,
                present_count=0,
                late_count=0,
                absent_count=0,
                total_classes=0,
            )
        course_query = course_query.where(Course.id.in_(faculty_course_ids))

    courses_result = await db.execute(course_query)
    courses = courses_result.scalars().all()
    if not courses:
        return UserAttendanceStats(
            attendance_percentage=0,
            total_working_days=0,
            present_count=0,
            late_count=0,
            absent_count=0,
            total_classes=0,
        )

    total_working_days = 0
    if current_user.role == UserRole.FACULTY:
        timetable_rows = await _get_faculty_timetable_rows(db, current_user.id)
        total_working_days = _count_timetable_occurrences(timetable_rows, start_date, end_date)
    else:
        for course in courses:
            scheduled_days = _normalize_schedule_days(course.schedule)
            cursor = start_date
            while cursor <= end_date:
                if cursor.weekday() in scheduled_days:
                    total_working_days += 1
                cursor += timedelta(days=1)

    course_ids = [course.id for course in courses]
    present_result = await db.execute(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.course_id.in_(course_ids),
                Attendance.date >= start_date,
                Attendance.date <= end_date,
                Attendance.status == AttendanceStatus.PRESENT,
            )
        )
    )
    present_count = present_result.scalar() or 0

    late_result = await db.execute(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.course_id.in_(course_ids),
                Attendance.date >= start_date,
                Attendance.date <= end_date,
                Attendance.status == AttendanceStatus.LATE,
            )
        )
    )
    late_count = late_result.scalar() or 0

    total_classes = total_working_days
    absent_count = max(0, total_classes - present_count - late_count)
    attendance_percentage = round(
        ((present_count + late_count) / total_classes * 100) if total_classes > 0 else 0.0,
        2,
    )

    return UserAttendanceStats(
        attendance_percentage=attendance_percentage,
        total_working_days=total_working_days,
        present_count=present_count,
        late_count=late_count,
        absent_count=absent_count,
        total_classes=total_classes,
    )


@router.get("/subject-wise", response_model=List[SubjectAttendanceRow])
async def get_subject_wise_attendance(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    threshold: float = Query(DEFAULT_ATTENDANCE_THRESHOLD, ge=50, le=95),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get subject-wise attendance percentage for logged-in student."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can access subject-wise attendance")

    start_date, end_date = _get_date_range(month)
    student = await _get_student_for_user(db, current_user)
    metrics = await _build_student_subject_metrics(
        db=db,
        student_id=student.id,
        student_class_id=student.class_id,
        start_date=start_date,
        end_date=end_date,
        threshold=threshold,
    )
    return metrics["subjects"]  # type: ignore[return-value]


@router.get("/my-history", response_model=List[UserAttendanceRecord])
async def get_my_attendance_history(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's attendance history."""
    start_date, end_date = _get_date_range(month)

    if current_user.role == UserRole.STUDENT:
        student = await _get_student_for_user(db, current_user)
        result = await db.execute(
            select(Attendance, Course)
            .join(Course, Attendance.course_id == Course.id)
            .where(
                and_(
                    Attendance.student_id == student.id,
                    Attendance.date >= start_date,
                    Attendance.date <= end_date,
                )
            )
            .order_by(Attendance.date.desc(), Attendance.check_in_time.desc())
            .limit(limit)
        )

        return [
            UserAttendanceRecord(
                id=attendance.id,
                course_name=course.name,
                course_code=course.code,
                date=attendance.date.isoformat(),
                status=attendance.status.value,
                check_in_time=attendance.check_in_time.strftime("%H:%M")
                if attendance.check_in_time
                else None,
            )
            for attendance, course in result.fetchall()
        ]

    course_query = select(Course)
    if current_user.role == UserRole.FACULTY:
        faculty_course_ids = await _get_faculty_course_ids(db, current_user.id)
        if not faculty_course_ids:
            return []
        course_query = course_query.where(Course.id.in_(faculty_course_ids))

    courses_result = await db.execute(course_query)
    courses = courses_result.scalars().all()
    course_ids = [course.id for course in courses]
    course_map = {course.id: course for course in courses}
    if not course_ids:
        return []

    result = await db.execute(
        select(Attendance)
        .where(
            and_(
                Attendance.course_id.in_(course_ids),
                Attendance.date >= start_date,
                Attendance.date <= end_date,
            )
        )
        .order_by(Attendance.date.desc(), Attendance.check_in_time.desc())
        .limit(limit)
    )

    records = result.scalars().all()
    response: List[UserAttendanceRecord] = []
    for record in records:
        course = course_map.get(record.course_id)
        response.append(
            UserAttendanceRecord(
                id=record.id,
                course_name=course.name if course else "Unknown",
                course_code=course.code if course else "N/A",
                date=record.date.isoformat(),
                status=record.status.value,
                check_in_time=record.check_in_time.strftime("%H:%M")
                if record.check_in_time
                else None,
            )
        )

    return response


@router.get("/dashboard")
async def get_role_dashboard_data(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    threshold: float = Query(DEFAULT_ATTENDANCE_THRESHOLD, ge=50, le=95),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Unified dashboard payload by role.
    Keeps Student / Faculty / Admin views simple and aligned to college workflows.
    """
    start_date, end_date = _get_date_range(month)
    today = today_ist()

    if current_user.role == UserRole.STUDENT:
        student = await _get_student_for_user(db, current_user)
        metrics = await _build_student_subject_metrics(
            db=db,
            student_id=student.id,
            student_class_id=student.class_id,
            start_date=start_date,
            end_date=end_date,
            threshold=threshold,
        )

        total_classes = int(metrics["total_classes"])
        attended_count = int(metrics["attended_count"])
        attendance_percentage = round(
            (attended_count / total_classes * 100) if total_classes > 0 else 0.0,
            2,
        )

        all_class_dates = metrics["all_class_dates"]
        present_dates = metrics["present_dates"]
        if today in present_dates:
            today_status = "present"
        elif today in all_class_dates:
            today_status = "absent"
        else:
            today_status = "holiday"

        recent_result = await db.execute(
            select(Notification).where(Notification.user_id == current_user.id).order_by(
                Notification.created_at.desc()
            ).limit(8)
        )
        notifications: List[DashboardNotification] = []
        for item in recent_result.scalars().all():
            notifications.append(
                DashboardNotification(
                    id=f"notification-{item.id}",
                    category=item.type,
                    message=item.message,
                    timestamp=item.created_at.isoformat(),
                )
            )

        calendar = _build_calendar_status(
            start_date=start_date,
            end_date=end_date,
            all_class_dates=all_class_dates,
            present_dates=present_dates,
        )

        return {
            "role": "student",
            "threshold": threshold,
            "profile": {
                "name": current_user.full_name,
                "register_number": student.register_no or student.student_id,
                "department": student.department,
                "semester": student.semester,
                "face_preview_url": student.photo_url,
            },
            "summary": {
                "overall_attendance_percentage": attendance_percentage,
                "today_status": today_status,
                "shortage_warning": attendance_percentage < threshold,
                "total_classes": total_classes,
                "present_count": int(metrics["present_count"]),
                "late_count": int(metrics["late_count"]),
                "absent_count": int(metrics["absent_count"]),
            },
            "subject_attendance": [
                row.model_dump() for row in metrics["subjects"]  # type: ignore[index]
            ],
            "calendar": [day.model_dump() for day in calendar],
            "notifications": [item.model_dump() for item in notifications],
        }

    if current_user.role == UserRole.FACULTY:
        faculty_course_ids = await _get_faculty_course_ids(db, current_user.id)
        faculty_courses = []
        if faculty_course_ids:
            courses_result = await db.execute(select(Course).where(Course.id.in_(faculty_course_ids)))
            faculty_courses = courses_result.scalars().all()

        today_token = today.strftime("%a")
        today_name = today.strftime("%A")
        today_classes = []
        today_course_ids: Set[int] = set()

        today_rows_result = await db.execute(
            select(Timetable, Course)
            .join(Course, Timetable.subject_id == Course.id)
            .where(
                and_(
                    Timetable.faculty_id == current_user.id,
                    Timetable.day_of_week == today_name,
                )
            )
            .order_by(Timetable.start_time)
        )
        for row, course in today_rows_result.fetchall():
            today_classes.append(
                {
                    "course_id": course.id,
                    "course_code": course.code,
                    "course_name": course.name,
                    "time": f"{row.start_time.strftime('%H:%M')} - {row.end_time.strftime('%H:%M')}",
                }
            )
            today_course_ids.add(course.id)

        total_students_result = await db.execute(
            select(func.count(Student.id)).where(Student.is_active == True)
        )
        total_students = total_students_result.scalar() or 0

        present_count = 0
        recognized_students = []
        if today_course_ids:
            present_result = await db.execute(
                select(func.count(Attendance.id)).where(
                    and_(
                        Attendance.course_id.in_(list(today_course_ids)),
                        Attendance.date == today,
                        Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
                    )
                )
            )
            present_count = present_result.scalar() or 0

            recognized_result = await db.execute(
                select(Attendance, Student, Course)
                .join(Student, Attendance.student_id == Student.id)
                .join(Course, Attendance.course_id == Course.id)
                .where(
                    and_(
                        Attendance.course_id.in_(list(today_course_ids)),
                        Attendance.date == today,
                    )
                )
                .order_by(Attendance.check_in_time.desc())
                .limit(12)
            )
            for attendance, student, course in recognized_result.fetchall():
                recognized_students.append(
                    {
                        "attendance_id": attendance.id,
                        "student_id": student.student_id,
                        "student_name": student.full_name,
                        "course_code": course.code,
                        "status": attendance.status.value,
                        "time": attendance.check_in_time.strftime("%H:%M"),
                    }
                )

        month_start = date(today.year, today.month, 1)
        session_counts_by_course: Dict[int, int] = {}
        monthly_attended = 0
        shortage_count = 0

        if faculty_course_ids:
            month_sessions_result = await db.execute(
                select(Attendance.course_id, Attendance.date)
                .where(
                    and_(
                        Attendance.course_id.in_(faculty_course_ids),
                        Attendance.date >= month_start,
                        Attendance.date <= today,
                    )
                )
                .distinct()
            )
            month_sessions = month_sessions_result.fetchall()
            for course_id, _session_date in month_sessions:
                session_counts_by_course[course_id] = session_counts_by_course.get(course_id, 0) + 1

            monthly_attended_result = await db.execute(
                select(func.count(Attendance.id)).where(
                    and_(
                        Attendance.course_id.in_(faculty_course_ids),
                        Attendance.date >= month_start,
                        Attendance.date <= today,
                        Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
                    )
                )
            )
            monthly_attended = monthly_attended_result.scalar() or 0

            shortage_result = await db.execute(
                select(
                    Attendance.student_id,
                    Attendance.course_id,
                    func.count(Attendance.id).label("attended_count"),
                )
                .where(
                    and_(
                        Attendance.course_id.in_(faculty_course_ids),
                        Attendance.date >= month_start,
                        Attendance.date <= today,
                        Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
                    )
                )
                .group_by(Attendance.student_id, Attendance.course_id)
            )
            for student_id, course_id, attended in shortage_result.fetchall():
                _ = student_id
                possible = session_counts_by_course.get(course_id, 0)
                if possible <= 0:
                    continue
                attendance_percentage = attended / possible * 100
                if attendance_percentage < threshold:
                    shortage_count += 1

        total_sessions_in_month = sum(session_counts_by_course.values())
        monthly_possible = total_sessions_in_month * total_students
        monthly_rate = round((monthly_attended / monthly_possible * 100) if monthly_possible > 0 else 0.0, 2)

        daily_possible = len(today_course_ids) * total_students
        daily_rate = round((present_count / daily_possible * 100) if daily_possible > 0 else 0.0, 2)

        unknown_faces_today = await unknown_face_service.count_unresolved_for_date(
            db=db, target_date=today
        )

        return {
            "role": "faculty",
            "threshold": threshold,
            "summary": {
                "today_label": today_token,
                "today_class_count": len(today_classes),
                "total_students": total_students,
                "present_count": present_count,
            },
            "today_classes": today_classes,
            "live_attendance": {
                "quick_action_route": "/attendance",
                "recognized_students": recognized_students,
                "unknown_face_alerts": unknown_faces_today,
            },
            "report_summary": {
                "daily_attendance_rate": daily_rate,
                "monthly_attendance_rate": monthly_rate,
                "shortage_records": shortage_count,
            },
        }

    # Admin dashboard payload
    active_users_result = await db.execute(
        select(User.role, func.count(User.id))
        .where(User.is_active == True)
        .group_by(User.role)
    )
    role_counts = {"students": 0, "faculty": 0, "admins": 0}
    for role, count in active_users_result.fetchall():
        role_value = role.value if hasattr(role, "value") else str(role)
        if role_value == "student":
            role_counts["students"] = count
        elif role_value == "faculty":
            role_counts["faculty"] = count
        elif role_value == "admin":
            role_counts["admins"] = count

    total_students_result = await db.execute(
        select(func.count(Student.id)).where(Student.is_active == True)
    )
    total_students = total_students_result.scalar() or 0

    overall_sessions_result = await db.execute(
        select(Attendance.course_id, Attendance.date)
        .where(and_(Attendance.date >= start_date, Attendance.date <= end_date))
        .distinct()
    )
    overall_sessions = len(overall_sessions_result.fetchall())

    overall_attended_result = await db.execute(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.date >= start_date,
                Attendance.date <= end_date,
                Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
            )
        )
    )
    overall_attended = overall_attended_result.scalar() or 0
    overall_possible = overall_sessions * total_students
    overall_percentage = round((overall_attended / overall_possible * 100) if overall_possible > 0 else 0.0, 2)

    department_result = await db.execute(
        select(Student.department, func.count(Student.id))
        .where(Student.is_active == True)
        .group_by(Student.department)
    )
    department_stats = []
    for department, department_total in department_result.fetchall():
        if not department:
            continue

        dept_sessions_result = await db.execute(
            select(Attendance.course_id, Attendance.date)
            .join(Student, Attendance.student_id == Student.id)
            .where(
                and_(
                    Student.department == department,
                    Attendance.date >= start_date,
                    Attendance.date <= end_date,
                )
            )
            .distinct()
        )
        dept_sessions = len(dept_sessions_result.fetchall())

        dept_attended_result = await db.execute(
            select(func.count(Attendance.id))
            .join(Student, Attendance.student_id == Student.id)
            .where(
                and_(
                    Student.department == department,
                    Attendance.date >= start_date,
                    Attendance.date <= end_date,
                    Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
                )
            )
        )
        dept_attended = dept_attended_result.scalar() or 0
        dept_possible = dept_sessions * department_total
        dept_percentage = round((dept_attended / dept_possible * 100) if dept_possible > 0 else 0.0, 2)
        department_stats.append(
            {
                "department": department,
                "student_count": department_total,
                "attendance_percentage": dept_percentage,
            }
        )

    course_sessions_result = await db.execute(
        select(Attendance.course_id, func.count(func.distinct(Attendance.date)))
        .where(and_(Attendance.date >= start_date, Attendance.date <= end_date))
        .group_by(Attendance.course_id)
    )
    course_sessions_map = {course_id: session_count for course_id, session_count in course_sessions_result.fetchall()}

    course_attended_result = await db.execute(
        select(Attendance.course_id, func.count(Attendance.id))
        .where(
            and_(
                Attendance.date >= start_date,
                Attendance.date <= end_date,
                Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
            )
        )
        .group_by(Attendance.course_id)
    )
    course_attended_map = {course_id: attended_count for course_id, attended_count in course_attended_result.fetchall()}

    courses_result = await db.execute(select(Course))
    top_performing_class = None
    top_rate = -1.0
    for course in courses_result.scalars().all():
        sessions = course_sessions_map.get(course.id, 0)
        possible = sessions * total_students
        if possible <= 0:
            continue
        attendance_rate = course_attended_map.get(course.id, 0) / possible * 100
        if attendance_rate > top_rate:
            top_rate = attendance_rate
            top_performing_class = {
                "course_id": course.id,
                "course_code": course.code,
                "course_name": course.name,
                "attendance_percentage": round(attendance_rate, 2),
            }

    trend = []
    trend_start = max(start_date, end_date - timedelta(days=6))
    cursor = trend_start
    while cursor <= end_date:
        daily_sessions_result = await db.execute(
            select(Attendance.course_id).where(Attendance.date == cursor).distinct()
        )
        daily_sessions = len(daily_sessions_result.fetchall())
        daily_possible = daily_sessions * total_students

        daily_present_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.date == cursor,
                    Attendance.status == AttendanceStatus.PRESENT,
                )
            )
        )
        daily_late_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.date == cursor,
                    Attendance.status == AttendanceStatus.LATE,
                )
            )
        )
        daily_present = daily_present_result.scalar() or 0
        daily_late = daily_late_result.scalar() or 0
        daily_absent = max(0, daily_possible - daily_present - daily_late)

        trend.append(
            {
                "date": cursor.isoformat(),
                "present": daily_present,
                "late": daily_late,
                "absent": daily_absent,
            }
        )
        cursor += timedelta(days=1)

    return {
        "role": "admin",
        "threshold": threshold,
        "user_counts": role_counts,
        "summary": {
            "overall_attendance_percentage": overall_percentage,
            "total_records": overall_attended,
            "total_students": total_students,
        },
        "department_attendance": department_stats,
        "top_performing_class": top_performing_class,
        "attendance_trends": trend,
        "system_settings": {
            "attendance_threshold": threshold,
            "camera_mode": "default",
            "backup_enabled": True,
        },
    }


@router.get("/export")
async def export_class_entry_attendance(
    class_id: int = Query(..., description="Class ID"),
    target_date: Optional[date] = Query(None, description="Date in YYYY-MM-DD, defaults to today"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Export entry attendance for a class to Excel with summary stats."""
    await _ensure_class_access(db=db, current_user=current_user, class_id=class_id)

    attendance_date = target_date or today_ist()

    buffer = await export_service.export_class_entry_attendance_excel(
        db, class_id, attendance_date
    )

    filename = f"entry_attendance_class{class_id}_{attendance_date}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/course/{course_id}", response_model=List[AttendanceResponse])
async def get_course_attendance(
    course_id: int,
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Get attendance records for a course."""
    if target_date is None:
        target_date = today_ist()
    
    result = await db.execute(
        select(Attendance)
        .where(
            and_(
                Attendance.course_id == course_id,
                Attendance.date == target_date
            )
        )
        .order_by(Attendance.check_in_time)
    )
    
    return result.scalars().all()


@router.get("/course/{course_id}/stats", response_model=AttendanceStats)
async def get_course_stats(
    course_id: int,
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Get attendance statistics for a course."""
    return await attendance_service.get_course_attendance_stats(
        db, course_id, target_date
    )


@router.get("/course/{course_id}/export/excel")
async def export_excel(
    course_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Export attendance to Excel."""
    buffer = await export_service.export_attendance_excel(
        db, course_id, start_date, end_date
    )
    
    # Get course name for filename
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    filename = f"attendance_{course.code if course else course_id}_{start_date}_{end_date}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/course/{course_id}/export/csv")
async def export_csv(
    course_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Export attendance to CSV."""
    csv_content = await export_service.export_attendance_csv(
        db, course_id, start_date, end_date
    )
    
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    filename = f"attendance_{course.code if course else course_id}_{start_date}_{end_date}.csv"
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

