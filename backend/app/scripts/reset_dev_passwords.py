"""Reset faculty/student passwords for development."""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.student import Student
from app.models.user import User, UserRole
from app.utils.security import get_password_hash


FACULTY_PASSWORD = "Faculty@123"


async def reset_passwords() -> None:
    async with AsyncSessionLocal() as db:
        faculty_hash = get_password_hash(FACULTY_PASSWORD)
        faculty_result = await db.execute(
            select(User).where(User.role == UserRole.FACULTY)
        )
        faculty_users = list(faculty_result.scalars().all())
        for user in faculty_users:
            user.password_hash = faculty_hash

        students_result = await db.execute(select(Student))
        students = list(students_result.scalars().all())
        students_by_user_id = {student.user_id: student for student in students if student.user_id}
        students_by_email = {
            (student.email or "").lower(): student for student in students if student.email
        }

        student_result = await db.execute(
            select(User).where(User.role == UserRole.STUDENT)
        )
        student_users = list(student_result.scalars().all())

        updated_students = 0
        skipped_students = 0
        for user in student_users:
            student = students_by_user_id.get(user.id)
            if student is None:
                student = students_by_email.get(user.email.lower())
            if not student or not student.register_no:
                skipped_students += 1
                continue
            user.password_hash = get_password_hash(student.register_no)
            updated_students += 1

        await db.commit()

        print(
            "Password reset complete.",
            f"Faculty updated: {len(faculty_users)}.",
            f"Students updated: {updated_students}.",
            f"Students skipped: {skipped_students}.",
        )


def main() -> None:
    asyncio.run(reset_passwords())


if __name__ == "__main__":
    main()
