import uuid

from sqlalchemy.orm import Session

from app.catalogo.types import ComponenteImportado
from app.models import AuditLog, CatalogoComponente, CatalogoPrecioHistorial


def upsert_componentes(db: Session, items: list[ComponenteImportado], usuario_id: uuid.UUID) -> dict:
    nuevos = 0
    actualizados = 0
    sin_cambios = 0

    for item in items:
        existente = (
            db.query(CatalogoComponente)
            .filter(CatalogoComponente.proveedor == item.proveedor, CatalogoComponente.codigo == item.codigo)
            .first()
        )

        if existente is None:
            db.add(
                CatalogoComponente(
                    proveedor=item.proveedor,
                    codigo=item.codigo,
                    codigo_comercial=item.codigo_comercial,
                    categoria_path=item.categoria_path,
                    categoria_raiz=item.categoria_path[0] if item.categoria_path else "",
                    descripcion=item.descripcion,
                    unidad=item.unidad,
                    precio_lista=item.precio_lista,
                    precio_neto=item.precio_neto,
                    archivo_origen=item.archivo_origen,
                    fila_origen=item.fila_origen,
                )
            )
            nuevos += 1
            continue

        precio_cambio = existente.precio_neto != item.precio_neto or existente.precio_lista != item.precio_lista
        if precio_cambio:
            db.add(
                CatalogoPrecioHistorial(
                    componente_id=existente.id,
                    precio_anterior=existente.precio_neto or existente.precio_lista or 0,
                    precio_nuevo=item.precio_neto or item.precio_lista or 0,
                    usuario_id=usuario_id,
                )
            )
            existente.precio_lista = item.precio_lista
            existente.precio_neto = item.precio_neto
            actualizados += 1
        else:
            sin_cambios += 1

        existente.descripcion = item.descripcion
        existente.categoria_path = item.categoria_path
        existente.categoria_raiz = item.categoria_path[0] if item.categoria_path else existente.categoria_raiz
        existente.codigo_comercial = item.codigo_comercial
        existente.unidad = item.unidad
        existente.archivo_origen = item.archivo_origen
        existente.fila_origen = item.fila_origen

    resumen = {"total_filas": len(items), "nuevos": nuevos, "actualizados": actualizados, "sin_cambios": sin_cambios}

    db.add(
        AuditLog(
            usuario_id=usuario_id,
            accion="importar_catalogo",
            entidad="catalogo_componente",
            entidad_id=items[0].archivo_origen if items else "",
            detalle=resumen,
        )
    )
    db.commit()

    return resumen
