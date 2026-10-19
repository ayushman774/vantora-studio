"""Project-scoped local asset library."""
from alembic import op
import sqlalchemy as sa

revision = "0006_assets"
down_revision = "0005_character_references"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("filename", sa.String(80), nullable=False),
        sa.Column("media_type", sa.String(32), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("size_bytes > 0", name="ck_assets_size_positive"),
    )
    op.create_index("ix_assets_project_id", "assets", ["project_id"])

def downgrade():
    op.drop_index("ix_assets_project_id", table_name="assets")
    op.drop_table("assets")
