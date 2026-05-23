"""Analytics router for dashboard charts."""
from datetime import date, timedelta
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel

from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.student import Student
from app.models.course import Course
from app.models.user import User, UserRole
from app.models.timetable import Timetable
from app.utils.security import get_current_admin, get_current_faculty_or_admin

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class DailyTrend(BaseModel):
    date: str
    present: int
    late: int
    absent: int


class DepartmentStats(BaseModel):
    department: str
    total: int
    average_attendance: float


class CourseStats(BaseModel):
    course_id: int
    course_name: str
    course_code: str
    total_classes: int
    average_attendance: float


class FacultyWorkload(BaseModel):
    faculty_id: int
    faculty_name: str
    faculty_email: str
    class_count: int


@router.get("/trends/{course_id}", response_model=List[DailyTrend])
async def get_attendance_trends(
    course_id: int,
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Get daily attendance trends for the last N days."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    
    # Get total students count
    total_result = await db.execute(
        select(func.count(Student.id)).where(Student.is_active == True)
    )
    total_students = total_result.scalar() or 0
    
    trends = []
    current_date = start_date
    
    while current_date <= end_date:
        # Count by status for this date
        present_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.course_id == course_id,
                    Attendance.date == current_date,
                    Attendance.status == AttendanceStatus.PRESENT
                )
            )
        )
        present = present_result.scalar() or 0
        
        late_result = await db.execute(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.course_id == course_id,
                    Attendance.date == current_date,
                    Attendance.status == AttendanceStatus.LATE
                )
            )
        )
        late = late_result.scalar() or 0
        
        absent = max(0, total_students - present - late)
        
        trends.append(DailyTrend(
            date=current_date.strftime("%Y-%m-%d"),
            present=present,
            late=late,
            absent=absent
        ))
        
        current_date += timedelta(days=1)
    
    return trends


@router.get("/department-stats", response_model=List[DepartmentStats])
async def get_department_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Get attendance statistics by department."""
    # Get departments with student counts
    dept_result = await db.execute(
        select(
            Student.department,
            func.count(Student.id).label('total')
        )
        .where(Student.is_active == True)
        .group_by(Student.department)
    )
    
    departments = dept_result.fetchall()
    stats = []
    
    for dept, total in departments:
        if not dept:
            continue
            
        # Calculate average attendance for department
        attendance_result = await db.execute(
            select(func.count(Attendance.id))
            .join(Student, Attendance.student_id == Student.id)
            .where(Student.department == dept)
        )
        attended = attendance_result.scalar() or 0
        
        # Simplified average (in production, calculate based on total classes)
        avg = (attended / total * 100 / 30) if total > 0 else 0  # Assuming ~30 days
        
        stats.append(DepartmentStats(
            department=dept,
            total=total,
            average_attendance=round(min(100, avg), 2)
        ))
    
    return stats


@router.get("/overview")
async def get_overview_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Get system-wide overview statistics."""
    today = date.today()
    
    # Total students
    students_result = await db.execute(
        select(func.count(Student.id)).where(Student.is_active == True)
    )
    total_students = students_result.scalar() or 0
    
    # Total courses
    courses_result = await db.execute(select(func.count(Course.id)))
    total_courses = courses_result.scalar() or 0
    
    # Today's attendance
    today_present = await db.execute(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.date == today,
                Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE])
            )
        )
    )
    today_attendance = today_present.scalar() or 0
    
    # Enrolled faces
    enrolled_result = await db.execute(
        select(func.count(Student.id)).where(
            and_(
                Student.is_active == True,
                Student.face_encoding_path.isnot(None)
            )
        )
    )
    enrolled_faces = enrolled_result.scalar() or 0
    
    return {
        "total_students": total_students,
        "total_courses": total_courses,
        "today_attendance": today_attendance,
        "enrolled_faces": enrolled_faces,
        "enrollment_rate": round((enrolled_faces / total_students * 100) if total_students > 0 else 0, 2)
    }


@router.get("/faculty-workload", response_model=List[FacultyWorkload])
async def get_faculty_workload(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Get faculty workload based on timetable assignments."""
    result = await db.execute(
        select(
            User.id,
            User.full_name,
            User.email,
            func.count(Timetable.id).label("class_count"),
        )
        .where(
            and_(
                User.role == UserRole.FACULTY,
                User.is_active == True,
            )
        )
        .outerjoin(Timetable, Timetable.faculty_id == User.id)
        .group_by(User.id)
        .order_by(func.count(Timetable.id).desc(), User.full_name.asc())
    )

    rows = result.fetchall()
    return [
        FacultyWorkload(
            faculty_id=row[0],
            faculty_name=row[1],
            faculty_email=row[2],
            class_count=row[3] or 0,
        )
        for row in rows
    ]
