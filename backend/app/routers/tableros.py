import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Proyecto, RolUsuario, Seccion, Tablero, Usuario

router = APIRouter(tags=["tableros"])


class TableroCreate(BaseModel):
    nombre: str
    nivel_falla_ka: Decimal
    interruptor_principal_id: uuid.UUID | None = None


class TableroResponse(BaseModel):
    id: str
    proyecto_id: str
    nombre: str
    nivel_falla_ka: Decimal
    interruptor_principal_id: str | None

    model_config = {"from_attributes": True}


def _tablero_response(tablero: Tablero) -> TableroResponse:
    return TableroResponse(
        id=str(tablero.id),
        proyecto_id=str(tablero.proyecto_id),
        nombre=tablero.nombre,
        nivel_falla_ka=tablero.nivel_falla_ka,
        interruptor_principal_id=str(tablero.interruptor_principal_id)
        if tablero.interruptor_principal_id
        else None,
    )


@router.post(
    "/proyectos/{proyecto_id}/tableros", response_model=TableroResponse, status_code=status.HTTP_201_CREATED
)
def crear_tablero(
    proyecto_id: uuid.UUID,
    payload: TableroCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    tablero = Tablero(
        proyecto_id=proyecto_id,
        nombre=payload.nombre,
        nivel_falla_ka=payload.nivel_falla_ka,
        interruptor_principal_id=payload.interruptor_principal_id,
    )
    db.add(tablero)
    db.commit()
    db.refresh(tablero)
    return _tablero_response(tablero)


@router.get("/proyectos/{proyecto_id}/tableros", response_model=list[TableroResponse])
def listar_tableros(
    proyecto_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    tableros = db.query(Tablero).filter(Tablero.proyecto_id == proyecto_id).all()
    return [_tablero_response(t) for t in tableros]


@router.get("/tableros/{tablero_id}", response_model=TableroResponse)
def obtener_tablero(
    tablero_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")
    return _tablero_response(tablero)


class TableroUpdate(BaseModel):
    nivel_falla_ka: Decimal


@router.patch("/tableros/{tablero_id}", response_model=TableroResponse)
def actualizar_tablero(
    tablero_id: uuid.UUID,
    payload: TableroUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")

    tablero.nivel_falla_ka = payload.nivel_falla_ka
    db.commit()
    db.refresh(tablero)
    return _tablero_response(tablero)


class SeccionCreate(BaseModel):
    nombre: str
    orden: int = 0


class SeccionResponse(BaseModel):
    id: str
    tablero_id: str
    nombre: str
    orden: int

    model_config = {"from_attributes": True}


def _seccion_response(seccion: Seccion) -> SeccionResponse:
    return SeccionResponse(
        id=str(seccion.id), tablero_id=str(seccion.tablero_id), nombre=seccion.nombre, orden=seccion.orden
    )


@router.post("/tableros/{tablero_id}/secciones", response_model=SeccionResponse, status_code=status.HTTP_201_CREATED)
def crear_seccion(
    tablero_id: uuid.UUID,
    payload: SeccionCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")

    seccion = Seccion(tablero_id=tablero_id, nombre=payload.nombre, orden=payload.orden)
    db.add(seccion)
    db.commit()
    db.refresh(seccion)
    return _seccion_response(seccion)


@router.get("/tableros/{tablero_id}/secciones", response_model=list[SeccionResponse])
def listar_secciones(
    tablero_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")
    secciones = db.query(Seccion).filter(Seccion.tablero_id == tablero_id).order_by(Seccion.orden).all()
    return [_seccion_response(s) for s in secciones]
