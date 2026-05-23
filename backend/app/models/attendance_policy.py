"""Attendance policy model."""
from datetime import datetime, time
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AttendancePolicy(Base):
    """Admin-configured entry attendance policy per department."""

    __tablename__ = "attendance_policy"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=False, unique=True, index=True
    )
    max_entry_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    entry_start_time: Mapped[time] = mapped_column(Time, nullable=False)
    entry_end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=func.now(),
    )

    updater = relationship("User")
    department = relationship("Department")
