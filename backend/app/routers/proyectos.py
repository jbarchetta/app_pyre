from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.ownership import obtener_proyecto_autorizado
from app.database import get_db
from app.models import Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario
from app.routers.paginacion import LIMITE_POR_DEFECTO, acotar_paginacion

router = APIRouter(prefix="/proyectos", tags=["proyectos"])


class ProyectoCreate(BaseModel):
    cliente: str
    nombre: str
    codigo_obra: str | None = None
    fecha_inicio: datetime | None = None


class ProyectoResponse(BaseModel):
    id: str
    cliente: str
    nombre: str
    codigo_obra: str | None = None
    fecha_inicio: str | None = None
    analista_id: str
    analista_nombre: str | None = None
    analista_email: str | None = None
    estado: str
    creado_en: str | None = None

    model_config = {"from_attributes": True}


def _to_response(proyecto: Proyecto, analista: Usuario | None = None) -> ProyectoResponse:
    return ProyectoResponse(
        id=str(proyecto.id),
        cliente=proyecto.cliente,
        nombre=proyecto.nombre,
        codigo_obra=proyecto.codigo_obra,
        fecha_inicio=proyecto.fecha_inicio.isoformat() if proyecto.fecha_inicio else None,
        analista_id=str(proyecto.analista_id),
        analista_nombre=analista.nombre if analista else None,
        analista_email=analista.email if analista else None,
        estado=proyecto.estado.value,
        creado_en=proyecto.creado_en.isoformat() if proyecto.creado_en else None,
    )


@router.post("", response_model=ProyectoResponse, status_code=status.HTTP_201_CREATED)
def crear_proyecto(
    payload: ProyectoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = Proyecto(
        cliente=payload.cliente,
        nombre=payload.nombre,
        codigo_obra=payload.codigo_obra,
        fecha_inicio=payload.fecha_inicio,
        analista_id=usuario.id,
    )
    db.add(proyecto)
    db.commit()
    db.refresh(proyecto)
    return _to_response(proyecto, usuario)


@router.get("", response_model=list[ProyectoResponse])
def listar_proyectos(
    limit: int = LIMITE_POR_DEFECTO,
    offset: int = 0,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    # Autorización por propiedad (ciclo 8): el analista solo ve sus proyectos;
    # el supervisor ve todos. Orden: más nuevos primero (estable para paginar).
    limit, offset = acotar_paginacion(limit, offset)
    consulta = db.query(Proyecto)
    if usuario.rol != RolUsuario.SUPERVISOR:
        consulta = consulta.filter(Proyecto.analista_id == usuario.id)
    proyectos = consulta.order_by(Proyecto.creado_en.desc(), Proyecto.id).offset(offset).limit(limit).all()
    
    analista_ids = {p.analista_id for p in proyectos}
    analistas_dict = {u.id: u for u in db.query(Usuario).filter(Usuario.id.in_(analista_ids)).all()} if analista_ids else {}
    return [_to_response(p, analistas_dict.get(p.analista_id)) for p in proyectos]


@router.get("/{proyecto_id}", response_model=ProyectoResponse)
def obtener_proyecto(
    proyecto_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    proyecto = obtener_proyecto_autorizado(db, proyecto_id, usuario)
    analista = db.get(Usuario, proyecto.analista_id)
    return _to_response(proyecto, analista)


class ProyectoUpdate(BaseModel):
    nombre: str | None = None
    cliente: str | None = None
    codigo_obra: str | None = None
    fecha_inicio: datetime | None = None
    estado: str | None = None
    # Reasignación de propiedad: solo la puede setear un supervisor (ver endpoint).
    analista_id: uuid.UUID | None = None


@router.patch("/{proyecto_id}", response_model=ProyectoResponse)
def actualizar_proyecto(
    proyecto_id: uuid.UUID,
    payload: ProyectoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = obtener_proyecto_autorizado(db, proyecto_id, usuario)

    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        proyecto.nombre = cambios["nombre"]
    if "cliente" in cambios:
        proyecto.cliente = cambios["cliente"]
    if "codigo_obra" in cambios:
        proyecto.codigo_obra = cambios["codigo_obra"]
    if "fecha_inicio" in cambios:
        proyecto.fecha_inicio = cambios["fecha_inicio"]
    if "estado" in cambios:
        proyecto.estado = cambios["estado"]
    if "analista_id" in cambios:
        if usuario.rol != RolUsuario.SUPERVISOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un supervisor puede reasignar el analista de un proyecto",
            )
        nuevo_analista = db.get(Usuario, cambios["analista_id"])
        if nuevo_analista is None or nuevo_analista.rol != RolUsuario.ANALISTA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="analista_id debe ser un usuario con rol analista existente",
            )
        proyecto.analista_id = nuevo_analista.id

    db.commit()
    db.refresh(proyecto)
    analista = db.get(Usuario, proyecto.analista_id)
    return _to_response(proyecto, analista)


@router.delete("/{proyecto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_proyecto(
    proyecto_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = obtener_proyecto_autorizado(db, proyecto_id, usuario)

    # No hay ondelete="CASCADE" en el esquema -- el borrado en cascada se hace
    # a mano acá, en orden hijo-a-padre, dentro de la misma transacción.
    tablero_ids = [t.id for t in db.query(Tablero.id).filter(Tablero.proyecto_id == proyecto_id)]
    if tablero_ids:
        seccion_ids = [s.id for s in db.query(Seccion.id).filter(Seccion.tablero_id.in_(tablero_ids))]
        if seccion_ids:
            db.query(Salida).filter(Salida.seccion_id.in_(seccion_ids)).delete(synchronize_session=False)
            db.query(Seccion).filter(Seccion.id.in_(seccion_ids)).delete(synchronize_session=False)
        db.query(Tablero).filter(Tablero.id.in_(tablero_ids)).delete(synchronize_session=False)

    db.delete(proyecto)
    db.commit()
