"""Courses router for course management."""
from datetime import datetime, time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from app.database import get_db
from app.models.course import Course
from app.models.academic_class import AcademicClass
from app.models.department import Department
from app.models.timetable import Timetable
from app.models.user import User
from app.utils.security import get_current_user, get_current_faculty_or_admin

router = APIRouter(prefix="/courses", tags=["Courses"])


class CourseCreate(BaseModel):
    code: str
    name: str
    schedule: Optional[dict] = None


class CourseResponse(BaseModel):
    id: int
    code: str
    name: str
    schedule: Optional[dict] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CourseAssignmentResponse(BaseModel):
    class_id: int
    department_code: str
    department_full_name: str
    year: int
    section: str
    faculty_id: int
    faculty_name: str
    faculty_email: str
    day_of_week: str
    start_time: time
    end_time: time


@router.get("/", response_model=List[CourseResponse])
async def get_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all courses (filtered by faculty for non-admin users)."""
    if current_user.role == "admin":
        result = await db.execute(select(Course))
        return list(result.scalars().all())

    course_ids_result = await db.execute(
        select(Timetable.subject_id)
        .where(Timetable.faculty_id == current_user.id)
        .distinct()
    )
    course_ids = [row[0] for row in course_ids_result.fetchall() if row[0] is not None]
    if not course_ids:
        return []

    result = await db.execute(select(Course).where(Course.id.in_(course_ids)))
    return list(result.scalars().all())


@router.post("/", response_model=CourseResponse)
async def create_course(
    course_data: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Create a new course."""
    # Check if code already exists
    result = await db.execute(select(Course).where(Course.code == course_data.code))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Course code already exists")
    
    course = Course(
        code=course_data.code,
        name=course_data.name,
        schedule=course_data.schedule
    )
    
    db.add(course)
    await db.commit()
    await db.refresh(course)
    
    return course


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return course


@router.delete("/{course_id}")
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Delete a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    await db.delete(course)
    await db.commit()
    
    return {"message": "Course deleted successfully"}


class CourseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    schedule: Optional[dict] = None


@router.patch("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Update a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if new code conflicts with existing
    if course_data.code and course_data.code != course.code:
        existing = await db.execute(select(Course).where(Course.code == course_data.code))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Course code already exists")
    
    # Update fields
    update_data = course_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(course, key, value)
    
    await db.commit()
    await db.refresh(course)
    
    return course


@router.get("/{course_id}/assignments", response_model=List[CourseAssignmentResponse])
async def get_course_assignments(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Get faculty/class assignments for a course via timetable."""
    course_result = await db.execute(select(Course.id).where(Course.id == course_id))
    if not course_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    query = (
        select(Timetable, AcademicClass, Department, User)
        .join(AcademicClass, Timetable.class_id == AcademicClass.id)
        .join(Department, AcademicClass.department_id == Department.id)
        .join(User, Timetable.faculty_id == User.id)
        .where(Timetable.subject_id == course_id)
    )
    if current_user.role != "admin":
        query = query.where(Timetable.faculty_id == current_user.id)

    result = await db.execute(
        query.order_by(
            Department.code.asc(),
            AcademicClass.year.asc(),
            AcademicClass.section.asc(),
            Timetable.day_of_week.asc(),
            Timetable.start_time.asc(),
        )
    )

    assignments = []
    for timetable, academic_class, department, faculty in result.fetchall():
        assignments.append(
            CourseAssignmentResponse(
                class_id=academic_class.id,
                department_code=department.code,
                department_full_name=department.full_name,
                year=academic_class.year,
                section=academic_class.section,
                faculty_id=faculty.id,
                faculty_name=faculty.full_name,
                faculty_email=faculty.email,
                day_of_week=timetable.day_of_week,
                start_time=timetable.start_time,
                end_time=timetable.end_time,
            )
        )

    return assignments
