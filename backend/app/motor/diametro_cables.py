from decimal import Decimal

# Diámetros exteriores aproximados de conductores de cobre unipolares aislados (en mm)
# según su sección conductora en mm².
CABLE_DIAMETROS = {
    Decimal("1.5"): Decimal("3.0"),
    Decimal("2.5"): Decimal("3.6"),
    Decimal("4.0"): Decimal("4.2"),
    Decimal("6.0"): Decimal("4.8"),
    Decimal("10.0"): Decimal("6.3"),
    Decimal("16.0"): Decimal("7.4"),
    Decimal("25.0"): Decimal("9.2"),
    Decimal("35.0"): Decimal("10.5"),
    Decimal("50.0"): Decimal("12.5"),
    Decimal("70.0"): Decimal("14.5"),
    Decimal("95.0"): Decimal("16.8"),
    Decimal("120.0"): Decimal("18.5"),
}

def obtener_diametro_cable(seccion: Decimal) -> Decimal:
    """
    Retorna el diámetro exterior estimado (en mm) para una sección de conductor dada (en mm²).
    Si la sección no se encuentra exactamente, busca la sección inmediata superior.
    """
    # Ordenar las secciones disponibles
    secciones_disponibles = sorted(CABLE_DIAMETROS.keys())
    for s in secciones_disponibles:
        if seccion <= s:
            return CABLE_DIAMETROS[s]
    # Si supera la sección máxima de la tabla, retornar proporcional al máximo
    max_sec = secciones_disponibles[-1]
    return CABLE_DIAMETROS[max_sec]

def obtener_area_cuadrada_cable(seccion: Decimal) -> Decimal:
    """
    Calcula el área del cable tratándolo como un cuadrado (d x d)
    para contemplar los espacios de interdicción en el cablecanal.
    """
    d = obtener_diametro_cable(seccion)
    return d * d
