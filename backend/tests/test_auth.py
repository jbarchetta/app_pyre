import pytest

from app.scripts.create_user import create_user


def _make_user(db_session, email="login.test@pyre.com", rol="analista"):
    return create_user(email, "Usuaria de Prueba", "clave-segura-123", rol, db=db_session)


def test_login_with_valid_credentials_sets_cookie(client, db_session):
    _make_user(db_session)

    response = client.post("/auth/login", json={"email": "login.test@pyre.com", "password": "clave-segura-123"})

    assert response.status_code == 200
    assert response.json()["email"] == "login.test@pyre.com"
    assert "access_token" in response.cookies


def test_login_with_wrong_password_returns_401(client, db_session):
    _make_user(db_session, email="wrong.test@pyre.com")

    response = client.post("/auth/login", json={"email": "wrong.test@pyre.com", "password": "clave-incorrecta"})

    assert response.status_code == 401


def test_login_fallido_queda_auditado_sin_password(client, db_session):
    _make_user(db_session, email="audit.fail@pyre.com")
    from app.models import AuditLog

    response = client.post(
        "/auth/login", json={"email": "audit.fail@pyre.com", "password": "clave-incorrecta-xyz"}
    )

    assert response.status_code == 401
    # audit_log es una tabla compartida entre tests (no se trunca por test) --
    # se scopea por entidad_id además de accion para que no se contamine con
    # los logins de otros tests del mismo archivo/sesión.
    eventos = (
        db_session.query(AuditLog)
        .filter(AuditLog.accion == "login_fallido", AuditLog.entidad_id == "audit.fail@pyre.com")
        .all()
    )
    assert len(eventos) == 1
    evento = eventos[0]
    assert evento.entidad == "usuario"
    assert evento.entidad_id == "audit.fail@pyre.com"
    # La password intentada NUNCA se persiste, ni en detalle ni en ningún campo.
    assert "clave-incorrecta-xyz" not in str(evento.detalle)
    # Ni siquiera se distingue "usuario inexistente" de "password incorrecta".
    assert evento.detalle["motivo"] == "credenciales_invalidas"


def test_login_exitoso_queda_auditado(client, db_session):
    _make_user(db_session, email="audit.ok@pyre.com")
    from app.models import AuditLog

    response = client.post("/auth/login", json={"email": "audit.ok@pyre.com", "password": "clave-segura-123"})

    assert response.status_code == 200
    eventos = (
        db_session.query(AuditLog)
        .filter(AuditLog.accion == "login_exitoso", AuditLog.entidad_id == "audit.ok@pyre.com")
        .all()
    )
    assert len(eventos) == 1
    assert eventos[0].entidad_id == "audit.ok@pyre.com"


def test_login_fallido_de_usuario_inexistente_tambien_se_audita_sin_enumerar(client, db_session):
    from app.models import AuditLog

    response = client.post(
        "/auth/login", json={"email": "no.existe.audit@pyre.com", "password": "cualquier-cosa-123"}
    )

    assert response.status_code == 401
    eventos = (
        db_session.query(AuditLog)
        .filter(AuditLog.accion == "login_fallido", AuditLog.entidad_id == "no.existe.audit@pyre.com")
        .all()
    )
    assert len(eventos) == 1
    assert eventos[0].detalle["motivo"] == "credenciales_invalidas"


def test_me_without_cookie_returns_401(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_me_with_valid_cookie_returns_user(client, db_session):
    _make_user(db_session, email="me.test@pyre.com")
    client.post("/auth/login", json={"email": "me.test@pyre.com", "password": "clave-segura-123"})

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "me.test@pyre.com"


def test_logout_clears_cookie(client, db_session):
    _make_user(db_session, email="logout.test@pyre.com")
    client.post("/auth/login", json={"email": "logout.test@pyre.com", "password": "clave-segura-123"})

    logout_response = client.post("/auth/logout")
    me_response = client.get("/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401


def test_require_role_allows_matching_role():
    from fastapi import HTTPException

    from app.auth.dependencies import require_role
    from app.models import RolUsuario, Usuario

    checker = require_role(RolUsuario.SUPERVISOR)
    user = Usuario(rol=RolUsuario.SUPERVISOR)

    assert checker(user=user) is user


def test_require_role_rejects_wrong_role():
    from fastapi import HTTPException

    from app.auth.dependencies import require_role
    from app.models import RolUsuario, Usuario

    checker = require_role(RolUsuario.SUPERVISOR)
    user = Usuario(rol=RolUsuario.ANALISTA)

    with pytest.raises(HTTPException) as exc_info:
        checker(user=user)

    assert exc_info.value.status_code == 403
