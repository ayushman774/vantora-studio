"""Persist per-frame camera motion and transition presets without changing existing frame data."""
from alembic import op
import sqlalchemy as sa

revision = "0011_storyboard_motion"
down_revision = "0010_storyboard_asset"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("storyboard_frames") as batch:
        batch.add_column(sa.Column("camera_motion", sa.String(24), nullable=False, server_default="none"))
        batch.add_column(sa.Column("transition", sa.String(24), nullable=False, server_default="cut"))

def downgrade():
    with op.batch_alter_table("storyboard_frames") as batch:
        batch.drop_column("transition")
        batch.drop_column("camera_motion")
