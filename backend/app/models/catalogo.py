import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CatalogoComponente(Base):
    __tablename__ = "catalogo_componente"
    __table_args__ = (UniqueConstraint("proveedor", "codigo", name="uq_catalogo_componente_proveedor_codigo"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proveedor: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo_comercial: Mapped[str | None] = mapped_column(String(100), nullable=True)
    categoria_path: Mapped[list] = mapped_column(JSONB, nullable=False)
    categoria_raiz: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    descripcion: Mapped[str] = mapped_column(String(1000), nullable=False)
    unidad: Mapped[str] = mapped_column(String(20), nullable=False)
    precio_lista: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    precio_neto: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    # none_as_null=True: sin esto, SQLAlchemy guarda Python None como el literal
    # JSON 'null' en vez de SQL NULL, lo que rompe silenciosamente cualquier
    # filtro `.isnot(None)` (la columna deja de ser NULL para Postgres, pero
    # sigue leyéndose como None en Python) -- ver app/motor/propuesta.py.
    atributos: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True), nullable=True)
    archivo_origen: Mapped[str] = mapped_column(String(500), nullable=False)
    fila_origen: Mapped[int] = mapped_column(Integer, nullable=False)
    vigente_desde: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class CatalogoPrecioHistorial(Base):
    __tablename__ = "catalogo_precio_historial"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    componente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=False
    )
    precio_anterior: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    precio_nuevo: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
