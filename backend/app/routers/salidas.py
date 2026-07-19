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
    ParametroCalculo,
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
    componente_codigo: str | None
    componente_codigo_comercial: str | None
    componente_descripcion: str | None
    origen: str
    asignado_manualmente: bool

    model_config = {"from_attributes": True}


def _salida_response(db: Session, salida: Salida) -> SalidaResponse:
    componente = db.get(CatalogoComponente, salida.componente_id) if salida.componente_id else None
    return SalidaResponse(
        id=str(salida.id),
        seccion_id=str(salida.seccion_id),
        carga_valor=salida.carga_valor,
        carga_unidad=salida.carga_unidad,
        formato=salida.formato.value,
        tipo_proteccion=salida.tipo_proteccion.value,
        componente_id=str(salida.componente_id) if salida.componente_id else None,
        componente_codigo=componente.codigo if componente else None,
        componente_codigo_comercial=componente.codigo_comercial if componente else None,
        componente_descripcion=componente.descripcion if componente else None,
        origen=salida.origen.value,
        asignado_manualmente=salida.asignado_manualmente,
    )


def _proponer_componente_para_salida(
    db: Session,
    tablero: Tablero,
    tipo_proteccion: TipoProteccion,
    formato: FormatoPolos,
    carga_valor: Decimal,
    carga_unidad: str,
    parametros: ParametroCalculo,
) -> uuid.UUID | None:
    # Puede levantar ValueError (ej. unidad de carga inválida) -- el caller la
    # traduce a un 400. Compartida por crear_salida y actualizar_salida para
    # no duplicar la lógica de propuesta cuando cambia la carga/formato.
    corriente_nominal = calcular_corriente_nominal(carga_valor, carga_unidad, formato, parametros)

    if tablero.interruptor_principal_id is None:
        return None
    interruptor_principal = db.get(CatalogoComponente, tablero.interruptor_principal_id)
    atributos_principal = (interruptor_principal.atributos or {}) if interruptor_principal else {}
    nominal_aguas_arriba = atributos_principal.get("corriente_nominal_a")
    if nominal_aguas_arriba is None:
        return None

    propuesto = proponer_componente(
        db,
        tipo_proteccion,
        formato,
        corriente_nominal,
        tablero.nivel_falla_ka,
        Decimal(str(nominal_aguas_arriba)),
        parametros,
    )
    return propuesto.id if propuesto else None


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
        componente_id = _proponer_componente_para_salida(
            db, tablero, payload.tipo_proteccion, payload.formato, payload.carga_valor, payload.carga_unidad, parametros
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

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
    return _salida_response(db, salida)


class SalidaUpdate(BaseModel):
    carga_valor: Decimal | None = None
    carga_unidad: str | None = None
    formato: FormatoPolos | None = None
    tipo_proteccion: TipoProteccion | None = None
    componente_id: uuid.UUID | None = None
    asignado_manualmente: bool | None = None


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

    # exclude_unset: igual que TableroUpdate/ProyectoUpdate -- un PATCH parcial
    # no debe pisar campos que el cliente no mandó.
    cambios = payload.model_dump(exclude_unset=True)
    campos_recalculo = ("carga_valor", "carga_unidad", "formato", "tipo_proteccion")
    debe_recalcular = any(campo in cambios for campo in campos_recalculo)
    # "componente_id" in cambios es true incluso si el valor es null -- un
    # componente_id explícito (incluida una limpieza explícita a null) siempre
    # gana sobre el recálculo automático.
    componente_fijado_explicitamente = "componente_id" in cambios

    if "carga_valor" in cambios:
        salida.carga_valor = cambios["carga_valor"]
    if "carga_unidad" in cambios:
        salida.carga_unidad = cambios["carga_unidad"]
    if "formato" in cambios:
        salida.formato = cambios["formato"]
    if "tipo_proteccion" in cambios:
        salida.tipo_proteccion = cambios["tipo_proteccion"]

    if "asignado_manualmente" in cambios:
        salida.asignado_manualmente = cambios["asignado_manualmente"]
        if not salida.asignado_manualmente:
            debe_recalcular = True

    if componente_fijado_explicitamente:
        # Un componente_id explícito en el mismo pedido gana por sobre el
        # recálculo automático, incluso si también cambió la carga/formato.
        salida.componente_id = cambios["componente_id"]
        if cambios["componente_id"] is not None:
            salida.asignado_manualmente = True
        else:
            salida.asignado_manualmente = False
            debe_recalcular = True
    elif debe_recalcular and not salida.asignado_manualmente:
        seccion = db.get(Seccion, salida.seccion_id)
        tablero = db.get(Tablero, seccion.tablero_id)
        parametros = obtener_parametros(db)
        try:
            salida.componente_id = _proponer_componente_para_salida(
                db, tablero, salida.tipo_proteccion, salida.formato, salida.carga_valor, salida.carga_unidad, parametros
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db.commit()
    db.refresh(salida)
    return _salida_response(db, salida)


@router.delete("/salidas/{salida_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_salida(
    salida_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida = db.get(Salida, salida_id)
    if salida is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salida no encontrada")
    db.delete(salida)
    db.commit()


@router.get("/secciones/{seccion_id}/salidas", response_model=list[SalidaResponse])
def listar_salidas(
    seccion_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    salidas = db.query(Salida).filter(Salida.seccion_id == seccion_id).order_by(Salida.posicion_orden).all()
    return [_salida_response(db, s) for s in salidas]
