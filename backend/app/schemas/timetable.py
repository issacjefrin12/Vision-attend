"""Timetable schemas."""
from datetime import datetime, time
from pydantic import BaseModel, Field


class TimetableCreate(BaseModel):
    faculty_id: int | None = None
    class_id: int
    subject_id: int
    day_of_week: str = Field(..., min_length=3, max_length=12)
    start_time: time
    end_time: time


class TimetableUpdate(BaseModel):
    class_id: int | None = None
    subject_id: int | None = None
    day_of_week: str | None = Field(default=None, min_length=3, max_length=12)
    start_time: time | None = None
    end_time: time | None = None


class TimetableResponse(BaseModel):
    id: int
    faculty_id: int
    class_id: int
    subject_id: int
    day_of_week: str
    start_time: time
    end_time: time
    created_at: datetime

    class Config:
        from_attributes = True


class TimetableViewRow(BaseModel):
    timetable_id: int
    class_id: int
    department_code: str
    department_full_name: str
    year: int
    section: str
    course_id: int
    course_code: str
    course_name: str
    faculty_id: int
    faculty_name: str
    faculty_email: str
    day_of_week: str
    start_time: time
    end_time: time
