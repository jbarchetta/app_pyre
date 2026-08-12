from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    auditoria,
    auth,
    bom,
    catalogo,
    health,
    parametros_calculo,
    proyectos,
    salidas,
    tableros,
    usuarios,
)


def _asegurar_usuarios_semilla():
    try:
        from app.auth.security import hash_password
        from app.database import SessionLocal
        from app.models import RolUsuario, Usuario

        db = SessionLocal()
        try:
            demos = [
                ("analista@pyre.com", "Analista Demo", RolUsuario.ANALISTA),
                ("supervisor@pyre.com", "Supervisor Demo", RolUsuario.SUPERVISOR),
                ("administrador@pyre.com", "Administrador PYRE", RolUsuario.ADMINISTRADOR),
                ("desarrollador@pyre.com", "Desarrollador Sistema", RolUsuario.DESARROLLADOR),
            ]
            for email, nombre, rol in demos:
                if db.query(Usuario).filter(Usuario.email == email).first() is None:
                    try:
                        u = Usuario(
                            email=email,
                            nombre=nombre,
                            password_hash=hash_password("clave-demo-123"),
                            rol=rol,
                        )
                        db.add(u)
                        db.commit()
                    except Exception:
                        db.rollback()
        finally:
            db.close()
    except Exception as e:
        print("Error al asegurar usuarios semilla:", e)


_asegurar_usuarios_semilla()

app = FastAPI(title="Configurador de Tableros PYRE")

# Listas explícitas (ciclo 9): con "*" Starlette acepta todos los métodos
# estándar; el API solo usa estos. Origen único desde config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list({
        settings.frontend_origin,
        "http://localhost:5180",
        "http://127.0.0.1:5180",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    }),
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
app.include_router(usuarios.router)
app.include_router(auditoria.router)
app.include_router(catalogo.router)
app.include_router(proyectos.router)
app.include_router(tableros.router)
app.include_router(salidas.router)
app.include_router(parametros_calculo.router)
app.include_router(bom.router)
