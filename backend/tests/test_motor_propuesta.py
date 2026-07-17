from decimal import Decimal

from app.models import CatalogoComponente, FormatoPolos, ParametroCalculo, TipoProteccion
from app.motor.propuesta import proponer_componente


def _parametros(**overrides):
    defaults = dict(
        tension_mono_v=Decimal("220"),
        tension_tri_v=Decimal("380"),
        cos_phi=Decimal("0.9"),
        ratio_selectividad=Decimal("1.6"),
    )
    defaults.update(overrides)
    return ParametroCalculo(**defaults)


def _componente(db_session, codigo, tipo="seccional_termomagnetico", polos=1, corriente=20, ka=6, precio="50.00"):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=f"Interruptor {codigo}",
        unidad="Unidad",
        precio_neto=Decimal(precio),
        atributos={"tipo": tipo, "polos": polos, "corriente_nominal_a": corriente, "capacidad_corte_ka": ka},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


# NOTE: catalogo_componente is a session-scoped shared table (no per-test rollback,
# same convention as tests/test_upsert_catalogo.py) — rows from earlier tests in this
# file stay visible to later ones. "No match" tests use thresholds no fixture in this
# file can satisfy (e.g. corriente_nominal=500) so they stay correct regardless of
# execution order, instead of relying on the table being empty.


def test_propone_el_mas_barato_que_cumple(db_session):
    # precio deliberadamente por debajo de 50.00 (el precio por defecto de otros
    # fixtures del resto de la suite, ej. test_motor_configuracion_integracion.py)
    # para que este test sea robusto sin importar qué otros archivos ya corrieron.
    _componente(db_session, "PROP-C1", corriente=20, ka=6, precio="30.00")
    barato = _componente(db_session, "PROP-C2", corriente=20, ka=6, precio="15.00")

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado.id == barato.id


def test_sin_match_por_corriente_insuficiente(db_session):
    _componente(db_session, "PROP-C3", corriente=10, ka=6)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("500"), Decimal("6"), Decimal("2000"), _parametros(),
    )

    assert resultado is None


def test_sin_match_por_capacidad_de_corte_insuficiente(db_session):
    _componente(db_session, "PROP-C4", corriente=20, ka=4)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("500"), Decimal("40"), _parametros(),
    )

    assert resultado is None


def test_sin_match_por_selectividad(db_session):
    _componente(db_session, "PROP-C5", corriente=20, ka=6)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("30"), _parametros(),
    )

    assert resultado is None


def test_ignora_componentes_de_otro_tipo_o_polos(db_session):
    _componente(db_session, "PROP-C6", tipo="seccional_diferencial", polos=1, corriente=25, ka=6)
    _componente(db_session, "PROP-C7", tipo="seccional_termomagnetico", polos=2, corriente=25, ka=6)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("21"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado is None


def test_empate_de_precio_desempata_por_codigo(db_session):
    _componente(db_session, "PROP-C9", corriente=20, ka=6, precio="10.00")
    primero = _componente(db_session, "PROP-C8", corriente=20, ka=6, precio="10.00")

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado.codigo == primero.codigo == "PROP-C8"


def test_sin_candidatos_devuelve_none(db_session):
    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("999999"), Decimal("999"), Decimal("40"), _parametros(),
    )

    assert resultado is None
