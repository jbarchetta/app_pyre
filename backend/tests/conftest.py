import os

os.environ.setdefault(
    "TABLERO_DATABASE_URL",
    "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero_test",
)
os.environ.setdefault("TABLERO_JWT_SECRET", "test-secret")
os.environ.setdefault("TABLERO_ENVIRONMENT", "test")
