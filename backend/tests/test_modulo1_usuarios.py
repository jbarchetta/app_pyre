import pytest
from app.auth.security import create_access_token, hash_password
from app.models import AuditLog, RolUsuario, Usuario


def _crear_usuario(db_session, email: str, rol: RolUsuario, nombre: str = "Test User") -> Usuario:
    u = Usuario(
        email=email,
        nombre=nombre,
        password_hash=hash_password("clave-inicial-123"),
        rol=rol,
        activo=True,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _headers_para(usuario: Usuario):
    token = create_access_token(subject=str(usuario.id), rol=usuario.rol.value)
    return {"Cookie": f"access_token={token}"}


def test_listar_usuarios_requiere_rol_autorizado(client, db_session):
    analista = _crear_usuario(db_session, "analista.test@pyre.com", RolUsuario.ANALISTA)
    admin = _crear_usuario(db_session, "admin.test@pyre.com", RolUsuario.ADMINISTRADOR)

    # Analista debe recibir 403
    res_analista = client.get("/usuarios", headers=_headers_para(analista))
    assert res_analista.status_code == 403

    # Administrador debe recibir 200 con la lista de usuarios
    res_admin = client.get("/usuarios", headers=_headers_para(admin))
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert len(data) >= 2


def test_crear_usuario_por_administrador_exitoso(client, db_session):
    admin = _crear_usuario(db_session, "admin.creador@pyre.com", RolUsuario.ADMINISTRADOR)

    payload = {
        "email": "nuevo.analista@pyre.com",
        "nombre": "Nuevo Analista",
        "rol": "analista",
        "password": "Password123!",
    }
    res = client.post("/usuarios", json=payload, headers=_headers_para(admin))
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "nuevo.analista@pyre.com"
    assert data["rol"] == "analista"
    assert data["activo"] is True

    # Verificar que se creó el AuditLog
    log = db_session.query(AuditLog).filter(AuditLog.accion == "crear_usuario").first()
    assert log is not None
    assert str(log.usuario_id) == str(admin.id)


def test_editar_rol_y_desactivar_usuario(client, db_session):
    admin = _crear_usuario(db_session, "admin.editor@pyre.com", RolUsuario.ADMINISTRADOR)
    target = _crear_usuario(db_session, "target.user@pyre.com", RolUsuario.ANALISTA)

    # Cambiar rol a supervisor
    patch_res = client.patch(
        f"/usuarios/{target.id}",
        json={"rol": "supervisor", "nombre": "Target Editado"},
        headers=_headers_para(admin),
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["rol"] == "supervisor"
    assert patch_res.json()["nombre"] == "Target Editado"

    # Desactivar usuario
    del_res = client.delete(f"/usuarios/{target.id}", headers=_headers_para(admin))
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "ok"

    db_session.refresh(target)
    assert target.activo is False


def test_autogestion_cambio_de_password(client, db_session):
    user = _crear_usuario(db_session, "self.user@pyre.com", RolUsuario.ANALISTA)
    headers = _headers_para(user)

    # Falla si la clave actual es errónea
    fail_res = client.post(
        "/auth/change-password",
        json={"current_password": "clave-incorrecta", "new_password": "Nuevaclave123!"},
        headers=headers,
    )
    assert fail_res.status_code == 400

    # Éxito si la clave es correcta
    ok_res = client.post(
        "/auth/change-password",
        json={"current_password": "clave-inicial-123", "new_password": "Nuevaclave123!"},
        headers=headers,
    )
    assert ok_res.status_code == 200

    # Probar login con nueva clave
    login_res = client.post("/auth/login", json={"email": "self.user@pyre.com", "password": "Nuevaclave123!"})
    assert login_res.status_code == 200


def test_admin_reset_password(client, db_session):
    admin = _crear_usuario(db_session, "admin.reset@pyre.com", RolUsuario.ADMINISTRADOR)
    user = _crear_usuario(db_session, "to.reset@pyre.com", RolUsuario.SUPERVISOR)

    reset_res = client.post(
        f"/usuarios/{user.id}/reset-password",
        json={"new_password": "ClaveForzada123!"},
        headers=_headers_para(admin),
    )
    assert reset_res.status_code == 200

    # Verificar que el usuario puede ingresar con la nueva clave forzada
    login_res = client.post("/auth/login", json={"email": "to.reset@pyre.com", "password": "ClaveForzada123!"})
    assert login_res.status_code == 200


def test_listar_auditoria_endpoint(client, db_session):
    supervisor = _crear_usuario(db_session, "supervisor.auditor@pyre.com", RolUsuario.SUPERVISOR)
    analista = _crear_usuario(db_session, "analista.noauditor@pyre.com", RolUsuario.ANALISTA)

    # Analista debe recibir 403 al intentar ver auditoría
    res_403 = client.get("/auditoria", headers=_headers_para(analista))
    assert res_403.status_code == 403

    # Supervisor debe recibir 200
    res_200 = client.get("/auditoria", headers=_headers_para(supervisor))
    assert res_200.status_code == 200
    assert isinstance(res_200.json(), list)
