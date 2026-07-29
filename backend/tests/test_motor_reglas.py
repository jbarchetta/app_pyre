import pytest
from decimal import Decimal
import uuid

from app.models import CatalogoComponente, Tablero, Seccion, Salida, FormatoPolos, TipoProteccion
from app.motor.motor_reglas import (
    calcular_dimensiones_tablero,
    determinar_paso_seccion,
    seleccionar_cablecanal_zoloda,
    seleccionar_gabinete_nollmann,
    seleccionar_distribuidor_nollmed,
)

@pytest.fixture
def seed_test_catalogo(db_session):
    # Seed Nollmann cabinet
    gab = CatalogoComponente(
        proveedor="Nollmann",
        codigo="NIS 450.600.XX",
        codigo_comercial="NIS 450.600.XX",
        categoria_path=["Gabinetes", "Nöll Box"],
        categoria_raiz="Gabinetes",
        descripcion="Test Gabinete NIS 450x600x225 mm",
        unidad="U",
        precio_lista=Decimal("84.00"),
        precio_neto=Decimal("84.00"),
        atributos={
            "tipo": "gabinete",
            "ancho_mm": 450,
            "alto_mm": 600,
            "profundidad_mm": 225,
            "lineas_150": 3,
            "polos_linea_150": 16,
            "total_polos_150": 48,
            "lineas_200": 3,
            "polos_linea_200": 16,
            "total_polos_200": 48,
        },
        archivo_origen="test_seeder",
        fila_origen=0,
    )
    db_session.add(gab)

    # Seed Nöllmed distributor
    dist = CatalogoComponente(
        proveedor="Nöllmed",
        codigo="NRT160",
        codigo_comercial="NRT160",
        categoria_path=["Distribuidores", "Serie NRT"],
        categoria_raiz="Distribuidores",
        descripcion="Test Distribuidor NRT 160A",
        unidad="U",
        precio_lista=Decimal("72.80"),
        precio_neto=Decimal("72.80"),
        atributos={
            "tipo": "distribuidor",
            "corriente_nominal_a": 160,
            "conexiones": 12,
            "series": "NRT"
        },
        archivo_origen="test_seeder",
        fila_origen=0,
    )
    db_session.add(dist)
    db_session.commit()
    return gab, dist


def test_determinar_paso_seccion(db_session):
    seccion = Seccion(nombre="Seccion Test", orden=0)
    
    # Standard output -> Paso 150
    salida1 = Salida(carga_valor=Decimal("10.0"), carga_unidad="A", formato=FormatoPolos.BIPOLAR, tipo_proteccion=TipoProteccion.SECCIONAL_TERMOMAGNETICO)
    paso = determinar_paso_seccion(seccion, [salida1], None)
    assert paso == 150

    # Output with high current -> Paso 200
    salida2 = Salida(carga_valor=Decimal("100.0"), carga_unidad="A", formato=FormatoPolos.TETRAPOLAR, tipo_proteccion=TipoProteccion.SECCIONAL_TERMOMAGNETICO)
    paso = determinar_paso_seccion(seccion, [salida1, salida2], None)
    assert paso == 200

    # Forced Paso 150 manually
    seccion.paso_manual = 150
    paso = determinar_paso_seccion(seccion, [salida1, salida2], None)
    assert paso == 150


def test_seleccionar_gabinete_nollmann(db_session, seed_test_catalogo):
    # Total poles = 30, step = 150 -> NIS 450.600.XX has total_polos_150 = 48
    gabinete = seleccionar_gabinete_nollmann(db_session, total_polos=30, paso=150)
    assert gabinete is not None
    assert gabinete.codigo == "NIS 450.600.XX"

    # Too many poles -> None
    gabinete = seleccionar_gabinete_nollmann(db_session, total_polos=100, paso=150)
    assert gabinete is None


def test_seleccionar_distribuidor_nollmed(db_session, seed_test_catalogo):
    # Current = 100A, connections = 8 -> NRT160 has 160A and 12 connections
    distribuidor = seleccionar_distribuidor_nollmed(db_session, corriente_cabecera=Decimal("100"), conexiones_requeridas=8)
    assert distribuidor is not None
    assert distribuidor.codigo == "NRT160"

    # Too much current -> None
    distribuidor = seleccionar_distribuidor_nollmed(db_session, corriente_cabecera=Decimal("250"), conexiones_requeridas=8)
    assert distribuidor is None


def test_seleccionar_cablecanal_zoloda():
    # Fill limit 65%, area required = 1000 / 0.65 = 1538 mm2 -> 40x40 (area 1600)
    canal = seleccionar_cablecanal_zoloda(Decimal("1000"), Decimal("0.65"))
    assert canal == "40x40"

    # Area required = 4000 / 0.65 = 6153 mm2 -> 80x80 (area 6400)
    canal = seleccionar_cablecanal_zoloda(Decimal("4000"), Decimal("0.65"))
    assert canal == "80x80"


def test_calcular_dimensiones_tablero_integrado(db_session, seed_test_catalogo):
    from app.scripts.create_user import create_user
    from app.models import Proyecto
    analista = create_user("test_motor@pyre.com", "Analista Test", "pwd12345", "analista", db=db_session)
    proyecto = Proyecto(nombre="Proyecto Test", cliente="Cliente Test", analista_id=analista.id)
    db_session.add(proyecto)
    db_session.commit()

    # Create project and tablero
    tablero = Tablero(proyecto_id=proyecto.id, nombre="Tablero Test", nivel_falla_ka=Decimal("10.0"), porcentaje_reserva=20)
    db_session.add(tablero)
    db_session.commit()

    seccion = Seccion(nombre="Seccion 1", tablero_id=tablero.id, orden=0)
    db_session.add(seccion)
    db_session.commit()

    salida = Salida(
        seccion_id=seccion.id,
        carga_valor=Decimal("16.0"),
        carga_unidad="A",
        formato=FormatoPolos.BIPOLAR,
        tipo_proteccion=TipoProteccion.SECCIONAL_TERMOMAGNETICO,
        posicion_orden=1,
    )
    db_session.add(salida)
    db_session.commit()

    res = calcular_dimensiones_tablero(db_session, tablero.id)
    assert res["tablero_id"] == tablero.id
    assert res["paso_maximo"] == 150
    assert res["gabinete_sugerido"]["codigo"] == "NIS 450.600.XX"
    assert res["distribuidor_sugerido"]["codigo"] == "NRT160"
    assert res["cablecanal_sugerido"] == "40x40"
