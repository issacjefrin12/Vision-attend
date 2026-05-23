"""Attendance Pydantic schemas."""
from datetime import datetime, date
from pydantic import BaseModel, Field
from typing import Optional, List
from app.models.attendance import AttendanceStatus, AttendanceType


class AttendanceBase(BaseModel):
    """Base attendance schema."""
    student_id: int
    course_id: int | None = None
    timetable_id: int | None = None
    session_id: int | None = None
    attendance_type: str = "session"
    status: AttendanceStatus


class AttendanceCreate(AttendanceBase):
    """Schema for creating attendance."""
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class AttendanceResponse(AttendanceBase):
    """Schema for attendance response."""
    id: int
    date: date
    check_in_time: datetime
    confidence_score: Optional[float] = None
    is_manual: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


class AttendanceWithStudent(AttendanceResponse):
    """Attendance with student details."""
    student_name: str
    student_roll: str


class AttendanceStats(BaseModel):
    """Attendance statistics."""
    total_students: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float


class DailyAttendance(BaseModel):
    """Daily attendance summary."""
    date: date
    present: int
    late: int
    absent: int


class AttendanceMarkRequest(BaseModel):
    """Request to mark attendance via face recognition."""
    course_id: int
    timetable_id: int | None = None
    image_base64: str


class AttendanceMarkResponse(BaseModel):
    """Response after marking attendance."""
    success: bool
    message: str
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    status: Optional[AttendanceStatus] = None
    confidence: Optional[float] = None
    timetable_id: Optional[int] = None


class EntryStatusStudent(BaseModel):
    id: int
    student_id: str
    register_no: str
    full_name: str
    status: Optional[AttendanceStatus] = None
    check_in_time: Optional[str] = None
    attendance_id: Optional[int] = None
    is_manual: bool = False


class EntryStatusResponse(BaseModel):
    class_id: int
    date: str
    present: List[EntryStatusStudent]
    absent: List[EntryStatusStudent]


class ManualAttendanceMarkRequest(BaseModel):
    student_id: int
    status: AttendanceStatus = AttendanceStatus.PRESENT
    type: AttendanceType = AttendanceType.ENTRY
    session_id: Optional[int] = None
    course_id: Optional[int] = None
    date: Optional[date] = None


class ManualAttendanceMarkResponse(BaseModel):
    success: bool
    message: str
    attendance_id: int
    student_id: int
    status: AttendanceStatus
    type: AttendanceType
    is_manual: bool


class ClassStudentResponse(BaseModel):
    id: int
    student_id: str
    register_no: str
    full_name: str
    attendance_percentage: float
    current_status: AttendanceStatus


class BulkAttendanceStudentStatus(BaseModel):
    student_id: int
    status: AttendanceStatus = AttendanceStatus.PRESENT


class BulkAttendanceMarkRequest(BaseModel):
    session_id: int
    students: List[BulkAttendanceStudentStatus]


class BulkAttendanceMarkResponse(BaseModel):
    success: bool
    message: str
    session_id: int
    updated_count: int
    present_count: int
    absent_count: int
