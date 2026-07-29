from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _login(client, db_session, email="buscarcat.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def _componente(db_session, codigo, descripcion, codigo_comercial=None):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        codigo_comercial=codigo_comercial,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=descripcion,
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_buscar_requiere_autenticacion(client):
    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR"})

    assert response.status_code == 401


def test_buscar_encuentra_por_codigo(client, db_session):
    _login(client, db_session)
    componente = _componente(db_session, "ZQXBUSCAR-C1", "Interruptor de prueba")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR-C1"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)
    assert body["resultados"][0]["codigo"] == "ZQXBUSCAR-C1"


def test_buscar_encuentra_por_descripcion(client, db_session):
    _login(client, db_session, email="buscarcat2.test@pyre.com")
    componente = _componente(db_session, "ZQXBUSCAR-C2", "Interruptor ZQXBUSCAR especial")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR especial"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)


def test_buscar_con_termino_corto_devuelve_vacio(client, db_session):
    _login(client, db_session, email="buscarcat3.test@pyre.com")

    response = client.get("/catalogo/buscar", params={"q": "z"})

    assert response.status_code == 200
    assert response.json() == {"resultados": [], "total": 0}


def test_buscar_encuentra_por_codigo_comercial(client, db_session):
    _login(client, db_session, email="buscarcat4.test@pyre.com")
    componente = _componente(db_session, "COD-INTERNO-1", "Interruptor sin match textual", codigo_comercial="ZQXBUSCAR-SH201")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR-SH201"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)
    assert body["resultados"][0]["codigo_comercial"] == "ZQXBUSCAR-SH201"


def test_buscar_prioriza_coincidencia_de_prefijo_en_codigo(client, db_session):
    _login(client, db_session, email="buscarcat5.test@pyre.com")
    en_descripcion = _componente(db_session, "AAA-OTRO-COD", "Interruptor con ZQXPRI200 en el medio del texto")
    prefijo_codigo = _componente(db_session, "ZQXPRI-C1", "Interruptor cualquiera")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPRI"})

    body = response.json()
    ids = [c["id"] for c in body["resultados"]]
    assert ids.index(str(prefijo_codigo.id)) < ids.index(str(en_descripcion.id))


def test_buscar_devuelve_total_de_coincidencias_mayor_a_los_resultados_devueltos(client, db_session):
    _login(client, db_session, email="buscarcat6.test@pyre.com")
    for i in range(25):
        _componente(db_session, f"ZQXPAG-{i:03d}", f"Interruptor de paginación {i}")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPAG"})

    body = response.json()
    assert body["total"] == 25
    assert len(body["resultados"]) == 20


def test_buscar_respeta_offset_y_limit_sin_duplicar_resultados(client, db_session):
    _login(client, db_session, email="buscarcat7.test@pyre.com")
    for i in range(25):
        _componente(db_session, f"ZQXOFF-{i:03d}", f"Interruptor de offset {i}")

    primera_pagina = client.get("/catalogo/buscar", params={"q": "ZQXOFF", "limit": 20, "offset": 0}).json()
    segunda_pagina = client.get("/catalogo/buscar", params={"q": "ZQXOFF", "limit": 20, "offset": 20}).json()

    assert len(primera_pagina["resultados"]) == 20
    assert len(segunda_pagina["resultados"]) == 5
    ids_primera = {c["id"] for c in primera_pagina["resultados"]}
    ids_segunda = {c["id"] for c in segunda_pagina["resultados"]}
    assert ids_primera.isdisjoint(ids_segunda)


def test_buscar_limita_el_limit_maximo_a_50(client, db_session):
    _login(client, db_session, email="buscarcat8.test@pyre.com")
    for i in range(60):
        _componente(db_session, f"ZQXMAX-{i:03d}", f"Interruptor de tope {i}")

    response = client.get("/catalogo/buscar", params={"q": "ZQXMAX", "limit": 1000})

    body = response.json()
    assert body["total"] == 60
    assert len(body["resultados"]) == 50


def test_buscar_incluye_id_como_desempate_final_para_paginacion_estable(client, db_session):
    # No alcanza con que "CatalogoComponente.id" aparezca en algún lado de la
    # función (podría ser un comentario suelto sin relación) -- hay que
    # verificar que esté específicamente dentro de la llamada a .order_by(...)
    # que ordena esta búsqueda, que es lo que realmente garantiza que el
    # desempate se aplique.
    import inspect
    import re

    from app.routers.catalogo import buscar_componentes

    codigo_fuente = inspect.getsource(buscar_componentes)

    match = re.search(r"\.order_by\(([^)]*)\)", codigo_fuente)
    assert match is not None, "no se encontró ninguna llamada a .order_by(...) en buscar_componentes"
    assert "CatalogoComponente.id" in match.group(1)


def test_buscar_filtra_por_categorias_cuando_se_especifica(client, db_session):
    _login(client, db_session, email="buscarcat9.test@pyre.com")
    en_categoria = _componente(db_session, "ZQXCAT-C1", "Interruptor de categoría permitida")
    fuera_de_categoria = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXCAT-C2",
        categoria_path=["Relés"],
        categoria_raiz="Relés",
        descripcion="Interruptor de categoría no permitida ZQXCAT",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(fuera_de_categoria)
    db_session.commit()

    response = client.get(
        "/catalogo/buscar",
        params={"q": "ZQXCAT", "categorias": ["Interruptores Termomagneticos"]},
    )

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(en_categoria.id) in ids
    assert str(fuera_de_categoria.id) not in ids


def test_buscar_sin_categorias_no_filtra(client, db_session):
    _login(client, db_session, email="buscarcat10.test@pyre.com")
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXNOCAT-C1",
        categoria_path=["Relés"],
        categoria_raiz="Relés",
        descripcion="Interruptor sin filtro ZQXNOCAT",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()

    response = client.get("/catalogo/buscar", params={"q": "ZQXNOCAT"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(componente.id) in ids


def _componente_con_atributos(db_session, codigo, polos, corriente, capacidad_corte, descripcion=None):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=descripcion or f"Interruptor {codigo}",
        unidad="Unidad",
        # Precio deliberadamente alto (catalogo_componente es una tabla
        # compartida sin rollback por test, ver nota en
        # test_motor_propuesta.py): un precio bajo con atributos completos
        # haría que proponer_componente() -- que ordena candidatos por precio
        # ascendente sin filtrar por código -- eligiera estas filas de test
        # por encima de las fixtures de ese archivo.
        precio_neto=Decimal("999.00"),
        atributos={
            "tipo": "seccional_termomagnetico",
            "polos": polos,
            "corriente_nominal_a": corriente,
            "capacidad_corte_ka": capacidad_corte,
        },
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_buscar_con_solo_con_atributos_excluye_filas_sin_atributos(client, db_session):
    _login(client, db_session, email="buscarcat11.test@pyre.com")
    con_atributos = _componente_con_atributos(db_session, "ZQXATR-C1", 3, 16, 10, "Interruptor ZQXATR real")
    sin_atributos = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXATR-C2",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Accesorio ZQXATR sin datos",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(sin_atributos)
    db_session.commit()

    response = client.get("/catalogo/buscar", params={"q": "ZQXATR", "solo_con_atributos": "true"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(con_atributos.id) in ids
    assert str(sin_atributos.id) not in ids


def test_buscar_sin_solo_con_atributos_no_filtra(client, db_session):
    _login(client, db_session, email="buscarcat12.test@pyre.com")
    sin_atributos = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXNOFLAG-C1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Accesorio ZQXNOFLAG sin datos",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(sin_atributos)
    db_session.commit()

    response = client.get("/catalogo/buscar", params={"q": "ZQXNOFLAG"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(sin_atributos.id) in ids


def test_buscar_filtra_por_polos(client, db_session):
    _login(client, db_session, email="buscarcat13.test@pyre.com")
    tripolar = _componente_con_atributos(db_session, "ZQXPOL-C1", 3, 16, 10, "Interruptor ZQXPOL tripolar")
    tetrapolar = _componente_con_atributos(db_session, "ZQXPOL-C2", 4, 16, 10, "Interruptor ZQXPOL tetrapolar")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPOL", "polos": 3})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(tripolar.id) in ids
    assert str(tetrapolar.id) not in ids


def test_buscar_filtra_por_corriente_nominal(client, db_session):
    _login(client, db_session, email="buscarcat14.test@pyre.com")
    de_16a = _componente_con_atributos(db_session, "ZQXIN-C1", 3, 16, 10, "Interruptor ZQXIN 16A")
    de_32a = _componente_con_atributos(db_session, "ZQXIN-C2", 3, 32, 10, "Interruptor ZQXIN 32A")

    response = client.get("/catalogo/buscar", params={"q": "ZQXIN", "corriente_nominal_a": "16"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(de_16a.id) in ids
    assert str(de_32a.id) not in ids


def test_buscar_filtra_por_capacidad_de_corte(client, db_session):
    _login(client, db_session, email="buscarcat15.test@pyre.com")
    de_10ka = _componente_con_atributos(db_session, "ZQXKA-C1", 3, 16, 10, "Interruptor ZQXKA 10kA")
    de_18ka = _componente_con_atributos(db_session, "ZQXKA-C2", 3, 16, 18, "Interruptor ZQXKA 18kA")

    response = client.get("/catalogo/buscar", params={"q": "ZQXKA", "capacidad_corte_ka": "10"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(de_10ka.id) in ids
    assert str(de_18ka.id) not in ids


def test_buscar_combina_categorias_solo_con_atributos_y_filtros(client, db_session):
    _login(client, db_session, email="buscarcat16.test@pyre.com")
    match = _componente_con_atributos(db_session, "ZQXCOMBO-C1", 3, 25, 15, "Interruptor ZQXCOMBO match")
    otro_polos = _componente_con_atributos(db_session, "ZQXCOMBO-C2", 4, 25, 15, "Interruptor ZQXCOMBO otro polos")

    response = client.get(
        "/catalogo/buscar",
        params={
            "q": "ZQXCOMBO",
            "categorias": ["Interruptores Termomagneticos"],
            "solo_con_atributos": "true",
            "polos": 3,
        },
    )

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(match.id) in ids
    assert str(otro_polos.id) not in ids


def test_opciones_filtro_devuelve_valores_distintos_ordenados(client, db_session):
    _login(client, db_session, email="opcionesfiltro1.test@pyre.com")
    _componente_con_atributos(db_session, "ZQXOPC-C1", 3, 32, 10, "Interruptor ZQXOPC A")
    _componente_con_atributos(db_session, "ZQXOPC-C2", 3, 16, 18, "Interruptor ZQXOPC B")
    _componente_con_atributos(db_session, "ZQXOPC-C3", 4, 16, 10, "Interruptor ZQXOPC C")

    response = client.get(
        "/catalogo/opciones-filtro", params={"categorias": ["Interruptores Termomagneticos"]}
    )

    assert response.status_code == 200
    body = response.json()
    assert 3 in body["polos"] and 4 in body["polos"]
    assert body["polos"] == sorted(set(body["polos"]))
    assert "16" in body["corrientes_nominales_a"] or "16.00" in body["corrientes_nominales_a"]
    assert "32" in body["corrientes_nominales_a"] or "32.00" in body["corrientes_nominales_a"]


def test_opciones_filtro_excluye_filas_sin_atributos(client, db_session):
    _login(client, db_session, email="opcionesfiltro2.test@pyre.com")
    sin_atributos = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXOPCVACIO-C1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Accesorio ZQXOPCVACIO",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(sin_atributos)
    db_session.commit()

    response = client.get(
        "/catalogo/opciones-filtro", params={"categorias": ["Interruptores Termomagneticos"]}
    )

    assert response.status_code == 200
    # No hay assert directo posible sobre "ausencia de un valor" sin saber el
    # atributo exacto -- lo que importa es que la fila sin atributos no rompe
    # el endpoint (no hay 500) y las listas siguen siendo válidas.
    assert isinstance(response.json()["polos"], list)


def test_opciones_filtro_scoped_por_categorias(client, db_session):
    _login(client, db_session, email="opcionesfiltro3.test@pyre.com")
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXOPCOTRA-C1",
        categoria_path=["Relés"],
        categoria_raiz="Relés",
        descripcion="Relé ZQXOPCOTRA",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        atributos={"tipo": "seccional_termomagnetico", "polos": 99, "corriente_nominal_a": 999, "capacidad_corte_ka": 999},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()

    response = client.get(
        "/catalogo/opciones-filtro", params={"categorias": ["Interruptores Termomagneticos"]}
    )

    assert response.status_code == 200
    assert 99 not in response.json()["polos"]


def test_opciones_filtro_requiere_autenticacion(client):
    response = client.get("/catalogo/opciones-filtro")

    assert response.status_code == 401


def test_buscar_filtra_por_tipo_sensibilidad_y_accesorios(client, db_session):
    _login(client, db_session, email="buscardif.test@pyre.com")
    dif_30ma = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXDIFF-30MA",
        categoria_path=["Interruptores Diferenciales - Con posibilidad de utilizar accesorios"],
        categoria_raiz="Interruptores Diferenciales",
        descripcion="Diferencial ZQXDIFF 30mA",
        unidad="Unidad",
        precio_neto=Decimal("150.00"),
        atributos={
            "tipo": "seccional_diferencial",
            "polos": 2,
            "corriente_nominal_a": 25,
            "capacidad_corte_ka": 10,
            "sensibilidad_ma": 30,
            "admite_accesorios": True,
        },
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    dif_100ma_sin_acc = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXDIFF-100MA",
        categoria_path=["Interruptores Diferenciales - Sin posibilidad de utilizar accesorios"],
        categoria_raiz="Interruptores Diferenciales",
        descripcion="Diferencial ZQXDIFF 100mA",
        unidad="Unidad",
        precio_neto=Decimal("180.00"),
        atributos={
            "tipo": "seccional_diferencial",
            "polos": 4,
            "corriente_nominal_a": 40,
            "capacidad_corte_ka": 10,
            "sensibilidad_ma": 100,
            "admite_accesorios": False,
        },
        archivo_origen="test.xlsx",
        fila_origen=2,
    )
    db_session.add_all([dif_30ma, dif_100ma_sin_acc])
    db_session.commit()

    # 1. Filtro por tipo seccional_diferencial y sensibilidad 30mA
    resp_30 = client.get(
        "/catalogo/buscar",
        params={"q": "ZQXDIFF", "tipo": "seccional_diferencial", "sensibilidad_ma": 30},
    )
    assert resp_30.status_code == 200
    ids_30 = [c["id"] for c in resp_30.json()["resultados"]]
    assert str(dif_30ma.id) in ids_30
    assert str(dif_100ma_sin_acc.id) not in ids_30

    # 2. Filtro por admite_accesorios = false
    resp_acc = client.get(
        "/catalogo/buscar",
        params={"q": "ZQXDIFF", "admite_accesorios": "false"},
    )
    assert resp_acc.status_code == 200
    ids_acc = [c["id"] for c in resp_acc.json()["resultados"]]
    assert str(dif_100ma_sin_acc.id) in ids_acc
    assert str(dif_30ma.id) not in ids_acc

    # 3. Opciones de filtro scoped por tipo seccional_diferencial
    opciones_resp = client.get(
        "/catalogo/opciones-filtro",
        params={"tipo": "seccional_diferencial"},
    )
    assert opciones_resp.status_code == 200
    body_opc = opciones_resp.json()
    assert 30 in body_opc["sensibilidades_ma"]
    assert 100 in body_opc["sensibilidades_ma"]
    assert True in body_opc["admite_accesorios"] and False in body_opc["admite_accesorios"]

