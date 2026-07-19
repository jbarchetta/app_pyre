"""add asignado_manualmente to salida

Revision ID: 1b967dfcdb91
Revises: e1842e504901
Create Date: 2026-07-19 12:02:18.398398

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b967dfcdb91'
down_revision: Union[str, None] = 'e1842e504901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTA: el autogenerate también detectó los 3 índices GIN trigram de
    # catalogo_componente como "removidos" -- es un falso positivo porque esos
    # índices se crearon con SQL crudo (no vía op.create_index) en una
    # migración anterior, y Alembic no reconoce su expresión. NO tocarlos acá.
    op.add_column('salida', sa.Column('asignado_manualmente', sa.Boolean(), nullable=False, server_default='false'))
    op.alter_column('salida', 'asignado_manualmente', server_default=None)


def downgrade() -> None:
    op.drop_column('salida', 'asignado_manualmente')
