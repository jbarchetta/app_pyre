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
from app.motor.motor_reglas import calcular_dimensiones_tablero
from app.routers.paginacion import LIMITE_POR_DEFECTO, acotar_paginacion

router = APIRouter(tags=["salidas"])


class SalidaCreate(BaseModel):
    carga_valor: Decimal
    carga_unidad: str
    formato: FormatoPolos
    tipo_proteccion: TipoProteccion
    sensibilidad_ma: int | None = 30
    admite_accesorios: bool | None = False
    etiqueta: str | None = None
    alimentado_por_salida_id: uuid.UUID | None = None


class SalidaResponse(BaseModel):
    id: str
    seccion_id: str
    etiqueta: str | None
    carga_valor: Decimal
    carga_unidad: str
    formato: str
    tipo_proteccion: str
    sensibilidad_ma: int | None = None
    admite_accesorios: bool | None = None
    componente_id: str | None
    componente_codigo: str | None
    componente_codigo_comercial: str | None
    componente_descripcion: str | None
    origen: str
    asignado_manualmente: bool
    posicion_orden: int
    motivo_sin_match: str | None = None
    alimentado_por_salida_id: str | None = None
    alimentado_por_codigo: str | None = None
    posicion_codigo: str | None = None

    model_config = {"from_attributes": True}


def _calcular_codigo_salida(db: Session, salida_id: uuid.UUID) -> str | None:
    salida_obj = db.get(Salida, salida_id)
    if not salida_obj:
        return None
    seccion = db.get(Seccion, salida_obj.seccion_id)
    if not seccion:
        return None
    secciones = (
        db.query(Seccion.id)
        .filter(Seccion.tablero_id == seccion.tablero_id)
        .order_by(Seccion.orden, Seccion.id)
        .all()
    )
    seccion_num = 1
    for idx, (sec_id,) in enumerate(secciones):
        if sec_id == seccion.id:
            seccion_num = idx + 1
            break
    salidas = (
        db.query(Salida.id)
        .filter(Salida.seccion_id == seccion.id)
        .order_by(Salida.posicion_orden, Salida.id)
        .all()
    )
    salida_num = 1
    for idx, (sal_id,) in enumerate(salidas):
        if sal_id == salida_obj.id:
            salida_num = idx + 1
            break
    return f"F{seccion_num}.{salida_num}"


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
        sensibilidad_ma=salida.sensibilidad_ma,
        admite_accesorios=salida.admite_accesorios,
    )
    return motivo


def _salida_response(db: Session, salida: Salida, componente: CatalogoComponente | None = None) -> SalidaResponse:
    if componente is None and salida.componente_id:
        componente = db.get(CatalogoComponente, salida.componente_id)

    if componente is None and not salida.asignado_manualmente:
        seccion = db.get(Seccion, salida.seccion_id)
        if seccion:
            tablero = db.get(Tablero, seccion.tablero_id)
            if tablero and tablero.interruptor_principal_id:
                interruptor_principal = db.get(CatalogoComponente, tablero.interruptor_principal_id)
                atributos_principal = (interruptor_principal.atributos or {}) if interruptor_principal else {}
                nominal_aguas_arriba = atributos_principal.get("corriente_nominal_a")
                if nominal_aguas_arriba is not None:
                    parametros = obtener_parametros(db)
                    try:
                        corriente_nominal = calcular_corriente_nominal(
                            salida.carga_valor, salida.carga_unidad, salida.formato, parametros
                        )
                        propuesto, _ = proponer_componente_con_diagnostico(
                            db,
                            salida.tipo_proteccion,
                            salida.formato,
                            corriente_nominal,
                            tablero.nivel_falla_ka,
                            Decimal(str(nominal_aguas_arriba)),
                            parametros,
                            sensibilidad_ma=salida.sensibilidad_ma,
                            admite_accesorios=salida.admite_accesorios,
                        )
                        if propuesto:
                            componente = propuesto
                    except ValueError:
                        pass

    motivo = _obtener_motivo_sin_match(db, salida)
    alimentado_por_codigo = (
        _calcular_codigo_salida(db, salida.alimentado_por_salida_id)
        if salida.alimentado_por_salida_id
        else None
    )
    posicion_codigo = _calcular_codigo_salida(db, salida.id)

    return SalidaResponse(
        id=str(salida.id),
        seccion_id=str(salida.seccion_id),
        etiqueta=salida.etiqueta,
        carga_valor=salida.carga_valor,
        carga_unidad=salida.carga_unidad,
        formato=salida.formato.value,
        tipo_proteccion=salida.tipo_proteccion.value,
        sensibilidad_ma=salida.sensibilidad_ma,
        admite_accesorios=salida.admite_accesorios,
        componente_id=str(salida.componente_id) if salida.componente_id else None,
        componente_codigo=componente.codigo if componente else None,
        componente_codigo_comercial=componente.codigo_comercial if componente else None,
        componente_descripcion=componente.descripcion if componente else None,
        origen=salida.origen.value,
        asignado_manualmente=salida.asignado_manualmente,
        posicion_orden=salida.posicion_orden,
        motivo_sin_match=motivo,
        alimentado_por_salida_id=str(salida.alimentado_por_salida_id) if salida.alimentado_por_salida_id else None,
        alimentado_por_codigo=alimentado_por_codigo,
        posicion_codigo=posicion_codigo,
    )


def _proponer_componente_para_salida(
    db: Session,
    tablero: Tablero,
    tipo_proteccion: TipoProteccion,
    formato: FormatoPolos,
    carga_valor: Decimal,
    carga_unidad: str,
    parametros: ParametroCalculo,
    sensibilidad_ma: int | None = None,
    admite_accesorios: bool | None = None,
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
        sensibilidad_ma=sensibilidad_ma,
        admite_accesorios=admite_accesorios,
    )
    return propuesto.id if propuesto else None


CALIBRES_VALIDOS_ABB = {
    Decimal("0.5"), Decimal("1"), Decimal("2"), Decimal("3"), Decimal("4"),
    Decimal("6"), Decimal("10"), Decimal("13"), Decimal("16"), Decimal("20"),
    Decimal("25"), Decimal("30"), Decimal("32"), Decimal("40"), Decimal("50"),
    Decimal("63"), Decimal("80"), Decimal("100"), Decimal("125")
}

def _get_polos_num(formato: FormatoPolos | str) -> int:
    val = formato.value if hasattr(formato, "value") else str(formato)
    mapping = {
        "unipolar": 1,
        "bipolar": 2,
        "tripolar": 3,
        "tetrapolar": 4,
    }
    return mapping.get(val, 1)


def _validar_limite_polos_seccion(
    db: Session,
    seccion_id: uuid.UUID,
    formato_nuevo: FormatoPolos | str,
    salida_id_omitir: uuid.UUID | None = None,
):
    query = db.query(Salida).filter(Salida.seccion_id == seccion_id)
    if salida_id_omitir:
        query = query.filter(Salida.id != salida_id_omitir)
    salidas_existentes = query.all()
    polos_actuales = sum(_get_polos_num(s.formato) for s in salidas_existentes)
    polos_nuevos = _get_polos_num(formato_nuevo)
    total_polos = polos_actuales + polos_nuevos
    if total_polos > 45:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Límite de chasis superado: La sección acumulará {total_polos} polos DIN. El límite máximo permitido por chasis Nollmann NIS es de 45 polos por fila."
        )

    # Si el tablero está en MODO MANUAL, verificar que la fila no exceda los polos admitidos por el gabinete manual
    seccion = db.get(Seccion, seccion_id)
    if seccion:
        tablero = db.get(Tablero, seccion.tablero_id)
        if tablero and tablero.gabinete_manual_ancho_mm is not None and tablero.gabinete_manual_alto_mm is not None:
            gabs = db.query(CatalogoComponente).filter(
                CatalogoComponente.categoria_raiz.ilike("%gabinete%"),
            ).all()
            gab_match = next((g for g in gabs if (g.atributos or {}).get("ancho_mm") == tablero.gabinete_manual_ancho_mm and (g.atributos or {}).get("alto_mm") == tablero.gabinete_manual_alto_mm), None)
            if gab_match:
                attrs = gab_match.atributos or {}
                paso = tablero.paso_manual or tablero.paso_mm or 150
                capacidad_linea = attrs.get("polos_linea_200", 0) if paso == 200 else attrs.get("polos_linea_150", 0)
                if capacidad_linea > 0 and total_polos > capacidad_linea:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Capacidad de fila superada: La sección acumulará {total_polos} polos DIN, pero el gabinete manual seleccionado ({tablero.gabinete_manual_ancho_mm}x{tablero.gabinete_manual_alto_mm} mm) admite un máximo de {capacidad_linea} polos por fila. Amplíe el gabinete manual o restaure la selección automática."
                    )


@router.post("/secciones/{seccion_id}/salidas", response_model=SalidaResponse, status_code=status.HTTP_201_CREATED)
def crear_salida(
    seccion_id: uuid.UUID,
    payload: SalidaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = obtener_seccion_autorizada(db, seccion_id, usuario)
    tablero = db.get(Tablero, seccion.tablero_id)

    if payload.carga_valor not in CALIBRES_VALIDOS_ABB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El calibre de carga debe ser una corriente nominal comercial estándar."
        )

    _validar_limite_polos_seccion(db, seccion_id, payload.formato)

    parametros = obtener_parametros(db)
    try:
        componente_id = _proponer_componente_para_salida(
            db,
            tablero,
            payload.tipo_proteccion,
            payload.formato,
            payload.carga_valor,
            payload.carga_unidad,
            parametros,
            sensibilidad_ma=payload.sensibilidad_ma,
            admite_accesorios=payload.admite_accesorios,
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
        sensibilidad_ma=payload.sensibilidad_ma,
        admite_accesorios=payload.admite_accesorios,
        componente_id=componente_id,
        origen=OrigenSalida.MANUAL,
        posicion_orden=nuevo_orden,
    )
    db.add(salida)
    db.commit()
    db.refresh(salida)

    # Recalcular dimensiones físicas
    calcular_dimensiones_tablero(db, seccion.tablero_id)
    db.refresh(salida)

    return _salida_response(db, salida)


class SalidaUpdate(BaseModel):
    etiqueta: str | None = None
    carga_valor: Decimal | None = None
    carga_unidad: str | None = None
    formato: FormatoPolos | None = None
    tipo_proteccion: TipoProteccion | None = None
    sensibilidad_ma: int | None = None
    admite_accesorios: bool | None = None
    componente_id: uuid.UUID | None = None
    asignado_manualmente: bool | None = None
    alimentado_por_salida_id: uuid.UUID | None = None


@router.patch("/salidas/{salida_id}", response_model=SalidaResponse)
def actualizar_salida(
    salida_id: uuid.UUID,
    payload: SalidaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida = obtener_salida_autorizada(db, salida_id, usuario)

    if payload.carga_valor is not None and payload.carga_valor not in CALIBRES_VALIDOS_ABB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El calibre de carga debe ser una corriente nominal comercial estándar."
        )

    if payload.formato is not None:
        _validar_limite_polos_seccion(db, salida.seccion_id, payload.formato, salida_id_omitir=salida.id)

    cambios = payload.model_dump(exclude_unset=True)
    campos_recalculo = (
        "carga_valor",
        "carga_unidad",
        "formato",
        "tipo_proteccion",
        "sensibilidad_ma",
        "admite_accesorios",
    )
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
    if "sensibilidad_ma" in cambios:
        salida.sensibilidad_ma = cambios["sensibilidad_ma"]
    if "admite_accesorios" in cambios:
        salida.admite_accesorios = cambios["admite_accesorios"]

    if "alimentado_por_salida_id" in cambios:
        padre_id = cambios["alimentado_por_salida_id"]
        if padre_id == salida_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Un elemento no puede alimentarse a sí mismo."
            )
        if padre_id is not None:
            padre = db.get(Salida, padre_id)
            if not padre:
                raise HTTPException(
                    status_code=status.HTTP_444_NOT_FOUND if hasattr(status, "HTTP_444_NOT_FOUND") else status.HTTP_404_NOT_FOUND,
                    detail="Salida alimentadora no encontrada.",
                )
            if padre.alimentado_por_salida_id == salida_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Enlace circular entre salidas no permitido."
                )
        salida.alimentado_por_salida_id = padre_id

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
    elif debe_recalcular:
        salida.asignado_manualmente = False
        seccion = db.get(Seccion, salida.seccion_id)
        tablero = db.get(Tablero, seccion.tablero_id)
        parametros = obtener_parametros(db)
        try:
            salida.componente_id = _proponer_componente_para_salida(
                db,
                tablero,
                salida.tipo_proteccion,
                salida.formato,
                salida.carga_valor,
                salida.carga_unidad,
                parametros,
                sensibilidad_ma=salida.sensibilidad_ma,
                admite_accesorios=salida.admite_accesorios,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db.commit()
    db.refresh(salida)

    # Recalcular dimensiones físicas
    seccion = db.get(Seccion, salida.seccion_id)
    if seccion:
        calcular_dimensiones_tablero(db, seccion.tablero_id)
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

    # Recalcular dimensiones físicas
    seccion = db.get(Seccion, salida_original.seccion_id)
    if seccion:
        calcular_dimensiones_tablero(db, seccion.tablero_id)
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
    seccion = obtener_seccion_autorizada(db, seccion_id, usuario)
    for index, salida_id in enumerate(payload.salidas_ids):
        db.query(Salida).filter(Salida.id == salida_id, Salida.seccion_id == seccion_id).update(
            {"posicion_orden": index}
        )
    db.commit()

    # Recalcular dimensiones físicas
    calcular_dimensiones_tablero(db, seccion.tablero_id)


@router.delete("/salidas/{salida_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_salida(
    salida_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida = obtener_salida_autorizada(db, salida_id, usuario)
    seccion_id = salida.seccion_id
    db.delete(salida)
    db.commit()

    # Recalcular dimensiones físicas
    seccion = db.get(Seccion, seccion_id)
    if seccion:
        calcular_dimensiones_tablero(db, seccion.tablero_id)


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


class SimularPropuestaResponse(BaseModel):
    compatible: bool
    componente_id: str | None = None
    componente_codigo: str | None = None
    motivo: str | None = None


@router.get("/secciones/{seccion_id}/simular-propuesta", response_model=SimularPropuestaResponse)
def simular_propuesta(
    seccion_id: uuid.UUID,
    formato: FormatoPolos,
    tipo_proteccion: TipoProteccion,
    carga_valor: Decimal,
    carga_unidad: str,
    sensibilidad_ma: int | None = None,
    admite_accesorios: bool | None = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    seccion = obtener_seccion_autorizada(db, seccion_id, usuario)
    tablero = db.get(Tablero, seccion.tablero_id)

    if tablero.interruptor_principal_id is None:
        return SimularPropuestaResponse(
            compatible=False,
            motivo="Debe seleccionar un interruptor principal para poder proponer un componente."
        )

    interruptor_principal = db.get(CatalogoComponente, tablero.interruptor_principal_id)
    atributos_principal = (interruptor_principal.atributos or {}) if interruptor_principal else {}
    nominal_aguas_arriba = atributos_principal.get("corriente_nominal_a")
    if nominal_aguas_arriba is None:
        return SimularPropuestaResponse(
            compatible=False,
            motivo="El interruptor principal no tiene especificada la corriente nominal."
        )

    parametros = obtener_parametros(db)
    try:
        corriente_nominal = calcular_corriente_nominal(carga_valor, carga_unidad, formato, parametros)
    except ValueError as exc:
        return SimularPropuestaResponse(
            compatible=False,
            motivo=str(exc)
        )

    propuesto, motivo = proponer_componente_con_diagnostico(
        db,
        tipo_proteccion,
        formato,
        corriente_nominal,
        tablero.nivel_falla_ka,
        Decimal(str(nominal_aguas_arriba)),
        parametros,
        sensibilidad_ma=sensibilidad_ma,
        admite_accesorios=admite_accesorios,
    )

    return SimularPropuestaResponse(
        compatible=propuesto is not None,
        componente_id=str(propuesto.id) if propuesto else None,
        componente_codigo=propuesto.codigo if propuesto else None,
        motivo=motivo
    )
