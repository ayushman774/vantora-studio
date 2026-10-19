"""Character reference images stored on local disk."""
from alembic import op
import sqlalchemy as sa

revision = "0005_character_references"
down_revision = "0004_characters"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "character_references",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("character_id", sa.String(36), sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(80), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("media_type", sa.String(32), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("size_bytes > 0", name="ck_character_references_size_positive"),
    )
    op.create_index("ix_character_references_character_id", "character_references", ["character_id"])

def downgrade():
    op.drop_index("ix_character_references_character_id", table_name="character_references")
    op.drop_table("character_references")
