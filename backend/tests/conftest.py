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
