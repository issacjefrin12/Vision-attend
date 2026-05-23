"""Pydantic schemas package."""
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.schemas.attendance import AttendanceCreate, AttendanceResponse, AttendanceStats
from app.schemas.auth import Token, TokenData, LoginRequest
from app.schemas.leave import LeaveApplyRequest, LeaveRequestResponse
from app.schemas.notification import NotificationResponse, AnnouncementRequest
from app.schemas.session import (
    SessionStartRequest,
    SessionStartResponse,
    SessionMarkRequest,
    SessionMarkResponse,
    SessionPolicyUpsertRequest,
    SessionPolicyResponse,
)
from app.schemas.timetable import TimetableCreate, TimetableUpdate, TimetableResponse
from app.schemas.academic import (
    DepartmentCreate,
    DepartmentResponse,
    ClassCreate,
    ClassResponse,
)

__all__ = [
    "UserCreate", "UserResponse", "UserUpdate",
    "StudentCreate", "StudentResponse", "StudentUpdate", 
    "AttendanceCreate", "AttendanceResponse", "AttendanceStats",
    "Token", "TokenData", "LoginRequest",
    "LeaveApplyRequest", "LeaveRequestResponse",
    "NotificationResponse", "AnnouncementRequest",
    "SessionStartRequest", "SessionStartResponse",
    "SessionMarkRequest", "SessionMarkResponse",
    "SessionPolicyUpsertRequest", "SessionPolicyResponse",
    "TimetableCreate", "TimetableUpdate", "TimetableResponse",
    "DepartmentCreate", "DepartmentResponse", "ClassCreate", "ClassResponse",
]
