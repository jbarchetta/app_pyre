from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import AuditLog, RolUsuario, Usuario

router = APIRouter(prefix="/auditoria", tags=["auditoria"])


class AuditLogResponse(BaseModel):
    id: str
    usuario_id: Optional[str]
    usuario_nombre: Optional[str]
    usuario_email: Optional[str]
    accion: str
    entidad: str
    entidad_id: Optional[str]
    detalle: Optional[Dict[str, Any]]
    creado_en: datetime

    model_config = {"from_attributes": True}


class OpcionesAuditoriaResponse(BaseModel):
    acciones: List[str]
    entidades: List[str]


@router.get("/opciones", response_model=OpcionesAuditoriaResponse)
def obtener_opciones_auditoria(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR, RolUsuario.SUPERVISOR)),
):
    acciones = [r[0] for r in db.query(AuditLog.accion).distinct().all() if r[0]]
    entidades = [r[0] for r in db.query(AuditLog.entidad).distinct().all() if r[0]]
    return OpcionesAuditoriaResponse(acciones=sorted(acciones), entidades=sorted(entidades))


@router.get("", response_model=List[AuditLogResponse])
def listar_auditoria(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR, RolUsuario.SUPERVISOR)),
    q: Optional[str] = Query(None, description="Búsqueda por texto (usuario, acción, entidad)"),
    entidad: Optional[str] = Query(None, description="Filtrar por entidad (ej. usuario, proyecto, catalogo)"),
    accion: Optional[str] = Query(None, description="Filtrar por acción (ej. crear_usuario, login_exitoso)"),
    limit: int = Query(100, ge=1, le=500),
):
    stmt = select(AuditLog).options(joinedload(AuditLog.usuario)).order_by(desc(AuditLog.creado_en)).limit(limit)

    if entidad:
        stmt = stmt.where(AuditLog.entidad == entidad)
    if accion:
        stmt = stmt.where(AuditLog.accion == accion)
    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        stmt = stmt.outerjoin(AuditLog.usuario).where(
            (AuditLog.accion.ilike(search_pattern))
            | (AuditLog.entidad.ilike(search_pattern))
            | (Usuario.nombre.ilike(search_pattern))
            | (Usuario.email.ilike(search_pattern))
        )

    logs = db.scalars(stmt).all()

    resultado = []
    for log in logs:
        resultado.append(
            AuditLogResponse(
                id=str(log.id),
                usuario_id=str(log.usuario_id) if log.usuario_id else None,
                usuario_nombre=log.usuario.nombre if log.usuario else "Sistema / Anónimo",
                usuario_email=log.usuario.email if log.usuario else None,
                accion=log.accion,
                entidad=log.entidad,
                entidad_id=log.entidad_id,
                detalle=log.detalle,
                creado_en=log.creado_en,
            )
        )
    return resultado
