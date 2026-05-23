"""Authentication service."""
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.schemas.auth import Token
from app.utils.security import verify_password, get_password_hash, create_access_token
from app.config import get_settings

settings = get_settings()


class AuthService:
    """Authentication business logic."""
    
    async def authenticate_user(
        self, 
        db: AsyncSession, 
        email: str, 
        password: str
    ) -> Optional[User]:
        """Authenticate user with email and password."""
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        if not verify_password(password, user.password_hash):
            return None
        
        return user
    
    async def create_user(
        self, 
        db: AsyncSession, 
        user_data: UserCreate
    ) -> User:
        """Create new user with hashed password."""
        from datetime import datetime
        user = User(
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            role=user_data.role,
            created_at=datetime.utcnow()
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        return user
    
    def create_token(self, user: User) -> Token:
        """Create JWT token for user."""
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "role": user.role.value
            },
            expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
        )
        
        return Token(access_token=access_token)
    
    async def get_user_by_email(
        self, 
        db: AsyncSession, 
        email: str
    ) -> Optional[User]:
        """Get user by email."""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def create_default_admin(self, db: AsyncSession) -> Optional[User]:
        """Create default admin if none exists."""
        result = await db.execute(
            select(User).where(User.role == UserRole.ADMIN)
        )
        admin = result.scalar_one_or_none()
        
        if admin:
            return None
        
        # Create default admin
        admin_data = UserCreate(
            email="admin@visionattend.com",
            password="admin123",  # Change in production!
            full_name="System Admin",
            role=UserRole.ADMIN
        )
        
        return await self.create_user(db, admin_data)
    
    async def reset_password(
        self,
        db: AsyncSession,
        email: str,
        new_password: str
    ) -> bool:
        """Reset user's password."""
        user = await self.get_user_by_email(db, email)
        if not user:
            return False
        
        user.password_hash = get_password_hash(new_password)
        await db.commit()
        return True


auth_service = AuthService()
