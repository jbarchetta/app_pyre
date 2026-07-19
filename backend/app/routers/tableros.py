import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import CatalogoComponente, Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario

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
    interruptor_principal_codigo: str | None
    interruptor_principal_codigo_comercial: str | None
    interruptor_principal_descripcion: str | None = None
    interruptor_principal_polos: int | None = None
    interruptor_principal_corriente_nominal_a: Decimal | None = None
    interruptor_principal_capacidad_corte_ka: Decimal | None = None

    model_config = {"from_attributes": True}


def _tablero_response(db: Session, tablero: Tablero) -> TableroResponse:
    componente = (
        db.get(CatalogoComponente, tablero.interruptor_principal_id)
        if tablero.interruptor_principal_id
        else None
    )
    atributos = componente.atributos or {} if componente else {}
    return TableroResponse(
        id=str(tablero.id),
        proyecto_id=str(tablero.proyecto_id),
        nombre=tablero.nombre,
        nivel_falla_ka=tablero.nivel_falla_ka,
        interruptor_principal_id=str(tablero.interruptor_principal_id)
        if tablero.interruptor_principal_id
        else None,
        interruptor_principal_codigo=componente.codigo if componente else None,
        interruptor_principal_codigo_comercial=componente.codigo_comercial if componente else None,
        interruptor_principal_descripcion=componente.descripcion if componente else None,
        interruptor_principal_polos=atributos.get("polos"),
        interruptor_principal_corriente_nominal_a=Decimal(str(atributos["corriente_nominal_a"]))
        if "corriente_nominal_a" in atributos and atributos["corriente_nominal_a"] is not None
        else None,
        interruptor_principal_capacidad_corte_ka=Decimal(str(atributos["capacidad_corte_ka"]))
        if "capacidad_corte_ka" in atributos and atributos["capacidad_corte_ka"] is not None
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
    return _tablero_response(db, tablero)


@router.get("/proyectos/{proyecto_id}/tableros", response_model=list[TableroResponse])
def listar_tableros(
    proyecto_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    tableros = db.query(Tablero).filter(Tablero.proyecto_id == proyecto_id).all()
    return [_tablero_response(db, t) for t in tableros]


@router.get("/tableros/{tablero_id}", response_model=TableroResponse)
def obtener_tablero(
    tablero_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")
    return _tablero_response(db, tablero)


class TableroUpdate(BaseModel):
    nombre: str | None = None
    nivel_falla_ka: Decimal | None = None
    interruptor_principal_id: uuid.UUID | None = None


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

    # exclude_unset: un PATCH solo toca los campos que el cliente mandó — mandar
    # nivel_falla_ka sin interruptor_principal_id no debe borrar este último.
    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        tablero.nombre = cambios["nombre"]
    if "nivel_falla_ka" in cambios:
        tablero.nivel_falla_ka = cambios["nivel_falla_ka"]
    if "interruptor_principal_id" in cambios:
        tablero.interruptor_principal_id = cambios["interruptor_principal_id"]

    db.commit()
    db.refresh(tablero)
    return _tablero_response(db, tablero)


@router.delete("/tableros/{tablero_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tablero(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")

    seccion_ids = [s.id for s in db.query(Seccion.id).filter(Seccion.tablero_id == tablero_id)]
    if seccion_ids:
        db.query(Salida).filter(Salida.seccion_id.in_(seccion_ids)).delete(synchronize_session=False)
        db.query(Seccion).filter(Seccion.id.in_(seccion_ids)).delete(synchronize_session=False)

    db.delete(tablero)
    db.commit()


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


class SeccionUpdate(BaseModel):
    nombre: str | None = None


@router.patch("/secciones/{seccion_id}", response_model=SeccionResponse)
def actualizar_seccion(
    seccion_id: uuid.UUID,
    payload: SeccionUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")

    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        seccion.nombre = cambios["nombre"]

    db.commit()
    db.refresh(seccion)
    return _seccion_response(seccion)


@router.delete("/secciones/{seccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_seccion(
    seccion_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")

    db.query(Salida).filter(Salida.seccion_id == seccion_id).delete(synchronize_session=False)
    db.delete(seccion)
    db.commit()
