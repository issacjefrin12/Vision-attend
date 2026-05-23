"""Helper utilities."""
import base64
from io import BytesIO
from typing import Optional
import os


def decode_base64_image(base64_string: str):
    """Decode base64 image to numpy array for face recognition."""
    import numpy as np
    from PIL import Image
    
    # Remove data URL prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    
    image_data = base64.b64decode(base64_string)
    image = Image.open(BytesIO(image_data))
    
    # Convert to RGB if necessary
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    return np.array(image)


def encode_image_to_base64(image) -> str:
    """Encode numpy array to base64 string."""
    from PIL import Image
    
    pil_image = Image.fromarray(image)
    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode()


def ensure_dir(path: str) -> str:
    """Ensure directory exists."""
    os.makedirs(path, exist_ok=True)
    return path


def get_face_encoding_path(student_id: int) -> str:
    """Get path for storing face encoding."""
    base_path = os.path.join(os.path.dirname(__file__), "..", "..", "face_encodings")
    ensure_dir(base_path)
    return os.path.join(base_path, f"student_{student_id}.npy")
