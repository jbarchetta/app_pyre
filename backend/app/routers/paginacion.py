"""Paginación defensiva compartida por los listados (ciclo 9).

Contrato: `limit`/`offset` opcionales en query params, default generoso, tope
duro silencioso (no 400 — es defensiva, no punitiva), y siempre combinada con
`ORDER BY` estable (paginar sin orden es inválido en Postgres). Las respuestas
siguen siendo arrays — el frontend no cambia; la UI de paginación es ciclo 10.
"""

LIMITE_POR_DEFECTO = 200
LIMITE_MAXIMO = 500


def acotar_paginacion(limit: int, offset: int) -> tuple[int, int]:
    return min(max(limit, 1), LIMITE_MAXIMO), max(offset, 0)
