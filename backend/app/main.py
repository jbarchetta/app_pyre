from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.routers import auth, bom, catalogo, health, parametros_calculo, proyectos, salidas, tableros


def _ejecutar_migraciones_ligeras():
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE salida ADD COLUMN IF NOT EXISTS alimentado_por_salida_id UUID REFERENCES salida(id) ON DELETE SET NULL;"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE salida ADD COLUMN IF NOT EXISTS sensibilidad_ma INTEGER;"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE salida ADD COLUMN IF NOT EXISTS admite_accesorios BOOLEAN DEFAULT FALSE;"
                )
            )
    except Exception:
        pass


def _asegurar_usuarios_semilla():
    try:
        from app.auth.security import hash_password
        from app.database import SessionLocal
        from app.models import RolUsuario, Usuario

        db = SessionLocal()
        try:
            if db.query(Usuario).filter(Usuario.email == "analista@pyre.com").first() is None:
                analista = Usuario(
                    email="analista@pyre.com",
                    nombre="Analista Demo",
                    password_hash=hash_password("clave-demo-123"),
                    rol=RolUsuario.ANALISTA,
                )
                db.add(analista)

            if db.query(Usuario).filter(Usuario.email == "supervisor@pyre.com").first() is None:
                supervisor = Usuario(
                    email="supervisor@pyre.com",
                    nombre="Supervisor Demo",
                    password_hash=hash_password("clave-demo-123"),
                    rol=RolUsuario.SUPERVISOR,
                )
                db.add(supervisor)

            db.commit()
        finally:
            db.close()
    except Exception as e:
        print("Error al asegurar usuarios semilla:", e)


_ejecutar_migraciones_ligeras()
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
app.include_router(catalogo.router)
app.include_router(proyectos.router)
app.include_router(tableros.router)
app.include_router(salidas.router)
app.include_router(parametros_calculo.router)
app.include_router(bom.router)
