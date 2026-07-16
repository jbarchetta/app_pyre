from sqlalchemy import inspect

from app.database import engine

EXPECTED_TABLES = {
    "usuario",
    "proyecto",
    "tablero",
    "seccion",
    "salida",
    "bom_linea",
    "catalogo_componente",
    "catalogo_precio_historial",
    "extraccion_cad",
    "audit_log",
}


def test_all_core_tables_exist():
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    assert EXPECTED_TABLES.issubset(table_names)
