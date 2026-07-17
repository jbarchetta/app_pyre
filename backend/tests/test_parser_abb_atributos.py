from app.catalogo.parser_abb import _extraer_atributos


def test_termomagnetico_modular_unipolar():
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Unipolares"],
        descripcion="Interruptor termomagnético unipolar  In 2A Icn = 4,5kA @ IEC60898 Curva C",
    )

    assert resultado == {
        "tipo": "seccional_termomagnetico",
        "polos": 1,
        "corriente_nominal_a": 2.0,
        "capacidad_corte_ka": 4.5,
    }


def test_termomagnetico_modular_tetrapolar():
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Tetrapolares"],
        descripcion="Interruptor termomagnético tetrapolar In 2A Icn = 4,5kA @ IEC60898 Curva C",
    )

    assert resultado["polos"] == 4


def test_termomagnetico_con_typo_sin_espacio():
    # variante real "Sin posibilidad de utilizar accesorios": el proveedor tiene
    # un typo de formato en la descripción sin espacio antes de "unipolar".
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos - Sin posibilidad de utilizar accesorios", "Curva B - Icn: 4,5kA (IEC 60898)", "Unipolares"],
        descripcion="Interruptortermomagnético unipolar In 6A Icn = 4,5kA @ IEC60898 Curva B",
    )

    assert resultado == {
        "tipo": "seccional_termomagnetico",
        "polos": 1,
        "corriente_nominal_a": 6.0,
        "capacidad_corte_ka": 4.5,
    }


def test_termomagnetico_con_accesorios_icn_e_icu_toma_el_menor():
    # variante real "Con posibilidad de utilizar accesorios": trae Icn (IEC60898)
    # e Icu (IEC60947) en la misma descripción — el motor debe usar el menor.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos - Con posibilidad de utilizar accesorios", "S200", "Curva C - Icn: 6kA (IEC 60898) - Icu: 10kA (IEC 60947)", "Unipolares"],
        descripcion="Interruptor termomagnético unipolar In 0,5A. Icn = 6kA @ IEC60898 Icu : 10 kA @ IEC60947-2. Curva C",
    )

    assert resultado["corriente_nominal_a"] == 0.5
    assert resultado["capacidad_corte_ka"] == 6.0  # min(6, 10), no 10


def test_mccb_polos_sale_de_la_descripcion_no_del_ultimo_nivel_de_categoria():
    # En MCCB el último nivel de categoria_path es un modelo (ej. "XT1B 160"),
    # no un indicador de polos — por eso este caso depende de que la extracción
    # lea la descripción primero.
    resultado = _extraer_atributos(
        categoria_path=[
            "Interruptores automáticos en caja moldeada", "SACE Tmax XT",
            "XT1 - Tripolares (3p) - Ejecución fija (F) - Teminales anteriores (F)", "XT1B 160",
        ],
        descripcion="Interruptor Tmax XT tripolar In = 16A - Icu = 18kA, Ics = 100% Icu @ 380VCA",
    )

    assert resultado == {
        "tipo": "seccional_termomagnetico",
        "polos": 3,
        "corriente_nominal_a": 16.0,
        "capacidad_corte_ka": 18.0,
    }


def test_termomagnetico_sin_descripcion_usa_categoria_path_para_polos():
    # Filas reales de continuación de sección: descripción vacía, pero el último
    # nivel de categoria_path sí trae el polo. Sin la corriente (que solo está en
    # la descripción) el resultado igual es None -- este test prueba que el
    # respaldo de polos funciona usando una descripción sintética con corriente,
    # para aislar ese mecanismo del caso real (que además de polos, también le
    # falta la corriente y por lo tanto no matchea nada).
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "S800 C", "Curva C", "Tetrapolares"],
        descripcion="In 40A Icn = 25kA",
    )

    assert resultado["polos"] == 4
    assert resultado["corriente_nominal_a"] == 40.0
    assert resultado["capacidad_corte_ka"] == 25.0


def test_termomagnetico_con_descripcion_vacia_y_sin_corriente_devuelve_none():
    # Caso real: fila de continuación de sección, sin descripción propia.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "S800 C", "Curva C - Icu: 25kA  (IEC 60947-2) Ics: 18kA", "Tetrapolares"],
        descripcion="",
    )

    assert resultado is None


def test_combo_termomagnetico_diferencial():
    resultado = _extraer_atributos(
        categoria_path=["Interruptores termomagnéticos con protección diferencial", "hasta 6kA", "I∆ = 30mA"],
        descripcion="Interruptor termomagnético y diferencial bipolar In=6, 6kA, curva C, Sens=30mA",
    )

    assert resultado == {
        "tipo": "seccional_diferencial",
        "polos": 2,
        "corriente_nominal_a": 6.0,
        "capacidad_corte_ka": 6.0,
    }


def test_diferencial_puro_fuera_de_alcance_devuelve_none():
    # "Interruptores Diferenciales" (puro) nunca trae Icn/Icu en ningún lado del
    # Excel real -- queda deliberadamente sin atributos.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Diferenciales", "F200 AC", "Bipolares"],
        descripcion="Interruptor diferencial bipolar  In 16. Sens = 10 mA",
    )

    assert resultado is None


def test_categoria_fuera_de_alcance_devuelve_none():
    resultado = _extraer_atributos(
        categoria_path=["Seccionador de Línea", "Algo"],
        descripcion="Seccionador tripolar In 100A",
    )

    assert resultado is None


def test_accesorio_dentro_de_familia_combo_sin_corriente_devuelve_none():
    # Real: "Bloque Diferencial" es un accesorio vendido dentro de la misma
    # familia de categorías, pero su descripción no tiene el patrón "In <N>A" de
    # un interruptor completo -- debe quedar sin atributos, no con datos parciales.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores termomagnéticos con protección diferencial", "Tipo A - Clase AP-R  Alta Inmunidad", "Bloque Diferencial DDA202 - Bipolar"],
        descripcion="Bloque Diferencial 25A Clase A 10mA 2 Polos (p/S200)",
    )

    assert resultado is None


def test_categoria_path_vacia_devuelve_none():
    assert _extraer_atributos(categoria_path=[], descripcion="cualquier cosa") is None
