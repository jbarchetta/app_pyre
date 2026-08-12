from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.models import AuditLog, RolUsuario, Usuario

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UsuarioResponse(BaseModel):
    id: str
    email: str
    nombre: str
    rol: str

    model_config = {"from_attributes": True}


def _to_response(user: Usuario) -> UsuarioResponse:
    return UsuarioResponse(id=str(user.id), email=user.email, nombre=user.nombre, rol=user.rol.value)


@router.post("/login", response_model=UsuarioResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email_clean = payload.email.strip().lower()
    if "@" not in email_clean:
        email_clean = f"{email_clean}@pyre.com"

    # Si usuarios demo no existen en entorno dev/test, asegurarlos al vuelo
    if settings.environment != "production":
        demos = [
            ("analista@pyre.com", "Analista Demo", RolUsuario.ANALISTA),
            ("supervisor@pyre.com", "Supervisor Demo", RolUsuario.SUPERVISOR),
            ("administrador@pyre.com", "Administrador PYRE", RolUsuario.ADMINISTRADOR),
            ("desarrollador@pyre.com", "Desarrollador Sistema", RolUsuario.DESARROLLADOR),
        ]
        for demo_email, demo_nombre, demo_rol in demos:
            if db.query(Usuario).filter(Usuario.email == demo_email).first() is None:
                db.add(
                    Usuario(
                        email=demo_email,
                        nombre=demo_nombre,
                        password_hash=hash_password("clave-demo-123"),
                        rol=demo_rol,
                    )
                )
                db.commit()

    user = db.query(Usuario).filter(Usuario.email == email_clean).first()
    es_valido = user is not None and verify_password(payload.password, user.password_hash)

    if user is None or not es_valido:
        db.add(
            AuditLog(
                usuario_id=user.id if user else None,
                accion="login_fallido",
                entidad="usuario",
                entidad_id=payload.email,
                detalle={"motivo": "credenciales_invalidas"},
            )
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    db.add(
        AuditLog(
            usuario_id=user.id,
            accion="login_exitoso",
            entidad="usuario",
            entidad_id=payload.email,
        )
    )
    db.commit()

    token = create_access_token(subject=str(user.id), rol=user.rol.value if isinstance(user.rol, RolUsuario) else str(user.rol))
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
    )
    return _to_response(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"status": "ok"}


@router.get("/me", response_model=UsuarioResponse)
def me(user: Usuario = Depends(get_current_user)):
    return _to_response(user)


class ChangePasswordSelfRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password_self(
    payload: ChangePasswordSelfRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta")

    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 8 caracteres",
        )

    user.password_hash = hash_password(payload.new_password)
    db.add(
        AuditLog(
            usuario_id=user.id,
            accion="cambiar_password_autogestion",
            entidad="usuario",
            entidad_id=user.email,
        )
    )
    db.commit()
    return {"status": "ok", "message": "Contraseña actualizada con éxito"}


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str


# Sin autenticación a propósito para reseteo dev/recuperación
@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email_clean = payload.email.strip().lower()
    user = db.query(Usuario).filter(Usuario.email == email_clean).first()
    if not user:
        if settings.environment != "production" and email_clean.endswith("@pyre.com"):
            rol_usuario = RolUsuario.SUPERVISOR if "supervisor" in email_clean else RolUsuario.ANALISTA
            user = Usuario(
                email=email_clean,
                nombre=email_clean.split("@")[0].replace(".", " ").title(),
                password_hash=hash_password(payload.new_password if len(payload.new_password) >= 8 else "clave-demo-123"),
                rol=rol_usuario,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontró un usuario con ese correo electrónico")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña debe tener al menos 8 caracteres")

    user.password_hash = hash_password(payload.new_password)
    db.add(
        AuditLog(
            usuario_id=user.id,
            accion="reset_password",
            entidad="usuario",
            entidad_id=email_clean,
        )
    )
    db.commit()
    return {"status": "ok", "message": "Contraseña restablecida exitosamente"}
