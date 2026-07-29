from decimal import Decimal

from sqlalchemy import or_
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
    sensibilidad_ma: int | None = None,
    admite_accesorios: bool | None = None,
) -> CatalogoComponente | None:
    polos_requeridos = POLOS_POR_FORMATO[formato]

    # Los filtros de elegibilidad van en SQL (operadores JSONB, mismo patrón que
    # GET /catalogo/buscar) para no traer todo el catálogo a memoria por cada
    # salida. Solo la selectividad queda en Python: compara Decimals exactos
    # sobre el conjunto ya filtrado (decenas de filas, no miles).
    query = (
        db.query(CatalogoComponente)
        .filter(CatalogoComponente.atributos.isnot(None))
        .filter(CatalogoComponente.precio_neto.isnot(None))
        .filter(CatalogoComponente.atributos["tipo"].as_string() == tipo_proteccion.value)
        .filter(CatalogoComponente.atributos["polos"].as_integer() == polos_requeridos)
        .filter(CatalogoComponente.atributos["corriente_nominal_a"].as_float() >= float(corriente_nominal))
    )

    if tipo_proteccion != TipoProteccion.SECCIONAL_DIFERENCIAL:
        query = query.filter(CatalogoComponente.atributos["capacidad_corte_ka"].as_float() >= float(capacidad_corte_min))


    if tipo_proteccion == TipoProteccion.SECCIONAL_DIFERENCIAL:
        if sensibilidad_ma is not None:
            query = query.filter(CatalogoComponente.atributos["sensibilidad_ma"].as_integer() == sensibilidad_ma)
        if admite_accesorios is not None:
            if admite_accesorios is False:
                query = query.filter(
                    or_(
                        CatalogoComponente.atributos["admite_accesorios"].as_boolean() == False,
                        CatalogoComponente.atributos["admite_accesorios"].is_(None)
                    )
                )
            else:
                query = query.filter(CatalogoComponente.atributos["admite_accesorios"].as_boolean() == True)

    candidatos = query.order_by(CatalogoComponente.precio_neto.asc(), CatalogoComponente.codigo.asc()).all()

    for candidato in candidatos:
        if tipo_proteccion != TipoProteccion.SECCIONAL_DIFERENCIAL:
            corriente_candidato = Decimal(str(candidato.atributos["corriente_nominal_a"]))
            if not verificar_selectividad(nominal_aguas_arriba, corriente_candidato, parametros.ratio_selectividad):
                continue

        return candidato

    return None


def proponer_componente_con_diagnostico(
    db: Session,
    tipo_proteccion: TipoProteccion,
    formato: FormatoPolos,
    corriente_nominal: Decimal,
    capacidad_corte_min: Decimal,
    nominal_aguas_arriba: Decimal,
    parametros: ParametroCalculo,
    sensibilidad_ma: int | None = None,
    admite_accesorios: bool | None = None,
) -> tuple[CatalogoComponente | None, str | None]:
    candidato = proponer_componente(
        db,
        tipo_proteccion,
        formato,
        corriente_nominal,
        capacidad_corte_min,
        nominal_aguas_arriba,
        parametros,
        sensibilidad_ma=sensibilidad_ma,
        admite_accesorios=admite_accesorios,
    )
    if candidato is not None:
        return candidato, None

    polos_requeridos = POLOS_POR_FORMATO[formato]

    # Base query for diagnostic fallback checks
    base_q = (
        db.query(CatalogoComponente)
        .filter(CatalogoComponente.atributos.isnot(None))
        .filter(CatalogoComponente.atributos["tipo"].as_string() == tipo_proteccion.value)
        .filter(CatalogoComponente.atributos["polos"].as_integer() == polos_requeridos)
    )

    if tipo_proteccion == TipoProteccion.SECCIONAL_DIFERENCIAL:
        if sensibilidad_ma is not None:
            base_q = base_q.filter(CatalogoComponente.atributos["sensibilidad_ma"].as_integer() == sensibilidad_ma)
        if admite_accesorios is not None:
            if admite_accesorios is False:
                base_q = base_q.filter(
                    or_(
                        CatalogoComponente.atributos["admite_accesorios"].as_boolean() == False,
                        CatalogoComponente.atributos["admite_accesorios"].is_(None)
                    )
                )
            else:
                base_q = base_q.filter(CatalogoComponente.atributos["admite_accesorios"].as_boolean() == True)

    tiene_tipo_polos = base_q.first() is not None
    if not tiene_tipo_polos:
        msg = f"No existen componentes de tipo {tipo_proteccion.value} con {polos_requeridos} polo(s)"
        if tipo_proteccion == TipoProteccion.SECCIONAL_DIFERENCIAL:
            details = []
            if sensibilidad_ma is not None:
                details.append(f"sensibilidad {sensibilidad_ma} mA")
            if admite_accesorios is True:
                details.append("con accesorios")
            elif admite_accesorios is False:
                details.append("sin accesorios")
            if details:
                msg += f" ({', '.join(details)})"
        msg += " en el catálogo."
        return None, msg

    tiene_corriente = (
        base_q.filter(CatalogoComponente.atributos["corriente_nominal_a"].as_float() >= float(corriente_nominal))
        .first() is not None
    )
    if not tiene_corriente:
        return None, f"No hay componentes de {tipo_proteccion.value} que soporten {corriente_nominal} A en este formato."

    if tipo_proteccion != TipoProteccion.SECCIONAL_DIFERENCIAL:
        tiene_icc = (
            base_q.filter(CatalogoComponente.atributos["corriente_nominal_a"].as_float() >= float(corriente_nominal))
            .filter(CatalogoComponente.atributos["capacidad_corte_ka"].as_float() >= float(capacidad_corte_min))
            .first() is not None
        )
        if not tiene_icc:
            return None, f"No hay componentes con Icn/Icu >= {capacidad_corte_min} kA para una carga de {corriente_nominal} A."

    if tipo_proteccion == TipoProteccion.SECCIONAL_DIFERENCIAL:
        return None, "No se encontró ningún componente compatible en el catálogo."
    return None, f"Sin match por selectividad con el interruptor principal ({nominal_aguas_arriba} A, ratio {parametros.ratio_selectividad})."

