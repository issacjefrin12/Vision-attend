"""User Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    role: UserRole


class UserCreate(UserBase):
    """Schema for creating a user."""
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    is_active: Optional[bool] = None
    profile_image_url: Optional[str] = None


class UserSelfUpdate(BaseModel):
    """Schema for self profile updates."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    profile_image_url: Optional[str] = None


class UserResponse(UserBase):
    """Schema for user response."""
    id: int
    profile_image_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserInDB(UserResponse):
    """User with password hash (internal use)."""
    password_hash: str
