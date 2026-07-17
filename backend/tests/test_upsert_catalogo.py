from decimal import Decimal

from app.catalogo.types import ComponenteImportado
from app.catalogo.upsert import upsert_componentes
from app.models import AuditLog, CatalogoComponente, CatalogoPrecioHistorial
from app.scripts.create_user import create_user


def _item(codigo="C1", precio_neto=Decimal("10.00"), atributos=None, codigo_comercial="COM1"):
    return ComponenteImportado(
        proveedor="ABB",
        codigo=codigo,
        codigo_comercial=codigo_comercial,
        categoria_path=["Interruptores Termomagneticos", "SH200 L"],
        descripcion="Interruptor de prueba",
        unidad="Unidad",
        precio_lista=Decimal("20.00"),
        precio_neto=precio_neto,
        archivo_origen="abb.xlsx",
        fila_origen=8,
        atributos=atributos,
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


def test_atributos_se_guarda_al_insertar(db_session):
    usuario = create_user("import6.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    atributos = {"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 16.0, "capacidad_corte_ka": 6.0}

    upsert_componentes(db_session, [_item(codigo="C6", atributos=atributos)], usuario_id=usuario.id)

    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C6").one()
    assert componente.atributos == atributos


def test_atributos_se_actualiza_en_reimportacion(db_session):
    usuario = create_user("import7.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    viejo = {"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 16.0, "capacidad_corte_ka": 6.0}
    nuevo = {"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 20.0, "capacidad_corte_ka": 6.0}
    upsert_componentes(db_session, [_item(codigo="C7", atributos=viejo)], usuario_id=usuario.id)

    upsert_componentes(db_session, [_item(codigo="C7", atributos=nuevo)], usuario_id=usuario.id)

    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C7").one()
    assert componente.atributos == nuevo


def test_import_grande_busca_existentes_en_lotes(db_session):
    # Bug real encontrado al importar el catálogo completo de ABB (10.247
    # filas): un único IN compuesto de (proveedor, codigo) con esa cantidad de
    # pares supera el límite de profundidad del parser de Postgres
    # (psycopg2.errors.StatementTooComplex: "stack depth limit exceeded").
    # Reproducir el crash exacto acá sería lento y depende del
    # `max_stack_depth` configurado en cada entorno de Postgres -- este test
    # en cambio prueba directamente que la búsqueda por lotes (chunking) da el
    # resultado correcto cuando la cantidad de items supera el tamaño de un
    # lote interno (1200 items, tamaño de lote 500 -> 3 lotes). La corrección
    # real contra el archivo de ABB real se verificó a mano (ver
    # docs/superpowers/plans -- Task de búsqueda del catálogo).
    usuario = create_user("importgrande.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    items = [_item(codigo=f"BIG-{i}") for i in range(1200)]

    resumen = upsert_componentes(db_session, items, usuario_id=usuario.id)

    assert resumen == {"total_filas": 1200, "nuevos": 1200, "actualizados": 0, "sin_cambios": 0}

    # reimportar el mismo lote grande debe reconocerlos todos como existentes,
    # probando que la búsqueda en lotes encuentra coincidencias en todos los chunks.
    resumen2 = upsert_componentes(db_session, items, usuario_id=usuario.id)
    assert resumen2["sin_cambios"] == 1200


def test_codigo_comercial_largo_no_falla_al_insertar(db_session):
    # Bug real en el Excel de ABB: algunas filas usan "Codigo SAP" como
    # placeholder de texto (ej. "Nota:") con una nota al pie completa como
    # "Codigo Comercial" -- hasta 118 caracteres reales, más que el límite
    # original de la columna (100).
    usuario = create_user("import8.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    comercial_largo = "Nota al pie muy larga que en el Excel real de ABB aparece en la columna Codigo Comercial de alguna fila" * 1
    assert len(comercial_largo) > 100

    upsert_componentes(
        db_session, [_item(codigo="C8", codigo_comercial=comercial_largo)], usuario_id=usuario.id
    )

    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C8").one()
    assert componente.codigo_comercial == comercial_largo
