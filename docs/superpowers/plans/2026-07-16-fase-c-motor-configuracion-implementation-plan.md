# Motor de configuración (Fase C, ciclo 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend del motor de configuración manual-asistida — cálculo de corriente nominal, verificación de selectividad y capacidad de corte, propuesta automática del componente más barato, expuesto vía API REST sobre proyecto→tablero→sección→salida.

**Architecture:** Paquete `backend/app/motor/` con funciones puras (sin I/O) para los cálculos, más una función de propuesta que sí consulta el catálogo. Routers FastAPI nuevos (`proyectos`, `tableros`, `salidas`, `parametros_calculo`) siguiendo el patrón ya usado en `app/routers/auth.py` y `app/routers/catalogo.py` (Pydantic `BaseModel` inline, sin capa de schemas separada). El motor asume que `catalogo_componente.atributos` ya tiene las claves `tipo`/`polos`/`corriente_nominal_a`/`capacidad_corte_ka` — poblarlas desde el Excel real de ABB es un ciclo aparte (ver spec).

**Tech Stack:** Python/FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + pytest.

**Nota de alcance:** este plan cubre solo el backend. La UI mínima (formularios de carga de tablero/secciones/salidas y pantalla de parámetros de cálculo) descrita en la spec queda para un plan aparte — es una unidad de trabajo independiente y testeable por separado, y separarla evita un solo plan gigante.

**Spec:** `docs/superpowers/specs/2026-07-16-fase-c-motor-configuracion-design.md`

---

### Task 1: Modelo de datos — `salida.tipo_proteccion` + tabla `parametro_calculo`

**Files:**
- Modify: `backend/app/models/tablero.py`
- Create: `backend/app/models/parametro_calculo.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/test_schema.py`
- Create: `backend/tests/test_tablero_schema.py`
- Create: `backend/alembic/versions/<autogenerado>_motor_configuracion.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_tablero_schema.py`:
```python
from sqlalchemy import inspect

from app.database import engine


def test_salida_tiene_columna_tipo_proteccion():
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("salida")}

    assert "tipo_proteccion" in columns


def test_parametro_calculo_tiene_las_columnas_esperadas():
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("parametro_calculo")}

    assert columns == {
        "id",
        "tension_mono_v",
        "tension_tri_v",
        "cos_phi",
        "ratio_selectividad",
        "actualizado_por",
        "actualizado_en",
    }
```

Modify `backend/tests/test_schema.py` — agregar `"parametro_calculo"` al set:
```python
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
    "parametro_calculo",
}
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_tablero_schema.py tests/test_schema.py -v`
Expected: FAIL — `parametro_calculo` no existe, `tipo_proteccion` no está en las columnas de `salida`.

- [ ] **Step 3: Agregar `TipoProteccion` y la columna a `Salida`**

En `backend/app/models/tablero.py`, agregar el enum junto a `OrigenSalida` y la columna a la clase `Salida`:

```python
class TipoProteccion(str, enum.Enum):
    SECCIONAL_TERMOMAGNETICO = "seccional_termomagnetico"
    SECCIONAL_DIFERENCIAL = "seccional_diferencial"
```

En la clase `Salida`, agregar después de `formato`:
```python
    tipo_proteccion: Mapped[TipoProteccion] = mapped_column(
        Enum(TipoProteccion, name="tipo_proteccion"), nullable=False
    )
```

- [ ] **Step 4: Crear el modelo `ParametroCalculo`**

`backend/app/models/parametro_calculo.py`:
```python
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ParametroCalculo(Base):
    __tablename__ = "parametro_calculo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tension_mono_v: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("220"))
    tension_tri_v: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("380"))
    cos_phi: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.9"))
    ratio_selectividad: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=Decimal("1.6"))
    actualizado_por: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=True
    )
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

- [ ] **Step 5: Exportar los nombres nuevos**

Modify `backend/app/models/__init__.py`:
```python
from app.models.audit import AuditLog
from app.models.catalogo import CatalogoComponente, CatalogoPrecioHistorial
from app.models.extraccion import EstadoExtraccion, ExtraccionCad
from app.models.parametro_calculo import ParametroCalculo
from app.models.proyecto import EstadoProyecto, Proyecto
from app.models.tablero import BomLinea, FormatoPolos, OrigenSalida, Salida, Seccion, Tablero, TipoProteccion
from app.models.usuario import RolUsuario, Usuario

__all__ = [
    "AuditLog",
    "CatalogoComponente",
    "CatalogoPrecioHistorial",
    "EstadoExtraccion",
    "ExtraccionCad",
    "EstadoProyecto",
    "ParametroCalculo",
    "Proyecto",
    "BomLinea",
    "FormatoPolos",
    "OrigenSalida",
    "Salida",
    "Seccion",
    "Tablero",
    "TipoProteccion",
    "RolUsuario",
    "Usuario",
]
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_tablero_schema.py tests/test_schema.py -v`
Expected: PASS

- [ ] **Step 7: Generar y ajustar la migración de Alembic**

Con la base de desarrollo levantada (`docker compose up -d db`), correr:

Run: `cd backend && venv/Scripts/alembic revision --autogenerate -m "motor de configuracion: tipo_proteccion en salida y parametro_calculo"`

Esto crea `backend/alembic/versions/<hash>_motor_de_configuracion_tipo_proteccion_en_salida_y_parametro_calculo.py` con un `revision` autogenerado y `down_revision = '8a650955d6af'`. Reemplazar el cuerpo de `upgrade()`/`downgrade()` (dejando las líneas de `revision`/`down_revision`/`Create Date` que Alembic generó) por:

```python
from sqlalchemy.dialects import postgresql

tipo_proteccion_enum = postgresql.ENUM(
    'seccional_termomagnetico', 'seccional_diferencial', name='tipo_proteccion'
)

# NOTE: agrega una columna NOT NULL sin server_default a `salida`, lo que asume
# que la tabla está vacía (vale hoy — la Fase C todavía no cargó tableros reales).
# Si esta migración se reproduce contra un ambiente con datos, agregar un
# server_default o un paso de backfill.


def upgrade() -> None:
    tipo_proteccion_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('salida', sa.Column('tipo_proteccion', tipo_proteccion_enum, nullable=False))

    op.create_table(
        'parametro_calculo',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tension_mono_v', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('tension_tri_v', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('cos_phi', sa.Numeric(precision=3, scale=2), nullable=False),
        sa.Column('ratio_selectividad', sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column('actualizado_por', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actualizado_por'], ['usuario.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('parametro_calculo')
    op.drop_column('salida', 'tipo_proteccion')
    tipo_proteccion_enum.drop(op.get_bind(), checkfirst=True)
```

(Mantener los imports `from alembic import op` y `import sqlalchemy as sa` que Alembic ya puso arriba del archivo; agregar el import de `postgresql` si el autogenerador no lo puso.)

- [ ] **Step 8: Verificar la migración contra la base real**

Run: `cd backend && venv/Scripts/alembic upgrade head`
Expected: corre sin error. Luego `venv/Scripts/alembic downgrade -1 && venv/Scripts/alembic upgrade head` para confirmar que `downgrade()` también es correcto.

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/tablero.py backend/app/models/parametro_calculo.py backend/app/models/__init__.py backend/tests/test_schema.py backend/tests/test_tablero_schema.py backend/alembic/versions/
git commit -m "feat: add salida.tipo_proteccion and parametro_calculo table"
```

---

### Task 2: Motor — cálculo de corriente nominal

**Files:**
- Create: `backend/app/motor/__init__.py`
- Create: `backend/app/motor/calculo.py`
- Create: `backend/tests/test_motor_calculo.py`

- [ ] **Step 1: Crear el paquete vacío**

`backend/app/motor/__init__.py`: archivo vacío.

- [ ] **Step 2: Escribir los tests que fallan**

`backend/tests/test_motor_calculo.py`:
```python
from decimal import Decimal

import pytest

from app.models import FormatoPolos, ParametroCalculo
from app.motor.calculo import calcular_corriente_nominal


def _parametros(**overrides):
    defaults = dict(
        tension_mono_v=Decimal("220"),
        tension_tri_v=Decimal("380"),
        cos_phi=Decimal("0.9"),
        ratio_selectividad=Decimal("1.6"),
    )
    defaults.update(overrides)
    return ParametroCalculo(**defaults)


def test_carga_en_amperios_se_devuelve_tal_cual():
    resultado = calcular_corriente_nominal(Decimal("16"), "A", FormatoPolos.UNIPOLAR, _parametros())

    assert resultado == Decimal("16")


def test_carga_en_kw_monofasica_usa_tension_mono_y_cos_phi():
    resultado = calcular_corriente_nominal(Decimal("2"), "kW", FormatoPolos.UNIPOLAR, _parametros())

    assert round(resultado, 2) == Decimal("10.10")


def test_carga_en_kw_bipolar_usa_tambien_tension_mono():
    resultado = calcular_corriente_nominal(Decimal("2"), "kW", FormatoPolos.BIPOLAR, _parametros())

    assert round(resultado, 2) == Decimal("10.10")


def test_carga_en_kw_tetrapolar_usa_tension_tri_y_raiz_de_3():
    resultado = calcular_corriente_nominal(Decimal("10"), "kW", FormatoPolos.TETRAPOLAR, _parametros())

    assert round(resultado, 2) == Decimal("16.88")


def test_unidad_no_soportada_lanza_value_error():
    with pytest.raises(ValueError):
        calcular_corriente_nominal(Decimal("5"), "V", FormatoPolos.UNIPOLAR, _parametros())
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_calculo.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.motor.calculo'`

- [ ] **Step 4: Implementar `calcular_corriente_nominal`**

`backend/app/motor/calculo.py`:
```python
from decimal import Decimal

from app.models import FormatoPolos, ParametroCalculo

RAIZ_DE_3 = Decimal("1.732")


def calcular_corriente_nominal(
    carga_valor: Decimal, carga_unidad: str, formato: FormatoPolos, parametros: ParametroCalculo
) -> Decimal:
    if carga_unidad == "A":
        return carga_valor

    if carga_unidad != "kW":
        raise ValueError(f"Unidad de carga no soportada: {carga_unidad}")

    potencia_va = carga_valor * 1000
    if formato == FormatoPolos.TETRAPOLAR:
        denominador = parametros.tension_tri_v * RAIZ_DE_3 * parametros.cos_phi
    else:
        denominador = parametros.tension_mono_v * parametros.cos_phi

    return potencia_va / denominador


def verificar_selectividad(
    nominal_aguas_arriba: Decimal, nominal_propuesto: Decimal, ratio_selectividad: Decimal
) -> bool:
    return nominal_aguas_arriba >= nominal_propuesto * ratio_selectividad
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_calculo.py -v`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/motor/__init__.py backend/app/motor/calculo.py backend/tests/test_motor_calculo.py
git commit -m "feat: add motor calculo (corriente nominal)"
```

---

### Task 3: Motor — verificación de selectividad

**Files:**
- Modify: `backend/tests/test_motor_calculo.py`

`verificar_selectividad` ya quedó implementada en el Task 2 (vive en el mismo archivo `calculo.py` que `calcular_corriente_nominal` — comparten el mismo dominio de cálculo puro). Este task solo agrega su cobertura de tests.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `backend/tests/test_motor_calculo.py`:
```python
from app.motor.calculo import verificar_selectividad


def test_selectividad_ok_justo_en_el_limite():
    assert verificar_selectividad(Decimal("32"), Decimal("20"), Decimal("1.6")) is True


def test_selectividad_ok_con_margen():
    assert verificar_selectividad(Decimal("50"), Decimal("20"), Decimal("1.6")) is True


def test_selectividad_falla_por_debajo_del_ratio():
    assert verificar_selectividad(Decimal("31"), Decimal("20"), Decimal("1.6")) is False
```

(Mover el `from app.motor.calculo import verificar_selectividad` al bloque de imports del principio del archivo, junto al import existente de `calcular_corriente_nominal`, en vez de dejarlo a mitad de archivo.)

- [ ] **Step 2: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_calculo.py -v`
Expected: PASS (8 tests) — ya estaba implementada, este step confirma la cobertura.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_motor_calculo.py
git commit -m "test: cover verificar_selectividad boundary cases"
```

---

### Task 4: Servicio — parámetros de cálculo (bootstrap de la fila única)

**Files:**
- Create: `backend/app/motor/parametros.py`
- Create: `backend/tests/test_motor_parametros.py`

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_motor_parametros.py`:
```python
from decimal import Decimal

from app.models import ParametroCalculo
from app.motor.parametros import obtener_parametros


def test_crea_parametros_por_defecto_si_no_existen(db_session):
    parametros = obtener_parametros(db_session)

    assert parametros.tension_mono_v == Decimal("220.00")
    assert parametros.tension_tri_v == Decimal("380.00")
    assert parametros.cos_phi == Decimal("0.90")
    assert parametros.ratio_selectividad == Decimal("1.60")


def test_devuelve_la_misma_fila_en_llamadas_sucesivas(db_session):
    primera = obtener_parametros(db_session)
    segunda = obtener_parametros(db_session)

    assert primera.id == segunda.id
    assert db_session.query(ParametroCalculo).count() == 1
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_parametros.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.motor.parametros'`

- [ ] **Step 3: Implementar `obtener_parametros`**

`backend/app/motor/parametros.py`:
```python
from sqlalchemy.orm import Session

from app.models import ParametroCalculo


def obtener_parametros(db: Session) -> ParametroCalculo:
    parametros = db.query(ParametroCalculo).first()
    if parametros is None:
        parametros = ParametroCalculo()
        db.add(parametros)
        db.commit()
        db.refresh(parametros)
    return parametros
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_parametros.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/motor/parametros.py backend/tests/test_motor_parametros.py
git commit -m "feat: add obtener_parametros bootstrap service"
```

---

### Task 5: Motor — propuesta de componente

**Files:**
- Create: `backend/app/motor/propuesta.py`
- Create: `backend/tests/test_motor_propuesta.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_motor_propuesta.py`:
```python
from decimal import Decimal

from app.models import CatalogoComponente, FormatoPolos, ParametroCalculo, TipoProteccion
from app.motor.propuesta import proponer_componente


def _parametros(**overrides):
    defaults = dict(
        tension_mono_v=Decimal("220"),
        tension_tri_v=Decimal("380"),
        cos_phi=Decimal("0.9"),
        ratio_selectividad=Decimal("1.6"),
    )
    defaults.update(overrides)
    return ParametroCalculo(**defaults)


def _componente(db_session, codigo, tipo="seccional_termomagnetico", polos=1, corriente=20, ka=6, precio="50.00"):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=f"Interruptor {codigo}",
        unidad="Unidad",
        precio_neto=Decimal(precio),
        atributos={"tipo": tipo, "polos": polos, "corriente_nominal_a": corriente, "capacidad_corte_ka": ka},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_propone_el_mas_barato_que_cumple(db_session):
    _componente(db_session, "PROP-C1", corriente=20, ka=6, precio="80.00")
    barato = _componente(db_session, "PROP-C2", corriente=20, ka=6, precio="50.00")

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado.id == barato.id


def test_sin_match_por_corriente_insuficiente(db_session):
    _componente(db_session, "PROP-C3", corriente=10, ka=6)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado is None


def test_sin_match_por_capacidad_de_corte_insuficiente(db_session):
    _componente(db_session, "PROP-C4", corriente=20, ka=4)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado is None


def test_sin_match_por_selectividad(db_session):
    _componente(db_session, "PROP-C5", corriente=20, ka=6)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("30"), _parametros(),
    )

    assert resultado is None


def test_ignora_componentes_de_otro_tipo_o_polos(db_session):
    _componente(db_session, "PROP-C6", tipo="seccional_diferencial", corriente=20, ka=6)
    _componente(db_session, "PROP-C7", polos=2, corriente=20, ka=6)

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado is None


def test_empate_de_precio_desempata_por_codigo(db_session):
    _componente(db_session, "PROP-C9", corriente=20, ka=6, precio="50.00")
    primero = _componente(db_session, "PROP-C8", corriente=20, ka=6, precio="50.00")

    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado.codigo == primero.codigo == "PROP-C8"


def test_catalogo_vacio_devuelve_none(db_session):
    resultado = proponer_componente(
        db_session, TipoProteccion.SECCIONAL_TERMOMAGNETICO, FormatoPolos.UNIPOLAR,
        Decimal("16"), Decimal("6"), Decimal("40"), _parametros(),
    )

    assert resultado is None
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_propuesta.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.motor.propuesta'`

- [ ] **Step 3: Implementar `proponer_componente`**

`backend/app/motor/propuesta.py`:
```python
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import CatalogoComponente, FormatoPolos, ParametroCalculo, TipoProteccion
from app.motor.calculo import verificar_selectividad

POLOS_POR_FORMATO = {
    FormatoPolos.UNIPOLAR: 1,
    FormatoPolos.BIPOLAR: 2,
    FormatoPolos.TETRAPOLAR: 4,
}


def proponer_componente(
    db: Session,
    tipo_proteccion: TipoProteccion,
    formato: FormatoPolos,
    corriente_nominal: Decimal,
    capacidad_corte_min: Decimal,
    nominal_aguas_arriba: Decimal,
    parametros: ParametroCalculo,
) -> CatalogoComponente | None:
    polos_requeridos = POLOS_POR_FORMATO[formato]

    candidatos = (
        db.query(CatalogoComponente)
        .filter(CatalogoComponente.atributos.isnot(None))
        .filter(CatalogoComponente.precio_neto.isnot(None))
        .order_by(CatalogoComponente.precio_neto.asc(), CatalogoComponente.codigo.asc())
        .all()
    )

    for candidato in candidatos:
        atributos = candidato.atributos
        if atributos.get("tipo") != tipo_proteccion.value:
            continue
        if atributos.get("polos") != polos_requeridos:
            continue

        corriente_candidato = Decimal(str(atributos.get("corriente_nominal_a", 0)))
        if corriente_candidato < corriente_nominal:
            continue
        if Decimal(str(atributos.get("capacidad_corte_ka", 0))) < capacidad_corte_min:
            continue
        if not verificar_selectividad(nominal_aguas_arriba, corriente_candidato, parametros.ratio_selectividad):
            continue

        return candidato

    return None
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_propuesta.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/motor/propuesta.py backend/tests/test_motor_propuesta.py
git commit -m "feat: add proponer_componente"
```

---

### Task 6: Router — `proyectos` (CRUD mínimo)

**Files:**
- Create: `backend/app/routers/proyectos.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_proyectos_endpoint.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_proyectos_endpoint.py`:
```python
from app.scripts.create_user import create_user


def _login(client, db_session, email="proyectos.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def test_crear_proyecto_requiere_autenticacion(client):
    response = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "Tablero principal"})

    assert response.status_code == 401


def test_crear_proyecto_devuelve_el_proyecto_creado(client, db_session):
    _login(client, db_session)

    response = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "Tablero principal"})

    assert response.status_code == 201
    body = response.json()
    assert body["cliente"] == "Cliente A"
    assert body["nombre"] == "Tablero principal"
    assert body["estado"] == "en_curso"


def test_listar_proyectos_incluye_los_creados(client, db_session):
    _login(client, db_session, email="listar.test@pyre.com")
    client.post("/proyectos", json={"cliente": "Cliente B", "nombre": "Proyecto listado"})

    response = client.get("/proyectos")

    assert response.status_code == 200
    nombres = [p["nombre"] for p in response.json()]
    assert "Proyecto listado" in nombres


def test_obtener_proyecto_inexistente_devuelve_404(client, db_session):
    _login(client, db_session, email="notfound.test@pyre.com")
    import uuid

    response = client.get(f"/proyectos/{uuid.uuid4()}")

    assert response.status_code == 404
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_proyectos_endpoint.py -v`
Expected: FAIL — `404 Not Found` en vez de las rutas esperadas (el router todavía no existe / no está registrado).

- [ ] **Step 3: Implementar el router**

`backend/app/routers/proyectos.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Proyecto, RolUsuario, Usuario

router = APIRouter(prefix="/proyectos", tags=["proyectos"])


class ProyectoCreate(BaseModel):
    cliente: str
    nombre: str


class ProyectoResponse(BaseModel):
    id: str
    cliente: str
    nombre: str
    analista_id: str
    estado: str

    model_config = {"from_attributes": True}


def _to_response(proyecto: Proyecto) -> ProyectoResponse:
    return ProyectoResponse(
        id=str(proyecto.id),
        cliente=proyecto.cliente,
        nombre=proyecto.nombre,
        analista_id=str(proyecto.analista_id),
        estado=proyecto.estado.value,
    )


@router.post("", response_model=ProyectoResponse, status_code=status.HTTP_201_CREATED)
def crear_proyecto(
    payload: ProyectoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = Proyecto(cliente=payload.cliente, nombre=payload.nombre, analista_id=usuario.id)
    db.add(proyecto)
    db.commit()
    db.refresh(proyecto)
    return _to_response(proyecto)


@router.get("", response_model=list[ProyectoResponse])
def listar_proyectos(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)):
    proyectos = db.query(Proyecto).all()
    return [_to_response(p) for p in proyectos]


@router.get("/{proyecto_id}", response_model=ProyectoResponse)
def obtener_proyecto(
    proyecto_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    return _to_response(proyecto)
```

Modify `backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, catalogo, health, proyectos

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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_proyectos_endpoint.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/proyectos.py backend/app/main.py backend/tests/test_proyectos_endpoint.py
git commit -m "feat: add proyectos CRUD endpoint"
```

---

### Task 7: Router — `tableros` + `secciones`

**Files:**
- Create: `backend/app/routers/tableros.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_tableros_endpoint.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_tableros_endpoint.py`:
```python
from decimal import Decimal

from app.scripts.create_user import create_user


def _proyecto(client, db_session, email="tableros.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})
    respuesta = client.post("/proyectos", json={"cliente": "Cliente Tablero", "nombre": "Proyecto Tablero"})
    return respuesta.json()["id"]


def test_crear_tablero_devuelve_el_tablero_creado(client, db_session):
    proyecto_id = _proyecto(client, db_session)

    response = client.post(
        f"/proyectos/{proyecto_id}/tableros",
        json={"nombre": "TG1", "nivel_falla_ka": "10.00"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "TG1"
    assert body["proyecto_id"] == proyecto_id
    assert body["interruptor_principal_id"] is None


def test_crear_tablero_en_proyecto_inexistente_devuelve_404(client, db_session):
    _proyecto(client, db_session, email="tableros404.test@pyre.com")
    import uuid

    response = client.post(
        f"/proyectos/{uuid.uuid4()}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    )

    assert response.status_code == 404


def test_crear_seccion_devuelve_la_seccion_creada(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="secciones.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]

    response = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1", "orden": 1})

    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "Sección 1"
    assert body["tablero_id"] == tablero_id


def test_crear_seccion_en_tablero_inexistente_devuelve_404(client, db_session):
    _proyecto(client, db_session, email="secciones404.test@pyre.com")
    import uuid

    response = client.post(f"/tableros/{uuid.uuid4()}/secciones", json={"nombre": "X"})

    assert response.status_code == 404
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_tableros_endpoint.py -v`
Expected: FAIL — rutas inexistentes (404 genérico de FastAPI, no el 404 con detalle esperado).

- [ ] **Step 3: Implementar el router**

`backend/app/routers/tableros.py`:
```python
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Proyecto, RolUsuario, Seccion, Tablero, Usuario

router = APIRouter(tags=["tableros"])


class TableroCreate(BaseModel):
    nombre: str
    nivel_falla_ka: Decimal
    interruptor_principal_id: uuid.UUID | None = None


class TableroResponse(BaseModel):
    id: str
    proyecto_id: str
    nombre: str
    nivel_falla_ka: Decimal
    interruptor_principal_id: str | None

    model_config = {"from_attributes": True}


def _tablero_response(tablero: Tablero) -> TableroResponse:
    return TableroResponse(
        id=str(tablero.id),
        proyecto_id=str(tablero.proyecto_id),
        nombre=tablero.nombre,
        nivel_falla_ka=tablero.nivel_falla_ka,
        interruptor_principal_id=str(tablero.interruptor_principal_id)
        if tablero.interruptor_principal_id
        else None,
    )


@router.post(
    "/proyectos/{proyecto_id}/tableros", response_model=TableroResponse, status_code=status.HTTP_201_CREATED
)
def crear_tablero(
    proyecto_id: uuid.UUID,
    payload: TableroCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    tablero = Tablero(
        proyecto_id=proyecto_id,
        nombre=payload.nombre,
        nivel_falla_ka=payload.nivel_falla_ka,
        interruptor_principal_id=payload.interruptor_principal_id,
    )
    db.add(tablero)
    db.commit()
    db.refresh(tablero)
    return _tablero_response(tablero)


@router.get("/tableros/{tablero_id}", response_model=TableroResponse)
def obtener_tablero(
    tablero_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")
    return _tablero_response(tablero)


class SeccionCreate(BaseModel):
    nombre: str
    orden: int = 0


class SeccionResponse(BaseModel):
    id: str
    tablero_id: str
    nombre: str
    orden: int

    model_config = {"from_attributes": True}


def _seccion_response(seccion: Seccion) -> SeccionResponse:
    return SeccionResponse(id=str(seccion.id), tablero_id=str(seccion.tablero_id), nombre=seccion.nombre, orden=seccion.orden)


@router.post("/tableros/{tablero_id}/secciones", response_model=SeccionResponse, status_code=status.HTTP_201_CREATED)
def crear_seccion(
    tablero_id: uuid.UUID,
    payload: SeccionCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")

    seccion = Seccion(tablero_id=tablero_id, nombre=payload.nombre, orden=payload.orden)
    db.add(seccion)
    db.commit()
    db.refresh(seccion)
    return _seccion_response(seccion)
```

Modify `backend/app/main.py` — agregar el import y el `include_router`:
```python
from app.routers import auth, catalogo, health, proyectos, tableros
...
app.include_router(tableros.router)
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_tableros_endpoint.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/tableros.py backend/app/main.py backend/tests/test_tableros_endpoint.py
git commit -m "feat: add tablero and seccion endpoints"
```

---

### Task 8: Router — `salidas` (motor + override manual)

**Files:**
- Create: `backend/app/routers/salidas.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_salidas_endpoint.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_salidas_endpoint.py`:
```python
from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _setup_tablero(client, db_session, email, interruptor_principal_id=None, nivel_falla_ka="10.00"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})
    proyecto_id = client.post("/proyectos", json={"cliente": "Cliente Salida", "nombre": "Proyecto Salida"}).json()["id"]
    tablero_payload = {"nombre": "TG1", "nivel_falla_ka": nivel_falla_ka}
    if interruptor_principal_id:
        tablero_payload["interruptor_principal_id"] = interruptor_principal_id
    tablero_id = client.post(f"/proyectos/{proyecto_id}/tableros", json=tablero_payload).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]
    return seccion_id


def _componente(db_session, codigo, tipo="seccional_termomagnetico", polos=1, corriente=20, ka=10, precio="50.00"):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=f"Interruptor {codigo}",
        unidad="Unidad",
        precio_neto=Decimal(precio),
        atributos={"tipo": tipo, "polos": polos, "corriente_nominal_a": corriente, "capacidad_corte_ka": ka},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_crear_salida_propone_componente_cuando_hay_match(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-1", tipo="interruptor_principal", corriente=100, ka=15)
    barato = _componente(db_session, "SAL-C1", corriente=20, ka=10, precio="50.00")
    seccion_id = _setup_tablero(
        client, db_session, "salidas1.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "16", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["componente_id"] == str(barato.id)
    assert body["origen"] == "manual"


def test_crear_salida_sin_match_deja_componente_id_null(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-2", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas2.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "16", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_diferencial"},
    )

    assert response.status_code == 201
    assert response.json()["componente_id"] is None


def test_crear_salida_sin_interruptor_principal_deja_componente_id_null(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas3.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "16", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
    )

    assert response.status_code == 201
    assert response.json()["componente_id"] is None


def test_crear_salida_con_unidad_invalida_devuelve_400(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas4.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "16", "carga_unidad": "V", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
    )

    assert response.status_code == 400


def test_patch_salida_permite_override_manual(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas5.test@pyre.com")
    manual = _componente(db_session, "SAL-C5", corriente=20, ka=10)
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "16", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"componente_id": str(manual.id)})

    assert response.status_code == 200
    assert response.json()["componente_id"] == str(manual.id)
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_salidas_endpoint.py -v`
Expected: FAIL — rutas inexistentes.

- [ ] **Step 3: Implementar el router**

`backend/app/routers/salidas.py`:
```python
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.database import get_db
from app.models import CatalogoComponente, FormatoPolos, OrigenSalida, RolUsuario, Salida, Seccion, Tablero, TipoProteccion, Usuario
from app.motor.calculo import calcular_corriente_nominal
from app.motor.parametros import obtener_parametros
from app.motor.propuesta import proponer_componente

router = APIRouter(tags=["salidas"])


class SalidaCreate(BaseModel):
    carga_valor: Decimal
    carga_unidad: str
    formato: FormatoPolos
    tipo_proteccion: TipoProteccion


class SalidaResponse(BaseModel):
    id: str
    seccion_id: str
    carga_valor: Decimal
    carga_unidad: str
    formato: str
    tipo_proteccion: str
    componente_id: str | None
    origen: str

    model_config = {"from_attributes": True}


def _salida_response(salida: Salida) -> SalidaResponse:
    return SalidaResponse(
        id=str(salida.id),
        seccion_id=str(salida.seccion_id),
        carga_valor=salida.carga_valor,
        carga_unidad=salida.carga_unidad,
        formato=salida.formato.value,
        tipo_proteccion=salida.tipo_proteccion.value,
        componente_id=str(salida.componente_id) if salida.componente_id else None,
        origen=salida.origen.value,
    )


@router.post("/secciones/{seccion_id}/salidas", response_model=SalidaResponse, status_code=status.HTTP_201_CREATED)
def crear_salida(
    seccion_id: uuid.UUID,
    payload: SalidaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    tablero = db.get(Tablero, seccion.tablero_id)

    parametros = obtener_parametros(db)
    try:
        corriente_nominal = calcular_corriente_nominal(payload.carga_valor, payload.carga_unidad, payload.formato, parametros)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    componente_id = None
    if tablero.interruptor_principal_id is not None:
        interruptor_principal = db.get(CatalogoComponente, tablero.interruptor_principal_id)
        atributos_principal = (interruptor_principal.atributos or {}) if interruptor_principal else {}
        nominal_aguas_arriba = atributos_principal.get("corriente_nominal_a")
        if nominal_aguas_arriba is not None:
            propuesto = proponer_componente(
                db,
                payload.tipo_proteccion,
                payload.formato,
                corriente_nominal,
                tablero.nivel_falla_ka,
                Decimal(str(nominal_aguas_arriba)),
                parametros,
            )
            componente_id = propuesto.id if propuesto else None

    salida = Salida(
        seccion_id=seccion_id,
        carga_valor=payload.carga_valor,
        carga_unidad=payload.carga_unidad,
        formato=payload.formato,
        tipo_proteccion=payload.tipo_proteccion,
        componente_id=componente_id,
        origen=OrigenSalida.MANUAL,
    )
    db.add(salida)
    db.commit()
    db.refresh(salida)
    return _salida_response(salida)


class SalidaUpdate(BaseModel):
    componente_id: uuid.UUID | None = None


@router.patch("/salidas/{salida_id}", response_model=SalidaResponse)
def actualizar_salida(
    salida_id: uuid.UUID,
    payload: SalidaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida = db.get(Salida, salida_id)
    if salida is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salida no encontrada")

    salida.componente_id = payload.componente_id
    db.commit()
    db.refresh(salida)
    return _salida_response(salida)
```

Modify `backend/app/main.py`:
```python
from app.routers import auth, catalogo, health, proyectos, salidas, tableros
...
app.include_router(salidas.router)
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_salidas_endpoint.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/salidas.py backend/app/main.py backend/tests/test_salidas_endpoint.py
git commit -m "feat: add salidas endpoint with automatic component proposal"
```

---

### Task 9: Router — `parametros-calculo` (GET/PUT + auditoría)

**Files:**
- Create: `backend/app/routers/parametros_calculo.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_parametros_calculo_endpoint.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_parametros_calculo_endpoint.py`:
```python
from app.models import AuditLog
from app.scripts.create_user import create_user


def _login(client, db_session, email="parametros.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def test_get_devuelve_los_valores_por_defecto(client, db_session):
    _login(client, db_session)

    response = client.get("/parametros-calculo")

    assert response.status_code == 200
    body = response.json()
    assert body["tension_mono_v"] == "220.00"
    assert body["ratio_selectividad"] == "1.60"


def test_put_actualiza_los_valores_y_registra_auditoria(client, db_session):
    _login(client, db_session, email="parametrosput.test@pyre.com")

    response = client.put(
        "/parametros-calculo",
        json={"tension_mono_v": "230", "tension_tri_v": "400", "cos_phi": "0.95", "ratio_selectividad": "1.5"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tension_mono_v"] == "230.00"
    assert body["ratio_selectividad"] == "1.50"

    auditoria = db_session.query(AuditLog).filter_by(accion="actualizar_parametros_calculo").all()
    assert len(auditoria) == 1
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_parametros_calculo_endpoint.py -v`
Expected: FAIL — ruta inexistente.

- [ ] **Step 3: Implementar el router**

`backend/app/routers/parametros_calculo.py`:
```python
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.database import get_db
from app.models import AuditLog, RolUsuario, Usuario
from app.motor.parametros import obtener_parametros

router = APIRouter(prefix="/parametros-calculo", tags=["parametros-calculo"])


class ParametroCalculoResponse(BaseModel):
    tension_mono_v: Decimal
    tension_tri_v: Decimal
    cos_phi: Decimal
    ratio_selectividad: Decimal

    model_config = {"from_attributes": True}


class ParametroCalculoUpdate(BaseModel):
    tension_mono_v: Decimal
    tension_tri_v: Decimal
    cos_phi: Decimal
    ratio_selectividad: Decimal


@router.get("", response_model=ParametroCalculoResponse)
def obtener(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    return obtener_parametros(db)


@router.put("", response_model=ParametroCalculoResponse)
def actualizar(
    payload: ParametroCalculoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    parametros = obtener_parametros(db)
    parametros.tension_mono_v = payload.tension_mono_v
    parametros.tension_tri_v = payload.tension_tri_v
    parametros.cos_phi = payload.cos_phi
    parametros.ratio_selectividad = payload.ratio_selectividad
    parametros.actualizado_por = usuario.id

    db.add(
        AuditLog(
            usuario_id=usuario.id,
            accion="actualizar_parametros_calculo",
            entidad="parametro_calculo",
            entidad_id=str(parametros.id),
            detalle={
                "tension_mono_v": str(payload.tension_mono_v),
                "tension_tri_v": str(payload.tension_tri_v),
                "cos_phi": str(payload.cos_phi),
                "ratio_selectividad": str(payload.ratio_selectividad),
            },
        )
    )
    db.commit()
    db.refresh(parametros)
    return parametros
```

Modify `backend/app/main.py`:
```python
from app.routers import auth, catalogo, health, parametros_calculo, proyectos, salidas, tableros
...
app.include_router(parametros_calculo.router)
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_parametros_calculo_endpoint.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/parametros_calculo.py backend/app/main.py backend/tests/test_parametros_calculo_endpoint.py
git commit -m "feat: add parametros-calculo endpoint with audit logging"
```

---

### Task 10: Test de integración end-to-end + suite completa

**Files:**
- Create: `backend/tests/test_motor_configuracion_integracion.py`

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_motor_configuracion_integracion.py`:
```python
from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def test_flujo_completo_proyecto_a_salida_con_propuesta(client, db_session):
    create_user("integracion.test@pyre.com", "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": "integracion.test@pyre.com", "password": "clave-segura-123"})

    principal = CatalogoComponente(
        proveedor="ABB",
        codigo="INTEG-PRINC-1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Interruptor principal de prueba",
        unidad="Unidad",
        precio_neto=Decimal("500.00"),
        atributos={"tipo": "interruptor_principal", "polos": 4, "corriente_nominal_a": 100, "capacidad_corte_ka": 15},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    seccional = CatalogoComponente(
        proveedor="ABB",
        codigo="INTEG-SEC-1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Interruptor seccional de prueba",
        unidad="Unidad",
        precio_neto=Decimal("50.00"),
        atributos={"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 20, "capacidad_corte_ka": 10},
        archivo_origen="test.xlsx",
        fila_origen=2,
    )
    db_session.add_all([principal, seccional])
    db_session.commit()

    proyecto_id = client.post("/proyectos", json={"cliente": "Cliente Integración", "nombre": "Proyecto Integración"}).json()["id"]
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros",
        json={"nombre": "TG1", "nivel_falla_ka": "10.00", "interruptor_principal_id": str(principal.id)},
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]

    salida = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={"carga_valor": "16", "carga_unidad": "A", "formato": "unipolar", "tipo_proteccion": "seccional_termomagnetico"},
    ).json()

    assert salida["componente_id"] == str(seccional.id)
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_motor_configuracion_integracion.py -v`
Expected: en este punto del plan debería FALLAR solo si algún task anterior quedó incompleto — sirve como chequeo cruzado. Si todos los tasks 1-9 están commiteados, este test ya debería pasar en el primer intento.

- [ ] **Step 3: Correr toda la suite del backend**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS — todos los tests, incluidos los preexistentes de Fase A/B.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_motor_configuracion_integracion.py
git commit -m "test: add end-to-end integration test for motor de configuracion"
```

---

### Task 11: Documentación

**Files:**
- Modify: `docs/diccionario_datos.md`
- Modify: `docs/reglas_negocio.md`

- [ ] **Step 1: Actualizar `docs/diccionario_datos.md`**

Agregar, después de la línea de `salida` existente:
```markdown
- **parametro_calculo** — fila única con los parámetros configurables del motor de configuración: `tension_mono_v`/`tension_tri_v` (V, para convertir kW→A), `cos_phi` (factor de potencia asumido), `ratio_selectividad` (mínimo múltiplo entre el nominal del interruptor aguas arriba y el propuesto). Se crea con valores por defecto la primera vez que se consulta (`obtener_parametros`); cada actualización queda en `audit_log`.
```

Reemplazar la frase sobre `atributos` en la línea de `catalogo_componente` (la que dice "todavía no se completa en esta fase") por:
```markdown
`atributos` es un campo JSON con specs eléctricas para interruptores. El motor de configuración (Fase C) espera las claves `tipo` (`interruptor_principal`/`seccional_termomagnetico`/`seccional_diferencial`), `polos` (1/2/4), `corriente_nominal_a` y `capacidad_corte_ka` — un componente sin esas claves simplemente no es candidato de ninguna propuesta automática. El importador de Fase B todavía no puebla estas claves desde el Excel real de ABB; hasta que eso se implemente, se cargan a mano (o quedan ausentes y el analista completa manualmente).
```

- [ ] **Step 2: Actualizar `docs/reglas_negocio.md`**

Reemplazar la sección `## Motor de configuración (a implementar en el plan de Fase C)` completa por:
```markdown
## Motor de configuración

1. El analista carga carga (kW o A) + formato (uni/bi/tetrapolar) + tipo de protección (termomagnético/diferencial) por salida.
2. Corriente nominal: si la carga está en A, se usa tal cual. Si está en kW: `kW*1000 / (tension_mono_v * cos_phi)` para uni/bipolar, `kW*1000 / (tension_tri_v * √3 * cos_phi)` para tetrapolar. `tension_mono_v` (220V), `tension_tri_v` (380V) y `cos_phi` (0.9) son configurables en `parametro_calculo`.
3. Selectividad: el nominal del interruptor aguas arriba (hoy siempre `tablero.interruptor_principal`, no hay sub-interruptores por sección) debe ser `>= nominal_propuesto * ratio_selectividad` (default 1.6, configurable). Es una regla simplificada por ratio, no una tabla de curvas de fabricante — pendiente para un ciclo posterior si se necesita mayor precisión.
4. Capacidad de corte: el componente propuesto debe tener `capacidad_corte_ka >= tablero.nivel_falla_ka`.
5. De los componentes de catálogo que cumplen tipo de protección + polos (según formato) + corriente + capacidad de corte + selectividad, se propone el de menor `precio_neto` (desempate por `codigo`). Si ninguno cumple, la salida queda sin componente propuesto y el analista lo completa manualmente (`PATCH /salidas/{id}`).

El motor asume que `catalogo_componente.atributos` tiene las claves `tipo`/`polos`/`corriente_nominal_a`/`capacidad_corte_ka` pobladas — ver nota en `diccionario_datos.md` sobre el estado del importador de ABB.
```

- [ ] **Step 3: Commit**

```bash
git add docs/diccionario_datos.md docs/reglas_negocio.md
git commit -m "docs: document motor de configuracion rules and parametro_calculo"
```

---

## Self-review notes

- **Cobertura de la spec:** Task 1 cubre el modelo de datos (§Modelo de datos); Tasks 2-5 cubren el servicio del motor (§Servicio); Tasks 6-9 cubren la API (§API); Task 10 el flujo end-to-end; Task 11 la documentación (§Documentación a actualizar). La UI mínima de la spec queda fuera de este plan — es una unidad de trabajo separada (ver nota de alcance arriba).
- **Determinismo:** `proponer_componente` ordena por `precio_neto, codigo` antes de filtrar, así el desempate es siempre el mismo componente sin importar el orden de inserción.
- **Consistencia de tipos:** `TipoProteccion`, `FormatoPolos`, `ParametroCalculo` se importan desde `app.models` en todos los tasks (nunca desde el submódulo directamente fuera de `app/models/`), siguiendo el patrón ya usado en los routers existentes.
