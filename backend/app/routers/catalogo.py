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

# El catálogo real de ABB pesa ~2 MB; 20 MB es margen más que suficiente para
# cualquier lista de precios razonable y protege al worker de uploads abusivos.
_TAMANO_MAXIMO_UPLOAD_BYTES = 20 * 1024 * 1024

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

    # Validaciones previas al parseo (ciclo 8): el archivo se lee completo a
    # memoria, así que hay que acotar tamaño antes de hacerlo; y todo .xlsx es
    # un ZIP con firma PK\x03\x04 — rechaza temprano archivos renombrados, .xls
    # viejo (OLE2) y basura binaria, con un mensaje claro en vez del error de
    # zipfile/openpyxl.
    contenido = await archivo.read(_TAMANO_MAXIMO_UPLOAD_BYTES + 1)
    if len(contenido) > _TAMANO_MAXIMO_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el máximo permitido de 20 MB",
        )
    if not contenido.startswith(b"PK\x03\x04"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no es un Excel .xlsx válido",
        )
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
    tipo: str | None = None,
    polos: int | None = None,
    corriente_nominal_a: Decimal | None = None,
    capacidad_corte_ka: Decimal | None = None,
    sensibilidad_ma: int | None = None,
    admite_accesorios: bool | None = None,
    limit: int = _LIMIT_POR_DEFECTO,
    offset: int = 0,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    limit = min(max(limit, 1), _LIMIT_MAXIMO)
    offset = max(offset, 0)

    termino_limpio = q.strip()

    # Si la query es menor a 2 caracteres y no hay ningún filtro ni categoría, devolvemos vacío
    if (
        len(termino_limpio) < 2
        and not categorias
        and tipo is None
        and polos is None
        and corriente_nominal_a is None
        and capacidad_corte_ka is None
        and sensibilidad_ma is None
        and admite_accesorios is None
    ):
        return BusquedaCatalogoResponse(resultados=[], total=0)

    condiciones = []

    if len(termino_limpio) >= 2:
        termino = f"%{termino_limpio}%"
        condiciones.append(
            or_(
                CatalogoComponente.codigo.ilike(termino),
                CatalogoComponente.codigo_comercial.ilike(termino),
                CatalogoComponente.descripcion.ilike(termino),
            )
        )

    if categorias:
        condiciones.append(CatalogoComponente.categoria_raiz.in_(categorias))

    if solo_con_atributos:
        condiciones.append(CatalogoComponente.atributos.isnot(None))

    if tipo is not None:
        condiciones.append(CatalogoComponente.atributos["tipo"].as_string() == tipo)

    if polos is not None:
        condiciones.append(CatalogoComponente.atributos["polos"].as_integer() == polos)

    if corriente_nominal_a is not None:
        condiciones.append(
            CatalogoComponente.atributos["corriente_nominal_a"].as_float() == float(corriente_nominal_a)
        )

    if capacidad_corte_ka is not None:
        condiciones.append(
            CatalogoComponente.atributos["capacidad_corte_ka"].as_float() == float(capacidad_corte_ka)
        )

    if sensibilidad_ma is not None:
        condiciones.append(
            CatalogoComponente.atributos["sensibilidad_ma"].as_integer() == sensibilidad_ma
        )

    if admite_accesorios is not None:
        if admite_accesorios is False:
            condiciones.append(
                or_(
                    CatalogoComponente.atributos["admite_accesorios"].as_boolean() == False,
                    CatalogoComponente.atributos["admite_accesorios"].is_(None)
                )
            )
        else:
            condiciones.append(
                CatalogoComponente.atributos["admite_accesorios"].as_boolean() == True
            )

    filtro = and_(*condiciones) if condiciones else True

    # Relevancia: coincidencia de prefijo en el código interno primero, después
    # en el código comercial, cualquier otra coincidencia (ej. en la
    # descripción) al final. Si la query es corta/vacía, ordenamos simplemente por código.
    total = db.query(CatalogoComponente).filter(filtro).count()

    if len(termino_limpio) >= 2:
        prefijo = f"{termino_limpio}%"
        relevancia = case(
            (CatalogoComponente.codigo.ilike(prefijo), 0),
            (CatalogoComponente.codigo_comercial.ilike(prefijo), 1),
            else_=2,
        )
        componentes = (
            db.query(CatalogoComponente)
            .filter(filtro)
            .order_by(relevancia, CatalogoComponente.codigo, CatalogoComponente.id)
            .offset(offset)
            .limit(limit)
            .all()
        )
    else:
        componentes = (
            db.query(CatalogoComponente)
            .filter(filtro)
            .order_by(CatalogoComponente.codigo, CatalogoComponente.id)
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
    sensibilidades_ma: list[int] = []
    admite_accesorios: list[bool] = []


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
    tipo: str | None = None,
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
    if tipo:
        filtro = and_(filtro, CatalogoComponente.atributos["tipo"].as_string() == tipo)

    polos_rows = db.query(CatalogoComponente.atributos["polos"].as_integer()).filter(filtro).distinct().all()
    corrientes_rows = (
        db.query(CatalogoComponente.atributos["corriente_nominal_a"].as_float()).filter(filtro).distinct().all()
    )
    capacidades_rows = (
        db.query(CatalogoComponente.atributos["capacidad_corte_ka"].as_float()).filter(filtro).distinct().all()
    )
    sensibilidades_rows = (
        db.query(CatalogoComponente.atributos["sensibilidad_ma"].as_integer()).filter(filtro).distinct().all()
    )
    accesorios_rows = (
        db.query(CatalogoComponente.atributos["admite_accesorios"].as_boolean()).filter(filtro).distinct().all()
    )

    polos = sorted({r[0] for r in polos_rows if r[0] is not None})
    corrientes = sorted({_decimal_sin_ruido_de_float(r[0]) for r in corrientes_rows if r[0] is not None})
    capacidades = sorted({_decimal_sin_ruido_de_float(r[0]) for r in capacidades_rows if r[0] is not None})
    sensibilidades = sorted({r[0] for r in sensibilidades_rows if r[0] is not None})
    accesorios = sorted({r[0] for r in accesorios_rows if r[0] is not None})

    return OpcionesFiltroResponse(
        polos=polos,
        corrientes_nominales_a=corrientes,
        capacidades_corte_ka=capacidades,
        sensibilidades_ma=sensibilidades,
        admite_accesorios=accesorios,
    )
