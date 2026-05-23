"""Face service for student enrollment."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Tuple, Optional

from app.models.student import Student

try:
    from app.ml.pipeline import face_pipeline
except ImportError:
    face_pipeline = None


class FaceService:
    """Face enrollment and management service."""
    
    async def enroll_student_face(
        self,
        db: AsyncSession,
        student_id: int,
        image_base64: str
    ) -> Tuple[bool, str]:
        """
        Enroll student's face for recognition.
        
        Args:
            db: Database session
            student_id: Student database ID
            image_base64: Base64 encoded face image
            
        Returns:
            Tuple of (success, message)
        """
        # Get student
        result = await db.execute(select(Student).where(Student.id == student_id))
        student = result.scalar_one_or_none()
        
        if not student:
            return False, "Student not found"

        if face_pipeline is None:
            return False, (
                "Face recognition service is unavailable. "
                "Check ML dependencies (mtcnn, tensorflow, face_recognition)."
            )
        
        # Enroll face
        success, message, encoding_path = face_pipeline.enroll_student(
            student_id, image_base64
        )
        
        if success and encoding_path:
            # Update student record
            student.face_encoding_path = encoding_path
            await db.commit()
        
        return success, message
    
    async def check_enrollment(
        self,
        db: AsyncSession,
        student_id: int
    ) -> bool:
        """Check if student has enrolled face."""
        result = await db.execute(select(Student).where(Student.id == student_id))
        student = result.scalar_one_or_none()
        
        if not student:
            return False
        
        return bool(student.face_encoding_path)
    
    def reload_faces(self):
        """Reload all face encodings from disk."""
        face_pipeline.reload_encodings()


face_service = FaceService()
