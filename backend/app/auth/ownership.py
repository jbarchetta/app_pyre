"""Autorización por propiedad de proyecto (ciclo 8).

Regla de negocio: el analista opera solo sus propios proyectos
(`proyecto.analista_id == usuario.id`); el supervisor accede a todos. Los
recursos anidados heredan la propiedad del proyecto raíz:
tablero → proyecto, seccion → tablero → proyecto, salida → seccion → tablero → proyecto.

Cada helper resuelve el recurso (404 si no existe) y verifica acceso (403 si
es de otro analista), para que los routers no repitan la cadena de padres.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import AuditLog, Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario


def verificar_acceso_proyecto(db: Session, proyecto: Proyecto, usuario: Usuario, recurso: str = "proyecto") -> None:
    if usuario.rol in (RolUsuario.SUPERVISOR, RolUsuario.ADMINISTRADOR, RolUsuario.DESARROLLADOR):
        return
    if proyecto.analista_id != usuario.id:
        # commit ANTES de levantar el 403 -- el raise hace rollback de la
        # request, no del evento de auditoría ya agregado a la sesión.
        db.add(
            AuditLog(
                usuario_id=usuario.id,
                accion="acceso_denegado_propiedad",
                entidad="proyecto",
                entidad_id=str(proyecto.id),
                detalle={"recurso": recurso, "usuario_id": str(usuario.id)},
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado: el proyecto pertenece a otro analista",
        )


def obtener_proyecto_autorizado(db: Session, proyecto_id: uuid.UUID, usuario: Usuario) -> Proyecto:
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    verificar_acceso_proyecto(db, proyecto, usuario, recurso="proyecto")
    return proyecto


def obtener_tablero_autorizado(db: Session, tablero_id: uuid.UUID, usuario: Usuario) -> Tablero:
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")
    verificar_acceso_proyecto(db, db.get(Proyecto, tablero.proyecto_id), usuario, recurso="tablero")
    return tablero


def obtener_seccion_autorizada(db: Session, seccion_id: uuid.UUID, usuario: Usuario) -> Seccion:
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    tablero = db.get(Tablero, seccion.tablero_id)
    verificar_acceso_proyecto(db, db.get(Proyecto, tablero.proyecto_id), usuario, recurso="seccion")
    return seccion


def obtener_salida_autorizada(db: Session, salida_id: uuid.UUID, usuario: Usuario) -> Salida:
    salida = db.get(Salida, salida_id)
    if salida is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salida no encontrada")
    seccion = db.get(Seccion, salida.seccion_id)
    tablero = db.get(Tablero, seccion.tablero_id)
    verificar_acceso_proyecto(db, db.get(Proyecto, tablero.proyecto_id), usuario, recurso="salida")
    return salida
