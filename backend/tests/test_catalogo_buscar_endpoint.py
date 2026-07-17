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
    assert len(body) == 1
    assert body[0]["id"] == str(componente.id)
    assert body[0]["codigo"] == "ZQXBUSCAR-C1"


def test_buscar_encuentra_por_descripcion(client, db_session):
    _login(client, db_session, email="buscarcat2.test@pyre.com")
    componente = _componente(db_session, "ZQXBUSCAR-C2", "Interruptor ZQXBUSCAR especial")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR especial"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(componente.id)


def test_buscar_con_termino_corto_devuelve_vacio(client, db_session):
    _login(client, db_session, email="buscarcat3.test@pyre.com")

    response = client.get("/catalogo/buscar", params={"q": "z"})

    assert response.status_code == 200
    assert response.json() == []


def test_buscar_encuentra_por_codigo_comercial(client, db_session):
    _login(client, db_session, email="buscarcat4.test@pyre.com")
    componente = _componente(db_session, "COD-INTERNO-1", "Interruptor sin match textual", codigo_comercial="ZQXBUSCAR-SH201")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR-SH201"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(componente.id)
    assert body[0]["codigo_comercial"] == "ZQXBUSCAR-SH201"


def test_buscar_prioriza_coincidencia_de_prefijo_en_codigo(client, db_session):
    _login(client, db_session, email="buscarcat5.test@pyre.com")
    # El código de "en_descripcion" empieza con "AAA" (antes alfabéticamente que
    # "ZQXPRI-C1") para que este test solo pase si de verdad hay lógica de
    # relevancia -- con el orden alfabético viejo, "en_descripcion" ganaría por
    # casualidad de letras, no porque sea la mejor coincidencia.
    en_descripcion = _componente(db_session, "AAA-OTRO-COD", "Interruptor con ZQXPRI200 en el medio del texto")
    prefijo_codigo = _componente(db_session, "ZQXPRI-C1", "Interruptor cualquiera")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPRI"})

    body = response.json()
    ids = [c["id"] for c in body]
    assert ids.index(str(prefijo_codigo.id)) < ids.index(str(en_descripcion.id))
