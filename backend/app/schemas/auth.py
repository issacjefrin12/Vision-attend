"""Authentication schemas."""
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.user import UserRole


class Token(BaseModel):
    """JWT Token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded token data."""
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None


class LoginRequest(BaseModel):
    """Login request schema."""
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    """Request password reset schema."""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Confirm password reset schema."""
    token: str
    new_password: str

