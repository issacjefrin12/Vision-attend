"""Local password reset utility (dev only)."""
from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.utils.security import get_password_hash


async def _reset_password(email: str, new_password: str) -> int:
    async with AsyncSessionLocal() as session:
        password_hash = get_password_hash(new_password)
        result = await session.execute(
            text(
                "UPDATE users SET password_hash = :password_hash "
                "WHERE email = :email"
            ),
            {"password_hash": password_hash, "email": email},
        )
        await session.commit()

        if result.rowcount == 0:
            print(f"No user found for email: {email}")
            return 1

        print(f"Password reset for {email}")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset a user's password.")
    parser.add_argument(
        "--email",
        default="admin@visionattend.com",
        help="User email to reset (default: admin@visionattend.com)",
    )
    parser.add_argument(
        "--password",
        required=True,
        help="New password to set",
    )
    args = parser.parse_args()
    return asyncio.run(_reset_password(args.email, args.password))


if __name__ == "__main__":
    raise SystemExit(main())
