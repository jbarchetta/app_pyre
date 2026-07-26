import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.ownership import (
    obtener_proyecto_autorizado,
    obtener_tablero_autorizado,
)
from app.database import get_db
from app.models import (
    BomLinea,
    CatalogoComponente,
    Proyecto,
    Salida,
    Seccion,
    Tablero,
    TableroAccesorioPrincipal,
    Usuario,
)

router = APIRouter(tags=["bom"])


class BomLineaItemResponse(BaseModel):
    id: str
    tablero_id: str
    componente_id: str
    componente_codigo: str
    componente_codigo_comercial: str | None
    componente_descripcion: str
    componente_categoria: str | None
    cantidad: int
    precio_unitario_congelado: Decimal
    subtotal: Decimal
    creado_en: datetime


class BomResumenTableroResponse(BaseModel):
    tablero_id: str
    tablero_nombre: str
    lineas: list[BomLineaItemResponse]
    total_items_count: int
    costo_total: Decimal
    fecha_congelamiento: datetime | None


class BomResumenProyectoResponse(BaseModel):
    proyecto_id: str
    proyecto_nombre: str
    tableros: list[BomResumenTableroResponse]
    costo_total_proyecto: Decimal


def _construir_linea_response(linea: BomLinea, comp: CatalogoComponente | None) -> BomLineaItemResponse:
    prec = linea.precio_unitario_congelado or Decimal("0.00")
    subtotal = prec * linea.cantidad
    cat = None
    if comp and comp.categoria_path and len(comp.categoria_path) > 0:
        cat = comp.categoria_path[0]

    return BomLineaItemResponse(
        id=str(linea.id),
        tablero_id=str(linea.tablero_id),
        componente_id=str(linea.componente_id),
        componente_codigo=comp.codigo if comp else "N/A",
        componente_codigo_comercial=comp.codigo_comercial if comp else None,
        componente_descripcion=comp.descripcion if comp else "Componente no encontrado",
        componente_categoria=cat,
        cantidad=linea.cantidad,
        precio_unitario_congelado=prec,
        subtotal=subtotal,
        creado_en=linea.creado_en,
    )


def _construir_resumen_tablero(tablero: Tablero, db: Session) -> BomResumenTableroResponse:
    lineas_db = (
        db.query(BomLinea)
        .filter(BomLinea.tablero_id == tablero.id)
        .order_by(BomLinea.creado_en.asc())
        .all()
    )

    if not lineas_db:
        return BomResumenTableroResponse(
            tablero_id=str(tablero.id),
            tablero_nombre=tablero.nombre,
            lineas=[],
            total_items_count=0,
            costo_total=Decimal("0.00"),
            fecha_congelamiento=None,
        )

    comp_ids = {l.componente_id for l in lineas_db}
    componentes_dict = {
        c.id: c
        for c in db.query(CatalogoComponente).filter(CatalogoComponente.id.in_(comp_ids)).all()
    }

    lineas_resp: list[BomLineaItemResponse] = []
    costo_total = Decimal("0.00")
    fecha_cong = lineas_db[0].creado_en if lineas_db else None

    for l in lineas_db:
        comp = componentes_dict.get(l.componente_id)
        item = _construir_linea_response(l, comp)
        lineas_resp.append(item)
        costo_total += item.subtotal

    total_count = sum(l.cantidad for l in lineas_resp)

    return BomResumenTableroResponse(
        tablero_id=str(tablero.id),
        tablero_nombre=tablero.nombre,
        lineas=lineas_resp,
        total_items_count=total_count,
        costo_total=costo_total,
        fecha_congelamiento=fecha_cong,
    )


@router.post("/tableros/{tablero_id}/bom/generar", response_model=BomResumenTableroResponse)
def generar_bom_tablero(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)

    # 1. Recolectar componentes asignados al tablero
    cantidades: dict[uuid.UUID, int] = {}

    def _sumar_componente(c_id: uuid.UUID | None, cant: int = 1):
        if not c_id:
            return
        cantidades[c_id] = cantidades.get(c_id, 0) + cant

    # Interruptor Principal
    _sumar_componente(tablero.interruptor_principal_id, 1)

    # Accesorios Principales
    accesorios = (
        db.query(TableroAccesorioPrincipal)
        .filter(TableroAccesorioPrincipal.tablero_id == tablero.id)
        .all()
    )
    for acc in accesorios:
        _sumar_componente(acc.componente_id, 1)

    # Salidas de todas las secciones
    secciones = db.query(Seccion).filter(Seccion.tablero_id == tablero.id).all()
    seccion_ids = [s.id for s in secciones]

    if seccion_ids:
        salidas = db.query(Salida).filter(Salida.seccion_id.in_(seccion_ids)).all()
        for sal in salidas:
            _sumar_componente(sal.componente_id, 1)

    # Gabinete y Distribuidor Sugerido
    _sumar_componente(tablero.gabinete_sugerido_id, 1)
    _sumar_componente(tablero.distribuidor_sugerido_id, 1)

    # 2. Eliminar líneas existentes de BOM para este tablero
    db.query(BomLinea).filter(BomLinea.tablero_id == tablero.id).delete(synchronize_session=False)

    # 3. Consultar componentes del catálogo para congelar sus precios
    if cantidades:
        comp_ids = list(cantidades.keys())
        comps = db.query(CatalogoComponente).filter(CatalogoComponente.id.in_(comp_ids)).all()
        comps_dict = {c.id: c for c in comps}

        ahora = datetime.utcnow()
        nuevas_lineas: list[BomLinea] = []

        for c_id, cant in cantidades.items():
            comp = comps_dict.get(c_id)
            if not comp:
                continue
            prec = comp.precio_neto if comp.precio_neto is not None else Decimal("0.00")
            nueva_linea = BomLinea(
                id=uuid.uuid4(),
                tablero_id=tablero.id,
                componente_id=comp.id,
                cantidad=cant,
                precio_unitario_congelado=prec,
                creado_en=ahora,
            )
            nuevas_lineas.append(nueva_linea)

        db.add_all(nuevas_lineas)

    db.commit()

    return _construir_resumen_tablero(tablero, db)


@router.get("/tableros/{tablero_id}/bom", response_model=BomResumenTableroResponse)
def obtener_bom_tablero(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)
    return _construir_resumen_tablero(tablero, db)


@router.get("/proyectos/{proyecto_id}/bom", response_model=BomResumenProyectoResponse)
def obtener_bom_proyecto(
    proyecto_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    proyecto = obtener_proyecto_autorizado(db, proyecto_id, usuario)
    tableros = (
        db.query(Tablero)
        .filter(Tablero.proyecto_id == proyecto.id)
        .order_by(Tablero.nombre.asc())
        .all()
    )

    tableros_resp: list[BomResumenTableroResponse] = []
    costo_total_proj = Decimal("0.00")

    for t in tableros:
        t_resumen = _construir_resumen_tablero(t, db)
        tableros_resp.append(t_resumen)
        costo_total_proj += t_resumen.costo_total

    return BomResumenProyectoResponse(
        proyecto_id=str(proyecto.id),
        proyecto_nombre=proyecto.nombre,
        tableros=tableros_resp,
        costo_total_proyecto=costo_total_proj,
    )


@router.delete("/tableros/{tablero_id}/bom", status_code=status.HTTP_204_NO_CONTENT)
def limpiar_bom_tablero(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    tablero = obtener_tablero_autorizado(db, tablero_id, usuario)
    db.query(BomLinea).filter(BomLinea.tablero_id == tablero.id).delete(synchronize_session=False)
    db.commit()
    return None
