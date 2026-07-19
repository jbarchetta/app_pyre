from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import CatalogoComponente, FormatoPolos, ParametroCalculo, TipoProteccion
from app.motor.calculo import verificar_selectividad

POLOS_POR_FORMATO = {
    FormatoPolos.UNIPOLAR: 1,
    FormatoPolos.BIPOLAR: 2,
    FormatoPolos.TRIPOLAR: 3,
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

    # Los filtros de elegibilidad van en SQL (operadores JSONB, mismo patrón que
    # GET /catalogo/buscar) para no traer todo el catálogo a memoria por cada
    # salida. Solo la selectividad queda en Python: compara Decimals exactos
    # sobre el conjunto ya filtrado (decenas de filas, no miles).
    candidatos = (
        db.query(CatalogoComponente)
        .filter(CatalogoComponente.atributos.isnot(None))
        .filter(CatalogoComponente.precio_neto.isnot(None))
        .filter(CatalogoComponente.atributos["tipo"].as_string() == tipo_proteccion.value)
        .filter(CatalogoComponente.atributos["polos"].as_integer() == polos_requeridos)
        .filter(CatalogoComponente.atributos["corriente_nominal_a"].as_float() >= float(corriente_nominal))
        .filter(CatalogoComponente.atributos["capacidad_corte_ka"].as_float() >= float(capacidad_corte_min))
        .order_by(CatalogoComponente.precio_neto.asc(), CatalogoComponente.codigo.asc())
        .all()
    )

    for candidato in candidatos:
        corriente_candidato = Decimal(str(candidato.atributos["corriente_nominal_a"]))
        if not verificar_selectividad(nominal_aguas_arriba, corriente_candidato, parametros.ratio_selectividad):
            continue

        return candidato

    return None
