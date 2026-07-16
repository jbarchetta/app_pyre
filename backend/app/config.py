from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TABLERO_", env_file=".env")

    database_url: str = "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 480
    environment: str = "development"


settings = Settings()
