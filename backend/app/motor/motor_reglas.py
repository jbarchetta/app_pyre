import uuid
from decimal import Decimal
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session

from app.models import CatalogoComponente, Tablero, Seccion, Salida, FormatoPolos
from app.motor.diametro_cables import obtener_area_cuadrada_cable
from app.motor.calculo import calcular_corriente_nominal

# Mapeo de Corriente Nominal a Sección de conductor y tipo (Tabla_Seccion_Conductores)
def obtener_datos_conductor(corriente: Decimal) -> dict:
    """
    Retorna la sección del conductor (en mm²), cantidad de cables y si es barra de cobre,
    basado en la Tabla_Seccion_Conductores.pdf.
    """
    if corriente <= Decimal("16"):
        return {"tipo": "cable", "seccion": Decimal("2.5"), "cantidad": 1, "es_barra": False, "desc": "2,5 mm²"}
    elif corriente <= Decimal("20"):
        return {"tipo": "cable", "seccion": Decimal("4.0"), "cantidad": 1, "es_barra": False, "desc": "4 mm²"}
    elif corriente <= Decimal("32"):
        return {"tipo": "cable", "seccion": Decimal("6.0"), "cantidad": 1, "es_barra": False, "desc": "6 mm²"}
    elif corriente <= Decimal("40"):
        return {"tipo": "cable", "seccion": Decimal("10.0"), "cantidad": 1, "es_barra": False, "desc": "10 mm²"}
    elif corriente <= Decimal("63"):
        return {"tipo": "cable", "seccion": Decimal("16.0"), "cantidad": 1, "es_barra": False, "desc": "16 mm²"}
    elif corriente <= Decimal("80"):
        return {"tipo": "cable", "seccion": Decimal("25.0"), "cantidad": 1, "es_barra": False, "desc": "25 mm²"}
    elif corriente <= Decimal("100"):
        return {"tipo": "cable", "seccion": Decimal("35.0"), "cantidad": 1, "es_barra": False, "desc": "35 mm²"}
    elif corriente <= Decimal("125"):
        return {"tipo": "cable", "seccion": Decimal("16.0"), "cantidad": 2, "es_barra": False, "desc": "2x 16 mm²"}
    elif corriente <= Decimal("160"):
        return {"tipo": "cable", "seccion": Decimal("25.0"), "cantidad": 2, "es_barra": False, "desc": "2x 25 mm²"}
    elif corriente <= Decimal("200"):
        return {"tipo": "cable", "seccion": Decimal("35.0"), "cantidad": 2, "es_barra": False, "desc": "2x 35 mm²"}
    elif corriente <= Decimal("250"):
        return {"tipo": "cable", "seccion": Decimal("50.0"), "cantidad": 2, "es_barra": False, "desc": "2x 50 mm²"}
    elif corriente <= Decimal("320"):
        return {"tipo": "barra", "seccion": Decimal("150.0"), "cantidad": 1, "es_barra": True, "desc": "Barra 30x5 mm"}
    elif corriente <= Decimal("400"):
        return {"tipo": "barra", "seccion": Decimal("200.0"), "cantidad": 1, "es_barra": True, "desc": "Barra 20x10 mm"}
    elif corriente <= Decimal("500"):
        return {"tipo": "barra", "seccion": Decimal("300.0"), "cantidad": 1, "es_barra": True, "desc": "Barra 30x10 mm"}
    elif corriente <= Decimal("630"):
        return {"tipo": "barra", "seccion": Decimal("400.0"), "cantidad": 1, "es_barra": True, "desc": "Barra 40x10 mm"}
    elif corriente <= Decimal("800"):
        return {"tipo": "barra", "seccion": Decimal("500.0"), "cantidad": 1, "es_barra": True, "desc": "Barra 50x10 mm"}
    elif corriente <= Decimal("1000"):
        return {"tipo": "barra", "seccion": Decimal("600.0"), "cantidad": 2, "es_barra": True, "desc": "2x Barra 30x10 mm"}
    else:
        return {"tipo": "barra", "seccion": Decimal("800.0"), "cantidad": 2, "es_barra": True, "desc": "2x Barra 40x10 mm"}


POLOS_POR_FORMATO = {
    FormatoPolos.UNIPOLAR: 1,
    FormatoPolos.BIPOLAR: 2,
    FormatoPolos.TRIPOLAR: 3,
    FormatoPolos.TETRAPOLAR: 4,
}


# Medidas estándar de Cablecanal Zoloda y sus dimensiones físicas (Ancho x Alto en mm)
CABLECANAL_MEDIDAS = [
    {"codigo": "40x40", "ancho": 40, "alto": 40, "area": Decimal("1600")},
    {"codigo": "40x60", "ancho": 40, "alto": 60, "area": Decimal("2400")},
    {"codigo": "40x80", "ancho": 40, "alto": 80, "area": Decimal("3200")},
    {"codigo": "60x60", "ancho": 60, "alto": 60, "area": Decimal("3600")},
    {"codigo": "60x80", "ancho": 60, "alto": 80, "area": Decimal("4800")},
    {"codigo": "80x80", "ancho": 80, "alto": 80, "area": Decimal("6400")},
    {"codigo": "100x100", "ancho": 100, "alto": 100, "area": Decimal("10000")},
]


def determinar_paso_tablero(
    tablero: Tablero,
    todas_las_salidas: List[Salida],
    parametros,
    canal_alto: int = 40,
    corriente_principal: Decimal = Decimal("0")
) -> int:
    """
    Determina si el tablero debe usar Paso 150 mm o Paso 200 mm globalmente.
    El analista puede forzar el paso manualmente.
    """
    if tablero.paso_manual is not None:
        return tablero.paso_manual

    # Regla 1: Si el cablecanal sugerido tiene altura > 40 mm, se promueve a Paso 200 mm
    if canal_alto > 40:
        return 200

    # Regla 2: Si el interruptor principal tiene corriente nominal > 80A, se promueve a Paso 200 mm
    if corriente_principal > Decimal("80"):
        return 200

    # Regla 3: Si CUALQUIER salida tiene corriente > 80A o cable > 16mm²
    for s in todas_las_salidas:
        try:
            corr = calcular_corriente_nominal(s.carga_valor, s.carga_unidad, s.formato, parametros)
        except Exception:
            corr = Decimal("0")

        cond = obtener_datos_conductor(corr)
        if corr > Decimal("80") or (cond["tipo"] == "cable" and cond["seccion"] > Decimal("16.0")):
            return 200

    return 150


def determinar_paso_seccion(seccion: Seccion, salidas: List[Salida], parametros) -> int:
    """
    Legacy helper for backward compatibility and tests.
    """
    if seccion.paso_manual is not None:
        return seccion.paso_manual

    for s in salidas:
        try:
            corr = calcular_corriente_nominal(s.carga_valor, s.carga_unidad, s.formato, parametros)
        except Exception:
            corr = Decimal("0")

        cond = obtener_datos_conductor(corr)
        if corr > Decimal("80") or (cond["tipo"] == "cable" and cond["seccion"] > Decimal("16.0")):
            return 200

    return 150


def seleccionar_gabinete_nollmann(
    db: Session,
    total_polos: int,
    max_polos_por_fila: int = 1,
    total_filas: int = 1,
    paso: int = 150,
    ancho_requerido: int = 0,
    alto_requerido: int = 0
) -> Optional[CatalogoComponente]:
    """
    Busca en el catálogo el gabinete NIS de Nollmann (profundidad 225) más económico
    basado primordialmente en la Capacidad Total de Polos (con reserva) y Cantidad de Filas.
    """
    candidatos = db.query(CatalogoComponente).filter(
        CatalogoComponente.proveedor == "Nollmann",
        CatalogoComponente.atributos["tipo"].as_string() == "gabinete"
    ).all()

    elegibles = []
    for c in candidatos:
        attrs = c.atributos or {}
        if paso == 200:
            capacidad_total = attrs.get("total_polos_200", 0)
            capacidad_filas = attrs.get("lineas_200", 0)
        else:
            capacidad_total = attrs.get("total_polos_150", 0)
            capacidad_filas = attrs.get("lineas_150", 0)

        g_alto = attrs.get("alto_mm", 0)
        g_ancho = attrs.get("ancho_mm", 0)

        if (capacidad_total >= total_polos and 
            capacidad_filas >= total_filas and 
            g_ancho >= ancho_requerido and
            g_alto >= alto_requerido):
            elegibles.append(c)

    if not elegibles:
        return None

    # Ordenar por precio neto
    elegibles.sort(key=lambda x: (x.precio_neto or Decimal("999999"), x.codigo))
    return elegibles[0]


def seleccionar_distribuidor_nollmed(db: Session, corriente_cabecera: Decimal, conexiones_requeridas: int) -> Optional[CatalogoComponente]:
    """
    Busca en el catálogo el distribuidor NRT/BD más barato
    que soporte la corriente de cabecera y tenga suficientes conexiones.
    """
    candidatos = db.query(CatalogoComponente).filter(
        CatalogoComponente.proveedor == "Nöllmed",
        CatalogoComponente.atributos["tipo"].as_string() == "distribuidor"
    ).all()

    elegibles = []
    for c in candidatos:
        attrs = c.atributos or {}
        corr_nom = Decimal(str(attrs.get("corriente_nominal_a", 0)))
        conex = attrs.get("conexiones", 0)

        if corr_nom >= corriente_cabecera and conex >= conexiones_requeridas:
            elegibles.append(c)

    if not elegibles:
        return None

    # Ordenar por precio neto y código
    elegibles.sort(key=lambda x: (x.precio_neto or Decimal("999999"), x.codigo))
    return elegibles[0]


def seleccionar_cablecanal_zoloda(seccion_acumulada: Decimal, factor_llenado: Decimal) -> str:
    """
    Selecciona la medida de cablecanal mínima que puede albergar la sección acumulada
    de cables considerando el factor de llenado.
    """
    area_requerida = seccion_acumulada / factor_llenado

    for m in CABLECANAL_MEDIDAS:
        if m["area"] >= area_requerida:
            return m["codigo"]

    # Si supera el máximo, retornar el más grande
    return CABLECANAL_MEDIDAS[-1]["codigo"]


def calcular_dimensiones_tablero(db: Session, tablero_id: uuid.UUID) -> dict:
    """
    Calcula toda la estructura física del tablero:
    1. Paso efectivo de cada sección.
    2. Gabinete Nollmann sugerido.
    3. Medida de cablecanal sugerida.
    4. Distribuidor sugerido.
    """
    from app.models import ParametroCalculo
    from app.routers.parametros_calculo import obtener_parametros  # Fallback

    tablero = db.query(Tablero).filter(Tablero.id == tablero_id).first()
    if not tablero:
        return {}

    # Obtener parámetros de cálculo
    parametros = db.query(ParametroCalculo).first()
    if not parametros:
        parametros = ParametroCalculo()

    factor_llenado = parametros.factor_llenado_cablecanal or Decimal("0.65")
    reserva_factor = Decimal(1) + Decimal(tablero.porcentaje_reserva or 0) / Decimal("100")

    secciones = db.query(Seccion).filter(Seccion.tablero_id == tablero_id).order_by(Seccion.orden).all()

    resultado_secciones = []
    polos_tablero_total = 0
    seccion_cables_acumulada_tablero = Decimal("0")
    max_corriente_salida = Decimal("0")
    total_salidas_tablero = 0

    # Determinar interruptor principal del tablero
    corriente_principal = Decimal("0")
    polos_principal = 0
    if tablero.interruptor_principal_id:
        corriente_principal = Decimal("125")  # Default si existe
        polos_principal = 4
        principal = db.query(CatalogoComponente).filter(CatalogoComponente.id == tablero.interruptor_principal_id).first()
        if principal and principal.atributos:
            corriente_principal = Decimal(str(principal.atributos.get("corriente_nominal_a", 125)))
            polos_principal = principal.atributos.get("polos", 4)

    # 1. Calcular polos, cables y corrientes por sección
    todas_las_salidas = db.query(Salida).join(Seccion).filter(Seccion.tablero_id == tablero_id).all()
    max_polos_por_fila = polos_principal

    max_seccion_cables_tramo = Decimal("0")

    for sec in secciones:
        salidas = [s for s in todas_las_salidas if s.seccion_id == sec.id]
        polos_seccion = 0
        seccion_cables_seccion = Decimal("0")

        for s in salidas:
            polos_salida = POLOS_POR_FORMATO.get(s.formato, 1)
            polos_seccion += polos_salida

            try:
                corr = calcular_corriente_nominal(s.carga_valor, s.carga_unidad, s.formato, parametros)
            except Exception:
                corr = Decimal("0")

            if corr > max_corriente_salida:
                max_corriente_salida = corr

            cond = obtener_datos_conductor(corr)
            if cond["tipo"] == "cable":
                area_cable = obtener_area_cuadrada_cable(cond["seccion"])
                seccion_cables_seccion += area_cable * cond["cantidad"] * polos_salida * 2

            total_salidas_tablero += 1

        polos_tablero_total += polos_seccion
        if seccion_cables_seccion > max_seccion_cables_tramo:
            max_seccion_cables_tramo = seccion_cables_seccion

        if polos_seccion > max_polos_por_fila:
            max_polos_por_fila = polos_seccion

    # Sumar polos del interruptor principal
    polos_tablero_total += polos_principal

    # Aplicar porcentaje de reserva
    polos_con_reserva = int(polos_tablero_total * reserva_factor)
    seccion_cables_con_reserva = max_seccion_cables_tramo * reserva_factor
    conexiones_con_reserva = int(total_salidas_tablero * reserva_factor)

    # 2. Seleccionar Cablecanal Zoloda primero (tramo de mayor congestión)
    medida_canal = seleccionar_cablecanal_zoloda(seccion_cables_con_reserva, factor_llenado)
    tablero.cablecanal_sugerido = medida_canal

    canal_w, canal_h = 40, 40
    if medida_canal:
        parts = medida_canal.split("x")
        if len(parts) == 2:
            try:
                canal_w = int(parts[0])
                canal_h = int(parts[1])
            except ValueError:
                pass

    # 3. Determinar Paso Global (paso de térmicas de todo el gabinete)
    paso_global = determinar_paso_tablero(tablero, todas_las_salidas, parametros, canal_h, corriente_principal)
    tablero.paso_mm = paso_global
    db.add(tablero)

    for sec in secciones:
        if sec.paso_mm != paso_global:
            sec.paso_mm = paso_global
            db.add(sec)

        # Contabilizar polos por sección en el resultado
        salidas_sec = [s for s in todas_las_salidas if s.seccion_id == sec.id]
        polos_sec = sum(POLOS_POR_FORMATO.get(s.formato, 1) for s in salidas_sec)
        resultado_secciones.append({
            "seccion_id": sec.id,
            "nombre": sec.nombre,
            "paso_mm": paso_global,
            "polos": polos_sec,
        })

    # 4. Calcular Dimensiones Físicas Requeridas (en milímetros)
    margin = 27

    # Ancho mínimo requerido (Column model)
    # Column1 (left canal) = canal_w
    # Column2 (clearance) = 15
    # Column3 (max rail elements) = max_polos_por_fila * 18
    # Column4 (clearance) = 15
    # Column5 (right canal) = canal_w
    rail_width = max_polos_por_fila * 18
    ancho_requerido_mm = (2 * margin) + (2 * canal_w) + 30 + rail_width

    # Altura mínima requerida (basada en el paso modular y cantidad de filas)
    tiene_principal = tablero.interruptor_principal_id is not None
    sections_count = len(secciones)
    total_filas = (1 if tiene_principal else 0) + sections_count
    alto_requerido_mm = total_filas * paso_global + 100

    # 5. Seleccionar gabinete Nollmann NIS con validación física estricta
    gabinete = seleccionar_gabinete_nollmann(
        db,
        polos_con_reserva,
        max_polos_por_fila,
        total_filas,
        paso_global,
        ancho_requerido=ancho_requerido_mm,
        alto_requerido=alto_requerido_mm
    )
    if gabinete:
        tablero.gabinete_sugerido_id = gabinete.id
        db.add(tablero)

    # 6. Seleccionar distribuidor Nollmed
    corriente_distribuidor = max(corriente_principal, max_corriente_salida)
    distribuidor = seleccionar_distribuidor_nollmed(db, corriente_distribuidor, conexiones_con_reserva)
    if distribuidor:
        tablero.distribuidor_sugerido_id = distribuidor.id
        db.add(tablero)

    db.commit()

    capacidad_total_gab = 0
    capacidad_polos_linea_gab = 0
    if gabinete and gabinete.atributos:
        if paso_global == 200:
            capacidad_total_gab = gabinete.atributos.get("total_polos_200", 0)
            capacidad_polos_linea_gab = gabinete.atributos.get("polos_linea_200", 0)
        else:
            capacidad_total_gab = gabinete.atributos.get("total_polos_150", 0)
            capacidad_polos_linea_gab = gabinete.atributos.get("polos_linea_150", 0)

    porcentaje_ocupacion = round((polos_con_reserva / capacidad_total_gab) * 100, 1) if capacidad_total_gab > 0 else 0.0
    excede_largo_riel = max_polos_por_fila > capacidad_polos_linea_gab if capacidad_polos_linea_gab > 0 else False

    ancho_actual = gabinete.atributos.get("ancho_mm", 600) if gabinete and gabinete.atributos else 600
    anchos_disponibles = [300, 450, 600, 750, 1000]
    siguiente_ancho = next((w for w in anchos_disponibles if w > ancho_actual), ancho_actual)

    return {
        "tablero_id": tablero.id,
        "polos_totales": polos_tablero_total,
        "polos_con_reserva": polos_con_reserva,
        "paso_maximo": paso_global,
        "gabinete_sugerido": {
            "id": gabinete.id if gabinete else None,
            "codigo": gabinete.codigo if gabinete else None,
            "descripcion": gabinete.descripcion if gabinete else "Sin match",
            "ancho_mm": gabinete.atributos.get("ancho_mm") if gabinete and gabinete.atributos else None,
            "alto_mm": gabinete.atributos.get("alto_mm") if gabinete and gabinete.atributos else None,
            "ancho_util_mm": (
                200 if (gabinete.atributos.get("ancho_mm", 600) <= 300) else (
                    350 if (gabinete.atributos.get("ancho_mm", 600) <= 450) else (
                        500 if (gabinete.atributos.get("ancho_mm", 600) <= 600) else (
                            650 if (gabinete.atributos.get("ancho_mm", 600) <= 750) else 900
                        )
                    )
                )
            ) if gabinete and gabinete.atributos else 500,
            "alto_util_mm": (gabinete.atributos.get("alto_mm", 800) - 100) if gabinete and gabinete.atributos else 500,
            "porcentaje_ocupacion": porcentaje_ocupacion,
            "excede_largo_riel": excede_largo_riel,
            "max_polos_por_fila": max_polos_por_fila,
            "capacidad_polos_linea": capacidad_polos_linea_gab,
            "siguiente_gabinete_ancho_mm": siguiente_ancho,
            "precio_neto": float(gabinete.precio_neto) if gabinete and gabinete.precio_neto else 0.0,
        } if gabinete else None,
        "distribuidor_sugerido": {
            "id": distribuidor.id if distribuidor else None,
            "codigo": distribuidor.codigo if distribuidor else None,
            "descripcion": distribuidor.descripcion if distribuidor else "Sin match",
            "precio_neto": float(distribuidor.precio_neto) if distribuidor and distribuidor.precio_neto else 0.0,
        } if distribuidor else None,
        "cablecanal_sugerido": medida_canal,
        "secciones": resultado_secciones
    }
