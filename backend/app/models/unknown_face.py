"""Unknown face capture model."""
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UnknownFace(Base):
    """Face capture record when recognition cannot map to a student."""

    __tablename__ = "unknown_faces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), index=True
    )
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    course_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=True, index=True
    )
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    course = relationship("Course")

