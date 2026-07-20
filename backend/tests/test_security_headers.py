"""Headers de seguridad HTTP + CORS explícito (ciclo 9).

El middleware debe aplicar los headers en TODAS las respuestas — incluidas las
de error (401/404) — y CORS debe reflejar listas explícitas, no comodines.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_HEADERS_ESPERADOS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'",
}


def test_headers_de_seguridad_en_respuesta_exitosa():
    response = client.get("/health")

    assert response.status_code == 200
    for header, valor in _HEADERS_ESPERADOS.items():
        assert response.headers.get(header) == valor, f"{header} debería ser {valor!r}"


def test_headers_de_seguridad_tambien_en_errores():
    # Un 401 por falta de auth también debe llevar los headers — el middleware
    # corre antes del router y no depende del resultado de la request.
    response = client.get("/proyectos")

    assert response.status_code == 401
    for header, valor in _HEADERS_ESPERADOS.items():
        assert response.headers.get(header) == valor, f"{header} debería ser {valor!r} en un 401"


def test_hsts_no_se_envia_fuera_de_produccion():
    # HSTS sobre HTTP rompería localhost en dev — solo va cuando
    # TABLERO_ENVIRONMENT=production (conftest fija "test").
    response = client.get("/health")

    assert "strict-transport-security" not in response.headers


def test_preflight_cors_con_metodos_explicitos():
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5180",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    metodos = response.headers["access-control-allow-methods"]
    assert metodos != "*"
    assert "POST" in metodos
    assert "PATCH" in metodos
    assert "DELETE" in metodos


def test_preflight_cors_rechaza_metodo_fuera_de_la_lista():
    # Con allow_methods=["*"] Starlette aceptaba cualquier verbo; con la lista
    # explícita, un método no previsto debe ser rechazado en el preflight.
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5180",
            "Access-Control-Request-Method": "VERBOINVALIDO",
        },
    )

    assert response.status_code == 400


def test_preflight_cors_con_headers_explicitos():
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5180",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 200
    headers_permitidos = response.headers["access-control-allow-headers"]
    assert headers_permitidos != "*"
    assert "Content-Type" in headers_permitidos
