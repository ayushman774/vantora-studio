"""Persist shot-scoped audio timeline clips."""
from alembic import op
import sqlalchemy as sa

revision = "0014_animatic_audio_clips"
down_revision = "0013_audio_assets"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "animatic_audio_clips",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("shot_id", sa.String(36), sa.ForeignKey("shots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("audio_asset_id", sa.String(36), sa.ForeignKey("audio_assets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("start_frame", sa.Integer(), nullable=False),
        sa.Column("duration_frames", sa.Integer(), nullable=False),
        sa.Column("volume", sa.Float(), nullable=False),
        sa.Column("muted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("start_frame >= 0", name="ck_animatic_audio_start_nonnegative"),
        sa.CheckConstraint("duration_frames > 0", name="ck_animatic_audio_duration_positive"),
        sa.CheckConstraint("volume >= 0 AND volume <= 2", name="ck_animatic_audio_volume_range"),
    )
    op.create_index("ix_animatic_audio_clips_shot_id", "animatic_audio_clips", ["shot_id"])
    op.create_index("ix_animatic_audio_clips_audio_asset_id", "animatic_audio_clips", ["audio_asset_id"])

def downgrade():
    op.drop_index("ix_animatic_audio_clips_audio_asset_id", table_name="animatic_audio_clips")
    op.drop_index("ix_animatic_audio_clips_shot_id", table_name="animatic_audio_clips")
    op.drop_table("animatic_audio_clips")
