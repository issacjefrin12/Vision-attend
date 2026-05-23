"""Admin-only bulk upload and template endpoints."""
from __future__ import annotations

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, EmailStr, Field, TypeAdapter, ValidationError
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import MAX_DISTANCE_KM
from app.database import get_db
from app.models.academic_class import AcademicClass
from app.models.course import Course
from app.models.department import Department
from app.models.student import Student
from app.models.system_setting import SystemSetting
from app.models.timetable import Timetable
from app.models.user import User, UserRole
from app.schemas.academic import ClassLocationResponse, ClassLocationUpdateRequest
from app.utils.security import get_current_admin, get_password_hash

router = APIRouter(prefix="/admin", tags=["Admin"])

_email_adapter = TypeAdapter(EmailStr)
_valid_days = {
    "monday": "Monday",
    "tuesday": "Tuesday",
    "wednesday": "Wednesday",
    "thursday": "Thursday",
    "friday": "Friday",
    "saturday": "Saturday",
    "sunday": "Sunday",
}
_GEOFENCE_RADIUS_KEY = "geofence_max_distance_km"


class GeofenceRadiusResponse(BaseModel):
    max_distance_km: float


class GeofenceRadiusUpdateRequest(BaseModel):
    max_distance_km: float = Field(..., gt=0, le=1)


def _read_csv(file_bytes: bytes, expected_headers: list[str]) -> list[dict[str, str]]:
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"File must be UTF-8 CSV: {exc}") from exc

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV header row is missing")

    normalized_headers = [(name or "").strip().lower() for name in reader.fieldnames]
    if normalized_headers != expected_headers:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid CSV format. Expected columns in order: "
                + ", ".join(expected_headers)
            ),
        )

    rows: list[dict[str, str]] = []
    for raw in reader:
        rows.append(
            {
                (key or "").strip().lower(): (value or "").strip()
                for key, value in raw.items()
            }
        )
    return rows


def _parse_year(raw_year: str) -> int:
    value = raw_year.strip().upper()
    if not value:
        raise ValueError("invalid year format")

    roman_map = {
        "I": 1,
        "II": 2,
        "III": 3,
        "IV": 4,
        "V": 5,
        "VI": 6,
    }
    if value in roman_map:
        year = roman_map[value]
    else:
        words_map = {
            "FIRST": 1,
            "SECOND": 2,
            "THIRD": 3,
            "FOURTH": 4,
            "FIFTH": 5,
            "SIXTH": 6,
        }
        compact = value.replace("YEAR", "").replace(" ", "")
        if compact in words_map:
            year = words_map[compact]
        else:
            numeric = (
                compact.replace("ST", "")
                .replace("ND", "")
                .replace("RD", "")
                .replace("TH", "")
            )
            try:
                year = int(numeric)
            except ValueError as exc:
                raise ValueError("invalid year format") from exc

    if year < 1 or year > 6:
        raise ValueError("year must be between 1 and 6")
    return year


def _parse_email(raw_email: str) -> str:
    try:
        return str(_email_adapter.validate_python(raw_email)).lower()
    except ValidationError as exc:
        raise ValueError(f"invalid email: {exc.errors()[0]['msg']}") from exc


def _parse_day(raw_day: str) -> str:
    day = _valid_days.get(raw_day.strip().lower())
    if not day:
        raise ValueError("day must be Monday-Sunday")
    return day


def _parse_time_hhmm(raw_time: str):
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw_time, fmt).time()
        except ValueError:
            continue
    raise ValueError("time must be HH:MM (24h)")


@router.get(
    "/templates/students.csv",
    response_class=PlainTextResponse,
    response_model=None,
)
async def students_template(current_user: User = Depends(get_current_admin)):
    _ = current_user
    return "register_no,name,email,department_code,year,section\n"


@router.get(
    "/templates/timetable.csv",
    response_class=PlainTextResponse,
    response_model=None,
)
async def timetable_template(current_user: User = Depends(get_current_admin)):
    _ = current_user
    return "department_code,year,section,subject_code,faculty_email,day,start_time,end_time\n"


@router.get(
    "/templates/faculty.csv",
    response_class=PlainTextResponse,
    response_model=None,
)
async def faculty_template(current_user: User = Depends(get_current_admin)):
    _ = current_user
    return "full_name,email\n"


@router.get(
    "/templates/courses.csv",
    response_class=PlainTextResponse,
    response_model=None,
)
async def courses_template(current_user: User = Depends(get_current_admin)):
    _ = current_user
    return "code,name\n"


@router.get(
    "/templates/departments.csv",
    response_class=PlainTextResponse,
    response_model=None,
)
async def departments_template(current_user: User = Depends(get_current_admin)):
    _ = current_user
    return "code,full_name\n"


@router.get(
    "/templates/classes.csv",
    response_class=PlainTextResponse,
    response_model=None,
)
async def classes_template(current_user: User = Depends(get_current_admin)):
    _ = current_user
    return "department_code,year,section\n"


@router.put("/class/{class_id}/location", response_model=ClassLocationResponse)
async def update_class_location(
    class_id: int,
    payload: ClassLocationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    class_result = await db.execute(
        select(AcademicClass).where(AcademicClass.id == class_id)
    )
    class_obj = class_result.scalar_one_or_none()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    class_obj.latitude = payload.latitude
    class_obj.longitude = payload.longitude
    await db.commit()
    await db.refresh(class_obj)

    return ClassLocationResponse(
        class_id=class_obj.id,
        latitude=class_obj.latitude,
        longitude=class_obj.longitude,
    )


@router.get("/class/{class_id}/location", response_model=ClassLocationResponse)
async def get_class_location(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    class_result = await db.execute(
        select(AcademicClass).where(AcademicClass.id == class_id)
    )
    class_obj = class_result.scalar_one_or_none()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    return ClassLocationResponse(
        class_id=class_obj.id,
        latitude=class_obj.latitude,
        longitude=class_obj.longitude,
    )


@router.delete("/class/{class_id}/location", response_model=ClassLocationResponse)
async def clear_class_location(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    class_result = await db.execute(
        select(AcademicClass).where(AcademicClass.id == class_id)
    )
    class_obj = class_result.scalar_one_or_none()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    class_obj.latitude = None
    class_obj.longitude = None
    await db.commit()
    await db.refresh(class_obj)

    return ClassLocationResponse(
        class_id=class_obj.id,
        latitude=class_obj.latitude,
        longitude=class_obj.longitude,
    )


@router.get("/settings/geofence-radius", response_model=GeofenceRadiusResponse)
async def get_geofence_radius(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    setting_result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == _GEOFENCE_RADIUS_KEY)
    )
    setting = setting_result.scalar_one_or_none()

    if not setting:
        return GeofenceRadiusResponse(max_distance_km=MAX_DISTANCE_KM)

    try:
        value = float(setting.value)
    except ValueError:
        value = MAX_DISTANCE_KM

    return GeofenceRadiusResponse(max_distance_km=value)


@router.put("/settings/geofence-radius", response_model=GeofenceRadiusResponse)
async def update_geofence_radius(
    payload: GeofenceRadiusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    setting_result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == _GEOFENCE_RADIUS_KEY)
    )
    setting = setting_result.scalar_one_or_none()
    value = str(payload.max_distance_km)

    if setting:
        setting.value = value
        setting.updated_by = current_user.id
    else:
        db.add(
            SystemSetting(
                key=_GEOFENCE_RADIUS_KEY,
                value=value,
                updated_by=current_user.id,
            )
        )

    await db.commit()
    return GeofenceRadiusResponse(max_distance_km=payload.max_distance_km)


@router.post("/upload-departments")
async def upload_departments_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    rows = _read_csv(
        content,
        expected_headers=["code", "full_name"],
    )
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    created = 0
    errors: list[str] = []

    for index, row in enumerate(rows, start=2):
        try:
            code = row["code"].strip().upper()
            full_name = row["full_name"].strip()

            if not code or not full_name:
                raise ValueError("code and full_name are required")

            existing = await db.execute(
                select(Department).where(func.upper(Department.code) == code)
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Department {code} already exists")

            department = Department(code=code, full_name=full_name)
            db.add(department)
            await db.commit()
            created += 1
        except (ValueError, SQLAlchemyError) as exc:
            await db.rollback()
            errors.append(f"Row {index}: {exc}")
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            errors.append(f"Row {index}: unexpected error: {exc}")

    return {
        "total_rows": len(rows),
        "created": created,
        "failed": len(errors),
        "errors": errors,
    }


@router.post("/upload-classes")
async def upload_classes_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    rows = _read_csv(
        content,
        expected_headers=["department_code", "year", "section"],
    )
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    created = 0
    errors: list[str] = []

    for index, row in enumerate(rows, start=2):
        try:
            department_code = row["department_code"].strip().upper()
            section = row["section"].strip().upper()
            year = _parse_year(row["year"].strip())

            if not department_code or not section:
                raise ValueError("department_code and section are required")

            department_result = await db.execute(
                select(Department).where(func.upper(Department.code) == department_code)
            )
            department = department_result.scalar_one_or_none()
            if not department:
                raise ValueError(f"department '{department_code}' not found")

            existing = await db.execute(
                select(AcademicClass).where(
                    and_(
                        AcademicClass.department_id == department.id,
                        AcademicClass.year == year,
                        AcademicClass.section == section,
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError("class already exists")

            academic_class = AcademicClass(
                department_id=department.id,
                year=year,
                section=section,
            )
            db.add(academic_class)
            await db.commit()
            created += 1
        except (ValueError, SQLAlchemyError) as exc:
            await db.rollback()
            errors.append(f"Row {index}: {exc}")
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            errors.append(f"Row {index}: unexpected error: {exc}")

    return {
        "total_rows": len(rows),
        "created": created,
        "failed": len(errors),
        "errors": errors,
    }


@router.post("/upload-students")
async def upload_students_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    department_key = "department_code"
    try:
        rows = _read_csv(
            content,
            expected_headers=["register_no", "name", "email", "department_code", "year", "section"],
        )
    except HTTPException as exc:
        if "Invalid CSV format" not in str(exc.detail):
            raise
        rows = _read_csv(
            content,
            expected_headers=["register_no", "name", "email", "department", "year", "section"],
        )
        department_key = "department"
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    created = 0
    errors: list[str] = []

    for index, row in enumerate(rows, start=2):
        try:
            register_no = row["register_no"].strip()
            full_name = row["name"].strip()
            email = _parse_email(row["email"].strip())
            department_code = row[department_key].strip().upper()
            try:
                year = _parse_year(row["year"].strip())
            except ValueError as exc:
                raise ValueError("Invalid year format") from exc
            section = row["section"].strip().upper()

            if not register_no or not full_name or not department_code or not section:
                raise ValueError("register_no, name, department_code, and section are required")

            dept_result = await db.execute(
                select(Department).where(func.upper(Department.code) == department_code)
            )
            department = dept_result.scalar_one_or_none()
            if not department:
                raise ValueError(f"department '{department_code}' not found")

            class_result = await db.execute(
                select(AcademicClass).where(
                    and_(
                        AcademicClass.department_id == department.id,
                        AcademicClass.year == year,
                        AcademicClass.section == section,
                    )
                )
            )
            academic_class = class_result.scalar_one_or_none()
            if not academic_class:
                raise ValueError(
                    f"class not found for department_code={department_code}, year={year}, section={section}"
                )

            duplicate_student = await db.execute(
                select(Student).where(
                    or_(
                        Student.register_no == register_no,
                        func.lower(Student.email) == email,
                    )
                )
            )
            if duplicate_student.scalar_one_or_none():
                raise ValueError("duplicate register_no or student email")

            duplicate_user = await db.execute(
                select(User).where(func.lower(User.email) == email)
            )
            if duplicate_user.scalar_one_or_none():
                raise ValueError("email already exists in users")

            user = User(
                email=email,
                password_hash=get_password_hash(register_no),
                full_name=full_name,
                role=UserRole.STUDENT,
                is_active=True,
            )
            db.add(user)
            await db.flush()

            student = Student(
                user_id=user.id,
                class_id=academic_class.id,
                register_no=register_no,
                student_id=register_no,
                full_name=full_name,
                email=email,
                department=department.code,
                semester=year * 2,
                is_active=True,
            )
            db.add(student)
            await db.commit()
            created += 1
        except (ValueError, SQLAlchemyError) as exc:
            await db.rollback()
            errors.append(f"Row {index}: {exc}")
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            errors.append(f"Row {index}: unexpected error: {exc}")

    return {
        "total_rows": len(rows),
        "created": created,
        "failed": len(errors),
        "errors": errors,
    }


@router.post("/upload-timetable")
async def upload_timetable_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    department_key = "department_code"
    try:
        rows = _read_csv(
            content,
            expected_headers=[
                "department_code",
                "year",
                "section",
                "subject_code",
                "faculty_email",
                "day",
                "start_time",
                "end_time",
            ],
        )
    except HTTPException as exc:
        if "Invalid CSV format" not in str(exc.detail):
            raise
        rows = _read_csv(
            content,
            expected_headers=[
                "department",
                "year",
                "section",
                "subject_code",
                "faculty_email",
                "day",
                "start_time",
                "end_time",
            ],
        )
        department_key = "department"
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    # Replace previous semester timetable as requested (single source of truth).
    await db.execute(delete(Timetable))
    await db.commit()

    inserted = 0
    errors: list[str] = []

    for index, row in enumerate(rows, start=2):
        try:
            department_code = row[department_key].strip().upper()
            try:
                year = _parse_year(row["year"].strip())
            except ValueError as exc:
                raise ValueError("Invalid year format") from exc
            section = row["section"].strip().upper()
            subject_code = row["subject_code"].strip().upper()
            faculty_email = _parse_email(row["faculty_email"].strip())
            day_of_week = _parse_day(row["day"].strip())
            start_time = _parse_time_hhmm(row["start_time"].strip())
            end_time = _parse_time_hhmm(row["end_time"].strip())

            if start_time >= end_time:
                raise ValueError("start_time must be before end_time")

            dept_result = await db.execute(
                select(Department).where(func.upper(Department.code) == department_code)
            )
            department = dept_result.scalar_one_or_none()
            if not department:
                raise ValueError(f"department '{department_code}' not found")

            class_result = await db.execute(
                select(AcademicClass).where(
                    and_(
                        AcademicClass.department_id == department.id,
                        AcademicClass.year == year,
                        AcademicClass.section == section,
                    )
                )
            )
            academic_class = class_result.scalar_one_or_none()
            if not academic_class:
                raise ValueError(
                    f"class not found for department_code={department_code}, year={year}, section={section}"
                )

            subject_result = await db.execute(
                select(Course).where(func.upper(Course.code) == subject_code)
            )
            subject = subject_result.scalar_one_or_none()
            if not subject:
                raise ValueError(f"subject_code '{subject_code}' not found")

            faculty_result = await db.execute(
                select(User).where(
                    and_(
                        func.lower(User.email) == faculty_email,
                        User.role == UserRole.FACULTY,
                        User.is_active == True,
                    )
                )
            )
            faculty = faculty_result.scalar_one_or_none()
            if not faculty:
                raise ValueError(f"faculty '{faculty_email}' not found or inactive")

            class_overlap = await db.execute(
                select(Timetable.id).where(
                    and_(
                        Timetable.class_id == academic_class.id,
                        Timetable.day_of_week == day_of_week,
                        Timetable.start_time < end_time,
                        Timetable.end_time > start_time,
                    )
                )
            )
            if class_overlap.scalar_one_or_none():
                raise ValueError("class time overlap detected")

            faculty_overlap = await db.execute(
                select(Timetable.id).where(
                    and_(
                        Timetable.faculty_id == faculty.id,
                        Timetable.day_of_week == day_of_week,
                        Timetable.start_time < end_time,
                        Timetable.end_time > start_time,
                    )
                )
            )
            if faculty_overlap.scalar_one_or_none():
                raise ValueError("faculty time overlap detected")

            row_obj = Timetable(
                class_id=academic_class.id,
                subject_id=subject.id,
                faculty_id=faculty.id,
                day_of_week=day_of_week,
                start_time=start_time,
                end_time=end_time,
            )
            db.add(row_obj)
            await db.commit()
            inserted += 1
        except (ValueError, SQLAlchemyError) as exc:
            await db.rollback()
            errors.append(f"Row {index}: {exc}")
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            errors.append(f"Row {index}: unexpected error: {exc}")

    return {
        "total_rows": len(rows),
        "inserted": inserted,
        "failed": len(errors),
        "errors": errors,
    }


@router.post("/upload-faculty")
async def upload_faculty_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    rows = _read_csv(
        content,
        expected_headers=["full_name", "email"],
    )
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    created = 0
    errors: list[str] = []

    for index, row in enumerate(rows, start=2):
        try:
            full_name = row["full_name"].strip()
            email = _parse_email(row["email"].strip())
            if not full_name:
                raise ValueError("full_name is required")

            existing_user = await db.execute(
                select(User).where(func.lower(User.email) == email)
            )
            if existing_user.scalar_one_or_none():
                raise ValueError("email already exists")

            user = User(
                email=email,
                password_hash=get_password_hash("Faculty@123"),
                full_name=full_name,
                role=UserRole.FACULTY,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            created += 1
        except (ValueError, SQLAlchemyError) as exc:
            await db.rollback()
            errors.append(f"Row {index}: {exc}")
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            errors.append(f"Row {index}: unexpected error: {exc}")

    return {
        "total_rows": len(rows),
        "created": created,
        "failed": len(errors),
        "errors": errors,
    }


@router.post("/upload-courses")
async def upload_courses_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    _ = current_user
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    rows = _read_csv(
        content,
        expected_headers=["code", "name"],
    )
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    created = 0
    errors: list[str] = []

    for index, row in enumerate(rows, start=2):
        try:
            code = row["code"].strip().upper()
            name = row["name"].strip()
            if not code or not name:
                raise ValueError("code and name are required")

            existing = await db.execute(
                select(Course).where(func.upper(Course.code) == code)
            )
            if existing.scalar_one_or_none():
                raise ValueError("course code already exists")

            course = Course(
                code=code,
                name=name,
                schedule=None,
            )
            db.add(course)
            await db.commit()
            created += 1
        except (ValueError, SQLAlchemyError) as exc:
            await db.rollback()
            errors.append(f"Row {index}: {exc}")
        except Exception as exc:  # pragma: no cover - defensive
            await db.rollback()
            errors.append(f"Row {index}: unexpected error: {exc}")

    return {
        "total_rows": len(rows),
        "created": created,
        "failed": len(errors),
        "errors": errors,
    }
