from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.database import get_db
from app.models import AuditLog, RolUsuario, Usuario
from app.motor.parametros import obtener_parametros

router = APIRouter(prefix="/parametros-calculo", tags=["parametros-calculo"])


class ParametroCalculoResponse(BaseModel):
    tension_mono_v: Decimal
    tension_tri_v: Decimal
    cos_phi: Decimal
    ratio_selectividad: Decimal

    model_config = {"from_attributes": True}


class ParametroCalculoUpdate(BaseModel):
    tension_mono_v: Decimal
    tension_tri_v: Decimal
    cos_phi: Decimal
    ratio_selectividad: Decimal


@router.get("", response_model=ParametroCalculoResponse)
def obtener(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    return obtener_parametros(db)


@router.put("", response_model=ParametroCalculoResponse)
def actualizar(
    payload: ParametroCalculoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    parametros = obtener_parametros(db)
    parametros.tension_mono_v = payload.tension_mono_v
    parametros.tension_tri_v = payload.tension_tri_v
    parametros.cos_phi = payload.cos_phi
    parametros.ratio_selectividad = payload.ratio_selectividad
    parametros.actualizado_por = usuario.id

    db.add(
        AuditLog(
            usuario_id=usuario.id,
            accion="actualizar_parametros_calculo",
            entidad="parametro_calculo",
            entidad_id=str(parametros.id),
            detalle={
                "tension_mono_v": str(payload.tension_mono_v),
                "tension_tri_v": str(payload.tension_tri_v),
                "cos_phi": str(payload.cos_phi),
                "ratio_selectividad": str(payload.ratio_selectividad),
            },
        )
    )
    db.commit()
    db.refresh(parametros)
    return parametros
