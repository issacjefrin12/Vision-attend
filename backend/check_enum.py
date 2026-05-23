"""Verify admin password hash is compatible and test login flow."""
import asyncio
import asyncpg
import sys
sys.path.insert(0, '.')
from app.config import get_settings
from app.utils.security import verify_password

settings = get_settings()

async def main():
    conn = await asyncpg.connect(settings.database_url_sync)
    
    users = await conn.fetch("SELECT id, email, password_hash, role FROM users LIMIT 5")
    for u in users:
        pw_hash = u['password_hash']
        print(f"User: {u['email']}, role: {u['role']}")
        print(f"  Hash prefix: {pw_hash[:30]}...")
        
        # Try verifying with 'admin123'
        try:
            result = verify_password('admin123', pw_hash)
            print(f"  Verify 'admin123': {result}")
        except Exception as e:
            print(f"  Verify error: {e}")
    
    await conn.close()

asyncio.run(main())
