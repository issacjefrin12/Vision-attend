"""Session attendance router."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.department import Department
from app.models.attendance_policy import AttendancePolicy
from app.models.attendance_session import AttendanceSession
from app.models.user import User, UserRole
from app.schemas.session import (
    SessionCloseRequest,
    SessionMarkRequest,
    SessionMarkResponse,
    SessionPolicyResponse,
    SessionPolicyUpsertRequest,
    SessionStartRequest,
    SessionStartResponse,
)
from app.services.session_service import session_service
from app.utils.timezone import now_ist_naive
from app.utils.security import get_current_admin, get_current_faculty_or_admin, get_current_user


router = APIRouter(prefix="/session", tags=["Session Attendance"])


@router.post("/start", response_model=SessionStartResponse)
async def start_session(
    payload: SessionStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Start entry/hourly attendance session."""
    try:
        session = await session_service.create_session(
            db=db,
            faculty=current_user,
            class_id=payload.class_id,
            subject_id=payload.subject_id,
            session_type=payload.session_type,
            duration_seconds=payload.duration_seconds,
            entry_mode=payload.entry_mode,
        )
        return session
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.post("/mark", response_model=SessionMarkResponse)
async def mark_session_attendance(
    payload: SessionMarkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark attendance for active session using code/id + selfie."""
    success, message, attendance, session, student = await session_service.mark_session(
        db=db,
        image_base64=payload.image_base64,
        current_user=current_user,
        session_code=payload.session_code,
        session_id=payload.session_id,
        student_lat=payload.lat,
        student_lon=payload.lon,
    )
    if not session:
        return SessionMarkResponse(success=success, message=message)

    marked_count = await session_service.get_session_mark_count(db=db, session_id=session.id)
    return SessionMarkResponse(
        success=success,
        message=message,
        attendance_id=attendance.id if attendance else None,
        student_id=student.id if student else None,
        student_name=student.full_name if student else None,
        session_id=session.id,
        session_type=session.session_type,
        marked_count=marked_count,
    )


@router.post("/close")
async def close_session(
    payload: SessionCloseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Manually close active attendance session."""
    try:
        session = await session_service.close_session(
            db=db, session_id=payload.session_id, closed_by=current_user
        )
        return {
            "id": session.id,
            "is_active": session.is_active,
            "closed_at": now_ist_naive().isoformat(),
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/active", response_model=list[SessionStartResponse])
async def list_active_sessions(
    class_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """List active sessions for monitoring/teacher UI."""
    query = select(AttendanceSession).where(
        and_(
            AttendanceSession.is_active == True,
            AttendanceSession.expiry_time > now_ist_naive(),
        )
    )
    if current_user.role == UserRole.FACULTY:
        query = query.where(AttendanceSession.faculty_id == current_user.id)
    if class_id is not None:
        query = query.where(AttendanceSession.class_id == class_id)

    result = await db.execute(query.order_by(AttendanceSession.start_time.desc()))
    return list(result.scalars().all())


@router.put("/policy/{department_id}", response_model=SessionPolicyResponse)
async def upsert_policy(
    department_id: int,
    payload: SessionPolicyUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin configures entry attendance policy per department."""
    department_result = await db.execute(
        select(Department.id).where(Department.id == department_id)
    )
    if not department_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Department not found")

    result = await db.execute(
        select(AttendancePolicy).where(AttendancePolicy.department_id == department_id)
    )
    policy = result.scalar_one_or_none()
    if policy:
        policy.max_entry_per_day = payload.max_entry_per_day
        policy.entry_start_time = payload.entry_start_time
        policy.entry_end_time = payload.entry_end_time
        policy.is_active = payload.is_active
        policy.updated_by = current_user.id
    else:
        policy = AttendancePolicy(
            department_id=department_id,
            max_entry_per_day=payload.max_entry_per_day,
            entry_start_time=payload.entry_start_time,
            entry_end_time=payload.entry_end_time,
            is_active=payload.is_active,
            updated_by=current_user.id,
        )
        db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.get("/policy", response_model=list[SessionPolicyResponse])
async def list_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """List entry attendance policies."""
    _ = current_user
    result = await db.execute(
        select(AttendancePolicy).order_by(AttendancePolicy.department_id.asc())
    )
    return list(result.scalars().all())
