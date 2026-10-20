"""Optional storyboard frame reference to an existing local asset."""
from alembic import op
import sqlalchemy as sa

revision = "0010_storyboard_asset"
down_revision = "0009_storyboard_frames"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("storyboard_frames") as batch:
        batch.add_column(sa.Column("asset_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_storyboard_frames_asset_id", "assets", ["asset_id"], ["id"], ondelete="SET NULL")
        batch.create_index("ix_storyboard_frames_asset_id", ["asset_id"])

def downgrade():
    with op.batch_alter_table("storyboard_frames") as batch:
        batch.drop_index("ix_storyboard_frames_asset_id")
        batch.drop_constraint("fk_storyboard_frames_asset_id", type_="foreignkey")
        batch.drop_column("asset_id")
