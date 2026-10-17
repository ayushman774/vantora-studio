"""Add project-scoped character profiles."""
from alembic import op
import sqlalchemy as sa

revision = "0004_characters"
down_revision = "0003_seasons_episodes"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "characters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("role", sa.String(80), nullable=False, server_default="supporting"),
        sa.Column("biography", sa.Text(), nullable=False, server_default=""),
        sa.Column("personality", sa.Text(), nullable=False, server_default=""),
        sa.Column("appearance", sa.Text(), nullable=False, server_default=""),
        sa.Column("continuity_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_characters_project_id", "characters", ["project_id"])

def downgrade():
    op.drop_index("ix_characters_project_id", table_name="characters")
    op.drop_table("characters")
