import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ParametroCalculo(Base):
    __tablename__ = "parametro_calculo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tension_mono_v: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("220"))
    tension_tri_v: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("380"))
    cos_phi: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.9"))
    ratio_selectividad: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=Decimal("1.6"))
    factor_llenado_cablecanal: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, default=Decimal("0.65")
    )
    actualizado_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=True
    )
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
