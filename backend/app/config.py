from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_SECRETS_CONOCIDOS_DE_DESARROLLO = {"dev-secret-change-me", "change-me-in-production", ""}
_PASSWORD_DB_DESARROLLO = "tablero_dev_pw"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TABLERO_", env_file=".env")

    database_url: str = "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 480
    environment: str = "development"
    frontend_origin: str = "http://localhost:5180"

    @model_validator(mode="after")
    def _rechazar_secretos_de_desarrollo_en_produccion(self):
        # Guard-rail (ciclo 8): con los defaults de este archivo, un deploy de
        # producción sin configurar env quedaría con un JWT forjeable por
        # cualquiera y la password de DB pública. Mejor no arrancar.
        if self.environment == "production":
            if self.jwt_secret in _SECRETS_CONOCIDOS_DE_DESARROLLO:
                raise ValueError(
                    "TABLERO_JWT_SECRET no puede ser el valor por defecto en producción"
                )
            if _PASSWORD_DB_DESARROLLO in self.database_url:
                raise ValueError(
                    "TABLERO_DATABASE_URL usa la password de desarrollo en producción"
                )
        return self


settings = Settings()
