"""Student Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class StudentBase(BaseModel):
    """Base student schema."""
    register_no: str = Field(..., min_length=1, max_length=50)
    class_id: int
    user_id: Optional[int] = None
    student_id: Optional[str] = Field(None, min_length=1, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    department: Optional[str] = None
    semester: Optional[int] = Field(None, ge=1, le=8)


class StudentCreate(StudentBase):
    """Schema for creating a student."""
    pass


class StudentUpdate(BaseModel):
    """Schema for updating a student."""
    class_id: Optional[int] = None
    register_no: Optional[str] = Field(None, min_length=1, max_length=50)
    user_id: Optional[int] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    semester: Optional[int] = Field(None, ge=1, le=8)
    is_active: Optional[bool] = None


class StudentResponse(StudentBase):
    """Schema for student response."""
    id: int
    face_encoding_path: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class StudentWithAttendance(StudentResponse):
    """Student with attendance stats."""
    total_classes: int = 0
    attended: int = 0
    attendance_percentage: float = 0.0
