"""add codigo_obra fecha_inicio to proyecto and etiqueta to salida

Revision ID: 9a8b7c6d5e4f
Revises: 6e2a42990735
Create Date: 2026-07-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a8b7c6d5e4f'
down_revision: Union[str, None] = '6e2a42990735'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('proyecto', sa.Column('codigo_obra', sa.String(length=100), nullable=True))
    op.add_column('proyecto', sa.Column('fecha_inicio', sa.DateTime(timezone=True), nullable=True))
    op.add_column('salida', sa.Column('etiqueta', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('salida', 'etiqueta')
    op.drop_column('proyecto', 'fecha_inicio')
    op.drop_column('proyecto', 'codigo_obra')
