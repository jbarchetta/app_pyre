from decimal import Decimal

from app.models import FormatoPolos, ParametroCalculo

RAIZ_DE_3 = Decimal("1.732")


def calcular_corriente_nominal(
    carga_valor: Decimal, carga_unidad: str, formato: FormatoPolos, parametros: ParametroCalculo
) -> Decimal:
    if carga_unidad == "A":
        return carga_valor

    if carga_unidad != "kW":
        raise ValueError(f"Unidad de carga no soportada: {carga_unidad}")

    potencia_va = carga_valor * 1000
    if formato == FormatoPolos.TETRAPOLAR:
        denominador = parametros.tension_tri_v * RAIZ_DE_3 * parametros.cos_phi
    else:
        denominador = parametros.tension_mono_v * parametros.cos_phi

    return potencia_va / denominador


def verificar_selectividad(
    nominal_aguas_arriba: Decimal, nominal_propuesto: Decimal, ratio_selectividad: Decimal
) -> bool:
    return nominal_aguas_arriba >= nominal_propuesto * ratio_selectividad
