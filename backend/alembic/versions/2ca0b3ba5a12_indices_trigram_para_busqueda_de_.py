"""indices trigram para busqueda de catalogo

Revision ID: 2ca0b3ba5a12
Revises: 7c4084aba894
Create Date: 2026-07-17 12:50:45.466179

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ca0b3ba5a12'
down_revision: Union[str, None] = '7c4084aba894'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pg_trgm es una extensión "trusted" (Postgres 13+): el owner de la base
    # (usuario `tablero`) puede crearla sin ser superusuario.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX ix_catalogo_componente_codigo_trgm ON catalogo_componente "
        "USING gin (codigo gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_catalogo_componente_codigo_comercial_trgm ON catalogo_componente "
        "USING gin (codigo_comercial gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_catalogo_componente_descripcion_trgm ON catalogo_componente "
        "USING gin (descripcion gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_catalogo_componente_descripcion_trgm")
    op.execute("DROP INDEX IF EXISTS ix_catalogo_componente_codigo_comercial_trgm")
    op.execute("DROP INDEX IF EXISTS ix_catalogo_componente_codigo_trgm")
    # No se hace DROP EXTENSION pg_trgm: es una extensión a nivel de base de
    # datos, no de esta tabla en particular -- otro código futuro podría
    # depender de ella, y CREATE EXTENSION IF NOT EXISTS es idempotente si se
    # necesita volver a crear los índices.
