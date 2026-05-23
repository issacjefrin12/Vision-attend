"""Routers package."""
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.students import router as students_router
from app.routers.attendance import router as attendance_router
from app.routers.analytics import router as analytics_router
from app.routers.courses import router as courses_router
from app.routers.leave import router as leave_router
from app.routers.notifications import router as notifications_router
from app.routers.unknown_faces import router as unknown_faces_router
from app.routers.session import router as session_router
from app.routers.timetable import router as timetable_router
from app.routers.academics import router as academics_router
from app.routers.admin import router as admin_router

__all__ = [
    "auth_router",
    "users_router",
    "students_router",
    "attendance_router",
    "analytics_router",
    "courses_router",
    "leave_router",
    "notifications_router",
    "unknown_faces_router",
    "session_router",
    "timetable_router",
    "academics_router",
    "admin_router",
]

