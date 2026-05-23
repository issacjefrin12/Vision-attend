"""Services package (lazy imports to avoid heavy dependencies on import)."""
from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = [
    "auth_service",
    "face_service",
    "attendance_service",
    "export_service",
    "email_service",
    "leave_service",
    "notification_service",
    "unknown_face_service",
    "session_service",
]

_LAZY_MAP = {
    "auth_service": "app.services.auth_service",
    "face_service": "app.services.face_service",
    "attendance_service": "app.services.attendance_service",
    "export_service": "app.services.export_service",
    "email_service": "app.services.email_service",
    "leave_service": "app.services.leave_service",
    "notification_service": "app.services.notification_service",
    "unknown_face_service": "app.services.unknown_face_service",
    "session_service": "app.services.session_service",
}


def __getattr__(name: str) -> Any:
    if name in _LAZY_MAP:
        module = import_module(_LAZY_MAP[name])
        return getattr(module, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(list(globals().keys()) + list(_LAZY_MAP.keys()))
