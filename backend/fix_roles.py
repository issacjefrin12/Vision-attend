"""Normalize userrole enum values and user roles to lowercase."""
import asyncio
import asyncpg
import sys

sys.path.insert(0, ".")
from app.config import get_settings  # noqa: E402

settings = get_settings()


async def main() -> None:
    conn = await asyncpg.connect(settings.database_url_sync)

    labels = await conn.fetch(
        "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'userrole'::regtype"
    )
    enum_labels = [r["enumlabel"] for r in labels]
    print(f"Current enum labels: {enum_labels}")

    rename_map = [("ADMIN", "admin"), ("FACULTY", "faculty"), ("STUDENT", "student")]
    for old, new in rename_map:
        if old in enum_labels and new not in enum_labels:
            await conn.execute(f"ALTER TYPE userrole RENAME VALUE '{old}' TO '{new}'")
            print(f"Renamed enum value {old} -> {new}")

    # Normalize any existing rows to lowercase values
    await conn.execute(
        "UPDATE users SET role = lower(role::text)::userrole "
        "WHERE role::text IN ('ADMIN', 'FACULTY', 'STUDENT')"
    )

    rows = await conn.fetch("SELECT email, role FROM users ORDER BY id")
    for row in rows:
        print(f"{row['email']}: {row['role']}")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
