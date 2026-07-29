from decimal import Decimal
import uuid
from app.auth.security import hash_password
from app.database import SessionLocal
from app.models import (
    CatalogoComponente,
    FormatoPolos,
    Proyecto,
    RolUsuario,
    Salida,
    Seccion,
    Tablero,
    TipoProteccion,
    Usuario,
)


def seed_demo_data():
    db = SessionLocal()
    try:
        # 1. Usuarios demo
        analista = db.query(Usuario).filter(Usuario.email == "analista@pyre.com").first()
        if not analista:
            analista = Usuario(
                email="analista@pyre.com",
                nombre="Analista Demo",
                password_hash=hash_password("clave-demo-123"),
                rol=RolUsuario.ANALISTA,
            )
            db.add(analista)
            db.commit()
            db.refresh(analista)

        supervisor = db.query(Usuario).filter(Usuario.email == "supervisor@pyre.com").first()
        if not supervisor:
            supervisor = Usuario(
                email="supervisor@pyre.com",
                nombre="Supervisor Demo",
                password_hash=hash_password("clave-demo-123"),
                rol=RolUsuario.SUPERVISOR,
            )
            db.add(supervisor)
            db.commit()

        # Buscar o seleccionar un Interruptor Principal en el catálogo
        interruptor_principal = (
            db.query(CatalogoComponente)
            .filter(CatalogoComponente.codigo_comercial.ilike("%XT%"))
            .first()
            or db.query(CatalogoComponente).first()
        )

        # 2. Proyecto y Tablero Demo
        tablero = db.query(Tablero).first()
        if not tablero:
            proyecto = Proyecto(
                nombre="Proyecto Planta Industrial PYRE",
                cliente="ABB Electrificación",
                analista_id=analista.id,
            )
            db.add(proyecto)
            db.commit()
            db.refresh(proyecto)

            tablero = Tablero(
                nombre="Tablero General T-01",
                proyecto_id=proyecto.id,
                nivel_falla_ka=15.0,
                interruptor_principal_id=interruptor_principal.id if interruptor_principal else None,
            )
            db.add(tablero)
            db.commit()
            db.refresh(tablero)
        else:
            if interruptor_principal and not tablero.interruptor_principal_id:
                tablero.interruptor_principal_id = interruptor_principal.id
                db.commit()

        # 3. Secciones y Salidas
        if db.query(Seccion).filter(Seccion.tablero_id == tablero.id).count() == 0:
            sec1 = Seccion(nombre="Sección A - Acometida Principal", tablero_id=tablero.id, orden=0)
            sec2 = Seccion(nombre="Sección B - Distribución de Motores", tablero_id=tablero.id, orden=1)
            sec3 = Seccion(nombre="Sección C - Servicios Auxiliares", tablero_id=tablero.id, orden=2)
            db.add_all([sec1, sec2, sec3])
            db.commit()
            db.refresh(sec1)
            db.refresh(sec2)
            db.refresh(sec3)

            salidas = [
                Salida(
                    seccion_id=sec1.id,
                    tag="F1.1",
                    descripcion="Circuito Iluminación Nave A",
                    carga_valor=Decimal("10.0"),
                    carga_unidad="A",
                    formato=FormatoPolos.UNIPOLAR,
                    tipo_proteccion=TipoProteccion.SECCIONAL_TERMOMAGNETICO,
                    posicion_orden=1,
                ),
                Salida(
                    seccion_id=sec1.id,
                    tag="F1.2",
                    descripcion="Tomas Tomacorrientes Monofásicos",
                    carga_valor=Decimal("16.0"),
                    carga_unidad="A",
                    formato=FormatoPolos.UNIPOLAR,
                    tipo_proteccion=TipoProteccion.SECCIONAL_TERMOMAGNETICO,
                    posicion_orden=2,
                ),
                Salida(
                    seccion_id=sec2.id,
                    tag="F2.1",
                    descripcion="Motor Bomba Principal 5.5kW",
                    carga_valor=Decimal("25.0"),
                    carga_unidad="A",
                    formato=FormatoPolos.TRIPOLAR,
                    tipo_proteccion=TipoProteccion.SECCIONAL_TERMOMAGNETICO,
                    posicion_orden=1,
                ),
                Salida(
                    seccion_id=sec2.id,
                    tag="F2.2",
                    descripcion="Protección Diferencial Grupo Motores",
                    carga_valor=Decimal("32.0"),
                    carga_unidad="A",
                    formato=FormatoPolos.BIPOLAR,
                    tipo_proteccion=TipoProteccion.SECCIONAL_DIFERENCIAL,
                    posicion_orden=2,
                ),
                Salida(
                    seccion_id=sec3.id,
                    tag="F3.1",
                    descripcion="Alimentación Tablero de Control",
                    carga_valor=Decimal("16.0"),
                    carga_unidad="A",
                    formato=FormatoPolos.BIPOLAR,
                    tipo_proteccion=TipoProteccion.SECCIONAL_TERMOMAGNETICO,
                    posicion_orden=1,
                ),
            ]
            db.add_all(salidas)
            db.commit()

        print("¡Datos demo de proyecto, tablero, interruptor principal y salidas sembrados con éxito!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
