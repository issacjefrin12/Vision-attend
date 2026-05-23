"""initial schema

Revision ID: d4ac071716f7
Revises: 
Create Date: 2026-02-28 20:43:51.359928

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4ac071716f7'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role_enum = sa.Enum(
        "admin",
        "faculty",
        "student",
        name="userrole",
        create_type=False,
    )
    attendance_status_enum = sa.Enum(
        "PRESENT",
        "LATE",
        "ABSENT",
        name="attendancestatus",
        create_type=False,
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("student_id", sa.String(length=50), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("semester", sa.Integer(), nullable=True),
        sa.Column("face_encoding_path", sa.String(length=255), nullable=True),
        sa.Column("photo_url", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("email", name="uq_students_email"),
        sa.UniqueConstraint("student_id", name="uq_students_student_id"),
    )
    op.create_index("ix_students_id", "students", ["id"])
    op.create_index("ix_students_email", "students", ["email"])
    op.create_index("ix_students_student_id", "students", ["student_id"])

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("faculty_id", sa.Integer(), nullable=True),
        sa.Column("schedule", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["faculty_id"], ["users.id"]),
        sa.UniqueConstraint("code", name="uq_courses_code"),
    )
    op.create_index("ix_courses_id", "courses", ["id"])
    op.create_index("ix_courses_code", "courses", ["code"])

    op.create_table(
        "attendance",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("check_in_time", sa.DateTime(), nullable=False),
        sa.Column("status", attendance_status_enum, nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.UniqueConstraint(
            "student_id",
            "course_id",
            "date",
            name="unique_attendance_per_day",
        ),
    )
    op.create_index("ix_attendance_id", "attendance", ["id"])
    op.create_index("ix_attendance_date", "attendance", ["date"])
    op.create_index("ix_attendance_student_id", "attendance", ["student_id"])

    op.create_table(
        "leave_requests",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="chk_leave_requests_status",
        ),
    )
    op.create_index("ix_leave_requests_id", "leave_requests", ["id"])
    op.create_index("ix_leave_requests_student_id", "leave_requests", ["student_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.CheckConstraint(
            "type IN ('attendance', 'leave', 'announcement')",
            name="chk_notifications_type",
        ),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    op.create_table(
        "unknown_faces",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("image_path", sa.String(length=255), nullable=False),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
    )
    op.create_index("ix_unknown_faces_id", "unknown_faces", ["id"])
    op.create_index("ix_unknown_faces_captured_at", "unknown_faces", ["captured_at"])
    op.create_index("ix_unknown_faces_course_id", "unknown_faces", ["course_id"])
    op.create_index("ix_unknown_faces_resolved", "unknown_faces", ["resolved"])


def downgrade() -> None:
    op.drop_index("ix_unknown_faces_resolved", table_name="unknown_faces")
    op.drop_index("ix_unknown_faces_course_id", table_name="unknown_faces")
    op.drop_index("ix_unknown_faces_captured_at", table_name="unknown_faces")
    op.drop_index("ix_unknown_faces_id", table_name="unknown_faces")
    op.drop_table("unknown_faces")

    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_index("ix_notifications_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_leave_requests_student_id", table_name="leave_requests")
    op.drop_index("ix_leave_requests_id", table_name="leave_requests")
    op.drop_table("leave_requests")

    op.drop_index("ix_attendance_student_id", table_name="attendance")
    op.drop_index("ix_attendance_date", table_name="attendance")
    op.drop_index("ix_attendance_id", table_name="attendance")
    op.drop_table("attendance")

    op.drop_index("ix_courses_code", table_name="courses")
    op.drop_index("ix_courses_id", table_name="courses")
    op.drop_table("courses")

    op.drop_index("ix_students_student_id", table_name="students")
    op.drop_index("ix_students_email", table_name="students")
    op.drop_index("ix_students_id", table_name="students")
    op.drop_table("students")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

    attendance_status_enum = sa.Enum(
        "PRESENT",
        "LATE",
        "ABSENT",
        name="attendancestatus",
        create_type=False,
    )
    user_role_enum = sa.Enum(
        "admin",
        "faculty",
        "student",
        name="userrole",
        create_type=False,
    )
    attendance_status_enum.drop(op.get_bind(), checkfirst=True)
    user_role_enum.drop(op.get_bind(), checkfirst=True)
