# Fase B (Catálogo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Fase A's rigid breaker-only `catalogo_componente` schema with a flexible one, build parsers for the two real supplier file formats (ABB's font-hierarchy price list, and the non-ABB materials file's per-section column layout), and expose a synchronous upload endpoint + minimal frontend page that upserts into the catalog with price-change history and audit logging.

**Architecture:** Two pure-function parsers (`parse_abb_workbook`, `parse_otros_workbook`) turn an uploaded `.xlsx` into a list of `ComponenteImportado` records. A separate upsert service writes those records to Postgres (insert new codes, update changed prices with a `catalogo_precio_historial` row, log to `audit_log`). A single FastAPI endpoint wires upload → parse → upsert together; parsing the full ~12,000-row ABB file takes ~1.3s, so no background job queue is needed yet.

**Tech Stack:** Same as Fase A (FastAPI, SQLAlchemy 2.0, Alembic, Postgres, React/TypeScript/Vite), plus `openpyxl` for reading `.xlsx` files.

---

## Relationship to other plans

This is the second plan implementing `docs/superpowers/specs/2026-07-16-configurador-tableros-design.md`, scoped to `docs/superpowers/specs/2026-07-16-fase-b-catalogo-design.md` (Fase B only). It builds on the merged Fase A foundation (`docs/superpowers/plans/2026-07-16-fundaciones-implementation-plan.md`) — auth, roles, and the base Docker Compose stack already exist and are not touched here except where noted. Fase C (motor de configuración + BOM + esquema visual) is a separate future plan that will read from the `catalogo_componente` table this plan builds, including populating and querying the `atributos` JSONB column — this plan only reserves that column, it does not populate it.

## Before you start

- Fase A must already be merged to `master` (it is, as of commit `cbb3832`).
- `docker compose up -d db` must be running so tests can connect to `tablero_test`.
- The real sample files (`R-IN-003 ABB 2026 06 - 26-XXX-XXX V1.xlsx`, `1-Lista de Precios 2025.xlsx`) live in `samples/catalogo/` (gitignored — confidential supplier pricing). Task 7 in this plan uses them for manual verification; if they're not present on the machine executing this plan, skip Task 7's real-file steps and note it, but do not skip the automated tests in Tasks 1–6, which use small synthetic workbooks built in-test and don't depend on the real files.

---

### Task 1: Flexible `catalogo_componente` schema

**Files:**
- Modify: `backend/app/models/catalogo.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/test_catalogo_schema.py`
- Create: `backend/alembic/versions/<new>_catalogo_flexible.py` (via autogenerate)

- [ ] **Step 1: Write the failing test**

`backend/tests/test_catalogo_schema.py`:

```python
from sqlalchemy import inspect

from app.database import engine

EXPECTED_COLUMNS = {
    "id",
    "proveedor",
    "codigo",
    "codigo_comercial",
    "categoria_path",
    "categoria_raiz",
    "descripcion",
    "unidad",
    "precio_lista",
    "precio_neto",
    "atributos",
    "archivo_origen",
    "fila_origen",
    "vigente_desde",
}


def test_catalogo_componente_has_flexible_columns():
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("catalogo_componente")}

    assert EXPECTED_COLUMNS.issubset(columns)


def test_catalogo_componente_has_unique_proveedor_codigo_constraint():
    inspector = inspect(engine)
    unique_constraints = inspector.get_unique_constraints("catalogo_componente")

    matching = [uc for uc in unique_constraints if set(uc["column_names"]) == {"proveedor", "codigo"}]
    assert len(matching) == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
source venv/Scripts/activate
pytest tests/test_catalogo_schema.py -v
```

Expected: FAIL — the old rigid columns (`tipo`, `polos`, `corriente_nominal_a`, `capacidad_corte_ka`, `ancho_mm`, `alto_mm`, `precio_vigente`) are there instead, and no unique constraint on `(proveedor, codigo)` exists yet.

- [ ] **Step 3: Rewrite the model**

`backend/app/models/catalogo.py` (replace entirely — this removes the `TipoComponente` and `Proveedor` enums from Fase A; `proveedor` is now free text so new suppliers don't require a migration):

```python
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CatalogoComponente(Base):
    __tablename__ = "catalogo_componente"
    __table_args__ = (UniqueConstraint("proveedor", "codigo", name="uq_catalogo_componente_proveedor_codigo"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proveedor: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo_comercial: Mapped[str | None] = mapped_column(String(100), nullable=True)
    categoria_path: Mapped[list] = mapped_column(JSON, nullable=False)
    categoria_raiz: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    descripcion: Mapped[str] = mapped_column(String(1000), nullable=False)
    unidad: Mapped[str] = mapped_column(String(20), nullable=False)
    precio_lista: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    precio_neto: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    atributos: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    archivo_origen: Mapped[str] = mapped_column(String(500), nullable=False)
    fila_origen: Mapped[int] = mapped_column(Integer, nullable=False)
    vigente_desde: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class CatalogoPrecioHistorial(Base):
    __tablename__ = "catalogo_precio_historial"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    componente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=False
    )
    precio_anterior: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    precio_nuevo: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

`backend/app/models/__init__.py` (modify — remove `Proveedor`/`TipoComponente` from imports and `__all__`, everything else unchanged):

```python
from app.models.audit import AuditLog
from app.models.catalogo import CatalogoComponente, CatalogoPrecioHistorial
from app.models.extraccion import EstadoExtraccion, ExtraccionCad
from app.models.proyecto import EstadoProyecto, Proyecto
from app.models.tablero import BomLinea, FormatoPolos, OrigenSalida, Salida, Seccion, Tablero
from app.models.usuario import RolUsuario, Usuario

__all__ = [
    "AuditLog",
    "CatalogoComponente",
    "CatalogoPrecioHistorial",
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

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_catalogo_schema.py -v
```

Expected: PASS (2 tests) — the test suite's `_fresh_schema` fixture rebuilds the test DB from the current models on every run, so this works before touching Alembic.

- [ ] **Step 5: Generate and apply the migration against the dev database**

```bash
docker compose up -d db
alembic revision --autogenerate -m "catalogo componente flexible"
```

Open the generated file in `backend/alembic/versions/` and confirm it drops the old columns (`tipo`, `polos`, `corriente_nominal_a`, `capacidad_corte_ka`, `ancho_mm`, `alto_mm`, `precio_vigente`), adds the new ones, changes `proveedor` from `Enum` to `String`, and drops the now-unused `tipo_componente` and `proveedor` Postgres enum types in the `upgrade()` function. Alembic's autogenerate usually handles enum drops automatically when a column's type changes away from `Enum`, but **verify it explicitly** — a stray enum type left behind won't break anything today but will collide if a future migration tries to reuse the name `proveedor`.

```bash
alembic upgrade head
docker compose exec db psql -U tablero -d tablero -c "\d catalogo_componente"
```

Expected: the described columns, and no `tipo_componente`/`proveedor` types left in `\dT`.

- [ ] **Step 6: Run the full backend suite to confirm no regressions**

```bash
pytest -v
```

Expected: all tests PASS (Fase A's 18 plus this task's 2 = 20).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/catalogo.py backend/app/models/__init__.py backend/tests/test_catalogo_schema.py backend/alembic/versions
git commit -m "feat: replace rigid catalogo_componente schema with flexible one"
```

---

### Task 2: `ComponenteImportado` type + ABB hierarchy parser

**Files:**
- Create: `backend/app/catalogo/__init__.py`
- Create: `backend/app/catalogo/types.py`
- Create: `backend/app/catalogo/parser_abb.py`
- Test: `backend/tests/test_parser_abb.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_parser_abb.py`:

```python
import io
from decimal import Decimal

import openpyxl
import pytest
from openpyxl.styles import Font

from app.catalogo.parser_abb import parse_abb_workbook


def _build_sample_workbook() -> io.BytesIO:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lista de Precios 202607"

    headers = [
        "Codigo SAP", "Codigo Comercial", None, None, None, None, None, None,
        "Precio de Lista USD", "Precio NETO USD", None, None, None, None, None, "Descripcion",
    ]
    for col, value in enumerate(headers, start=1):
        ws.cell(row=1, column=col, value=value)

    def header_row(row, text, size, bold):
        cell = ws.cell(row=row, column=2, value=text)
        cell.font = Font(size=size, bold=bold)

    def data_row(row, codigo, comercial, precio_lista, precio_neto, descripcion):
        ws.cell(row=row, column=1, value=codigo)
        ws.cell(row=row, column=2, value=comercial)
        ws.cell(row=row, column=9, value=precio_lista)
        ws.cell(row=row, column=10, value=precio_neto)
        ws.cell(row=row, column=16, value=descripcion)

    header_row(3, "Interruptores Termomagneticos", 14, False)
    header_row(4, "SH200 L", 14, True)
    header_row(6, "Curva C - Icn: 4,5kA (IEC 60898)", 10, True)
    header_row(7, "Unipolares", 12, False)
    data_row(8, "COD-U2", "SH201-C2", 15.4, 7.8, "Interruptor unipolar In 2A")
    data_row(9, "COD-U4", "SH201-C4", 15.4, 7.8, "Interruptor unipolar In 4A")
    header_row(10, "Bipolares", 12, False)
    data_row(11, "COD-B2", "SH202-C2", 20.1, 10.2, "Interruptor bipolar In 2A")
    header_row(12, "Interruptores Diferenciales", 14, False)
    header_row(13, "F200", 14, True)
    header_row(14, "30mA", 10, True)
    header_row(15, "Bipolares", 12, False)
    data_row(16, "COD-DIF-B", "F202-30", 50.0, 25.0, "Diferencial bipolar 30mA")

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def test_parses_sections_with_correct_breadcrumbs_and_prices():
    resultados = parse_abb_workbook(_build_sample_workbook(), archivo_origen="test.xlsx")

    assert len(resultados) == 4

    unipolar_2a = next(r for r in resultados if r.codigo == "COD-U2")
    assert unipolar_2a.categoria_path == [
        "Interruptores Termomagneticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Unipolares",
    ]
    assert unipolar_2a.precio_lista == Decimal("15.4")
    assert unipolar_2a.precio_neto == Decimal("7.8")
    assert unipolar_2a.proveedor == "ABB"
    assert unipolar_2a.codigo_comercial == "SH201-C2"
    assert unipolar_2a.descripcion == "Interruptor unipolar In 2A"
    assert unipolar_2a.fila_origen == 8

    bipolar_2a = next(r for r in resultados if r.codigo == "COD-B2")
    # same family/curve breadcrumb, "Bipolares" replaces "Unipolares" at that level
    assert bipolar_2a.categoria_path == [
        "Interruptores Termomagneticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Bipolares",
    ]

    diferencial = next(r for r in resultados if r.codigo == "COD-DIF-B")
    # a brand new top-level category resets the whole breadcrumb
    assert diferencial.categoria_path == ["Interruptores Diferenciales", "F200", "30mA", "Bipolares"]


def test_raises_when_no_lista_de_precios_sheet_found():
    wb = openpyxl.Workbook()
    wb.active.title = "Otra Hoja"
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    with pytest.raises(ValueError):
        parse_abb_workbook(buffer, archivo_origen="test.xlsx")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_parser_abb.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.catalogo'`.

- [ ] **Step 3: Write the minimal implementation**

`backend/app/catalogo/__init__.py`: empty file.

`backend/app/catalogo/types.py`:

```python
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class ComponenteImportado:
    proveedor: str
    codigo: str
    codigo_comercial: str | None
    categoria_path: list[str]
    descripcion: str
    unidad: str
    precio_lista: Decimal | None
    precio_neto: Decimal | None
    archivo_origen: str
    fila_origen: int
```

`backend/app/catalogo/parser_abb.py`:

```python
from decimal import Decimal

import openpyxl

from app.catalogo.types import ComponenteImportado


def parse_abb_workbook(file_obj, archivo_origen: str) -> list[ComponenteImportado]:
    wb = openpyxl.load_workbook(file_obj, data_only=True)
    ws = wb[_find_lista_de_precios_sheet(wb)]
    header_map = _read_header_map(ws, header_row=1)

    resultados: list[ComponenteImportado] = []
    path: list[tuple[tuple[float, bool], str]] = []

    codigo_col = header_map["Codigo SAP"]
    comercial_col = header_map["Codigo Comercial"]

    for row_idx in range(3, ws.max_row + 1):
        codigo_cell = ws.cell(row=row_idx, column=codigo_col)
        comercial_cell = ws.cell(row=row_idx, column=comercial_col)

        if codigo_cell.value is None and comercial_cell.value is not None:
            texto = str(comercial_cell.value).strip()
            if texto:
                firma = (comercial_cell.font.sz, bool(comercial_cell.font.bold))
                _update_path(path, firma, texto)
        elif codigo_cell.value is not None:
            resultados.append(_build_componente(ws, row_idx, header_map, path, archivo_origen))

    return resultados


def _find_lista_de_precios_sheet(wb) -> str:
    candidatos = [s for s in wb.sheetnames if s.strip().lower().startswith("lista de precios")]
    if len(candidatos) != 1:
        raise ValueError(f"Se esperaba exactamente una pestaña 'Lista de Precios...', se encontraron: {candidatos}")
    return candidatos[0]


def _read_header_map(ws, header_row: int) -> dict[str, int]:
    header_map = {}
    for col in range(1, ws.max_column + 1):
        value = ws.cell(row=header_row, column=col).value
        if value:
            header_map[str(value).strip()] = col
    return header_map


def _update_path(path: list[tuple[tuple, str]], firma: tuple, texto: str) -> None:
    for i, (existing_firma, _) in enumerate(path):
        if existing_firma == firma:
            del path[i:]
            break
    path.append((firma, texto))


def _decimal_or_none(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _build_componente(ws, row_idx, header_map, path, archivo_origen) -> ComponenteImportado:
    def cell(label):
        col = header_map.get(label)
        return ws.cell(row=row_idx, column=col).value if col else None

    comercial = cell("Codigo Comercial")
    return ComponenteImportado(
        proveedor="ABB",
        codigo=str(cell("Codigo SAP")).strip(),
        codigo_comercial=str(comercial).strip() if comercial else None,
        categoria_path=[texto for _, texto in path],
        descripcion=str(cell("Descripcion") or "").strip(),
        unidad="Unidad",
        precio_lista=_decimal_or_none(cell("Precio de Lista USD")),
        precio_neto=_decimal_or_none(cell("Precio NETO USD")),
        archivo_origen=archivo_origen,
        fila_origen=row_idx,
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_parser_abb.py -v
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/catalogo/__init__.py backend/app/catalogo/types.py backend/app/catalogo/parser_abb.py backend/tests/test_parser_abb.py
git commit -m "feat: add ABB catalog parser with font-signature hierarchy tracking"
```

---

### Task 3: Otros materiales parser

**Files:**
- Create: `backend/app/catalogo/parser_otros.py`
- Test: `backend/tests/test_parser_otros.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_parser_otros.py`:

```python
import io
from decimal import Decimal

import openpyxl

from app.catalogo.parser_otros import parse_otros_workbook


def _build_sample_workbook() -> io.BytesIO:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lista de Precios"

    ws.cell(row=4, column=1, value="Accesorios Tableros")
    ws.cell(row=6, column=2, value="Cable Canal Ranurado")
    header_cols = {2: "Cod", 3: "Unidad", 4: "Descripcion", 7: "Precio Lista ((U$S)", 10: "Total U$S)"}
    for col, label in header_cols.items():
        ws.cell(row=8, column=col, value=label)
    ws.cell(row=9, column=2, value="A00000")
    ws.cell(row=9, column=3, value="Un.")
    ws.cell(row=9, column=4, value="Cable Canal Ranurado 15x15")
    ws.cell(row=9, column=10, value=4.78)

    ws.cell(row=12, column=1, value="Gabinetes")
    ws.cell(row=13, column=2, value="SELECCION DE GABINETES A MEDIDA")
    ws.cell(row=14, column=4, value="NOLLMED")

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def test_parses_data_rows_with_local_header_and_breadcrumb():
    resultados = parse_otros_workbook(_build_sample_workbook(), archivo_origen="test.xlsx")

    assert len(resultados) == 1
    item = resultados[0]
    assert item.codigo == "A00000"
    assert item.categoria_path == ["Accesorios Tableros", "Cable Canal Ranurado"]
    assert item.precio_neto == Decimal("4.78")
    assert item.precio_lista is None
    assert item.proveedor == "OTROS"
    assert item.unidad == "Un."
    assert item.fila_origen == 9


def test_section_without_cod_header_yields_no_rows():
    resultados = parse_otros_workbook(_build_sample_workbook(), archivo_origen="test.xlsx")

    gabinetes = [r for r in resultados if r.categoria_path[0] == "Gabinetes"]
    assert gabinetes == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_parser_otros.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.catalogo.parser_otros'`.

- [ ] **Step 3: Write the minimal implementation**

`backend/app/catalogo/parser_otros.py`:

```python
from decimal import Decimal

import openpyxl

from app.catalogo.types import ComponenteImportado


def parse_otros_workbook(
    file_obj, archivo_origen: str, sheet_name: str = "Lista de Precios"
) -> list[ComponenteImportado]:
    wb = openpyxl.load_workbook(file_obj, data_only=True)
    ws = wb[sheet_name]

    resultados: list[ComponenteImportado] = []
    categoria_raiz: str | None = None
    subfamilia: str | None = None
    columna_map: dict[str, int] | None = None

    for row_idx in range(1, ws.max_row + 1):
        col_a = ws.cell(row=row_idx, column=1).value
        col_b = ws.cell(row=row_idx, column=2).value

        if col_a is not None:
            categoria_raiz = str(col_a).strip()
            subfamilia = None
            columna_map = None
            continue

        if col_b is None:
            continue

        texto_b = str(col_b).strip()

        if texto_b == "Cod":
            columna_map = _read_row_labels(ws, row_idx)
            continue

        if columna_map is None:
            subfamilia = texto_b
            continue

        resultados.append(_build_componente(ws, row_idx, columna_map, categoria_raiz, subfamilia, archivo_origen))

    return resultados


def _read_row_labels(ws, row_idx: int) -> dict[str, int]:
    labels = {}
    for col in range(2, ws.max_column + 1):
        value = ws.cell(row=row_idx, column=col).value
        if value:
            labels[str(value).strip()] = col
    return labels


def _decimal_or_none(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _build_componente(
    ws, row_idx, columna_map: dict[str, int], categoria_raiz: str | None, subfamilia: str | None, archivo_origen: str
) -> ComponenteImportado:
    def cell(label):
        col = columna_map.get(label)
        return ws.cell(row=row_idx, column=col).value if col else None

    categoria_path = ([categoria_raiz] if categoria_raiz else []) + ([subfamilia] if subfamilia else [])
    precio_lista = _decimal_or_none(cell("Precio Lista ((U$S)"))
    precio_neto = _decimal_or_none(cell("Total U$S)") if cell("Total U$S)") is not None else cell("Total"))

    return ComponenteImportado(
        proveedor="OTROS",
        codigo=str(cell("Cod") or "").strip(),
        codigo_comercial=None,
        categoria_path=categoria_path,
        descripcion=str(cell("Descripcion") or "").strip(),
        unidad=str(cell("Unidad") or "Unidad").strip(),
        precio_lista=precio_lista,
        precio_neto=precio_neto,
        archivo_origen=archivo_origen,
        fila_origen=row_idx,
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_parser_otros.py -v
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/catalogo/parser_otros.py backend/tests/test_parser_otros.py
git commit -m "feat: add non-ABB materials catalog parser"
```

---

### Task 4: Upsert service (insert/update, price history, audit log)

**Files:**
- Create: `backend/app/catalogo/upsert.py`
- Test: `backend/tests/test_upsert_catalogo.py`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_upsert_catalogo.py`:

```python
from decimal import Decimal

from app.catalogo.types import ComponenteImportado
from app.catalogo.upsert import upsert_componentes
from app.models import AuditLog, CatalogoComponente, CatalogoPrecioHistorial
from app.scripts.create_user import create_user


def _item(codigo="C1", precio_neto=Decimal("10.00")):
    return ComponenteImportado(
        proveedor="ABB",
        codigo=codigo,
        codigo_comercial="COM1",
        categoria_path=["Interruptores Termomagneticos", "SH200 L"],
        descripcion="Interruptor de prueba",
        unidad="Unidad",
        precio_lista=Decimal("20.00"),
        precio_neto=precio_neto,
        archivo_origen="abb.xlsx",
        fila_origen=8,
    )


def test_first_import_inserts_new_component(db_session):
    usuario = create_user("import1.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)

    resumen = upsert_componentes(db_session, [_item()], usuario_id=usuario.id)

    assert resumen == {"total_filas": 1, "nuevos": 1, "actualizados": 0, "sin_cambios": 0}
    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C1").one()
    assert componente.precio_neto == Decimal("10.00")
    assert componente.categoria_raiz == "Interruptores Termomagneticos"


def test_reimport_with_same_price_counts_as_sin_cambios(db_session):
    usuario = create_user("import2.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    upsert_componentes(db_session, [_item()], usuario_id=usuario.id)

    resumen = upsert_componentes(db_session, [_item()], usuario_id=usuario.id)

    assert resumen["nuevos"] == 0
    assert resumen["sin_cambios"] == 1
    assert resumen["actualizados"] == 0


def test_reimport_with_changed_price_writes_history_and_updates(db_session):
    usuario = create_user("import3.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    upsert_componentes(db_session, [_item(precio_neto=Decimal("10.00"))], usuario_id=usuario.id)

    resumen = upsert_componentes(db_session, [_item(precio_neto=Decimal("12.50"))], usuario_id=usuario.id)

    assert resumen["actualizados"] == 1
    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C1").one()
    assert componente.precio_neto == Decimal("12.50")
    historial = db_session.query(CatalogoPrecioHistorial).filter_by(componente_id=componente.id).one()
    assert historial.precio_anterior == Decimal("10.00")
    assert historial.precio_nuevo == Decimal("12.50")
    assert historial.usuario_id == usuario.id


def test_import_writes_audit_log_entry(db_session):
    usuario = create_user("import4.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)

    upsert_componentes(db_session, [_item()], usuario_id=usuario.id)

    entrada = db_session.query(AuditLog).filter_by(usuario_id=usuario.id, accion="importar_catalogo").one()
    assert entrada.detalle["nuevos"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_upsert_catalogo.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.catalogo.upsert'`.

- [ ] **Step 3: Write the minimal implementation**

`backend/app/catalogo/upsert.py`:

```python
import uuid

from sqlalchemy.orm import Session

from app.catalogo.types import ComponenteImportado
from app.models import AuditLog, CatalogoComponente, CatalogoPrecioHistorial


def upsert_componentes(db: Session, items: list[ComponenteImportado], usuario_id: uuid.UUID) -> dict:
    nuevos = 0
    actualizados = 0
    sin_cambios = 0

    for item in items:
        existente = (
            db.query(CatalogoComponente)
            .filter(CatalogoComponente.proveedor == item.proveedor, CatalogoComponente.codigo == item.codigo)
            .first()
        )

        if existente is None:
            db.add(
                CatalogoComponente(
                    proveedor=item.proveedor,
                    codigo=item.codigo,
                    codigo_comercial=item.codigo_comercial,
                    categoria_path=item.categoria_path,
                    categoria_raiz=item.categoria_path[0] if item.categoria_path else "",
                    descripcion=item.descripcion,
                    unidad=item.unidad,
                    precio_lista=item.precio_lista,
                    precio_neto=item.precio_neto,
                    archivo_origen=item.archivo_origen,
                    fila_origen=item.fila_origen,
                )
            )
            nuevos += 1
            continue

        precio_cambio = existente.precio_neto != item.precio_neto or existente.precio_lista != item.precio_lista
        if precio_cambio:
            db.add(
                CatalogoPrecioHistorial(
                    componente_id=existente.id,
                    precio_anterior=existente.precio_neto or existente.precio_lista or 0,
                    precio_nuevo=item.precio_neto or item.precio_lista or 0,
                    usuario_id=usuario_id,
                )
            )
            existente.precio_lista = item.precio_lista
            existente.precio_neto = item.precio_neto
            actualizados += 1
        else:
            sin_cambios += 1

        existente.descripcion = item.descripcion
        existente.categoria_path = item.categoria_path
        existente.categoria_raiz = item.categoria_path[0] if item.categoria_path else existente.categoria_raiz
        existente.codigo_comercial = item.codigo_comercial
        existente.unidad = item.unidad
        existente.archivo_origen = item.archivo_origen
        existente.fila_origen = item.fila_origen

    resumen = {"total_filas": len(items), "nuevos": nuevos, "actualizados": actualizados, "sin_cambios": sin_cambios}

    db.add(
        AuditLog(
            usuario_id=usuario_id,
            accion="importar_catalogo",
            entidad="catalogo_componente",
            entidad_id=items[0].archivo_origen if items else "",
            detalle=resumen,
        )
    )
    db.commit()

    return resumen
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_upsert_catalogo.py -v
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/catalogo/upsert.py backend/tests/test_upsert_catalogo.py
git commit -m "feat: add catalog upsert service with price history and audit logging"
```

---

### Task 5: Import endpoint

**Files:**
- Create: `backend/app/routers/catalogo.py`
- Modify: `backend/app/main.py`
- Modify: `backend/requirements.txt`
- Test: `backend/tests/test_catalogo_import_endpoint.py`

- [ ] **Step 1: Add `openpyxl` to `requirements.txt`**

`backend/requirements.txt` — add this line (matches the version verified against the real files during design):

```
openpyxl==3.1.5
```

```bash
pip install openpyxl==3.1.5
```

- [ ] **Step 2: Write the failing test**

`backend/tests/test_catalogo_import_endpoint.py`:

```python
import io

from openpyxl import Workbook
from openpyxl.styles import Font

from app.scripts.create_user import create_user


def _sample_abb_bytes() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Lista de Precios 202607"
    headers = [
        "Codigo SAP", "Codigo Comercial", None, None, None, None, None, None,
        "Precio de Lista USD", "Precio NETO USD", None, None, None, None, None, "Descripcion",
    ]
    for col, value in enumerate(headers, start=1):
        ws.cell(row=1, column=col, value=value)

    cat = ws.cell(row=3, column=2, value="Interruptores Termomagneticos")
    cat.font = Font(size=14, bold=False)
    fam = ws.cell(row=4, column=2, value="SH200 L")
    fam.font = Font(size=14, bold=True)
    curva = ws.cell(row=6, column=2, value="Curva C - Icn: 4,5kA")
    curva.font = Font(size=10, bold=True)
    polos = ws.cell(row=7, column=2, value="Unipolares")
    polos.font = Font(size=12, bold=False)

    ws.cell(row=8, column=1, value="COD-U2")
    ws.cell(row=8, column=2, value="SH201-C2")
    ws.cell(row=8, column=9, value=15.4)
    ws.cell(row=8, column=10, value=7.8)
    ws.cell(row=8, column=16, value="Interruptor unipolar In 2A")

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _xlsx_file_tuple(filename: str = "abb.xlsx"):
    return (
        filename,
        _sample_abb_bytes(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def test_import_requires_authentication(client):
    response = client.post(
        "/catalogo/importar",
        data={"proveedor": "abb"},
        files={"archivo": _xlsx_file_tuple()},
    )

    assert response.status_code == 401


def test_import_abb_catalog_end_to_end(client, db_session):
    create_user("import.endpoint.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": "import.endpoint.test@pyre.com", "password": "clave-segura-123"})

    response = client.post(
        "/catalogo/importar",
        data={"proveedor": "abb"},
        files={"archivo": _xlsx_file_tuple()},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nuevos"] == 1
    assert body["total_filas"] == 1


def test_import_rejects_unknown_proveedor(client, db_session):
    create_user("import.unknown.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": "import.unknown.test@pyre.com", "password": "clave-segura-123"})

    response = client.post(
        "/catalogo/importar",
        data={"proveedor": "no-existe"},
        files={"archivo": _xlsx_file_tuple()},
    )

    assert response.status_code == 400
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pytest tests/test_catalogo_import_endpoint.py -v
```

Expected: FAIL — `/catalogo/importar` doesn't exist yet (404s).

- [ ] **Step 4: Write the minimal implementation**

`backend/app/routers/catalogo.py`:

```python
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.catalogo.parser_abb import parse_abb_workbook
from app.catalogo.parser_otros import parse_otros_workbook
from app.catalogo.upsert import upsert_componentes
from app.database import get_db
from app.models import RolUsuario, Usuario

router = APIRouter(prefix="/catalogo", tags=["catalogo"])

PARSERS = {
    "abb": parse_abb_workbook,
    "otros": parse_otros_workbook,
}


@router.post("/importar")
async def importar_catalogo(
    proveedor: str = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    parser = PARSERS.get(proveedor)
    if parser is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Proveedor desconocido: {proveedor}"
        )

    contenido = await archivo.read()
    try:
        items = parser(io.BytesIO(contenido), archivo_origen=archivo.filename)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return upsert_componentes(db, items, usuario_id=usuario.id)
```

`backend/app/main.py` (modify — add the new router):

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, catalogo, health

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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/test_catalogo_import_endpoint.py -v
```

Expected: PASS (3 tests).

- [ ] **Step 6: Run the full backend suite**

```bash
pytest -v
```

Expected: all tests PASS (18 from Fase A + 2 schema + 2 parser_abb + 2 parser_otros + 4 upsert + 3 endpoint = 31).

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/catalogo.py backend/app/main.py backend/requirements.txt backend/tests/test_catalogo_import_endpoint.py
git commit -m "feat: add catalog import endpoint"
```

---

### Task 6: Frontend catalog upload page

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/pages/CatalogoPage.tsx`
- Test: `frontend/src/pages/CatalogoPage.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Write the failing test**

`frontend/src/pages/CatalogoPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogoPage } from "./CatalogoPage";

describe("CatalogoPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ total_filas: 1, nuevos: 1, actualizados: 0, sin_cambios: 0 }),
      }),
    );
  });

  it("uploads the selected file and shows the summary", async () => {
    render(<CatalogoPage />);

    const file = new File(["contenido"], "abb.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = screen.getByLabelText(/archivo excel/i) as HTMLInputElement;
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/catalogo/importar"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(await screen.findByTestId("resumen")).toHaveTextContent("Nuevos: 1");
  });

  it("shows an error when no file is selected", async () => {
    render(<CatalogoPage />);

    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/eleg/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend
npm run test
```

Expected: FAIL — `./CatalogoPage` module not found.

- [ ] **Step 3: Write the minimal implementation**

`frontend/src/api/client.ts` (append):

```typescript
export interface ResumenImportCatalogo {
  total_filas: number;
  nuevos: number;
  actualizados: number;
  sin_cambios: number;
}

export async function importarCatalogo(proveedor: string, archivo: File): Promise<ResumenImportCatalogo> {
  const formData = new FormData();
  formData.append("proveedor", proveedor);
  formData.append("archivo", archivo);

  const response = await fetch(`${API_BASE_URL}/catalogo/importar`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("No se pudo importar el catálogo");
  }

  return response.json();
}
```

`frontend/src/pages/CatalogoPage.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { importarCatalogo, type ResumenImportCatalogo } from "../api/client";

export function CatalogoPage() {
  const [proveedor, setProveedor] = useState("abb");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<ResumenImportCatalogo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResumen(null);

    if (!archivo) {
      setError("Elegí un archivo");
      return;
    }

    try {
      const result = await importarCatalogo(proveedor, archivo);
      setResumen(result);
    } catch {
      setError("No se pudo importar el catálogo");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Importar catálogo</h1>
      <label htmlFor="proveedor">Proveedor</label>
      <select id="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
        <option value="abb">ABB</option>
        <option value="otros">Otros materiales</option>
      </select>
      <label htmlFor="archivo">Archivo Excel</label>
      <input
        id="archivo"
        type="file"
        accept=".xlsx"
        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Importar</button>
      {resumen && (
        <p data-testid="resumen">
          Total: {resumen.total_filas} — Nuevos: {resumen.nuevos} — Actualizados: {resumen.actualizados} — Sin
          cambios: {resumen.sin_cambios}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS (2 tests).

- [ ] **Step 5: Wire up the route and a link from the dashboard**

`frontend/src/App.tsx` (modify — add the `/catalogo` route):

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { CatalogoPage } from "./pages/CatalogoPage";
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
        <Route
          path="/catalogo"
          element={
            <RequireAuth>
              <CatalogoPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

`frontend/src/pages/DashboardPage.tsx` (replace — add a link so the page is reachable from the UI, not just by typing the URL):

```tsx
import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <div>
      <h1>Panel de proyectos (próximamente)</h1>
      <Link to="/catalogo">Importar catálogo</Link>
    </div>
  );
}
```

- [ ] **Step 6: Run the full frontend suite**

```bash
npm run test
npx tsc -b
```

Expected: all tests PASS, `tsc -b` exits 0 with no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/pages/CatalogoPage.tsx frontend/src/pages/CatalogoPage.test.tsx frontend/src/App.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add catalog upload page"
```

---

### Task 7: Manual verification against the real supplier files

This task has no automated test — it validates the parsers against the actual files PYRE will upload, which the synthetic-workbook unit tests in Tasks 2–3 can't fully cover (12,000+ rows of real-world messiness). Skip this task's steps (but not Tasks 1–6) if the real files aren't present at `samples/catalogo/` on the machine executing this plan.

- [ ] **Step 1: Run the ABB parser against the real file and sanity-check the output**

```bash
cd backend
source venv/Scripts/activate
python -c "
from app.catalogo.parser_abb import parse_abb_workbook

with open('../samples/catalogo/R-IN-003 ABB 2026 06 - 26-XXX-XXX V1.xlsx', 'rb') as f:
    resultados = parse_abb_workbook(f, archivo_origen='R-IN-003 ABB 2026 06.xlsx')

print('total filas parseadas:', len(resultados))
sin_categoria = [r for r in resultados if not r.categoria_path]
print('sin categoria_path:', len(sin_categoria))
sin_precio = [r for r in resultados if r.precio_neto is None and r.precio_lista is None]
print('sin ningun precio:', len(sin_precio))
termomagneticos = [r for r in resultados if r.categoria_path and r.categoria_path[0].startswith('Interruptores Termomagn')]
print('interruptores termomagneticos:', len(termomagneticos))
print('ejemplo:', termomagneticos[0])
"
```

Expected: total filas parseadas close to the ~10,247 data rows counted during design exploration (some variance is fine — different sections use slightly different structures); `sin_categoria` should be 0 or very small; spot-check that `termomagneticos[0]` has a sensible `categoria_path`, `descripcion`, and `precio_neto`.

- [ ] **Step 2: Run the otros-materiales parser against the real file**

```bash
python -c "
from app.catalogo.parser_otros import parse_otros_workbook

with open('../samples/catalogo/1-Lista de Precios 2025.xlsx', 'rb') as f:
    resultados = parse_otros_workbook(f, archivo_origen='1-Lista de Precios 2025.xlsx')

print('total filas parseadas:', len(resultados))
categorias = sorted({r.categoria_path[0] for r in resultados if r.categoria_path})
print('categorias con datos:', categorias)
"
```

Expected: categories with a `Cod` header row and data underneath appear (Barras de Distribución, Conductores, Terminales, Accesorios Tableros, Canalizaciones, Bandejas, Instalaciones Eléctricas); "Gabinetes" is expected to be **absent or near-empty** since the real file only has free-text notes there, not a structured price table — that's a known gap in the source data, not a parser bug (documented in the design spec).

- [ ] **Step 3: Import both real files through the running API and confirm the summary**

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Then, using a browser or `curl` with a logged-in session cookie (see `docs/README.md` for the login flow), `POST` both real files to `/catalogo/importar` (`proveedor=abb` and `proveedor=otros` respectively) and confirm the JSON summary's `nuevos` count roughly matches Steps 1–2's row counts, and that re-uploading the same file a second time reports mostly `sin_cambios` (upsert idempotency).

- [ ] **Step 4: No commit for this task** — it's verification only; if it surfaces a real parser bug, fix it as a new bite-sized task (write the failing synthetic-workbook test that reproduces the bug first, per TDD) rather than patching blind.

---

### Task 8: Reference documentation

**Files:**
- Modify: `docs/diccionario_datos.md`
- Modify: `docs/reglas_negocio.md`

- [ ] **Step 1: Update the data dictionary's `catalogo_componente` entry**

In `docs/diccionario_datos.md`, replace the `catalogo_componente` bullet with:

```markdown
- **catalogo_componente** — catálogo de componentes de cualquier proveedor (ABB, y proveedores de otros materiales como barras de cobre, conductores, gabinetes, etc.). Esquema flexible: `categoria_path` guarda el camino completo de categorización tal como aparece en el Excel origen (ej. `["Interruptores Termomagnéticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Unipolares"]`), `categoria_raiz` es el primer nivel (indexado, para filtrar rápido). `precio_neto` es el precio que usa por defecto el motor de configuración; `precio_lista` se guarda de referencia. `atributos` es un campo JSON reservado para specs eléctricas (polos, corriente nominal, capacidad de corte) que **todavía no se completa en esta fase** — lo puebla el motor de configuración de la fase siguiente. `archivo_origen`/`fila_origen` trazan cada registro a la celda del Excel del que vino.
```

- [ ] **Step 2: Add catalog import rules to the business rules doc**

In `docs/reglas_negocio.md`, add a new section after "## Roles":

```markdown
## Importación de catálogo

- Cualquiera de los dos roles (analista o supervisor) puede subir un archivo de catálogo.
- La clave de identificación de un componente es `(proveedor, codigo)`. Volver a subir un archivo con el mismo código actualiza el componente existente en vez de duplicarlo.
- Si el precio (`precio_lista` o `precio_neto`) cambió respecto al valor guardado, se escribe una fila en `catalogo_precio_historial` antes de actualizar — nunca se pierde el precio anterior.
- Toda importación queda registrada en `audit_log` con el resumen (nuevos/actualizados/sin cambios), visible para todos los analistas.
- El catálogo ABB se importa completo (todas las categorías, no solo las de tableros seccionables) para poder reutilizarse en otros proyectos de PYRE. La jerarquía de categorías (`categoria_path`) se parsea automáticamente desde el formato visual del Excel de ABB (tamaño/negrita de fuente) — funciona de forma verificada para interruptores termomagnéticos y diferenciales; en categorías menos usadas por ahora (contactores, UPS, relés, accesorios) el parseo es "mejor esfuerzo" y se corrige cuando una fase futura empiece a usarlas.
```

- [ ] **Step 3: Commit**

```bash
git add docs/diccionario_datos.md docs/reglas_negocio.md
git commit -m "docs: update data dictionary and business rules for flexible catalog"
```

---

## Definition of done for this plan

- `pytest -v` in `backend/` passes with 0 failures (31 tests: 18 from Fase A + 13 new).
- `npm run test` and `npx tsc -b` in `frontend/` both pass with 0 failures/errors.
- `docker compose up -d --build` + `alembic upgrade head` leaves `catalogo_componente` with the flexible schema and no leftover `tipo_componente`/`proveedor` Postgres enum types.
- An analyst can log in, go to `/catalogo`, upload an `.xlsx`, and see a nuevos/actualizados/sin_cambios summary.
- The real ABB and otros-materiales sample files parse without crashing and produce a plausible row count and category breakdown (Task 7).
- `docs/diccionario_datos.md` and `docs/reglas_negocio.md` reflect the schema and import rules actually implemented.
