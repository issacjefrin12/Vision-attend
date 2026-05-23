"""Attendance service with once-per-day logic."""
from datetime import datetime, date, time, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Tuple, Optional, List

from app.models.attendance import Attendance, AttendanceStatus
from app.models.student import Student
from app.models.course import Course
from app.models.timetable import Timetable
from app.models.user import User
from app.schemas.attendance import AttendanceStats, AttendanceMarkResponse
try:
    from app.ml.pipeline import face_pipeline
except ImportError:
    face_pipeline = None
from app.config import get_settings
from app.services.notification_service import notification_service
from app.services.unknown_face_service import unknown_face_service
from app.services.esp32_serial_service import esp32_serial_service
from app.utils.timezone import now_ist_naive, today_ist

settings = get_settings()


class AttendanceService:
    """Attendance management with face recognition."""
    
    async def mark_attendance_by_face(
        self,
        db: AsyncSession,
        course_id: int,
        image_base64: str,
        class_start_time: Optional[time] = None,
        late_threshold_minutes: int = 15,
        timetable_id: Optional[int] = None,
    ) -> AttendanceMarkResponse:
        """
        Mark attendance using face recognition.
        
        Args:
            db: Database session
            course_id: Course ID for attendance
            image_base64: Base64 face image
            class_start_time: Optional class start time for late detection
            late_threshold_minutes: Minutes after class start to be considered late (15 for daily, 10 for hourly)
            
        Returns:
            AttendanceMarkResponse with result
        """
        if face_pipeline is None:
            return AttendanceMarkResponse(
                success=False,
                message=(
                    "Face recognition service is unavailable. "
                    "Check ML dependencies (mtcnn, tensorflow, face_recognition)."
                ),
                confidence=0.0
            )

        # Recognize face
        student_id, confidence, message = face_pipeline.recognize_student(image_base64)
        
        if not student_id:
            # Persist unknown face snapshot for faculty follow-up.
            await unknown_face_service.log_unknown_face(
                db=db,
                course_id=course_id,
                image_base64=image_base64,
                confidence=confidence,
            )
            esp32_serial_service.send_error()
            return AttendanceMarkResponse(
                success=False,
                message=message,
                confidence=confidence
            )
        
        # Get student details
        result = await db.execute(select(Student).where(Student.id == student_id))
        student = result.scalar_one_or_none()
        
        if not student:
            esp32_serial_service.send_error()
            return AttendanceMarkResponse(
                success=False,
                message="Student not found in database"
            )

        esp32_serial_service.send_success(student.full_name)
        
        # Check if already marked today
        today = today_ist()
        if timetable_id is not None:
            existing = await db.execute(
                select(Attendance).where(
                    and_(
                        Attendance.student_id == student_id,
                        Attendance.timetable_id == timetable_id,
                        Attendance.date == today,
                    )
                ).order_by(Attendance.check_in_time.desc(), Attendance.id.desc())
            )
        else:
            existing = await db.execute(
                select(Attendance).where(
                    and_(
                        Attendance.student_id == student_id,
                        Attendance.course_id == course_id,
                        Attendance.date == today,
                    )
                ).order_by(Attendance.check_in_time.desc(), Attendance.id.desc())
            )
        existing_attendance = existing.scalars().first()
        
        if existing_attendance:
            return AttendanceMarkResponse(
                success=True,
                message="Attendance already marked for today",
                student_id=student_id,
                student_name=student.full_name,
                status=existing_attendance.status,
                confidence=confidence
            )
        
        # Validate timetable slot if provided.
        if timetable_id is not None:
            timetable_result = await db.execute(
                select(Timetable).where(Timetable.id == timetable_id)
            )
            timetable_row = timetable_result.scalar_one_or_none()
            if not timetable_row:
                return AttendanceMarkResponse(
                    success=False,
                    message="Timetable slot not found",
                )
            if timetable_row.subject_id != course_id:
                return AttendanceMarkResponse(
                    success=False,
                    message="Timetable slot does not match course",
                )
            if student.class_id is None or student.class_id != timetable_row.class_id:
                return AttendanceMarkResponse(
                    success=False,
                    message="Student is not in the timetable class",
                )

        # Determine status (present or late)
        now = now_ist_naive()
        status = AttendanceStatus.PRESENT
        
        if class_start_time:
            class_start = datetime.combine(today, class_start_time)
            late_threshold = class_start + timedelta(minutes=late_threshold_minutes)
            if now > late_threshold:
                status = AttendanceStatus.LATE
        
        # Create attendance record
        attendance = Attendance(
            student_id=student_id,
            course_id=course_id,
            timetable_id=timetable_id,
            date=today,
            check_in_time=now,
            status=status,
            confidence_score=confidence
        )
        
        db.add(attendance)
        # Send student notification if a linked user exists.
        user_result = await db.execute(select(User).where(User.email == student.email))
        student_user = user_result.scalar_one_or_none()
        if student_user:
            await notification_service.create_notification(
                db=db,
                user_id=student_user.id,
                title="Attendance Marked",
                message=(
                    f"Attendance marked as {status.value.upper()} for today in course ID {course_id}."
                ),
                notification_type="attendance",
            )

        await db.commit()
        

        return AttendanceMarkResponse(
            success=True,
            message=f"Attendance marked as {status.value}",
            student_id=student_id,
            student_name=student.full_name,
            status=status,
            confidence=confidence,
            timetable_id=timetable_id,
        )
    
    async def get_course_attendance_stats(
        self,
        db: AsyncSession,
        course_id: int,
        target_date: Optional[date] = None
    ) -> AttendanceStats:
        """Get attendance statistics for a course."""
        if target_date is None:
            target_date = today_ist()
        
        # Count students (simplified - in production, use course enrollment)
        total_result = await db.execute(select(func.count(Student.id)))
        total_students = total_result.scalar() or 0
        
        # Count attendance by status
        present_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.course_id == course_id,
                    Attendance.date == target_date,
                    Attendance.status == AttendanceStatus.PRESENT
                )
            )
        )
        present_count = present_result.scalar() or 0
        
        late_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.course_id == course_id,
                    Attendance.date == target_date,
                    Attendance.status == AttendanceStatus.LATE
                )
            )
        )
        late_count = late_result.scalar() or 0
        
        absent_count = total_students - present_count - late_count
        attendance_rate = ((present_count + late_count) / total_students * 100) if total_students > 0 else 0
        
        return AttendanceStats(
            total_students=total_students,
            present_count=present_count,
            late_count=late_count,
            absent_count=max(0, absent_count),
            attendance_rate=round(attendance_rate, 2)
        )
    
    async def get_absentees(
        self,
        db: AsyncSession,
        course_id: int,
        target_date: Optional[date] = None
    ) -> List[Student]:
        """Get list of absent students for a course on a date."""
        if target_date is None:
            target_date = today_ist()
        
        # Get students who have attendance record
        attended_result = await db.execute(
            select(Attendance.student_id).where(
                and_(
                    Attendance.course_id == course_id,
                    Attendance.date == target_date
                )
            )
        )
        attended_ids = [row[0] for row in attended_result.fetchall()]
        
        # Get all students not in attended list
        if attended_ids:
            absent_result = await db.execute(
                select(Student).where(
                    and_(
                        Student.is_active == True,
                        Student.id.notin_(attended_ids)
                    )
                )
            )
        else:
            absent_result = await db.execute(
                select(Student).where(Student.is_active == True)
            )
        
        return list(absent_result.scalars().all())


attendance_service = AttendanceService()
