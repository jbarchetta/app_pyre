import pytest
from pydantic import ValidationError

from app.config import Settings

_SECRET_REAL = "un-secret-largo-y-aleatorio-de-produccion"
_URL_REAL = "postgresql+psycopg2://tablero:clave-real-distinta@db.empresa.com:5432/tablero"
_URL_DEV = "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero"


def _settings(**kwargs) -> Settings:
    # _env_file=None: no heredar el .env local del desarrollador — el test debe
    # depender solo de los kwargs explícitos.
    return Settings(_env_file=None, **kwargs)


def test_production_con_jwt_secret_default_falla():
    with pytest.raises(ValidationError, match="jwt_secret|JWT"):
        _settings(environment="production", jwt_secret="dev-secret-change-me", database_url=_URL_REAL)


def test_production_con_jwt_secret_placeholder_falla():
    with pytest.raises(ValidationError, match="jwt_secret|JWT"):
        _settings(environment="production", jwt_secret="change-me-in-production", database_url=_URL_REAL)


def test_production_con_password_de_db_de_desarrollo_falla():
    with pytest.raises(ValidationError, match="database_url|DATABASE"):
        _settings(environment="production", jwt_secret=_SECRET_REAL, database_url=_URL_DEV)


def test_production_con_secretos_reales_arranca():
    settings = _settings(environment="production", jwt_secret=_SECRET_REAL, database_url=_URL_REAL)

    assert settings.environment == "production"


def test_development_con_defaults_arranca():
    # El flujo diario de desarrollo no debe verse afectado: defaults permitidos.
    # (No se aserta el valor del secret: conftest exporta TABLERO_JWT_SECRET=test-secret.)
    settings = _settings(environment="development")

    assert settings.environment == "development"


def test_test_con_defaults_arranca():
    settings = _settings(environment="test")

    assert settings.environment == "test"
