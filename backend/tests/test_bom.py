import uuid
from decimal import Decimal
import pytest

from app.models import BomLinea, CatalogoComponente
from app.scripts.create_user import create_user


def _crear_entorno(client, db_session, email="bom.test@pyre.com"):
    create_user(email, "Analista BOM", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})
    p_resp = client.post("/proyectos", json={"cliente": "Cliente BOM", "nombre": "Proyecto BOM"})
    p_id = p_resp.json()["id"]

    t_resp = client.post(f"/proyectos/{p_id}/tableros", json={"nombre": "Tablero BOM", "nivel_falla_ka": "10.00"})
    t_id = t_resp.json()["id"]

    sec_resp = client.post(f"/tableros/{t_id}/secciones", json={"nombre": "Sección 1"})
    sec_id = sec_resp.json()["id"]

    c1 = CatalogoComponente(
        proveedor="ABB",
        codigo="ABB-101",
        codigo_comercial="S201-C16",
        categoria_path=["Interruptores Termomagnéticos"],
        categoria_raiz="Interruptores Termomagnéticos",
        descripcion="Termomagnético 16A 1P",
        unidad="Unidad",
        precio_neto=Decimal("1250.50"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    c2 = CatalogoComponente(
        proveedor="ABB",
        codigo="ABB-102",
        codigo_comercial="F202-AC25",
        categoria_path=["Interruptores Diferenciales"],
        categoria_raiz="Interruptores Diferenciales",
        descripcion="Diferencial 25A 2P",
        unidad="Unidad",
        precio_neto=Decimal("3400.00"),
        archivo_origen="test.xlsx",
        fila_origen=2,
    )
    db_session.add_all([c1, c2])
    db_session.commit()

    return p_id, t_id, sec_id, c1, c2


def test_generar_bom_tablero(client, db_session):
    p_id, t_id, sec_id, c1, c2 = _crear_entorno(client, db_session)

    # Asignar interruptor principal al tablero
    client.patch(f"/tableros/{t_id}", json={"interruptor_principal_id": str(c1.id)})

    # Crear 2 salidas con componentes
    sal1 = client.post(
        f"/secciones/{sec_id}/salidas",
        json={
            "carga_valor": "10.00",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()
    client.patch(f"/salidas/{sal1['id']}", json={"componente_id": str(c1.id)})

    sal2 = client.post(
        f"/secciones/{sec_id}/salidas",
        json={
            "carga_valor": "20.00",
            "carga_unidad": "A",
            "formato": "bipolar",
            "tipo_proteccion": "seccional_diferencial",
        },
    ).json()
    client.patch(f"/salidas/{sal2['id']}", json={"componente_id": str(c2.id)})

    # Generar BOM
    gen_resp = client.post(f"/tableros/{t_id}/bom/generar")
    assert gen_resp.status_code == 200
    bom = gen_resp.json()

    assert bom["tablero_id"] == t_id
    assert bom["total_items_count"] == 3  # 1 principal (c1) + 1 salida c1 + 1 salida c2
    assert len(bom["lineas"]) == 2

    # c1 tiene cantidad 2 (principal + salida 1) -> 2 * 1250.50 = 2501.00
    # c2 tiene cantidad 1 (salida 2) -> 1 * 3400.00 = 3400.00
    # Total = 5901.00
    assert float(bom["costo_total"]) == pytest.approx(5901.00)


def test_obtener_bom_proyecto(client, db_session):
    p_id, t_id, sec_id, c1, c2 = _crear_entorno(client, db_session, email="bom_proj.test@pyre.com")

    client.patch(f"/tableros/{t_id}", json={"interruptor_principal_id": str(c1.id)})
    client.post(f"/tableros/{t_id}/bom/generar")

    proj_resp = client.get(f"/proyectos/{p_id}/bom")
    assert proj_resp.status_code == 200
    data = proj_resp.json()

    assert data["proyecto_id"] == p_id
    assert len(data["tableros"]) == 1
    assert float(data["costo_total_proyecto"]) == pytest.approx(1250.50)


def test_limpiar_bom_tablero(client, db_session):
    p_id, t_id, sec_id, c1, c2 = _crear_entorno(client, db_session, email="bom_del.test@pyre.com")

    client.patch(f"/tableros/{t_id}", json={"interruptor_principal_id": str(c1.id)})
    client.post(f"/tableros/{t_id}/bom/generar")

    del_resp = client.delete(f"/tableros/{t_id}/bom")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/tableros/{t_id}/bom")
    assert get_resp.status_code == 200
    assert get_resp.json()["total_items_count"] == 0
