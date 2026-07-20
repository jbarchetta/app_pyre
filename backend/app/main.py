from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, catalogo, health, parametros_calculo, proyectos, salidas, tableros

app = FastAPI(title="Configurador de Tableros PYRE")

# Listas explícitas (ciclo 9): con "*" Starlette acepta todos los métodos
# estándar; el API solo usa estos. Origen único desde config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def headers_de_seguridad(request, call_next):
    # Ciclo 9: headers en TODAS las respuestas, incluidos errores (el middleware
    # envuelve al router). CSP 'none' porque es un API JSON pura — el frontend
    # define los suyos en su propio servidor. HSTS solo en producción: sobre
    # HTTP en dev rompería localhost.
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(catalogo.router)
app.include_router(proyectos.router)
app.include_router(tableros.router)
app.include_router(salidas.router)
app.include_router(parametros_calculo.router)
