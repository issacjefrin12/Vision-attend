"""remove course faculty_id

Revision ID: 6a1b2c3d4e5f
Revises: c3d91e4a7b2f
Create Date: 2026-03-03 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6a1b2c3d4e5f"
down_revision: Union[str, None] = "c3d91e4a7b2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("courses_faculty_id_fkey", "courses", type_="foreignkey")
    op.drop_column("courses", "faculty_id")


def downgrade() -> None:
    op.add_column("courses", sa.Column("faculty_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "courses_faculty_id_fkey",
        "courses",
        "users",
        ["faculty_id"],
        ["id"],
    )
