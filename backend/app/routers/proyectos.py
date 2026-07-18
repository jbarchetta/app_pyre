import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario

router = APIRouter(prefix="/proyectos", tags=["proyectos"])


class ProyectoCreate(BaseModel):
    cliente: str
    nombre: str


class ProyectoResponse(BaseModel):
    id: str
    cliente: str
    nombre: str
    analista_id: str
    estado: str

    model_config = {"from_attributes": True}


def _to_response(proyecto: Proyecto) -> ProyectoResponse:
    return ProyectoResponse(
        id=str(proyecto.id),
        cliente=proyecto.cliente,
        nombre=proyecto.nombre,
        analista_id=str(proyecto.analista_id),
        estado=proyecto.estado.value,
    )


@router.post("", response_model=ProyectoResponse, status_code=status.HTTP_201_CREATED)
def crear_proyecto(
    payload: ProyectoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = Proyecto(cliente=payload.cliente, nombre=payload.nombre, analista_id=usuario.id)
    db.add(proyecto)
    db.commit()
    db.refresh(proyecto)
    return _to_response(proyecto)


@router.get("", response_model=list[ProyectoResponse])
def listar_proyectos(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    proyectos = db.query(Proyecto).all()
    return [_to_response(p) for p in proyectos]


@router.get("/{proyecto_id}", response_model=ProyectoResponse)
def obtener_proyecto(
    proyecto_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    return _to_response(proyecto)


class ProyectoUpdate(BaseModel):
    nombre: str | None = None
    cliente: str | None = None


@router.patch("/{proyecto_id}", response_model=ProyectoResponse)
def actualizar_proyecto(
    proyecto_id: uuid.UUID,
    payload: ProyectoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        proyecto.nombre = cambios["nombre"]
    if "cliente" in cambios:
        proyecto.cliente = cambios["cliente"]

    db.commit()
    db.refresh(proyecto)
    return _to_response(proyecto)


@router.delete("/{proyecto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_proyecto(
    proyecto_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

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
