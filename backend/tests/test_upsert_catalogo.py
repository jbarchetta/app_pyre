from decimal import Decimal

from app.catalogo.types import ComponenteImportado
from app.catalogo.upsert import upsert_componentes
from app.models import AuditLog, CatalogoComponente, CatalogoPrecioHistorial
from app.scripts.create_user import create_user


def _item(codigo="C1", precio_neto=Decimal("10.00")):
    return ComponenteImportado(
        proveedor="ABB",
        codigo=codigo,
        codigo_comercial="COM1",
        categoria_path=["Interruptores Termomagneticos", "SH200 L"],
        descripcion="Interruptor de prueba",
        unidad="Unidad",
        precio_lista=Decimal("20.00"),
        precio_neto=precio_neto,
        archivo_origen="abb.xlsx",
        fila_origen=8,
    )


def test_first_import_inserts_new_component(db_session):
    usuario = create_user("import1.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)

    resumen = upsert_componentes(db_session, [_item()], usuario_id=usuario.id)

    assert resumen == {"total_filas": 1, "nuevos": 1, "actualizados": 0, "sin_cambios": 0}
    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C1").one()
    assert componente.precio_neto == Decimal("10.00")
    assert componente.categoria_raiz == "Interruptores Termomagneticos"


def test_reimport_with_same_price_counts_as_sin_cambios(db_session):
    usuario = create_user("import2.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    upsert_componentes(db_session, [_item(codigo="C2")], usuario_id=usuario.id)

    resumen = upsert_componentes(db_session, [_item(codigo="C2")], usuario_id=usuario.id)

    assert resumen["nuevos"] == 0
    assert resumen["sin_cambios"] == 1
    assert resumen["actualizados"] == 0


def test_reimport_with_changed_price_writes_history_and_updates(db_session):
    usuario = create_user("import3.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    upsert_componentes(db_session, [_item(codigo="C3", precio_neto=Decimal("10.00"))], usuario_id=usuario.id)

    resumen = upsert_componentes(db_session, [_item(codigo="C3", precio_neto=Decimal("12.50"))], usuario_id=usuario.id)

    assert resumen["actualizados"] == 1
    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C3").one()
    assert componente.precio_neto == Decimal("12.50")
    historial = db_session.query(CatalogoPrecioHistorial).filter_by(componente_id=componente.id).one()
    assert historial.precio_anterior == Decimal("10.00")
    assert historial.precio_nuevo == Decimal("12.50")
    assert historial.usuario_id == usuario.id


def test_import_writes_audit_log_entry(db_session):
    usuario = create_user("import4.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)

    upsert_componentes(db_session, [_item(codigo="C4")], usuario_id=usuario.id)

    entrada = db_session.query(AuditLog).filter_by(usuario_id=usuario.id, accion="importar_catalogo").one()
    assert entrada.detalle["nuevos"] == 1


def test_duplicate_code_within_same_batch_is_last_one_wins(db_session):
    usuario = create_user("import5.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)

    resumen = upsert_componentes(
        db_session,
        [_item(codigo="C5", precio_neto=Decimal("10.00")), _item(codigo="C5", precio_neto=Decimal("15.00"))],
        usuario_id=usuario.id,
    )

    assert resumen["total_filas"] == 2
    componentes = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C5").all()
    assert len(componentes) == 1
    assert componentes[0].precio_neto == Decimal("15.00")
    historial = db_session.query(CatalogoPrecioHistorial).filter_by(componente_id=componentes[0].id).one()
    assert historial.precio_anterior == Decimal("10.00")
    assert historial.precio_nuevo == Decimal("15.00")
