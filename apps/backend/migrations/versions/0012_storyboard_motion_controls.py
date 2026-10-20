"""Add backward-compatible per-frame motion intensity and easing."""
from alembic import op
import sqlalchemy as sa

revision = "0012_storyboard_motion_controls"
down_revision = "0011_storyboard_motion"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("storyboard_frames") as batch:
        batch.add_column(sa.Column("motion_intensity", sa.Integer(), nullable=False, server_default="100"))
        batch.add_column(sa.Column("motion_easing", sa.String(24), nullable=False, server_default="linear"))

def downgrade():
    with op.batch_alter_table("storyboard_frames") as batch:
        batch.drop_column("motion_easing")
        batch.drop_column("motion_intensity")
