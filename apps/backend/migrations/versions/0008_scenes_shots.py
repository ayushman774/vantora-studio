"""Scene and shot production structure; no existing records modified."""
from alembic import op
import sqlalchemy as sa

revision = "0008_scenes_shots"
down_revision = "0007_asset_character_links"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("scenes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("episode_id", sa.String(36), sa.ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(160), nullable=False),
        sa.Column("time_of_day", sa.String(80), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("episode_id", "number", name="uq_scenes_episode_number"),
        sa.CheckConstraint("number > 0", name="ck_scenes_number_positive"))
    op.create_index("ix_scenes_episode_id", "scenes", ["episode_id"])
    op.create_table("shots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("scene_id", sa.String(36), sa.ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("camera", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("duration_frames", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("scene_id", "number", name="uq_shots_scene_number"),
        sa.CheckConstraint("number > 0", name="ck_shots_number_positive"),
        sa.CheckConstraint("duration_frames > 0", name="ck_shots_duration_positive"))
    op.create_index("ix_shots_scene_id", "shots", ["scene_id"])

def downgrade():
    op.drop_index("ix_shots_scene_id", table_name="shots")
    op.drop_table("shots")
    op.drop_index("ix_scenes_episode_id", table_name="scenes")
    op.drop_table("scenes")
