"""MTCNN Face Detection Module."""
import numpy as np
from typing import List, Tuple, Optional
from mtcnn import MTCNN
import cv2


class FaceDetector:
    """MTCNN-based face detector for high-accuracy detection."""
    
    _instance: Optional['FaceDetector'] = None
    
    def __new__(cls):
        """Singleton pattern for model efficiency."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # Initialize MTCNN detector
        self.detector = MTCNN()
        self._initialized = True
    
    def detect_faces(self, image: np.ndarray) -> List[dict]:
        """
        Detect all faces in an image.
        
        Args:
            image: RGB numpy array
            
        Returns:
            List of face detections with bounding boxes and confidence
        """
        # MTCNN expects RGB
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        
        detections = self.detector.detect_faces(image)
        
        results = []
        for detection in detections:
            if detection['confidence'] >= 0.9:  # High confidence threshold
                x, y, w, h = detection['box']
                results.append({
                    'box': (max(0, x), max(0, y), w, h),
                    'confidence': detection['confidence'],
                    'keypoints': detection['keypoints']
                })
        
        return results
    
    def extract_face(
        self, 
        image: np.ndarray, 
        box: Tuple[int, int, int, int],
        margin: int = 20
    ) -> np.ndarray:
        """
        Extract face region from image with margin.
        
        Args:
            image: Source image
            box: (x, y, width, height) bounding box
            margin: Padding around face
            
        Returns:
            Cropped face image
        """
        x, y, w, h = box
        
        # Add margin
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(image.shape[1], x + w + margin)
        y2 = min(image.shape[0], y + h + margin)
        
        return image[y1:y2, x1:x2]
    
    def get_largest_face(self, image: np.ndarray) -> Optional[dict]:
        """Get the largest detected face (assumed to be the main subject)."""
        faces = self.detect_faces(image)
        
        if not faces:
            return None
        
        # Sort by area (w * h)
        largest = max(faces, key=lambda f: f['box'][2] * f['box'][3])
        return largest


# Singleton instance
face_detector = FaceDetector()
