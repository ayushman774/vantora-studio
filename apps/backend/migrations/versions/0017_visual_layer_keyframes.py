"""Add per-layer transform keyframes."""
from alembic import op
import sqlalchemy as sa

revision = "0017_visual_layer_keyframes"
down_revision = "0016_visual_layers"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "visual_layer_keyframes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("visual_layer_id", sa.String(36), sa.ForeignKey("visual_layers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("frame_offset", sa.Integer(), nullable=False),
        sa.Column("position_x", sa.Float(), nullable=False),
        sa.Column("position_y", sa.Float(), nullable=False),
        sa.Column("scale", sa.Float(), nullable=False),
        sa.Column("rotation", sa.Float(), nullable=False),
        sa.Column("opacity", sa.Float(), nullable=False),
        sa.Column("easing", sa.String(24), nullable=False, server_default="linear"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("visual_layer_id", "frame_offset", name="uq_visual_layer_keyframe_offset"),
        sa.CheckConstraint("frame_offset >= 0", name="ck_visual_layer_keyframe_offset_nonnegative"),
        sa.CheckConstraint("scale > 0 AND scale <= 10", name="ck_visual_layer_keyframe_scale"),
        sa.CheckConstraint("opacity >= 0 AND opacity <= 1", name="ck_visual_layer_keyframe_opacity"),
    )
    op.create_index("ix_visual_layer_keyframes_visual_layer_id", "visual_layer_keyframes", ["visual_layer_id"])

def downgrade():
    op.drop_index("ix_visual_layer_keyframes_visual_layer_id", table_name="visual_layer_keyframes")
    op.drop_table("visual_layer_keyframes")
