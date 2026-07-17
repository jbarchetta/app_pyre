"""ampliar codigo_comercial a 200 caracteres

Revision ID: e1842e504901
Revises: 2ca0b3ba5a12
Create Date: 2026-07-17 12:59:49.026018

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1842e504901'
down_revision: Union[str, None] = '2ca0b3ba5a12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nota: alembic autogenerate también proponía DROP de los índices trigram
    # de la migración anterior (2ca0b3ba5a12) porque esos índices se crean con
    # SQL crudo, no vía Column(index=...), y el autogenerador no los reconoce
    # como "conocidos". Se removieron esas líneas a mano -- esta migración
    # solo debe tocar el ancho de codigo_comercial.
    op.alter_column('catalogo_componente', 'codigo_comercial',
               existing_type=sa.VARCHAR(length=100),
               type_=sa.String(length=200),
               existing_nullable=True)


def downgrade() -> None:
    op.alter_column('catalogo_componente', 'codigo_comercial',
               existing_type=sa.String(length=200),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
