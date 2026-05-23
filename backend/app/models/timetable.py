"""Timetable model (informational schedule)."""
from datetime import datetime, time
from sqlalchemy import DateTime, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Timetable(Base):
    """Faculty-provided timetable (informational, not strict enforcement)."""

    __tablename__ = "timetable"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    faculty_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=False, index=True
    )
    day_of_week: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    faculty = relationship("User")
    subject = relationship("Course")
    academic_class = relationship("AcademicClass", back_populates="timetable_rows")
