"""add class location columns

Revision ID: f1b2c3d4e5a6
Revises: c8b4d1e9f0a2
Create Date: 2026-04-01 21:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1b2c3d4e5a6"
down_revision: Union[str, None] = "c8b4d1e9f0a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("classes", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("classes", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("classes", "longitude")
    op.drop_column("classes", "latitude")

