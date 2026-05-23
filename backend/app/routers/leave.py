"""Leave request router."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.leave import LeaveRequest
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.leave import LeaveApplyRequest, LeaveDecisionRequest, LeaveRequestResponse
from app.services.leave_service import leave_service
from app.utils.security import get_current_faculty_or_admin, get_current_user


router = APIRouter(prefix="/leave", tags=["Leave"])


def _serialize_leave(leave_request: LeaveRequest, student: Student) -> LeaveRequestResponse:
    return LeaveRequestResponse(
        id=leave_request.id,
        student_id=student.id,
        student_name=student.full_name,
        register_number=student.register_no or student.student_id,
        reason=leave_request.reason,
        from_date=leave_request.from_date,
        to_date=leave_request.to_date,
        status=leave_request.status,
        approved_by=leave_request.approved_by,
        created_at=leave_request.created_at,
        updated_at=leave_request.updated_at,
    )


@router.post("/apply", response_model=LeaveRequestResponse)
async def apply_leave(
    payload: LeaveApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student applies for leave."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can apply for leave",
        )

    if payload.from_date > payload.to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_date cannot be after to_date",
        )

    student = await leave_service.get_student_for_user(db, current_user)
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    leave_request = await leave_service.apply_leave(
        db=db,
        student=student,
        reason=payload.reason,
        from_date=payload.from_date,
        to_date=payload.to_date,
    )
    return _serialize_leave(leave_request, student)


@router.get("/my-requests", response_model=list[LeaveRequestResponse])
async def my_leave_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student gets own leave requests."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint",
        )

    student = await leave_service.get_student_for_user(db, current_user)
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    requests = await leave_service.get_student_requests(db, student.id)
    return [_serialize_leave(request_item, student) for request_item in requests]


@router.get("/pending", response_model=list[LeaveRequestResponse])
async def pending_leave_requests(
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Faculty/Admin view pending leave requests."""
    requests = await leave_service.get_pending_requests(db)
    if limit:
        requests = requests[:limit]

    student_ids = [request_item.student_id for request_item in requests]
    if not student_ids:
        return []

    students_result = await db.execute(
        select(Student).where(Student.id.in_(student_ids))
    )
    student_map = {student.id: student for student in students_result.scalars().all()}

    response: list[LeaveRequestResponse] = []
    for request_item in requests:
        student = student_map.get(request_item.student_id)
        if not student:
            continue
        response.append(_serialize_leave(request_item, student))
    return response


@router.put("/{leave_id}/approve", response_model=LeaveRequestResponse)
async def approve_leave(
    leave_id: int,
    payload: LeaveDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Approve a leave request (atomic update + notification)."""
    leave_request = await leave_service.review_request(
        db=db,
        request_id=leave_id,
        reviewer=current_user,
        status="approved",
        comment=payload.comment,
    )
    if not leave_request:
        raise HTTPException(status_code=404, detail="Leave request not found")

    student_result = await db.execute(
        select(Student).where(Student.id == leave_request.student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return _serialize_leave(leave_request, student)


@router.put("/{leave_id}/reject", response_model=LeaveRequestResponse)
async def reject_leave(
    leave_id: int,
    payload: LeaveDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    """Reject a leave request (atomic update + notification)."""
    leave_request = await leave_service.review_request(
        db=db,
        request_id=leave_id,
        reviewer=current_user,
        status="rejected",
        comment=payload.comment,
    )
    if not leave_request:
        raise HTTPException(status_code=404, detail="Leave request not found")

    student_result = await db.execute(
        select(Student).where(Student.id == leave_request.student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return _serialize_leave(leave_request, student)
