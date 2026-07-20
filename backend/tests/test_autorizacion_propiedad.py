"""Autorización por propiedad (ciclo 8).

Regla (docs/reglas_negocio.md): el analista opera solo sus propios proyectos y
sus recursos anidados (tablero → seccion → salida); el supervisor accede a
todo. La reasignación (PATCH con analista_id) es exclusiva del supervisor.
"""

from app.scripts.create_user import create_user

PASSWORD = "clave-segura-123"


def _crear_usuarios(db_session, sufijo):
    # Emails únicos por test: la tabla usuario no se trunca entre tests.
    for nombre, rol in (("a", "analista"), ("b", "analista"), ("sup", "supervisor")):
        create_user(f"authz.{nombre}.{sufijo}@pyre.com", nombre.upper(), PASSWORD, rol, db=db_session)


def _login(client, sufijo, nombre):
    client.post("/auth/login", json={"email": f"authz.{nombre}.{sufijo}@pyre.com", "password": PASSWORD})


def _crear_proyecto(client, nombre="Proyecto de A"):
    return client.post("/proyectos", json={"cliente": "Cliente", "nombre": nombre}).json()["id"]


def _crear_estructura_completa(client):
    """proyecto + tablero + seccion + salida del usuario logueado."""
    proyecto_id = _crear_proyecto(client)
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10"}
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Fila 1"}).json()["id"]
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]
    return proyecto_id, tablero_id, seccion_id, salida_id


def test_listar_proyectos_analista_solo_ve_los_suyos(client, db_session):
    _crear_usuarios(db_session, "list")
    _login(client, "list", "a")
    _crear_proyecto(client, "Proyecto A1")
    _login(client, "list", "b")
    _crear_proyecto(client, "Proyecto B1")

    nombres_de_b = [p["nombre"] for p in client.get("/proyectos").json()]
    assert "Proyecto B1" in nombres_de_b
    assert "Proyecto A1" not in nombres_de_b

    _login(client, "list", "sup")
    nombres_sup = [p["nombre"] for p in client.get("/proyectos").json()]
    assert "Proyecto A1" in nombres_sup
    assert "Proyecto B1" in nombres_sup


def test_get_proyecto_ajeno_devuelve_403(client, db_session):
    _crear_usuarios(db_session, "get")
    _login(client, "get", "a")
    proyecto_id = _crear_proyecto(client)

    _login(client, "get", "b")
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 403

    _login(client, "get", "a")
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 200

    _login(client, "get", "sup")
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 200


def test_acceso_denegado_a_proyecto_ajeno_queda_auditado(client, db_session):
    from app.models import AuditLog

    _crear_usuarios(db_session, "audit")
    _login(client, "audit", "a")
    proyecto_id = _crear_proyecto(client)

    _login(client, "audit", "b")
    response = client.get(f"/proyectos/{proyecto_id}")

    assert response.status_code == 403
    eventos = (
        db_session.query(AuditLog)
        .filter(AuditLog.accion == "acceso_denegado_propiedad", AuditLog.entidad_id == proyecto_id)
        .all()
    )
    assert len(eventos) == 1
    evento = eventos[0]
    assert evento.entidad == "proyecto"
    assert evento.detalle["recurso"] == "proyecto"


def test_patch_proyecto_ajeno_devuelve_403(client, db_session):
    _crear_usuarios(db_session, "patch")
    _login(client, "patch", "a")
    proyecto_id = _crear_proyecto(client)

    _login(client, "patch", "b")
    response = client.patch(f"/proyectos/{proyecto_id}", json={"nombre": "Robado"})

    assert response.status_code == 403
    _login(client, "patch", "a")
    assert client.get(f"/proyectos/{proyecto_id}").json()["nombre"] == "Proyecto de A"


def test_delete_proyecto_ajeno_devuelve_403(client, db_session):
    _crear_usuarios(db_session, "delete")
    _login(client, "delete", "a")
    proyecto_id = _crear_proyecto(client)

    _login(client, "delete", "b")
    assert client.delete(f"/proyectos/{proyecto_id}").status_code == 403

    _login(client, "delete", "a")
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 200


def test_endpoints_anidados_rechazan_acceso_ajeno(client, db_session):
    _crear_usuarios(db_session, "nested")
    _login(client, "nested", "a")
    proyecto_id, tablero_id, seccion_id, salida_id = _crear_estructura_completa(client)

    _login(client, "nested", "b")
    casos = [
        ("POST", f"/proyectos/{proyecto_id}/tableros", {"nombre": "X", "nivel_falla_ka": "10"}),
        ("GET", f"/proyectos/{proyecto_id}/tableros", None),
        ("GET", f"/tableros/{tablero_id}", None),
        ("PATCH", f"/tableros/{tablero_id}", {"nombre": "X"}),
        ("DELETE", f"/tableros/{tablero_id}", None),
        ("POST", f"/tableros/{tablero_id}/secciones", {"nombre": "X"}),
        ("GET", f"/tableros/{tablero_id}/secciones", None),
        ("PATCH", f"/secciones/{seccion_id}", {"nombre": "X"}),
        ("DELETE", f"/secciones/{seccion_id}", None),
        (
            "POST",
            f"/secciones/{seccion_id}/salidas",
            {"carga_valor": "10", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
        ),
        ("GET", f"/secciones/{seccion_id}/salidas", None),
        ("PATCH", f"/salidas/{salida_id}", {"carga_valor": "20"}),
        ("DELETE", f"/salidas/{salida_id}", None),
    ]
    for metodo, url, payload in casos:
        response = client.request(metodo, url, json=payload)
        assert response.status_code == 403, f"{metodo} {url} debería ser 403, fue {response.status_code}"


def test_supervisor_accede_a_recursos_ajenos(client, db_session):
    _crear_usuarios(db_session, "supaccess")
    _login(client, "supaccess", "a")
    proyecto_id, tablero_id, seccion_id, salida_id = _crear_estructura_completa(client)

    _login(client, "supaccess", "sup")
    assert client.get(f"/proyectos/{proyecto_id}/tableros").status_code == 200
    assert client.get(f"/tableros/{tablero_id}").status_code == 200
    assert client.get(f"/tableros/{tablero_id}/secciones").status_code == 200
    assert client.get(f"/secciones/{seccion_id}/salidas").status_code == 200
    assert client.patch(f"/tableros/{tablero_id}", json={"nombre": "Editado por sup"}).status_code == 200


def test_supervisor_puede_reasignar_analista(client, db_session):
    _crear_usuarios(db_session, "reassign")
    _login(client, "reassign", "a")
    proyecto_id = _crear_proyecto(client)

    from app.models import Usuario

    analista_b = db_session.query(Usuario).filter(Usuario.email == "authz.b.reassign@pyre.com").one()

    _login(client, "reassign", "sup")
    response = client.patch(f"/proyectos/{proyecto_id}", json={"analista_id": str(analista_b.id)})
    assert response.status_code == 200
    assert response.json()["analista_id"] == str(analista_b.id)

    # A perdió acceso, B lo ganó.
    _login(client, "reassign", "a")
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 403
    _login(client, "reassign", "b")
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 200


def test_analista_no_puede_reasignar_ni_su_propio_proyecto(client, db_session):
    _crear_usuarios(db_session, "selfreassign")
    _login(client, "selfreassign", "a")
    proyecto_id = _crear_proyecto(client)

    from app.models import Usuario

    analista_b = db_session.query(Usuario).filter(Usuario.email == "authz.b.selfreassign@pyre.com").one()

    response = client.patch(f"/proyectos/{proyecto_id}", json={"analista_id": str(analista_b.id)})

    assert response.status_code == 403
    assert client.get(f"/proyectos/{proyecto_id}").json()["analista_id"] != str(analista_b.id)


def test_reasignar_a_usuario_inexistente_devuelve_400(client, db_session):
    _crear_usuarios(db_session, "badreassign")
    _login(client, "badreassign", "a")
    proyecto_id = _crear_proyecto(client)

    _login(client, "badreassign", "sup")
    response = client.patch(
        f"/proyectos/{proyecto_id}", json={"analista_id": "00000000-0000-0000-0000-000000000000"}
    )

    assert response.status_code == 400
