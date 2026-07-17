# Poblar atributos del catálogo ABB (Fase C, ciclo 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender el importador de ABB (`parser_abb.py`) para derivar `tipo`/`polos`/`corriente_nominal_a`/`capacidad_corte_ka` desde el texto real del Excel y guardarlos en `catalogo_componente.atributos`, para que el motor de configuración (Fase C ciclo 1) pueda proponer componentes reales en vez de solo datos de prueba.

**Architecture:** Nuevas funciones de extracción por regex en `parser_abb.py`, con un dispatch por familia de categoría (`_extraer_atributos`). `ComponenteImportado` gana un campo `atributos`. `upsert_componentes` lo persiste. Ningún cambio en `parser_otros.py` ni en el modelo de datos — solo se puebla un campo JSONB que ya existe.

**Tech Stack:** Python (`re`, `decimal.Decimal`), pytest, mismos patrones que el resto de `app/catalogo/`.

**Spec:** `docs/superpowers/specs/2026-07-16-catalogo-abb-atributos-design.md`

**Desviaciones del spec encontradas al verificar contra el Excel real (`samples/catalogo/R-IN-003 ABB 2026 06 - 26-XXX-XXX V1.xlsx`, 10.247 filas):**

1. El spec decía que `polos` para termomagnéticos modulares y MCCB sale del **último nivel de `categoria_path`**. Verificado contra datos reales: en MCCB (`Interruptores automáticos en caja moldeada`, la categoría más grande con 5.432 filas) el último nivel es un **nombre de modelo** (ej. `"XT1B 160"`), no un indicador de polos — el polo real vive en la palabra dentro de la **descripción** (`"Interruptor Tmax XT tripolar In = 16A..."`). Este plan extrae `polos` de la descripción primero (funciona para las 3 familias en alcance) y usa `categoria_path` como respaldo solo cuando la descripción viene vacía (pasa en 56 de 513 filas de termomagnéticos modulares — filas de continuación de sección sin descripción propia, pero con `"Tetrapolares"` como último nivel de `categoria_path`).
2. Confirmado con datos reales que la coma decimal aparece también en la corriente, no solo en la capacidad de corte (ej. `"In 0,5A"`).

---

### Task 1: `ComponenteImportado.atributos`

**Files:**
- Modify: `backend/app/catalogo/types.py`

- [ ] **Step 1: Agregar el campo**

`backend/app/catalogo/types.py` (reemplazar el archivo completo):
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
    atributos: dict | None = None
```

`atributos` va al final con default `None` — así `parser_otros.py` y cualquier construcción existente de `ComponenteImportado` (ej. `tests/test_upsert_catalogo.py`) siguen funcionando sin tocarlos.

- [ ] **Step 2: Verificar que nada se rompe**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS (88 tests — el campo nuevo no cambia comportamiento todavía, nadie lo puebla aún).

- [ ] **Step 3: Commit**

```bash
git add backend/app/catalogo/types.py
git commit -m "feat: add atributos field to ComponenteImportado"
```

---

### Task 2: Extracción de atributos (`_extraer_atributos` y helpers)

**Files:**
- Modify: `backend/app/catalogo/parser_abb.py`
- Test: `backend/tests/test_parser_abb_atributos.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_parser_abb_atributos.py`:
```python
from decimal import Decimal

from app.catalogo.parser_abb import _extraer_atributos


def test_termomagnetico_modular_unipolar():
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Unipolares"],
        descripcion="Interruptor termomagnético unipolar  In 2A Icn = 4,5kA @ IEC60898 Curva C",
    )

    assert resultado == {
        "tipo": "seccional_termomagnetico",
        "polos": 1,
        "corriente_nominal_a": 2.0,
        "capacidad_corte_ka": 4.5,
    }


def test_termomagnetico_modular_tetrapolar():
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Tetrapolares"],
        descripcion="Interruptor termomagnético tetrapolar In 2A Icn = 4,5kA @ IEC60898 Curva C",
    )

    assert resultado["polos"] == 4


def test_termomagnetico_con_typo_sin_espacio():
    # variante real "Sin posibilidad de utilizar accesorios": el proveedor tiene
    # un typo de formato en la descripción sin espacio antes de "unipolar".
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos - Sin posibilidad de utilizar accesorios", "Curva B - Icn: 4,5kA (IEC 60898)", "Unipolares"],
        descripcion="Interruptortermomagnético unipolar In 6A Icn = 4,5kA @ IEC60898 Curva B",
    )

    assert resultado == {
        "tipo": "seccional_termomagnetico",
        "polos": 1,
        "corriente_nominal_a": 6.0,
        "capacidad_corte_ka": 4.5,
    }


def test_termomagnetico_con_accesorios_icn_e_icu_toma_el_menor():
    # variante real "Con posibilidad de utilizar accesorios": trae Icn (IEC60898)
    # e Icu (IEC60947) en la misma descripción — el motor debe usar el menor.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos - Con posibilidad de utilizar accesorios", "S200", "Curva C - Icn: 6kA (IEC 60898) - Icu: 10kA (IEC 60947)", "Unipolares"],
        descripcion="Interruptor termomagnético unipolar In 0,5A. Icn = 6kA @ IEC60898 Icu : 10 kA @ IEC60947-2. Curva C",
    )

    assert resultado["corriente_nominal_a"] == 0.5
    assert resultado["capacidad_corte_ka"] == 6.0  # min(6, 10), no 10


def test_mccb_polos_sale_de_la_descripcion_no_del_ultimo_nivel_de_categoria():
    # En MCCB el último nivel de categoria_path es un modelo (ej. "XT1B 160"),
    # no un indicador de polos — por eso este caso depende de que la extracción
    # lea la descripción primero.
    resultado = _extraer_atributos(
        categoria_path=[
            "Interruptores automáticos en caja moldeada", "SACE Tmax XT",
            "XT1 - Tripolares (3p) - Ejecución fija (F) - Teminales anteriores (F)", "XT1B 160",
        ],
        descripcion="Interruptor Tmax XT tripolar In = 16A - Icu = 18kA, Ics = 100% Icu @ 380VCA",
    )

    assert resultado == {
        "tipo": "seccional_termomagnetico",
        "polos": 3,
        "corriente_nominal_a": 16.0,
        "capacidad_corte_ka": 18.0,
    }


def test_termomagnetico_sin_descripcion_usa_categoria_path_para_polos():
    # Filas reales de continuación de sección: descripción vacía, pero el último
    # nivel de categoria_path sí trae el polo. Sin la corriente (que solo está en
    # la descripción) el resultado igual es None -- este test prueba que el
    # respaldo de polos funciona usando una descripción sintética con corriente,
    # para aislar ese mecanismo del caso real (que además de polos, también le
    # falta la corriente y por lo tanto no matchea nada).
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "S800 C", "Curva C", "Tetrapolares"],
        descripcion="In 40A Icn = 25kA",
    )

    assert resultado["polos"] == 4
    assert resultado["corriente_nominal_a"] == 40.0
    assert resultado["capacidad_corte_ka"] == 25.0


def test_termomagnetico_con_descripcion_vacia_y_sin_corriente_devuelve_none():
    # Caso real: fila de continuación de sección, sin descripción propia.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Termomagnéticos", "S800 C", "Curva C - Icu: 25kA  (IEC 60947-2) Ics: 18kA", "Tetrapolares"],
        descripcion="",
    )

    assert resultado is None


def test_combo_termomagnetico_diferencial():
    resultado = _extraer_atributos(
        categoria_path=["Interruptores termomagnéticos con protección diferencial", "hasta 6kA", "I∆ = 30mA"],
        descripcion="Interruptor termomagnético y diferencial bipolar In=6, 6kA, curva C, Sens=30mA",
    )

    assert resultado == {
        "tipo": "seccional_diferencial",
        "polos": 2,
        "corriente_nominal_a": 6.0,
        "capacidad_corte_ka": 6.0,
    }


def test_diferencial_puro_fuera_de_alcance_devuelve_none():
    # "Interruptores Diferenciales" (puro) nunca trae Icn/Icu en ningún lado del
    # Excel real -- queda deliberadamente sin atributos.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores Diferenciales", "F200 AC", "Bipolares"],
        descripcion="Interruptor diferencial bipolar  In 16. Sens = 10 mA",
    )

    assert resultado is None


def test_categoria_fuera_de_alcance_devuelve_none():
    resultado = _extraer_atributos(
        categoria_path=["Seccionador de Línea", "Algo"],
        descripcion="Seccionador tripolar In 100A",
    )

    assert resultado is None


def test_accesorio_dentro_de_familia_combo_sin_corriente_devuelve_none():
    # Real: "Bloque Diferencial" es un accesorio vendido dentro de la misma
    # familia de categorías, pero su descripción no tiene el patrón "In <N>A" de
    # un interruptor completo -- debe quedar sin atributos, no con datos parciales.
    resultado = _extraer_atributos(
        categoria_path=["Interruptores termomagnéticos con protección diferencial", "Tipo A - Clase AP-R  Alta Inmunidad", "Bloque Diferencial DDA202 - Bipolar"],
        descripcion="Bloque Diferencial 25A Clase A 10mA 2 Polos (p/S200)",
    )

    assert resultado is None


def test_categoria_path_vacia_devuelve_none():
    assert _extraer_atributos(categoria_path=[], descripcion="cualquier cosa") is None
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_parser_abb_atributos.py -v`
Expected: FAIL — `ImportError: cannot import name '_extraer_atributos' from 'app.catalogo.parser_abb'`

- [ ] **Step 3: Implementar la extracción**

Agregar al principio de `backend/app/catalogo/parser_abb.py`, después de los imports existentes (agregar `import re` a los imports):

```python
import logging
import re
from decimal import Decimal, InvalidOperation

import openpyxl

from app.catalogo.types import ComponenteImportado

logger = logging.getLogger(__name__)

FAMILIAS_TERMOMAGNETICO = {
    "Interruptores Termomagnéticos",
    "Interruptores Termomagnéticos - Con posibilidad de utilizar accesorios",
    "Interruptores Termomagnéticos - Sin posibilidad de utilizar accesorios",
    "Interruptores automáticos en caja moldeada",
}
FAMILIA_DIFERENCIAL_COMBO = "Interruptores termomagnéticos con protección diferencial"

_POLOS_MAP = {"uni": 1, "bi": 2, "tri": 3, "tetra": 4}
_POLOS_DESCRIPCION_RE = re.compile(r"\b(uni|bi|tri|tetra)polar", re.IGNORECASE)
_POLOS_CATEGORIA_RE = re.compile(r"\b(uni|bi|tri|tetra)polar(es)?\b", re.IGNORECASE)
_CORRIENTE_RE = re.compile(r"In\s*=?\s*(\d+(?:[.,]\d+)?)")
_CAPACIDAD_DESCRIPCION_RE = re.compile(r"Ic[nu]\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*kA", re.IGNORECASE)
_CAPACIDAD_CATEGORIA_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*kA", re.IGNORECASE)


def _texto_a_decimal(texto: str) -> Decimal:
    return Decimal(texto.replace(",", "."))


def _extraer_polos(categoria_path: list[str], descripcion: str) -> int | None:
    match = _POLOS_DESCRIPCION_RE.search(descripcion or "")
    if match:
        return _POLOS_MAP[match.group(1).lower()]
    for nivel in categoria_path:
        match = _POLOS_CATEGORIA_RE.search(nivel)
        if match:
            return _POLOS_MAP[match.group(1).lower()]
    return None


def _extraer_corriente_nominal(descripcion: str) -> Decimal | None:
    match = _CORRIENTE_RE.search(descripcion or "")
    if not match:
        return None
    return _texto_a_decimal(match.group(1))


def _extraer_capacidad_corte_termomagnetico(descripcion: str) -> Decimal | None:
    valores = _CAPACIDAD_DESCRIPCION_RE.findall(descripcion or "")
    if not valores:
        return None
    return min(_texto_a_decimal(v) for v in valores)


def _extraer_capacidad_corte_combo(categoria_path: list[str]) -> Decimal | None:
    if len(categoria_path) < 2:
        return None
    match = _CAPACIDAD_CATEGORIA_RE.search(categoria_path[1])
    if not match:
        return None
    return _texto_a_decimal(match.group(1))


def _extraer_atributos(categoria_path: list[str], descripcion: str) -> dict | None:
    if not categoria_path:
        return None
    raiz = categoria_path[0]

    if raiz in FAMILIAS_TERMOMAGNETICO:
        tipo = "seccional_termomagnetico"
        polos = _extraer_polos(categoria_path, descripcion)
        corriente = _extraer_corriente_nominal(descripcion)
        capacidad = _extraer_capacidad_corte_termomagnetico(descripcion)
    elif raiz == FAMILIA_DIFERENCIAL_COMBO:
        tipo = "seccional_diferencial"
        polos = _extraer_polos(categoria_path, descripcion)
        corriente = _extraer_corriente_nominal(descripcion)
        capacidad = _extraer_capacidad_corte_combo(categoria_path)
    else:
        return None

    if polos is None or corriente is None or capacidad is None:
        return None

    return {
        "tipo": tipo,
        "polos": polos,
        "corriente_nominal_a": float(corriente),
        "capacidad_corte_ka": float(capacidad),
    }
```

(El resto del archivo —`parse_abb_workbook`, `_find_lista_de_precios_sheet`, `_read_header_map`, `_get_required_column`, `_update_path`, `_decimal_or_none`, `_build_componente`— queda igual por ahora, se toca en el Task 3.)

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_parser_abb_atributos.py -v`
Expected: PASS (12 tests)

- [ ] **Step 5: Correr toda la suite del backend**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS (100 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/catalogo/parser_abb.py backend/tests/test_parser_abb_atributos.py
git commit -m "feat: extract electrical atributos from ABB categoria_path/descripcion"
```

---

### Task 3: Conectar la extracción a `_build_componente`

**Files:**
- Modify: `backend/app/catalogo/parser_abb.py`
- Modify: `backend/tests/test_parser_abb.py`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `backend/tests/test_parser_abb.py`:
```python
def test_parse_abb_workbook_populates_atributos_for_in_scope_rows():
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
    data_row(8, "COD-U2", "SH201-C2", 15.4, 7.8, "Interruptor termomagnético unipolar In 2A Icn = 4,5kA @ IEC60898 Curva C")
    header_row(9, "Interruptores Diferenciales", 14, False)
    header_row(10, "F200", 14, True)
    header_row(11, "30mA", 10, True)
    header_row(12, "Bipolares", 12, False)
    data_row(13, "COD-DIF", "F202-30", 50.0, 25.0, "Interruptor diferencial bipolar In 16. Sens = 10 mA")

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    resultados = parse_abb_workbook(buffer, archivo_origen="test.xlsx")

    termomagnetico = next(r for r in resultados if r.codigo == "COD-U2")
    assert termomagnetico.atributos == {
        "tipo": "seccional_termomagnetico",
        "polos": 1,
        "corriente_nominal_a": 2.0,
        "capacidad_corte_ka": 4.5,
    }

    diferencial = next(r for r in resultados if r.codigo == "COD-DIF")
    assert diferencial.atributos is None
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_parser_abb.py -v -k atributos`
Expected: FAIL — `termomagnetico.atributos` es `None` (nada lo puebla todavía).

- [ ] **Step 3: Conectar `_extraer_atributos` en `_build_componente`**

En `backend/app/catalogo/parser_abb.py`, reemplazar `_build_componente`:

```python
def _build_componente(ws, row_idx, header_map, path, archivo_origen) -> ComponenteImportado:
    def cell(label):
        col = header_map.get(label)
        return ws.cell(row=row_idx, column=col).value if col else None

    comercial = cell("Codigo Comercial")
    categoria_path = [texto for _, texto in path]
    descripcion = str(cell("Descripcion") or "").strip()
    return ComponenteImportado(
        proveedor="ABB",
        codigo=str(cell("Codigo SAP")).strip(),
        codigo_comercial=str(comercial).strip() if comercial else None,
        categoria_path=categoria_path,
        descripcion=descripcion,
        unidad="Unidad",
        precio_lista=_decimal_or_none(cell("Precio de Lista USD"), row_idx),
        precio_neto=_decimal_or_none(cell("Precio NETO USD"), row_idx),
        atributos=_extraer_atributos(categoria_path, descripcion),
        archivo_origen=archivo_origen,
        fila_origen=row_idx,
    )
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_parser_abb.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Correr toda la suite del backend**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS (101 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/catalogo/parser_abb.py backend/tests/test_parser_abb.py
git commit -m "feat: wire atributos extraction into _build_componente"
```

---

### Task 4: Persistir `atributos` en `upsert_componentes`

**Files:**
- Modify: `backend/app/catalogo/upsert.py`
- Modify: `backend/tests/test_upsert_catalogo.py`

- [ ] **Step 1: Escribir los tests que fallan**

En `backend/tests/test_upsert_catalogo.py`, modificar `_item` para aceptar `atributos` opcional:

```python
def _item(codigo="C1", precio_neto=Decimal("10.00"), atributos=None):
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
        atributos=atributos,
    )
```

Agregar al final del archivo:
```python
def test_atributos_se_guarda_al_insertar(db_session):
    usuario = create_user("import6.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    atributos = {"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 16.0, "capacidad_corte_ka": 6.0}

    upsert_componentes(db_session, [_item(codigo="C6", atributos=atributos)], usuario_id=usuario.id)

    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C6").one()
    assert componente.atributos == atributos


def test_atributos_se_actualiza_en_reimportacion(db_session):
    usuario = create_user("import7.test@pyre.com", "Importador", "clave-segura-123", "analista", db=db_session)
    viejo = {"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 16.0, "capacidad_corte_ka": 6.0}
    nuevo = {"tipo": "seccional_termomagnetico", "polos": 1, "corriente_nominal_a": 20.0, "capacidad_corte_ka": 6.0}
    upsert_componentes(db_session, [_item(codigo="C7", atributos=viejo)], usuario_id=usuario.id)

    upsert_componentes(db_session, [_item(codigo="C7", atributos=nuevo)], usuario_id=usuario.id)

    componente = db_session.query(CatalogoComponente).filter_by(proveedor="ABB", codigo="C7").one()
    assert componente.atributos == nuevo
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_upsert_catalogo.py -v -k atributos`
Expected: FAIL — `componente.atributos` es `None` en ambos (nunca se copia desde `item.atributos`).

- [ ] **Step 3: Copiar `atributos` en `upsert_componentes`**

En `backend/app/catalogo/upsert.py`, en el bloque de creación (`if existente is None:`), agregar `atributos=item.atributos,` al constructor de `CatalogoComponente`:

```python
        if existente is None:
            nuevo = CatalogoComponente(
                id=uuid.uuid4(),
                proveedor=item.proveedor,
                codigo=item.codigo,
                codigo_comercial=item.codigo_comercial,
                categoria_path=item.categoria_path,
                categoria_raiz=item.categoria_path[0] if item.categoria_path else "",
                descripcion=item.descripcion,
                unidad=item.unidad,
                precio_lista=item.precio_lista,
                precio_neto=item.precio_neto,
                atributos=item.atributos,
                archivo_origen=item.archivo_origen,
                fila_origen=item.fila_origen,
            )
```

Y en el bloque de actualización, agregar la línea `existente.atributos = item.atributos` junto a las demás asignaciones:

```python
        existente.descripcion = item.descripcion
        existente.categoria_path = item.categoria_path
        existente.categoria_raiz = item.categoria_path[0] if item.categoria_path else existente.categoria_raiz
        existente.codigo_comercial = item.codigo_comercial
        existente.unidad = item.unidad
        existente.atributos = item.atributos
        existente.archivo_origen = item.archivo_origen
        existente.fila_origen = item.fila_origen
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_upsert_catalogo.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Correr toda la suite del backend**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS (103 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/catalogo/upsert.py backend/tests/test_upsert_catalogo.py
git commit -m "feat: persist atributos on catalog insert and reimport"
```

---

### Task 5: Verificación manual contra el Excel real + documentación

**Files:**
- Modify: `docs/diccionario_datos.md`
- Modify: `docs/reglas_negocio.md`

- [ ] **Step 1: Correr el parser contra el archivo real y medir cobertura**

Run (desde `backend/`, con el venv activo):
```bash
venv/Scripts/python -c "
from app.catalogo.parser_abb import parse_abb_workbook, FAMILIAS_TERMOMAGNETICO, FAMILIA_DIFERENCIAL_COMBO

with open('../samples/catalogo/R-IN-003 ABB 2026 06 - 26-XXX-XXX V1.xlsx', 'rb') as f:
    resultados = parse_abb_workbook(f, archivo_origen='real.xlsx')

en_alcance = [r for r in resultados if r.categoria_path and (r.categoria_path[0] in FAMILIAS_TERMOMAGNETICO or r.categoria_path[0] == FAMILIA_DIFERENCIAL_COMBO)]
con_atributos = [r for r in en_alcance if r.atributos is not None]
print(f'filas en categorias en-alcance: {len(en_alcance)}')
print(f'con atributos poblados: {len(con_atributos)} ({100*len(con_atributos)/len(en_alcance):.1f}%)')
"
```
Expected: la cobertura sobre filas en-alcance debería ser alta (>80%) — el resto son filas de accesorios/continuación sin descripción completa, ya cubiertas por los tests del Task 2. Si la cobertura es mucho más baja, revisar manualmente 5-10 filas sin `atributos` para ver si aparece un patrón de texto no contemplado por las regex del Task 2, y ajustar antes de seguir.

- [ ] **Step 2: Actualizar `docs/diccionario_datos.md`**

Reemplazar la frase sobre `atributos` en la línea de `catalogo_componente` (la que dice "El importador de Fase B todavía no puebla estas claves...") por:
```markdown
El importador de ABB (`parser_abb.py`) puebla estas claves derivándolas de `categoria_path`/`descripcion` por regex, para las categorías `Interruptores Termomagnéticos` (+ variantes con/sin accesorios), `Interruptores automáticos en caja moldeada` (MCCB) y `Interruptores termomagnéticos con protección diferencial`. Fuera de esas categorías (ej. `Interruptores Diferenciales` puros, que nunca traen capacidad de corte en el Excel; contactores; seccionadores) `atributos` queda en `NULL` a propósito — el analista sigue pudiendo buscar y elegir esos componentes a mano, solo que el motor de configuración nunca los propone automáticamente. `parser_otros.py` (materiales no-ABB) nunca puebla `atributos`.
```

- [ ] **Step 3: Actualizar `docs/reglas_negocio.md`**

Agregar después de la sección `## Importación de catálogo`:
```markdown
### Categorías de ABB en alcance del motor de configuración

El motor solo puede proponer componentes de estas categorías (`categoria_path[0]` del catálogo ABB) porque son las únicas con capacidad de corte (Icn/Icu) disponible en el Excel real de ABB:

- `Interruptores Termomagnéticos` (y las variantes "con"/"sin posibilidad de utilizar accesorios") → `tipo=seccional_termomagnetico`.
- `Interruptores automáticos en caja moldeada` (MCCB, familia Tmax XT) → `tipo=seccional_termomagnetico`, típicamente los candidatos a interruptor principal por su corriente/capacidad de corte mayor.
- `Interruptores termomagnéticos con protección diferencial` → `tipo=seccional_diferencial`.

`Interruptores Diferenciales` (puros) quedan fuera: el Excel real nunca trae Icn/Icu para esa familia, solo sensibilidad (mA) — no hay forma de validar que cumplan el nivel de falla del tablero. El analista los sigue pudiendo cargar manualmente.
```

- [ ] **Step 4: Commit**

```bash
git add docs/diccionario_datos.md docs/reglas_negocio.md
git commit -m "docs: document ABB atributos extraction coverage and scope"
```

---

## Self-review notes

- **Cobertura de la spec:** Task 1 cubre el campo nuevo de `ComponenteImportado`; Task 2 cubre las reglas de extracción de las 3 familias en alcance (con los ajustes encontrados contra datos reales, documentados arriba); Task 3 conecta la extracción al parser; Task 4 persiste en la base; Task 5 verifica cobertura real y actualiza documentación — coincide con las 4 secciones del spec (Categorías, Reglas de extracción, Arquitectura, Testing/Documentación).
- **Determinismo:** `min()` sobre los valores de Icn/Icu es determinístico independientemente del orden en que aparecen en la descripción.
- **Consistencia de tipos:** `_extraer_atributos` devuelve siempre `dict | None` con las mismas 4 claves (`tipo`, `polos`, `corriente_nominal_a`, `capacidad_corte_ka`) que ya consume `app/motor/propuesta.py` (`POLOS_POR_FORMATO`, `atributos.get("tipo")`, `atributos.get("corriente_nominal_a")`, `atributos.get("capacidad_corte_ka")`) — no se inventan nombres de clave nuevos.
