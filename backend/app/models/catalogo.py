import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TipoComponente(str, enum.Enum):
    INTERRUPTOR_PRINCIPAL = "interruptor_principal"
    SECCIONAL_TERMOMAGNETICO = "seccional_termomagnetico"
    SECCIONAL_DIFERENCIAL = "seccional_diferencial"


class Proveedor(str, enum.Enum):
    ABB = "abb"
    OTRO = "otro"


class CatalogoComponente(Base):
    __tablename__ = "catalogo_componente"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    proveedor: Mapped[Proveedor] = mapped_column(Enum(Proveedor, name="proveedor"), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    tipo: Mapped[TipoComponente] = mapped_column(Enum(TipoComponente, name="tipo_componente"), nullable=False)
    polos: Mapped[int] = mapped_column(Integer, nullable=False)
    corriente_nominal_a: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    capacidad_corte_ka: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    ancho_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    alto_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    precio_vigente: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    vigente_desde: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class CatalogoPrecioHistorial(Base):
    __tablename__ = "catalogo_precio_historial"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    componente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=False
    )
    precio_anterior: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    precio_nuevo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
