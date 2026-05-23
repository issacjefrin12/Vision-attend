"""add department full_name column

Revision ID: c3d91e4a7b2f
Revises: f7c9e2a1d3b4
Create Date: 2026-03-03 09:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d91e4a7b2f"
down_revision: Union[str, None] = "f7c9e2a1d3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.execute("UPDATE departments SET full_name = name WHERE full_name IS NULL")
    op.alter_column("departments", "full_name", existing_type=sa.String(length=255), nullable=False)


def downgrade() -> None:
    op.drop_column("departments", "full_name")
