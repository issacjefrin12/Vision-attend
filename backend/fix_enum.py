"""Reset admin password to admin123 with a fresh hash."""
import asyncio
import asyncpg
import sys
sys.path.insert(0, '.')
from app.config import get_settings
from app.utils.security import get_password_hash

settings = get_settings()

async def main():
    conn = await asyncpg.connect(settings.database_url_sync)
    
    new_hash = get_password_hash('admin123')
    print(f"New hash: {new_hash[:40]}...")
    
    result = await conn.execute(
        "UPDATE users SET password_hash = $1 WHERE email = $2",
        new_hash, 'admin@visionattend.com'
    )
    print(f"Update result: {result}")
    
    await conn.close()
    print("Admin password reset to 'admin123'")

asyncio.run(main())
