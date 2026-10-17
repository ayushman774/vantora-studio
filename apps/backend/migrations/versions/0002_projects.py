"""Add locally persisted production projects."""
from alembic import op
import sqlalchemy as sa

revision = "0002_projects"
down_revision = "0001_studio_metadata"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("project_type", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_projects_updated_at", "projects", ["updated_at"])

def downgrade():
    op.drop_index("ix_projects_updated_at", table_name="projects")
    op.drop_table("projects")
