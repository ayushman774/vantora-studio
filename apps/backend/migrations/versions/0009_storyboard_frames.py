"""Storyboard planning frames; additive and reversible schema migration."""
from alembic import op
import sqlalchemy as sa

revision = "0009_storyboard_frames"
down_revision = "0008_scenes_shots"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "storyboard_frames",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shot_id", sa.String(36), sa.ForeignKey("shots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("composition", sa.Text(), nullable=False),
        sa.Column("camera_notes", sa.Text(), nullable=False),
        sa.Column("continuity_notes", sa.Text(), nullable=False),
        sa.Column("hold_frames", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("shot_id", "number", name="uq_storyboard_frames_shot_number"),
        sa.CheckConstraint("number > 0", name="ck_storyboard_frames_number_positive"),
        sa.CheckConstraint("hold_frames > 0", name="ck_storyboard_frames_hold_positive"),
    )
    op.create_index("ix_storyboard_frames_shot_id", "storyboard_frames", ["shot_id"])

def downgrade():
    op.drop_index("ix_storyboard_frames_shot_id", table_name="storyboard_frames")
    op.drop_table("storyboard_frames")
