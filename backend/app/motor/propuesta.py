from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import CatalogoComponente, FormatoPolos, ParametroCalculo, TipoProteccion
from app.motor.calculo import verificar_selectividad

POLOS_POR_FORMATO = {
    FormatoPolos.UNIPOLAR: 1,
    FormatoPolos.BIPOLAR: 2,
    FormatoPolos.TETRAPOLAR: 4,
}


def proponer_componente(
    db: Session,
    tipo_proteccion: TipoProteccion,
    formato: FormatoPolos,
    corriente_nominal: Decimal,
    capacidad_corte_min: Decimal,
    nominal_aguas_arriba: Decimal,
    parametros: ParametroCalculo,
) -> CatalogoComponente | None:
    polos_requeridos = POLOS_POR_FORMATO[formato]

    candidatos = (
        db.query(CatalogoComponente)
        .filter(CatalogoComponente.atributos.isnot(None))
        .filter(CatalogoComponente.precio_neto.isnot(None))
        .order_by(CatalogoComponente.precio_neto.asc(), CatalogoComponente.codigo.asc())
        .all()
    )

    for candidato in candidatos:
        atributos = candidato.atributos
        if atributos.get("tipo") != tipo_proteccion.value:
            continue
        if atributos.get("polos") != polos_requeridos:
            continue

        corriente_candidato = Decimal(str(atributos.get("corriente_nominal_a", 0)))
        if corriente_candidato < corriente_nominal:
            continue
        if Decimal(str(atributos.get("capacidad_corte_ka", 0))) < capacidad_corte_min:
            continue
        if not verificar_selectividad(nominal_aguas_arriba, corriente_candidato, parametros.ratio_selectividad):
            continue

        return candidato

    return None
