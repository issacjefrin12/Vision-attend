"""Attendance model with status tracking."""
from datetime import datetime, date
from sqlalchemy import (
    DateTime,
    Date,
    Integer,
    ForeignKey,
    Float,
    Boolean,
    UniqueConstraint,
    Enum as SQLEnum,
    String,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"


class AttendanceType(str, enum.Enum):
    ENTRY = "entry"
    SESSION = "session"


class Attendance(Base):
    """Attendance record model."""
    
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("student_id", "session_id", name="uq_attendance_student_session"),
        Index("ix_attendance_session_id", "session_id"),
        Index("ix_attendance_type", "attendance_type"),
        Index("ix_attendance_timetable_id", "timetable_id"),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id"), nullable=False)
    # subject_id concept maps to existing courses table.
    course_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("courses.id"), nullable=True)
    timetable_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("timetable.id"), nullable=True
    )
    session_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("attendance_sessions.id"), nullable=True
    )
    attendance_type: Mapped[str] = mapped_column(
        SQLEnum(
            AttendanceType,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            name="attendancetype",
        ),
        nullable=False,
        default=AttendanceType.SESSION.value,
        server_default=AttendanceType.SESSION.value,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_in_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(SQLEnum(AttendanceStatus), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=True)
    is_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    student = relationship("Student", back_populates="attendances")
    course = relationship("Course", back_populates="attendances")
    timetable = relationship("Timetable")
    session = relationship("AttendanceSession", back_populates="attendances")
    
    def __repr__(self) -> str:
        return f"<Attendance {self.student_id} - {self.date} ({self.status})>"
