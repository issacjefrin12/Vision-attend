"""SQLAlchemy models package."""
from app.models.department import Department
from app.models.academic_class import AcademicClass
from app.models.user import User
from app.models.student import Student
from app.models.course import Course
from app.models.attendance import Attendance
from app.models.attendance_session import AttendanceSession
from app.models.timetable import Timetable
from app.models.attendance_policy import AttendancePolicy
from app.models.system_setting import SystemSetting
from app.models.leave import LeaveRequest
from app.models.notification import Notification
from app.models.unknown_face import UnknownFace

__all__ = [
    "User",
    "Department",
    "AcademicClass",
    "Student",
    "Course",
    "Attendance",
    "AttendanceSession",
    "Timetable",
    "AttendancePolicy",
    "SystemSetting",
    "LeaveRequest",
    "Notification",
    "UnknownFace",
]
