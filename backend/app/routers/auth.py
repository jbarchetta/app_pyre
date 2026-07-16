from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, verify_password
from app.config import settings
from app.database import get_db
from app.models import Usuario

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
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
    user = db.query(Usuario).filter(Usuario.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    token = create_access_token(subject=str(user.id), rol=user.rol.value)
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
