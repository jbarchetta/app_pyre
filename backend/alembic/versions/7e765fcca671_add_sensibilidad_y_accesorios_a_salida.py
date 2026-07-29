"""add_sensibilidad_accesorios_y_alimentado_por_a_salida

Estas tres columnas venían siendo agregadas con un ALTER TABLE ... IF NOT
EXISTS crudo en app/main.py (_ejecutar_migraciones_ligeras) en vez de una
migración de Alembic real -- esta migración las pone bajo control de
Alembic y permite borrar ese hack.

Revision ID: 7e765fcca671
Revises: a7899bc84f21
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e765fcca671'
down_revision: Union[str, None] = 'a7899bc84f21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'salida',
        sa.Column('alimentado_por_salida_id', sa.UUID(), sa.ForeignKey('salida.id', ondelete='SET NULL'), nullable=True),
    )
    op.add_column('salida', sa.Column('sensibilidad_ma', sa.Integer(), nullable=True, server_default='30'))
    op.add_column('salida', sa.Column('admite_accesorios', sa.Boolean(), nullable=True, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('salida', 'admite_accesorios')
    op.drop_column('salida', 'sensibilidad_ma')
    op.drop_column('salida', 'alimentado_por_salida_id')
