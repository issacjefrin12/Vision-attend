"""Leave request schemas."""
from datetime import date, datetime
from pydantic import BaseModel, Field


class LeaveApplyRequest(BaseModel):
    reason: str = Field(..., min_length=3)
    from_date: date
    to_date: date


class LeaveDecisionRequest(BaseModel):
    comment: str | None = None


class LeaveRequestResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    register_number: str
    reason: str
    from_date: date
    to_date: date
    status: str
    approved_by: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

