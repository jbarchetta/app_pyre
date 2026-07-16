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
