"""Database connection and session management."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Async engine for FastAPI runtime.
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Session factory.
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all models."""


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Seed startup data only.

    Schema creation/update is managed exclusively by Alembic migrations.
    Run `alembic upgrade head` before starting the API.
    """
    from app.services.auth_service import auth_service

    async with AsyncSessionLocal() as session:
        try:
            admin = await auth_service.create_default_admin(session)
            if admin:
                print("Default admin user created: admin@visionattend.com / admin123")
        except Exception as exc:
            print(f"Database seed skipped. Apply migrations first. Error: {exc}")

