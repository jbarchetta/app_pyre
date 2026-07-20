"""make audit_log usuario_id nullable

Revision ID: 6e2a42990735
Revises: 1b967dfcdb91
Create Date: 2026-07-20 06:01:53.279890

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e2a42990735'
down_revision: Union[str, None] = '1b967dfcdb91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTA: el autogenerate también detectó los 3 índices GIN trigram de
    # catalogo_componente como "removidos" -- falso positivo ya documentado en
    # la migración 1b967dfcdb91 (se crearon con SQL crudo, Alembic no los
    # reconoce). NO tocarlos acá.
    op.alter_column('audit_log', 'usuario_id', existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    op.alter_column('audit_log', 'usuario_id', existing_type=sa.UUID(), nullable=False)
