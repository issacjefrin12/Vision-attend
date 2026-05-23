"""Academic structure schemas (department/classes)."""
from datetime import datetime
from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=255)


class DepartmentResponse(BaseModel):
    id: int
    code: str
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClassCreate(BaseModel):
    department_code: str = Field(..., min_length=2, max_length=50)
    year: int = Field(..., ge=1, le=6)
    section: str = Field(..., min_length=1, max_length=10)


class ClassResponse(BaseModel):
    id: int
    department_id: int
    department_code: str
    department_full_name: str
    department_name: str
    year: int
    section: str
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime


class ClassLocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ClassLocationResponse(BaseModel):
    class_id: int
    latitude: float | None = None
    longitude: float | None = None
