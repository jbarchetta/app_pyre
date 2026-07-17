import uuid
from decimal import Decimal

from sqlalchemy import tuple_
from sqlalchemy.orm import Session

from app.catalogo.types import ComponenteImportado
from app.models import AuditLog, CatalogoComponente, CatalogoPrecioHistorial

# Postgres rechaza un único IN compuesto de (proveedor, codigo) con miles de
# pares ("stack depth limit exceeded" -- reproducido importando el catálogo
# real de ABB, 10.247 filas). Buscar en lotes evita esa profundidad de
# expresión sin importar cuántas filas tenga el archivo.
_TAMANO_LOTE_BUSQUEDA = 500


def _precio_o_fallback(precio_neto: Decimal | None, precio_lista: Decimal | None) -> Decimal:
    if precio_neto is not None:
        return precio_neto
    if precio_lista is not None:
        return precio_lista
    return Decimal(0)


def _existentes_por_clave(
    db: Session, claves: set[tuple[str, str]]
) -> dict[tuple[str, str], CatalogoComponente]:
    componentes_por_clave: dict[tuple[str, str], CatalogoComponente] = {}
    claves_lista = list(claves)
    for inicio in range(0, len(claves_lista), _TAMANO_LOTE_BUSQUEDA):
        lote = claves_lista[inicio : inicio + _TAMANO_LOTE_BUSQUEDA]
        encontrados = (
            db.query(CatalogoComponente)
            .filter(tuple_(CatalogoComponente.proveedor, CatalogoComponente.codigo).in_(lote))
            .all()
        )
        for componente in encontrados:
            componentes_por_clave[(componente.proveedor, componente.codigo)] = componente
    return componentes_por_clave


def upsert_componentes(db: Session, items: list[ComponenteImportado], usuario_id: uuid.UUID) -> dict:
    nuevos = 0
    actualizados = 0
    sin_cambios = 0

    claves = {(item.proveedor, item.codigo) for item in items}
    componentes_por_clave = _existentes_por_clave(db, claves)

    for item in items:
        clave = (item.proveedor, item.codigo)
        existente = componentes_por_clave.get(clave)

        if existente is None:
            nuevo = CatalogoComponente(
                id=uuid.uuid4(),
                proveedor=item.proveedor,
                codigo=item.codigo,
                codigo_comercial=item.codigo_comercial,
                categoria_path=item.categoria_path,
                categoria_raiz=item.categoria_path[0] if item.categoria_path else "",
                descripcion=item.descripcion,
                unidad=item.unidad,
                precio_lista=item.precio_lista,
                precio_neto=item.precio_neto,
                atributos=item.atributos,
                archivo_origen=item.archivo_origen,
                fila_origen=item.fila_origen,
            )
            db.add(nuevo)
            componentes_por_clave[clave] = nuevo
            nuevos += 1
            continue

        precio_cambio = existente.precio_neto != item.precio_neto or existente.precio_lista != item.precio_lista
        if precio_cambio:
            db.add(
                CatalogoPrecioHistorial(
                    componente_id=existente.id,
                    precio_anterior=_precio_o_fallback(existente.precio_neto, existente.precio_lista),
                    precio_nuevo=_precio_o_fallback(item.precio_neto, item.precio_lista),
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
        existente.atributos = item.atributos
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
