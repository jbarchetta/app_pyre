import argparse
import sys

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.database import SessionLocal
from app.models import RolUsuario, Usuario


def create_user(email: str, nombre: str, password: str, rol: str, db: Session | None = None) -> Usuario:
    owns_session = db is None
    if db is None:
        db = SessionLocal()
    try:
        existing = db.query(Usuario).filter(Usuario.email == email).first()
        if existing:
            raise ValueError(f"Ya existe un usuario con email {email}")
        if len(password) < 8:
            raise ValueError("La password debe tener al menos 8 caracteres")

        user = Usuario(
            email=email,
            nombre=nombre,
            password_hash=hash_password(password),
            rol=RolUsuario(rol),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Crear usuario (analista o supervisor)")
    parser.add_argument("--email", required=True)
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--rol", required=True, choices=["analista", "supervisor"])
    args = parser.parse_args()

    created = create_user(args.email, args.nombre, args.password, args.rol)
    print(f"Usuario creado: {created.email} ({created.rol.value})")
    sys.exit(0)
