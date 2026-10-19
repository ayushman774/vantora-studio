"""Link project assets to characters without changing existing image files."""
from alembic import op
import sqlalchemy as sa

revision = "0007_asset_character_links"
down_revision = "0006_assets"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("assets") as batch:
        batch.add_column(sa.Column("character_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_assets_character_id", "characters", ["character_id"], ["id"], ondelete="SET NULL")
        batch.create_index("ix_assets_character_id", ["character_id"])

def downgrade():
    with op.batch_alter_table("assets") as batch:
        batch.drop_index("ix_assets_character_id")
        batch.drop_constraint("fk_assets_character_id", type_="foreignkey")
        batch.drop_column("character_id")
