"""Notifications router."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.notification import AnnouncementRequest, NotificationResponse
from app.services.notification_service import notification_service
from app.utils.security import get_current_admin, get_current_user


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/my", response_model=list[NotificationResponse])
async def my_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notifications for current user."""
    notifications = await notification_service.get_user_notifications(
        db=db, user_id=current_user.id, unread_only=unread_only, limit=limit
    )
    return list(notifications)


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark one notification as read."""
    notification = await notification_service.mark_as_read(
        db=db, notification_id=notification_id, user_id=current_user.id
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.put("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications for current user as read."""
    count = await notification_service.mark_all_as_read(db=db, user_id=current_user.id)
    return {"updated": count}


@router.post("/announce")
async def send_announcement(
    payload: AnnouncementRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin creates announcement notifications for target users."""
    valid_roles = {None, "student", "faculty", "admin"}
    if payload.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role filter",
        )

    target_user_ids = await notification_service.resolve_announcement_targets(
        db=db,
        role=payload.role,
        department=payload.department,
    )
    created = await notification_service.create_bulk_notifications(
        db=db,
        user_ids=target_user_ids,
        title=payload.title,
        message=payload.message,
        notification_type="announcement",
    )
    await db.commit()

    return {"created": created, "targets": len(target_user_ids)}

