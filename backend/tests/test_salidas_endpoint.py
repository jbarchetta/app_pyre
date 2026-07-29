from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _setup_tablero(client, db_session, email, interruptor_principal_id=None, nivel_falla_ka="10.00"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})
    proyecto_id = client.post(
        "/proyectos", json={"cliente": "Cliente Salida", "nombre": "Proyecto Salida"}
    ).json()["id"]
    tablero_payload = {"nombre": "TG1", "nivel_falla_ka": nivel_falla_ka}
    if interruptor_principal_id:
        tablero_payload["interruptor_principal_id"] = interruptor_principal_id
    tablero_id = client.post(f"/proyectos/{proyecto_id}/tableros", json=tablero_payload).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]
    return seccion_id


def _componente(db_session, codigo, tipo="seccional_termomagnetico", polos=1, corriente=20, ka=10, precio="50.00"):
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


def test_crear_salida_propone_componente_cuando_hay_match(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-1", tipo="interruptor_principal", corriente=100, ka=15)
    # precio deliberadamente por debajo de 50.00 (el precio por defecto de otros
    # fixtures del resto de la suite) para que este test sea robusto sin importar
    # qué otros archivos ya corrieron.
    barato = _componente(db_session, "SAL-C1", corriente=20, ka=10, precio="15.00")
    seccion_id = _setup_tablero(
        client, db_session, "salidas1.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["componente_id"] == str(barato.id)
    assert body["origen"] == "manual"


def test_crear_salida_sin_match_deja_componente_id_null(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-2", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas2.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_diferencial",
        },
    )

    assert response.status_code == 201
    assert response.json()["componente_id"] is None


def test_crear_salida_sin_interruptor_principal_deja_componente_id_null(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas3.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    assert response.json()["componente_id"] is None


def test_crear_salida_con_unidad_invalida_devuelve_400(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas4.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "V",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 400


def test_patch_salida_permite_override_manual(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas5.test@pyre.com")
    manual = _componente(db_session, "SAL-C5", corriente=20, ka=10)
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"componente_id": str(manual.id)})

    assert response.status_code == 200
    assert response.json()["componente_id"] == str(manual.id)


def test_listar_salidas_devuelve_las_creadas(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas6.test@pyre.com")
    primera = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "10",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()

    response = client.get(f"/secciones/{seccion_id}/salidas")

    assert response.status_code == 200
    ids = [s["id"] for s in response.json()]
    assert ids == [primera["id"]]


def test_listar_salidas_no_hace_n_mas_uno_queries(client, db_session, contador_queries):
    # Anti-N+1 (ciclo 9): con 5 salidas con componente, el listado debe resolver
    # los componentes en batch — el conteo de statements es constante, no crece
    # con la cantidad de salidas (antes: 1 query extra por salida).
    seccion_id = _setup_tablero(client, db_session, "salidas.nplus1@pyre.com")
    for i in range(5):
        componente = _componente(db_session, f"SAL-NPLUS1-{i}", corriente=20, ka=10)
        salida_id = client.post(
            f"/secciones/{seccion_id}/salidas",
            json={
                "carga_valor": "16",
                "carga_unidad": "A",
                "formato": "unipolar",
                "tipo_proteccion": "seccional_termomagnetico",
            },
        ).json()["id"]
        client.patch(f"/salidas/{salida_id}", json={"componente_id": str(componente.id)})

    contador_queries["n"] = 0
    contador_queries["statements"] = []
    response = client.get(f"/secciones/{seccion_id}/salidas")

    assert response.status_code == 200
    assert len(response.json()) == 5
    # Los 5 componentes deben resolverse en UNA query batch (IN), no en 5 db.get
    # individuales. (Filtrar por tabla: el conteo total es no-determinístico por
    # el identity map; las queries contra catalogo_componente sí lo son.)
    queries_componentes = sum(1 for s in contador_queries["statements"] if "catalogo_componente" in s)
    assert queries_componentes == 1


def test_listar_salidas_paginacion_sin_solapes(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas.pag@pyre.com")
    calibres = ["10", "16", "25"]
    for i in range(3):
        res = client.post(
            f"/secciones/{seccion_id}/salidas",
            json={
                "carga_valor": calibres[i],
                "carga_unidad": "A",
                "formato": "unipolar",
                "tipo_proteccion": "seccional_termomagnetico",
            },
        )
        assert res.status_code == 201

    pagina1 = client.get(f"/secciones/{seccion_id}/salidas?limit=2").json()
    pagina2 = client.get(f"/secciones/{seccion_id}/salidas?limit=2&offset=2").json()
    print("PAGINA1:", len(pagina1), pagina1)
    print("PAGINA2:", len(pagina2), pagina2)

    ids_pagina1 = {s["id"] for s in pagina1}
    ids_pagina2 = {s["id"] for s in pagina2}
    assert len(ids_pagina1) == 2
    assert len(ids_pagina2) == 1
    assert ids_pagina1.isdisjoint(ids_pagina2)


def test_patch_salida_recalcula_cuando_cambia_la_carga(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-7", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas7.test@pyre.com", interruptor_principal_id=str(principal.id)
    )
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "10",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_valor": "30"})

    assert response.status_code == 200
    assert response.json()["carga_valor"] == "30.00"


def test_linkear_salidas_y_prevenir_autolink(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas_link.test@pyre.com")
    salida1_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "40",
            "carga_unidad": "A",
            "formato": "tetrapolar",
            "tipo_proteccion": "seccional_diferencial",
        },
    ).json()["id"]
    salida2_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "bipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    # Probar auto-link invalido (devuelve 400)
    response_auto = client.patch(f"/salidas/{salida2_id}", json={"alimentado_por_salida_id": salida2_id})
    assert response_auto.status_code == 400

    # Linkear salida2 a salida1
    response_link = client.patch(f"/salidas/{salida2_id}", json={"alimentado_por_salida_id": salida1_id})
    assert response_link.status_code == 200
    body = response_link.json()
    assert body["alimentado_por_salida_id"] == salida1_id
    assert body["alimentado_por_codigo"] == "F1.1"

    # Desvincular salida2 (volver a alimentacion estandar)
    response_unlink = client.patch(f"/salidas/{salida2_id}", json={"alimentado_por_salida_id": None})
    assert response_unlink.status_code == 200
    assert response_unlink.json()["alimentado_por_salida_id"] is None
    assert response_unlink.json()["alimentado_por_codigo"] is None


def test_patch_salida_con_componente_id_explicito_no_recalcula(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas8.test@pyre.com")
    manual = _componente(db_session, "SAL-C8", corriente=20, ka=10)
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(
        f"/salidas/{salida_id}", json={"carga_valor": "30", "componente_id": str(manual.id)}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["componente_id"] == str(manual.id)
    assert body["carga_valor"] == "30.00"


def test_patch_salida_con_unidad_invalida_devuelve_400(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas11.test@pyre.com")
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_unidad": "V"})

    assert response.status_code == 400


def test_delete_salida(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas9.test@pyre.com")
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.delete(f"/salidas/{salida_id}")

    assert response.status_code == 204
    assert client.get(f"/secciones/{seccion_id}/salidas").json() == []


def test_delete_salida_inexistente_devuelve_404(client, db_session):
    import uuid

    _setup_tablero(client, db_session, "salidas10.test@pyre.com")

    response = client.delete(f"/salidas/{uuid.uuid4()}")

    assert response.status_code == 404


def test_patch_salida_con_componente_id_null_explicito_lo_limpia_sin_recalcular(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-12", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas12.test@pyre.com", interruptor_principal_id=str(principal.id)
    )
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_valor": "30", "componente_id": None})

    assert response.status_code == 200
    body = response.json()
    assert body["componente_id"] is None
    assert body["carga_valor"] == "30.00"


def test_listar_salidas_incluye_codigo_legible_del_componente(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-13", tipo="interruptor_principal", corriente=100, ka=15)
    # precio por debajo de 15.00 (ya usado por SAL-C1 en otro test de este archivo)
    # para evitar un empate de precio que el desempate por código resolvería a favor
    # de SAL-C1 en vez de este componente.
    barato = _componente(db_session, "SAL-C13", corriente=20, ka=10, precio="14.00")
    seccion_id = _setup_tablero(
        client, db_session, "salidas13.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["componente_id"] == str(barato.id)
    assert body["componente_codigo"] == barato.codigo
    assert body["componente_codigo_comercial"] == barato.codigo_comercial


def test_listar_salidas_sin_componente_devuelve_codigo_null(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas14.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["componente_id"] is None
    assert body["componente_codigo"] is None
    assert body["componente_codigo_comercial"] is None


def test_duplicar_salida(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas15.test@pyre.com")
    res1 = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
            "etiqueta": "Circuito 1",
        },
    )
    salida_id = res1.json()["id"]

    res_dup = client.post(f"/salidas/{salida_id}/duplicar")
    assert res_dup.status_code == 201
    body_dup = res_dup.json()
    assert body_dup["id"] != salida_id
    assert body_dup["etiqueta"] == "Circuito 1 (copia)"
    assert body_dup["carga_valor"] == "16.00"


def test_actualizar_salida_recalcula_componente_diferencial(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas_dif.test@pyre.com")

    res1 = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )
    salida_id = res1.json()["id"]

    res_patch = client.patch(
        f"/salidas/{salida_id}",
        json={
            "tipo_proteccion": "seccional_diferencial",
            "formato": "bipolar",
            "sensibilidad_ma": 30,
            "admite_accesorios": False,
        },
    )
    assert res_patch.status_code == 200
    body = res_patch.json()
    assert body["tipo_proteccion"] == "seccional_diferencial"
    assert body["formato"] == "bipolar"
    assert body["sensibilidad_ma"] == 30
    assert body["admite_accesorios"] is False
    assert body["asignado_manualmente"] is False
    seccion_id = _setup_tablero(client, db_session, "salidas16.test@pyre.com")
    res1 = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "10", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
    ).json()["id"]
    res2 = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "20", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
    ).json()["id"]

    reorder_res = client.post(
        f"/secciones/{seccion_id}/salidas/reordenar",
        json={"salidas_ids": [res2, res1]},
    )
    assert reorder_res.status_code == 204

    salidas_list = client.get(f"/secciones/{seccion_id}/salidas").json()
    assert salidas_list[0]["id"] == res2
    assert salidas_list[1]["id"] == res1


def test_salida_motivo_sin_match_diagnostico(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas17.test@pyre.com")
    res = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )
    assert res.status_code == 201
    assert res.json()["motivo_sin_match"] == "Debe seleccionar un interruptor principal para poder proponer un componente."


def test_crear_salida_supera_limite_45_polos_lanza_error_400(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-LIM", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas_lim.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    # 11 salidas tetrapolares = 44 polos DIN
    for _ in range(11):
        res = client.post(
            f"/secciones/{seccion_id}/salidas",
            json={
                "carga_valor": "16",
                "carga_unidad": "A",
                "formato": "tetrapolar",
                "tipo_proteccion": "seccional_termomagnetico",
            },
        )
        assert res.status_code == 201

    # Intentar agregar 1 bipolar extra (44 + 2 = 46 polos -> HTTP 400)
    response_exc = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "bipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )
    assert response_exc.status_code == 400
    assert "Límite de chasis superado" in response_exc.json()["detail"]

