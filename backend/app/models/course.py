"""Course model."""
from datetime import datetime
from sqlalchemy import String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    """Course model for class management."""
    
    __tablename__ = "courses"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    schedule: Mapped[dict] = mapped_column(JSON, nullable=True)  # {"days": ["Mon", "Wed"], "time": "09:00"}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    attendances = relationship("Attendance", back_populates="course")
    sessions = relationship("AttendanceSession", back_populates="subject")
    
    def __repr__(self) -> str:
        return f"<Course {self.code}: {self.name}>"
