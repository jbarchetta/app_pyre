from decimal import Decimal
import pytest
from app.models import CatalogoComponente, FormatoPolos, TipoProteccion, ParametroCalculo
from app.motor.propuesta import proponer_componente, proponer_componente_con_diagnostico
from app.scripts.create_user import create_user
from .test_salidas_endpoint import _setup_tablero, _componente

def _login(client, db_session, email="diff.test@pyre.com"):
    create_user(email, "Analista Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})

def _diferencial(db_session, codigo, polos=2, corriente=40.0, ka=10.0, precio="100.00", sensibilidad=30, admite_accesorios=None):
    atributos = {
        "tipo": "seccional_diferencial",
        "polos": polos,
        "corriente_nominal_a": corriente,
        "capacidad_corte_ka": ka,
        "sensibilidad_ma": sensibilidad,
    }
    if admite_accesorios is not None:
        atributos["admite_accesorios"] = admite_accesorios

    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores termomagnéticos con protección diferencial"],
        categoria_raiz="Interruptores termomagnéticos con protección diferencial",
        descripcion=f"Diferencial {codigo}",
        unidad="Unidad",
        precio_neto=Decimal(precio),
        atributos=atributos,
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente

def test_proponer_diferencial_filtro_accesorios_tolerancia_null(db_session):
    # Crear un diferencial con admite_accesorios = False
    diff_false = _diferencial(db_session, "DIFF-FALSE", admite_accesorios=False, precio="150.00")
    # Crear un diferencial con admite_accesorios = None (NULL en DB)
    diff_null = _diferencial(db_session, "DIFF-NULL", admite_accesorios=None, precio="120.00")
    # Crear un diferencial con admite_accesorios = True
    diff_true = _diferencial(db_session, "DIFF-TRUE", admite_accesorios=True, precio="180.00")

    parametros = ParametroCalculo(
        ratio_selectividad=Decimal("1.6"),
        tension_mono_v=220,
        tension_tri_v=380,
        cos_phi=Decimal("0.9"),
    )

    # 1. Buscar diferencial sin accesorios (admite_accesorios = False).
    # Debería preferir el más barato entre diff_false y diff_null.
    # diff_null (120.00) es más barato que diff_false (150.00) y ambos deben calificar.
    propuesto = proponer_componente(
        db_session,
        tipo_proteccion=TipoProteccion.SECCIONAL_DIFERENCIAL,
        formato=FormatoPolos.BIPOLAR,
        corriente_nominal=Decimal("20.0"),
        capacidad_corte_min=Decimal("5.0"),
        nominal_aguas_arriba=Decimal("100.0"),
        parametros=parametros,
        sensibilidad_ma=30,
        admite_accesorios=False
    )
    assert propuesto is not None
    assert propuesto.codigo == "DIFF-NULL"

    # 2. Buscar diferencial con accesorios (admite_accesorios = True).
    # Debería devolver únicamente diff_true (180.00).
    propuesto_true = proponer_componente(
        db_session,
        tipo_proteccion=TipoProteccion.SECCIONAL_DIFERENCIAL,
        formato=FormatoPolos.BIPOLAR,
        corriente_nominal=Decimal("20.0"),
        capacidad_corte_min=Decimal("5.0"),
        nominal_aguas_arriba=Decimal("100.0"),
        parametros=parametros,
        sensibilidad_ma=30,
        admite_accesorios=True
    )
    assert propuesto_true is not None
    assert propuesto_true.codigo == "DIFF-TRUE"

def test_diagnostico_diferencial_sensibilidad_y_accesorios(db_session):
    # Crear un diferencial con 30mA, sin accesorios
    _diferencial(db_session, "DIFF-30MA", sensibilidad=30, admite_accesorios=False)
    
    parametros = ParametroCalculo(
        ratio_selectividad=Decimal("1.6"),
        tension_mono_v=220,
        tension_tri_v=380,
        cos_phi=Decimal("0.9"),
    )

    # Buscar sensibilidad inexistente (ej. 10mA)
    candidato, motivo = proponer_componente_con_diagnostico(
        db_session,
        tipo_proteccion=TipoProteccion.SECCIONAL_DIFERENCIAL,
        formato=FormatoPolos.BIPOLAR,
        corriente_nominal=Decimal("20.0"),
        capacidad_corte_min=Decimal("5.0"),
        nominal_aguas_arriba=Decimal("100.0"),
        parametros=parametros,
        sensibilidad_ma=10,
        admite_accesorios=False
    )
    assert candidato is None
    assert "sensibilidad 10 mA" in motivo

    # Buscar con accesorios (true) cuando solo hay sin accesorios
    candidato2, motivo2 = proponer_componente_con_diagnostico(
        db_session,
        tipo_proteccion=TipoProteccion.SECCIONAL_DIFERENCIAL,
        formato=FormatoPolos.BIPOLAR,
        corriente_nominal=Decimal("20.0"),
        capacidad_corte_min=Decimal("5.0"),
        nominal_aguas_arriba=Decimal("100.0"),
        parametros=parametros,
        sensibilidad_ma=30,
        admite_accesorios=True
    )
    assert candidato2 is None
    assert "con accesorios" in motivo2

def test_buscar_endpoint_admite_accesorios_tolerancia_null(client, db_session):
    _login(client, db_session)
    _diferencial(db_session, "DIFF-CAT-NULL", admite_accesorios=None, precio="100.00")
    _diferencial(db_session, "DIFF-CAT-FALSE", admite_accesorios=False, precio="110.00")
    _diferencial(db_session, "DIFF-CAT-TRUE", admite_accesorios=True, precio="120.00")

    # Buscar con admite_accesorios=False
    res = client.get("/catalogo/buscar", params={
        "tipo": "seccional_diferencial",
        "admite_accesorios": "false",
        "polos": 2
    })
    assert res.status_code == 200
    body = res.json()
    codigos = [r["codigo"] for r in body["resultados"]]
    assert "DIFF-CAT-NULL" in codigos
    assert "DIFF-CAT-FALSE" in codigos
    assert "DIFF-CAT-TRUE" not in codigos

    # Buscar con admite_accesorios=True
    res_true = client.get("/catalogo/buscar", params={
        "tipo": "seccional_diferencial",
        "admite_accesorios": "true",
        "polos": 2
    })
    assert res_true.status_code == 200
    body_true = res_true.json()
    codigos_true = [r["codigo"] for r in body_true["resultados"]]
    assert "DIFF-CAT-TRUE" in codigos_true
    assert "DIFF-CAT-NULL" not in codigos_true
    assert "DIFF-CAT-FALSE" not in codigos_true

def test_diferencial_omite_selectividad(db_session):
    _diferencial(db_session, "DIFF-40A", corriente=40.0, sensibilidad=30, admite_accesorios=False)
    
    parametros = ParametroCalculo(
        ratio_selectividad=Decimal("1.6"),
        tension_mono_v=220,
        tension_tri_v=380,
        cos_phi=Decimal("0.9"),
    )

    # Buscar diferencial con aguas arriba de 40 A.
    # Con ratio de 1.6, una termomagnética de 40 A requeriría aguas arriba de 64 A,
    # por lo que fallaría la selectividad.
    # Pero el diferencial debe omitir esta comprobación y proponerse con éxito.
    propuesto = proponer_componente(
        db_session,
        tipo_proteccion=TipoProteccion.SECCIONAL_DIFERENCIAL,
        formato=FormatoPolos.BIPOLAR,
        corriente_nominal=Decimal("32.0"),
        capacidad_corte_min=Decimal("5.0"),
        nominal_aguas_arriba=Decimal("40.0"),
        parametros=parametros,
        sensibilidad_ma=30,
        admite_accesorios=False
    )
    assert propuesto is not None
    assert propuesto.codigo == "DIFF-40A"

def test_simular_propuesta_endpoint(client, db_session):
    _login(client, db_session, email="sim.diff.test@pyre.com")
    principal = _componente(db_session, "SIM-MAIN", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(client, db_session, "sim1.test@pyre.com", interruptor_principal_id=str(principal.id))

    # Add a differential to catalog: Bipolar, 40A, 30mA, without accessories
    _diferencial(db_session, "SIM-DIFF-30", corriente=40.0, sensibilidad=30, admite_accesorios=False)

    # 1. Simular con parámetros correctos/compatibles
    res = client.get(f"/secciones/{seccion_id}/simular-propuesta", params={
        "formato": "bipolar",
        "tipo_proteccion": "seccional_diferencial",
        "carga_valor": "32",
        "carga_unidad": "A",
        "sensibilidad_ma": 30,
        "admite_accesorios": "false"
    })
    assert res.status_code == 200
    body = res.json()
    assert body["compatible"] is True
    assert body["componente_codigo"] == "SIM-DIFF-30"
    assert body["motivo"] is None

    # 2. Simular con parámetros no compatibles (sensibilidad 10mA)
    res_incompatible = client.get(f"/secciones/{seccion_id}/simular-propuesta", params={
        "formato": "bipolar",
        "tipo_proteccion": "seccional_diferencial",
        "carga_valor": "32",
        "carga_unidad": "A",
        "sensibilidad_ma": 10,
        "admite_accesorios": "false"
    })
    assert res_incompatible.status_code == 200
    body_incompatible = res_incompatible.json()
    assert body_incompatible["compatible"] is False
    assert body_incompatible["componente_codigo"] is None
    assert "sensibilidad 10 mA" in body_incompatible["motivo"]

def test_diferencial_omite_capacidad_corte(db_session):
    _diferencial(db_session, "DIFF-10KA", corriente=40.0, ka=10.0, sensibilidad=30, admite_accesorios=False)
    
    parametros = ParametroCalculo(
        ratio_selectividad=Decimal("1.6"),
        tension_mono_v=220,
        tension_tri_v=380,
        cos_phi=Decimal("0.9"),
    )

    # Buscar diferencial con capacidad de corte mínima requerida de 15 kA (ej. falla de tablero = 15).
    # Como es un diferencial, debe omitir el filtro de capacidad de corte mínima y emparejar con DIFF-10KA.
    propuesto = proponer_componente(
        db_session,
        tipo_proteccion=TipoProteccion.SECCIONAL_DIFERENCIAL,
        formato=FormatoPolos.BIPOLAR,
        corriente_nominal=Decimal("32.0"),
        capacidad_corte_min=Decimal("15.0"),
        nominal_aguas_arriba=Decimal("100.0"),
        parametros=parametros,
        sensibilidad_ma=30,
        admite_accesorios=False
    )
    assert propuesto is not None
    assert propuesto.codigo == "DIFF-10KA"
