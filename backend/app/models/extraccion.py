import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EstadoExtraccion(str, enum.Enum):
    PENDIENTE = "pendiente"
    PROCESANDO = "procesando"
    PENDIENTE_REVISION = "pendiente_revision"
    CONFIRMADO = "confirmado"
    ERROR = "error"


class ExtraccionCad(Base):
    __tablename__ = "extraccion_cad"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proyecto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("proyecto.id"), nullable=False)
    archivo_nombre: Mapped[str] = mapped_column(String(500), nullable=False)
    archivo_ruta: Mapped[str] = mapped_column(String(1000), nullable=False)
    resultado_crudo: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    estado: Mapped[EstadoExtraccion] = mapped_column(
        Enum(EstadoExtraccion, name="estado_extraccion"), default=EstadoExtraccion.PENDIENTE, nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
