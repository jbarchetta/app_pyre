from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Configurador de Tableros PYRE")

app.include_router(health.router)
