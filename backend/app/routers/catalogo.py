import io
import zipfile
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import case, or_
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


@router.get("/buscar", response_model=list[ComponenteBusquedaResponse])
def buscar_componentes(
    q: str = "",
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    if len(q.strip()) < 2:
        return []

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

    componentes = (
        db.query(CatalogoComponente)
        .filter(
            or_(
                CatalogoComponente.codigo.ilike(termino),
                CatalogoComponente.codigo_comercial.ilike(termino),
                CatalogoComponente.descripcion.ilike(termino),
            )
        )
        .order_by(relevancia, CatalogoComponente.codigo)
        .limit(20)
        .all()
    )
    return [
        ComponenteBusquedaResponse(
            id=str(c.id),
            codigo=c.codigo,
            codigo_comercial=c.codigo_comercial,
            descripcion=c.descripcion,
            precio_neto=c.precio_neto,
        )
        for c in componentes
    ]
