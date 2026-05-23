"""Academic class model."""
from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AcademicClass(Base):
    """Represents department + year + section."""

    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint(
            "department_id",
            "year",
            "section",
            name="uq_classes_department_year_section",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=False, index=True
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str] = mapped_column(String(10), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    department = relationship("Department", back_populates="classes")
    students = relationship("Student", back_populates="academic_class")
    sessions = relationship("AttendanceSession", back_populates="academic_class")
    timetable_rows = relationship("Timetable", back_populates="academic_class")
