"""Students management router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, select
from pydantic import BaseModel

from app.database import get_db
from app.models.academic_class import AcademicClass
from app.models.department import Department
from app.models.student import Student
from app.models.user import User
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.utils.security import get_current_admin, get_current_faculty_or_admin
from app.services.face_service import face_service

router = APIRouter(prefix="/students", tags=["Students"])


class FaceEnrollRequest(BaseModel):
    image_base64: str


@router.get("/", response_model=List[StudentResponse])
async def list_students(
    department: str = None,
    semester: int = None,
    class_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """List all students with optional filters."""
    query = select(Student).where(Student.is_active == True)
    
    if department:
        query = query.where(Student.department == department)
    if semester:
        query = query.where(Student.semester == semester)
    if class_id:
        query = query.where(Student.class_id == class_id)
    
    result = await db.execute(query.order_by(Student.register_no.asc(), Student.student_id.asc()))
    return result.scalars().all()


@router.post("/", response_model=StudentResponse)
async def create_student(
    student_data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create new student (admin only)."""
    class_result = await db.execute(
        select(AcademicClass, Department)
        .join(Department, AcademicClass.department_id == Department.id)
        .where(AcademicClass.id == student_data.class_id)
    )
    class_row = class_result.first()
    if not class_row:
        raise HTTPException(status_code=404, detail="Class not found")
    academic_class, department = class_row

    payload = student_data.model_dump()
    payload["student_id"] = payload.get("student_id") or student_data.register_no

    # Handle duplicates and soft-deleted re-creation.
    duplicate_result = await db.execute(
        select(Student).where(
            or_(
                Student.register_no == payload["register_no"],
                Student.email == payload["email"],
                Student.student_id == payload["student_id"],
            )
        )
    )
    duplicates = list(duplicate_result.scalars().all())

    active_duplicate = next((row for row in duplicates if row.is_active), None)
    if active_duplicate:
        if active_duplicate.register_no == payload["register_no"]:
            raise HTTPException(status_code=400, detail="Register number already exists")
        if active_duplicate.email == payload["email"]:
            raise HTTPException(status_code=400, detail="Email already exists")
        raise HTTPException(status_code=400, detail="Student ID already exists")

    # Keep department/semester synced from class mapping.
    payload["department"] = department.code
    payload["semester"] = academic_class.year * 2

    inactive_duplicate = next((row for row in duplicates if not row.is_active), None)
    if inactive_duplicate:
        for key, value in payload.items():
            setattr(inactive_duplicate, key, value)
        inactive_duplicate.is_active = True
        await db.commit()
        await db.refresh(inactive_duplicate)
        return inactive_duplicate

    student = Student(**payload)
    db.add(student)
    await db.commit()
    await db.refresh(student)
    
    return student


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Get student by ID."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    return student


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: int,
    student_data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update student information (admin only)."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    patch = student_data.model_dump(exclude_unset=True)

    if "register_no" in patch and patch["register_no"]:
        existing_reg = await db.execute(
            select(Student).where(
                and_(
                    Student.register_no == patch["register_no"],
                    Student.id != student.id,
                )
            )
        )
        if existing_reg.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Register number already exists")

    if "class_id" in patch and patch["class_id"] is not None:
        class_result = await db.execute(
            select(AcademicClass, Department)
            .join(Department, AcademicClass.department_id == Department.id)
            .where(AcademicClass.id == patch["class_id"])
        )
        class_row = class_result.first()
        if not class_row:
            raise HTTPException(status_code=404, detail="Class not found")
        academic_class, department = class_row
        patch["department"] = department.code
        patch["semester"] = academic_class.year * 2

    for key, value in patch.items():
        setattr(student, key, value)
    
    await db.commit()
    await db.refresh(student)
    
    return student


@router.post("/{student_id}/enroll-face")
async def enroll_student_face(
    student_id: int,
    request: FaceEnrollRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin)
):
    """Enroll student face for recognition."""
    success, message = await face_service.enroll_student_face(
        db, student_id, request.image_base64
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message}


@router.delete("/{student_id}")
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Deactivate student (admin only)."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    student.is_active = False
    await db.commit()
    
    return {"message": "Student deactivated"}
