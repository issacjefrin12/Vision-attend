"""Authentication router."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import Token, LoginRequest, PasswordResetRequest, PasswordResetConfirm
from app.schemas.user import UserCreate, UserResponse, UserSelfUpdate
from app.services.auth_service import auth_service
from app.services.email_service import email_service
from app.utils.security import get_current_user, get_current_admin, create_reset_token, get_password_hash, verify_reset_token
from app.models.user import User
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT token."""
    user = await auth_service.authenticate_user(
        db, credentials.email, credentials.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    return auth_service.create_token(user)


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Register new user (admin only)."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Registering user: {user_data.email}, role: {user_data.role}")
        
        existing = await auth_service.get_user_by_email(db, user_data.email)
        if existing and existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        if existing and not existing.is_active:
            existing.full_name = user_data.full_name
            existing.role = user_data.role
            existing.password_hash = get_password_hash(user_data.password)
            existing.is_active = True
            await db.commit()
            await db.refresh(existing)
            logger.info(f"User reactivated successfully: {existing.email}")
            return existing

        user = await auth_service.create_user(db, user_data)
        logger.info(f"User created successfully: {user.email}")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user info."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_current_user_info(
    user_data: UserSelfUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current authenticated user profile."""
    patch = user_data.model_dump(exclude_unset=True)
    for key, value in patch.items():
        setattr(current_user, key, value)

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """Request password reset email."""
    user = await auth_service.get_user_by_email(db, request.email)
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate reset token
    reset_token = create_reset_token(user.email)
    reset_link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
    
    # Send reset email
    await email_service.send_password_reset_email(user.email, reset_link)
    
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    request: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    """Reset password with token."""
    # Verify token
    email = verify_reset_token(request.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Reset password
    success = await auth_service.reset_password(db, email, request.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reset password"
        )
    
    return {"message": "Password reset successfully"}

