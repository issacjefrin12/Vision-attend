"""Attendance session schemas."""
from datetime import datetime, time
from pydantic import BaseModel, Field


class SessionStartRequest(BaseModel):
    class_id: int
    subject_id: int | None = None
    session_type: str = Field(..., pattern="^(entry|hourly)$")
    duration_seconds: int = Field(default=90, ge=60, le=7200)
    entry_mode: str = Field(default="code", pattern="^(code|webcam)$")


class SessionStartResponse(BaseModel):
    id: int
    class_id: int
    subject_id: int | None
    faculty_id: int
    session_code: str
    session_type: str
    duration_seconds: int
    start_time: datetime
    expiry_time: datetime
    is_active: bool
    entry_mode: str

    class Config:
        from_attributes = True


class SessionMarkRequest(BaseModel):
    session_code: str | None = None
    session_id: int | None = None
    image_base64: str
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


class SessionMarkResponse(BaseModel):
    success: bool
    message: str
    attendance_id: int | None = None
    student_id: int | None = None
    student_name: str | None = None
    session_id: int | None = None
    session_type: str | None = None
    marked_count: int | None = None


class SessionCloseRequest(BaseModel):
    session_id: int


class SessionPolicyUpsertRequest(BaseModel):
    max_entry_per_day: int = Field(default=1, ge=1, le=10)
    entry_start_time: time
    entry_end_time: time
    is_active: bool = True


class SessionPolicyResponse(BaseModel):
    id: int
    department_id: int
    max_entry_per_day: int
    entry_start_time: time
    entry_end_time: time
    is_active: bool
    updated_by: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
