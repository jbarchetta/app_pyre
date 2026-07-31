"""add_gabinete_manual_ancho_alto

Revision ID: b89012345678
Revises: a7899bc84f21
Create Date: 2026-07-30 21:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b89012345678'
down_revision: Union[str, None] = '7e765fcca671'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tablero', sa.Column('gabinete_manual_ancho_mm', sa.Integer(), nullable=True))
    op.add_column('tablero', sa.Column('gabinete_manual_alto_mm', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('tablero', 'gabinete_manual_alto_mm')
    op.drop_column('tablero', 'gabinete_manual_ancho_mm')
