"""add department and class structure

Revision ID: f7c9e2a1d3b4
Revises: b2a7f0f67f31
Create Date: 2026-03-01 11:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7c9e2a1d3b4"
down_revision: Union[str, None] = "b2a7f0f67f31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_departments_name"),
    )
    op.create_index("ix_departments_id", "departments", ["id"])
    op.create_index("ix_departments_name", "departments", ["name"])

    op.create_table(
        "classes",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.UniqueConstraint(
            "department_id",
            "year",
            "section",
            name="uq_classes_department_year_section",
        ),
    )
    op.create_index("ix_classes_id", "classes", ["id"])
    op.create_index("ix_classes_department_id", "classes", ["department_id"])

    # Seed departments from existing student and policy data.
    op.execute(
        """
        INSERT INTO departments (name)
        SELECT DISTINCT btrim(department)
        FROM students
        WHERE department IS NOT NULL AND btrim(department) <> ''
        ON CONFLICT (name) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO departments (name)
        SELECT DISTINCT btrim(department_id)
        FROM attendance_policy
        WHERE department_id IS NOT NULL
          AND btrim(department_id) <> ''
          AND department_id !~ '^[0-9]+$'
        ON CONFLICT (name) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO departments (name)
        VALUES ('General')
        ON CONFLICT (name) DO NOTHING
        """
    )

    # Preserve existing timetable/session class ids by materializing legacy classes with matching ids.
    op.execute(
        """
        INSERT INTO classes (id, department_id, year, section)
        SELECT legacy.class_id,
               d.id,
               GREATEST(1, ((ABS(legacy.class_id) + 1) / 2)::int),
               CONCAT('L', legacy.class_id::text)
        FROM (
            SELECT DISTINCT class_id FROM attendance_sessions WHERE class_id IS NOT NULL
            UNION
            SELECT DISTINCT class_id FROM timetable WHERE class_id IS NOT NULL
        ) legacy
        CROSS JOIN LATERAL (
            SELECT id FROM departments WHERE name = 'General' LIMIT 1
        ) d
        ON CONFLICT (id) DO NOTHING
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('classes', 'id'),
            COALESCE((SELECT MAX(id) FROM classes), 1),
            true
        )
        """
    )

    op.add_column("students", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("students", sa.Column("class_id", sa.Integer(), nullable=True))
    op.add_column("students", sa.Column("register_no", sa.String(length=50), nullable=True))

    # Backfill new student columns.
    op.execute(
        """
        UPDATE students
        SET register_no = student_id
        WHERE register_no IS NULL
        """
    )
    op.execute(
        """
        INSERT INTO classes (department_id, year, section)
        SELECT DISTINCT
            d.id,
            GREATEST(1, ((s.semester + 1) / 2)::int),
            'A'
        FROM students s
        JOIN departments d ON d.name = s.department
        WHERE s.department IS NOT NULL
          AND btrim(s.department) <> ''
          AND s.semester IS NOT NULL
        ON CONFLICT (department_id, year, section) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE students s
        SET class_id = c.id
        FROM classes c
        JOIN departments d ON d.id = c.department_id
        WHERE s.class_id IS NULL
          AND s.department = d.name
          AND s.semester IS NOT NULL
          AND c.year = GREATEST(1, ((s.semester + 1) / 2)::int)
          AND c.section = 'A'
        """
    )
    op.execute(
        """
        INSERT INTO classes (department_id, year, section)
        SELECT d.id, 1, 'A'
        FROM departments d
        WHERE d.name = 'General'
        ON CONFLICT (department_id, year, section) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE students
        SET class_id = (
            SELECT c.id
            FROM classes c
            JOIN departments d ON d.id = c.department_id
            WHERE d.name = 'General' AND c.year = 1 AND c.section = 'A'
            LIMIT 1
        )
        WHERE class_id IS NULL
        """
    )

    op.create_foreign_key(
        "fk_students_user_id",
        "students",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_students_class_id",
        "students",
        "classes",
        ["class_id"],
        ["id"],
    )
    op.create_unique_constraint("uq_students_user_id", "students", ["user_id"])
    op.create_unique_constraint("uq_students_register_no", "students", ["register_no"])
    op.create_index("ix_students_user_id", "students", ["user_id"])
    op.create_index("ix_students_class_id", "students", ["class_id"])
    op.create_index("ix_students_register_no", "students", ["register_no"])
    op.alter_column("students", "register_no", existing_type=sa.String(length=50), nullable=False)
    op.alter_column("students", "class_id", existing_type=sa.Integer(), nullable=False)

    # Convert policy.department_id from string to int FK.
    op.add_column("attendance_policy", sa.Column("department_id_new", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE attendance_policy ap
        SET department_id_new = d.id
        FROM departments d
        WHERE ap.department_id = d.name
        """
    )
    op.execute(
        """
        UPDATE attendance_policy
        SET department_id_new = department_id::int
        WHERE department_id_new IS NULL AND department_id ~ '^[0-9]+$'
        """
    )
    op.execute(
        """
        UPDATE attendance_policy
        SET department_id_new = (
            SELECT id FROM departments WHERE name = 'General' LIMIT 1
        )
        WHERE department_id_new IS NULL
        """
    )

    op.execute("DROP INDEX IF EXISTS ix_attendance_policy_department_id")
    op.execute("ALTER TABLE attendance_policy DROP CONSTRAINT IF EXISTS uq_attendance_policy_department")
    op.drop_column("attendance_policy", "department_id")
    op.alter_column(
        "attendance_policy",
        "department_id_new",
        new_column_name="department_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        "fk_attendance_policy_department_id",
        "attendance_policy",
        "departments",
        ["department_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_attendance_policy_department",
        "attendance_policy",
        ["department_id"],
    )
    op.create_index("ix_attendance_policy_department_id", "attendance_policy", ["department_id"])

    op.create_foreign_key(
        "fk_attendance_sessions_class_id",
        "attendance_sessions",
        "classes",
        ["class_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_timetable_class_id",
        "timetable",
        "classes",
        ["class_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_timetable_class_id", "timetable", type_="foreignkey")
    op.drop_constraint("fk_attendance_sessions_class_id", "attendance_sessions", type_="foreignkey")

    op.drop_index("ix_attendance_policy_department_id", table_name="attendance_policy")
    op.drop_constraint("uq_attendance_policy_department", "attendance_policy", type_="unique")
    op.drop_constraint("fk_attendance_policy_department_id", "attendance_policy", type_="foreignkey")
    op.add_column("attendance_policy", sa.Column("department_id_old", sa.String(length=100), nullable=True))
    op.execute(
        """
        UPDATE attendance_policy ap
        SET department_id_old = d.name
        FROM departments d
        WHERE ap.department_id = d.id
        """
    )
    op.drop_column("attendance_policy", "department_id")
    op.alter_column(
        "attendance_policy",
        "department_id_old",
        new_column_name="department_id",
        existing_type=sa.String(length=100),
        nullable=False,
    )
    op.create_unique_constraint(
        "uq_attendance_policy_department",
        "attendance_policy",
        ["department_id"],
    )
    op.create_index("ix_attendance_policy_department_id", "attendance_policy", ["department_id"])

    op.drop_index("ix_students_register_no", table_name="students")
    op.drop_index("ix_students_class_id", table_name="students")
    op.drop_index("ix_students_user_id", table_name="students")
    op.drop_constraint("uq_students_register_no", "students", type_="unique")
    op.drop_constraint("uq_students_user_id", "students", type_="unique")
    op.drop_constraint("fk_students_class_id", "students", type_="foreignkey")
    op.drop_constraint("fk_students_user_id", "students", type_="foreignkey")
    op.drop_column("students", "register_no")
    op.drop_column("students", "class_id")
    op.drop_column("students", "user_id")

    op.drop_index("ix_classes_department_id", table_name="classes")
    op.drop_index("ix_classes_id", table_name="classes")
    op.drop_table("classes")

    op.drop_index("ix_departments_name", table_name="departments")
    op.drop_index("ix_departments_id", table_name="departments")
    op.drop_table("departments")
