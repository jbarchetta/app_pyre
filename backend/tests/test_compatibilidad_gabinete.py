import pytest
from app.models import Tablero, Seccion, Salida, CatalogoComponente, Proyecto, Usuario, RolUsuario
from app.motor.motor_reglas import validar_compatibilidad_gabinete_nollmann
from app.auth.security import hash_password

def test_validar_compatibilidad_gabinete_insuficiente_filas(db_session):
    usuario = Usuario(nombre="Analista", email="analista_comp@test.com", password_hash=hash_password("Pass123!"), rol=RolUsuario.ANALISTA)
    db_session.add(usuario)
    db_session.commit()

    proyecto = Proyecto(nombre="Proy Comp Test", cliente="Cliente Test", analista_id=usuario.id)
    db_session.add(proyecto)
    db_session.commit()

    tablero = Tablero(
        proyecto_id=proyecto.id,
        nombre="Tablero 2 Filas",
        nivel_falla_ka="10",
    )
    db_session.add(tablero)
    db_session.commit()

    gabs = db_session.query(CatalogoComponente).filter(CatalogoComponente.categoria_raiz.ilike("%gabinete%")).all()
    # tomar el primer gabinete disponible
    if gabs:
        w_existente = gabs[0].atributos.get("ancho_mm", 600)
        h_existente = gabs[0].atributos.get("alto_mm", 750)
        filas_max = gabs[0].atributos.get("lineas_150", 3)

        # Crear 1 fila más que la capacidad máxima del gabinete
        secciones = [Seccion(tablero_id=tablero.id, nombre=f"Fila {i+1}", orden=i) for i in range(filas_max + 1)]
        db_session.add_all(secciones)
        db_session.commit()

        es_valido, motivo = validar_compatibilidad_gabinete_nollmann(db_session, tablero.id, w_existente, h_existente)
        assert es_valido is False
        assert f"requiere al menos {filas_max + 1} fila(s)" in motivo

def test_validar_compatibilidad_gabinete_suficiente(db_session):
    tablero = db_session.query(Tablero).filter_by(nombre="Tablero 2 Filas").first()
    if not tablero:
        return
    # NIS 450.750 (450x750 mm) admite hasta 4 filas de 150mm
    es_valido, motivo = validar_compatibilidad_gabinete_nollmann(db_session, tablero.id, 450, 750, paso_override=150)
    assert es_valido is True
    assert motivo == ""

def test_validar_compatibilidad_paso_200_insuficiente(db_session):
    tablero = db_session.query(Tablero).filter_by(nombre="Tablero 2 Filas").first()
    if not tablero:
        return
    # NIS 450.750 con paso 200 admite solo 3 filas. Si pedimos paso 200 con 4 filas se debe rechazar.
    es_valido, motivo = validar_compatibilidad_gabinete_nollmann(db_session, tablero.id, 450, 750, paso_override=200)
    assert es_valido is False
    assert "admite un máximo de 3 fila(s) para Paso 200mm" in motivo

def test_validar_compatibilidad_incremento_filas(db_session):
    tablero = db_session.query(Tablero).filter_by(nombre="Tablero 2 Filas").first()
    if not tablero:
        return
    # Con 4 filas actuales, simular agregar 1 fila más (incremento_filas=1 -> 5 filas) en NIS 450.750 (max 4 filas)
    es_valido, motivo = validar_compatibilidad_gabinete_nollmann(db_session, tablero.id, 450, 750, paso_override=150, incremento_filas=1)
    assert es_valido is False
    assert "admite un máximo de 4 fila(s)" in motivo
