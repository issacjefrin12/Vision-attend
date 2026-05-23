"""Face Recognition Module using face_recognition library."""
import numpy as np
import face_recognition
from typing import List, Optional, Tuple
import os

from app.config import get_settings

settings = get_settings()


class FaceRecognizer:
    """Face recognition using 128D embeddings."""
    
    def __init__(self):
        self.known_encodings: List[np.ndarray] = []
        self.known_ids: List[int] = []
        self.tolerance = settings.face_recognition_tolerance
    
    def get_face_encoding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Generate 128-dimensional face encoding from image.
        
        Args:
            image: RGB numpy array containing a face
            
        Returns:
            128D numpy array or None if no face found
        """
        # Detect face locations first
        face_locations = face_recognition.face_locations(image, model="hog")
        
        if not face_locations:
            return None
        
        # Get encoding for the first (largest) face
        encodings = face_recognition.face_encodings(image, face_locations)
        
        if encodings:
            return encodings[0]
        return None
    
    def save_encoding(self, student_id: int, encoding: np.ndarray, base_path: str) -> str:
        """
        Save face encoding to disk.
        
        Args:
            student_id: Student database ID
            encoding: 128D face encoding
            base_path: Directory to save encodings
            
        Returns:
            Path to saved encoding file
        """
        os.makedirs(base_path, exist_ok=True)
        file_path = os.path.join(base_path, f"student_{student_id}.npy")
        np.save(file_path, encoding)
        return file_path
    
    def load_encoding(self, file_path: str) -> Optional[np.ndarray]:
        """Load face encoding from disk."""
        if os.path.exists(file_path):
            return np.load(file_path)
        return None
    
    def load_all_encodings(self, base_path: str) -> Tuple[List[np.ndarray], List[int]]:
        """
        Load all known face encodings from disk.
        
        Returns:
            Tuple of (encodings list, student IDs list)
        """
        encodings = []
        student_ids = []
        
        if not os.path.exists(base_path):
            return encodings, student_ids
        
        for filename in os.listdir(base_path):
            if filename.startswith("student_") and filename.endswith(".npy"):
                student_id = int(filename.replace("student_", "").replace(".npy", ""))
                encoding = np.load(os.path.join(base_path, filename))
                encodings.append(encoding)
                student_ids.append(student_id)
        
        self.known_encodings = encodings
        self.known_ids = student_ids
        
        return encodings, student_ids
    
    def recognize_face(
        self, 
        encoding: np.ndarray, 
        known_encodings: List[np.ndarray],
        known_ids: List[int]
    ) -> Tuple[Optional[int], float]:
        """
        Recognize a face against known encodings.
        
        Args:
            encoding: 128D encoding of face to recognize
            known_encodings: List of known face encodings
            known_ids: Corresponding student IDs
            
        Returns:
            Tuple of (student_id, confidence) or (None, 0.0)
        """
        if not known_encodings:
            return None, 0.0
        
        # Calculate distances to all known faces
        distances = face_recognition.face_distance(known_encodings, encoding)
        
        # Find best match
        best_match_idx = np.argmin(distances)
        best_distance = distances[best_match_idx]
        
        # Convert distance to confidence (lower distance = higher confidence)
        confidence = 1.0 - best_distance
        
        if best_distance <= self.tolerance:
            return known_ids[best_match_idx], confidence
        
        return None, confidence


# Module instance
face_recognizer = FaceRecognizer()
