import traceback
import sys
import os

# Redirect stderr to a file
with open('error_log.txt', 'w', encoding='utf-8') as f:
    sys.stderr = f
    sys.stdout = f
    
    try:
        print("Step 1: Importing settings...")
        from app.config import get_settings
        settings = get_settings()
        print("  OK!")
        
        print("Step 2: Importing database...")
        from app.database import init_db, engine
        print("  OK!")
        
        print("Step 3: Importing routers...")
        from app.routers import (
            auth_router,
            users_router, 
            students_router,
            attendance_router,
            analytics_router
        )
        print("  OK!")
        
        print("Step 4: Creating FastAPI app...")
        from fastapi import FastAPI
        app = FastAPI()
        print("  OK!")
        
        print("Step 5: Testing database initialization...")
        import asyncio
        asyncio.run(init_db())
        print("  OK!")
        
        print("\nAll imports successful!")
        
    except Exception as e:
        print(f"\nERROR: {e}")
        traceback.print_exc()

print("Done - check error_log.txt")
