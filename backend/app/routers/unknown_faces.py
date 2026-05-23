"""Unknown face review router."""
from datetime import date
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.unknown_face_service import unknown_face_service
from app.utils.security import get_current_faculty_or_admin


router = APIRouter(prefix="/unknown-faces", tags=["Unknown Faces"])


class UnknownFaceResponse(BaseModel):
    id: int
    captured_at: str
    confidence_score: float | None
    course_id: int | None
    image_path: str
    resolved: bool


@router.get("/today-count")
async def today_unknown_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    _ = current_user
    count = await unknown_face_service.count_unresolved_for_date(db, date.today())
    return {"date": date.today().isoformat(), "count": count}


@router.get("/", response_model=list[UnknownFaceResponse])
async def list_unknown_faces(
    unresolved_only: bool = Query(True),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    _ = current_user
    records = await unknown_face_service.list_unknown_faces(
        db=db, unresolved_only=unresolved_only, limit=limit
    )
    return [
        UnknownFaceResponse(
            id=record.id,
            captured_at=record.captured_at.isoformat(),
            confidence_score=record.confidence_score,
            course_id=record.course_id,
            image_path=record.image_path,
            resolved=record.resolved,
        )
        for record in records
    ]


@router.put("/{unknown_face_id}/resolve", response_model=UnknownFaceResponse)
async def resolve_unknown_face(
    unknown_face_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_faculty_or_admin),
):
    _ = current_user
    record = await unknown_face_service.mark_resolved(db=db, unknown_face_id=unknown_face_id)
    if not record:
        raise HTTPException(status_code=404, detail="Unknown face record not found")
    return UnknownFaceResponse(
        id=record.id,
        captured_at=record.captured_at.isoformat(),
        confidence_score=record.confidence_score,
        course_id=record.course_id,
        image_path=record.image_path,
        resolved=record.resolved,
    )

