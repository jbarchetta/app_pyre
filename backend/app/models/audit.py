import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Nullable: un intento de login fallido con un email que no corresponde a
    # ningún usuario no tiene un actor autenticado al que atribuirlo, pero
    # igual se audita (sin distinguir "no existe" de "password incorrecta").
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=True)
    accion: Mapped[str] = mapped_column(String(255), nullable=False)
    entidad: Mapped[str] = mapped_column(String(100), nullable=False)
    entidad_id: Mapped[str] = mapped_column(String(100), nullable=False)
    detalle: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    usuario: Mapped[Optional["Usuario"]] = relationship("Usuario", lazy="selectin")
