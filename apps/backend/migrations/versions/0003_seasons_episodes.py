"""Project production hierarchy: seasons and episodes."""
from alembic import op
import sqlalchemy as sa

revision = "0003_seasons_episodes"
down_revision = "0002_projects"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("seasons",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "number", name="uq_seasons_project_number"),
        sa.CheckConstraint("number > 0", name="ck_seasons_number_positive"))
    op.create_index("ix_seasons_project_id", "seasons", ["project_id"])
    op.create_table("episodes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("season_id", sa.String(36), sa.ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("synopsis", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("season_id", "number", name="uq_episodes_season_number"),
        sa.CheckConstraint("number > 0", name="ck_episodes_number_positive"))
    op.create_index("ix_episodes_season_id", "episodes", ["season_id"])

def downgrade():
    op.drop_index("ix_episodes_season_id", table_name="episodes")
    op.drop_table("episodes")
    op.drop_index("ix_seasons_project_id", table_name="seasons")
    op.drop_table("seasons")
