import io
import zipfile
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import and_, case, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.catalogo.parser_abb import parse_abb_workbook
from app.catalogo.parser_otros import parse_otros_workbook
from app.catalogo.upsert import upsert_componentes
from app.database import get_db
from app.models import CatalogoComponente, RolUsuario, Usuario

router = APIRouter(prefix="/catalogo", tags=["catalogo"])

PARSERS = {
    "abb": parse_abb_workbook,
    "otros": parse_otros_workbook,
}


@router.post("/importar")
async def importar_catalogo(
    proveedor: str = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    parser = PARSERS.get(proveedor)
    if parser is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Proveedor desconocido: {proveedor}"
        )

    contenido = await archivo.read()
    try:
        items = parser(io.BytesIO(contenido), archivo_origen=archivo.filename)
    except (ValueError, KeyError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return upsert_componentes(db, items, usuario_id=usuario.id)


class ComponenteBusquedaResponse(BaseModel):
    id: str
    codigo: str
    codigo_comercial: str | None
    descripcion: str
    precio_neto: Decimal | None

    model_config = {"from_attributes": True}


class BusquedaCatalogoResponse(BaseModel):
    resultados: list[ComponenteBusquedaResponse]
    total: int


_LIMIT_MAXIMO = 50
_LIMIT_POR_DEFECTO = 20


@router.get("/buscar", response_model=BusquedaCatalogoResponse)
def buscar_componentes(
    q: str = "",
    categorias: list[str] | None = Query(default=None),
    solo_con_atributos: bool = False,
    polos: int | None = None,
    corriente_nominal_a: Decimal | None = None,
    capacidad_corte_ka: Decimal | None = None,
    limit: int = _LIMIT_POR_DEFECTO,
    offset: int = 0,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    limit = min(max(limit, 1), _LIMIT_MAXIMO)
    offset = max(offset, 0)

    if len(q.strip()) < 2:
        return BusquedaCatalogoResponse(resultados=[], total=0)

    termino_limpio = q.strip()
    termino = f"%{termino_limpio}%"
    prefijo = f"{termino_limpio}%"

    # Relevancia: coincidencia de prefijo en el código interno primero, después
    # en el código comercial, cualquier otra coincidencia (ej. en la
    # descripción) al final. Los índices GIN de trigramas (migración
    # <rev>_pg_trgm_catalogo_busqueda) aceleran tanto el filtro ILIKE '%...%'
    # como este ranking sobre las ~10k filas del catálogo real.
    relevancia = case(
        (CatalogoComponente.codigo.ilike(prefijo), 0),
        (CatalogoComponente.codigo_comercial.ilike(prefijo), 1),
        else_=2,
    )

    filtro = or_(
        CatalogoComponente.codigo.ilike(termino),
        CatalogoComponente.codigo_comercial.ilike(termino),
        CatalogoComponente.descripcion.ilike(termino),
    )
    if categorias:
        # Filtro maestro no editable por el analista -- acota la búsqueda a
        # las categorías relevantes del contexto (ej. solo interruptores),
        # en vez de barrer las ~9-10k filas de todo el catálogo real.
        filtro = and_(filtro, CatalogoComponente.categoria_raiz.in_(categorias))
    if solo_con_atributos:
        # Saca del medio filas sin polos/In/capacidad de corte extraídos --
        # en la práctica esto son accesorios (terminales, mandos, bloqueos)
        # que comparten categoria_raiz con interruptores reales, más el
        # pequeño % de interruptores reales sin atributos extraídos (ver
        # docs/consultas_ingenieria.md #1). Opt-in: no cambia el
        # comportamiento por defecto para futuros contextos de búsqueda que
        # sí quieran ver filas sin atributos.
        filtro = and_(filtro, CatalogoComponente.atributos.isnot(None))
    if polos is not None:
        filtro = and_(filtro, CatalogoComponente.atributos["polos"].as_integer() == polos)
    if corriente_nominal_a is not None:
        filtro = and_(
            filtro, CatalogoComponente.atributos["corriente_nominal_a"].as_float() == float(corriente_nominal_a)
        )
    if capacidad_corte_ka is not None:
        filtro = and_(
            filtro, CatalogoComponente.atributos["capacidad_corte_ka"].as_float() == float(capacidad_corte_ka)
        )

    # Nota: esto ejecuta una segunda query completa (además de la paginada de
    # abajo) en cada búsqueda -- a la escala actual del catálogo (~9-10k
    # filas) es aceptable, pero si ComponentePicker suma debounce (ver plan de
    # UX) o el catálogo crece mucho más, vale la pena revisar si hace falta
    # (ej. limit+1 con un booleano has_more en vez de un total exacto).
    total = db.query(CatalogoComponente).filter(filtro).count()

    componentes = (
        db.query(CatalogoComponente)
        .filter(filtro)
        .order_by(relevancia, CatalogoComponente.codigo, CatalogoComponente.id)
        .offset(offset)
        .limit(limit)
        .all()
    )

    return BusquedaCatalogoResponse(
        resultados=[
            ComponenteBusquedaResponse(
                id=str(c.id),
                codigo=c.codigo,
                codigo_comercial=c.codigo_comercial,
                descripcion=c.descripcion,
                precio_neto=c.precio_neto,
            )
            for c in componentes
        ],
        total=total,
    )


class OpcionesFiltroResponse(BaseModel):
    polos: list[int]
    corrientes_nominales_a: list[Decimal]
    capacidades_corte_ka: list[Decimal]


def _decimal_sin_ruido_de_float(valor: float) -> Decimal:
    # atributos["x"].as_float() castea el JSONB a double precision, así que un
    # valor guardado como entero (16) vuelve como 16.0. Decimal(str(16.0))
    # arrastraría ese ".0" hasta el JSON de respuesta ("16.0"), que no es como
    # se quiere mostrar en un dropdown. Redondeamos a entero cuando el valor
    # no tiene parte fraccionaria real, sin pasar por Decimal.normalize() (que
    # para números redondos como 100 produce notación científica "1E+2").
    decimal = Decimal(str(valor))
    entero = decimal.to_integral_value()
    return entero if decimal == entero else decimal


@router.get("/opciones-filtro", response_model=OpcionesFiltroResponse)
def obtener_opciones_filtro(
    categorias: list[str] | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    # Los valores de cada select se derivan de lo que realmente hay en el
    # catálogo -- no hay una lista hardcodeada que mantener, se autoactualiza
    # con cada reimport. Siempre exige atributos poblados: sin eso no hay
    # nada que ofrecer como opción de filtro.
    filtro = CatalogoComponente.atributos.isnot(None)
    if categorias:
        filtro = and_(filtro, CatalogoComponente.categoria_raiz.in_(categorias))

    polos_rows = db.query(CatalogoComponente.atributos["polos"].as_integer()).filter(filtro).distinct().all()
    corrientes_rows = (
        db.query(CatalogoComponente.atributos["corriente_nominal_a"].as_float()).filter(filtro).distinct().all()
    )
    capacidades_rows = (
        db.query(CatalogoComponente.atributos["capacidad_corte_ka"].as_float()).filter(filtro).distinct().all()
    )

    polos = sorted({r[0] for r in polos_rows if r[0] is not None})
    corrientes = sorted({_decimal_sin_ruido_de_float(r[0]) for r in corrientes_rows if r[0] is not None})
    capacidades = sorted({_decimal_sin_ruido_de_float(r[0]) for r in capacidades_rows if r[0] is not None})

    return OpcionesFiltroResponse(polos=polos, corrientes_nominales_a=corrientes, capacidades_corte_ka=capacidades)
