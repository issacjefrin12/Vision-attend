"""Student model with class mapping."""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    """Student model for attendance tracking."""
    
    __tablename__ = "students"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, unique=True, index=True
    )
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=False, index=True
    )
    register_no: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    student_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=True)
    face_encoding_path: Mapped[str] = mapped_column(String(255), nullable=True)
    photo_url: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    attendances = relationship("Attendance", back_populates="student")
    leave_requests = relationship("LeaveRequest", back_populates="student")
    user = relationship("User", back_populates="student_profile")
    academic_class = relationship("AcademicClass", back_populates="students")
    
    def __repr__(self) -> str:
        return f"<Student {self.register_no or self.student_id}: {self.full_name}>"
