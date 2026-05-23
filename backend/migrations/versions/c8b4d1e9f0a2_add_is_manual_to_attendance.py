"""add is_manual to attendance

Revision ID: c8b4d1e9f0a2
Revises: a9f4c2d1e6b7
Create Date: 2026-03-20 10:25:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8b4d1e9f0a2"
down_revision: Union[str, None] = "a9f4c2d1e6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attendance",
        sa.Column("is_manual", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("attendance", "is_manual")

