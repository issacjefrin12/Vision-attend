"""Leave request service."""
from datetime import date
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leave import LeaveRequest
from app.models.student import Student
from app.models.user import User
from app.services.notification_service import notification_service


class LeaveService:
    """Leave lifecycle operations."""

    async def get_student_for_user(self, db: AsyncSession, user: User) -> Student | None:
        result = await db.execute(
            select(Student).where(
                and_(Student.email == user.email, Student.is_active == True)
            )
        )
        return result.scalar_one_or_none()

    async def apply_leave(
        self,
        db: AsyncSession,
        student: Student,
        reason: str,
        from_date: date,
        to_date: date,
    ) -> LeaveRequest:
        leave_request = LeaveRequest(
            student_id=student.id,
            reason=reason,
            from_date=from_date,
            to_date=to_date,
            status="pending",
        )
        db.add(leave_request)
        await db.commit()
        await db.refresh(leave_request)
        return leave_request

    async def get_student_requests(
        self, db: AsyncSession, student_id: int
    ) -> list[LeaveRequest]:
        result = await db.execute(
            select(LeaveRequest)
            .where(LeaveRequest.student_id == student_id)
            .order_by(LeaveRequest.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_pending_requests(self, db: AsyncSession) -> list[LeaveRequest]:
        result = await db.execute(
            select(LeaveRequest)
            .where(LeaveRequest.status == "pending")
            .order_by(LeaveRequest.created_at.asc())
        )
        return list(result.scalars().all())

    async def review_request(
        self,
        db: AsyncSession,
        request_id: int,
        reviewer: User,
        status: str,
        comment: str | None = None,
    ) -> LeaveRequest | None:
        """
        Atomic approval/rejection:
        - update leave request status
        - create student notification
        - commit once
        """
        result = await db.execute(
            select(LeaveRequest).where(LeaveRequest.id == request_id)
        )
        leave_request = result.scalar_one_or_none()
        if not leave_request:
            return None

        leave_request.status = status
        leave_request.approved_by = reviewer.id

        student_result = await db.execute(
            select(Student).where(Student.id == leave_request.student_id)
        )
        student = student_result.scalar_one_or_none()
        if student:
            user_result = await db.execute(
                select(User).where(User.email == student.email)
            )
            student_user = user_result.scalar_one_or_none()
            if student_user:
                if status == "approved":
                    title = "Leave Request Approved"
                else:
                    title = "Leave Request Rejected"

                message = (
                    f"Your leave request from {leave_request.from_date} to "
                    f"{leave_request.to_date} was {status}."
                )
                if comment:
                    message = f"{message} Note: {comment}"

                await notification_service.create_notification(
                    db=db,
                    user_id=student_user.id,
                    title=title,
                    message=message,
                    notification_type="leave",
                )

        await db.commit()
        await db.refresh(leave_request)
        return leave_request


leave_service = LeaveService()

