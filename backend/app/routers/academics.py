"""Academic structure router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.academic_class import AcademicClass
from app.models.attendance_session import AttendanceSession
from app.models.department import Department
from app.models.student import Student
from app.models.timetable import Timetable
from app.models.user import User, UserRole
from app.schemas.academic import (
    ClassCreate,
    ClassResponse,
    DepartmentCreate,
    DepartmentResponse,
)
from app.utils.security import get_current_admin, get_current_faculty_or_admin


router = APIRouter(prefix="/academics", tags=["Academics"])


@router.get("/departments", response_model=list[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    _ = current_user
    result = await db.execute(select(Department).order_by(Department.code.asc()))
    return list(result.scalars().all())


@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    normalized_code = payload.code.strip().upper()
    normalized_full_name = payload.full_name.strip()
    if len(normalized_code) < 2:
        raise HTTPException(status_code=400, detail="Department code is required")
    if len(normalized_full_name) < 2:
        raise HTTPException(status_code=400, detail="Department full name is required")
    existing = await db.execute(select(Department).where(Department.code == normalized_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Department {normalized_code} already exists")

    department = Department(code=normalized_code, full_name=normalized_full_name)
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@router.get("/classes", response_model=list[ClassResponse])
async def list_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    query = (
        select(AcademicClass, Department)
        .join(Department, AcademicClass.department_id == Department.id)
        .order_by(Department.code.asc(), AcademicClass.year.asc(), AcademicClass.section.asc())
    )

    if current_user.role == UserRole.FACULTY:
        mapped_result = await db.execute(
            select(Timetable.class_id).where(Timetable.faculty_id == current_user.id).distinct()
        )
        class_ids = [row[0] for row in mapped_result.fetchall()]
        if not class_ids:
            return []
        query = query.where(AcademicClass.id.in_(class_ids))

    result = await db.execute(query)
    return [
        ClassResponse(
            id=class_row.id,
            department_id=class_row.department_id,
            department_code=department.code,
            department_full_name=department.full_name,
            department_name=department.code,
            year=class_row.year,
            section=class_row.section,
            latitude=class_row.latitude,
            longitude=class_row.longitude,
            created_at=class_row.created_at,
        )
        for class_row, department in result.fetchall()
    ]


@router.post("/classes", response_model=ClassResponse)
async def create_class(
    payload: ClassCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    normalized_section = payload.section.strip().upper()
    normalized_department_code = payload.department_code.strip().upper()
    if not normalized_department_code:
        raise HTTPException(status_code=400, detail="department_code is required")
    if not normalized_section:
        raise HTTPException(status_code=400, detail="section is required")
    department_result = await db.execute(
        select(Department).where(Department.code == normalized_department_code)
    )
    department = department_result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    existing = await db.execute(
        select(AcademicClass).where(
            and_(
                AcademicClass.department_id == department.id,
                AcademicClass.year == payload.year,
                AcademicClass.section == normalized_section,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Class already exists")

    academic_class = AcademicClass(
        department_id=department.id, year=payload.year, section=normalized_section
    )
    db.add(academic_class)
    await db.commit()
    await db.refresh(academic_class)

    return ClassResponse(
        id=academic_class.id,
        department_id=academic_class.department_id,
        department_code=department.code,
        department_full_name=department.full_name,
        department_name=department.code,
        year=academic_class.year,
        section=academic_class.section,
        latitude=academic_class.latitude,
        longitude=academic_class.longitude,
        created_at=academic_class.created_at,
    )


@router.delete("/classes/{class_id}")
async def delete_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    class_result = await db.execute(
        select(AcademicClass, Department)
        .join(Department, AcademicClass.department_id == Department.id)
        .where(AcademicClass.id == class_id)
    )
    class_row = class_result.first()
    if not class_row:
        raise HTTPException(status_code=404, detail="Class not found")

    academic_class, department = class_row

    student_count_result = await db.execute(
        select(func.count(Student.id)).where(Student.class_id == class_id)
    )
    student_count = student_count_result.scalar() or 0

    session_count_result = await db.execute(
        select(func.count(AttendanceSession.id)).where(AttendanceSession.class_id == class_id)
    )
    session_count = session_count_result.scalar() or 0

    timetable_count_result = await db.execute(
        select(func.count(Timetable.id)).where(Timetable.class_id == class_id)
    )
    timetable_count = timetable_count_result.scalar() or 0

    if student_count or session_count or timetable_count:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete class because it is already in use "
                f"(students={student_count}, sessions={session_count}, timetable={timetable_count})"
            ),
        )

    await db.delete(academic_class)
    await db.commit()
    return {
        "message": "Class deleted successfully",
        "class": {
            "id": class_id,
            "department_name": department.code,
            "year": academic_class.year,
            "section": academic_class.section,
        },
    }
