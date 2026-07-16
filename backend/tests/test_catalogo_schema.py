from sqlalchemy import inspect

from app.database import engine

EXPECTED_COLUMNS = {
    "id",
    "proveedor",
    "codigo",
    "codigo_comercial",
    "categoria_path",
    "categoria_raiz",
    "descripcion",
    "unidad",
    "precio_lista",
    "precio_neto",
    "atributos",
    "archivo_origen",
    "fila_origen",
    "vigente_desde",
}


def test_catalogo_componente_has_flexible_columns():
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("catalogo_componente")}

    assert columns == EXPECTED_COLUMNS


def test_catalogo_componente_has_unique_proveedor_codigo_constraint():
    inspector = inspect(engine)
    unique_constraints = inspector.get_unique_constraints("catalogo_componente")

    matching = [uc for uc in unique_constraints if set(uc["column_names"]) == {"proveedor", "codigo"}]
    assert len(matching) == 1
