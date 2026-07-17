import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import (
    CatalogoComponente,
    FormatoPolos,
    OrigenSalida,
    RolUsuario,
    Salida,
    Seccion,
    Tablero,
    TipoProteccion,
    Usuario,
)
from app.motor.calculo import calcular_corriente_nominal
from app.motor.parametros import obtener_parametros
from app.motor.propuesta import proponer_componente

router = APIRouter(tags=["salidas"])


class SalidaCreate(BaseModel):
    carga_valor: Decimal
    carga_unidad: str
    formato: FormatoPolos
    tipo_proteccion: TipoProteccion


class SalidaResponse(BaseModel):
    id: str
    seccion_id: str
    carga_valor: Decimal
    carga_unidad: str
    formato: str
    tipo_proteccion: str
    componente_id: str | None
    origen: str

    model_config = {"from_attributes": True}


def _salida_response(salida: Salida) -> SalidaResponse:
    return SalidaResponse(
        id=str(salida.id),
        seccion_id=str(salida.seccion_id),
        carga_valor=salida.carga_valor,
        carga_unidad=salida.carga_unidad,
        formato=salida.formato.value,
        tipo_proteccion=salida.tipo_proteccion.value,
        componente_id=str(salida.componente_id) if salida.componente_id else None,
        origen=salida.origen.value,
    )


@router.post("/secciones/{seccion_id}/salidas", response_model=SalidaResponse, status_code=status.HTTP_201_CREATED)
def crear_salida(
    seccion_id: uuid.UUID,
    payload: SalidaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    tablero = db.get(Tablero, seccion.tablero_id)

    parametros = obtener_parametros(db)
    try:
        corriente_nominal = calcular_corriente_nominal(
            payload.carga_valor, payload.carga_unidad, payload.formato, parametros
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    componente_id = None
    if tablero.interruptor_principal_id is not None:
        interruptor_principal = db.get(CatalogoComponente, tablero.interruptor_principal_id)
        atributos_principal = (interruptor_principal.atributos or {}) if interruptor_principal else {}
        nominal_aguas_arriba = atributos_principal.get("corriente_nominal_a")
        if nominal_aguas_arriba is not None:
            propuesto = proponer_componente(
                db,
                payload.tipo_proteccion,
                payload.formato,
                corriente_nominal,
                tablero.nivel_falla_ka,
                Decimal(str(nominal_aguas_arriba)),
                parametros,
            )
            componente_id = propuesto.id if propuesto else None

    salida = Salida(
        seccion_id=seccion_id,
        carga_valor=payload.carga_valor,
        carga_unidad=payload.carga_unidad,
        formato=payload.formato,
        tipo_proteccion=payload.tipo_proteccion,
        componente_id=componente_id,
        origen=OrigenSalida.MANUAL,
    )
    db.add(salida)
    db.commit()
    db.refresh(salida)
    return _salida_response(salida)


class SalidaUpdate(BaseModel):
    componente_id: uuid.UUID | None = None


@router.patch("/salidas/{salida_id}", response_model=SalidaResponse)
def actualizar_salida(
    salida_id: uuid.UUID,
    payload: SalidaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida = db.get(Salida, salida_id)
    if salida is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salida no encontrada")

    salida.componente_id = payload.componente_id
    db.commit()
    db.refresh(salida)
    return _salida_response(salida)


@router.get("/secciones/{seccion_id}/salidas", response_model=list[SalidaResponse])
def listar_salidas(
    seccion_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    salidas = db.query(Salida).filter(Salida.seccion_id == seccion_id).order_by(Salida.posicion_orden).all()
    return [_salida_response(s) for s in salidas]
