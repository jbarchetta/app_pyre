import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FormatoPolos(str, enum.Enum):
    UNIPOLAR = "unipolar"
    BIPOLAR = "bipolar"
    TRIPOLAR = "tripolar"
    TETRAPOLAR = "tetrapolar"


class OrigenSalida(str, enum.Enum):
    MANUAL = "manual"
    IA_PENDIENTE = "ia_pendiente"
    IA_CONFIRMADA = "ia_confirmada"


class TipoProteccion(str, enum.Enum):
    SECCIONAL_TERMOMAGNETICO = "seccional_termomagnetico"
    SECCIONAL_DIFERENCIAL = "seccional_diferencial"


class Tablero(Base):
    __tablename__ = "tablero"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proyecto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("proyecto.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    interruptor_principal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=True
    )
    nivel_falla_ka: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Seccion(Base):
    __tablename__ = "seccion"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tablero_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tablero.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Salida(Base):
    __tablename__ = "salida"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seccion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("seccion.id"), nullable=False)
    etiqueta: Mapped[str | None] = mapped_column(String(100), nullable=True)
    carga_valor: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    carga_unidad: Mapped[str] = mapped_column(String(10), nullable=False)
    formato: Mapped[FormatoPolos] = mapped_column(Enum(FormatoPolos, name="formato_polos"), nullable=False)
    tipo_proteccion: Mapped[TipoProteccion] = mapped_column(
        Enum(TipoProteccion, name="tipo_proteccion"), nullable=False
    )
    componente_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=True
    )
    origen: Mapped[OrigenSalida] = mapped_column(
        Enum(OrigenSalida, name="origen_salida"), default=OrigenSalida.MANUAL, nullable=False
    )
    # Distingue si componente_id fue elegido a mano por el analista (via
    # "Cambiar componente") o por la última propuesta automática del motor de
    # cálculo. No confundir con `origen`, reservado para el flujo futuro de
    # extracción por IA (Pista B) -- esto es específico a la asignación de
    # componente de ESTA salida.
    asignado_manualmente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    posicion_orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class BomLinea(Base):
    __tablename__ = "bom_linea"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tablero_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tablero.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=False
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    precio_unitario_congelado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
