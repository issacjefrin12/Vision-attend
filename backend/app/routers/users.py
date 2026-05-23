"""Users management router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate
from app.utils.security import get_current_admin

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=List[UserResponse])
async def list_users(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """List all users (admin only)."""
    query = select(User)
    if not include_inactive:
        query = query.where(User.is_active == True)
    result = await db.execute(query.order_by(User.created_at.desc()))
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get user by ID (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    patch = user_data.model_dump(exclude_unset=True)

    # Enforce same safety constraints when deactivating through PATCH.
    if patch.get("is_active") is False and user.is_active:
        if user.id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot delete your own account")

        if user.role == UserRole.ADMIN:
            admin_count_result = await db.execute(
                select(func.count(User.id)).where(
                    User.role == UserRole.ADMIN,
                    User.is_active == True,
                )
            )
            admin_count = admin_count_result.scalar() or 0
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="At least one active admin is required")

    for key, value in patch.items():
        setattr(user, key, value)
    
    await db.commit()
    await db.refresh(user)
    
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Deactivate user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User is already deleted")

    if user.role == UserRole.ADMIN:
        admin_count_result = await db.execute(
            select(func.count(User.id)).where(
                User.role == UserRole.ADMIN,
                User.is_active == True,
            )
        )
        admin_count = admin_count_result.scalar() or 0
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="At least one active admin is required")
    
    user.is_active = False
    await db.commit()
    
    return {"message": "User deleted successfully"}
