from decimal import Decimal

import pytest

from app.models import FormatoPolos, ParametroCalculo
from app.motor.calculo import calcular_corriente_nominal, verificar_selectividad


def _parametros(**overrides):
    defaults = dict(
        tension_mono_v=Decimal("220"),
        tension_tri_v=Decimal("380"),
        cos_phi=Decimal("0.9"),
        ratio_selectividad=Decimal("1.6"),
    )
    defaults.update(overrides)
    return ParametroCalculo(**defaults)


def test_carga_en_amperios_se_devuelve_tal_cual():
    resultado = calcular_corriente_nominal(Decimal("16"), "A", FormatoPolos.UNIPOLAR, _parametros())

    assert resultado == Decimal("16")


def test_carga_en_kw_monofasica_usa_tension_mono_y_cos_phi():
    resultado = calcular_corriente_nominal(Decimal("2"), "kW", FormatoPolos.UNIPOLAR, _parametros())

    assert round(resultado, 2) == Decimal("10.10")


def test_carga_en_kw_bipolar_usa_tambien_tension_mono():
    resultado = calcular_corriente_nominal(Decimal("2"), "kW", FormatoPolos.BIPOLAR, _parametros())

    assert round(resultado, 2) == Decimal("10.10")


def test_carga_en_kw_tetrapolar_usa_tension_tri_y_raiz_de_3():
    resultado = calcular_corriente_nominal(Decimal("10"), "kW", FormatoPolos.TETRAPOLAR, _parametros())

    assert round(resultado, 2) == Decimal("16.88")


def test_unidad_no_soportada_lanza_value_error():
    with pytest.raises(ValueError):
        calcular_corriente_nominal(Decimal("5"), "V", FormatoPolos.UNIPOLAR, _parametros())


def test_selectividad_ok_justo_en_el_limite():
    assert verificar_selectividad(Decimal("32"), Decimal("20"), Decimal("1.6")) is True


def test_selectividad_ok_con_margen():
    assert verificar_selectividad(Decimal("50"), Decimal("20"), Decimal("1.6")) is True


def test_selectividad_falla_por_debajo_del_ratio():
    assert verificar_selectividad(Decimal("31"), Decimal("20"), Decimal("1.6")) is False
