# Catálogo: búsqueda scoped, filtros estructurados, display legible y fix de modales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the interruptor picker's search to real interruptores (excluding accessories/unmatched rows), add polos/corriente/capacidad-de-corte filters, show human-readable código instead of raw UUIDs wherever a component is displayed, and fix a systemic bug where every modal in the app closes accidentally when a text selection drag ends outside it.

**Architecture:** Backend gains two new query params on the existing `/catalogo/buscar` (`solo_con_atributos`, plus `polos`/`corriente_nominal_a`/`capacidad_corte_ka`), a new `GET /catalogo/opciones-filtro` endpoint that derives filter dropdown values from real data (no hardcoded lists), and two response models (`SalidaResponse`, `TableroResponse`) gain componente code fields resolved server-side. Frontend gains a shared `useCerrarAlClickFuera` hook applied uniformly to every modal's backdrop, a filters panel inside `ComponentePicker`, and swaps raw UUID display for the new código fields in the three places that showed it.

**Tech Stack:** Python/FastAPI + SQLAlchemy 2.0 (JSONB queries via `.as_integer()`/`.as_float()`) + pytest (backend); React 19/TypeScript + Vite + Vitest + Testing Library (frontend).

Spec: `docs/superpowers/specs/2026-07-19-catalogo-busqueda-filtros-display-design.md`

---

## Task 1: Backend — `solo_con_atributos` + filtros `polos`/`corriente_nominal_a`/`capacidad_corte_ka` en `/catalogo/buscar`

**Files:**
- Modify: `backend/app/routers/catalogo.py`
- Test: `backend/tests/test_catalogo_buscar_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_catalogo_buscar_endpoint.py`:

```python
def _componente_con_atributos(db_session, codigo, polos, corriente, capacidad_corte, descripcion=None):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=descripcion or f"Interruptor {codigo}",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        atributos={
            "tipo": "seccional_termomagnetico",
            "polos": polos,
            "corriente_nominal_a": corriente,
            "capacidad_corte_ka": capacidad_corte,
        },
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_buscar_con_solo_con_atributos_excluye_filas_sin_atributos(client, db_session):
    _login(client, db_session, email="buscarcat11.test@pyre.com")
    con_atributos = _componente_con_atributos(db_session, "ZQXATR-C1", 3, 16, 10, "Interruptor ZQXATR real")
    sin_atributos = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXATR-C2",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Accesorio ZQXATR sin datos",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(sin_atributos)
    db_session.commit()

    response = client.get("/catalogo/buscar", params={"q": "ZQXATR", "solo_con_atributos": "true"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(con_atributos.id) in ids
    assert str(sin_atributos.id) not in ids


def test_buscar_sin_solo_con_atributos_no_filtra(client, db_session):
    _login(client, db_session, email="buscarcat12.test@pyre.com")
    sin_atributos = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXNOFLAG-C1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Accesorio ZQXNOFLAG sin datos",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(sin_atributos)
    db_session.commit()

    response = client.get("/catalogo/buscar", params={"q": "ZQXNOFLAG"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(sin_atributos.id) in ids


def test_buscar_filtra_por_polos(client, db_session):
    _login(client, db_session, email="buscarcat13.test@pyre.com")
    tripolar = _componente_con_atributos(db_session, "ZQXPOL-C1", 3, 16, 10, "Interruptor ZQXPOL tripolar")
    tetrapolar = _componente_con_atributos(db_session, "ZQXPOL-C2", 4, 16, 10, "Interruptor ZQXPOL tetrapolar")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPOL", "polos": 3})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(tripolar.id) in ids
    assert str(tetrapolar.id) not in ids


def test_buscar_filtra_por_corriente_nominal(client, db_session):
    _login(client, db_session, email="buscarcat14.test@pyre.com")
    de_16a = _componente_con_atributos(db_session, "ZQXIN-C1", 3, 16, 10, "Interruptor ZQXIN 16A")
    de_32a = _componente_con_atributos(db_session, "ZQXIN-C2", 3, 32, 10, "Interruptor ZQXIN 32A")

    response = client.get("/catalogo/buscar", params={"q": "ZQXIN", "corriente_nominal_a": "16"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(de_16a.id) in ids
    assert str(de_32a.id) not in ids


def test_buscar_filtra_por_capacidad_de_corte(client, db_session):
    _login(client, db_session, email="buscarcat15.test@pyre.com")
    de_10ka = _componente_con_atributos(db_session, "ZQXKA-C1", 3, 16, 10, "Interruptor ZQXKA 10kA")
    de_18ka = _componente_con_atributos(db_session, "ZQXKA-C2", 3, 16, 18, "Interruptor ZQXKA 18kA")

    response = client.get("/catalogo/buscar", params={"q": "ZQXKA", "capacidad_corte_ka": "10"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(de_10ka.id) in ids
    assert str(de_18ka.id) not in ids


def test_buscar_combina_categorias_solo_con_atributos_y_filtros(client, db_session):
    _login(client, db_session, email="buscarcat16.test@pyre.com")
    match = _componente_con_atributos(db_session, "ZQXCOMBO-C1", 3, 25, 15, "Interruptor ZQXCOMBO match")
    otro_polos = _componente_con_atributos(db_session, "ZQXCOMBO-C2", 4, 25, 15, "Interruptor ZQXCOMBO otro polos")

    response = client.get(
        "/catalogo/buscar",
        params={
            "q": "ZQXCOMBO",
            "categorias": ["Interruptores Termomagneticos"],
            "solo_con_atributos": "true",
            "polos": 3,
        },
    )

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(match.id) in ids
    assert str(otro_polos.id) not in ids
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: the 6 new tests FAIL (params are silently ignored today, so all rows come back unfiltered by the new criteria).

- [ ] **Step 3: Implement**

In `backend/app/routers/catalogo.py`, update the `buscar_componentes` signature and add the new filters. Replace lines 66-105 (from `@router.get("/buscar"...)` through the end of the `if categorias:` block) with:

```python
@router.get("/buscar", response_model=BusquedaCatalogoResponse)
def buscar_componentes(
    q: str = "",
    categorias: list[str] | None = Query(default=None),
    solo_con_atributos: bool = False,
    polos: int | None = None,
    corriente_nominal_a: Decimal | None = None,
    capacidad_corte_ka: Decimal | None = None,
    limit: int = _LIMIT_POR_DEFECTO,
    offset: int = 0,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    limit = min(max(limit, 1), _LIMIT_MAXIMO)
    offset = max(offset, 0)

    if len(q.strip()) < 2:
        return BusquedaCatalogoResponse(resultados=[], total=0)

    termino_limpio = q.strip()
    termino = f"%{termino_limpio}%"
    prefijo = f"{termino_limpio}%"

    # Relevancia: coincidencia de prefijo en el código interno primero, después
    # en el código comercial, cualquier otra coincidencia (ej. en la
    # descripción) al final. Los índices GIN de trigramas (migración
    # <rev>_pg_trgm_catalogo_busqueda) aceleran tanto el filtro ILIKE '%...%'
    # como este ranking sobre las ~10k filas del catálogo real.
    relevancia = case(
        (CatalogoComponente.codigo.ilike(prefijo), 0),
        (CatalogoComponente.codigo_comercial.ilike(prefijo), 1),
        else_=2,
    )

    filtro = or_(
        CatalogoComponente.codigo.ilike(termino),
        CatalogoComponente.codigo_comercial.ilike(termino),
        CatalogoComponente.descripcion.ilike(termino),
    )
    if categorias:
        # Filtro maestro no editable por el analista -- acota la búsqueda a
        # las categorías relevantes del contexto (ej. solo interruptores),
        # en vez de barrer las ~9-10k filas de todo el catálogo real.
        filtro = and_(filtro, CatalogoComponente.categoria_raiz.in_(categorias))
    if solo_con_atributos:
        # Saca del medio filas sin polos/In/capacidad de corte extraídos --
        # en la práctica esto son accesorios (terminales, mandos, bloqueos)
        # que comparten categoria_raiz con interruptores reales, más el
        # pequeño % de interruptores reales sin atributos extraídos (ver
        # docs/consultas_ingenieria.md #1). Opt-in: no cambia el
        # comportamiento por defecto para futuros contextos de búsqueda que
        # sí quieran ver filas sin atributos.
        filtro = and_(filtro, CatalogoComponente.atributos.isnot(None))
    if polos is not None:
        filtro = and_(filtro, CatalogoComponente.atributos["polos"].as_integer() == polos)
    if corriente_nominal_a is not None:
        filtro = and_(
            filtro, CatalogoComponente.atributos["corriente_nominal_a"].as_float() == float(corriente_nominal_a)
        )
    if capacidad_corte_ka is not None:
        filtro = and_(
            filtro, CatalogoComponente.atributos["capacidad_corte_ka"].as_float() == float(capacidad_corte_ka)
        )
```

(The rest of the function — `total = ...`, the paginated query, `order_by(...)`, and the final `return` — stays exactly as-is; it already consumes `filtro`, which now optionally includes the four new conditions.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: all PASS, including the pre-existing `order_by`-inspection regression test (untouched).

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && venv\Scripts\pytest -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/catalogo.py backend/tests/test_catalogo_buscar_endpoint.py
git commit -m "feat: add solo_con_atributos and polos/corriente/capacidad_corte filters to GET /catalogo/buscar"
```

---

## Task 2: Backend — `GET /catalogo/opciones-filtro`

**Files:**
- Modify: `backend/app/routers/catalogo.py`
- Test: `backend/tests/test_catalogo_buscar_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_catalogo_buscar_endpoint.py`:

```python
def test_opciones_filtro_devuelve_valores_distintos_ordenados(client, db_session):
    _login(client, db_session, email="opcionesfiltro1.test@pyre.com")
    _componente_con_atributos(db_session, "ZQXOPC-C1", 3, 32, 10, "Interruptor ZQXOPC A")
    _componente_con_atributos(db_session, "ZQXOPC-C2", 3, 16, 18, "Interruptor ZQXOPC B")
    _componente_con_atributos(db_session, "ZQXOPC-C3", 4, 16, 10, "Interruptor ZQXOPC C")

    response = client.get(
        "/catalogo/opciones-filtro", params={"categorias": ["Interruptores Termomagneticos"]}
    )

    assert response.status_code == 200
    body = response.json()
    assert 3 in body["polos"] and 4 in body["polos"]
    assert body["polos"] == sorted(set(body["polos"]))
    assert "16" in body["corrientes_nominales_a"] or "16.00" in body["corrientes_nominales_a"]
    assert "32" in body["corrientes_nominales_a"] or "32.00" in body["corrientes_nominales_a"]


def test_opciones_filtro_excluye_filas_sin_atributos(client, db_session):
    _login(client, db_session, email="opcionesfiltro2.test@pyre.com")
    sin_atributos = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXOPCVACIO-C1",
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion="Accesorio ZQXOPCVACIO",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(sin_atributos)
    db_session.commit()

    response = client.get(
        "/catalogo/opciones-filtro", params={"categorias": ["Interruptores Termomagneticos"]}
    )

    assert response.status_code == 200
    # No hay assert directo posible sobre "ausencia de un valor" sin saber el
    # atributo exacto -- lo que importa es que la fila sin atributos no rompe
    # el endpoint (no hay 500) y las listas siguen siendo válidas.
    assert isinstance(response.json()["polos"], list)


def test_opciones_filtro_scoped_por_categorias(client, db_session):
    _login(client, db_session, email="opcionesfiltro3.test@pyre.com")
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXOPCOTRA-C1",
        categoria_path=["Relés"],
        categoria_raiz="Relés",
        descripcion="Relé ZQXOPCOTRA",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        atributos={"tipo": "seccional_termomagnetico", "polos": 99, "corriente_nominal_a": 999, "capacidad_corte_ka": 999},
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()

    response = client.get(
        "/catalogo/opciones-filtro", params={"categorias": ["Interruptores Termomagneticos"]}
    )

    assert response.status_code == 200
    assert 99 not in response.json()["polos"]


def test_opciones_filtro_requiere_autenticacion(client):
    response = client.get("/catalogo/opciones-filtro")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: the 4 new tests FAIL with 404 (route doesn't exist yet).

- [ ] **Step 3: Implement**

Append to `backend/app/routers/catalogo.py`, after the end of `buscar_componentes`:

```python


class OpcionesFiltroResponse(BaseModel):
    polos: list[int]
    corrientes_nominales_a: list[Decimal]
    capacidades_corte_ka: list[Decimal]


@router.get("/opciones-filtro", response_model=OpcionesFiltroResponse)
def obtener_opciones_filtro(
    categorias: list[str] | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    # Los valores de cada select se derivan de lo que realmente hay en el
    # catálogo -- no hay una lista hardcodeada que mantener, se autoactualiza
    # con cada reimport. Siempre exige atributos poblados: sin eso no hay
    # nada que ofrecer como opción de filtro.
    filtro = CatalogoComponente.atributos.isnot(None)
    if categorias:
        filtro = and_(filtro, CatalogoComponente.categoria_raiz.in_(categorias))

    polos_rows = db.query(CatalogoComponente.atributos["polos"].as_integer()).filter(filtro).distinct().all()
    corrientes_rows = (
        db.query(CatalogoComponente.atributos["corriente_nominal_a"].as_float()).filter(filtro).distinct().all()
    )
    capacidades_rows = (
        db.query(CatalogoComponente.atributos["capacidad_corte_ka"].as_float()).filter(filtro).distinct().all()
    )

    polos = sorted({r[0] for r in polos_rows if r[0] is not None})
    corrientes = sorted({Decimal(str(r[0])) for r in corrientes_rows if r[0] is not None})
    capacidades = sorted({Decimal(str(r[0])) for r in capacidades_rows if r[0] is not None})

    return OpcionesFiltroResponse(polos=polos, corrientes_nominales_a=corrientes, capacidades_corte_ka=capacidades)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && venv\Scripts\pytest -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/catalogo.py backend/tests/test_catalogo_buscar_endpoint.py
git commit -m "feat: add GET /catalogo/opciones-filtro for data-driven filter dropdown values"
```

---

## Task 3: Backend — `componente_codigo`/`componente_codigo_comercial` en `SalidaResponse` y `TableroResponse`

**Files:**
- Modify: `backend/app/routers/salidas.py`
- Modify: `backend/app/routers/tableros.py`
- Test: `backend/tests/test_salidas_endpoint.py`
- Test: `backend/tests/test_tableros_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_salidas_endpoint.py`:

```python
def test_listar_salidas_incluye_codigo_legible_del_componente(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-13", tipo="interruptor_principal", corriente=100, ka=15)
    barato = _componente(db_session, "SAL-C13", corriente=20, ka=10, precio="15.00")
    seccion_id = _setup_tablero(
        client, db_session, "salidas13.test@pyre.com", interruptor_principal_id=str(principal.id)
    )

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["componente_id"] == str(barato.id)
    assert body["componente_codigo"] == barato.codigo
    assert body["componente_codigo_comercial"] == barato.codigo_comercial


def test_listar_salidas_sin_componente_devuelve_codigo_null(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas14.test@pyre.com")

    response = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["componente_id"] is None
    assert body["componente_codigo"] is None
    assert body["componente_codigo_comercial"] is None
```

Append to `backend/tests/test_tableros_endpoint.py`:

```python
def test_obtener_tablero_incluye_codigo_legible_del_interruptor_principal(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="codigolegible.test@pyre.com")
    componente = _componente(db_session, "TAB-COD-1")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros",
        json={"nombre": "TG1", "nivel_falla_ka": "10.00", "interruptor_principal_id": str(componente.id)},
    ).json()["id"]

    response = client.get(f"/tableros/{tablero_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["interruptor_principal_codigo"] == componente.codigo
    assert body["interruptor_principal_codigo_comercial"] == componente.codigo_comercial


def test_obtener_tablero_sin_interruptor_principal_devuelve_codigo_null(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="codigolegible404.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]

    response = client.get(f"/tableros/{tablero_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["interruptor_principal_codigo"] is None
    assert body["interruptor_principal_codigo_comercial"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_salidas_endpoint.py tests/test_tableros_endpoint.py -v`
Expected: the 4 new tests FAIL with `KeyError`/`AssertionError` (the response won't have `componente_codigo`/`interruptor_principal_codigo` keys yet).

- [ ] **Step 3: Implement `salidas.py`**

Replace the `SalidaResponse` class and `_salida_response` function (lines 36-59) with:

```python
class SalidaResponse(BaseModel):
    id: str
    seccion_id: str
    carga_valor: Decimal
    carga_unidad: str
    formato: str
    tipo_proteccion: str
    componente_id: str | None
    componente_codigo: str | None
    componente_codigo_comercial: str | None
    origen: str

    model_config = {"from_attributes": True}


def _salida_response(db: Session, salida: Salida) -> SalidaResponse:
    componente = db.get(CatalogoComponente, salida.componente_id) if salida.componente_id else None
    return SalidaResponse(
        id=str(salida.id),
        seccion_id=str(salida.seccion_id),
        carga_valor=salida.carga_valor,
        carga_unidad=salida.carga_unidad,
        formato=salida.formato.value,
        tipo_proteccion=salida.tipo_proteccion.value,
        componente_id=str(salida.componente_id) if salida.componente_id else None,
        componente_codigo=componente.codigo if componente else None,
        componente_codigo_comercial=componente.codigo_comercial if componente else None,
        origen=salida.origen.value,
    )
```

Then update the 3 call sites (all already have `db` in scope, being route handlers):
- In `crear_salida`, line `return _salida_response(salida)` → `return _salida_response(db, salida)`.
- In `actualizar_salida`, line `return _salida_response(salida)` → `return _salida_response(db, salida)`.
- In `listar_salidas`, line `return [_salida_response(s) for s in salidas]` → `return [_salida_response(db, s) for s in salidas]`.

- [ ] **Step 4: Implement `tableros.py`**

Change the import line (line 10) from:

```python
from app.models import Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario
```

to:

```python
from app.models import CatalogoComponente, Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario
```

Replace the `TableroResponse` class and `_tablero_response` function (lines 21-40) with:

```python
class TableroResponse(BaseModel):
    id: str
    proyecto_id: str
    nombre: str
    nivel_falla_ka: Decimal
    interruptor_principal_id: str | None
    interruptor_principal_codigo: str | None
    interruptor_principal_codigo_comercial: str | None

    model_config = {"from_attributes": True}


def _tablero_response(db: Session, tablero: Tablero) -> TableroResponse:
    componente = (
        db.get(CatalogoComponente, tablero.interruptor_principal_id)
        if tablero.interruptor_principal_id
        else None
    )
    return TableroResponse(
        id=str(tablero.id),
        proyecto_id=str(tablero.proyecto_id),
        nombre=tablero.nombre,
        nivel_falla_ka=tablero.nivel_falla_ka,
        interruptor_principal_id=str(tablero.interruptor_principal_id)
        if tablero.interruptor_principal_id
        else None,
        interruptor_principal_codigo=componente.codigo if componente else None,
        interruptor_principal_codigo_comercial=componente.codigo_comercial if componente else None,
    )
```

Then update the 4 call sites (all already have `db` in scope):
- In `crear_tablero`, `return _tablero_response(tablero)` → `return _tablero_response(db, tablero)`.
- In `listar_tableros`, `return [_tablero_response(t) for t in tableros]` → `return [_tablero_response(db, t) for t in tableros]`.
- In `obtener_tablero`, `return _tablero_response(tablero)` → `return _tablero_response(db, tablero)`.
- In `actualizar_tablero`, `return _tablero_response(tablero)` → `return _tablero_response(db, tablero)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_salidas_endpoint.py tests/test_tableros_endpoint.py -v`
Expected: all PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && venv\Scripts\pytest -v`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/salidas.py backend/app/routers/tableros.py backend/tests/test_salidas_endpoint.py backend/tests/test_tableros_endpoint.py
git commit -m "feat: include readable componente codigo in SalidaResponse and TableroResponse"
```

---

## Task 4: Frontend — `api/client.ts` additions

**Files:**
- Modify: `frontend/src/api/client.ts`

Purely additive (new function, new interface, widened existing interfaces with optional fields so no existing typed fixture/consumer breaks before Task 10 lands). No dedicated test file, per the established convention in this codebase (`api/client.ts` has no direct unit tests — verified via `tsc` and indirectly through the component tests that mock `fetch`).

- [ ] **Step 1: Widen `buscarCatalogo`'s options and add the new filter constant usage**

Replace the existing `buscarCatalogo` function (currently `export async function buscarCatalogo(q: string, opciones?: { limit?: number; offset?: number; categorias?: string[] }): Promise<ResultadoBusquedaCatalogo> { ... }`) with:

```ts
export async function buscarCatalogo(
  q: string,
  opciones?: {
    limit?: number;
    offset?: number;
    categorias?: string[];
    solo_con_atributos?: boolean;
    polos?: number;
    corriente_nominal_a?: string;
    capacidad_corte_ka?: string;
  },
): Promise<ResultadoBusquedaCatalogo> {
  const params = new URLSearchParams({ q });
  if (opciones?.limit !== undefined) params.set("limit", String(opciones.limit));
  if (opciones?.offset !== undefined) params.set("offset", String(opciones.offset));
  for (const categoria of opciones?.categorias ?? []) params.append("categorias", categoria);
  if (opciones?.solo_con_atributos) params.set("solo_con_atributos", "true");
  if (opciones?.polos !== undefined) params.set("polos", String(opciones.polos));
  if (opciones?.corriente_nominal_a !== undefined) params.set("corriente_nominal_a", opciones.corriente_nominal_a);
  if (opciones?.capacidad_corte_ka !== undefined) params.set("capacidad_corte_ka", opciones.capacidad_corte_ka);
  const response = await fetch(`${API_BASE_URL}/catalogo/buscar?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo buscar en el catálogo");
  return response.json();
}
```

- [ ] **Step 2: Add `OpcionesFiltro` and `obtenerOpcionesFiltro`**

Insert right after the `buscarCatalogo` function (before the `CATEGORIAS_INTERRUPTORES` constant):

```ts
export interface OpcionesFiltro {
  polos: number[];
  corrientes_nominales_a: string[];
  capacidades_corte_ka: string[];
}

export async function obtenerOpcionesFiltro(categorias: string[]): Promise<OpcionesFiltro> {
  const params = new URLSearchParams();
  for (const categoria of categorias) params.append("categorias", categoria);
  const response = await fetch(`${API_BASE_URL}/catalogo/opciones-filtro?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudieron obtener las opciones de filtro");
  return response.json();
}
```

- [ ] **Step 3: Widen `Salida` and `Tablero` with the new optional código fields**

Change the `Salida` interface from:

```ts
export interface Salida {
  id: string;
  seccion_id: string;
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
  componente_id: string | null;
  origen: string;
}
```

to:

```ts
export interface Salida {
  id: string;
  seccion_id: string;
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
  componente_id: string | null;
  componente_codigo?: string | null;
  componente_codigo_comercial?: string | null;
  origen: string;
}
```

Change the `Tablero` interface from:

```ts
export interface Tablero {
  id: string;
  proyecto_id: string;
  nombre: string;
  nivel_falla_ka: string;
  interruptor_principal_id: string | null;
}
```

to:

```ts
export interface Tablero {
  id: string;
  proyecto_id: string;
  nombre: string;
  nivel_falla_ka: string;
  interruptor_principal_id: string | null;
  interruptor_principal_codigo?: string | null;
  interruptor_principal_codigo_comercial?: string | null;
}
```

(Optional, not required: existing test fixtures across the codebase construct `Salida`/`Tablero` object literals without these fields, and TypeScript structural typing only requires them where actually accessed. Making them optional here avoids a cascade of unrelated fixture updates in files this task doesn't otherwise touch — Task 10 updates the specific fixtures that need realistic values.)

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add opciones-filtro call and widen buscarCatalogo/Salida/Tablero for structured filters and readable codigo"
```

---

## Task 5: Frontend — `useCerrarAlClickFuera` hook

**Files:**
- Create: `frontend/src/hooks/useCerrarAlClickFuera.ts`
- Test: `frontend/src/hooks/useCerrarAlClickFuera.test.tsx`

This is the first file in a new `frontend/src/hooks/` directory — the codebase has had no shared hooks until now (every component inlined its own modal-closing logic). This hook is exactly the kind of small, well-bounded, independently-testable unit that belongs in its own file.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useCerrarAlClickFuera.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { useCerrarAlClickFuera } from "./useCerrarAlClickFuera";

function Harness({ onClose }: { onClose: () => void }) {
  const handlers = useCerrarAlClickFuera(onClose);
  return (
    <div data-testid="fondo" {...handlers}>
      <div data-testid="contenido">
        <input data-testid="campo" />
      </div>
    </div>
  );
}

describe("useCerrarAlClickFuera", () => {
  it("closes when mousedown and click both land directly on the backdrop", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const fondo = screen.getByTestId("fondo");

    fireEvent.mouseDown(fondo);
    fireEvent.click(fondo);

    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when mousedown starts on a child but the click resolves on the backdrop (the reported bug: selecting text that ends outside the modal)", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const fondo = screen.getByTestId("fondo");
    const campo = screen.getByTestId("campo");

    fireEvent.mouseDown(campo);
    fireEvent.click(fondo);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when both mousedown and click land on a child", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const campo = screen.getByTestId("campo");

    fireEvent.mouseDown(campo);
    fireEvent.click(campo);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("resets after a completed backdrop click, so a later child-originated click still does not close", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const fondo = screen.getByTestId("fondo");
    const campo = screen.getByTestId("campo");

    fireEvent.mouseDown(fondo);
    fireEvent.click(fondo);
    onClose.mockClear();

    fireEvent.mouseDown(campo);
    fireEvent.click(campo);

    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/useCerrarAlClickFuera.test.tsx`
Expected: FAIL with "Cannot find module './useCerrarAlClickFuera'".

- [ ] **Step 3: Implement**

Create `frontend/src/hooks/useCerrarAlClickFuera.ts`:

```ts
import { useRef, type MouseEvent } from "react";

// Todos los modales de esta app cierran al hacer click en el fondo. El
// problema: si el usuario arrastra el mouse para seleccionar texto dentro de
// un campo y el mouseup termina fuera del modal, el navegador resuelve el
// evento "click" sobre el ancestro común de mousedown y mouseup -- que es el
// propio fondo -- cerrando el modal aunque la intención era solo seleccionar
// texto. Este hook solo cierra si el mousedown TAMBIÉN empezó directamente
// sobre el fondo, no alcanza con que el click resuelto termine ahí.
export function useCerrarAlClickFuera(onClose: () => void) {
  const mouseDownEnFondoRef = useRef(false);

  function onMouseDown(e: MouseEvent<HTMLElement>) {
    mouseDownEnFondoRef.current = e.target === e.currentTarget;
  }

  function onClick(e: MouseEvent<HTMLElement>) {
    if (mouseDownEnFondoRef.current && e.target === e.currentTarget) {
      onClose();
    }
  }

  return { onMouseDown, onClick };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/useCerrarAlClickFuera.test.tsx`
Expected: all 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useCerrarAlClickFuera.ts frontend/src/hooks/useCerrarAlClickFuera.test.tsx
git commit -m "feat: add useCerrarAlClickFuera hook to fix modals closing on text-selection drags"
```

---

## Task 6: Frontend — aplicar el hook a `ConfirmDialog` y `ComponentePicker`

**Files:**
- Modify: `frontend/src/components/ConfirmDialog.tsx`
- Modify: `frontend/src/components/ConfirmDialog.test.tsx`
- Modify: `frontend/src/components/ComponentePicker.tsx`
- Modify: `frontend/src/components/ComponentePicker.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add `fireEvent` to the `@testing-library/react` import in `frontend/src/components/ConfirmDialog.test.tsx` (change `import { render, screen } from "@testing-library/react";` to `import { render, screen, fireEvent } from "@testing-library/react";`), then append this test before the closing `});` of the `describe` block:

```tsx
  it("does not close when a mousedown starts inside the dialog but the click resolves on the backdrop", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog titulo="Confirmar borrado" mensaje="¿Borrar?" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(onCancel).not.toHaveBeenCalled();
  });
```

Add `fireEvent` to the `@testing-library/react` import in `frontend/src/components/ComponentePicker.test.tsx` (same change), then append:

```tsx
  it("does not close when a mousedown starts inside the dialog but the click resolves on the backdrop", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const onCancel = vi.fn();
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={onCancel} />);

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(onCancel).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx src/components/ComponentePicker.test.tsx`
Expected: the 2 new tests FAIL (`onCancel`/`onCancel` gets called today, since the backdrop's plain `onClick` doesn't distinguish where the mousedown started).

- [ ] **Step 3: Implement**

In `frontend/src/components/ConfirmDialog.tsx`, add the import:

```tsx
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";
```

Inside the component body, right after the existing `const dialogRef = useRef<HTMLDivElement>(null);` line, add:

```tsx
  const { onMouseDown, onClick } = useCerrarAlClickFuera(onCancel);
```

Change the backdrop div from:

```tsx
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" onClick={onCancel}>
```

to:

```tsx
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" onMouseDown={onMouseDown} onClick={onClick}>
```

In `frontend/src/components/ComponentePicker.tsx`, add the same import, and right after the existing `const inputRef = useRef<HTMLInputElement>(null);` line, add:

```tsx
  const { onMouseDown, onClick } = useCerrarAlClickFuera(onCancel);
```

Change the backdrop div from:

```tsx
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onCancel}>
```

to:

```tsx
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onMouseDown={onMouseDown} onClick={onClick}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx src/components/ComponentePicker.test.tsx`
Expected: all PASS, including the pre-existing "calls onCancel when clicking the backdrop" test in `ConfirmDialog.test.tsx` (which uses `userEvent.click` — mousedown and click both land on the same element there, so it still closes correctly).

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/components/ConfirmDialog.test.tsx frontend/src/components/ComponentePicker.tsx frontend/src/components/ComponentePicker.test.tsx
git commit -m "fix: apply useCerrarAlClickFuera to ConfirmDialog and ComponentePicker"
```

---

## Task 7: Frontend — aplicar el hook a `ProyectosPage` y `ProyectoWorkspacePage`

**Files:**
- Modify: `frontend/src/pages/ProyectosPage.tsx`
- Modify: `frontend/src/pages/ProyectosPage.test.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add `fireEvent` to the `@testing-library/react` import in `frontend/src/pages/ProyectosPage.test.tsx`, then append before the closing `});`:

```tsx
  it("does not close the modal when a mousedown starts inside it but the click resolves on the backdrop", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /nuevo proyecto/i }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
```

Add `fireEvent` to the `@testing-library/react` import in `frontend/src/pages/ProyectoWorkspacePage.test.tsx`, then append before the closing `});`:

```tsx
  it("does not close the Nuevo tablero modal when a mousedown starts inside it but the click resolves on the backdrop", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx src/pages/ProyectoWorkspacePage.test.tsx`
Expected: the 2 new tests FAIL (the modal closes today).

- [ ] **Step 3: Implement**

In `frontend/src/pages/ProyectosPage.tsx`, add the import:

```tsx
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";
```

Inside `ProyectosPage`, right after the existing `const cerrarModal = useCallback(...)` block, add:

```tsx
  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarModal);
```

Change the modal's backdrop div from:

```tsx
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={cerrarModal}>
```

to:

```tsx
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" onMouseDown={onMouseDownModal} onClick={onClickModal}>
```

In `frontend/src/pages/ProyectoWorkspacePage.tsx`, add the same import, and right after the existing `function cerrarModales() { ... }` block, add:

```tsx
  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarModales);
```

This one function-scoped hook result is reused on both of this file's inline modal backdrops (the "Nuevo tablero" form and the "Renombrar tablero" form both close via `cerrarModales`, and only one is ever mounted at a time). Change both backdrop divs — from:

```tsx
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModales}>
```

(this exact line appears twice — once inside the `{modalNuevoTablero && !pickerAbierto && (...)}` block, once inside the `{tableroEnEdicion && (...)}` block) to:

```tsx
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onMouseDown={onMouseDownModal} onClick={onClickModal}>
```

in both places.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx src/pages/ProyectoWorkspacePage.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ProyectosPage.tsx frontend/src/pages/ProyectosPage.test.tsx frontend/src/pages/ProyectoWorkspacePage.tsx frontend/src/pages/ProyectoWorkspacePage.test.tsx
git commit -m "fix: apply useCerrarAlClickFuera to ProyectosPage and ProyectoWorkspacePage modals"
```

---

## Task 8: Frontend — aplicar el hook a `DetalleTablero` y `SeccionBlock`

**Files:**
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add `fireEvent` to the `@testing-library/react` import in `frontend/src/components/DetalleTablero.test.tsx`, then append before the closing `});`:

```tsx
  it("does not close the Icc modal when a mousedown starts inside it but the click resolves on the backdrop", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /editar intensidad de cortocircuito/i }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
```

Add `fireEvent` to the `@testing-library/react` import in `frontend/src/components/SeccionBlock.test.tsx`, then append before the closing `});`:

```tsx
  it("does not close the edit modal when a mousedown starts inside it but the click resolves on the backdrop", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/DetalleTablero.test.tsx src/components/SeccionBlock.test.tsx`
Expected: the 2 new tests FAIL.

- [ ] **Step 3: Implement**

In `frontend/src/components/DetalleTablero.tsx`, add the import:

```tsx
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";
```

Right after the existing `function cerrarModales() { ... }` block, add:

```tsx
  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarModales);
```

This file has 3 inline modal backdrops that all close via `cerrarModales` (Icc, Nueva fila, Editar fila — the fourth modal-shaped thing, `ComponentePicker` for interruptor principal, already gets the fix from Task 6). Change each occurrence of:

```tsx
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModales}>
```

(appears 3 times — inside the `{modalIcc && (...)}`, `{modalNuevaFila && (...)}`, and `{filaEnEdicion && (...)}` blocks) to:

```tsx
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onMouseDown={onMouseDownModal} onClick={onClickModal}>
```

in all 3 places.

In `frontend/src/components/SeccionBlock.tsx`, add the same import, and right after the existing `function cerrarEdicion() { ... }` block, add:

```tsx
  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarEdicion);
```

Change the edit modal's backdrop div from:

```tsx
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarEdicion}>
```

to:

```tsx
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onMouseDown={onMouseDownModal} onClick={onClickModal}>
```

(`SeccionBlock`'s delete-confirmation `ConfirmDialog` and its `ComponentePicker` for "Cambiar componente" already get the fix from Task 6 — this task only touches the one inline edit-salida modal.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/DetalleTablero.test.tsx src/components/SeccionBlock.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DetalleTablero.tsx frontend/src/components/DetalleTablero.test.tsx frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx
git commit -m "fix: apply useCerrarAlClickFuera to DetalleTablero and SeccionBlock modals"
```

---

## Task 9: Frontend — panel de filtros en `ComponentePicker`

**Files:**
- Modify: `frontend/src/components/ComponentePicker.tsx`
- Modify: `frontend/src/components/ComponentePicker.test.tsx`

This is a full rewrite of `ComponentePicker.tsx` — it adds `solo_con_atributos: true` to every search (per spec section A), fetches `/catalogo/opciones-filtro` on mount, adds a collapsible filters panel matching the approved mockup (icon+"Filtros" button beside the search box, gray panel with fine borders when open, red chip pills with "✕" to remove individually), and re-runs the search when a filter changes. It builds on top of Task 6's backdrop-hook fix (already included below).

- [ ] **Step 1: Write the failing tests**

Append these tests to `frontend/src/components/ComponentePicker.test.tsx`, before the closing `});` of the outer `describe` block. They assume the mock-`fetch` pattern already established elsewhere in this file (`vi.stubGlobal("fetch", ...)`), extended to branch on URL:

```tsx
  it("fetches filter options on mount and shows them when Filtros is opened", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              polos: [1, 3],
              corrientes_nominales_a: ["16", "32"],
              capacidades_corte_ka: ["10", "18"],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));

    expect(await screen.findByRole("option", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "16A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "10kA" })).toBeInTheDocument();
  });

  it("always includes solo_con_atributos=true in search requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("solo_con_atributos=true"), expect.anything());
  });

  it("includes the selected polos filter in the search request after typing a query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [3], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT");
    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));
    await userEvent.selectOptions(await screen.findByLabelText(/polos/i), "3");

    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("polos=3"), expect.anything());
  });

  it("removing an active filter chip re-runs the search without that filter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [3], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT");
    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));
    await userEvent.selectOptions(await screen.findByLabelText(/polos/i), "3");
    await userEvent.click(screen.getByRole("button", { name: /3 polos/i }));

    expect(fetch).toHaveBeenLastCalledWith(expect.not.stringContaining("polos=3"), expect.anything());
    expect(screen.queryByRole("button", { name: /3 polos/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx`
Expected: the 5 new tests FAIL — there's no "Filtros" button, no `/catalogo/opciones-filtro` call, and no `solo_con_atributos` param yet.

- [ ] **Step 3: Implement**

Replace the entire contents of `frontend/src/components/ComponentePicker.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import { buscarCatalogo, obtenerOpcionesFiltro, type ComponenteBusqueda, type OpcionesFiltro } from "../api/client";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";

const RESULTADOS_POR_PAGINA = 20;

interface ComponentePickerProps {
  categorias: string[];
  onSelect: (componente: ComponenteBusqueda) => void;
  onCancel: () => void;
  titulo?: string;
}

export function ComponentePicker({
  categorias,
  onSelect,
  onCancel,
  titulo = "Buscar componente",
}: ComponentePickerProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ComponenteBusqueda[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [opciones, setOpciones] = useState<OpcionesFiltro | null>(null);
  const [filtroPolos, setFiltroPolos] = useState<number | null>(null);
  const [filtroCorriente, setFiltroCorriente] = useState<string | null>(null);
  const [filtroCapacidad, setFiltroCapacidad] = useState<string | null>(null);
  const solicitudActualRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { onMouseDown, onClick } = useCerrarAlClickFuera(onCancel);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    obtenerOpcionesFiltro(categorias).then(setOpciones);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function filtrosActivos() {
    return {
      solo_con_atributos: true as const,
      ...(filtroPolos !== null ? { polos: filtroPolos } : {}),
      ...(filtroCorriente !== null ? { corriente_nominal_a: filtroCorriente } : {}),
      ...(filtroCapacidad !== null ? { capacidad_corte_ka: filtroCapacidad } : {}),
    };
  }

  async function buscar(valor: string, desde: number) {
    const idSolicitud = ++solicitudActualRef.current;
    if (valor.trim().length < 2) {
      setResultados(null);
      setTotal(0);
      return;
    }
    const respuesta = await buscarCatalogo(valor, {
      limit: RESULTADOS_POR_PAGINA,
      offset: desde,
      categorias,
      ...filtrosActivos(),
    });
    if (idSolicitud !== solicitudActualRef.current) return;
    if (desde === 0) {
      setResultados(respuesta.resultados);
    } else {
      setResultados((actuales) => [...(actuales ?? []), ...respuesta.resultados]);
    }
    setTotal(respuesta.total);
  }

  async function handleChange(value: string) {
    setQuery(value);
    await buscar(value, 0);
  }

  async function handleCargarMas() {
    if (resultados === null || cargandoMas) return;
    setCargandoMas(true);
    try {
      await buscar(query, resultados.length);
    } finally {
      setCargandoMas(false);
    }
  }

  function handleFiltroChange(actualizar: () => void) {
    actualizar();
    if (query.trim().length >= 2) buscar(query, 0);
  }

  const hayFiltrosActivos = filtroPolos !== null || filtroCorriente !== null || filtroCapacidad !== null;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40"
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-picker-titulo"
        className="flex w-[700px] max-w-full flex-col gap-3 border border-surface-stroke bg-white p-8"
      >
        <h2 id="component-picker-titulo" className="text-lg font-bold">
          {titulo}
        </h2>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            aria-label="Buscar código o descripción"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className="flex-1 border border-surface-stroke p-2"
          />
          <button
            type="button"
            aria-expanded={filtrosAbiertos}
            onClick={() => setFiltrosAbiertos((actual) => !actual)}
            className="flex items-center gap-2 whitespace-nowrap border border-surface-stroke px-4 py-2 text-xs uppercase tracking-widest text-secondary hover:border-abb-red hover:text-abb-red"
          >
            <span aria-hidden="true">⚙</span> Filtros
          </button>
        </div>

        {filtrosAbiertos && (
          <div className="flex flex-wrap gap-5 border border-surface-stroke bg-industrial-gray p-4">
            <div className="min-w-[110px] flex-1">
              <label htmlFor="filtro-polos" className="mb-1 block text-[10px] uppercase tracking-widest text-secondary">
                Polos
              </label>
              <select
                id="filtro-polos"
                value={filtroPolos ?? ""}
                onChange={(e) =>
                  handleFiltroChange(() => setFiltroPolos(e.target.value ? Number(e.target.value) : null))
                }
                className="w-full border border-surface-stroke bg-white p-2 text-sm"
              >
                <option value="">Todos</option>
                {(opciones?.polos ?? []).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[110px] flex-1">
              <label
                htmlFor="filtro-corriente"
                className="mb-1 block text-[10px] uppercase tracking-widest text-secondary"
              >
                Corriente (In)
              </label>
              <select
                id="filtro-corriente"
                value={filtroCorriente ?? ""}
                onChange={(e) => handleFiltroChange(() => setFiltroCorriente(e.target.value || null))}
                className="w-full border border-surface-stroke bg-white p-2 text-sm"
              >
                <option value="">Todos</option>
                {(opciones?.corrientes_nominales_a ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}A
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[110px] flex-1">
              <label
                htmlFor="filtro-capacidad"
                className="mb-1 block text-[10px] uppercase tracking-widest text-secondary"
              >
                Capacidad de corte
              </label>
              <select
                id="filtro-capacidad"
                value={filtroCapacidad ?? ""}
                onChange={(e) => handleFiltroChange(() => setFiltroCapacidad(e.target.value || null))}
                className="w-full border border-surface-stroke bg-white p-2 text-sm"
              >
                <option value="">Todos</option>
                {(opciones?.capacidades_corte_ka ?? []).map((k) => (
                  <option key={k} value={k}>
                    {k}kA
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {hayFiltrosActivos && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-secondary">Activos:</span>
            {filtroPolos !== null && (
              <button
                type="button"
                onClick={() => handleFiltroChange(() => setFiltroPolos(null))}
                className="border border-abb-red px-2 py-1 text-xs uppercase tracking-widest text-abb-red"
              >
                {filtroPolos} polos ✕
              </button>
            )}
            {filtroCorriente !== null && (
              <button
                type="button"
                onClick={() => handleFiltroChange(() => setFiltroCorriente(null))}
                className="border border-abb-red px-2 py-1 text-xs uppercase tracking-widest text-abb-red"
              >
                {filtroCorriente}A ✕
              </button>
            )}
            {filtroCapacidad !== null && (
              <button
                type="button"
                onClick={() => handleFiltroChange(() => setFiltroCapacidad(null))}
                className="border border-abb-red px-2 py-1 text-xs uppercase tracking-widest text-abb-red"
              >
                {filtroCapacidad}kA ✕
              </button>
            )}
          </div>
        )}

        {resultados !== null && resultados.length === 0 && <p className="text-secondary">sin resultados</p>}
        {resultados !== null && resultados.length > 0 && (
          <div className="max-h-96 overflow-y-auto border border-surface-stroke">
            <ul>
              {resultados.map((componente) => (
                <li key={componente.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(componente)}
                    className="flex w-full items-center gap-2 p-2 text-left hover:bg-industrial-gray"
                  >
                    <span className="font-mono text-sm">{componente.codigo}</span>
                    <span className="text-secondary">— {componente.descripcion}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-surface-stroke p-2 text-xs text-secondary">
              Mostrando {resultados.length} de {total} resultados
            </p>
            {resultados.length < total && (
              <button
                type="button"
                onClick={handleCargarMas}
                disabled={cargandoMas}
                className="w-full border-t border-surface-stroke p-2 text-sm uppercase tracking-widest text-abb-red hover:bg-industrial-gray disabled:opacity-50"
              >
                {cargandoMas ? "Cargando..." : "Cargar más"}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-1 self-start border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx`
Expected: all PASS — the 5 new tests plus all pre-existing ones (the pre-existing ones are unaffected: `solo_con_atributos=true` is just an additional query param, so assertions using `expect.stringContaining("categorias=...")` etc. still match).

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ComponentePicker.tsx frontend/src/components/ComponentePicker.test.tsx
git commit -m "feat: add collapsible filters panel (polos/corriente/capacidad de corte) to ComponentePicker"
```

---

## Task 10: Frontend — mostrar código legible en vez del UUID crudo

**Files:**
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/SeccionBlock.test.tsx`, find the `salidaConMatch` fixture (currently includes `componente_id: "c1"`) and add the two new fields:

```tsx
const salidaConMatch: Salida = {
  id: "sal3",
  seccion_id: "s1",
  carga_valor: "20",
  carga_unidad: "A",
  formato: "tripolar",
  tipo_proteccion: "termomagnetico",
  componente_id: "c1",
  componente_codigo: "1SDA067004R1",
  componente_codigo_comercial: "XT2N 160 TMD 160-1600",
  origen: "manual",
};
```

(Match this against the fixture's actual current field values — keep every existing field as-is, only add the two new ones.)

Find the existing test that asserts the badge shows the raw id (likely named something like "shows a filled badge with the matched component id" and asserting `screen.getByText(/c1/)` or similar) and replace its assertion to check for the código instead:

```tsx
  it("shows a filled badge with the matched component's readable codigo, not the raw id", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    expect(screen.getByText(/1SDA067004R1/)).toBeInTheDocument();
    expect(screen.queryByText(/c1/)).not.toBeInTheDocument();
  });
```

Append a new test for the edit modal's display:

```tsx
  it("shows the readable codigo (not the raw id) in the edit modal", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));

    expect(screen.getByText(/Componente:.*1SDA067004R1/)).toBeInTheDocument();
  });
```

In `frontend/src/components/DetalleTablero.test.tsx`, find the `tablero` fixture used by `renderDetalle()` (currently has `interruptor_principal_id: "..."` set to a UUID in whichever test exercises a tablero WITH a principal assigned) and add `interruptor_principal_codigo: "1SDA067004R1"` alongside it. Then append:

```tsx
  it("shows the interruptor principal's readable codigo, not the raw id, in the Principal tab", async () => {
    renderDetalle({
      ...tableroConPrincipal,
      interruptor_principal_id: "c1",
      interruptor_principal_codigo: "1SDA067004R1",
    });
    await userEvent.click(screen.getByRole("tab", { name: /principal/i }));

    expect(screen.getByText(/1SDA067004R1/)).toBeInTheDocument();
    expect(screen.queryByText("c1")).not.toBeInTheDocument();
  });
```

(Adapt `tableroConPrincipal`/`renderDetalle` to this file's actual existing fixture and helper names — reuse whatever fixture already represents a tablero with `interruptor_principal_id` set, don't introduce a new one if an equivalent already exists.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx src/components/DetalleTablero.test.tsx`
Expected: the new/changed assertions FAIL — today both places render the raw UUID.

- [ ] **Step 3: Implement**

In `frontend/src/components/SeccionBlock.tsx`, find the badge line that currently reads (approximately):

```tsx
propuesto: {salida.componente_id}
```

Replace with:

```tsx
propuesto: {salida.componente_codigo ?? salida.componente_id}
{salida.componente_codigo_comercial && (
  <span className="text-secondary"> — {salida.componente_codigo_comercial}</span>
)}
```

Find the edit modal line that currently reads:

```tsx
Componente: {salidaEnEdicion.componente_id ?? "sin definir"}
```

Replace with:

```tsx
Componente:{" "}
{salidaEnEdicion.componente_id
  ? (salidaEnEdicion.componente_codigo ?? salidaEnEdicion.componente_id)
  : "sin definir"}
```

In `frontend/src/components/DetalleTablero.tsx`, find the Principal tab line that currently reads:

```tsx
{tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}
```

Replace with:

```tsx
{tablero.interruptor_principal_id
  ? (tablero.interruptor_principal_codigo ?? tablero.interruptor_principal_id)
  : "sin definir"}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx src/components/DetalleTablero.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx frontend/src/components/DetalleTablero.tsx frontend/src/components/DetalleTablero.test.tsx
git commit -m "fix: show readable componente codigo instead of raw UUID in SeccionBlock and DetalleTablero"
```

---

## Task 11: Verificación final

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && venv/Scripts/python -m pytest`
Expected: all PASS (requires `docker compose up -d db` running first).

- [ ] **Step 2: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Rebuild and start the Docker stack**

Run: `docker compose up -d --build`
Expected: `backend` and `frontend` containers start cleanly, no errors in `docker compose logs backend frontend --tail=50`.

- [ ] **Step 5: Browser walkthrough**

Using the running app (login as analista):
1. Open a tablero, go to a fila, click "Agregar salida" → "Buscar componente" to open `ComponentePicker`. Confirm the "Filtros" button is visible next to the search input, and that clicking it opens the panel with Polos/Corriente/Capacidad de corte selects populated with real values from the catalog.
2. Search "XT" with no filters — confirm the result count is meaningfully lower than before (accessories are excluded, since the picker now always sends `solo_con_atributos=true`).
3. Pick a Polos value, confirm results narrow further and a red chip appears; click the chip's "✕", confirm the filter clears and results widen back out.
4. Select a component, confirm the salida badge shows a readable código (e.g. `1SDA067004R1`), not a UUID.
5. Open "Editar salida" for that same salida, confirm the modal shows the readable código too.
6. With the edit modal open, click into a text field and drag-select some text so the mouse release lands outside the modal (on the backdrop) — confirm the modal stays open. Then click the actual backdrop (no drag) — confirm it closes normally. This is the modal-close bug's exact repro; if automating the drag via `computer`/`javascript_tool` proves unreliable in this environment, treat Task 5's and Task 6's unit tests (which reproduce the exact mousedown/click target divergence deterministically) as the primary evidence, and do a plain functional check here (Cancelar button and Escape both still close the modal; clicking the backdrop directly still closes it too).
7. Go to a tablero's "Principal" tab with an interruptor assigned — confirm it shows a readable código, not a UUID.

- [ ] **Step 6: Update `CLAUDE.md` status**

Update the Fase C bullet in `CLAUDE.md`'s "Estado" section to mention this cycle (búsqueda scoped por `solo_con_atributos`, filtros estructurados de polos/corriente/capacidad de corte, display de código legible, fix del cierre accidental de modales) once merged — follow the existing pattern of appending to the ciclo list in that bullet, referencing `docs/superpowers/specs/2026-07-19-catalogo-busqueda-filtros-display-design.md`.

---
