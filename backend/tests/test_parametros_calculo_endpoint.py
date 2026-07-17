from app.models import AuditLog
from app.scripts.create_user import create_user


def _login(client, db_session, email="parametros.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def test_get_devuelve_los_valores_por_defecto(client, db_session):
    _login(client, db_session)

    response = client.get("/parametros-calculo")

    assert response.status_code == 200
    body = response.json()
    assert body["tension_mono_v"] == "220.00"
    assert body["ratio_selectividad"] == "1.60"


def test_put_actualiza_los_valores_y_registra_auditoria(client, db_session):
    _login(client, db_session, email="parametrosput.test@pyre.com")

    response = client.put(
        "/parametros-calculo",
        json={"tension_mono_v": "230", "tension_tri_v": "400", "cos_phi": "0.95", "ratio_selectividad": "1.5"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tension_mono_v"] == "230.00"
    assert body["ratio_selectividad"] == "1.50"

    auditoria = db_session.query(AuditLog).filter_by(accion="actualizar_parametros_calculo").all()
    assert len(auditoria) == 1
