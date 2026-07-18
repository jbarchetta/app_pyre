from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _setup_tablero(client, db_session, email, interruptor_principal_id=None, nivel_falla_ka="10.00"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})
    proyecto_id = client.post(
        "/proyectos", json={"cliente": "Cliente Salida", "nombre": "Proyecto Salida"}
    ).json()["id"]
    tablero_payload = {"nombre": "TG1", "nivel_falla_ka": nivel_falla_ka}
    if interruptor_principal_id:
        tablero_payload["interruptor_principal_id"] = interruptor_principal_id
    tablero_id = client.post(f"/proyectos/{proyecto_id}/tableros", json=tablero_payload).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]
    return seccion_id


def _componente(db_session, codigo, tipo="seccional_termomagnetico", polos=1, corriente=20, ka=10, precio="50.00"):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=f"Interruptor {codigo}",
        unidad="Unidad",
        precio_neto=Decimal(precio),
        atributos={"tipo": tipo, "polos": polos, "corriente_nominal_a": corriente, "capacidad_corte_ka": ka},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_crear_salida_propone_componente_cuando_hay_match(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-1", tipo="interruptor_principal", corriente=100, ka=15)
    # precio deliberadamente por debajo de 50.00 (el precio por defecto de otros
    # fixtures del resto de la suite) para que este test sea robusto sin importar
    # qué otros archivos ya corrieron.
    barato = _componente(db_session, "SAL-C1", corriente=20, ka=10, precio="15.00")
    seccion_id = _setup_tablero(
        client, db_session, "salidas1.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["componente_id"] == str(barato.id)
    assert body["origen"] == "manual"


def test_crear_salida_sin_match_deja_componente_id_null(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-2", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas2.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_diferencial",
        },
    )

    assert response.status_code == 201
    assert response.json()["componente_id"] is None


def test_crear_salida_sin_interruptor_principal_deja_componente_id_null(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas3.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    assert response.json()["componente_id"] is None


def test_crear_salida_con_unidad_invalida_devuelve_400(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas4.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "V",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 400


def test_patch_salida_permite_override_manual(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas5.test@pyre.com")
    manual = _componente(db_session, "SAL-C5", corriente=20, ka=10)
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"componente_id": str(manual.id)})

    assert response.status_code == 200
    assert response.json()["componente_id"] == str(manual.id)


def test_listar_salidas_devuelve_las_creadas(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas6.test@pyre.com")
    primera = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "10",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()

    response = client.get(f"/secciones/{seccion_id}/salidas")

    assert response.status_code == 200
    ids = [s["id"] for s in response.json()]
    assert ids == [primera["id"]]


def test_patch_salida_recalcula_cuando_cambia_la_carga(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-7", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas7.test@pyre.com", interruptor_principal_id=str(principal.id)
    )
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "10",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_valor": "30"})

    assert response.status_code == 200
    assert response.json()["carga_valor"] == "30.00"


def test_patch_salida_con_componente_id_explicito_no_recalcula(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas8.test@pyre.com")
    manual = _componente(db_session, "SAL-C8", corriente=20, ka=10)
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(
        f"/salidas/{salida_id}", json={"carga_valor": "30", "componente_id": str(manual.id)}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["componente_id"] == str(manual.id)
    assert body["carga_valor"] == "30.00"


def test_patch_salida_con_unidad_invalida_devuelve_400(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas11.test@pyre.com")
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_unidad": "V"})

    assert response.status_code == 400


def test_delete_salida(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas9.test@pyre.com")
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.delete(f"/salidas/{salida_id}")

    assert response.status_code == 204
    assert client.get(f"/secciones/{seccion_id}/salidas").json() == []


def test_delete_salida_inexistente_devuelve_404(client, db_session):
    import uuid

    _setup_tablero(client, db_session, "salidas10.test@pyre.com")

    response = client.delete(f"/salidas/{uuid.uuid4()}")

    assert response.status_code == 404


def test_patch_salida_con_componente_id_null_explicito_lo_limpia_sin_recalcular(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-12", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas12.test@pyre.com", interruptor_principal_id=str(principal.id)
    )
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_valor": "30", "componente_id": None})

    assert response.status_code == 200
    body = response.json()
    assert body["componente_id"] is None
    assert body["carga_valor"] == "30.00"
