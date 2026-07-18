from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _login(client, db_session, email="buscarcat.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def _componente(db_session, codigo, descripcion, codigo_comercial=None):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        codigo_comercial=codigo_comercial,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=descripcion,
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_buscar_requiere_autenticacion(client):
    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR"})

    assert response.status_code == 401


def test_buscar_encuentra_por_codigo(client, db_session):
    _login(client, db_session)
    componente = _componente(db_session, "ZQXBUSCAR-C1", "Interruptor de prueba")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR-C1"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)
    assert body["resultados"][0]["codigo"] == "ZQXBUSCAR-C1"


def test_buscar_encuentra_por_descripcion(client, db_session):
    _login(client, db_session, email="buscarcat2.test@pyre.com")
    componente = _componente(db_session, "ZQXBUSCAR-C2", "Interruptor ZQXBUSCAR especial")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR especial"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)


def test_buscar_con_termino_corto_devuelve_vacio(client, db_session):
    _login(client, db_session, email="buscarcat3.test@pyre.com")

    response = client.get("/catalogo/buscar", params={"q": "z"})

    assert response.status_code == 200
    assert response.json() == {"resultados": [], "total": 0}


def test_buscar_encuentra_por_codigo_comercial(client, db_session):
    _login(client, db_session, email="buscarcat4.test@pyre.com")
    componente = _componente(db_session, "COD-INTERNO-1", "Interruptor sin match textual", codigo_comercial="ZQXBUSCAR-SH201")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR-SH201"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)
    assert body["resultados"][0]["codigo_comercial"] == "ZQXBUSCAR-SH201"


def test_buscar_prioriza_coincidencia_de_prefijo_en_codigo(client, db_session):
    _login(client, db_session, email="buscarcat5.test@pyre.com")
    en_descripcion = _componente(db_session, "AAA-OTRO-COD", "Interruptor con ZQXPRI200 en el medio del texto")
    prefijo_codigo = _componente(db_session, "ZQXPRI-C1", "Interruptor cualquiera")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPRI"})

    body = response.json()
    ids = [c["id"] for c in body["resultados"]]
    assert ids.index(str(prefijo_codigo.id)) < ids.index(str(en_descripcion.id))


def test_buscar_devuelve_total_de_coincidencias_mayor_a_los_resultados_devueltos(client, db_session):
    _login(client, db_session, email="buscarcat6.test@pyre.com")
    for i in range(25):
        _componente(db_session, f"ZQXPAG-{i:03d}", f"Interruptor de paginación {i}")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPAG"})

    body = response.json()
    assert body["total"] == 25
    assert len(body["resultados"]) == 20


def test_buscar_respeta_offset_y_limit_sin_duplicar_resultados(client, db_session):
    _login(client, db_session, email="buscarcat7.test@pyre.com")
    for i in range(25):
        _componente(db_session, f"ZQXOFF-{i:03d}", f"Interruptor de offset {i}")

    primera_pagina = client.get("/catalogo/buscar", params={"q": "ZQXOFF", "limit": 20, "offset": 0}).json()
    segunda_pagina = client.get("/catalogo/buscar", params={"q": "ZQXOFF", "limit": 20, "offset": 20}).json()

    assert len(primera_pagina["resultados"]) == 20
    assert len(segunda_pagina["resultados"]) == 5
    ids_primera = {c["id"] for c in primera_pagina["resultados"]}
    ids_segunda = {c["id"] for c in segunda_pagina["resultados"]}
    assert ids_primera.isdisjoint(ids_segunda)


def test_buscar_limita_el_limit_maximo_a_50(client, db_session):
    _login(client, db_session, email="buscarcat8.test@pyre.com")
    for i in range(60):
        _componente(db_session, f"ZQXMAX-{i:03d}", f"Interruptor de tope {i}")

    response = client.get("/catalogo/buscar", params={"q": "ZQXMAX", "limit": 1000})

    body = response.json()
    assert body["total"] == 60
    assert len(body["resultados"]) == 50


def test_buscar_pagina_de_forma_estable_cuando_hay_codigos_repetidos_entre_proveedores(client, db_session):
    _login(client, db_session, email="buscarcat9.test@pyre.com")
    # Mismo código, distinto proveedor -- la restricción de unicidad real es
    # (proveedor, codigo), no codigo solo, así que esto es válido y realista.
    primero = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXDUP-1",
        codigo_comercial=None,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Interruptor duplicado proveedor A",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    segundo = CatalogoComponente(
        proveedor="Otros",
        codigo="ZQXDUP-1",
        codigo_comercial=None,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Interruptor duplicado proveedor B",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=2,
    )
    db_session.add_all([primero, segundo])
    db_session.commit()

    primera_pagina = client.get("/catalogo/buscar", params={"q": "ZQXDUP", "limit": 1, "offset": 0}).json()
    segunda_pagina = client.get("/catalogo/buscar", params={"q": "ZQXDUP", "limit": 1, "offset": 1}).json()

    assert primera_pagina["total"] == 2
    ids_vistos = {c["id"] for c in primera_pagina["resultados"]} | {c["id"] for c in segunda_pagina["resultados"]}
    assert ids_vistos == {str(primero.id), str(segundo.id)}
