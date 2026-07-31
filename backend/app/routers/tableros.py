import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.ownership import (
    obtener_proyecto_autorizado,
    obtener_seccion_autorizada,
    obtener_tablero_autorizado,
)
from app.catalogo.queries import componentes_por_id
from app.database import get_db
from app.models import (
    BomLinea,
    CatalogoComponente,
    Proyecto,
    RolUsuario,
    Salida,
    Seccion,
    Tablero,
    Usuario,
    TableroAccesorioPrincipal,
    ReglaCablecanal,
)
from app.routers.paginacion import LIMITE_POR_DEFECTO, acotar_paginacion
from app.motor.motor_reglas import calcular_dimensiones_tablero

router = APIRouter(tags=["tableros"])


class TableroCreate(BaseModel):
    nombre: str
    nivel_falla_ka: Decimal
    interruptor_principal_id: uuid.UUID | None = None
    principal_metodo_entrada: str | None = "cable"
    principal_metodo_salida: str | None = "barra_distribucion"
    borneras_tipo: str | None = "ninguno"
    lleva_banquitos: bool = False
    porcentaje_reserva: int = 0


class TableroResponse(BaseModel):
    id: str
    proyecto_id: str
    nombre: str
    nivel_falla_ka: Decimal
    interruptor_principal_id: str | None
    interruptor_principal_codigo: str | None
    interruptor_principal_codigo_comercial: str | None
    interruptor_principal_descripcion: str | None = None
    interruptor_principal_polos: int | None = None
    interruptor_principal_corriente_nominal_a: Decimal | None = None
    interruptor_principal_capacidad_corte_ka: Decimal | None = None
    principal_metodo_entrada: str | None
    principal_metodo_salida: str | None
    borneras_tipo: str | None
    lleva_banquitos: bool
    porcentaje_reserva: int
    gabinete_sugerido_id: str | None = None
    gabinete_sugerido_codigo: str | None = None
    gabinete_sugerido_ancho_mm: int | None = None
    gabinete_sugerido_alto_mm: int | None = None
    porcentaje_ocupacion: float | None = None
    excede_largo_riel: bool | None = None
    max_polos_por_fila: int | None = None
    capacidad_polos_linea: int | None = None
    siguiente_gabinete_ancho_mm: int | None = None
    distribuidor_sugerido_id: str | None = None
    distribuidor_sugerido_codigo: str | None = None
    cablecanal_sugerido: str | None = None
    paso_mm: int
    paso_manual: int | None = None
    gabinete_manual_ancho_mm: int | None = None
    gabinete_manual_alto_mm: int | None = None

    model_config = {"from_attributes": True}


def _tablero_response(db: Session, tablero: Tablero, componente: CatalogoComponente | None = None) -> TableroResponse:
    if componente is None and tablero.interruptor_principal_id:
        componente = db.get(CatalogoComponente, tablero.interruptor_principal_id)
    atributos = componente.atributos or {} if componente else {}

    gabinete_codigo = None
    gabinete_ancho = None
    gabinete_alto = None
    porcentaje_ocupacion = None
    excede_largo_riel = None
    max_polos_por_fila = None
    capacidad_polos_linea = None
    siguiente_ancho = None

    if tablero.gabinete_sugerido_id:
        gab = db.get(CatalogoComponente, tablero.gabinete_sugerido_id)
        if gab and gab.atributos:
            gabinete_codigo = gab.codigo
            gabinete_ancho = gab.atributos.get("ancho_mm")
            gabinete_alto = gab.atributos.get("alto_mm")
            capacidad_total_gab = gab.atributos.get("total_polos_200", 0) if tablero.paso_mm == 200 else gab.atributos.get("total_polos_150", 0)
            capacidad_polos_linea = gab.atributos.get("polos_linea_200", 0) if tablero.paso_mm == 200 else gab.atributos.get("polos_linea_150", 0)
            ancho_actual = gabinete_ancho or 600
            anchos_disponibles = [300, 450, 600, 750, 1000]
            siguiente_ancho = next((w for w in anchos_disponibles if w > ancho_actual), ancho_actual)

    distribuidor_codigo = None
    if tablero.distribuidor_sugerido_id:
        dist = db.get(CatalogoComponente, tablero.distribuidor_sugerido_id)
        if dist:
            distribuidor_codigo = dist.codigo

    return TableroResponse(
        id=str(tablero.id),
        proyecto_id=str(tablero.proyecto_id),
        nombre=tablero.nombre,
        nivel_falla_ka=tablero.nivel_falla_ka,
        interruptor_principal_id=str(tablero.interruptor_principal_id)
        if tablero.interruptor_principal_id
        else None,
        interruptor_principal_codigo=componente.codigo if componente else None,
        interruptor_principal_codigo_comercial=componente.codigo_comercial if componente else None,
        interruptor_principal_descripcion=componente.descripcion if componente else None,
        interruptor_principal_polos=atributos.get("polos"),
        interruptor_principal_corriente_nominal_a=Decimal(str(atributos["corriente_nominal_a"]))
        if "corriente_nominal_a" in atributos and atributos["corriente_nominal_a"] is not None
        else None,
        interruptor_principal_capacidad_corte_ka=Decimal(str(atributos["capacidad_corte_ka"]))
        if "capacidad_corte_ka" in atributos and atributos["capacidad_corte_ka"] is not None
        else None,
        principal_metodo_entrada=tablero.principal_metodo_entrada,
        principal_metodo_salida=tablero.principal_metodo_salida,
        borneras_tipo=tablero.borneras_tipo,
        lleva_banquitos=tablero.lleva_banquitos,
        porcentaje_reserva=tablero.porcentaje_reserva,
        gabinete_sugerido_id=str(tablero.gabinete_sugerido_id) if tablero.gabinete_sugerido_id else None,
        gabinete_sugerido_codigo=gabinete_codigo,
        gabinete_sugerido_ancho_mm=gabinete_ancho,
        gabinete_sugerido_alto_mm=gabinete_alto,
        porcentaje_ocupacion=porcentaje_ocupacion,
        excede_largo_riel=excede_largo_riel,
        max_polos_por_fila=max_polos_por_fila,
        capacidad_polos_linea=capacidad_polos_linea,
        siguiente_gabinete_ancho_mm=siguiente_ancho,
        distribuidor_sugerido_id=str(tablero.distribuidor_sugerido_id) if tablero.distribuidor_sugerido_id else None,
        distribuidor_sugerido_codigo=distribuidor_codigo,
        cablecanal_sugerido=tablero.cablecanal_sugerido,
        paso_mm=tablero.paso_mm,
        paso_manual=tablero.paso_manual,
    )


@router.post(
    "/proyectos/{proyecto_id}/tableros", response_model=TableroResponse, status_code=status.HTTP_201_CREATED
)
def crear_tablero(
    proyecto_id: uuid.UUID,
    payload: TableroCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    obtener_proyecto_autorizado(db, proyecto_id, usuario)

    tablero = Tablero(
        proyecto_id=proyecto_id,
        nombre=payload.nombre,
        nivel_falla_ka=payload.nivel_falla_ka,
        interruptor_principal_id=payload.interruptor_principal_id,
        principal_metodo_entrada=payload.principal_metodo_entrada,
        principal_metodo_salida=payload.principal_metodo_salida,
        borneras_tipo=payload.borneras_tipo,
        lleva_banquitos=payload.lleva_banquitos,
        porcentaje_reserva=payload.porcentaje_reserva,
    )
    db.add(tablero)
    db.commit()
    db.refresh(tablero)

    # Calcular dimensiones físicas iniciales
    calcular_dimensiones_tablero(db, tablero.id)
    db.refresh(tablero)
    return _tablero_response(db, tablero)


@router.get("/proyectos/{proyecto_id}/tableros", response_model=list[TableroResponse])
def listar_tableros(
    proyecto_id: uuid.UUID,
    limit: int = LIMITE_POR_DEFECTO,
    offset: int = 0,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    obtener_proyecto_autorizado(db, proyecto_id, usuario)
    limit, offset = acotar_paginacion(limit, offset)
    tableros = (
        db.query(Tablero)
        .filter(Tablero.proyecto_id == proyecto_id)
        .order_by(Tablero.creado_en, Tablero.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    # Batch fetch de interruptores principales: 1 query IN en vez de un db.get por tablero.
    componentes = componentes_por_id(db, {t.interruptor_principal_id for t in tableros if t.interruptor_principal_id})
    return [_tablero_response(db, t, componentes.get(t.interruptor_principal_id)) for t in tableros]


@router.get("/tableros/{tablero_id}", response_model=TableroResponse)
def obtener_tablero(
    tablero_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    return _tablero_response(db, obtener_tablero_autorizado(db, tablero_id, usuario))


class TableroUpdate(BaseModel):
    nombre: str | None = None
    nivel_falla_ka: Decimal | None = None
    interruptor_principal_id: uuid.UUID | None = None
    principal_metodo_entrada: str | None = None
    principal_metodo_salida: str | None = None
    borneras_tipo: str | None = None
    lleva_banquitos: bool | None = None
    porcentaje_reserva: int | None = None
    paso_manual: int | None = None
    gabinete_manual_ancho_mm: int | None = None
    gabinete_manual_alto_mm: int | None = None
    cablecanal_sugerido: str | None = None


@router.patch("/tableros/{tablero_id}", response_model=TableroResponse)
def actualizar_tablero(
    tablero_id: uuid.UUID,
    payload: TableroUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)

    # exclude_unset: un PATCH solo toca los campos que el cliente mandó — mandar
    # nivel_falla_ka sin interruptor_principal_id no debe borrar este último.
    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        tablero.nombre = cambios["nombre"]
    if "nivel_falla_ka" in cambios:
        tablero.nivel_falla_ka = cambios["nivel_falla_ka"]
    if "interruptor_principal_id" in cambios:
        viejo_id = tablero.interruptor_principal_id
        tablero.interruptor_principal_id = cambios["interruptor_principal_id"]
        # Limpiar accesorios de principal residuales que sean interruptores
        if viejo_id and viejo_id != cambios["interruptor_principal_id"]:
            db.query(TableroAccesorioPrincipal).filter(
                TableroAccesorioPrincipal.tablero_id == tablero.id,
                TableroAccesorioPrincipal.componente_id == viejo_id
            ).delete(synchronize_session=False)
    if "principal_metodo_entrada" in cambios:
        tablero.principal_metodo_entrada = cambios["principal_metodo_entrada"]
    if "principal_metodo_salida" in cambios:
        tablero.principal_metodo_salida = cambios["principal_metodo_salida"]
    if "borneras_tipo" in cambios:
        tablero.borneras_tipo = cambios["borneras_tipo"]
    if "lleva_banquitos" in cambios:
        tablero.lleva_banquitos = cambios["lleva_banquitos"]
    if "porcentaje_reserva" in cambios:
        tablero.porcentaje_reserva = cambios["porcentaje_reserva"]
    if "paso_manual" in cambios:
        tablero.paso_manual = cambios["paso_manual"]
    if "gabinete_manual_ancho_mm" in cambios:
        tablero.gabinete_manual_ancho_mm = cambios["gabinete_manual_ancho_mm"]
    if "gabinete_manual_alto_mm" in cambios:
        tablero.gabinete_manual_alto_mm = cambios["gabinete_manual_alto_mm"]
    if "cablecanal_sugerido" in cambios:
        tablero.cablecanal_sugerido = cambios["cablecanal_sugerido"]

    db.commit()

    # Recalcular dimensiones físicas
    calcular_dimensiones_tablero(db, tablero.id)
    db.refresh(tablero)
    return _tablero_response(db, tablero)


@router.delete("/tableros/{tablero_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tablero(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)

    db.query(BomLinea).filter(BomLinea.tablero_id == tablero_id).delete(synchronize_session=False)
    seccion_ids = [s.id for s in db.query(Seccion.id).filter(Seccion.tablero_id == tablero_id)]
    if seccion_ids:
        db.query(Salida).filter(Salida.seccion_id.in_(seccion_ids)).delete(synchronize_session=False)
        db.query(Seccion).filter(Seccion.id.in_(seccion_ids)).delete(synchronize_session=False)

    db.delete(tablero)
    db.commit()


class SeccionCreate(BaseModel):
    nombre: str
    orden: int = 0


class SeccionResponse(BaseModel):
    id: str
    tablero_id: str
    nombre: str
    orden: int
    paso_mm: int
    paso_manual: int | None = None

    model_config = {"from_attributes": True}


def _seccion_response(seccion: Seccion) -> SeccionResponse:
    return SeccionResponse(
        id=str(seccion.id),
        tablero_id=str(seccion.tablero_id),
        nombre=seccion.nombre,
        orden=seccion.orden,
        paso_mm=seccion.paso_mm,
        paso_manual=seccion.paso_manual,
    )


@router.post("/tableros/{tablero_id}/secciones", response_model=SeccionResponse, status_code=status.HTTP_201_CREATED)
def crear_seccion(
    tablero_id: uuid.UUID,
    payload: SeccionCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)

    tiene_principal = tablero.interruptor_principal_id is not None
    secciones_count = db.query(Seccion).filter(Seccion.tablero_id == tablero_id).count()
    total_filas = (1 if tiene_principal else 0) + secciones_count + 1
    if total_filas > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Límite de chasis superado: El tablero acumulará {total_filas} filas. El gabinete Nollmann NIS de mayor capacidad admite un máximo de 12 filas (Paso 150) / 9 filas (Paso 200)."
        )

    seccion = Seccion(tablero_id=tablero_id, nombre=payload.nombre, orden=payload.orden)
    db.add(seccion)
    db.commit()
    db.refresh(seccion)

    # Recalcular dimensiones físicas
    calcular_dimensiones_tablero(db, tablero_id)
    db.refresh(seccion)
    return _seccion_response(seccion)


@router.get("/tableros/{tablero_id}/secciones", response_model=list[SeccionResponse])
def listar_secciones(
    tablero_id: uuid.UUID,
    limit: int = LIMITE_POR_DEFECTO,
    offset: int = 0,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    obtener_tablero_autorizado(db, tablero_id, usuario)
    limit, offset = acotar_paginacion(limit, offset)
    secciones = (
        db.query(Seccion)
        .filter(Seccion.tablero_id == tablero_id)
        .order_by(Seccion.orden, Seccion.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_seccion_response(s) for s in secciones]


class SeccionUpdate(BaseModel):
    nombre: str | None = None
    paso_manual: int | None = None


@router.patch("/secciones/{seccion_id}", response_model=SeccionResponse)
def actualizar_seccion(
    seccion_id: uuid.UUID,
    payload: SeccionUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = obtener_seccion_autorizada(db, seccion_id, usuario)

    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        seccion.nombre = cambios["nombre"]
    if "paso_manual" in cambios:
        seccion.paso_manual = cambios["paso_manual"]

    db.commit()

    # Recalcular dimensiones físicas
    calcular_dimensiones_tablero(db, seccion.tablero_id)
    db.refresh(seccion)
    return _seccion_response(seccion)


@router.delete("/secciones/{seccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_seccion(
    seccion_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = obtener_seccion_autorizada(db, seccion_id, usuario)
    tablero_id = seccion.tablero_id

    db.query(Salida).filter(Salida.seccion_id == seccion_id).delete(synchronize_session=False)
    db.delete(seccion)
    db.commit()

    # Recalcular dimensiones físicas
    calcular_dimensiones_tablero(db, tablero_id)


# Models for ReglaCablecanal
class ReglaCablecanalCreate(BaseModel):
    corriente_minima: Decimal
    corriente_maxima: Decimal
    medida_cablecanal: str


class ReglaCablecanalResponse(BaseModel):
    id: uuid.UUID
    corriente_minima: Decimal
    corriente_maxima: Decimal
    medida_cablecanal: str

    model_config = {"from_attributes": True}


# Endpoint to list rules
@router.get("/config/reglas-cablecanal", response_model=list[ReglaCablecanalResponse])
def listar_reglas_cablecanal(db: Session = Depends(get_db)):
    return db.query(ReglaCablecanal).order_by(ReglaCablecanal.corriente_minima).all()


# Endpoint to create rule
@router.post("/config/reglas-cablecanal", response_model=ReglaCablecanalResponse, status_code=status.HTTP_201_CREATED)
def crear_regla_cablecanal(
    payload: ReglaCablecanalCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    regla = ReglaCablecanal(
        corriente_minima=payload.corriente_minima,
        corriente_maxima=payload.corriente_maxima,
        medida_cablecanal=payload.medida_cablecanal,
    )
    db.add(regla)
    db.commit()
    db.refresh(regla)
    return regla


# Endpoint to delete rule
@router.delete("/config/reglas-cablecanal/{regla_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_regla_cablecanal(
    regla_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    regla = db.get(ReglaCablecanal, regla_id)
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    db.delete(regla)
    db.commit()


# Pydantic schema for component response (simplified)
class ComponenteBusquedaResponse(BaseModel):
    id: uuid.UUID
    codigo: str
    codigo_comercial: str | None
    descripcion: str
    precio_neto: Decimal | None
    categoria_path: list

    model_config = {"from_attributes": True}


# Helper function to auto-suggest accessories based on main switch
def _obtener_accesorios_sugeridos(db: Session, main_switch: CatalogoComponente) -> dict:
    import re
    # Extract family like XT1, XT2, XT3, XT4, XT5, XT6, XT7
    match = re.search(r"XT\d", main_switch.descripcion or "")
    if not match:
        match = re.search(r"XT\d", main_switch.codigo_comercial or "")

    fam = match.group(0) if match else None
    if not fam:
        return {
            "motorizacion": None,
            "bobina_apertura": None,
            "bobina_cero_tension": None,
            "contactos_auxiliares": None,
        }

    # Find motorization
    motor = (
        db.query(CatalogoComponente)
        .filter(
            CatalogoComponente.descripcion.ilike(f"%{fam}%"),
            CatalogoComponente.descripcion.ilike("%mando%"),
            CatalogoComponente.descripcion.ilike("%motor%"),
        )
        .first()
    )

    # Find bobina de apertura (shunt trip)
    shunt = (
        db.query(CatalogoComponente)
        .filter(
            CatalogoComponente.descripcion.ilike(f"%{fam}%"),
            CatalogoComponente.descripcion.ilike("%apertura%"),
        )
        .first()
    )

    # Find bobina de cero tension (undervoltage coil)
    uvr = (
        db.query(CatalogoComponente)
        .filter(
            CatalogoComponente.descripcion.ilike(f"%{fam}%"),
            CatalogoComponente.descripcion.ilike("%mínima%"),
            CatalogoComponente.descripcion.ilike("%tensi%"),
        )
        .first()
    )

    # Find auxiliary contacts
    aux = (
        db.query(CatalogoComponente)
        .filter(
            CatalogoComponente.descripcion.ilike(f"%{fam}%"),
            CatalogoComponente.descripcion.ilike("%contacto%"),
            CatalogoComponente.descripcion.ilike("%auxiliar%"),
        )
        .first()
    )

    return {
        "motorizacion": ComponenteBusquedaResponse.model_validate(motor) if motor else None,
        "bobina_apertura": ComponenteBusquedaResponse.model_validate(shunt) if shunt else None,
        "bobina_cero_tension": ComponenteBusquedaResponse.model_validate(uvr) if uvr else None,
        "contactos_auxiliares": ComponenteBusquedaResponse.model_validate(aux) if aux else None,
    }


# Endpoints for Accessories
@router.get("/tableros/{tablero_id}/accesorios-sugeridos")
def obtener_accesorios_sugeridos(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)
    if not tablero.interruptor_principal_id:
        return {
            "motorizacion": None,
            "bobina_apertura": None,
            "bobina_cero_tension": None,
            "contactos_auxiliares": None,
        }
    main_switch = db.get(CatalogoComponente, tablero.interruptor_principal_id)
    if not main_switch:
        return {
            "motorizacion": None,
            "bobina_apertura": None,
            "bobina_cero_tension": None,
            "contactos_auxiliares": None,
        }
    return _obtener_accesorios_sugeridos(db, main_switch)


@router.get("/tableros/{tablero_id}/accesorios", response_model=list[ComponenteBusquedaResponse])
def listar_accesorios_principal(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    obtener_tablero_autorizado(db, tablero_id, usuario)
    accesorios = (
        db.query(CatalogoComponente)
        .join(TableroAccesorioPrincipal, TableroAccesorioPrincipal.componente_id == CatalogoComponente.id)
        .filter(TableroAccesorioPrincipal.tablero_id == tablero_id)
        .all()
    )
    return accesorios


class AsociarAccesorioRequest(BaseModel):
    componente_id: uuid.UUID


@router.post("/tableros/{tablero_id}/accesorios", response_model=ComponenteBusquedaResponse)
def asociar_accesorio_principal(
    tablero_id: uuid.UUID,
    payload: AsociarAccesorioRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)
    componente = db.get(CatalogoComponente, payload.componente_id)
    if not componente:
        raise HTTPException(status_code=404, detail="Componente no encontrado")

    # Check if already associated
    exists = (
        db.query(TableroAccesorioPrincipal)
        .filter(
            TableroAccesorioPrincipal.tablero_id == tablero_id,
            TableroAccesorioPrincipal.componente_id == payload.componente_id,
        )
        .first()
    )

    if not exists:
        asoc = TableroAccesorioPrincipal(tablero_id=tablero_id, componente_id=payload.componente_id)
        db.add(asoc)
        db.commit()

    return componente


@router.delete("/tableros/{tablero_id}/accesorios/{componente_id}", status_code=status.HTTP_204_NO_CONTENT)
def desasociar_accesorio_principal(
    tablero_id: uuid.UUID,
    componente_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)
    db.query(TableroAccesorioPrincipal).filter(
        TableroAccesorioPrincipal.tablero_id == tablero_id,
        TableroAccesorioPrincipal.componente_id == componente_id,
    ).delete()
    db.commit()
