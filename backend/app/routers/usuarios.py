import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.security import hash_password
from app.database import get_db
from app.models import AuditLog, RolUsuario, Usuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


class UsuarioResponse(BaseModel):
    id: str
    email: str
    nombre: str
    rol: str
    activo: bool
    creado_en: datetime

    model_config = {"from_attributes": True}


class CrearUsuarioRequest(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=255)
    rol: RolUsuario
    password: str = Field(..., min_length=8)


class EditarUsuarioRequest(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    rol: Optional[RolUsuario] = None
    activo: Optional[bool] = None


class ResetPasswordAdminRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


def _to_response(u: Usuario) -> UsuarioResponse:
    return UsuarioResponse(
        id=str(u.id),
        email=u.email,
        nombre=u.nombre,
        rol=u.rol.value if isinstance(u.rol, RolUsuario) else str(u.rol),
        activo=u.activo,
        creado_en=u.creado_en,
    )


@router.get("", response_model=List[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR, RolUsuario.SUPERVISOR)),
):
    stmt = select(Usuario).order_by(Usuario.nombre.asc())
    usuarios = db.scalars(stmt).all()
    return [_to_response(u) for u in usuarios]


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    payload: CrearUsuarioRequest,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR)),
):
    email_clean = payload.email.strip().lower()

    existente = db.query(Usuario).filter(Usuario.email == email_clean).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario registrado con este correo electrónico",
        )

    nuevo_usuario = Usuario(
        email=email_clean,
        nombre=payload.nombre.strip(),
        password_hash=hash_password(payload.password),
        rol=payload.rol,
        activo=True,
    )
    db.add(nuevo_usuario)
    db.flush()

    db.add(
        AuditLog(
            usuario_id=admin.id,
            accion="crear_usuario",
            entidad="usuario",
            entidad_id=str(nuevo_usuario.id),
            detalle={"email": email_clean, "rol": payload.rol.value, "nombre": payload.nombre},
        )
    )
    db.commit()
    db.refresh(nuevo_usuario)
    return _to_response(nuevo_usuario)


@router.patch("/{usuario_id}", response_model=UsuarioResponse)
def editar_usuario(
    usuario_id: uuid.UUID,
    payload: EditarUsuarioRequest,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR)),
):
    target = db.get(Usuario, usuario_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    cambios = {}
    if payload.nombre is not None and payload.nombre.strip() != target.nombre:
        cambios["nombre"] = payload.nombre.strip()
        target.nombre = payload.nombre.strip()

    if payload.rol is not None and payload.rol != target.rol:
        cambios["rol"] = payload.rol.value
        target.rol = payload.rol

    if payload.activo is not None and payload.activo != target.activo:
        cambios["activo"] = payload.activo
        target.activo = payload.activo

    if cambios:
        db.add(
            AuditLog(
                usuario_id=admin.id,
                accion="editar_usuario",
                entidad="usuario",
                entidad_id=str(target.id),
                detalle=cambios,
            )
        )
        db.commit()
        db.refresh(target)

    return _to_response(target)


@router.post("/{usuario_id}/reset-password")
def reset_password_admin(
    usuario_id: uuid.UUID,
    payload: ResetPasswordAdminRequest,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR)),
):
    target = db.get(Usuario, usuario_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    target.password_hash = hash_password(payload.new_password)
    db.add(
        AuditLog(
            usuario_id=admin.id,
            accion="reset_password_admin",
            entidad="usuario",
            entidad_id=str(target.id),
            detalle={"admin_email": admin.email, "target_email": target.email},
        )
    )
    db.commit()
    return {"status": "ok", "message": f"Contraseña actualizada para {target.email}"}


@router.delete("/{usuario_id}")
def desactivar_usuario(
    usuario_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR)),
):
    target = db.get(Usuario, usuario_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if target.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés desactivar tu propia cuenta de usuario",
        )

    target.activo = False
    db.add(
        AuditLog(
            usuario_id=admin.id,
            accion="desactivar_usuario",
            entidad="usuario",
            entidad_id=str(target.id),
            detalle={"email": target.email},
        )
    )
    db.commit()
    return {"status": "ok", "message": f"Usuario {target.email} desactivado"}
