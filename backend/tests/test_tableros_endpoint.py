from app.scripts.create_user import create_user


def _proyecto(client, db_session, email="tableros.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})
    respuesta = client.post("/proyectos", json={"cliente": "Cliente Tablero", "nombre": "Proyecto Tablero"})
    return respuesta.json()["id"]


def test_crear_tablero_devuelve_el_tablero_creado(client, db_session):
    proyecto_id = _proyecto(client, db_session)

    response = client.post(
        f"/proyectos/{proyecto_id}/tableros",
        json={"nombre": "TG1", "nivel_falla_ka": "10.00"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "TG1"
    assert body["proyecto_id"] == proyecto_id
    assert body["interruptor_principal_id"] is None


def test_crear_tablero_en_proyecto_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="tableros404.test@pyre.com")

    response = client.post(
        f"/proyectos/{uuid.uuid4()}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    )

    assert response.status_code == 404


def test_crear_seccion_devuelve_la_seccion_creada(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="secciones.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]

    response = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1", "orden": 1})

    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "Sección 1"
    assert body["tablero_id"] == tablero_id


def test_crear_seccion_en_tablero_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="secciones404.test@pyre.com")

    response = client.post(f"/tableros/{uuid.uuid4()}/secciones", json={"nombre": "X"})

    assert response.status_code == 404


def test_listar_tableros_devuelve_los_creados(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="listartableros.test@pyre.com")
    client.post(f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"})
    client.post(f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG2", "nivel_falla_ka": "10.00"})

    response = client.get(f"/proyectos/{proyecto_id}/tableros")

    assert response.status_code == 200
    nombres = [t["nombre"] for t in response.json()]
    assert nombres == ["TG1", "TG2"]


def test_patch_tablero_actualiza_nivel_falla_ka(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="patchtablero.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]

    response = client.patch(f"/tableros/{tablero_id}", json={"nivel_falla_ka": "16.00"})

    assert response.status_code == 200
    assert response.json()["nivel_falla_ka"] == "16.00"


def test_patch_tablero_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="patchtablero404.test@pyre.com")

    response = client.patch(f"/tableros/{uuid.uuid4()}", json={"nivel_falla_ka": "16.00"})

    assert response.status_code == 404


def test_listar_secciones_devuelve_las_creadas(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="listarsecciones.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección A", "orden": 1})
    client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección B", "orden": 2})

    response = client.get(f"/tableros/{tablero_id}/secciones")

    assert response.status_code == 200
    nombres = [s["nombre"] for s in response.json()]
    assert nombres == ["Sección A", "Sección B"]
