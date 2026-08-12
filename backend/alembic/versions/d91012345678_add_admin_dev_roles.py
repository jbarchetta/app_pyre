"""add_admin_dev_roles

Revision ID: d91012345678
Revises: c90123456789
Create Date: 2026-08-12 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd91012345678'
down_revision: Union[str, None] = 'c90123456789'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'analista'")
    op.execute("ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'supervisor'")
    op.execute("ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'administrador'")
    op.execute("ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'desarrollador'")
    op.execute("UPDATE usuario SET rol = 'analista' WHERE rol::text = 'ANALISTA'")
    op.execute("UPDATE usuario SET rol = 'supervisor' WHERE rol::text = 'SUPERVISOR'")


def downgrade() -> None:
    pass
