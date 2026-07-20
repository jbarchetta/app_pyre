"""Queries de lectura compartidas del catálogo (ciclo 9)."""

import uuid

from sqlalchemy.orm import Session

from app.models import CatalogoComponente


def componentes_por_id(db: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, CatalogoComponente]:
    """Resuelve varios componentes en UNA sola query (anti-N+1 en listados).

    Los endpoints que devuelven N filas con componente asociado lo usan una vez
    y pasan el componente ya resuelto a sus response builders, en vez de un
    `db.get` por fila.
    """
    if not ids:
        return {}
    encontrados = db.query(CatalogoComponente).filter(CatalogoComponente.id.in_(ids)).all()
    return {componente.id: componente for componente in encontrados}
