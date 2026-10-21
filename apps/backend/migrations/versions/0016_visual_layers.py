"""Introduce independent shot-scoped visual layers."""
from alembic import op
import sqlalchemy as sa
revision = "0016_visual_layers"
down_revision = "0015_animation_keyframes"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "visual_layers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("storyboard_frame_id", sa.String(36), sa.ForeignKey("storyboard_frames.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("layer_order", sa.Integer(), nullable=False),
        sa.Column("position_x", sa.Float(), nullable=False, server_default="0"),
        sa.Column("position_y", sa.Float(), nullable=False, server_default="0"),
        sa.Column("scale", sa.Float(), nullable=False, server_default="1"),
        sa.Column("rotation", sa.Float(), nullable=False, server_default="0"),
        sa.Column("opacity", sa.Float(), nullable=False, server_default="1"),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("storyboard_frame_id", "layer_order", name="uq_visual_layers_frame_order"),
        sa.CheckConstraint("layer_order >= 0", name="ck_visual_layers_order_nonnegative"),
        sa.CheckConstraint("scale > 0 AND scale <= 10", name="ck_visual_layers_scale"),
        sa.CheckConstraint("opacity >= 0 AND opacity <= 1", name="ck_visual_layers_opacity"),
    )
    op.create_index("ix_visual_layers_storyboard_frame_id", "visual_layers", ["storyboard_frame_id"])
    op.create_index("ix_visual_layers_asset_id", "visual_layers", ["asset_id"])

def downgrade():
    op.drop_index("ix_visual_layers_asset_id", table_name="visual_layers")
    op.drop_index("ix_visual_layers_storyboard_frame_id", table_name="visual_layers")
    op.drop_table("visual_layers")
