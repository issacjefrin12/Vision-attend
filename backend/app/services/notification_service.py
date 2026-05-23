"""Notification service."""
from typing import Iterable, Sequence
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.student import Student
from app.models.user import User


class NotificationService:
    """Central notification creation and read operations."""

    async def create_notification(
        self,
        db: AsyncSession,
        user_id: int,
        title: str,
        message: str,
        notification_type: str,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            is_read=False,
        )
        db.add(notification)
        await db.flush()
        return notification

    async def create_bulk_notifications(
        self,
        db: AsyncSession,
        user_ids: Iterable[int],
        title: str,
        message: str,
        notification_type: str,
    ) -> int:
        ids = list(set(user_ids))
        if not ids:
            return 0

        notifications = [
            Notification(
                user_id=user_id,
                title=title,
                message=message,
                type=notification_type,
                is_read=False,
            )
            for user_id in ids
        ]
        db.add_all(notifications)
        await db.flush()
        return len(notifications)

    async def get_user_notifications(
        self,
        db: AsyncSession,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50,
    ) -> Sequence[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read == False)

        result = await db.execute(
            query.order_by(Notification.created_at.desc()).limit(limit)
        )
        return result.scalars().all()

    async def mark_as_read(
        self, db: AsyncSession, notification_id: int, user_id: int
    ) -> Notification | None:
        result = await db.execute(
            select(Notification).where(
                and_(Notification.id == notification_id, Notification.user_id == user_id)
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return None
        notification.is_read = True
        await db.commit()
        await db.refresh(notification)
        return notification

    async def mark_all_as_read(self, db: AsyncSession, user_id: int) -> int:
        result = await db.execute(
            select(Notification).where(
                and_(Notification.user_id == user_id, Notification.is_read == False)
            )
        )
        notifications = result.scalars().all()
        for notification in notifications:
            notification.is_read = True
        await db.commit()
        return len(notifications)

    async def resolve_announcement_targets(
        self,
        db: AsyncSession,
        role: str | None = None,
        department: str | None = None,
    ) -> list[int]:
        """Resolve user ids for announcements."""
        user_query = select(User.id).where(User.is_active == True)
        if role:
            user_query = user_query.where(User.role == role)

        result = await db.execute(user_query)
        user_ids = [row[0] for row in result.fetchall()]

        if department:
            dept_students_result = await db.execute(
                select(Student.email).where(
                    and_(Student.is_active == True, Student.department == department)
                )
            )
            student_emails = [row[0] for row in dept_students_result.fetchall()]
            if not student_emails:
                return []

            dept_users_result = await db.execute(
                select(User.id).where(User.email.in_(student_emails))
            )
            dept_user_ids = [row[0] for row in dept_users_result.fetchall()]
            user_ids = [user_id for user_id in user_ids if user_id in set(dept_user_ids)]

        return list(set(user_ids))


notification_service = NotificationService()

