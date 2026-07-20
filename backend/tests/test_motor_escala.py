"""Tests de calidad a escala real (ciclo 9h).

Sin assertions de tiempo absoluto salvo un umbral generoso y anti-regresión
grosera en la búsqueda (ver nota ahí) -- la protección real contra un O(n)
que se cuele es el conteo de statements SQL, no el reloj.
"""

import time
from decimal import Decimal

from app.models import CatalogoComponente, FormatoPolos, ParametroCalculo, TipoProteccion
from app.motor.propuesta import proponer_componente
from app.scripts.create_user import create_user

N_COMPONENTES = 5000


def _parametros():
    return ParametroCalculo(
        tension_mono_v=Decimal("220"),
        tension_tri_v=Decimal("380"),
        cos_phi=Decimal("0.9"),
        ratio_selectividad=Decimal("1.6"),
    )


def _seed_catalogo_a_escala(db_session, *, prefijo_buscable=None, cantidad_buscable=0):
    """Sembra N_COMPONENTES filas determinísticas, mezcla de tipos/polos/corrientes.

    Solo un puñado son "elegibles" (seccional_termomagnetico, tripolar,
    corriente/capacidad suficientes) y entre esos, uno solo es el más barato --
    el resto existe para inflar el volumen de candidatos descartados por el
    WHERE de proponer_componente.
    """
    componentes = []
    for i in range(N_COMPONENTES):
        tipo = TipoProteccion.SECCIONAL_TERMOMAGNETICO if i % 3 == 0 else TipoProteccion.SECCIONAL_DIFERENCIAL
        polos = (i % 4) + 1
        corriente = 10 + (i % 50)
        ka = 6 + (i % 10)
        # El único componente que cumple exactamente el perfil buscado
        # (tripolar, termomagnetico, corriente/ka suficientes) Y es el más
        # barato de ese subconjunto:
        precio = Decimal("5.00") if i == 42 else Decimal(str(100 + (i % 900)))
        componentes.append(
            CatalogoComponente(
                proveedor="ABB",
                codigo=f"ESCALA-{i:05d}",
                categoria_path=["Interruptores Termomagneticos"],
                categoria_raiz="Interruptores Termomagneticos",
                descripcion=f"Interruptor de escala {i}",
                unidad="Unidad",
                precio_neto=precio,
                atributos={
                    "tipo": tipo.value,
                    "polos": polos,
                    "corriente_nominal_a": corriente,
                    "capacidad_corte_ka": ka,
                },
                archivo_origen="escala.xlsx",
                fila_origen=i,
            )
        )
    if prefijo_buscable and cantidad_buscable:
        for j in range(cantidad_buscable):
            componentes.append(
                CatalogoComponente(
                    proveedor="ABB",
                    codigo=f"{prefijo_buscable}-{j:04d}",
                    categoria_path=["Interruptores Termomagneticos"],
                    categoria_raiz="Interruptores Termomagneticos",
                    descripcion=f"Interruptor buscable {j}",
                    unidad="Unidad",
                    precio_neto=Decimal("50.00"),
                    atributos={
                        "tipo": "seccional_termomagnetico",
                        "polos": 3,
                        "corriente_nominal_a": 25,
                        "capacidad_corte_ka": 10,
                    },
                    archivo_origen="escala.xlsx",
                    fila_origen=N_COMPONENTES + j,
                )
            )
    db_session.bulk_save_objects(componentes)
    db_session.commit()


def test_proponer_componente_a_escala_devuelve_el_correcto_en_una_sola_query(db_session, contador_queries):
    _seed_catalogo_a_escala(db_session)
    # El componente i=42 es tripolar (42 % 4 + 1 = 3), termomagnetico (42 % 3 == 0),
    # corriente 10+42=52A, ka 6+2=8, precio 5.00 -- el más barato de todo el seed.
    esperado = db_session.query(CatalogoComponente).filter(CatalogoComponente.codigo == "ESCALA-00042").one()

    contador_queries["n"] = 0
    resultado = proponer_componente(
        db_session,
        TipoProteccion.SECCIONAL_TERMOMAGNETICO,
        FormatoPolos.TRIPOLAR,
        corriente_nominal=Decimal("50"),
        capacidad_corte_min=Decimal("8"),
        nominal_aguas_arriba=Decimal("1000"),
        parametros=_parametros(),
    )

    assert resultado is not None
    assert resultado.id == esperado.id
    assert contador_queries["n"] == 1


def test_buscar_catalogo_a_escala_devuelve_total_correcto_paginado_y_rapido(client, db_session):
    create_user("escala.buscar@pyre.com", "Analista Escala", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": "escala.buscar@pyre.com", "password": "clave-segura-123"})
    _seed_catalogo_a_escala(db_session, prefijo_buscable="ESCBUSC", cantidad_buscable=47)

    inicio = time.monotonic()
    response = client.get("/catalogo/buscar", params={"q": "ESCBUSC", "limit": 20})
    duracion = time.monotonic() - inicio

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 47
    assert len(body["resultados"]) == 20
    codigos_pagina = [c["codigo"] for c in body["resultados"]]
    assert all(codigo.startswith("ESCBUSC-") for codigo in codigos_pagina)
    # Umbral generoso, anti-regresión grosera (ej. un scan sin usar el índice
    # trigram) -- no una garantía de performance fina.
    assert duracion < 2.0
