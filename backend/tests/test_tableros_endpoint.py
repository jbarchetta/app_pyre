from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _proyecto(client, db_session, email="tableros.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})
    respuesta = client.post("/proyectos", json={"cliente": "Cliente Tablero", "nombre": "Proyecto Tablero"})
    return respuesta.json()["id"]


def _componente(db_session, codigo):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=f"Interruptor {codigo}",
        unidad="Unidad",
        precio_neto=Decimal("500.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


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


def test_patch_tablero_actualiza_interruptor_principal_sin_tocar_nivel_falla(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="patchprincipal.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    componente = _componente(db_session, "PATCH-PRINC-1")

    response = client.patch(f"/tableros/{tablero_id}", json={"interruptor_principal_id": str(componente.id)})

    assert response.status_code == 200
    body = response.json()
    assert body["interruptor_principal_id"] == str(componente.id)
    assert body["nivel_falla_ka"] == "10.00"


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


def test_patch_tablero_actualiza_nombre(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="patchnombretablero.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]

    response = client.patch(f"/tableros/{tablero_id}", json={"nombre": "TG1 renombrado"})

    assert response.status_code == 200
    assert response.json()["nombre"] == "TG1 renombrado"


def test_delete_tablero_borra_secciones_y_salidas_en_cascada(client, db_session):
    import uuid

    from app.models import Salida, Seccion

    proyecto_id = _proyecto(client, db_session, email="deletetablero.test@pyre.com")
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

    response = client.delete(f"/tableros/{tablero_id}")

    assert response.status_code == 204
    assert client.get(f"/tableros/{tablero_id}").status_code == 404
    assert db_session.get(Seccion, uuid.UUID(seccion_id)) is None
    assert db_session.get(Salida, uuid.UUID(salida_id)) is None


def test_delete_tablero_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="deletetablero404.test@pyre.com")

    response = client.delete(f"/tableros/{uuid.uuid4()}")

    assert response.status_code == 404


def test_patch_seccion_actualiza_nombre(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="patchseccion.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]

    response = client.patch(f"/secciones/{seccion_id}", json={"nombre": "Fila renombrada"})

    assert response.status_code == 200
    assert response.json()["nombre"] == "Fila renombrada"


def test_patch_seccion_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="patchseccion404.test@pyre.com")

    response = client.patch(f"/secciones/{uuid.uuid4()}", json={"nombre": "X"})

    assert response.status_code == 404


def test_delete_seccion_borra_sus_salidas(client, db_session):
    import uuid

    from app.models import Salida

    proyecto_id = _proyecto(client, db_session, email="deleteseccion.test@pyre.com")
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

    response = client.delete(f"/secciones/{seccion_id}")

    assert response.status_code == 204
    assert db_session.get(Salida, uuid.UUID(salida_id)) is None
    assert client.get(f"/secciones/{seccion_id}/salidas").status_code == 404


def test_delete_seccion_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="deleteseccion404.test@pyre.com")

    response = client.delete(f"/secciones/{uuid.uuid4()}")

    assert response.status_code == 404


def test_obtener_tablero_incluye_codigo_legible_del_interruptor_principal(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="codigolegible.test@pyre.com")
    componente = _componente(db_session, "TAB-COD-1")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros",
        json={"nombre": "TG1", "nivel_falla_ka": "10.00", "interruptor_principal_id": str(componente.id)},
    ).json()["id"]

    response = client.get(f"/tableros/{tablero_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["interruptor_principal_codigo"] == componente.codigo
    assert body["interruptor_principal_codigo_comercial"] == componente.codigo_comercial


def test_obtener_tablero_sin_interruptor_principal_devuelve_codigo_null(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="codigolegible404.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]

    response = client.get(f"/tableros/{tablero_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["interruptor_principal_codigo"] is None
    assert body["interruptor_principal_codigo_comercial"] is None
