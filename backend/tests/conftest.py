import os

os.environ.setdefault(
    "TABLERO_DATABASE_URL",
    "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero_test",
)
os.environ.setdefault("TABLERO_JWT_SECRET", "test-secret")
os.environ.setdefault("TABLERO_ENVIRONMENT", "test")

import pytest
from sqlalchemy import text

from app.database import Base, engine
import app.models  # noqa: F401  registers all models on Base.metadata


@pytest.fixture(scope="session", autouse=True)
def _fresh_schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def _limpiar_catalogo():
    # catalogo_componente era tabla compartida por toda la sesión de tests: la
    # propuesta del motor elige el elegible más barato, así que fixtures de un
    # archivo podían ganarle a los de otro y los tests solo pasaban por el orden
    # alfabético de los archivos (fragilidad preexistente expuesta en ciclo 8 al
    # correr subconjuntos). Truncar antes de cada test vuelve cada test
    # independiente del orden de ejecución. CASCADE alcanza a tablero/salida/
    # bom_linea (FK a catálogo); usuario/proyecto/parametro_calculo no se tocan.
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE catalogo_componente, catalogo_precio_historial CASCADE"))
    yield


from fastapi.testclient import TestClient

from app.database import SessionLocal, get_db
from app.main import app


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def contador_queries():
    """Registra statements SQL ejecutados contra la engine durante el test.

    Para tests anti-N+1 (ciclo 9): se resetea antes de la llamada medida y se
    aserta el conteo — total o filtrado por tabla. Filtrar por tabla es lo
    robusto: `db.get()` sirve desde el identity map sin SQL cuando el objeto no
    está expirado, así que el conteo total es no-determinístico, pero la query
    batch (IN) o las N queries por fila contra una tabla dada sí lo son.
    """
    from sqlalchemy import event

    registro = {"n": 0, "statements": []}

    def _listener(conn, cursor, statement, parameters, context, executemany):
        registro["n"] += 1
        registro["statements"].append(statement)

    event.listen(engine, "before_cursor_execute", _listener)
    try:
        yield registro
    finally:
        event.remove(engine, "before_cursor_execute", _listener)
