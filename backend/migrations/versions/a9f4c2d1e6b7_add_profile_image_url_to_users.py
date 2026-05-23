"""add profile image url to users

Revision ID: a9f4c2d1e6b7
Revises: e1d2c3f4b5a6
Create Date: 2026-03-17 12:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9f4c2d1e6b7"
down_revision: Union[str, None] = "e1d2c3f4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_image_url")

