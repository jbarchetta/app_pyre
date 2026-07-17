"""agregar tripolar a formato_polos

Revision ID: 7c4084aba894
Revises: 37273b272058
Create Date: 2026-07-17 08:43:11.688639

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c4084aba894'
down_revision: Union[str, None] = '37273b272058'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres solo permite agregar valores a un enum existente, no borrarlos —
    # de ahí que downgrade() no pueda revertir esto limpiamente (ver abajo).
    op.execute("ALTER TYPE formato_polos ADD VALUE IF NOT EXISTS 'TRIPOLAR'")


def downgrade() -> None:
    # No-op deliberado: Postgres no soporta DROP VALUE en un tipo enum. Revertir
    # esto requeriría recrear el tipo completo (rename + create + migrate rows +
    # drop), que no vale la pena para una migración puramente aditiva mientras
    # ninguna fila use 'TRIPOLAR' todavía.
    pass
