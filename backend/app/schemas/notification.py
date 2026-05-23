"""Notification schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AnnouncementRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    message: str = Field(..., min_length=3)
    role: str | None = Field(default=None, description="Optional target role")
    department: str | None = Field(default=None, description="Optional student department target")

