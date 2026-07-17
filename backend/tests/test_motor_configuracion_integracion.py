from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def test_flujo_completo_proyecto_a_salida_con_propuesta(client, db_session):
    create_user("integracion.test@pyre.com", "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": "integracion.test@pyre.com", "password": "clave-segura-123"})

    principal = CatalogoComponente(
        proveedor="ABB",
        codigo="INTEG-PRINC-1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Interruptor principal de prueba",
        unidad="Unidad",
        precio_neto=Decimal("500.00"),
        atributos={"tipo": "interruptor_principal", "polos": 4, "corriente_nominal_a": 100, "capacidad_corte_ka": 15},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    seccional = CatalogoComponente(
        proveedor="ABB",
        codigo="INTEG-SEC-1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Interruptor seccional de prueba",
        unidad="Unidad",
        precio_neto=Decimal("50.00"),
        atributos={"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 20, "capacidad_corte_ka": 10},
        archivo_origen="test.xlsx",
        fila_origen=2,
    )
    db_session.add_all([principal, seccional])
    db_session.commit()

    proyecto_id = client.post(
        "/proyectos", json={"cliente": "Cliente Integración", "nombre": "Proyecto Integración"}
    ).json()["id"]
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros",
        json={"nombre": "TG1", "nivel_falla_ka": "10.00", "interruptor_principal_id": str(principal.id)},
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]

    salida = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()

    assert salida["componente_id"] == str(seccional.id)
