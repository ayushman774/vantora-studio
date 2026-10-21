"""Add editable transform keyframes to storyboard frames."""
from alembic import op
import sqlalchemy as sa

revision = "0015_animation_keyframes"
down_revision = "0014_animatic_audio_clips"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "animation_keyframes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("storyboard_frame_id", sa.String(36), sa.ForeignKey("storyboard_frames.id", ondelete="CASCADE"), nullable=False),
        sa.Column("frame_offset", sa.Integer(), nullable=False),
        sa.Column("position_x", sa.Float(), nullable=False, server_default="0"),
        sa.Column("position_y", sa.Float(), nullable=False, server_default="0"),
        sa.Column("scale", sa.Float(), nullable=False, server_default="1"),
        sa.Column("rotation", sa.Float(), nullable=False, server_default="0"),
        sa.Column("opacity", sa.Float(), nullable=False, server_default="1"),
        sa.Column("easing", sa.String(24), nullable=False, server_default="linear"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("storyboard_frame_id", "frame_offset", name="uq_animation_keyframe_offset"),
        sa.CheckConstraint("frame_offset >= 0", name="ck_animation_keyframe_offset_nonnegative"),
        sa.CheckConstraint("scale > 0 AND scale <= 10", name="ck_animation_keyframe_scale"),
        sa.CheckConstraint("opacity >= 0 AND opacity <= 1", name="ck_animation_keyframe_opacity"),
    )
    op.create_index("ix_animation_keyframes_storyboard_frame_id", "animation_keyframes", ["storyboard_frame_id"])

def downgrade():
    op.drop_index("ix_animation_keyframes_storyboard_frame_id", table_name="animation_keyframes")
    op.drop_table("animation_keyframes")
