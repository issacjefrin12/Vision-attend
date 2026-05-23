import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.student import Student
from app.utils.security import get_password_hash

async def main():
    async with AsyncSessionLocal() as session:
        # Find students without linked user
        result = await session.execute(
            select(Student).where(Student.user_id == None)
        )
        students = result.scalars().all()

        created = 0

        for student in students:
            # Avoid duplicate email users
            existing_user = await session.execute(
                select(User).where(User.email == student.email)
            )
            if existing_user.scalar_one_or_none():
                continue

            new_user = User(
                email=student.email,
                full_name=student.full_name,
                role=UserRole.STUDENT,
                password_hash=get_password_hash(student.register_no),
                is_active=True,
            )

            session.add(new_user)
            await session.flush()  # get new_user.id

            student.user_id = new_user.id
            created += 1

        await session.commit()

        print(f"Created {created} new student users.")

if __name__ == "__main__":
    asyncio.run(main())
