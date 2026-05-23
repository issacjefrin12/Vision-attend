"""session based attendance model

Revision ID: b2a7f0f67f31
Revises: d4ac071716f7
Create Date: 2026-02-28 21:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2a7f0f67f31"
down_revision: Union[str, None] = "d4ac071716f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendancetype') THEN
                CREATE TYPE attendancetype AS ENUM ('entry', 'session');
            END IF;
        END$$;
        """
    )

    op.create_table(
        "attendance_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("faculty_id", sa.Integer(), nullable=False),
        sa.Column("session_code", sa.String(length=6), nullable=False),
        sa.Column("session_type", sa.String(length=20), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("start_time", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("expiry_time", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("entry_mode", sa.String(length=20), nullable=False, server_default="code"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["faculty_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["courses.id"]),
        sa.CheckConstraint("session_type IN ('entry','hourly')", name="chk_session_type"),
        sa.UniqueConstraint("session_code", name="uq_attendance_sessions_session_code"),
    )
    op.create_index("ix_attendance_sessions_id", "attendance_sessions", ["id"])
    op.create_index("ix_attendance_sessions_class_id", "attendance_sessions", ["class_id"])
    op.create_index("ix_attendance_sessions_faculty_id", "attendance_sessions", ["faculty_id"])
    op.create_index("ix_attendance_sessions_is_active", "attendance_sessions", ["is_active"])
    op.create_index("ix_attendance_sessions_session_code", "attendance_sessions", ["session_code"])

    op.create_table(
        "attendance_policy",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("department_id", sa.String(length=100), nullable=False),
        sa.Column("max_entry_per_day", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("entry_start_time", sa.Time(), nullable=False),
        sa.Column("entry_end_time", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.UniqueConstraint("department_id", name="uq_attendance_policy_department"),
    )
    op.create_index("ix_attendance_policy_id", "attendance_policy", ["id"])
    op.create_index("ix_attendance_policy_department_id", "attendance_policy", ["department_id"])

    op.create_table(
        "timetable",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("faculty_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("day_of_week", sa.String(length=12), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["faculty_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["courses.id"]),
    )
    op.create_index("ix_timetable_id", "timetable", ["id"])
    op.create_index("ix_timetable_faculty_id", "timetable", ["faculty_id"])
    op.create_index("ix_timetable_class_id", "timetable", ["class_id"])
    op.create_index("ix_timetable_subject_id", "timetable", ["subject_id"])
    op.create_index("ix_timetable_day_of_week", "timetable", ["day_of_week"])

    op.add_column(
        "attendance",
        sa.Column("session_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "attendance",
        sa.Column(
            "attendance_type",
            sa.Enum("entry", "session", name="attendancetype", create_type=False),
            nullable=False,
            server_default="session",
        ),
    )
    op.create_foreign_key(
        "fk_attendance_session_id",
        "attendance",
        "attendance_sessions",
        ["session_id"],
        ["id"],
    )

    op.execute("ALTER TABLE attendance ALTER COLUMN course_id DROP NOT NULL")
    op.execute("ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day")
    op.create_unique_constraint(
        "uq_attendance_student_session",
        "attendance",
        ["student_id", "session_id"],
    )
    op.create_index("ix_attendance_session_id", "attendance", ["session_id"])
    op.create_index("ix_attendance_type", "attendance", ["attendance_type"])


def downgrade() -> None:
    op.drop_index("ix_attendance_type", table_name="attendance")
    op.drop_index("ix_attendance_session_id", table_name="attendance")
    op.drop_constraint("uq_attendance_student_session", "attendance", type_="unique")
    op.execute(
        "ALTER TABLE attendance ADD CONSTRAINT unique_attendance_per_day UNIQUE (student_id, course_id, date)"
    )
    op.execute("ALTER TABLE attendance ALTER COLUMN course_id SET NOT NULL")
    op.drop_constraint("fk_attendance_session_id", "attendance", type_="foreignkey")
    op.drop_column("attendance", "attendance_type")
    op.drop_column("attendance", "session_id")

    op.drop_index("ix_timetable_day_of_week", table_name="timetable")
    op.drop_index("ix_timetable_subject_id", table_name="timetable")
    op.drop_index("ix_timetable_class_id", table_name="timetable")
    op.drop_index("ix_timetable_faculty_id", table_name="timetable")
    op.drop_index("ix_timetable_id", table_name="timetable")
    op.drop_table("timetable")

    op.drop_index("ix_attendance_policy_department_id", table_name="attendance_policy")
    op.drop_index("ix_attendance_policy_id", table_name="attendance_policy")
    op.drop_table("attendance_policy")

    op.drop_index("ix_attendance_sessions_session_code", table_name="attendance_sessions")
    op.drop_index("ix_attendance_sessions_is_active", table_name="attendance_sessions")
    op.drop_index("ix_attendance_sessions_faculty_id", table_name="attendance_sessions")
    op.drop_index("ix_attendance_sessions_class_id", table_name="attendance_sessions")
    op.drop_index("ix_attendance_sessions_id", table_name="attendance_sessions")
    op.drop_table("attendance_sessions")

    op.execute("DROP TYPE IF EXISTS attendancetype")

