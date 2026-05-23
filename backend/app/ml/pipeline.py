"""Complete Face Recognition Pipeline."""
import numpy as np
from typing import Optional, Tuple
import os

from app.ml.detector import face_detector
from app.ml.recognizer import face_recognizer
from app.utils.helpers import decode_base64_image


class FacePipeline:
    """End-to-end face detection and recognition pipeline."""
    
    def __init__(self):
        self.detector = face_detector
        self.recognizer = face_recognizer
        self.encodings_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "face_encodings"
        )
        os.makedirs(self.encodings_path, exist_ok=True)
        
        # Load known encodings on init
        self._load_known_faces()
    
    def _load_known_faces(self):
        """Load all known face encodings."""
        self.known_encodings, self.known_ids = self.recognizer.load_all_encodings(
            self.encodings_path
        )
    
    def reload_encodings(self):
        """Reload encodings from disk (call after adding new student)."""
        self._load_known_faces()
    
    def enroll_student(
        self, 
        student_id: int, 
        image_base64: str
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Enroll a new student with their face.
        
        Args:
            student_id: Database student ID
            image_base64: Base64 encoded face image
            
        Returns:
            Tuple of (success, message, encoding_path)
        """
        try:
            # Decode image
            image = decode_base64_image(image_base64)
            
            # Detect face using MTCNN
            detection = self.detector.get_largest_face(image)
            
            if not detection:
                return False, "No face detected in image", None
            
            # Get face encoding
            encoding = self.recognizer.get_face_encoding(image)
            
            if encoding is None:
                return False, "Could not generate face encoding", None
            
            # Save encoding
            encoding_path = self.recognizer.save_encoding(
                student_id, encoding, self.encodings_path
            )
            
            # Reload all encodings
            self.reload_encodings()
            
            return True, "Student enrolled successfully", encoding_path
            
        except Exception as e:
            return False, f"Enrollment error: {str(e)}", None
    
    def recognize_student(
        self, 
        image_base64: str
    ) -> Tuple[Optional[int], float, str]:
        """
        Recognize a student from image.
        
        Args:
            image_base64: Base64 encoded face image
            
        Returns:
            Tuple of (student_id, confidence, message)
        """
        try:
            # Decode image
            image = decode_base64_image(image_base64)
            
            # Detect face
            detection = self.detector.get_largest_face(image)
            
            if not detection:
                return None, 0.0, "No face detected"
            
            # Get encoding
            encoding = self.recognizer.get_face_encoding(image)
            
            if encoding is None:
                return None, 0.0, "Could not process face"
            
            # Recognize against known faces
            student_id, confidence = self.recognizer.recognize_face(
                encoding, 
                self.known_encodings, 
                self.known_ids
            )
            
            if student_id:
                return student_id, confidence, "Face recognized"
            else:
                return None, confidence, "Unknown face"
                
        except Exception as e:
            return None, 0.0, f"Recognition error: {str(e)}"


# Singleton pipeline instance
face_pipeline = FacePipeline()
