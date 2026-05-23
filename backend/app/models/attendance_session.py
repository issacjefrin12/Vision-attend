"""Attendance session model for entry/hourly sessions."""
from datetime import datetime
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AttendanceSession(Base):
    """Teacher-managed attendance window."""

    __tablename__ = "attendance_sessions"
    __table_args__ = (
        CheckConstraint("session_type IN ('entry','hourly')", name="chk_session_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=False, index=True
    )
    subject_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=True
    )
    faculty_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    session_code: Mapped[str] = mapped_column(String(6), nullable=False, unique=True, index=True)
    session_type: Mapped[str] = mapped_column(String(20), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    start_time: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )
    expiry_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    entry_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="code")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    faculty = relationship("User")
    subject = relationship("Course")
    academic_class = relationship("AcademicClass", back_populates="sessions")
    attendances = relationship("Attendance", back_populates="session")
