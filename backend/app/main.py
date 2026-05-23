"""FastAPI main application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import (
    auth_router,
    users_router,
    students_router,
    attendance_router,
    analytics_router,
    courses_router,
    leave_router,
    notifications_router,
    unknown_faces_router,
    session_router,
    timetable_router,
    academics_router,
    admin_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    await init_db()
    print("✅ Database initialized")
    print("🚀 Vision Attend API is running!")
    
    yield
    
    # Shutdown
    print("👋 Shutting down Vision Attend API")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Modern Vision-Based Attendance Tracking System with MTCNN face detection",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(students_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(courses_router, prefix="/api")
app.include_router(leave_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(unknown_faces_router, prefix="/api")
app.include_router(session_router, prefix="/api")
app.include_router(timetable_router, prefix="/api")
app.include_router(academics_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/api/admin/reinit-db")
async def reinit_db():
    """Reinitialize database (add missing enum values, etc.). Admin use only."""
    try:
        await init_db()
        return {"status": "success", "message": "Database reinitialized"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/admin/check-enum")
async def check_enum():
    """Check and fix the userrole enum."""
    from sqlalchemy import text
    from app.database import engine
    
    async with engine.connect() as conn:
        try:
            result = await conn.execute(
                text("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'userrole'::regtype ORDER BY enumsortorder")
            )
            current_values = [row[0] for row in result.fetchall()]
            
            needs_student = 'student' not in current_values
            
            if needs_student:
                await conn.execute(text("ALTER TYPE userrole ADD VALUE 'student'"))
                await conn.commit()
                return {"current_values": current_values, "added_student": True, "message": "Added 'student' to enum"}
            
            return {"current_values": current_values, "needs_update": False}
        except Exception as e:
            return {"error": str(e)}


@app.post("/api/admin/test-create-student")
async def test_create_student():
    """Test creating a student directly."""
    from sqlalchemy import text
    from app.database import engine
    import time
    
    unique_email = f"direct_test_{int(time.time())}@test.com"
    
    try:
        async with engine.begin() as conn:
            # Try inserting a student directly via SQL
            result = await conn.execute(
                text("""
                    INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
                    VALUES (:email, 'test_hash', 'Direct Test', 'student', true, NOW())
                    RETURNING id, email, role
                """).bindparams(email=unique_email)
            )
            row = result.fetchone()
            await conn.commit()
            return {"success": True, "user": {"id": row[0], "email": row[1], "role": row[2]}}
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
