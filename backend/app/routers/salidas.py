import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.ownership import obtener_salida_autorizada, obtener_seccion_autorizada
from app.catalogo.queries import componentes_por_id
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
from app.motor.propuesta import proponer_componente, proponer_componente_con_diagnostico
from app.routers.paginacion import LIMITE_POR_DEFECTO, acotar_paginacion

router = APIRouter(tags=["salidas"])


class SalidaCreate(BaseModel):
    carga_valor: Decimal
    carga_unidad: str
    formato: FormatoPolos
    tipo_proteccion: TipoProteccion
    etiqueta: str | None = None


class SalidaResponse(BaseModel):
    id: str
    seccion_id: str
    etiqueta: str | None
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
    posicion_orden: int
    motivo_sin_match: str | None = None

    model_config = {"from_attributes": True}


def _obtener_motivo_sin_match(db: Session, salida: Salida) -> str | None:
    if salida.componente_id is not None or salida.asignado_manualmente:
        return None
    seccion = db.get(Seccion, salida.seccion_id)
    if not seccion:
        return "Sección no encontrada."
    tablero = db.get(Tablero, seccion.tablero_id)
    if not tablero or tablero.interruptor_principal_id is None:
        return "Debe seleccionar un interruptor principal para poder proponer un componente."

    interruptor_principal = db.get(CatalogoComponente, tablero.interruptor_principal_id)
    atributos_principal = (interruptor_principal.atributos or {}) if interruptor_principal else {}
    nominal_aguas_arriba = atributos_principal.get("corriente_nominal_a")
    if nominal_aguas_arriba is None:
        return "El interruptor principal no tiene especificada la corriente nominal."

    parametros = obtener_parametros(db)
    try:
        corriente_nominal = calcular_corriente_nominal(
            salida.carga_valor, salida.carga_unidad, salida.formato, parametros
        )
    except ValueError as exc:
        return str(exc)

    _, motivo = proponer_componente_con_diagnostico(
        db,
        salida.tipo_proteccion,
        salida.formato,
        corriente_nominal,
        tablero.nivel_falla_ka,
        Decimal(str(nominal_aguas_arriba)),
        parametros,
    )
    return motivo


def _salida_response(db: Session, salida: Salida, componente: CatalogoComponente | None = None) -> SalidaResponse:
    if componente is None and salida.componente_id:
        componente = db.get(CatalogoComponente, salida.componente_id)

    motivo = _obtener_motivo_sin_match(db, salida)

    return SalidaResponse(
        id=str(salida.id),
        seccion_id=str(salida.seccion_id),
        etiqueta=salida.etiqueta,
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
        posicion_orden=salida.posicion_orden,
        motivo_sin_match=motivo,
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
    seccion = obtener_seccion_autorizada(db, seccion_id, usuario)
    tablero = db.get(Tablero, seccion.tablero_id)

    parametros = obtener_parametros(db)
    try:
        componente_id = _proponer_componente_para_salida(
            db, tablero, payload.tipo_proteccion, payload.formato, payload.carga_valor, payload.carga_unidad, parametros
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    max_orden = (
        db.query(Salida.posicion_orden)
        .filter(Salida.seccion_id == seccion_id)
        .order_by(Salida.posicion_orden.desc())
        .first()
    )
    nuevo_orden = (max_orden[0] + 1) if max_orden else 0

    salida = Salida(
        seccion_id=seccion_id,
        etiqueta=payload.etiqueta,
        carga_valor=payload.carga_valor,
        carga_unidad=payload.carga_unidad,
        formato=payload.formato,
        tipo_proteccion=payload.tipo_proteccion,
        componente_id=componente_id,
        origen=OrigenSalida.MANUAL,
        posicion_orden=nuevo_orden,
    )
    db.add(salida)
    db.commit()
    db.refresh(salida)
    return _salida_response(db, salida)


class SalidaUpdate(BaseModel):
    etiqueta: str | None = None
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
    salida = obtener_salida_autorizada(db, salida_id, usuario)

    cambios = payload.model_dump(exclude_unset=True)
    campos_recalculo = ("carga_valor", "carga_unidad", "formato", "tipo_proteccion")
    debe_recalcular = any(campo in cambios for campo in campos_recalculo)
    componente_fijado_explicitamente = "componente_id" in cambios

    if "etiqueta" in cambios:
        salida.etiqueta = cambios["etiqueta"]
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


@router.post("/salidas/{salida_id}/duplicar", response_model=SalidaResponse, status_code=status.HTTP_201_CREATED)
def duplicar_salida(
    salida_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida_original = obtener_salida_autorizada(db, salida_id, usuario)

    max_orden = (
        db.query(Salida.posicion_orden)
        .filter(Salida.seccion_id == salida_original.seccion_id)
        .order_by(Salida.posicion_orden.desc())
        .first()
    )
    nuevo_orden = (max_orden[0] + 1) if max_orden else 0

    etiqueta_nueva = (salida_original.etiqueta + " (copia)") if salida_original.etiqueta else None

    nueva_salida = Salida(
        seccion_id=salida_original.seccion_id,
        etiqueta=etiqueta_nueva,
        carga_valor=salida_original.carga_valor,
        carga_unidad=salida_original.carga_unidad,
        formato=salida_original.formato,
        tipo_proteccion=salida_original.tipo_proteccion,
        componente_id=salida_original.componente_id,
        origen=salida_original.origen,
        asignado_manualmente=salida_original.asignado_manualmente,
        posicion_orden=nuevo_orden,
    )
    db.add(nueva_salida)
    db.commit()
    db.refresh(nueva_salida)
    return _salida_response(db, nueva_salida)


class ReordenarSalidasPayload(BaseModel):
    salidas_ids: list[uuid.UUID]


@router.post("/secciones/{seccion_id}/salidas/reordenar", status_code=status.HTTP_204_NO_CONTENT)
def reordenar_salidas(
    seccion_id: uuid.UUID,
    payload: ReordenarSalidasPayload,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    obtener_seccion_autorizada(db, seccion_id, usuario)
    for index, salida_id in enumerate(payload.salidas_ids):
        db.query(Salida).filter(Salida.id == salida_id, Salida.seccion_id == seccion_id).update(
            {"posicion_orden": index}
        )
    db.commit()


@router.delete("/salidas/{salida_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_salida(
    salida_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida = obtener_salida_autorizada(db, salida_id, usuario)
    db.delete(salida)
    db.commit()


@router.get("/secciones/{seccion_id}/salidas", response_model=list[SalidaResponse])
def listar_salidas(
    seccion_id: uuid.UUID,
    limit: int = LIMITE_POR_DEFECTO,
    offset: int = 0,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    obtener_seccion_autorizada(db, seccion_id, usuario)
    limit, offset = acotar_paginacion(limit, offset)
    salidas = (
        db.query(Salida)
        .filter(Salida.seccion_id == seccion_id)
        .order_by(Salida.posicion_orden, Salida.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    componentes = componentes_por_id(db, {s.componente_id for s in salidas if s.componente_id})
    return [_salida_response(db, s, componentes.get(s.componente_id)) for s in salidas]
