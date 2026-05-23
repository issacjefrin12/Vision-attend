"""Unknown face capture service."""
import base64
from datetime import date
from pathlib import Path
from uuid import uuid4
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.unknown_face import UnknownFace


class UnknownFaceService:
    """Persist unknown face captures for review."""

    def __init__(self) -> None:
        self.storage_dir = Path("unknown_faces")
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _decode_image(self, image_base64: str) -> bytes:
        payload = image_base64
        if "," in image_base64:
            payload = image_base64.split(",", 1)[1]
        return base64.b64decode(payload)

    async def log_unknown_face(
        self,
        db: AsyncSession,
        course_id: int | None,
        image_base64: str,
        confidence: float | None = None,
    ) -> UnknownFace | None:
        try:
            image_bytes = self._decode_image(image_base64)
        except Exception:
            return None

        filename = f"{uuid4().hex}.jpg"
        file_path = self.storage_dir / filename
        file_path.write_bytes(image_bytes)

        unknown_face = UnknownFace(
            course_id=course_id,
            confidence_score=confidence,
            image_path=str(file_path).replace("\\", "/"),
            resolved=False,
        )
        db.add(unknown_face)
        await db.commit()
        await db.refresh(unknown_face)
        return unknown_face

    async def count_unresolved_for_date(self, db: AsyncSession, target_date: date) -> int:
        result = await db.execute(
            select(func.count(UnknownFace.id)).where(
                and_(
                    UnknownFace.resolved == False,
                    func.date(UnknownFace.captured_at) == target_date,
                )
            )
        )
        return result.scalar() or 0

    async def list_unknown_faces(
        self, db: AsyncSession, unresolved_only: bool = True, limit: int = 50
    ) -> list[UnknownFace]:
        query = select(UnknownFace)
        if unresolved_only:
            query = query.where(UnknownFace.resolved == False)

        result = await db.execute(
            query.order_by(UnknownFace.captured_at.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def mark_resolved(self, db: AsyncSession, unknown_face_id: int) -> UnknownFace | None:
        result = await db.execute(
            select(UnknownFace).where(UnknownFace.id == unknown_face_id)
        )
        unknown_face = result.scalar_one_or_none()
        if not unknown_face:
            return None
        unknown_face.resolved = True
        await db.commit()
        await db.refresh(unknown_face)
        return unknown_face


unknown_face_service = UnknownFaceService()

