"""add_cablecanal_periferia_interiores

Revision ID: c90123456789
Revises: b89012345678
Create Date: 2026-07-31 08:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c90123456789'
down_revision: Union[str, None] = 'b89012345678'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tablero', sa.Column('cablecanal_periferia', sa.String(length=50), nullable=True))
    op.add_column('tablero', sa.Column('cablecanal_interiores', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('tablero', 'cablecanal_interiores')
    op.drop_column('tablero', 'cablecanal_periferia')
