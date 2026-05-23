"""User model for Admin and Faculty."""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"


class User(Base):
    """User model for authentication (Admin/Faculty)."""
    
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    profile_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, server_default=func.now())
    
    # Relationships
    notifications = relationship("Notification", back_populates="user")
    approved_leave_requests = relationship("LeaveRequest", back_populates="approver")
    student_profile = relationship("Student", uselist=False, back_populates="user")
    
    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
