# CRUD faltante + reestructuración a "Filas" + buscador mejorado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing CRUD (edit/delete) at the proyecto/tablero/fila/salida levels with cascade-aware confirmation, rename "Sección" to "Fila" in the UI with interruptor principal as the first pseudo-fila tab, turn `ComponentePicker` into a self-contained modal with a required category filter, and apply the agreed visual polish (Icc→"Intensidad de Cortocircuito", neutral icon color).

**Architecture:** Backend routers gain `PATCH`/`DELETE` endpoints with manually-coded cascade deletes (no DB-level `ON DELETE CASCADE` exists in this schema). `ComponentePicker` becomes a self-contained modal (trigger lives in the parent, the component itself renders the dialog) requiring a `categorias: string[]` prop that maps to a new `categorias` query param on `/catalogo/buscar`. A new `ConfirmDialog` component is shared across all 4 delete confirmations. `DetalleTablero` gets a "Principal" pseudo-tab prepended to the existing fila tablist.

**Tech Stack:** Python/FastAPI + SQLAlchemy 2.0 + pytest (backend); React 19/TypeScript + Vite + Vitest + Testing Library (frontend).

Spec: `docs/superpowers/specs/2026-07-18-workspace-crud-filas-design.md`

---

## Task 1: Backend — `PATCH`/`DELETE /proyectos/{id}` con cascada completa

**Files:**
- Modify: `backend/app/routers/proyectos.py`
- Test: `backend/tests/test_proyectos_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_proyectos_endpoint.py`:

```python
def test_patch_proyecto_actualiza_nombre_y_cliente(client, db_session):
    _login(client, db_session, email="patchproyecto.test@pyre.com")
    proyecto_id = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "Original"}).json()["id"]

    response = client.patch(f"/proyectos/{proyecto_id}", json={"nombre": "Renombrado", "cliente": "Cliente B"})

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Renombrado"
    assert body["cliente"] == "Cliente B"


def test_patch_proyecto_inexistente_devuelve_404(client, db_session):
    import uuid

    _login(client, db_session, email="patchproyecto404.test@pyre.com")

    response = client.patch(f"/proyectos/{uuid.uuid4()}", json={"nombre": "X"})

    assert response.status_code == 404


def test_delete_proyecto_borra_tableros_secciones_y_salidas_en_cascada(client, db_session):
    import uuid

    from app.models import Salida

    _login(client, db_session, email="deleteproyecto.test@pyre.com")
    proyecto_id = client.post("/proyectos", json={"cliente": "Cliente A", "nombre": "A borrar"}).json()["id"]
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.delete(f"/proyectos/{proyecto_id}")

    assert response.status_code == 204
    assert client.get(f"/proyectos/{proyecto_id}").status_code == 404
    assert client.get(f"/tableros/{tablero_id}").status_code == 404
    assert client.get(f"/tableros/{tablero_id}/secciones").status_code == 404
    assert db_session.get(Salida, uuid.UUID(salida_id)) is None


def test_delete_proyecto_inexistente_devuelve_404(client, db_session):
    import uuid

    _login(client, db_session, email="deleteproyecto404.test@pyre.com")

    response = client.delete(f"/proyectos/{uuid.uuid4()}")

    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_proyectos_endpoint.py -v`
Expected: the 4 new tests FAIL (404/405, since no `PATCH`/`DELETE` route exists yet).

- [ ] **Step 3: Implement `PATCH`/`DELETE /proyectos/{id}`**

In `backend/app/routers/proyectos.py`, change the import line (line 9) from:

```python
from app.models import Proyecto, RolUsuario, Usuario
```

to:

```python
from app.models import Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario
```

Then append at the end of the file (after `obtener_proyecto`):

```python


class ProyectoUpdate(BaseModel):
    nombre: str | None = None
    cliente: str | None = None


@router.patch("/{proyecto_id}", response_model=ProyectoResponse)
def actualizar_proyecto(
    proyecto_id: uuid.UUID,
    payload: ProyectoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        proyecto.nombre = cambios["nombre"]
    if "cliente" in cambios:
        proyecto.cliente = cambios["cliente"]

    db.commit()
    db.refresh(proyecto)
    return _to_response(proyecto)


@router.delete("/{proyecto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_proyecto(
    proyecto_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    # No hay ondelete="CASCADE" en el esquema -- el borrado en cascada se hace
    # a mano acá, en orden hijo-a-padre, dentro de la misma transacción.
    tablero_ids = [t.id for t in db.query(Tablero.id).filter(Tablero.proyecto_id == proyecto_id)]
    if tablero_ids:
        seccion_ids = [s.id for s in db.query(Seccion.id).filter(Seccion.tablero_id.in_(tablero_ids))]
        if seccion_ids:
            db.query(Salida).filter(Salida.seccion_id.in_(seccion_ids)).delete(synchronize_session=False)
            db.query(Seccion).filter(Seccion.id.in_(seccion_ids)).delete(synchronize_session=False)
        db.query(Tablero).filter(Tablero.id.in_(tablero_ids)).delete(synchronize_session=False)

    db.delete(proyecto)
    db.commit()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_proyectos_endpoint.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/proyectos.py backend/tests/test_proyectos_endpoint.py
git commit -m "feat: add PATCH/DELETE /proyectos/{id} with manual cascade delete"
```

---

## Task 2: Backend — `PATCH` nombre + `DELETE /tableros/{id}` con cascada

**Files:**
- Modify: `backend/app/routers/tableros.py`
- Test: `backend/tests/test_tableros_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_tableros_endpoint.py`:

```python
def test_patch_tablero_actualiza_nombre(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="patchnombretablero.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]

    response = client.patch(f"/tableros/{tablero_id}", json={"nombre": "TG1 renombrado"})

    assert response.status_code == 200
    assert response.json()["nombre"] == "TG1 renombrado"


def test_delete_tablero_borra_secciones_y_salidas_en_cascada(client, db_session):
    import uuid

    from app.models import Salida

    proyecto_id = _proyecto(client, db_session, email="deletetablero.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.delete(f"/tableros/{tablero_id}")

    assert response.status_code == 204
    assert client.get(f"/tableros/{tablero_id}").status_code == 404
    assert db_session.get(Salida, uuid.UUID(salida_id)) is None


def test_delete_tablero_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="deletetablero404.test@pyre.com")

    response = client.delete(f"/tableros/{uuid.uuid4()}")

    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_tableros_endpoint.py -v`
Expected: the 3 new tests FAIL.

- [ ] **Step 3: Implement**

In `backend/app/routers/tableros.py`, change the import line (line 10) from:

```python
from app.models import Proyecto, RolUsuario, Seccion, Tablero, Usuario
```

to:

```python
from app.models import Proyecto, RolUsuario, Salida, Seccion, Tablero, Usuario
```

Replace the existing `TableroUpdate` class and `actualizar_tablero` function with:

```python
class TableroUpdate(BaseModel):
    nombre: str | None = None
    nivel_falla_ka: Decimal | None = None
    interruptor_principal_id: uuid.UUID | None = None


@router.patch("/tableros/{tablero_id}", response_model=TableroResponse)
def actualizar_tablero(
    tablero_id: uuid.UUID,
    payload: TableroUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")

    # exclude_unset: un PATCH solo toca los campos que el cliente mandó — mandar
    # nivel_falla_ka sin interruptor_principal_id no debe borrar este último.
    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        tablero.nombre = cambios["nombre"]
    if "nivel_falla_ka" in cambios:
        tablero.nivel_falla_ka = cambios["nivel_falla_ka"]
    if "interruptor_principal_id" in cambios:
        tablero.interruptor_principal_id = cambios["interruptor_principal_id"]

    db.commit()
    db.refresh(tablero)
    return _tablero_response(tablero)


@router.delete("/tableros/{tablero_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tablero(
    tablero_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")

    seccion_ids = [s.id for s in db.query(Seccion.id).filter(Seccion.tablero_id == tablero_id)]
    if seccion_ids:
        db.query(Salida).filter(Salida.seccion_id.in_(seccion_ids)).delete(synchronize_session=False)
        db.query(Seccion).filter(Seccion.id.in_(seccion_ids)).delete(synchronize_session=False)

    db.delete(tablero)
    db.commit()
```

(This replaces the old `TableroUpdate`/`actualizar_tablero` block that sat between `obtener_tablero` and the `SeccionCreate` class — just add `nombre` handling and the new `DELETE` route; don't touch `crear_tablero`, `listar_tableros`, or `obtener_tablero`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_tableros_endpoint.py -v`
Expected: all PASS (including the 3 pre-existing `PATCH` tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/tableros.py backend/tests/test_tableros_endpoint.py
git commit -m "feat: add tablero nombre editing and DELETE with manual cascade"
```

---

## Task 3: Backend — `PATCH`/`DELETE /secciones/{id}` con cascada

**Files:**
- Modify: `backend/app/routers/tableros.py`
- Test: `backend/tests/test_tableros_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_tableros_endpoint.py`:

```python
def test_patch_seccion_actualiza_nombre(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="patchseccion.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]

    response = client.patch(f"/secciones/{seccion_id}", json={"nombre": "Fila renombrada"})

    assert response.status_code == 200
    assert response.json()["nombre"] == "Fila renombrada"


def test_patch_seccion_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="patchseccion404.test@pyre.com")

    response = client.patch(f"/secciones/{uuid.uuid4()}", json={"nombre": "X"})

    assert response.status_code == 404


def test_delete_seccion_borra_sus_salidas(client, db_session):
    import uuid

    from app.models import Salida

    proyecto_id = _proyecto(client, db_session, email="deleteseccion.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    seccion_id = client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección 1"}).json()["id"]
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.delete(f"/secciones/{seccion_id}")

    assert response.status_code == 204
    assert db_session.get(Salida, uuid.UUID(salida_id)) is None
    assert client.get(f"/secciones/{seccion_id}/salidas").status_code == 404


def test_delete_seccion_inexistente_devuelve_404(client, db_session):
    import uuid

    _proyecto(client, db_session, email="deleteseccion404.test@pyre.com")

    response = client.delete(f"/secciones/{uuid.uuid4()}")

    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_tableros_endpoint.py -v`
Expected: the 4 new tests FAIL.

- [ ] **Step 3: Implement**

Append to the end of `backend/app/routers/tableros.py` (after `listar_secciones`):

```python


class SeccionUpdate(BaseModel):
    nombre: str | None = None


@router.patch("/secciones/{seccion_id}", response_model=SeccionResponse)
def actualizar_seccion(
    seccion_id: uuid.UUID,
    payload: SeccionUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")

    cambios = payload.model_dump(exclude_unset=True)
    if "nombre" in cambios:
        seccion.nombre = cambios["nombre"]

    db.commit()
    db.refresh(seccion)
    return _seccion_response(seccion)


@router.delete("/secciones/{seccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_seccion(
    seccion_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")

    db.query(Salida).filter(Salida.seccion_id == seccion_id).delete(synchronize_session=False)
    db.delete(seccion)
    db.commit()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_tableros_endpoint.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/tableros.py backend/tests/test_tableros_endpoint.py
git commit -m "feat: add PATCH/DELETE /secciones/{id} with manual cascade delete"
```

---

## Task 4: Backend — `PATCH` extendido + `DELETE /salidas/{id}`

**Files:**
- Modify: `backend/app/routers/salidas.py`
- Test: `backend/tests/test_salidas_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_salidas_endpoint.py`:

```python
def test_patch_salida_recalcula_cuando_cambia_la_carga(client, db_session):
    principal = _componente(db_session, "SAL-PRINC-7", tipo="interruptor_principal", corriente=100, ka=15)
    seccion_id = _setup_tablero(
        client, db_session, "salidas7.test@pyre.com", interruptor_principal_id=str(principal.id)
    )
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "10",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_valor": "30"})

    assert response.status_code == 200
    assert response.json()["carga_valor"] == "30.00"


def test_patch_salida_con_componente_id_explicito_no_recalcula(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas8.test@pyre.com")
    manual = _componente(db_session, "SAL-C8", corriente=20, ka=10)
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(
        f"/salidas/{salida_id}", json={"carga_valor": "30", "componente_id": str(manual.id)}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["componente_id"] == str(manual.id)
    assert body["carga_valor"] == "30.00"


def test_patch_salida_con_unidad_invalida_devuelve_400(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas11.test@pyre.com")
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.patch(f"/salidas/{salida_id}", json={"carga_unidad": "V"})

    assert response.status_code == 400


def test_delete_salida(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas9.test@pyre.com")
    salida_id = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "16",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()["id"]

    response = client.delete(f"/salidas/{salida_id}")

    assert response.status_code == 204
    assert client.get(f"/secciones/{seccion_id}/salidas").json() == []


def test_delete_salida_inexistente_devuelve_404(client, db_session):
    import uuid

    _setup_tablero(client, db_session, "salidas10.test@pyre.com")

    response = client.delete(f"/salidas/{uuid.uuid4()}")

    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_salidas_endpoint.py -v`
Expected: the 5 new tests FAIL.

- [ ] **Step 3: Implement**

Replace the full content of `backend/app/routers/salidas.py` with:

```python
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import (
    CatalogoComponente,
    FormatoPolos,
    OrigenSalida,
    RolUsuario,
    Salida,
    Seccion,
    Tablero,
    TipoProteccion,
    Usuario,
)
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


def _proponer_componente_para_salida(
    db: Session,
    tablero: Tablero,
    tipo_proteccion: TipoProteccion,
    formato: FormatoPolos,
    carga_valor: Decimal,
    carga_unidad: str,
    parametros,
) -> uuid.UUID | None:
    # Puede levantar ValueError (ej. unidad de carga inválida) -- el caller la
    # traduce a un 400. Compartida por crear_salida y actualizar_salida para
    # no duplicar la lógica de propuesta cuando cambia la carga/formato.
    corriente_nominal = calcular_corriente_nominal(carga_valor, carga_unidad, formato, parametros)

    if tablero.interruptor_principal_id is None:
        return None
    interruptor_principal = db.get(CatalogoComponente, tablero.interruptor_principal_id)
    atributos_principal = (interruptor_principal.atributos or {}) if interruptor_principal else {}
    nominal_aguas_arriba = atributos_principal.get("corriente_nominal_a")
    if nominal_aguas_arriba is None:
        return None

    propuesto = proponer_componente(
        db,
        tipo_proteccion,
        formato,
        corriente_nominal,
        tablero.nivel_falla_ka,
        Decimal(str(nominal_aguas_arriba)),
        parametros,
    )
    return propuesto.id if propuesto else None


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
        componente_id = _proponer_componente_para_salida(
            db, tablero, payload.tipo_proteccion, payload.formato, payload.carga_valor, payload.carga_unidad, parametros
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

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
    carga_valor: Decimal | None = None
    carga_unidad: str | None = None
    formato: FormatoPolos | None = None
    tipo_proteccion: TipoProteccion | None = None
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

    # exclude_unset: igual que TableroUpdate/ProyectoUpdate -- un PATCH parcial
    # no debe pisar campos que el cliente no mandó.
    cambios = payload.model_dump(exclude_unset=True)
    campos_recalculo = ("carga_valor", "carga_unidad", "formato", "tipo_proteccion")
    debe_recalcular = any(campo in cambios for campo in campos_recalculo)
    componente_fijado_explicitamente = "componente_id" in cambios

    if "carga_valor" in cambios:
        salida.carga_valor = cambios["carga_valor"]
    if "carga_unidad" in cambios:
        salida.carga_unidad = cambios["carga_unidad"]
    if "formato" in cambios:
        salida.formato = cambios["formato"]
    if "tipo_proteccion" in cambios:
        salida.tipo_proteccion = cambios["tipo_proteccion"]

    if componente_fijado_explicitamente:
        # Un componente_id explícito en el mismo pedido gana por sobre el
        # recálculo automático, incluso si también cambió la carga/formato.
        salida.componente_id = cambios["componente_id"]
    elif debe_recalcular:
        seccion = db.get(Seccion, salida.seccion_id)
        tablero = db.get(Tablero, seccion.tablero_id)
        parametros = obtener_parametros(db)
        try:
            salida.componente_id = _proponer_componente_para_salida(
                db, tablero, salida.tipo_proteccion, salida.formato, salida.carga_valor, salida.carga_unidad, parametros
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db.commit()
    db.refresh(salida)
    return _salida_response(salida)


@router.delete("/salidas/{salida_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_salida(
    salida_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_role(RolUsuario.ANALISTA, RolUsuario.SUPERVISOR)),
):
    salida = db.get(Salida, salida_id)
    if salida is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salida no encontrada")
    db.delete(salida)
    db.commit()


@router.get("/secciones/{seccion_id}/salidas", response_model=list[SalidaResponse])
def listar_salidas(
    seccion_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    seccion = db.get(Seccion, seccion_id)
    if seccion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada")
    salidas = db.query(Salida).filter(Salida.seccion_id == seccion_id).order_by(Salida.posicion_orden).all()
    return [_salida_response(s) for s in salidas]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_salidas_endpoint.py -v`
Expected: all PASS (including the pre-existing tests — the refactor into `_proponer_componente_para_salida` must not change `crear_salida`'s observable behavior).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/salidas.py backend/tests/test_salidas_endpoint.py
git commit -m "feat: extend salida PATCH to recalc proposal and add DELETE"
```

---

## Task 5: Backend — filtro `categorias` en `/catalogo/buscar`

**Files:**
- Modify: `backend/app/routers/catalogo.py`
- Test: `backend/tests/test_catalogo_buscar_endpoint.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_catalogo_buscar_endpoint.py`:

```python
def test_buscar_filtra_por_categorias_cuando_se_especifica(client, db_session):
    _login(client, db_session, email="buscarcat9.test@pyre.com")
    en_categoria = _componente(db_session, "ZQXCAT-C1", "Interruptor de categoría permitida")
    fuera_de_categoria = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXCAT-C2",
        categoria_path=["Relés"],
        categoria_raiz="Relés",
        descripcion="Interruptor de categoría no permitida ZQXCAT",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(fuera_de_categoria)
    db_session.commit()

    response = client.get(
        "/catalogo/buscar",
        params={"q": "ZQXCAT", "categorias": ["Interruptores Termomagneticos"]},
    )

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(en_categoria.id) in ids
    assert str(fuera_de_categoria.id) not in ids


def test_buscar_sin_categorias_no_filtra(client, db_session):
    _login(client, db_session, email="buscarcat10.test@pyre.com")
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo="ZQXNOCAT-C1",
        categoria_path=["Relés"],
        categoria_raiz="Relés",
        descripcion="Interruptor sin filtro ZQXNOCAT",
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()

    response = client.get("/catalogo/buscar", params={"q": "ZQXNOCAT"})

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["resultados"]]
    assert str(componente.id) in ids
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv\Scripts\pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: `test_buscar_filtra_por_categorias_cuando_se_especifica` FAILS (both rows come back, unfiltered).

- [ ] **Step 3: Implement**

In `backend/app/routers/catalogo.py`, change the sqlalchemy import (line 7) from:

```python
from sqlalchemy import case, or_
```

to:

```python
from sqlalchemy import and_, case, or_
```

Also add `Query` to the fastapi import (line 5), from:

```python
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
```

to:

```python
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
```

Then update the `buscar_componentes` signature and filter (replace lines 66-99):

```python
@router.get("/buscar", response_model=BusquedaCatalogoResponse)
def buscar_componentes(
    q: str = "",
    categorias: list[str] | None = Query(default=None),
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
```

(The rest of the function — `total = db.query(...)`, the paginated query, and the `return BusquedaCatalogoResponse(...)` — stays exactly as-is; `filtro` is reused unchanged below.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv\Scripts\pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: all PASS, including the tiebreaker/order_by regression test (untouched).

- [ ] **Step 5: Run the full backend suite before moving to frontend**

Run: `cd backend && venv\Scripts\pytest -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/catalogo.py backend/tests/test_catalogo_buscar_endpoint.py
git commit -m "feat: add categorias filter to GET /catalogo/buscar"
```

---

## Task 6: Frontend — `api/client.ts` — funciones y tipos nuevos

**Files:**
- Modify: `frontend/src/api/client.ts`

This codebase has no dedicated unit tests for `api/client.ts` (existing functions like `crearTablero`/`actualizarTablero` are only exercised indirectly through the page/component tests that mock `fetch` — see `DetalleTablero.test.tsx`, `ProyectosPage.test.tsx`). Follow that established pattern: no new test file here, verify with a type-check instead. All changes in this task are additive (no existing call site's signature changes), so nothing downstream breaks yet.

- [ ] **Step 1: Add `CATEGORIAS_INTERRUPTORES` and the proyecto/tablero/seccion/salida/catalogo additions**

In `frontend/src/api/client.ts`, right after the `Proyecto` interface's `obtenerProyecto` function (after line 93), insert:

```ts
export interface ProyectoUpdate {
  nombre?: string;
  cliente?: string;
}

export async function actualizarProyecto(id: string, cambios: ProyectoUpdate): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  if (!response.ok) throw new Error("No se pudo actualizar el proyecto");
  return response.json();
}

export async function eliminarProyecto(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar el proyecto");
}
```

Right after the `TableroUpdate` interface (currently lines 135-138), change it from:

```ts
export interface TableroUpdate {
  nivel_falla_ka?: string;
  interruptor_principal_id?: string | null;
}
```

to:

```ts
export interface TableroUpdate {
  nombre?: string;
  nivel_falla_ka?: string;
  interruptor_principal_id?: string | null;
}
```

Right after `actualizarTablero` (after line 149), insert:

```ts
export async function eliminarTablero(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar el tablero");
}
```

Right after `crearSeccion` (after line 173), insert:

```ts
export interface SeccionUpdate {
  nombre?: string;
}

export async function actualizarSeccion(id: string, nombre: string): Promise<Seccion> {
  const response = await fetch(`${API_BASE_URL}/secciones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nombre }),
  });
  if (!response.ok) throw new Error("No se pudo actualizar la sección");
  return response.json();
}

export async function eliminarSeccion(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/secciones/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar la sección");
}
```

Right after `actualizarSalida` (after line 222 — the task that changes its signature to accept partial updates is Task 12, which owns the only call site, `SeccionBlock`; leave it untouched here), insert:

```ts
export async function eliminarSalida(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/salidas/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar la salida");
}
```

Replace `buscarCatalogo` (lines 237-249) to accept a `categorias` option:

```ts
export async function buscarCatalogo(
  q: string,
  opciones?: { limit?: number; offset?: number; categorias?: string[] },
): Promise<ResultadoBusquedaCatalogo> {
  const params = new URLSearchParams({ q });
  if (opciones?.limit !== undefined) params.set("limit", String(opciones.limit));
  if (opciones?.offset !== undefined) params.set("offset", String(opciones.offset));
  for (const categoria of opciones?.categorias ?? []) params.append("categorias", categoria);
  const response = await fetch(`${API_BASE_URL}/catalogo/buscar?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo buscar en el catálogo");
  return response.json();
}

// Filtro maestro (no editable por el analista) para acotar el picker a
// interruptores -- mismas familias que usa el motor de propuesta en
// backend/app/catalogo/parser_abb.py (FAMILIAS_TERMOMAGNETICO ∪
// FAMILIA_DIFERENCIAL_COMBO). Cuando se agreguen búsquedas para otros tipos
// de material (cables, terminales, riel DIN...) cada una define su propia
// constante de categorías en vez de reusar esta.
export const CATEGORIAS_INTERRUPTORES = [
  "Interruptores Termomagnéticos",
  "Interruptores Termomagnéticos - Con posibilidad de utilizar accesorios",
  "Interruptores Termomagnéticos - Sin posibilidad de utilizar accesorios",
  "Interruptores automáticos en caja moldeada",
  "Interruptores termomagnéticos con protección diferencial",
];
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (all changes are additive; existing call sites still compile).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add proyecto/tablero/seccion/salida CRUD calls and categorias filter to api client"
```

---

## Task 7: Frontend — `ConfirmDialog.tsx`

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`
- Test: `frontend/src/components/ConfirmDialog.test.tsx`

This is the "patrón único, reutilizado en los 4 niveles" confirmation modal from the spec — a genuinely new, reused-4x component, so unlike Task 6 it gets its own dedicated test file.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/ConfirmDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("calls onConfirm when Borrar is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        titulo="Confirmar borrado"
        mensaje="¿Borrar el tablero 'TG1'?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when Cancelar is clicked, without calling onConfirm", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog titulo="Confirmar borrado" mensaje="¿Borrar?" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel on Escape", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog titulo="Confirmar borrado" mensaje="¿Borrar?" onConfirm={vi.fn()} onCancel={onCancel} />);

    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("shows the message so the user knows what's being deleted", () => {
    render(
      <ConfirmDialog
        titulo="Confirmar borrado"
        mensaje="Esto va a borrar el tablero 'TG1' y sus 2 filas con 5 elementos."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 filas con 5 elementos/i)).toBeInTheDocument();
  });

  it("disables the Borrar button while confirmando is true", () => {
    render(
      <ConfirmDialog
        titulo="Confirmar borrado"
        mensaje="¿Borrar?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmando
      />,
    );

    expect(screen.getByRole("button", { name: /^borrar$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: FAIL with "Cannot find module './ConfirmDialog'".

- [ ] **Step 3: Implement**

Create `frontend/src/components/ConfirmDialog.tsx`:

```tsx
import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  titulo: string;
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmando?: boolean;
}

export function ConfirmDialog({ titulo, mensaje, onConfirm, onCancel, confirmando = false }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-titulo"
        className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
      >
        <h2 id="confirm-dialog-titulo" className="text-lg font-bold">
          {titulo}
        </h2>
        <p>{mensaje}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmando}
            className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/components/ConfirmDialog.test.tsx
git commit -m "feat: add reusable ConfirmDialog for delete confirmations"
```

---

## Task 8: Frontend — `ComponentePicker` como modal autocontenido con `categorias` requerido

**Files:**
- Modify: `frontend/src/components/ComponentePicker.tsx`
- Modify: `frontend/src/components/ComponentePicker.test.tsx`

This is a breaking change: `ComponentePicker` stops being an inline dropdown and becomes the modal itself (its own `role="dialog"`, backdrop, Escape, focus). It now requires `categorias: string[]` and a new `onCancel` prop. Its only current caller (`DetalleTablero`'s interruptor-principal editor) breaks until Task 11 updates it — that's expected and resolved within this same plan; `SeccionBlock`'s inline usage is replaced entirely in Task 12.

- [ ] **Step 1: Rewrite the failing test file**

Replace the full content of `frontend/src/components/ComponentePicker.test.tsx` with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentePicker } from "./ComponentePicker";

const CATEGORIAS = ["Interruptores Termomagneticos"];

describe("ComponentePicker", () => {
  it("renders as a dialog and calls onCancel when Cancelar is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const onCancel = vi.fn();
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={onCancel} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const onCancel = vi.fn();
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={onCancel} />);

    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("does not search with fewer than 2 characters", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "a");

    expect(fetch).not.toHaveBeenCalled();
  });

  it("includes the categorias filter in the search request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultados: [], total: 0 }) }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("categorias=Interruptores"),
      expect.anything(),
    );
  });

  it("shows results and calls onSelect when clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
          total: 1,
        }),
      }),
    );
    const onSelect = vi.fn();
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={onSelect} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await userEvent.click(await screen.findByRole("button", { name: /SH201-C16/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", codigo: "SH201-C16" }));
  });

  it("shows 'sin resultados' when the search returns nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultados: [], total: 0 }) }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "zzzz");

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });

  it("shows a result count and no 'Cargar más' button when everything fits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
          total: 1,
        }),
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");

    expect(await screen.findByText(/mostrando 1 de 1 resultados/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("loads more results without replacing the ones already shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const esSegundaPagina = url.includes("offset=1");
        return Promise.resolve({
          ok: true,
          json: async () =>
            esSegundaPagina
              ? {
                  resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
                  total: 2,
                }
              : {
                  resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
                  total: 2,
                },
        });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByText(/mostrando 1 de 2 resultados/i);

    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));

    expect(await screen.findByRole("button", { name: /SH201-C20/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SH201-C16/i })).toBeInTheDocument();
    expect(screen.getByText(/mostrando 2 de 2 resultados/i)).toBeInTheDocument();
  });

  it("ignores a stale Cargar más response if the query changed before it resolved", async () => {
    let resolverPrimeraPagina: (value: unknown) => void = () => {};
    let resolverSegundaPagina: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("SH201") && url.includes("offset=0")) {
          return new Promise((resolve) => {
            resolverPrimeraPagina = resolve;
          });
        }
        if (url.includes("SH201") && url.includes("offset=1")) {
          return new Promise((resolve) => {
            resolverSegundaPagina = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            resultados: [{ id: "x1", codigo: "XT2N100", descripcion: "Otro interruptor", precio_neto: "10.00" }],
            total: 1,
          }),
        });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    resolverPrimeraPagina({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
        total: 2,
      }),
    });
    await screen.findByRole("button", { name: /SH201-C16/i });

    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));
    await userEvent.clear(screen.getByLabelText(/buscar código/i));
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N100");
    await screen.findByRole("button", { name: /XT2N100/i });

    resolverSegundaPagina({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
        total: 2,
      }),
    });

    // Give the stale promise's .then a tick to (not) apply its update.
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByRole("button", { name: /SH201-C20/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /XT2N100/i })).toBeInTheDocument();
  });

  it("disables Cargar más while a request is in flight, preventing duplicate loads", async () => {
    let resolverSegundaPagina: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("offset=0")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
              total: 2,
            }),
          });
        }
        return new Promise((resolve) => {
          resolverSegundaPagina = resolve;
        });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByRole("button", { name: /SH201-C16/i });

    const botonCargarMas = screen.getByRole("button", { name: /cargar más/i });
    await userEvent.click(botonCargarMas);

    expect(screen.getByRole("button", { name: /cargando/i })).toBeDisabled();

    resolverSegundaPagina({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
        total: 2,
      }),
    });

    expect(await screen.findByRole("button", { name: /SH201-C20/i })).toBeInTheDocument();
    const filas = screen.getAllByRole("button", { name: /SH201-C20/i });
    expect(filas).toHaveLength(1);
  });

  it("does not get stuck disabled after a query change interrupts a pending Cargar más", async () => {
    let resolverSegundaPaginaVieja: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("SH201") && url.includes("offset=0")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
              total: 2,
            }),
          });
        }
        if (url.includes("SH201") && url.includes("offset=1")) {
          return new Promise((resolve) => {
            resolverSegundaPaginaVieja = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            resultados: [{ id: "x1", codigo: "XT2N100", descripcion: "Otro interruptor", precio_neto: "10.00" }],
            total: 2,
          }),
        });
      }),
    );
    render(<ComponentePicker categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByRole("button", { name: /SH201-C16/i });
    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));

    await userEvent.clear(screen.getByLabelText(/buscar código/i));
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N100");
    await screen.findByRole("button", { name: /XT2N100/i });

    resolverSegundaPaginaVieja({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
        total: 2,
      }),
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByRole("button", { name: /cargar más/i })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx`
Expected: FAIL — `categorias`/`onCancel` are unknown props to TS, `screen.getByRole("dialog")` finds nothing, no "Cancelar" button exists.

- [ ] **Step 3: Rewrite the implementation**

Replace the full content of `frontend/src/components/ComponentePicker.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import { buscarCatalogo, type ComponenteBusqueda } from "../api/client";

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
  const solicitudActualRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  async function handleChange(value: string) {
    setQuery(value);
    const idSolicitud = ++solicitudActualRef.current;
    if (value.trim().length < 2) {
      setResultados(null);
      setTotal(0);
      return;
    }
    const respuesta = await buscarCatalogo(value, { limit: RESULTADOS_POR_PAGINA, offset: 0, categorias });
    if (idSolicitud !== solicitudActualRef.current) return;
    setResultados(respuesta.resultados);
    setTotal(respuesta.total);
  }

  async function handleCargarMas() {
    if (resultados === null || cargandoMas) return;
    const idSolicitud = ++solicitudActualRef.current;
    setCargandoMas(true);
    try {
      const respuesta = await buscarCatalogo(query, {
        limit: RESULTADOS_POR_PAGINA,
        offset: resultados.length,
        categorias,
      });
      if (idSolicitud !== solicitudActualRef.current) return;
      setResultados((actuales) => [...(actuales ?? []), ...respuesta.resultados]);
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-picker-titulo"
        className="flex w-[700px] max-w-full flex-col gap-2 border border-surface-stroke bg-white p-8"
      >
        <h2 id="component-picker-titulo" className="text-lg font-bold">
          {titulo}
        </h2>
        <input
          ref={inputRef}
          aria-label="Buscar código o descripción"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full border border-surface-stroke p-2"
        />
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
          className="mt-4 self-start border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx`
Expected: all PASS. (`DetalleTablero.test.tsx` and `SeccionBlock.test.tsx` are expected to be red right now — they're fixed in Tasks 11 and 12.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ComponentePicker.tsx frontend/src/components/ComponentePicker.test.tsx
git commit -m "feat: turn ComponentePicker into a self-contained modal with required categorias filter"
```

---

## Task 9: Frontend — `ProyectosPage` — editar nombre/cliente + borrar con confirmación

**Files:**
- Modify: `frontend/src/pages/ProyectosPage.tsx`
- Modify: `frontend/src/pages/ProyectosPage.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append to `frontend/src/pages/ProyectosPage.test.tsx` (inside the existing `describe` block, keep the `import` list as-is except adding `waitFor`):

Change the import line (line 2) from:

```tsx
import { render, screen } from "@testing-library/react";
```

to:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
```

Then append these tests before the closing `});` of the `describe` block:

```tsx
  it("edits a project's nombre and cliente via the edit icon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "p1",
              cliente: "Cliente Editado",
              nombre: "Proyecto Editado",
              analista_id: "a1",
              estado: "en_curso",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" },
          ],
        });
      }),
    );
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /editar proyecto existente/i }));
    const nombreInput = screen.getByLabelText(/^nombre$/i) as HTMLInputElement;
    expect(nombreInput.value).toBe("Proyecto Existente");
    await userEvent.clear(nombreInput);
    await userEvent.type(nombreInput, "Proyecto Editado");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText(/Proyecto Editado/i)).toBeInTheDocument();
  });

  it("deletes a project after confirming, showing how many tableros it has", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({}) });
        if (url.includes("/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" },
          ],
        });
      }),
    );
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /borrar proyecto existente/i }));
    expect(await screen.findByText(/1 tablero/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    await waitFor(() => expect(screen.queryByText(/Proyecto Existente/i)).not.toBeInTheDocument());
  });

  it("cancelling the delete confirmation keeps the project", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /borrar proyecto existente/i }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.getByText(/Proyecto Existente/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx`
Expected: the 3 new tests FAIL (no edit/delete icons exist yet).

- [ ] **Step 3: Implement**

Replace the full content of `frontend/src/pages/ProyectosPage.tsx` with:

```tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  actualizarProyecto,
  crearProyecto,
  eliminarProyecto,
  listarProyectos,
  listarTableros,
  type Proyecto,
} from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";

type Modal = { tipo: "crear" } | { tipo: "editar"; proyecto: Proyecto } | null;

export function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [cliente, setCliente] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<{ proyecto: Proyecto; cantidadTableros: number } | null>(null);
  const [borrando, setBorrando] = useState(false);
  const clienteInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch(() => setError("No se pudieron cargar los proyectos"));
  }, []);

  const cerrarModal = useCallback(() => {
    setModal(null);
    setABorrar(null);
    setCliente("");
    setNombre("");
    setError(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!modal) return;
    clienteInputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modal, cerrarModal]);

  function abrirEditar(proyecto: Proyecto, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setCliente(proyecto.cliente);
    setNombre(proyecto.nombre);
    setModal({ tipo: "editar", proyecto });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (modal?.tipo === "editar") {
        const actualizado = await actualizarProyecto(modal.proyecto.id, { cliente, nombre });
        setProyectos((actuales) => actuales.map((p) => (p.id === actualizado.id ? actualizado : p)));
      } else {
        const proyecto = await crearProyecto(cliente, nombre);
        setProyectos((actuales) => [...actuales, proyecto]);
      }
      setModal(null);
      setCliente("");
      setNombre("");
    } catch {
      setError(modal?.tipo === "editar" ? "No se pudo actualizar el proyecto" : "No se pudo crear el proyecto");
    }
  }

  async function handlePedirBorrado(proyecto: Proyecto, trigger: HTMLElement) {
    triggerRef.current = trigger;
    const tableros = await listarTableros(proyecto.id).catch(() => []);
    setABorrar({ proyecto, cantidadTableros: tableros.length });
  }

  async function handleConfirmarBorrado() {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await eliminarProyecto(aBorrar.proyecto.id);
      setProyectos((actuales) => actuales.filter((p) => p.id !== aBorrar.proyecto.id));
      setABorrar(null);
    } catch {
      setError("No se pudo borrar el proyecto");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proyectos</h1>
        <button
          type="button"
          onClick={(e) => {
            triggerRef.current = e.currentTarget;
            setCliente("");
            setNombre("");
            setModal({ tipo: "crear" });
          }}
          className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white"
        >
          Nuevo proyecto
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proyectos.map((proyecto) => (
          <div key={proyecto.id} className="relative border border-surface-stroke bg-white p-6 hover:border-abb-red">
            <div className="absolute right-3 top-3 flex gap-2 text-on-background">
              <button
                type="button"
                aria-label={`Editar ${proyecto.nombre}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirEditar(proyecto, e.currentTarget);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button
                type="button"
                aria-label={`Borrar ${proyecto.nombre}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePedirBorrado(proyecto, e.currentTarget);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
            <Link to={`/proyectos/${proyecto.id}`} className="block">
              <p className="pr-16 font-bold">{proyecto.nombre}</p>
              <p className="text-secondary">{proyecto.cliente}</p>
            </Link>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={cerrarModal}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="proyecto-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="proyecto-modal-titulo" className="text-lg font-bold">
              {modal.tipo === "editar" ? "Editar proyecto" : "Nuevo proyecto"}
            </h2>
            <label htmlFor="cliente">Cliente</label>
            <input id="cliente" ref={clienteInputRef} value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {error && <p role="alert" className="text-error">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                {modal.tipo === "editar" ? "Guardar" : "Crear proyecto"}
              </button>
              <button type="button" onClick={cerrarModal} className="px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {aBorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={
            aBorrar.cantidadTableros > 0
              ? `Esto va a borrar el proyecto "${aBorrar.proyecto.nombre}" y sus ${aBorrar.cantidadTableros} tablero(s).`
              : `Esto va a borrar el proyecto "${aBorrar.proyecto.nombre}".`
          }
          confirmando={borrando}
          onConfirm={handleConfirmarBorrado}
          onCancel={cerrarModal}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx`
Expected: all PASS (the 4 pre-existing tests plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProyectosPage.tsx frontend/src/pages/ProyectosPage.test.tsx
git commit -m "feat: add proyecto edit/delete with confirmation to ProyectosPage"
```

---

## Task 10: Frontend — `ProyectoWorkspacePage` — grupo de íconos de tablero

**Files:**
- Modify: `frontend/src/pages/ProyectoWorkspacePage.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

Replaces the bottom "Nuevo tablero" inline form with a tab-level icon group (nuevo/editar/borrar), matching the pattern established in Task 9.

- [ ] **Step 1: Update the test file**

Replace the full content of `frontend/src/pages/ProyectoWorkspacePage.test.tsx` with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProyectoWorkspacePage } from "./ProyectoWorkspacePage";

function renderPage(initialEntry = "/proyectos/p1") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/proyectos/:id" element={<ProyectoWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockFetchConDosTableros() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/proyectos/p1/tableros")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            { id: "t2", proyecto_id: "p1", nombre: "TG2", nivel_falla_ka: "16.00", interruptor_principal_id: null },
          ],
        });
      }
      if (url.includes("/secciones")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
      });
    }),
  );
}

describe("ProyectoWorkspacePage", () => {
  it("shows a tab per tablero and activates the first one by default", async () => {
    mockFetchConDosTableros();
    renderPage();

    expect(await screen.findByRole("tab", { name: "TG1" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "false");
  });

  it("switches the active tablero when clicking another tab", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("tab", { name: "TG2" }));

    expect(screen.getByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "TG1" })).toHaveAttribute("aria-selected", "false");
  });

  it("honors the tablero query param on load", async () => {
    mockFetchConDosTableros();
    renderPage("/proyectos/p1?tablero=t2");

    expect(await screen.findByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an empty state and no tabs when the proyecto has no tableros", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/tableros")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();

    expect(await screen.findByText(/creá tu primer tablero/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("falls back to the first tablero when the tablero query param doesn't match any real tablero", async () => {
    mockFetchConDosTableros();
    renderPage("/proyectos/p1?tablero=nonexistent");

    expect(await screen.findByRole("tab", { name: "TG1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText(/creá tu primer tablero/i)).not.toBeInTheDocument();
  });

  it("creates a new tablero via the Nuevo tablero icon, adds a tab for it, and activates it", async () => {
    mockFetchConDosTableros();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "t3",
              proyecto_id: "p1",
              nombre: "TG3",
              nivel_falla_ka: "10.00",
              interruptor_principal_id: null,
            }),
          });
        }
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG3");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));

    expect(await screen.findByRole("tab", { name: "TG3" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the active tablero's secciones inside the workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones/") && url.includes("/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 }],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "Sección 1" })).toBeInTheDocument();
  });

  it("keeps each tablero's zoom level when switching tabs and back", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(await screen.findByRole("button", { name: /acercar/i }));
    expect(screen.getByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("125%");

    await userEvent.click(screen.getByRole("tab", { name: "TG2" }));
    expect(await screen.findByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("100%");

    await userEvent.click(screen.getByRole("tab", { name: "TG1" }));
    expect(await screen.findByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("125%");
  });

  it("shows a link back to Proyectos", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    expect(screen.getByRole("link", { name: /proyectos/i })).toHaveAttribute("href", "/proyectos");
  });

  it("shows the tablero management icons to the right of the tabs", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    expect(screen.getByRole("button", { name: /renombrar tablero activo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /borrar tablero activo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^nuevo tablero$/i })).toBeInTheDocument();
  });

  it("renames the active tablero via the icon and modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "t1",
              proyecto_id: "p1",
              nombre: "TG1 renombrado",
              nivel_falla_ka: "10.00",
              interruptor_principal_id: null,
            }),
          });
        }
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /renombrar tablero activo/i }));
    const input = screen.getByLabelText(/^nombre$/i) as HTMLInputElement;
    expect(input.value).toBe("TG1");
    await userEvent.clear(input);
    await userEvent.type(input, "TG1 renombrado");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByRole("tab", { name: "TG1 renombrado" })).toBeInTheDocument();
  });

  it("deletes the active tablero after confirming and falls back to another tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({}) });
        if (url.includes("/proyectos/p1/tableros")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "t1", proyecto_id: "p1", nombre: "TG1", nivel_falla_ka: "10.00", interruptor_principal_id: null },
              { id: "t2", proyecto_id: "p1", nombre: "TG2", nivel_falla_ka: "16.00", interruptor_principal_id: null },
            ],
          });
        }
        if (url.includes("/secciones")) return Promise.resolve({ ok: true, json: async () => [] });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /borrar tablero activo/i }));
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(await screen.findByRole("tab", { name: "TG2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "TG1" })).not.toBeInTheDocument();
  });

  it("cancelling the tablero delete confirmation keeps the tablero", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /borrar tablero activo/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.getByRole("tab", { name: "TG1" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/ProyectoWorkspacePage.test.tsx`
Expected: the "creates a new tablero..." test and the 4 new icon-related tests FAIL.

- [ ] **Step 3: Implement**

Replace the full content of `frontend/src/pages/ProyectoWorkspacePage.tsx` with:

```tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  actualizarTablero,
  crearTablero,
  eliminarTablero,
  listarTableros,
  obtenerProyecto,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type Proyecto,
  type Tablero,
} from "../api/client";
import { ComponentePicker } from "../components/ComponentePicker";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DetalleTablero } from "../components/DetalleTablero";
import type { Capas } from "../components/EsquemaVisual";

// Icc estándar de arranque para no bloquear la creación del tablero — el
// analista lo puede editar desde el detalle del tablero si el estudio
// eléctrico del sitio da un valor distinto.
const NIVEL_FALLA_KA_POR_DEFECTO = "10";

export function ProyectoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tableros, setTableros] = useState<Tablero[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [nivelFallaKa, setNivelFallaKa] = useState(NIVEL_FALLA_KA_POR_DEFECTO);
  const [interruptorPrincipal, setInterruptorPrincipal] = useState<ComponenteBusqueda | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [modalNuevoTablero, setModalNuevoTablero] = useState(false);
  const [tableroEnEdicion, setTableroEnEdicion] = useState<Tablero | null>(null);
  const [nombreTableroEdit, setNombreTableroEdit] = useState("");
  const [tableroABorrar, setTableroABorrar] = useState<Tablero | null>(null);
  const [borrandoTablero, setBorrandoTablero] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const VISTA_POR_DEFECTO: { zoom: number; capas: Capas } = { zoom: 1, capas: { codigos: true, embarrado: true } };
  const [vistaEstado, setVistaEstado] = useState<Record<string, { zoom: number; capas: Capas }>>({});

  useEffect(() => {
    if (!id) return;
    obtenerProyecto(id)
      .then(setProyecto)
      .catch(() => setError("No se pudo cargar el proyecto"));
    listarTableros(id)
      .then(setTableros)
      .catch(() => setError("No se pudieron cargar los tableros"));
  }, [id]);

  function handleSeleccionarTablero(tableroId: string) {
    setSearchParams({ tablero: tableroId });
  }

  function cerrarModales() {
    setModalNuevoTablero(false);
    setPickerAbierto(false);
    setTableroEnEdicion(null);
    setTableroABorrar(null);
    setNombre("");
    setNivelFallaKa(NIVEL_FALLA_KA_POR_DEFECTO);
    setInterruptorPrincipal(null);
    setError(null);
    triggerRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const tablero = await crearTablero(id, nombre, nivelFallaKa, interruptorPrincipal?.id ?? null);
      setTableros((actuales) => [...(actuales ?? []), tablero]);
      cerrarModales();
      setSearchParams({ tablero: tablero.id });
    } catch {
      setError("No se pudo crear el tablero");
    }
  }

  async function handleRenombrarTablero(event: FormEvent) {
    event.preventDefault();
    if (!tableroEnEdicion) return;
    setError(null);
    try {
      const actualizado = await actualizarTablero(tableroEnEdicion.id, { nombre: nombreTableroEdit });
      setTableros((actuales) => (actuales ?? []).map((t) => (t.id === actualizado.id ? actualizado : t)));
      cerrarModales();
    } catch {
      setError("No se pudo renombrar el tablero");
    }
  }

  async function handleConfirmarBorrarTablero() {
    if (!tableroABorrar) return;
    setBorrandoTablero(true);
    try {
      await eliminarTablero(tableroABorrar.id);
      const restantes = (tableros ?? []).filter((t) => t.id !== tableroABorrar.id);
      setTableros(restantes);
      if (tableroActivoId === tableroABorrar.id) {
        setSearchParams(restantes[0] ? { tablero: restantes[0].id } : {});
      }
      setTableroABorrar(null);
    } catch {
      setError("No se pudo borrar el tablero");
    } finally {
      setBorrandoTablero(false);
    }
  }

  if (!proyecto || tableros === null) return <p>Cargando...</p>;

  const tableroParamId = searchParams.get("tablero");
  const tableroActivoId = tableros.find((t) => t.id === tableroParamId)
    ? tableroParamId
    : (tableros[0]?.id ?? null);
  const tableroActivo = tableros.find((t) => t.id === tableroActivoId) ?? null;

  function obtenerVista(tableroId: string) {
    return vistaEstado[tableroId] ?? VISTA_POR_DEFECTO;
  }

  function handleTableroActualizado(actualizado: Tablero) {
    setTableros((actuales) => (actuales ?? []).map((t) => (t.id === actualizado.id ? actualizado : t)));
  }

  function handleZoomChange(tableroId: string, zoom: number) {
    setVistaEstado((actual) => ({ ...actual, [tableroId]: { ...obtenerVista(tableroId), zoom } }));
  }

  function handleCapasChange(tableroId: string, capas: Capas) {
    setVistaEstado((actual) => ({ ...actual, [tableroId]: { ...obtenerVista(tableroId), capas } }));
  }

  return (
    <div>
      <Link to="/proyectos" className="text-sm text-secondary hover:text-on-background">
        ← Proyectos
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{proyecto.nombre}</h1>
      <p className="text-secondary">{proyecto.cliente}</p>

      <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-surface-stroke">
        {tableros.length > 0 && (
          <div role="tablist" aria-label="Tableros del proyecto" className="flex flex-wrap gap-1">
            {tableros.map((tablero) => (
              <button
                key={tablero.id}
                role="tab"
                type="button"
                aria-selected={tablero.id === tableroActivoId}
                onClick={() => handleSeleccionarTablero(tablero.id)}
                className={`px-4 py-2 text-sm uppercase tracking-widest ${
                  tablero.id === tableroActivoId
                    ? "border-b-2 border-abb-red text-abb-red"
                    : "text-secondary hover:text-on-background"
                }`}
              >
                {tablero.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-3 px-2 text-on-background">
          {tableroActivo && (
            <>
              <button
                type="button"
                aria-label="Renombrar tablero activo"
                onClick={(e) => {
                  triggerRef.current = e.currentTarget;
                  setNombreTableroEdit(tableroActivo.nombre);
                  setTableroEnEdicion(tableroActivo);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button
                type="button"
                aria-label="Borrar tablero activo"
                onClick={(e) => {
                  triggerRef.current = e.currentTarget;
                  setTableroABorrar(tableroActivo);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Nuevo tablero"
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              setModalNuevoTablero(true);
            }}
            className="hover:text-abb-red"
          >
            <span className="material-symbols-outlined text-base">add</span>
          </button>
        </div>
      </div>

      {tableroActivo === null ? (
        <p className="mt-6 text-secondary">Creá tu primer tablero para empezar a configurarlo.</p>
      ) : (
        <DetalleTablero
          key={tableroActivo.id}
          tablero={tableroActivo}
          onTableroActualizado={handleTableroActualizado}
          vista={obtenerVista(tableroActivo.id)}
          onZoomChange={(zoom) => handleZoomChange(tableroActivo.id, zoom)}
          onCapasChange={(capas) => handleCapasChange(tableroActivo.id, capas)}
        />
      )}

      {modalNuevoTablero && !pickerAbierto && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModales}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuevo-tablero-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="nuevo-tablero-titulo" className="text-lg font-bold">Nuevo tablero</h2>
            <label htmlFor="nombre-tablero">Nombre</label>
            <input id="nombre-tablero" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label htmlFor="nivel-falla">Nivel de falla (kA)</label>
            <input id="nivel-falla" value={nivelFallaKa} onChange={(e) => setNivelFallaKa(e.target.value)} />
            <p>Interruptor principal{interruptorPrincipal ? `: ${interruptorPrincipal.codigo}` : " (opcional)"}</p>
            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              className="self-start border border-surface-stroke px-4 py-2 text-sm uppercase tracking-widest hover:border-abb-red hover:text-abb-red"
            >
              Elegir interruptor principal
            </button>
            {error && <p role="alert" className="text-error">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Crear tablero
              </button>
              <button type="button" onClick={cerrarModales} className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {modalNuevoTablero && pickerAbierto && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          titulo="Interruptor principal"
          onSelect={(componente) => {
            setInterruptorPrincipal(componente);
            setPickerAbierto(false);
          }}
          onCancel={() => setPickerAbierto(false)}
        />
      )}

      {tableroEnEdicion && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModales}>
          <form
            onSubmit={handleRenombrarTablero}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-tablero-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="editar-tablero-titulo" className="text-lg font-bold">Renombrar tablero</h2>
            <label htmlFor="nombre-tablero-edit">Nombre</label>
            <input
              id="nombre-tablero-edit"
              value={nombreTableroEdit}
              onChange={(e) => setNombreTableroEdit(e.target.value)}
            />
            {error && <p role="alert" className="text-error">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button type="button" onClick={cerrarModales} className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {tableroABorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={`Esto va a borrar el tablero "${tableroABorrar.nombre}" y todas sus filas y elementos.`}
          confirmando={borrandoTablero}
          onConfirm={handleConfirmarBorrarTablero}
          onCancel={cerrarModales}
        />
      )}
    </div>
  );
}
```

Note the `id="nombre-tablero-edit"` input still resolves via `getByLabelText(/^nombre$/i)` in tests because its `<label htmlFor="nombre-tablero-edit">Nombre</label>` text is exactly "Nombre" — same convention as `id="nombre-tablero"`/`id="nombre"` elsewhere in this file and `ProyectosPage.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/ProyectoWorkspacePage.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProyectoWorkspacePage.tsx frontend/src/pages/ProyectoWorkspacePage.test.tsx
git commit -m "feat: replace inline Nuevo tablero form with tab-level icon group (new/edit/delete)"
```

---

## Task 11: Frontend — `DetalleTablero` — Icc en línea propia + interruptor principal como primera pestaña + íconos de fila

**Files:**
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`

Key design decisions locked in for this task:
- "Principal" is prepended as the **first tab** in the same `role="tablist"` as the real filas — always present, no rename/delete icons of its own.
- **Default selected tab** stays the first real fila when one exists (`secciones[0]?.seccion.id`), falling back to `"principal"` only when there are zero filas — this preserves every pre-existing test's default-selection expectations; "Principal" is first in *order*, not necessarily first *selected*.
- The Icc line ("Intensidad de Cortocircuito (Icc)") is **not** a tab — it stays as a standalone info line above the tablist, same modal pattern as before, just renamed.
- Fila management icons (renombrar/borrar activa fila, nueva fila) sit to the right of the tablist and only show renombrar/borrar when a **real** fila (not "Principal") is active.

- [ ] **Step 1: Rewrite the failing test file**

Replace the full content of `frontend/src/components/DetalleTablero.test.tsx` with:

```tsx
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetalleTablero } from "./DetalleTablero";
import type { Tablero } from "../api/client";

const tablero: Tablero = {
  id: "t1",
  proyecto_id: "p1",
  nombre: "TG1",
  nivel_falla_ka: "10.00",
  interruptor_principal_id: "c1",
};

function renderDetalle() {
  render(
    <DetalleTablero
      tablero={tablero}
      onTableroActualizado={vi.fn()}
      vista={{ zoom: 1, capas: { codigos: true, embarrado: true } }}
      onZoomChange={vi.fn()}
      onCapasChange={vi.fn()}
    />,
  );
}

describe("DetalleTablero", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST" && url.includes("/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "s2", tablero_id: "t1", nombre: "Sección nueva", orden: 1 }),
          });
        }
        if (url.includes("/secciones/") && url.includes("/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 }],
          });
        }
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ...tablero, nivel_falla_ka: "16.00" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
  });

  it("shows a selector tab for each existing sección, with the first one selected by default", async () => {
    renderDetalle();

    expect(await screen.findByRole("tab", { name: "Sección 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("shows Principal as the first tab, always present, without its own delete icon", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Principal");
    expect(screen.queryByRole("button", { name: /borrar fila activa/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Principal" }));

    expect(screen.queryByRole("button", { name: /borrar fila activa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /renombrar fila activa/i })).not.toBeInTheDocument();
  });

  it("switches the visible sección when clicking another tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/secciones/s1/salidas") || url.includes("/secciones/s2/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 },
              { id: "s2", tablero_id: "t1", nombre: "Sección 2", orden: 1 },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Sección 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sección 2" })).toHaveAttribute("aria-selected", "false");

    await userEvent.click(screen.getByRole("tab", { name: "Sección 2" }));

    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Sección 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Sección 1" })).toHaveAttribute("aria-selected", "false");
  });

  it("does not leak form values between secciones when switching tabs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/secciones/s1/salidas") || url.includes("/secciones/s2/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 },
              { id: "s2", tablero_id: "t1", nombre: "Sección 2", orden: 1 },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    const cargaInputSeccion1 = screen.getAllByLabelText(/^carga$/i)[0] as HTMLInputElement;
    await userEvent.type(cargaInputSeccion1, "16");
    expect(cargaInputSeccion1.value).toBe("16");

    await userEvent.click(screen.getByRole("tab", { name: "Sección 2" }));

    const cargaInputSeccion2 = screen.getAllByLabelText(/^carga$/i)[0] as HTMLInputElement;
    expect(cargaInputSeccion2.value).toBe("");
  });

  it("shows only the Principal tab when there are no filas yet, active by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();

    expect(await screen.findByRole("tab", { name: "Principal" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("adds a new fila via the Nueva fila icon and modal, and activates it", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /nueva fila/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Sección nueva");
    await userEvent.click(screen.getByRole("button", { name: /agregar fila/i }));

    expect(await screen.findByRole("tab", { name: "Sección nueva" })).toHaveAttribute("aria-selected", "true");
  });

  it("renames the active fila via the editar fila icon and modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH" && url.includes("/secciones/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "s1", tablero_id: "t1", nombre: "Fila renombrada", orden: 0 }),
          });
        }
        if (url.includes("/secciones/") && url.includes("/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /renombrar fila activa/i }));
    const input = screen.getByLabelText(/^nombre$/i) as HTMLInputElement;
    expect(input.value).toBe("Sección 1");
    await userEvent.clear(input);
    await userEvent.type(input, "Fila renombrada");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByRole("tab", { name: "Fila renombrada" })).toBeInTheDocument();
  });

  it("deletes the active fila after confirming, and falls back to Principal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({}) });
        if (url.includes("/secciones/") && url.includes("/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /borrar fila activa/i }));
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(await screen.findByRole("tab", { name: "Principal" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Sección 1" })).not.toBeInTheDocument();
  });

  it("cancelling the borrar fila confirmation keeps the fila", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /borrar fila activa/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.getByRole("tab", { name: "Sección 1" })).toBeInTheDocument();
  });

  it("edits nivel de falla via modal and reports the change upward", async () => {
    const onTableroActualizado = vi.fn();

    function Harness() {
      const [tableroActual, setTableroActual] = useState(tablero);
      return (
        <DetalleTablero
          tablero={tableroActual}
          onTableroActualizado={(actualizado) => {
            onTableroActualizado(actualizado);
            setTableroActual(actualizado);
          }}
          vista={{ zoom: 1, capas: { codigos: true, embarrado: true } }}
          onZoomChange={vi.fn()}
          onCapasChange={vi.fn()}
        />
      );
    }

    render(<Harness />);
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /editar intensidad de cortocircuito/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const input = screen.getByLabelText(/nuevo nivel de falla/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "16");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/intensidad de cortocircuito.*16.00 kA/i)).toBeInTheDocument();
    expect(onTableroActualizado).toHaveBeenCalledWith(expect.objectContaining({ nivel_falla_ka: "16.00" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the nivel de falla modal with Escape without saving", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /editar intensidad de cortocircuito/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the nivel de falla modal by clicking the backdrop without saving", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /editar intensidad de cortocircuito/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // The backdrop is the dialog's parent; click it directly (not the dialog itself, which stops propagation).
    await userEvent.click(dialog.parentElement!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits interruptor principal from the Principal tab and reports the change upward", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ...tablero, interruptor_principal_id: "c2" }),
          });
        }
        if (url.includes("/catalogo/buscar")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              resultados: [{ id: "c2", codigo: "XT2N250", descripcion: "Interruptor 250A", precio_neto: "600.00" }],
              total: 1,
            }),
          });
        }
        if (url.includes("/secciones/") && url.includes("/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/tableros/t1/secciones")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => tablero });
      }),
    );

    const onTableroActualizado = vi.fn();
    render(
      <DetalleTablero
        tablero={tablero}
        onTableroActualizado={onTableroActualizado}
        vista={{ zoom: 1, capas: { codigos: true, embarrado: true } }}
        onZoomChange={vi.fn()}
        onCapasChange={vi.fn()}
      />,
    );
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("tab", { name: "Principal" }));
    await userEvent.click(screen.getByRole("button", { name: /editar interruptor principal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N250");
    await userEvent.click(await screen.findByRole("button", { name: /XT2N250/i }));

    expect(onTableroActualizado).toHaveBeenCalledWith(expect.objectContaining({ interruptor_principal_id: "c2" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the EsquemaVisualCanvas with the given zoom", async () => {
    render(
      <DetalleTablero
        tablero={tablero}
        onTableroActualizado={vi.fn()}
        vista={{ zoom: 1.5, capas: { codigos: true, embarrado: true } }}
        onZoomChange={vi.fn()}
        onCapasChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole("button", { name: /ajustar zoom/i })).toHaveTextContent("150%");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/DetalleTablero.test.tsx`
Expected: most tests FAIL (no "Principal" tab, no fila icon group, "editar nivel de falla" renamed, old bottom form still present).

- [ ] **Step 3: Rewrite the implementation**

Replace the full content of `frontend/src/components/DetalleTablero.tsx` with:

```tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  actualizarSeccion,
  actualizarTablero,
  crearSeccion,
  eliminarSeccion,
  listarSalidas,
  listarSecciones,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type Salida,
  type Seccion,
  type Tablero,
} from "../api/client";
import type { Capas } from "./EsquemaVisual";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";
import { ComponentePicker } from "./ComponentePicker";
import { SeccionBlock } from "./SeccionBlock";
import { ConfirmDialog } from "./ConfirmDialog";

interface SeccionConSalidas {
  seccion: Seccion;
  salidas: Salida[];
}

interface Vista {
  zoom: number;
  capas: Capas;
}

interface DetalleTableroProps {
  tablero: Tablero;
  onTableroActualizado: (tablero: Tablero) => void;
  vista: Vista;
  onZoomChange: (zoom: number) => void;
  onCapasChange: (capas: Capas) => void;
}

const TAB_PRINCIPAL = "principal";

export function DetalleTablero({
  tablero,
  onTableroActualizado,
  vista,
  onZoomChange,
  onCapasChange,
}: DetalleTableroProps) {
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
  const [tabSeleccionadoRaw, setTabSeleccionadoRaw] = useState<string | null>(null);
  const [modalIcc, setModalIcc] = useState(false);
  const [modalInterruptor, setModalInterruptor] = useState(false);
  const [modalNuevaFila, setModalNuevaFila] = useState(false);
  const [nombreNuevaFila, setNombreNuevaFila] = useState("");
  const [filaEnEdicion, setFilaEnEdicion] = useState<Seccion | null>(null);
  const [nombreFilaEdit, setNombreFilaEdit] = useState("");
  const [filaABorrar, setFilaABorrar] = useState<Seccion | null>(null);
  const [borrandoFila, setBorrandoFila] = useState(false);
  const [nivelFallaKaEdit, setNivelFallaKaEdit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ultimoTriggerRef = useRef<HTMLElement | null>(null);
  const nivelFallaInputRef = useRef<HTMLInputElement>(null);
  const nombreFilaInputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const seccionesCargadas = await listarSecciones(tablero.id);
    const conSalidas = await Promise.all(
      seccionesCargadas.map(async (seccion) => ({ seccion, salidas: await listarSalidas(seccion.id) })),
    );
    setSecciones(conSalidas);
  }, [tablero.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Por defecto se activa la primera fila real (comportamiento preexistente);
  // "Principal" solo es la pestaña activa por defecto cuando todavía no hay
  // ninguna fila real. "Principal" siempre puede elegirse a mano.
  const tabActivo =
    tabSeleccionadoRaw &&
    (tabSeleccionadoRaw === TAB_PRINCIPAL || secciones.some((s) => s.seccion.id === tabSeleccionadoRaw))
      ? tabSeleccionadoRaw
      : (secciones[0]?.seccion.id ?? TAB_PRINCIPAL);
  const seccionSeleccionada = secciones.find((s) => s.seccion.id === tabActivo) ?? null;

  function cerrarModales() {
    setModalIcc(false);
    setModalInterruptor(false);
    setModalNuevaFila(false);
    setNombreNuevaFila("");
    setFilaEnEdicion(null);
    setFilaABorrar(null);
    setError(null);
    ultimoTriggerRef.current?.focus();
  }

  useEffect(() => {
    const hayModalAbierto = modalIcc || modalInterruptor || modalNuevaFila || filaEnEdicion !== null;
    if (!hayModalAbierto) return;
    if (modalIcc) nivelFallaInputRef.current?.focus();
    if (modalNuevaFila || filaEnEdicion) nombreFilaInputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModales();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalIcc, modalInterruptor, modalNuevaFila, filaEnEdicion]);

  async function handleGuardarNivelFalla(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { nivel_falla_ka: nivelFallaKaEdit });
      onTableroActualizado(actualizado);
      cerrarModales();
    } catch {
      setError("No se pudo actualizar la intensidad de cortocircuito");
    }
  }

  async function handleSeleccionarInterruptorPrincipal(componente: ComponenteBusqueda) {
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { interruptor_principal_id: componente.id });
      onTableroActualizado(actualizado);
      cerrarModales();
    } catch {
      setError("No se pudo actualizar el interruptor principal");
    }
  }

  async function handleCrearFila(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const seccion = await crearSeccion(tablero.id, nombreNuevaFila, secciones.length);
      setSecciones((actuales) => [...actuales, { seccion, salidas: [] }]);
      setTabSeleccionadoRaw(seccion.id);
      cerrarModales();
    } catch {
      setError("No se pudo crear la fila");
    }
  }

  async function handleRenombrarFila(event: FormEvent) {
    event.preventDefault();
    if (!filaEnEdicion) return;
    setError(null);
    try {
      const actualizada = await actualizarSeccion(filaEnEdicion.id, nombreFilaEdit);
      setSecciones((actuales) =>
        actuales.map((s) => (s.seccion.id === actualizada.id ? { ...s, seccion: actualizada } : s)),
      );
      cerrarModales();
    } catch {
      setError("No se pudo renombrar la fila");
    }
  }

  async function handleConfirmarBorrarFila() {
    if (!filaABorrar) return;
    setBorrandoFila(true);
    try {
      await eliminarSeccion(filaABorrar.id);
      setSecciones((actuales) => actuales.filter((s) => s.seccion.id !== filaABorrar.id));
      if (tabActivo === filaABorrar.id) setTabSeleccionadoRaw(TAB_PRINCIPAL);
      setFilaABorrar(null);
    } catch {
      setError("No se pudo borrar la fila");
    } finally {
      setBorrandoFila(false);
    }
  }

  function handleSalidaCreada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      actuales.map((s) => (s.seccion.id === seccionId ? { ...s, salidas: [...s.salidas, salida] } : s)),
    );
  }

  function handleSalidaActualizada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      actuales.map((s) =>
        s.seccion.id === seccionId
          ? { ...s, salidas: s.salidas.map((sal) => (sal.id === salida.id ? salida : sal)) }
          : s,
      ),
    );
  }

  function handleSalidaBorrada(seccionId: string, salidaId: string) {
    setSecciones((actuales) =>
      actuales.map((s) =>
        s.seccion.id === seccionId ? { ...s, salidas: s.salidas.filter((sal) => sal.id !== salidaId) } : s,
      ),
    );
  }

  const filaABorrarCantidadElementos = filaABorrar
    ? (secciones.find((s) => s.seccion.id === filaABorrar.id)?.salidas.length ?? 0)
    : 0;

  return (
    <div className="mt-8">
      <p className="flex flex-wrap items-center gap-2">
        Intensidad de Cortocircuito (Icc): {tablero.nivel_falla_ka} kA
        <button
          type="button"
          aria-label="Editar intensidad de cortocircuito"
          onClick={(e) => {
            ultimoTriggerRef.current = e.currentTarget;
            setNivelFallaKaEdit(tablero.nivel_falla_ka);
            setModalIcc(true);
          }}
          className="text-on-background hover:text-abb-red"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
        </button>
      </p>

      {modalIcc && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModales}>
          <form
            onSubmit={handleGuardarNivelFalla}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="icc-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="icc-modal-titulo" className="text-lg font-bold">
              Intensidad de Cortocircuito (Icc)
            </h2>
            <label htmlFor="nivel-falla-edit">Nuevo nivel de falla (kA)</label>
            <input
              id="nivel-falla-edit"
              ref={nivelFallaInputRef}
              value={nivelFallaKaEdit}
              onChange={(e) => setNivelFallaKaEdit(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button
                type="button"
                onClick={cerrarModales}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {modalInterruptor && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          titulo="Interruptor principal"
          onSelect={handleSeleccionarInterruptorPrincipal}
          onCancel={cerrarModales}
        />
      )}

      {modalNuevaFila && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModales}>
          <form
            onSubmit={handleCrearFila}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nueva-fila-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="nueva-fila-titulo" className="text-lg font-bold">
              Nueva fila
            </h2>
            <label htmlFor="nombre-nueva-fila">Nombre</label>
            <input
              id="nombre-nueva-fila"
              ref={nombreFilaInputRef}
              value={nombreNuevaFila}
              onChange={(e) => setNombreNuevaFila(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Agregar fila
              </button>
              <button
                type="button"
                onClick={cerrarModales}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {filaEnEdicion && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModales}>
          <form
            onSubmit={handleRenombrarFila}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-fila-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="editar-fila-titulo" className="text-lg font-bold">
              Renombrar fila
            </h2>
            <label htmlFor="nombre-fila-edit">Nombre</label>
            <input
              id="nombre-fila-edit"
              ref={nombreFilaInputRef}
              value={nombreFilaEdit}
              onChange={(e) => setNombreFilaEdit(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button
                type="button"
                onClick={cerrarModales}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {filaABorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={
            filaABorrarCantidadElementos > 0
              ? `Esto va a borrar la fila "${filaABorrar.nombre}" y sus ${filaABorrarCantidadElementos} elemento(s).`
              : `Esto va a borrar la fila "${filaABorrar.nombre}".`
          }
          confirmando={borrandoFila}
          onConfirm={handleConfirmarBorrarFila}
          onCancel={cerrarModales}
        />
      )}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-1/3">
          <EsquemaVisualCanvas
            tieneInterruptorPrincipal={!!tablero.interruptor_principal_id}
            secciones={secciones}
            zoom={vista.zoom}
            onZoomChange={onZoomChange}
            capas={vista.capas}
            onCapasChange={onCapasChange}
          />
        </div>
        <div className="w-full lg:flex-1">
          <div className="flex flex-wrap items-center gap-1 border-b border-surface-stroke">
            <div role="tablist" aria-label="Filas del tablero" className="flex flex-wrap gap-1">
              <button
                role="tab"
                type="button"
                aria-selected={tabActivo === TAB_PRINCIPAL}
                onClick={() => setTabSeleccionadoRaw(TAB_PRINCIPAL)}
                className={`px-4 py-2 text-sm uppercase tracking-widest ${
                  tabActivo === TAB_PRINCIPAL
                    ? "border-b-2 border-abb-red text-abb-red"
                    : "text-secondary hover:text-on-background"
                }`}
              >
                Principal
              </button>
              {secciones.map(({ seccion }) => (
                <button
                  key={seccion.id}
                  role="tab"
                  type="button"
                  aria-selected={seccion.id === tabActivo}
                  onClick={() => setTabSeleccionadoRaw(seccion.id)}
                  className={`px-4 py-2 text-sm uppercase tracking-widest ${
                    seccion.id === tabActivo
                      ? "border-b-2 border-abb-red text-abb-red"
                      : "text-secondary hover:text-on-background"
                  }`}
                >
                  {seccion.nombre}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-3 px-2 text-on-background">
              {tabActivo !== TAB_PRINCIPAL && seccionSeleccionada && (
                <>
                  <button
                    type="button"
                    aria-label="Renombrar fila activa"
                    onClick={(e) => {
                      ultimoTriggerRef.current = e.currentTarget;
                      setNombreFilaEdit(seccionSeleccionada.seccion.nombre);
                      setFilaEnEdicion(seccionSeleccionada.seccion);
                    }}
                    className="hover:text-abb-red"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Borrar fila activa"
                    onClick={(e) => {
                      ultimoTriggerRef.current = e.currentTarget;
                      setFilaABorrar(seccionSeleccionada.seccion);
                    }}
                    className="hover:text-abb-red"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label="Nueva fila"
                onClick={(e) => {
                  ultimoTriggerRef.current = e.currentTarget;
                  setNombreNuevaFila("");
                  setModalNuevaFila(true);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-base">add</span>
              </button>
            </div>
          </div>

          {tabActivo === TAB_PRINCIPAL ? (
            <div className="mt-4 border border-surface-stroke bg-white">
              <h3 className="border-b border-surface-stroke bg-industrial-gray p-4 font-bold uppercase tracking-widest">
                Principal
              </h3>
              <table className="w-full text-left">
                <tbody>
                  <tr>
                    <td className="p-3">
                      {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        aria-label="Editar interruptor principal"
                        onClick={(e) => {
                          ultimoTriggerRef.current = e.currentTarget;
                          setModalInterruptor(true);
                        }}
                        className="text-on-background hover:text-abb-red"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            seccionSeleccionada && (
              <SeccionBlock
                key={seccionSeleccionada.seccion.id}
                seccion={seccionSeleccionada.seccion}
                salidas={seccionSeleccionada.salidas}
                onSalidaCreada={(salida) => handleSalidaCreada(seccionSeleccionada.seccion.id, salida)}
                onSalidaActualizada={(salida) => handleSalidaActualizada(seccionSeleccionada.seccion.id, salida)}
                onSalidaBorrada={(salidaId) => handleSalidaBorrada(seccionSeleccionada.seccion.id, salidaId)}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/DetalleTablero.test.tsx`
Expected: all PASS. (This file imports `SeccionBlock`, which won't yet accept `onSalidaBorrada` — Task 12 adds it; run Task 12 before considering this fully green if the test runner errors on that prop instead of just ignoring it. In practice TypeScript allows passing an extra prop a component doesn't yet declare only if it's declared — since `SeccionBlock`'s current props type doesn't have `onSalidaBorrada`, `tsc` will fail until Task 12 lands. This is expected and mirrors the same intentional sequencing as Task 8/11's ComponentePicker dependency — proceed directly to Task 12.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DetalleTablero.tsx frontend/src/components/DetalleTablero.test.tsx
git commit -m "feat: restructure DetalleTablero with Principal as first tab and fila CRUD icons"
```

---

## Task 12: Frontend — `SeccionBlock` — columna Acciones + modal de edición de salida consolidado

**Files:**
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`
- Modify: `frontend/src/api/client.ts` (breaking change to `actualizarSalida`'s signature — this is its only call site)

- [ ] **Step 1: Change `actualizarSalida`'s signature in `api/client.ts`**

In `frontend/src/api/client.ts`, replace the existing `actualizarSalida` function:

```ts
export async function actualizarSalida(salidaId: string, componenteId: string | null): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/salidas/${salidaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ componente_id: componenteId }),
  });
  if (!response.ok) throw new Error("No se pudo actualizar la salida");
  return response.json();
}
```

with:

```ts
export interface SalidaUpdateInput {
  carga_valor?: string;
  carga_unidad?: string;
  formato?: FormatoPolos;
  tipo_proteccion?: TipoProteccion;
  componente_id?: string | null;
}

export async function actualizarSalida(salidaId: string, cambios: SalidaUpdateInput): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/salidas/${salidaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  if (!response.ok) throw new Error("No se pudo actualizar la salida");
  return response.json();
}
```

- [ ] **Step 2: Rewrite the failing test file**

Replace the full content of `frontend/src/components/SeccionBlock.test.tsx` with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeccionBlock } from "./SeccionBlock";
import type { Seccion } from "../api/client";

const seccion: Seccion = { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 };

const salidaSinMatch = {
  id: "sal2",
  seccion_id: "s1",
  carga_valor: "10",
  carga_unidad: "A",
  formato: "unipolar" as const,
  tipo_proteccion: "seccional_termomagnetico" as const,
  componente_id: null,
  origen: "manual",
};

const salidaConMatch = {
  id: "sal3",
  seccion_id: "s1",
  carga_valor: "20",
  carga_unidad: "A",
  formato: "unipolar" as const,
  tipo_proteccion: "seccional_termomagnetico" as const,
  componente_id: "c1",
  origen: "manual",
};

describe("SeccionBlock", () => {
  it("creates a salida with an automatic proposal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "sal1",
          seccion_id: "s1",
          carga_valor: "16",
          carga_unidad: "A",
          formato: "unipolar",
          tipo_proteccion: "seccional_termomagnetico",
          componente_id: "c1",
          origen: "manual",
        }),
      }),
    );
    const onSalidaCreada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[]}
        onSalidaCreada={onSalidaCreada}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/carga/i), "16");
    await userEvent.click(screen.getByRole("button", { name: /agregar salida/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/secciones/s1/salidas"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(onSalidaCreada).toHaveBeenCalledWith(expect.objectContaining({ id: "sal1" }));
  });

  it("shows 'sin match' with no inline picker for a salida without a matched component", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaSinMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    const fila = screen.getByRole("row", { name: /10 a/i });
    expect(fila).toHaveTextContent(/sin match/i);
    expect(screen.queryByLabelText(/buscar código/i)).not.toBeInTheDocument();
  });

  it("shows a filled badge with the matched component id when a salida has a match", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    const fila = screen.getByRole("row", { name: /20 a/i });
    expect(fila).toHaveTextContent(/propuesto: c1/i);
  });

  it("opens the edit modal and saves changed carga/formato/protección fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...salidaConMatch, carga_valor: "30.00" }),
      }),
    );
    const onSalidaActualizada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={onSalidaActualizada}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    const input = screen.getByLabelText(/^carga$/i) as HTMLInputElement;
    expect(input.value).toBe("20");
    await userEvent.clear(input);
    await userEvent.type(input, "30");
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/salidas/sal3"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(onSalidaActualizada).toHaveBeenCalledWith(expect.objectContaining({ carga_valor: "30.00" }));
  });

  it("reassigns the component of an already-matched salida from the edit modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/catalogo/buscar")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              resultados: [{ id: "c9", codigo: "XT2N100", descripcion: "Otro interruptor", precio_neto: "10.00" }],
              total: 1,
            }),
          });
        }
        if (init?.method === "PATCH") {
          return Promise.resolve({ ok: true, json: async () => ({ ...salidaConMatch, componente_id: "c9" }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }),
    );
    const onSalidaActualizada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={onSalidaActualizada}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /cambiar componente/i }));
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N100");
    await userEvent.click(await screen.findByRole("button", { name: /XT2N100/i }));

    expect(onSalidaActualizada).toHaveBeenCalledWith(expect.objectContaining({ componente_id: "c9" }));
  });

  it("deletes a salida after confirming", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const onSalidaBorrada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={onSalidaBorrada}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /borrar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/salidas/sal3"),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(onSalidaBorrada).toHaveBeenCalledWith("sal3");
  });

  it("cancelling the delete confirmation does not delete the salida", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const onSalidaBorrada = vi.fn();
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={onSalidaBorrada}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /borrar salida 20 a/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onSalidaBorrada).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: FAIL — `onSalidaBorrada` is an unknown prop, no "Acciones" column/icons exist yet.

- [ ] **Step 4: Rewrite the implementation**

Replace the full content of `frontend/src/components/SeccionBlock.tsx` with:

```tsx
import { useRef, useState, type FormEvent } from "react";
import {
  actualizarSalida,
  crearSalida,
  eliminarSalida,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type FormatoPolos,
  type Salida,
  type Seccion,
  type TipoProteccion,
} from "../api/client";
import { ComponentePicker } from "./ComponentePicker";
import { ConfirmDialog } from "./ConfirmDialog";

interface SeccionBlockProps {
  seccion: Seccion;
  salidas: Salida[];
  onSalidaCreada: (salida: Salida) => void;
  onSalidaActualizada: (salida: Salida) => void;
  onSalidaBorrada: (salidaId: string) => void;
}

export function SeccionBlock({
  seccion,
  salidas,
  onSalidaCreada,
  onSalidaActualizada,
  onSalidaBorrada,
}: SeccionBlockProps) {
  const [cargaValor, setCargaValor] = useState("");
  const [cargaUnidad, setCargaUnidad] = useState("A");
  const [formato, setFormato] = useState<FormatoPolos>("unipolar");
  const [tipoProteccion, setTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [error, setError] = useState<string | null>(null);
  const [salidaEnEdicion, setSalidaEnEdicion] = useState<Salida | null>(null);
  const [editCargaValor, setEditCargaValor] = useState("");
  const [editCargaUnidad, setEditCargaUnidad] = useState("A");
  const [editFormato, setEditFormato] = useState<FormatoPolos>("unipolar");
  const [editTipoProteccion, setEditTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [salidaABorrar, setSalidaABorrar] = useState<Salida | null>(null);
  const [borrando, setBorrando] = useState(false);
  const ultimoTriggerRef = useRef<HTMLElement | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const salida = await crearSalida(seccion.id, {
        carga_valor: cargaValor,
        carga_unidad: cargaUnidad,
        formato,
        tipo_proteccion: tipoProteccion,
      });
      onSalidaCreada(salida);
      setCargaValor("");
    } catch {
      setError("No se pudo crear la salida");
    }
  }

  function abrirEdicion(salida: Salida, trigger: HTMLElement) {
    ultimoTriggerRef.current = trigger;
    setSalidaEnEdicion(salida);
    setEditCargaValor(salida.carga_valor);
    setEditCargaUnidad(salida.carga_unidad);
    setEditFormato(salida.formato);
    setEditTipoProteccion(salida.tipo_proteccion);
    setError(null);
  }

  function cerrarEdicion() {
    setSalidaEnEdicion(null);
    setPickerAbierto(false);
    setError(null);
    ultimoTriggerRef.current?.focus();
  }

  async function handleGuardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!salidaEnEdicion) return;
    setError(null);
    try {
      const actualizada = await actualizarSalida(salidaEnEdicion.id, {
        carga_valor: editCargaValor,
        carga_unidad: editCargaUnidad,
        formato: editFormato,
        tipo_proteccion: editTipoProteccion,
      });
      onSalidaActualizada(actualizada);
      cerrarEdicion();
    } catch {
      setError("No se pudo actualizar la salida");
    }
  }

  async function handleReasignarComponente(componente: ComponenteBusqueda) {
    if (!salidaEnEdicion) return;
    try {
      const actualizada = await actualizarSalida(salidaEnEdicion.id, { componente_id: componente.id });
      onSalidaActualizada(actualizada);
      setSalidaEnEdicion(actualizada);
      setPickerAbierto(false);
    } catch {
      setError("No se pudo reasignar el componente");
    }
  }

  async function handleConfirmarBorrado() {
    if (!salidaABorrar) return;
    setBorrando(true);
    try {
      await eliminarSalida(salidaABorrar.id);
      onSalidaBorrada(salidaABorrar.id);
      setSalidaABorrar(null);
    } catch {
      setError("No se pudo borrar la salida");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="mt-4 border border-surface-stroke bg-white">
      <h3 className="border-b border-surface-stroke bg-industrial-gray p-4 font-bold uppercase tracking-widest">
        {seccion.nombre}
      </h3>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-surface-stroke text-xs uppercase tracking-widest text-secondary">
            <th scope="col" className="p-3">Carga</th>
            <th scope="col" className="p-3">Formato</th>
            <th scope="col" className="p-3">Estado</th>
            <th scope="col" className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {salidas.map((salida) => (
            <tr key={salida.id} className="border-b border-surface-stroke">
              <td className="p-3 font-mono">
                {salida.carga_valor} {salida.carga_unidad}
              </td>
              <td className="p-3">{salida.formato}</td>
              <td className="p-3">
                {salida.componente_id ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 bg-abb-red" /> propuesto: {salida.componente_id}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 border border-secondary" /> sin match
                  </span>
                )}
              </td>
              <td className="p-3">
                <div className="flex gap-3 text-on-background">
                  <button
                    type="button"
                    aria-label={`Editar salida ${salida.carga_valor} ${salida.carga_unidad}`}
                    onClick={(e) => abrirEdicion(salida, e.currentTarget)}
                    className="hover:text-abb-red"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar salida ${salida.carga_valor} ${salida.carga_unidad}`}
                    onClick={(e) => {
                      ultimoTriggerRef.current = e.currentTarget;
                      setSalidaABorrar(salida);
                    }}
                    className="hover:text-abb-red"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 p-4">
        <div>
          <label htmlFor={`carga-${seccion.id}`}>Carga</label>
          <input id={`carga-${seccion.id}`} value={cargaValor} onChange={(e) => setCargaValor(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`unidad-${seccion.id}`}>Unidad</label>
          <select id={`unidad-${seccion.id}`} value={cargaUnidad} onChange={(e) => setCargaUnidad(e.target.value)}>
            <option value="A">A</option>
            <option value="kW">kW</option>
          </select>
        </div>
        <div>
          <label htmlFor={`formato-${seccion.id}`}>Formato</label>
          <select
            id={`formato-${seccion.id}`}
            value={formato}
            onChange={(e) => setFormato(e.target.value as FormatoPolos)}
          >
            <option value="unipolar">Unipolar</option>
            <option value="bipolar">Bipolar</option>
            <option value="tripolar">Tripolar</option>
            <option value="tetrapolar">Tetrapolar</option>
          </select>
        </div>
        <div>
          <label htmlFor={`proteccion-${seccion.id}`}>Protección</label>
          <select
            id={`proteccion-${seccion.id}`}
            value={tipoProteccion}
            onChange={(e) => setTipoProteccion(e.target.value as TipoProteccion)}
          >
            <option value="seccional_termomagnetico">Termomagnético</option>
            <option value="seccional_diferencial">Diferencial</option>
          </select>
        </div>
        {error && !salidaEnEdicion && !salidaABorrar && <p role="alert" className="text-error">{error}</p>}
        <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Agregar salida
        </button>
      </form>

      {salidaEnEdicion && !pickerAbierto && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarEdicion}>
          <form
            onSubmit={handleGuardarEdicion}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-salida-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="editar-salida-titulo" className="text-lg font-bold">
              Editar salida
            </h2>
            <label htmlFor="edit-carga-valor">Carga</label>
            <input id="edit-carga-valor" value={editCargaValor} onChange={(e) => setEditCargaValor(e.target.value)} />
            <label htmlFor="edit-carga-unidad">Unidad</label>
            <select id="edit-carga-unidad" value={editCargaUnidad} onChange={(e) => setEditCargaUnidad(e.target.value)}>
              <option value="A">A</option>
              <option value="kW">kW</option>
            </select>
            <label htmlFor="edit-formato">Formato</label>
            <select
              id="edit-formato"
              value={editFormato}
              onChange={(e) => setEditFormato(e.target.value as FormatoPolos)}
            >
              <option value="unipolar">Unipolar</option>
              <option value="bipolar">Bipolar</option>
              <option value="tripolar">Tripolar</option>
              <option value="tetrapolar">Tetrapolar</option>
            </select>
            <label htmlFor="edit-proteccion">Protección</label>
            <select
              id="edit-proteccion"
              value={editTipoProteccion}
              onChange={(e) => setEditTipoProteccion(e.target.value as TipoProteccion)}
            >
              <option value="seccional_termomagnetico">Termomagnético</option>
              <option value="seccional_diferencial">Diferencial</option>
            </select>
            <p className="text-secondary">Componente: {salidaEnEdicion.componente_id ?? "sin definir"}</p>
            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              className="self-start border border-surface-stroke px-4 py-2 text-sm uppercase tracking-widest hover:border-abb-red hover:text-abb-red"
            >
              Cambiar componente
            </button>
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button
                type="button"
                onClick={cerrarEdicion}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {salidaEnEdicion && pickerAbierto && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          titulo="Cambiar componente"
          onSelect={handleReasignarComponente}
          onCancel={() => setPickerAbierto(false)}
        />
      )}

      {salidaABorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={`Esto va a borrar la salida de ${salidaABorrar.carga_valor} ${salidaABorrar.carga_unidad}.`}
          confirmando={borrando}
          onConfirm={handleConfirmarBorrado}
          onCancel={() => setSalidaABorrar(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx src/components/DetalleTablero.test.tsx src/pages/ProyectoWorkspacePage.test.tsx`
Expected: all PASS — this is the point where `DetalleTablero`'s dependency on `SeccionBlock`'s `onSalidaBorrada` prop (introduced in Task 11) is finally satisfied.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx frontend/src/api/client.ts
git commit -m "feat: add Acciones column and consolidated edit modal to SeccionBlock"
```

---

## Task 13: Docs — pregunta abierta sobre "regulación" en `consultas_ingenieria.md`

**Files:**
- Modify: `docs/consultas_ingenieria.md`

- [ ] **Step 1: Add the open question**

In `docs/consultas_ingenieria.md`, insert a new numbered entry after item 1 (before the `## Resueltas` heading, i.e. replace lines 22-25):

```markdown
### 2. Filtro de "regulación" (rango de regulación térmica/magnética ajustable) — no hay dato extraíble en el catálogo actual

**Encontrado:** 2026-07-18, durante el brainstorming del ciclo de UX de CRUD/Filas/buscador (`docs/superpowers/specs/2026-07-18-workspace-crud-filas-design.md`).

**Contexto:** El usuario pidió poder filtrar la búsqueda de interruptores por "regulación" además de polos/In, junto a SAP/código comercial/descripción. Se corrió una extracción real contra el catálogo completo de ABB (9.062 filas) usando el parser existente (`parser_abb.py`) para confirmar si ese dato existe como texto en las descripciones: no aparece en ninguna de las 3.837 filas de interruptores en alcance. El único lugar donde aparece la palabra "regulación" es en accesorios no relacionados (ej. bloqueo de regulación, tiempo de un relé diferencial), no como un rango numérico asociado al interruptor mismo.

**Por qué importa:** Sin un dato extraíble, cualquier filtro de "regulación" tendría que basarse en otra fuente (una tabla técnica de ABB distinta a la lista de precios actual, o carga manual por el analista) — no se puede resolver ampliando la regex del parser como se hizo con polos/In/capacidad de corte.

**Qué se necesita:** Confirmación de un ingeniero de PYRE: ¿existe una fuente de datos de ABB (tabla técnica, ficha de producto, u otro documento) que liste el rango de regulación ajustable por modelo de interruptor? Si existe, ¿en qué formato, y se puede importar/cruzar por código de producto?

**Mientras tanto:** el buscador de catálogo (`ComponentePicker` + `GET /catalogo/buscar`) solo filtra por texto libre (código/código comercial/descripción) y por categoría (`categorias`) — no hay filtro estructurado por polos/In/regulación en este ciclo.

## Resueltas

_(ninguna todavía)_
```

- [ ] **Step 2: Commit**

```bash
git add docs/consultas_ingenieria.md
git commit -m "docs: log open question about regulación filter data source"
```

---

## Task 14: Verificación final

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && venv\Scripts\pytest -v`
Expected: all PASS.

- [ ] **Step 2: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Rebuild and smoke-test in the browser**

The Docker images bake code at build time (`docker-compose.yml` has no bind mounts — see the "always rebuild after merge" gotcha discovered earlier this session). Rebuild before checking:

```bash
docker compose up --build -d frontend backend
```

Then, using the browser preview tools, walk through the golden path end to end:
1. Open Proyectos — create a project, edit its nombre/cliente via the card's edit icon, confirm the change sticks.
2. Open the project's workspace — create a tablero via the "＋" icon at the tab level, confirm it appears and activates.
3. Rename the active tablero via its icon, then create a second tablero and delete the first one, confirming the confirmation dialog shows the correct name and the tab list updates.
4. Inside a tablero, confirm the "Principal" tab appears first, edit the interruptor principal via its edit icon (using the new large modal with contained scroll — verify no page-level scrollbar appears when results overflow), and confirm "Intensidad de Cortocircuito (Icc)" shows with its own edit icon, separate from the fila tabs.
5. Add a fila via the "Nueva fila" icon, rename it, add a salida, edit the salida's carga/formato and reassign its component from the consolidated edit modal, then delete the salida and finally the fila — confirming each delete shows a confirmation dialog with an accurate description of what's being removed.
6. Confirm all management icons (edit/delete/new, at every level) render in neutral gray/black at rest and turn `text-abb-red` on hover, per the visual polish item.

- [ ] **Step 5: Update `CLAUDE.md`'s Fase C status line**

In `CLAUDE.md`, update the Fase C bullet to mention this cycle's completion (CRUD/Filas/buscador/visual polish), keeping the existing "Falta: BOM." note and the list of specs.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update Fase C status after CRUD/filas/buscador UX cycle"
```

---

## Self-Review

**Spec coverage:**
- A. CRUD faltante (proyecto/tablero/fila/salida, cascada, confirmación única) → Tasks 1-4 (backend), 7 (ConfirmDialog), 9-12 (frontend wiring). ✅
- B. Sección→Fila rename + interruptor principal como primera pestaña → Task 11. ✅
- C. Buscador modal ~700px con scroll contenido + filtro `categorias` requerido + backend `categorias` param + consolidación del picker inline de `SeccionBlock` → Tasks 5, 8, 12. ✅
- D. Pulido visual (Icc→"Intensidad de Cortocircuito" en línea propia, íconos neutros con hover rojo, "＋ Nuevo tablero" al nivel de pestañas) → Tasks 10, 11 (styling baked into every new icon: `text-on-background hover:text-abb-red` / `hover:text-abb-red`). ✅
- Fuera de alcance (accesorios, regulación, consolidación de proyecto) → explicitly not implemented; regulación logged in Task 13. ✅
- Testing section (cascada, categorias filtrado, modales, Principal distinguible) → covered by the specific new tests in each task. ✅

**Placeholder scan:** no "TBD"/"similar to Task N" — every step has complete, concrete code.

**Type consistency:** `SalidaUpdateInput`/`SeccionUpdate`/`ProyectoUpdate`/`TableroUpdate` types match their backend Pydantic counterparts field-for-field; `onSalidaBorrada`/`onTableroActualizado`/`onConfirm`/`onCancel` prop names are used identically across `DetalleTablero` ↔ `SeccionBlock` ↔ `ConfirmDialog` ↔ `ComponentePicker`. `CATEGORIAS_INTERRUPTORES` (frontend) mirrors `FAMILIAS_TERMOMAGNETICO ∪ {FAMILIA_DIFERENCIAL_COMBO}` (backend) by value, not by import (no build-time coupling between the two languages) — worth a code-review comment during Task 5/6/8 to confirm the five strings stay in sync if the backend categories ever change.

