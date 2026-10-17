"""Initial studio metadata schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_studio_metadata"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("studio_metadata",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False))

def downgrade():
    op.drop_table("studio_metadata")
