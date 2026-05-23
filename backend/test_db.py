import asyncpg
import asyncio

async def test():
    try:
        conn = await asyncpg.connect(
            user='postgres',
            password='postgree123',
            database='vision_attend',
            host='localhost',
            port=5432
        )
        print('SUCCESS: Connected to PostgreSQL!')
        await conn.close()
    except Exception as e:
        print(f'ERROR: {e}')

asyncio.run(test())
