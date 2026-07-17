"""motor de configuracion: tipo_proteccion en salida y parametro_calculo

Revision ID: 37273b272058
Revises: 8a650955d6af
Create Date: 2026-07-16 21:22:18.991581

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '37273b272058'
down_revision: Union[str, None] = '8a650955d6af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


tipo_proteccion_enum = postgresql.ENUM(
    'SECCIONAL_TERMOMAGNETICO', 'SECCIONAL_DIFERENCIAL', name='tipo_proteccion'
)

# NOTE: agrega una columna NOT NULL sin server_default a `salida`, lo que asume
# que la tabla está vacía (vale hoy — la Fase C todavía no cargó tableros reales).
# Si esta migración se reproduce contra un ambiente con datos, agregar un
# server_default o un paso de backfill.
#
# NOTE: los valores del tipo enum de Postgres usan los NOMBRES en mayúsculas
# de TipoProteccion (SECCIONAL_TERMOMAGNETICO / SECCIONAL_DIFERENCIAL), no los
# .value en minúsculas. Es el comportamiento por default de
# `Enum(PyEnumClass, name=...)` en SQLAlchemy (serializa .name, no .value) y
# coincide con el patrón ya usado por formato_polos/origen_salida/tipo_componente
# en f0b73abc4cc0_esquema_inicial.py. Confirmado corriendo
# `Enum(FormatoPolos, name="formato_polos").enums` -> ['UNIPOLAR', 'BIPOLAR', 'TETRAPOLAR'].


def upgrade() -> None:
    tipo_proteccion_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('salida', sa.Column('tipo_proteccion', tipo_proteccion_enum, nullable=False))

    op.create_table(
        'parametro_calculo',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tension_mono_v', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('tension_tri_v', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('cos_phi', sa.Numeric(precision=3, scale=2), nullable=False),
        sa.Column('ratio_selectividad', sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column('actualizado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actualizado_por'], ['usuario.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('parametro_calculo')
    op.drop_column('salida', 'tipo_proteccion')
    tipo_proteccion_enum.drop(op.get_bind(), checkfirst=True)
