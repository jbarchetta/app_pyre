import pytest

from app.database import SessionLocal
from app.models import RolUsuario


def test_create_user_hashes_password_and_sets_role():
    from app.scripts.create_user import create_user

    db = SessionLocal()
    try:
        user = create_user("ana.test@pyre.com", "Ana Analista", "clave-segura-123", "analista", db=db)

        assert user.email == "ana.test@pyre.com"
        assert user.password_hash != "clave-segura-123"
        assert user.rol == RolUsuario.ANALISTA
    finally:
        db.close()


def test_create_user_rejects_duplicate_email():
    from app.scripts.create_user import create_user

    db = SessionLocal()
    try:
        create_user("dup.test@pyre.com", "Primero", "clave-segura-123", "analista", db=db)

        with pytest.raises(ValueError):
            create_user("dup.test@pyre.com", "Segundo", "otra-clave", "supervisor", db=db)
    finally:
        db.close()
