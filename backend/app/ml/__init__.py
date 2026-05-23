"""ML package exports - lazy imports to handle missing dependencies gracefully."""

try:
    from app.ml.detector import face_detector, FaceDetector
    from app.ml.recognizer import face_recognizer, FaceRecognizer
    from app.ml.pipeline import face_pipeline, FacePipeline
except ImportError as e:
    import logging
    logging.getLogger(__name__).warning(f"ML dependencies not available: {e}")
    face_detector = None
    FaceDetector = None
    face_recognizer = None
    FaceRecognizer = None
    face_pipeline = None
    FacePipeline = None

__all__ = [
    "face_detector", "FaceDetector",
    "face_recognizer", "FaceRecognizer", 
    "face_pipeline", "FacePipeline"
]
