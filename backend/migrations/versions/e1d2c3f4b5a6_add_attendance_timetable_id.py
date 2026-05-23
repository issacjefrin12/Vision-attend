"""add attendance timetable_id and reset attendance

Revision ID: e1d2c3f4b5a6
Revises: 6a1b2c3d4e5f
Create Date: 2026-03-03 23:05:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e1d2c3f4b5a6"
down_revision: Union[str, None] = "6a1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dev-phase reset to avoid ambiguous historical mapping.
    op.execute("DELETE FROM attendance")

    op.add_column(
        "attendance",
        sa.Column("timetable_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_attendance_timetable_id",
        "attendance",
        "timetable",
        ["timetable_id"],
        ["id"],
    )
    op.create_index("ix_attendance_timetable_id", "attendance", ["timetable_id"])


def downgrade() -> None:
    op.drop_index("ix_attendance_timetable_id", table_name="attendance")
    op.drop_constraint("fk_attendance_timetable_id", "attendance", type_="foreignkey")
    op.drop_column("attendance", "timetable_id")
