"""Application configuration using Pydantic Settings."""
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List

MAX_DISTANCE_KM = 0.05


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    app_name: str = "Vision Attend"
    debug: bool = False
    
    # Database
    database_url: str
    database_url_sync: str
    
    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # Email
    resend_api_key: str = ""
    from_email: str = "noreply@example.com"
    
    # CORS
    allowed_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"
    
    # ML Settings
    face_recognition_tolerance: float = 0.6
    late_threshold_minutes: int = 15
    max_distance_km: float = MAX_DISTANCE_KM

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        """Allow relaxed debug env values like 'release'/'production'."""
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "on", "debug"}:
            return True
        if normalized in {"0", "false", "no", "off", "release", "prod", "production"}:
            return False
        return value

    @field_validator("max_distance_km")
    @classmethod
    def validate_max_distance_km(cls, value: float) -> float:
        if value <= 0:
            return MAX_DISTANCE_KM
        return value

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
