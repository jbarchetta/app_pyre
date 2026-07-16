import os

os.environ.setdefault(
    "TABLERO_DATABASE_URL",
    "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero_test",
)
os.environ.setdefault("TABLERO_JWT_SECRET", "test-secret")
os.environ.setdefault("TABLERO_ENVIRONMENT", "test")

import pytest

from app.database import Base, engine
import app.models  # noqa: F401  registers all models on Base.metadata


@pytest.fixture(scope="session", autouse=True)
def _fresh_schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
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
