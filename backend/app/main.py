from fastapi import FastAPI

from app.routers import auth, health

app = FastAPI(title="Configurador de Tableros PYRE")

app.include_router(health.router)
app.include_router(auth.router)
