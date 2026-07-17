from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, catalogo, health, proyectos, tableros

app = FastAPI(title="Configurador de Tableros PYRE")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(catalogo.router)
app.include_router(proyectos.router)
app.include_router(tableros.router)
