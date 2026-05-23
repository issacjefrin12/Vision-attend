"""Timetable router (admin-controlled weekly schedules)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.academic_class import AcademicClass
from app.models.course import Course
from app.models.department import Department
from app.models.student import Student
from app.models.timetable import Timetable
from app.models.user import User, UserRole
from app.schemas.timetable import TimetableCreate, TimetableResponse, TimetableUpdate, TimetableViewRow
from app.utils.security import get_current_admin, get_current_user, get_current_faculty_or_admin


router = APIRouter(prefix="/timetable", tags=["Timetable"])
_valid_days = {
    "monday": "Monday",
    "tuesday": "Tuesday",
    "wednesday": "Wednesday",
    "thursday": "Thursday",
    "friday": "Friday",
    "saturday": "Saturday",
    "sunday": "Sunday",
}


def _normalize_day(day_of_week: str) -> str:
    value = _valid_days.get(day_of_week.strip().lower())
    if not value:
        raise HTTPException(status_code=400, detail="day_of_week must be Monday-Sunday")
    return value


def _build_view_row(row: Timetable, academic_class: AcademicClass, department: Department, course: Course, faculty: User) -> TimetableViewRow:
    return TimetableViewRow(
        timetable_id=row.id,
        class_id=academic_class.id,
        department_code=department.code,
        department_full_name=department.full_name,
        year=academic_class.year,
        section=academic_class.section,
        course_id=course.id,
        course_code=course.code,
        course_name=course.name,
        faculty_id=faculty.id,
        faculty_name=faculty.full_name,
        faculty_email=faculty.email,
        day_of_week=row.day_of_week,
        start_time=row.start_time,
        end_time=row.end_time,
    )


async def _ensure_no_overlap(
    db: AsyncSession,
    *,
    class_id: int,
    faculty_id: int,
    day_of_week: str,
    start_time,
    end_time,
    exclude_id: int | None = None,
) -> None:
    class_query = select(Timetable.id).where(
        and_(
            Timetable.class_id == class_id,
            Timetable.day_of_week == day_of_week,
            Timetable.start_time < end_time,
            Timetable.end_time > start_time,
        )
    )
    faculty_query = select(Timetable.id).where(
        and_(
            Timetable.faculty_id == faculty_id,
            Timetable.day_of_week == day_of_week,
            Timetable.start_time < end_time,
            Timetable.end_time > start_time,
        )
    )

    if exclude_id is not None:
        class_query = class_query.where(Timetable.id != exclude_id)
        faculty_query = faculty_query.where(Timetable.id != exclude_id)

    class_overlap = await db.execute(class_query)
    if class_overlap.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Class timetable overlap detected")

    faculty_overlap = await db.execute(faculty_query)
    if faculty_overlap.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Faculty timetable overlap detected")


@router.get("/", response_model=list[TimetableResponse])
async def list_timetable(
    class_id: int | None = Query(default=None),
    day_of_week: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """View timetable (student/faculty/admin)."""
    query = select(Timetable)
    if current_user.role == UserRole.FACULTY:
        query = query.where(Timetable.faculty_id == current_user.id)
    elif current_user.role == UserRole.STUDENT:
        student_result = await db.execute(
            select(Student).where(Student.email == current_user.email)
        )
        student = student_result.scalar_one_or_none()
        if not student or not student.class_id:
            return []
        query = query.where(Timetable.class_id == student.class_id)

    if class_id is not None:
        query = query.where(Timetable.class_id == class_id)
    if day_of_week:
        query = query.where(Timetable.day_of_week == day_of_week)

    result = await db.execute(query.order_by(Timetable.day_of_week, Timetable.start_time))
    return list(result.scalars().all())


@router.get("/faculty/me", response_model=list[TimetableViewRow])
async def get_my_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Faculty view: personal timetable with class + course details."""
    if current_user.role != UserRole.FACULTY:
        raise HTTPException(status_code=403, detail="Faculty access required")

    result = await db.execute(
        select(Timetable, AcademicClass, Department, Course, User)
        .join(AcademicClass, Timetable.class_id == AcademicClass.id)
        .join(Department, AcademicClass.department_id == Department.id)
        .join(Course, Timetable.subject_id == Course.id)
        .join(User, Timetable.faculty_id == User.id)
        .where(Timetable.faculty_id == current_user.id)
        .order_by(Timetable.day_of_week, Timetable.start_time)
    )
    return [
        _build_view_row(row, academic_class, department, course, faculty)
        for row, academic_class, department, course, faculty in result.fetchall()
    ]


@router.get("/class/{class_id}", response_model=list[TimetableViewRow])
async def get_class_schedule(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin view: weekly schedule for a class with course + faculty."""
    _ = current_user
    result = await db.execute(
        select(Timetable, AcademicClass, Department, Course, User)
        .join(AcademicClass, Timetable.class_id == AcademicClass.id)
        .join(Department, AcademicClass.department_id == Department.id)
        .join(Course, Timetable.subject_id == Course.id)
        .join(User, Timetable.faculty_id == User.id)
        .where(Timetable.class_id == class_id)
        .order_by(Timetable.day_of_week, Timetable.start_time)
    )
    return [
        _build_view_row(row, academic_class, department, course, faculty)
        for row, academic_class, department, course, faculty in result.fetchall()
    ]


@router.get("/my-class", response_model=list[TimetableViewRow])
async def get_my_class_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student view: weekly schedule for their class with course + faculty."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Student access required")

    student_result = await db.execute(select(Student).where(Student.email == current_user.email))
    student = student_result.scalar_one_or_none()
    if not student or not student.class_id:
        return []

    result = await db.execute(
        select(Timetable, AcademicClass, Department, Course, User)
        .join(AcademicClass, Timetable.class_id == AcademicClass.id)
        .join(Department, AcademicClass.department_id == Department.id)
        .join(Course, Timetable.subject_id == Course.id)
        .join(User, Timetable.faculty_id == User.id)
        .where(Timetable.class_id == student.class_id)
        .order_by(Timetable.day_of_week, Timetable.start_time)
    )
    return [
        _build_view_row(row, academic_class, department, course, faculty)
        for row, academic_class, department, course, faculty in result.fetchall()
    ]


@router.post("/", response_model=TimetableResponse)
async def create_timetable(
    payload: TimetableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Create timetable row (admin only)."""
    _ = current_user
    faculty_id = payload.faculty_id
    if faculty_id is None:
        raise HTTPException(status_code=400, detail="faculty_id is required")

    class_result = await db.execute(
        select(AcademicClass).where(AcademicClass.id == payload.class_id)
    )
    if not class_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Class not found")

    course_result = await db.execute(select(Course).where(Course.id == payload.subject_id))
    if not course_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    faculty_result = await db.execute(
        select(User).where(
            and_(
                User.id == faculty_id,
                User.role == UserRole.FACULTY,
                User.is_active == True,
            )
        )
    )
    if not faculty_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Faculty not found or inactive")

    day_of_week = _normalize_day(payload.day_of_week)
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    await _ensure_no_overlap(
        db,
        class_id=payload.class_id,
        faculty_id=faculty_id,
        day_of_week=day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )

    row = Timetable(
        faculty_id=faculty_id,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        day_of_week=day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )

    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{timetable_id}", response_model=TimetableResponse)
async def update_timetable(
    timetable_id: int,
    payload: TimetableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Update timetable row (admin only)."""
    _ = current_user
    result = await db.execute(select(Timetable).where(Timetable.id == timetable_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Timetable row not found")

    patch = payload.model_dump(exclude_unset=True)
    if "class_id" in patch and patch["class_id"] is not None:
        class_result = await db.execute(
            select(AcademicClass).where(AcademicClass.id == patch["class_id"])
        )
        if not class_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Class not found")

    if "subject_id" in patch and patch["subject_id"] is not None:
        subject_result = await db.execute(
            select(Course).where(Course.id == patch["subject_id"])
        )
        if not subject_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Subject not found")

    target_day = _normalize_day(patch["day_of_week"]) if patch.get("day_of_week") else row.day_of_week
    target_start = patch.get("start_time", row.start_time)
    target_end = patch.get("end_time", row.end_time)
    target_class = patch.get("class_id", row.class_id)

    if target_start >= target_end:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    await _ensure_no_overlap(
        db,
        class_id=target_class,
        faculty_id=row.faculty_id,
        day_of_week=target_day,
        start_time=target_start,
        end_time=target_end,
        exclude_id=row.id,
    )

    if patch.get("day_of_week"):
        patch["day_of_week"] = target_day

    for key, value in patch.items():
        setattr(row, key, value)

    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{timetable_id}")
async def delete_timetable(
    timetable_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Delete timetable row (admin only)."""
    _ = current_user
    result = await db.execute(select(Timetable).where(Timetable.id == timetable_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Timetable row not found")

    await db.delete(row)
    await db.commit()
    return {"message": "Timetable row deleted"}
