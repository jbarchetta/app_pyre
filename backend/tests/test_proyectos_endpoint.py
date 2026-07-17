from app.scripts.create_user import create_user


def _login(client, db_session, email="proyectos.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def test_crear_proyecto_requiere_autenticacion(client):
    response = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "Tablero principal"})

    assert response.status_code == 401


def test_crear_proyecto_devuelve_el_proyecto_creado(client, db_session):
    _login(client, db_session)

    response = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "Tablero principal"})

    assert response.status_code == 201
    body = response.json()
    assert body["cliente"] == "Cliente A"
    assert body["nombre"] == "Tablero principal"
    assert body["estado"] == "en_curso"


def test_listar_proyectos_incluye_los_creados(client, db_session):
    _login(client, db_session, email="listar.test@pyre.com")
    client.post("/proyectos", json={"cliente": "Cliente B", "nombre": "Proyecto listado"})

    response = client.get("/proyectos")

    assert response.status_code == 200
    nombres = [p["nombre"] for p in response.json()]
    assert "Proyecto listado" in nombres


def test_obtener_proyecto_inexistente_devuelve_404(client, db_session):
    import uuid

    _login(client, db_session, email="notfound.test@pyre.com")

    response = client.get(f"/proyectos/{uuid.uuid4()}")

    assert response.status_code == 404
