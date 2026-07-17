from decimal import Decimal

from app.models import ParametroCalculo
from app.motor.parametros import obtener_parametros


def test_crea_parametros_por_defecto_si_no_existen(db_session):
    parametros = obtener_parametros(db_session)

    assert parametros.tension_mono_v == Decimal("220.00")
    assert parametros.tension_tri_v == Decimal("380.00")
    assert parametros.cos_phi == Decimal("0.90")
    assert parametros.ratio_selectividad == Decimal("1.60")


def test_devuelve_la_misma_fila_en_llamadas_sucesivas(db_session):
    primera = obtener_parametros(db_session)
    segunda = obtener_parametros(db_session)

    assert primera.id == segunda.id
    assert db_session.query(ParametroCalculo).count() == 1
