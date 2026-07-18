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


def test_patch_proyecto_actualiza_nombre_y_cliente(client, db_session):
    _login(client, db_session, email="patchproyecto.test@pyre.com")
    proyecto_id = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "Original"}).json()["id"]

    response = client.patch(f"/proyectos/{proyecto_id}", json={"nombre": "Renombrado", "cliente": "Cliente B"})

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Renombrado"
    assert body["cliente"] == "Cliente B"


def test_patch_proyecto_inexistente_devuelve_404(client, db_session):
    import uuid

    _login(client, db_session, email="patchproyecto404.test@pyre.com")

    response = client.patch(f"/proyectos/{uuid.uuid4()}", json={"nombre": "X"})

    assert response.status_code == 404


def test_delete_proyecto_borra_tableros_secciones_y_salidas_en_cascada(client, db_session):
    import uuid

    from app.models import Salida, Seccion

    _login(client, db_session, email="deleteproyecto.test@pyre.com")
    proyecto_id = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "A borrar"}).json()["id"]
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.delete(f"/proyectos/{proyecto_id}")

    assert response.status_code == 204
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 404
    assert client.get(f"/tableros/{tablero_id}").status_code == 404
    assert client.get(f"/tableros/{tablero_id}/secciones").status_code == 404
    assert db_session.get(Seccion, uuid.UUID(seccion_id)) is None
    assert db_session.get(Salida, uuid.UUID(salida_id)) is None


def test_delete_proyecto_inexistente_devuelve_404(client, db_session):
    import uuid

    _login(client, db_session, email="deleteproyecto404.test@pyre.com")

    response = client.delete(f"/proyectos/{uuid.uuid4()}")

    assert response.status_code == 404
