# Fundaciones (Fase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the shared foundation both project tracks (core configurator and CAD/PDF extraction agent) build on: Dockerized Postgres, the full core data model, a FastAPI backend with cookie-based JWT auth for the two roles (analista/supervisor), and a React frontend skeleton with a working login flow.

**Architecture:** Python/FastAPI backend (SQLAlchemy 2.0 + Alembic) talking to PostgreSQL, behind cookie-based JWT auth. React + TypeScript (Vite) frontend calling the backend over `fetch` with credentials. Everything runs via Docker Compose; Postgres is exposed to the host for fast local iteration during development.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, psycopg2, Pydantic v2, PyJWT, passlib[bcrypt], pytest, httpx. React 18 + TypeScript, Vite, react-router-dom, Vitest, React Testing Library. PostgreSQL 16, Docker Compose.

---

## Relationship to other plans

This is the **first** of several plans implementing `docs/superpowers/specs/2026-07-16-configurador-tableros-design.md`. It covers only Fase A (Fundaciones) from that spec's schedule. Separate plans, written after this one lands (so they can build on real decisions instead of assumptions), will cover: catalog import (Fase B), the configuration engine + BOM + visual schematic (Fase C), the CAD/PDF extraction agent (Track B), and pricing/labor/exportables + UI polish + hardening (Fase D/E). Do not attempt to implement those subsystems as part of this plan.

## Before you start

- Docker Desktop (or equivalent) must be running.
- Node.js 20+ and Python 3.12 should be installed on the host for local iteration (the Docker services are for integration testing and deployment, not day-to-day dev loop).
- All commands below assume the working directory is the repo root, `D:\.proyectos\PYRE\calculador_tab`, unless a task says otherwise.

---

### Task 1: Postgres via Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `db/init/01-create-test-db.sql`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create the directory structure and `.gitignore`**

```bash
mkdir -p db/init backend/app backend/tests frontend
```

Write `.gitignore`:

```
# Python
backend/venv/
backend/__pycache__/
backend/**/__pycache__/
backend/.pytest_cache/
*.pyc

# Node
frontend/node_modules/
frontend/dist/

# Env
.env

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Write `docker-compose.yml` with the `db` service**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tablero
      POSTGRES_PASSWORD: tablero_dev_pw
      POSTGRES_DB: tablero
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tablero"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 3: Write the test-database init script**

`db/init/01-create-test-db.sql`:

```sql
CREATE DATABASE tablero_test;
```

- [ ] **Step 4: Write `.env.example`**

```
TABLERO_DATABASE_URL=postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero
TABLERO_JWT_SECRET=change-me-in-production
TABLERO_ENVIRONMENT=development
```

- [ ] **Step 5: Bring up Postgres and verify both databases exist**

```bash
docker compose up -d db
docker compose exec db pg_isready -U tablero
docker compose exec db psql -U tablero -d tablero -c "\l" | grep tablero
```

Expected: `pg_isready` reports `accepting connections`, and the `\l` output lists both `tablero` and `tablero_test`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml db .env.example .gitignore
git commit -m "chore: add dockerized postgres with dev and test databases"
```

---

### Task 2: Backend skeleton (FastAPI health endpoint)

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/health.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: Create the virtualenv and write `requirements.txt`**

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # PowerShell: venv\Scripts\Activate.ps1
```

`backend/requirements.txt`:

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy==2.0.36
alembic==1.13.3
psycopg2-binary==2.9.10
pydantic==2.9.2
pydantic-settings==2.6.0
email-validator==2.2.0
passlib==1.7.4
bcrypt==4.0.1
pyjwt==2.9.0
python-dotenv==1.0.1
pytest==8.3.3
httpx==0.27.2
```

```bash
pip install -r requirements.txt
```

- [ ] **Step 2: Write a minimal `conftest.py` (env vars only, no app import yet)**

`backend/tests/conftest.py`:

```python
import os

os.environ.setdefault(
    "TABLERO_DATABASE_URL",
    "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero_test",
)
os.environ.setdefault("TABLERO_JWT_SECRET", "test-secret")
os.environ.setdefault("TABLERO_ENVIRONMENT", "test")
```

`backend/tests/__init__.py`: empty file.
`backend/app/__init__.py`: empty file.

- [ ] **Step 3: Write the failing test**

`backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd backend
pytest tests/test_health.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 5: Write the minimal implementation**

`backend/app/routers/__init__.py`: empty file.

`backend/app/routers/health.py`:

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}
```

`backend/app/main.py`:

```python
from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Configurador de Tableros PYRE")

app.include_router(health.router)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pytest tests/test_health.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/app backend/tests
git commit -m "feat: add FastAPI skeleton with health endpoint"
```

---

### Task 3: Database connection module

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Test: `backend/tests/test_database.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_database.py`:

```python
from sqlalchemy import text

from app.database import engine


def test_database_connection_executes_select_1():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_database.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.database'`.

- [ ] **Step 3: Write the minimal implementation**

`backend/app/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TABLERO_", env_file=".env")

    database_url: str = "postgresql+psycopg2://tablero:tablero_dev_pw@localhost:5432/tablero"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 480
    environment: str = "development"


settings = Settings()
```

`backend/app/database.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Make sure Postgres is running before testing:

```bash
docker compose up -d db
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_database.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py backend/app/database.py backend/tests/test_database.py
git commit -m "feat: add database engine/session configuration"
```

---

### Task 4: Core data model + Alembic migration

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/usuario.py`
- Create: `backend/app/models/proyecto.py`
- Create: `backend/app/models/tablero.py`
- Create: `backend/app/models/catalogo.py`
- Create: `backend/app/models/extraccion.py`
- Create: `backend/app/models/audit.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_schema.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_schema.py`:

```python
from sqlalchemy import inspect

from app.database import engine

EXPECTED_TABLES = {
    "usuario",
    "proyecto",
    "tablero",
    "seccion",
    "salida",
    "bom_linea",
    "catalogo_componente",
    "catalogo_precio_historial",
    "extraccion_cad",
    "audit_log",
}


def test_all_core_tables_exist():
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    assert EXPECTED_TABLES.issubset(table_names)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_schema.py -v
```

Expected: FAIL — the expected tables are not a subset of the (empty) actual tables.

- [ ] **Step 3: Write the models**

`backend/app/models/usuario.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RolUsuario(str, enum.Enum):
    ANALISTA = "analista"
    SUPERVISOR = "supervisor"


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(Enum(RolUsuario, name="rol_usuario"), nullable=False)
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

`backend/app/models/proyecto.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EstadoProyecto(str, enum.Enum):
    EN_CURSO = "en_curso"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"


class Proyecto(Base):
    __tablename__ = "proyecto"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    analista_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    estado: Mapped[EstadoProyecto] = mapped_column(
        Enum(EstadoProyecto, name="estado_proyecto"), default=EstadoProyecto.EN_CURSO, nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

`backend/app/models/catalogo.py`:

```python
import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TipoComponente(str, enum.Enum):
    INTERRUPTOR_PRINCIPAL = "interruptor_principal"
    SECCIONAL_TERMOMAGNETICO = "seccional_termomagnetico"
    SECCIONAL_DIFERENCIAL = "seccional_diferencial"


class Proveedor(str, enum.Enum):
    ABB = "abb"
    OTRO = "otro"


class CatalogoComponente(Base):
    __tablename__ = "catalogo_componente"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    proveedor: Mapped[Proveedor] = mapped_column(Enum(Proveedor, name="proveedor"), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    tipo: Mapped[TipoComponente] = mapped_column(Enum(TipoComponente, name="tipo_componente"), nullable=False)
    polos: Mapped[int] = mapped_column(Integer, nullable=False)
    corriente_nominal_a: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    capacidad_corte_ka: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    ancho_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    alto_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    precio_vigente: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    vigente_desde: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class CatalogoPrecioHistorial(Base):
    __tablename__ = "catalogo_precio_historial"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    componente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=False)
    precio_anterior: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    precio_nuevo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

`backend/app/models/tablero.py`:

```python
import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FormatoPolos(str, enum.Enum):
    UNIPOLAR = "unipolar"
    BIPOLAR = "bipolar"
    TETRAPOLAR = "tetrapolar"


class OrigenSalida(str, enum.Enum):
    MANUAL = "manual"
    IA_PENDIENTE = "ia_pendiente"
    IA_CONFIRMADA = "ia_confirmada"


class Tablero(Base):
    __tablename__ = "tablero"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proyecto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("proyecto.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    interruptor_principal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=True
    )
    nivel_falla_ka: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Seccion(Base):
    __tablename__ = "seccion"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tablero_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tablero.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Salida(Base):
    __tablename__ = "salida"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seccion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("seccion.id"), nullable=False)
    carga_valor: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    carga_unidad: Mapped[str] = mapped_column(String(10), nullable=False)
    formato: Mapped[FormatoPolos] = mapped_column(Enum(FormatoPolos, name="formato_polos"), nullable=False)
    componente_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=True
    )
    origen: Mapped[OrigenSalida] = mapped_column(
        Enum(OrigenSalida, name="origen_salida"), default=OrigenSalida.MANUAL, nullable=False
    )
    posicion_orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class BomLinea(Base):
    __tablename__ = "bom_linea"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tablero_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tablero.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    precio_unitario_congelado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

`backend/app/models/extraccion.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EstadoExtraccion(str, enum.Enum):
    PENDIENTE = "pendiente"
    PROCESANDO = "procesando"
    PENDIENTE_REVISION = "pendiente_revision"
    CONFIRMADO = "confirmado"
    ERROR = "error"


class ExtraccionCad(Base):
    __tablename__ = "extraccion_cad"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proyecto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("proyecto.id"), nullable=False)
    archivo_nombre: Mapped[str] = mapped_column(String(500), nullable=False)
    archivo_ruta: Mapped[str] = mapped_column(String(1000), nullable=False)
    resultado_crudo: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    estado: Mapped[EstadoExtraccion] = mapped_column(
        Enum(EstadoExtraccion, name="estado_extraccion"), default=EstadoExtraccion.PENDIENTE, nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

`backend/app/models/audit.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    accion: Mapped[str] = mapped_column(String(255), nullable=False)
    entidad: Mapped[str] = mapped_column(String(100), nullable=False)
    entidad_id: Mapped[str] = mapped_column(String(100), nullable=False)
    detalle: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

`backend/app/models/__init__.py`:

```python
from app.models.audit import AuditLog
from app.models.catalogo import CatalogoComponente, CatalogoPrecioHistorial, Proveedor, TipoComponente
from app.models.extraccion import EstadoExtraccion, ExtraccionCad
from app.models.proyecto import EstadoProyecto, Proyecto
from app.models.tablero import BomLinea, FormatoPolos, OrigenSalida, Salida, Seccion, Tablero
from app.models.usuario import RolUsuario, Usuario

__all__ = [
    "AuditLog",
    "CatalogoComponente",
    "CatalogoPrecioHistorial",
    "Proveedor",
    "TipoComponente",
    "EstadoExtraccion",
    "ExtraccionCad",
    "EstadoProyecto",
    "Proyecto",
    "BomLinea",
    "FormatoPolos",
    "OrigenSalida",
    "Salida",
    "Seccion",
    "Tablero",
    "RolUsuario",
    "Usuario",
]
```

- [ ] **Step 4: Extend `conftest.py` to create the schema before tests run**

Append to `backend/tests/conftest.py`:

```python
import pytest

from app.database import Base, engine
import app.models  # noqa: F401  registers all models on Base.metadata


@pytest.fixture(scope="session", autouse=True)
def _fresh_schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/test_schema.py -v
```

Expected: PASS.

- [ ] **Step 6: Initialize Alembic and point it at the same models/settings**

```bash
alembic init alembic
```

Edit `backend/alembic/env.py` — add near the top (after the existing imports):

```python
from app.database import Base
from app.config import settings
import app.models  # noqa: F401

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", settings.database_url)
```

(Remove/ignore the `target_metadata = None` line Alembic generated by default — replace it with the block above.)

- [ ] **Step 7: Generate and apply the initial migration against the dev database**

```bash
docker compose up -d db
alembic revision --autogenerate -m "esquema inicial"
alembic upgrade head
docker compose exec db psql -U tablero -d tablero -c "\dt" | grep -E "usuario|proyecto|tablero|seccion|salida|bom_linea|catalogo|extraccion|audit"
```

Expected: all ten tables listed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/models backend/alembic backend/alembic.ini backend/tests
git commit -m "feat: add core data model and initial alembic migration"
```

---

### Task 5: Password hashing + JWT utilities

> **Known issue:** `passlib` 1.7.4 (unmaintained since 2020) crashes against `bcrypt` >= 4.1 — bcrypt removed the `__about__` attribute passlib probes for, and newer bcrypt raises instead of silently truncating during passlib's internal 72-byte self-test. `requirements.txt` above already pins `bcrypt==4.0.1` to avoid this; if `pip install` pulls a newer bcrypt anyway, run `pip install "bcrypt==4.0.1"` after.

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/security.py`
- Test: `backend/tests/test_security.py`

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_security.py`:

```python
import time

import jwt
import pytest

from app.auth.security import create_access_token, decode_access_token, hash_password, verify_password
from app.config import settings


def test_hash_password_does_not_return_plaintext():
    hashed = hash_password("clave-segura-123")

    assert hashed != "clave-segura-123"


def test_verify_password_accepts_correct_password():
    hashed = hash_password("clave-segura-123")

    assert verify_password("clave-segura-123", hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("clave-segura-123")

    assert verify_password("otra-clave", hashed) is False


def test_access_token_round_trip():
    token = create_access_token(subject="user-id-123", rol="analista")
    payload = decode_access_token(token)

    assert payload["sub"] == "user-id-123"
    assert payload["rol"] == "analista"


def test_access_token_rejects_bad_signature():
    token = create_access_token(subject="user-id-123", rol="analista")
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(tampered)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_security.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.auth'`.

- [ ] **Step 3: Write the minimal implementation**

`backend/app/auth/__init__.py`: empty file.

`backend/app/auth/security.py`:

```python
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: str, rol: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "rol": rol, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_security.py -v
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth backend/tests/test_security.py
git commit -m "feat: add password hashing and JWT utilities"
```

---

### Task 6: User seed script

**Files:**
- Create: `backend/app/scripts/__init__.py`
- Create: `backend/app/scripts/create_user.py`
- Test: `backend/tests/test_create_user.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_create_user.py`:

```python
import pytest

from app.database import SessionLocal
from app.models import RolUsuario


def test_create_user_hashes_password_and_sets_role():
    from app.scripts.create_user import create_user

    db = SessionLocal()
    try:
        user = create_user("ana.test@pyre.com", "Ana Analista", "clave-segura-123", "analista", db=db)

        assert user.email == "ana.test@pyre.com"
        assert user.password_hash != "clave-segura-123"
        assert user.rol == RolUsuario.ANALISTA
    finally:
        db.close()


def test_create_user_rejects_duplicate_email():
    from app.scripts.create_user import create_user

    db = SessionLocal()
    try:
        create_user("dup.test@pyre.com", "Primero", "clave-segura-123", "analista", db=db)

        with pytest.raises(ValueError):
            create_user("dup.test@pyre.com", "Segundo", "otra-clave", "supervisor", db=db)
    finally:
        db.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_create_user.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.scripts'`.

- [ ] **Step 3: Write the minimal implementation**

`backend/app/scripts/__init__.py`: empty file.

`backend/app/scripts/create_user.py`:

```python
import argparse
import sys

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.database import SessionLocal
from app.models import RolUsuario, Usuario


def create_user(email: str, nombre: str, password: str, rol: str, db: Session | None = None) -> Usuario:
    owns_session = db is None
    if db is None:
        db = SessionLocal()
    try:
        existing = db.query(Usuario).filter(Usuario.email == email).first()
        if existing:
            raise ValueError(f"Ya existe un usuario con email {email}")

        user = Usuario(
            email=email,
            nombre=nombre,
            password_hash=hash_password(password),
            rol=RolUsuario(rol),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Crear usuario (analista o supervisor)")
    parser.add_argument("--email", required=True)
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--rol", required=True, choices=["analista", "supervisor"])
    args = parser.parse_args()

    created = create_user(args.email, args.nombre, args.password, args.rol)
    print(f"Usuario creado: {created.email} ({created.rol.value})")
    sys.exit(0)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_create_user.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scripts backend/tests/test_create_user.py
git commit -m "feat: add CLI script to create analista/supervisor users"
```

---

### Task 7: Auth endpoints (login, me, logout) + dependencies

> **Note:** this task uses Pydantic's `EmailStr`, which requires the `email-validator` package (already added to `requirements.txt` above). Without it, importing `app.main` raises `ImportError: email-validator is not installed`.
>
> **Note:** the login cookie's `secure` flag must be `settings.environment == "production"`, not `!= "development"`. `httpx`'s `TestClient` talks to `http://testserver` (plain HTTP) — a `Secure` cookie is silently dropped by its cookie jar over non-HTTPS, which breaks the `/auth/me` round-trip in tests (`TABLERO_ENVIRONMENT=test` would otherwise evaluate `secure=True`).

**Files:**
- Create: `backend/app/auth/dependencies.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_auth.py`

- [ ] **Step 1: Extend `conftest.py` with a `client` fixture backed by a real DB session**

Append to `backend/tests/conftest.py`:

```python
from fastapi.testclient import TestClient

from app.database import SessionLocal, get_db
from app.main import app


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Write the failing tests**

`backend/tests/test_auth.py`:

```python
from app.scripts.create_user import create_user


def _make_user(db_session, email="login.test@pyre.com", rol="analista"):
    return create_user(email, "Usuaria de Prueba", "clave-segura-123", rol, db=db_session)


def test_login_with_valid_credentials_sets_cookie(client, db_session):
    _make_user(db_session)

    response = client.post("/auth/login", json={"email": "login.test@pyre.com", "password": "clave-segura-123"})

    assert response.status_code == 200
    assert response.json()["email"] == "login.test@pyre.com"
    assert "access_token" in response.cookies


def test_login_with_wrong_password_returns_401(client, db_session):
    _make_user(db_session, email="wrong.test@pyre.com")

    response = client.post("/auth/login", json={"email": "wrong.test@pyre.com", "password": "clave-incorrecta"})

    assert response.status_code == 401


def test_me_without_cookie_returns_401(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_me_with_valid_cookie_returns_user(client, db_session):
    _make_user(db_session, email="me.test@pyre.com")
    client.post("/auth/login", json={"email": "me.test@pyre.com", "password": "clave-segura-123"})

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "me.test@pyre.com"


def test_logout_clears_cookie(client, db_session):
    _make_user(db_session, email="logout.test@pyre.com")
    client.post("/auth/login", json={"email": "logout.test@pyre.com", "password": "clave-segura-123"})

    logout_response = client.post("/auth/logout")
    me_response = client.get("/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401


def test_require_role_allows_matching_role():
    from fastapi import HTTPException

    from app.auth.dependencies import require_role
    from app.models import RolUsuario, Usuario

    checker = require_role(RolUsuario.SUPERVISOR)
    user = Usuario(rol=RolUsuario.SUPERVISOR)

    assert checker(user=user) is user


def test_require_role_rejects_wrong_role():
    from fastapi import HTTPException

    from app.auth.dependencies import require_role
    from app.models import RolUsuario, Usuario

    checker = require_role(RolUsuario.SUPERVISOR)
    user = Usuario(rol=RolUsuario.ANALISTA)

    with pytest.raises(HTTPException) as exc_info:
        checker(user=user)

    assert exc_info.value.status_code == 403
```

Add `import pytest` at the top of `backend/tests/test_auth.py` (alongside the existing `from app.scripts.create_user import create_user` line) since these two new tests use `pytest.raises`.

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/test_auth.py -v
```

Expected: FAIL — `/auth/login` etc. don't exist yet (404s).

- [ ] **Step 4: Write the minimal implementation**

`backend/app/auth/dependencies.py`:

```python
import uuid

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.models import RolUsuario, Usuario


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Usuario:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")

    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = db.get(Usuario, uuid.UUID(payload["sub"]))
    if user is None or not user.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inválido")

    return user


def require_role(*roles: RolUsuario):
    def _checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        if user.rol not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
        return user

    return _checker
```

`backend/app/routers/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, verify_password
from app.config import settings
from app.database import get_db
from app.models import Usuario

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UsuarioResponse(BaseModel):
    id: str
    email: str
    nombre: str
    rol: str

    model_config = {"from_attributes": True}


def _to_response(user: Usuario) -> UsuarioResponse:
    return UsuarioResponse(id=str(user.id), email=user.email, nombre=user.nombre, rol=user.rol.value)


@router.post("/login", response_model=UsuarioResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    token = create_access_token(subject=str(user.id), rol=user.rol.value)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
    )
    return _to_response(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"status": "ok"}


@router.get("/me", response_model=UsuarioResponse)
def me(user: Usuario = Depends(get_current_user)):
    return _to_response(user)
```

`backend/app/main.py` (modify):

```python
from fastapi import FastAPI

from app.routers import auth, health

app = FastAPI(title="Configurador de Tableros PYRE")

app.include_router(health.router)
app.include_router(auth.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_auth.py -v
```

Expected: PASS (7 tests).

- [ ] **Step 6: Run the full backend suite to confirm no regressions**

```bash
pytest -v
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth backend/app/routers/auth.py backend/app/main.py backend/tests
git commit -m "feat: add login/me/logout endpoints with cookie-based JWT auth"
```

---

### Task 8: CORS configuration for the frontend origin

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/config.py`
- Test: `backend/tests/test_cors.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_cors.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_preflight_allows_configured_frontend_origin():
    client = TestClient(app)

    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_cors.py -v
```

Expected: FAIL — no CORS headers present.

- [ ] **Step 3: Write the minimal implementation**

`backend/app/config.py` — add one field to `Settings`:

```python
    frontend_origin: str = "http://localhost:5173"
```

`backend/app/main.py` (modify):

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, health

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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_cors.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/app/config.py backend/tests/test_cors.py
git commit -m "feat: restrict CORS to the configured frontend origin"
```

---

### Task 9: Frontend scaffold (Vite + React + TypeScript + Vitest)

**Files:**
- Create: `frontend/` (via Vite scaffold)
- Modify: `frontend/vite.config.ts`
- Create: `frontend/vitest.setup.ts`

- [ ] **Step 1: Scaffold the app**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Configure Vitest**

`frontend/vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Modify `frontend/vite.config.ts` to add the `test` block (keep the existing `plugins` config from the scaffold). Import `defineConfig` from `"vitest/config"`, not `"vite"` — the plain `vite` export's types don't know about the `test` key and `tsc -b` fails with "Object literal may only specify known properties, and 'test' does not exist in type 'UserConfigExport'":

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

Add to `frontend/package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 3: Verify the default scaffold test setup works**

Create `frontend/src/sanity.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

```bash
npm run test
```

Expected: 1 test file, 1 test, PASS.

Delete `frontend/src/sanity.test.tsx` after confirming — it was only to verify the harness.

- [ ] **Step 4: Add jest-dom matcher types so `tsc -b` recognizes them**

The scaffold's `tsconfig.app.json` only lists `"types": ["vite/client"]`. Without also listing `@testing-library/jest-dom`, `tsc -b` fails on any use of matchers like `toBeInTheDocument`/`toHaveTextContent` with "Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'" even though the tests run fine under Vitest. Modify `frontend/tsconfig.app.json`:

```json
    "types": ["vite/client", "@testing-library/jest-dom"],
```

- [ ] **Step 5: Verify the build's type-check passes**

```bash
npx tsc -b
```

Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "chore: scaffold React/TypeScript frontend with Vitest"
```

---

### Task 10: Frontend API client + LoginPage

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/.env.development`
- Test: `frontend/src/pages/LoginPage.test.tsx`

- [ ] **Step 1: Write `.env.development`**

```
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 2: Write the failing test**

`frontend/src/pages/LoginPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1", email: "ana@pyre.com", nombre: "Ana", rol: "analista" }),
      }),
    );
  });

  it("submits credentials to the login endpoint", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/email/i), "ana@pyre.com");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "clave-segura-123");
    await userEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("shows an error message on failed login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/email/i), "ana@pyre.com");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "clave-incorrecta");
    await userEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/credenciales inválidas/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL — `./LoginPage` module not found.

- [ ] **Step 4: Write the minimal implementation**

`frontend/src/api/client.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: "analista" | "supervisor";
}

export async function login(email: string, password: string): Promise<Usuario> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Credenciales inválidas");
  }

  return response.json();
}

export async function fetchCurrentUser(): Promise<Usuario | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
}
```

`frontend/src/pages/LoginPage.tsx` — note the type-only import for `FormEvent`: the scaffold's `tsconfig.app.json` has `verbatimModuleSyntax: true`, which rejects `import { FormEvent, useState } from "react"` with "'FormEvent' is a type and must be imported using a type-only import":

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Credenciales inválidas");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Configurador de Tableros PYRE</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="password">Contraseña</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Ingresar</button>
    </form>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api frontend/src/pages/LoginPage.tsx frontend/src/pages/LoginPage.test.tsx frontend/.env.development
git commit -m "feat: add API client and login page"
```

---

### Task 11: RequireAuth guard + routing

**Files:**
- Create: `frontend/src/auth/RequireAuth.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/auth/RequireAuth.test.tsx`

- [ ] **Step 1: Write the failing test**

`frontend/src/auth/RequireAuth.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";

vi.mock("../api/client", () => ({
  fetchCurrentUser: vi.fn(),
}));

import { fetchCurrentUser } from "../api/client";

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <p>Panel protegido</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("renders children when the user is authenticated", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      id: "1",
      email: "ana@pyre.com",
      nombre: "Ana",
      rol: "analista",
    });

    renderWithRouter();

    expect(await screen.findByText("Panel protegido")).toBeInTheDocument();
  });

  it("redirects to /login when the user is not authenticated", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(null);

    renderWithRouter();

    expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL — `./RequireAuth` module not found.

- [ ] **Step 3: Write the minimal implementation**

`frontend/src/auth/RequireAuth.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { fetchCurrentUser } from "../api/client";

type Status = "loading" | "authenticated" | "anonymous";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((user) => {
      if (!active) return;
      setStatus(user ? "authenticated" : "anonymous");
    });
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") return <p>Cargando...</p>;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

`frontend/src/pages/DashboardPage.tsx`:

```tsx
export function DashboardPage() {
  return <h1>Panel de proyectos (próximamente)</h1>;
}
```

`frontend/src/App.tsx` (replace the scaffolded content entirely):

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS (2 tests), plus the existing LoginPage tests still pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth frontend/src/pages/DashboardPage.tsx frontend/src/App.tsx
git commit -m "feat: add auth guard and wire up routing"
```

---

### Task 12: Full-stack Docker Compose integration + manual smoke test

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Modify: `docker-compose.yml`

- [ ] **Step 0: Write `.dockerignore` files so `COPY . .` doesn't ship the host venv/node_modules into the Linux image**

`backend/.dockerignore`:

```
venv/
__pycache__/
**/__pycache__/
.pytest_cache/
*.pyc
```

`frontend/.dockerignore`:

```
node_modules/
dist/
```

Without these, `COPY . .` in the backend Dockerfile copies the Windows-built `venv/` (binary-incompatible with the Linux image) into the container, and the frontend `COPY . .` re-copies host `node_modules/` over the ones just installed by `npm install` in the image.

- [ ] **Step 1: Write the backend Dockerfile**

`backend/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write the frontend Dockerfile (dev server, not a production build yet)**

`frontend/Dockerfile`:

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json .
RUN npm install

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

- [ ] **Step 3: Add `backend` and `frontend` services to `docker-compose.yml`**

Modify `docker-compose.yml` — add under `services:` (keep the existing `db` service and `volumes:` block as-is):

```yaml
  backend:
    build: ./backend
    environment:
      TABLERO_DATABASE_URL: postgresql+psycopg2://tablero:tablero_dev_pw@db:5432/tablero
      TABLERO_JWT_SECRET: dev-secret-change-me
      TABLERO_ENVIRONMENT: development
      TABLERO_FRONTEND_ORIGIN: http://localhost:5173
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    environment:
      VITE_API_BASE_URL: http://localhost:8000
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

- [ ] **Step 4: Bring up the full stack and run migrations inside the backend container**

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.create_user --email analista@pyre.com --nombre "Analista Demo" --password "clave-demo-123" --rol analista
```

Expected: no errors; the final command prints `Usuario creado: analista@pyre.com (analista)`.

- [ ] **Step 5: Manual smoke test in the browser**

Open `http://localhost:5173/login`, log in with `analista@pyre.com` / `clave-demo-123`, and confirm you land on the "Panel de proyectos (próximamente)" page. Then open `http://localhost:5173/` directly in a new private/incognito window (no cookie) and confirm you're redirected to `/login`.

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile docker-compose.yml
git commit -m "feat: containerize backend and frontend for full-stack local runs"
```

---

### Task 13: Reference documentation

**Files:**
- Create: `docs/diccionario_datos.md`
- Create: `docs/reglas_negocio.md`
- Create: `docs/README.md`

- [ ] **Step 1: Write the data dictionary**

`docs/diccionario_datos.md`:

```markdown
# Diccionario de datos

Ver el modelo completo en `backend/app/models/`. Resumen de cada tabla y su propósito:

- **usuario** — cuentas del sistema. `rol` es `analista` o `supervisor`. Ambos roles pueden subir catálogo.
- **proyecto** — un proyecto de cliente. `analista_id` es el propietario actual (reasignable). El supervisor ve todos.
- **tablero** — un tablero dentro de un proyecto. `nivel_falla_ka` es el Icc del punto de instalación, usado por el motor de configuración para calcular capacidad de corte mínima de cada salida.
- **seccion** — módulo/columna física de un tablero.
- **salida** — una "necesidad" cargada por el analista o propuesta por el agente de IA (`origen`). Nunca se considera confirmada hasta que `origen` es `manual` o `ia_confirmada`.
- **bom_linea** — línea de BOM derivada de las salidas confirmadas. `precio_unitario_congelado` fija el precio al momento de cotizar, independiente de cambios posteriores del catálogo.
- **catalogo_componente** — catálogo de componentes (ABB + otros proveedores), con dimensiones en mm para el esquema visual.
- **catalogo_precio_historial** — todo cambio de precio de catálogo, auditado.
- **extraccion_cad** — resultado crudo de una extracción de IA sobre un archivo CAD/PDF, pendiente de revisión por un analista.
- **audit_log** — trazabilidad genérica de acciones sobre catálogo/proyectos/BOM.

Este documento se actualiza a medida que se agregan tablas/columnas en fases posteriores.
```

- [ ] **Step 2: Write the business rules stub**

`docs/reglas_negocio.md`:

```markdown
# Reglas de negocio

## Alcance de esta fase
Solo tableros seccionables: interruptor principal + interruptores seccionales (con o sin disyuntor/diferencial), alimentando cargas e iluminación. Contactores, guardamotores y soft starters quedan fuera hasta v2+.

## Motor de configuración (a implementar en el plan de Fase C)
1. El analista carga carga (kW o A) + formato (uni/bi/tetrapolar) por salida.
2. El sistema determina la corriente nominal necesaria.
3. Evalúa selectividad contra el interruptor aguas arriba de la sección.
4. Determina la capacidad de corte mínima según `tablero.nivel_falla_ka`.
5. Propone el componente de catálogo que cumple esas condiciones al menor costo; el analista confirma o cambia.

Las reglas de selectividad/capacidad de corte deben vivir como datos configurables, no como lógica hardcodeada — pendiente de tabla de reglas en el plan de Fase C.

## Precios
- Materiales: suma de `catalogo_componente.precio_vigente` (congelado en `bom_linea.precio_unitario_congelado` al cotizar) para el interruptor principal + cada salida confirmada.
- Mano de obra: estimación del proyecto completo, excluyendo gestión de compra — pendiente de definir tabla de tasas/tiempos en el plan de Fase D.
- Impuestos, costos financieros y tipo de cambio quedan fuera del sistema; el analista los calcula externamente sobre el Excel exportado.

## Roles
- **Analista**: crea/edita sus propios proyectos; puede subir/actualizar catálogo.
- **Supervisor**: además ve y revisa los proyectos de todos los analistas.
- Toda subida de catálogo queda auditada (`catalogo_precio_historial`, `audit_log`) y es visible para todos los analistas.
- Los proyectos son reasignables entre analistas sin bloqueo.

Este documento se actualiza a medida que se implementan las fases posteriores.
```

- [ ] **Step 3: Write the developer README**

`docs/README.md`:

```markdown
# Desarrollo local — Configurador de Tableros PYRE

## Requisitos
- Docker Desktop
- Python 3.12 (para iterar en el backend fuera de contenedor)
- Node.js 20+ (para iterar en el frontend fuera de contenedor)

## Levantar solo la base de datos (flujo de desarrollo día a día)

```bash
docker compose up -d db
cd backend && source venv/Scripts/activate && pytest -v
cd frontend && npm run dev
```

## Levantar el stack completo (integración)

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Frontend: http://localhost:5173 — Backend: http://localhost:8000/health

## Crear un usuario

```bash
docker compose exec backend python -m app.scripts.create_user --email nombre@pyre.com --nombre "Nombre Apellido" --password "clave" --rol analista
```

## Documentos de referencia
- `docs/diccionario_datos.md` — qué significa cada tabla/columna.
- `docs/reglas_negocio.md` — reglas de cálculo y de acceso vigentes.
- `docs/superpowers/specs/` — specs de diseño aprobadas.
- `docs/superpowers/plans/` — planes de implementación.
```

- [ ] **Step 4: Commit**

```bash
git add docs/diccionario_datos.md docs/reglas_negocio.md docs/README.md
git commit -m "docs: add data dictionary, business rules, and dev README"
```

---

## Definition of done for this plan

- `pytest -v` in `backend/` passes with 0 failures.
- `npm run test` in `frontend/` passes with 0 failures.
- `docker compose up -d --build` brings up `db` + `backend` + `frontend` cleanly.
- A user created via the seed script can log in through the browser UI and reach the protected dashboard; an unauthenticated visit to `/` redirects to `/login`.
- `docs/diccionario_datos.md`, `docs/reglas_negocio.md`, and `docs/README.md` exist and reflect the schema/rules actually implemented.
