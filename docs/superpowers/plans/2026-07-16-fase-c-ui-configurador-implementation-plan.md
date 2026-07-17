# UI mínima del configurador (Fase C, ciclo 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI funcional (sin pulido visual) para el flujo completo de carga manual-asistida: listar/crear proyectos → crear tablero → agregar secciones/salidas con propuesta automática del motor → esquema visual con cajas proporcionales → editar parámetros de cálculo.

**Architecture:** Dos endpoints backend chicos que faltaban (búsqueda de catálogo, listar recursos hijos) + páginas React nuevas siguiendo el patrón ya establecido en `CatalogoPage.tsx`/`LoginPage.tsx` (estado local con `useState`, `fetch` plano en `api/client.ts`, sin librería de manejo de estado global). Dos componentes reutilizables: `ComponentePicker` (buscador de catálogo) y `EsquemaVisual` (SVG de cajas proporcionales).

**Tech Stack:** Backend: FastAPI + SQLAlchemy 2.0 + pytest (igual que el ciclo 1). Frontend: React 19 + React Router 7 + Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-16-fase-c-ui-configurador-design.md`

**Nota de alcance descubierta durante la planificación:** el ciclo 1 no dejó forma de *listar* tableros de un proyecto, secciones de un tablero, ni salidas de una sección (solo `POST`/`GET` de un recurso puntual) — sin eso, la UI pierde todo lo cargado al recargar la página o volver más tarde. Este plan agrega esos tres `GET` de listado (Task 2) antes de tocar el frontend. También se descubrió que no hay forma de cambiar el interruptor principal de un tablero después de creado — en vez de agregar un `PATCH` nuevo, el picker de interruptor principal se resuelve en el formulario de creación del tablero (ya acepta `interruptor_principal_id` opcional), evitando ampliar la API más de lo necesario.

---

### Task 1: Backend — `GET /catalogo/buscar`

**Files:**
- Modify: `backend/app/routers/catalogo.py`
- Test: `backend/tests/test_catalogo_buscar_endpoint.py`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/tests/test_catalogo_buscar_endpoint.py`:
```python
from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _login(client, db_session, email="buscarcat.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def _componente(db_session, codigo, descripcion):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        categoria_path=["Interruptores Termomagneticos"],
        categoria_raiz="Interruptores Termomagneticos",
        descripcion=descripcion,
        unidad="Unidad",
        precio_neto=Decimal("42.00"),
        archivo_origen="test.xlsx",
        fila_origen=1,
    )
    db_session.add(componente)
    db_session.commit()
    return componente


def test_buscar_requiere_autenticacion(client):
    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR"})

    assert response.status_code == 401


def test_buscar_encuentra_por_codigo(client, db_session):
    _login(client, db_session)
    componente = _componente(db_session, "ZQXBUSCAR-C1", "Interruptor de prueba")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR-C1"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(componente.id)
    assert body[0]["codigo"] == "ZQXBUSCAR-C1"


def test_buscar_encuentra_por_descripcion(client, db_session):
    _login(client, db_session, email="buscarcat2.test@pyre.com")
    componente = _componente(db_session, "ZQXBUSCAR-C2", "Interruptor ZQXBUSCAR especial")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR especial"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(componente.id)


def test_buscar_con_termino_corto_devuelve_vacio(client, db_session):
    _login(client, db_session, email="buscarcat3.test@pyre.com")

    response = client.get("/catalogo/buscar", params={"q": "z"})

    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: FAIL — la ruta `/catalogo/buscar` no existe (404 en vez de 401/200).

- [ ] **Step 3: Implementar el endpoint**

`backend/app/routers/catalogo.py` — reemplazar el archivo completo (agrega imports, el modelo de respuesta y la ruta nueva; el resto queda igual):

```python
import io
import zipfile
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.catalogo.parser_abb import parse_abb_workbook
from app.catalogo.parser_otros import parse_otros_workbook
from app.catalogo.upsert import upsert_componentes
from app.database import get_db
from app.models import CatalogoComponente, RolUsuario, Usuario

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
    except (ValueError, KeyError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return upsert_componentes(db, items, usuario_id=usuario.id)


class ComponenteBusquedaResponse(BaseModel):
    id: str
    codigo: str
    descripcion: str
    precio_neto: Decimal | None

    model_config = {"from_attributes": True}


@router.get("/buscar", response_model=list[ComponenteBusquedaResponse])
def buscar_componentes(
    q: str = "",
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    if len(q.strip()) < 2:
        return []

    termino = f"%{q.strip()}%"
    componentes = (
        db.query(CatalogoComponente)
        .filter(or_(CatalogoComponente.codigo.ilike(termino), CatalogoComponente.descripcion.ilike(termino)))
        .order_by(CatalogoComponente.codigo)
        .limit(20)
        .all()
    )
    return [
        ComponenteBusquedaResponse(id=str(c.id), codigo=c.codigo, descripcion=c.descripcion, precio_neto=c.precio_neto)
        for c in componentes
    ]
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Correr toda la suite del backend**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS (78 tests — 74 previos + 4 nuevos)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/catalogo.py backend/tests/test_catalogo_buscar_endpoint.py
git commit -m "feat: add catalogo search endpoint"
```

---

### Task 2: Backend — listar tableros/secciones/salidas

**Files:**
- Modify: `backend/app/routers/tableros.py`
- Modify: `backend/app/routers/salidas.py`
- Modify: `backend/tests/test_tableros_endpoint.py`
- Modify: `backend/tests/test_salidas_endpoint.py`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `backend/tests/test_tableros_endpoint.py`:
```python
def test_listar_tableros_devuelve_los_creados(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="listartableros.test@pyre.com")
    client.post(f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"})
    client.post(f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG2", "nivel_falla_ka": "10.00"})

    response = client.get(f"/proyectos/{proyecto_id}/tableros")

    assert response.status_code == 200
    nombres = [t["nombre"] for t in response.json()]
    assert nombres == ["TG1", "TG2"]


def test_listar_secciones_devuelve_las_creadas(client, db_session):
    proyecto_id = _proyecto(client, db_session, email="listarsecciones.test@pyre.com")
    tablero_id = client.post(
        f"/proyectos/{proyecto_id}/tableros", json={"nombre": "TG1", "nivel_falla_ka": "10.00"}
    ).json()["id"]
    client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección A", "orden": 1})
    client.post(f"/tableros/{tablero_id}/secciones", json={"nombre": "Sección B", "orden": 2})

    response = client.get(f"/tableros/{tablero_id}/secciones")

    assert response.status_code == 200
    nombres = [s["nombre"] for s in response.json()]
    assert nombres == ["Sección A", "Sección B"]
```

Agregar al final de `backend/tests/test_salidas_endpoint.py`:
```python
def test_listar_salidas_devuelve_las_creadas(client, db_session):
    seccion_id = _setup_tablero(client, db_session, "salidas6.test@pyre.com")
    primera = client.post(
        f"/secciones/{seccion_id}/salidas",
        json={
            "carga_valor": "10",
            "carga_unidad": "A",
            "formato": "unipolar",
            "tipo_proteccion": "seccional_termomagnetico",
        },
    ).json()

    response = client.get(f"/secciones/{seccion_id}/salidas")

    assert response.status_code == 200
    ids = [s["id"] for s in response.json()]
    assert ids == [primera["id"]]
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_tableros_endpoint.py tests/test_salidas_endpoint.py -v`
Expected: los 3 tests nuevos FALLAN (404, rutas no existen).

- [ ] **Step 3: Agregar los endpoints de listado**

En `backend/app/routers/tableros.py`, agregar (después de `crear_tablero`, antes de `obtener_tablero` — el orden entre funciones no importa para FastAPI, pero mantiene la ruta agrupada con su recurso):

```python
@router.get("/proyectos/{proyecto_id}/tableros", response_model=list[TableroResponse])
def listar_tableros(
    proyecto_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    proyecto = db.get(Proyecto, proyecto_id)
    if proyecto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    tableros = db.query(Tablero).filter(Tablero.proyecto_id == proyecto_id).all()
    return [_tablero_response(t) for t in tableros]
```

Y al final del archivo (después de `crear_seccion`):

```python
@router.get("/tableros/{tablero_id}/secciones", response_model=list[SeccionResponse])
def listar_secciones(
    tablero_id: uuid.UUID, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_user)
):
    tablero = db.get(Tablero, tablero_id)
    if tablero is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tablero no encontrado")
    secciones = db.query(Seccion).filter(Seccion.tablero_id == tablero_id).order_by(Seccion.orden).all()
    return [_seccion_response(s) for s in secciones]
```

`get_current_user` ya está importado en este archivo (junto con `require_role`) — no hace falta tocar los imports.

En `backend/app/routers/salidas.py`, cambiar el import de auth:
```python
from app.auth.dependencies import require_role
```
por:
```python
from app.auth.dependencies import get_current_user, require_role
```

Y agregar al final del archivo (después de `actualizar_salida`):

```python
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

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_tableros_endpoint.py tests/test_salidas_endpoint.py -v`
Expected: PASS (7 + 6 = 13 tests)

- [ ] **Step 5: Correr toda la suite del backend**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS (81 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/tableros.py backend/app/routers/salidas.py backend/tests/test_tableros_endpoint.py backend/tests/test_salidas_endpoint.py
git commit -m "feat: add listing endpoints for tableros, secciones and salidas"
```

---

### Task 3: Frontend — cliente API

**Files:**
- Modify: `frontend/src/api/client.ts`

No hay test dedicado para este archivo (sigue la convención existente: `api/client.ts` no tiene su propio archivo de test — se ejercita indirectamente a través de los tests de página/componente de los tasks siguientes, igual que `login`/`fetchCurrentUser` se ejercitan vía `LoginPage.test.tsx`).

- [ ] **Step 1: Agregar tipos y funciones**

Agregar al final de `frontend/src/api/client.ts` (después de `importarCatalogo`):

```typescript
export interface Proyecto {
  id: string;
  cliente: string;
  nombre: string;
  analista_id: string;
  estado: string;
}

export async function listarProyectos(): Promise<Proyecto[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar los proyectos");
  return response.json();
}

export async function crearProyecto(cliente: string, nombre: string): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ cliente, nombre }),
  });
  if (!response.ok) throw new Error("No se pudo crear el proyecto");
  return response.json();
}

export async function obtenerProyecto(id: string): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudo obtener el proyecto");
  return response.json();
}

export interface Tablero {
  id: string;
  proyecto_id: string;
  nombre: string;
  nivel_falla_ka: string;
  interruptor_principal_id: string | null;
}

export async function listarTableros(proyectoId: string): Promise<Tablero[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${proyectoId}/tableros`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar los tableros");
  return response.json();
}

export async function crearTablero(
  proyectoId: string,
  nombre: string,
  nivelFallaKa: string,
  interruptorPrincipalId: string | null,
): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${proyectoId}/tableros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      nombre,
      nivel_falla_ka: nivelFallaKa,
      interruptor_principal_id: interruptorPrincipalId,
    }),
  });
  if (!response.ok) throw new Error("No se pudo crear el tablero");
  return response.json();
}

export async function obtenerTablero(id: string): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudo obtener el tablero");
  return response.json();
}

export interface Seccion {
  id: string;
  tablero_id: string;
  nombre: string;
  orden: number;
}

export async function listarSecciones(tableroId: string): Promise<Seccion[]> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar las secciones");
  return response.json();
}

export async function crearSeccion(tableroId: string, nombre: string, orden: number): Promise<Seccion> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nombre, orden }),
  });
  if (!response.ok) throw new Error("No se pudo crear la sección");
  return response.json();
}

export type FormatoPolos = "unipolar" | "bipolar" | "tetrapolar";
export type TipoProteccion = "seccional_termomagnetico" | "seccional_diferencial";

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

export interface SalidaInput {
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
}

export async function listarSalidas(seccionId: string): Promise<Salida[]> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar las salidas");
  return response.json();
}

export async function crearSalida(seccionId: string, datos: SalidaInput): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error("No se pudo crear la salida");
  return response.json();
}

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

export interface ComponenteBusqueda {
  id: string;
  codigo: string;
  descripcion: string;
  precio_neto: string | null;
}

export async function buscarCatalogo(q: string): Promise<ComponenteBusqueda[]> {
  const response = await fetch(`${API_BASE_URL}/catalogo/buscar?q=${encodeURIComponent(q)}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo buscar en el catálogo");
  return response.json();
}

export interface ParametroCalculo {
  tension_mono_v: string;
  tension_tri_v: string;
  cos_phi: string;
  ratio_selectividad: string;
}

export async function obtenerParametrosCalculo(): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron obtener los parámetros de cálculo");
  return response.json();
}

export async function actualizarParametrosCalculo(parametros: ParametroCalculo): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(parametros),
  });
  if (!response.ok) throw new Error("No se pudieron actualizar los parámetros de cálculo");
  return response.json();
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add API client functions for proyectos/tableros/secciones/salidas"
```

---

### Task 4: Frontend — `ComponentePicker`

**Files:**
- Create: `frontend/src/components/ComponentePicker.tsx`
- Test: `frontend/src/components/ComponentePicker.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`frontend/src/components/ComponentePicker.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentePicker } from "./ComponentePicker";

describe("ComponentePicker", () => {
  it("does not search with fewer than 2 characters", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "a");

    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows results and calls onSelect when clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
      }),
    );
    const onSelect = vi.fn();
    render(<ComponentePicker onSelect={onSelect} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await userEvent.click(await screen.findByRole("button", { name: /SH201-C16/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", codigo: "SH201-C16" }));
  });

  it("shows 'sin resultados' when the search returns nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "zzzz");

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx`
Expected: FAIL — el módulo `./ComponentePicker` no existe.

- [ ] **Step 3: Implementar el componente**

`frontend/src/components/ComponentePicker.tsx`:
```tsx
import { useState } from "react";
import { buscarCatalogo, type ComponenteBusqueda } from "../api/client";

interface ComponentePickerProps {
  onSelect: (componente: ComponenteBusqueda) => void;
}

export function ComponentePicker({ onSelect }: ComponentePickerProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ComponenteBusqueda[] | null>(null);

  async function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResultados(null);
      return;
    }
    const encontrados = await buscarCatalogo(value);
    setResultados(encontrados);
  }

  return (
    <div>
      <input aria-label="Buscar código o descripción" value={query} onChange={(e) => handleChange(e.target.value)} />
      {resultados !== null && resultados.length === 0 && <p>sin resultados</p>}
      {resultados !== null && (
        <ul>
          {resultados.map((componente) => (
            <li key={componente.id}>
              <button type="button" onClick={() => onSelect(componente)}>
                {componente.codigo} — {componente.descripcion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ComponentePicker.tsx frontend/src/components/ComponentePicker.test.tsx
git commit -m "feat: add ComponentePicker component"
```

---

### Task 5: Frontend — `EsquemaVisual`

**Files:**
- Create: `frontend/src/components/EsquemaVisual.tsx`
- Test: `frontend/src/components/EsquemaVisual.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`frontend/src/components/EsquemaVisual.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EsquemaVisual } from "./EsquemaVisual";
import type { Salida, Seccion } from "../api/client";

const seccion: Seccion = { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 };

function salida(overrides: Partial<Salida>): Salida {
  return {
    id: "sal1",
    seccion_id: "s1",
    carga_valor: "10",
    carga_unidad: "A",
    formato: "unipolar",
    tipo_proteccion: "seccional_termomagnetico",
    componente_id: "c1",
    origen: "manual",
    ...overrides,
  };
}

describe("EsquemaVisual", () => {
  it("draws a wider rectangle for more poles", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-tetra", formato: "tetrapolar" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-tetra")).toHaveAttribute("width", "96");
  });

  it("uses the color matching tipo_proteccion", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-dif", tipo_proteccion: "seccional_diferencial" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-dif")).toHaveAttribute("fill", "#d94a6a");
  });

  it("draws a dashed outline with no fill when there is no matched component", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-sinmatch", componente_id: null })] }]}
      />,
    );

    const rect = screen.getByTestId("salida-sal-sinmatch");
    expect(rect).toHaveAttribute("fill", "none");
    expect(rect).toHaveAttribute("stroke-dasharray", "2,2");
  });

  it("renders the interruptor principal block only when present", () => {
    const { rerender } = render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} />);
    expect(screen.queryByTestId("interruptor-principal")).not.toBeInTheDocument();

    rerender(<EsquemaVisual tieneInterruptorPrincipal={true} secciones={[]} />);
    expect(screen.getByTestId("interruptor-principal")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npx vitest run src/components/EsquemaVisual.test.tsx`
Expected: FAIL — el módulo `./EsquemaVisual` no existe.

- [ ] **Step 3: Implementar el componente**

`frontend/src/components/EsquemaVisual.tsx`:
```tsx
import type { Salida, Seccion } from "../api/client";

const ANCHO_POR_POLO = 24;
const ALTO = 24;

const POLOS_POR_FORMATO: Record<Salida["formato"], number> = {
  unipolar: 1,
  bipolar: 2,
  tetrapolar: 4,
};

const COLOR_POR_TIPO: Record<Salida["tipo_proteccion"], string> = {
  seccional_termomagnetico: "#4a90d9",
  seccional_diferencial: "#d94a6a",
};

interface EsquemaVisualProps {
  tieneInterruptorPrincipal: boolean;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
}

export function EsquemaVisual({ tieneInterruptorPrincipal, secciones }: EsquemaVisualProps) {
  const alturaTotal = 50 + secciones.length * (ALTO + 20) + 20;

  return (
    <svg role="img" aria-label="Esquema visual del tablero" width={480} height={alturaTotal}>
      {tieneInterruptorPrincipal && (
        <rect data-testid="interruptor-principal" x={20} y={10} width={120} height={ALTO} fill="#e0a030" />
      )}
      {secciones.map(({ seccion, salidas }, seccionIndex) => {
        const y = 50 + seccionIndex * (ALTO + 20);
        let x = 20;
        return (
          <g key={seccion.id}>
            {salidas.map((salida) => {
              const ancho = ANCHO_POR_POLO * POLOS_POR_FORMATO[salida.formato];
              const rectX = x;
              x += ancho + 4;
              return (
                <rect
                  key={salida.id}
                  data-testid={`salida-${salida.id}`}
                  x={rectX}
                  y={y}
                  width={ancho}
                  height={ALTO}
                  fill={salida.componente_id ? COLOR_POR_TIPO[salida.tipo_proteccion] : "none"}
                  stroke={salida.componente_id ? "none" : "#888"}
                  strokeDasharray={salida.componente_id ? undefined : "2,2"}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npx vitest run src/components/EsquemaVisual.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EsquemaVisual.tsx frontend/src/components/EsquemaVisual.test.tsx
git commit -m "feat: add EsquemaVisual component"
```

---

### Task 6: Frontend — `ProyectosPage`

**Files:**
- Create: `frontend/src/pages/ProyectosPage.tsx`
- Test: `frontend/src/pages/ProyectosPage.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`frontend/src/pages/ProyectosPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProyectosPage } from "./ProyectosPage";

describe("ProyectosPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "p2",
              cliente: "Cliente Nuevo",
              nombre: "Proyecto Nuevo",
              analista_id: "a1",
              estado: "en_curso",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" }],
        });
      }),
    );
  });

  it("lists existing projects", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Proyecto Existente/i)).toBeInTheDocument();
  });

  it("creates a new project and adds it to the list", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.type(screen.getByLabelText(/cliente/i), "Cliente Nuevo");
    await userEvent.type(screen.getByLabelText(/nombre/i), "Proyecto Nuevo");
    await userEvent.click(screen.getByRole("button", { name: /crear proyecto/i }));

    expect(await screen.findByText(/Proyecto Nuevo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx`
Expected: FAIL — el módulo `./ProyectosPage` no existe.

- [ ] **Step 3: Implementar la página**

`frontend/src/pages/ProyectosPage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { crearProyecto, listarProyectos, type Proyecto } from "../api/client";

export function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [cliente, setCliente] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch(() => setError("No se pudieron cargar los proyectos"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const proyecto = await crearProyecto(cliente, nombre);
      setProyectos((actuales) => [...actuales, proyecto]);
      setCliente("");
      setNombre("");
    } catch {
      setError("No se pudo crear el proyecto");
    }
  }

  return (
    <div>
      <h1>Proyectos</h1>
      <ul>
        {proyectos.map((proyecto) => (
          <li key={proyecto.id}>
            <Link to={`/proyectos/${proyecto.id}`}>
              {proyecto.nombre} — {proyecto.cliente}
            </Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>Nuevo proyecto</h2>
        <label htmlFor="cliente">Cliente</label>
        <input id="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear proyecto</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProyectosPage.tsx frontend/src/pages/ProyectosPage.test.tsx
git commit -m "feat: add ProyectosPage"
```

---

### Task 7: Frontend — `ProyectoDetallePage`

**Files:**
- Create: `frontend/src/pages/ProyectoDetallePage.tsx`
- Test: `frontend/src/pages/ProyectoDetallePage.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`frontend/src/pages/ProyectoDetallePage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProyectoDetallePage } from "./ProyectoDetallePage";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/proyectos/p1"]}>
      <Routes>
        <Route path="/proyectos/:id" element={<ProyectoDetallePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProyectoDetallePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "t2",
              proyecto_id: "p1",
              nombre: "TG2",
              nivel_falla_ka: "10.00",
              interruptor_principal_id: null,
            }),
          });
        }
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
          json: async () => ({ id: "p1", cliente: "Cliente A", nombre: "Proyecto A", analista_id: "a1", estado: "en_curso" }),
        });
      }),
    );
  });

  it("shows the project and its existing tableros", async () => {
    renderPage();

    expect(await screen.findByText("Proyecto A")).toBeInTheDocument();
    expect(await screen.findByText("TG1")).toBeInTheDocument();
  });

  it("creates a new tablero and adds it to the list", async () => {
    renderPage();
    await screen.findByText("TG1");

    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG2");
    await userEvent.type(screen.getByLabelText(/nivel de falla/i), "10.00");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));

    expect(await screen.findByText("TG2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npx vitest run src/pages/ProyectoDetallePage.test.tsx`
Expected: FAIL — el módulo `./ProyectoDetallePage` no existe.

- [ ] **Step 3: Implementar la página**

`frontend/src/pages/ProyectoDetallePage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  crearTablero,
  listarTableros,
  obtenerProyecto,
  type ComponenteBusqueda,
  type Proyecto,
  type Tablero,
} from "../api/client";
import { ComponentePicker } from "../components/ComponentePicker";

export function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tableros, setTableros] = useState<Tablero[]>([]);
  const [nombre, setNombre] = useState("");
  const [nivelFallaKa, setNivelFallaKa] = useState("");
  const [interruptorPrincipal, setInterruptorPrincipal] = useState<ComponenteBusqueda | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    obtenerProyecto(id)
      .then(setProyecto)
      .catch(() => setError("No se pudo cargar el proyecto"));
    listarTableros(id)
      .then(setTableros)
      .catch(() => setError("No se pudieron cargar los tableros"));
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const tablero = await crearTablero(id, nombre, nivelFallaKa, interruptorPrincipal?.id ?? null);
      setTableros((actuales) => [...actuales, tablero]);
      setNombre("");
      setNivelFallaKa("");
      setInterruptorPrincipal(null);
    } catch {
      setError("No se pudo crear el tablero");
    }
  }

  if (!proyecto) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{proyecto.nombre}</h1>
      <p>{proyecto.cliente}</p>
      <ul>
        {tableros.map((tablero) => (
          <li key={tablero.id}>
            <Link to={`/tableros/${tablero.id}`}>{tablero.nombre}</Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>Nuevo tablero</h2>
        <label htmlFor="nombre-tablero">Nombre</label>
        <input id="nombre-tablero" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label htmlFor="nivel-falla">Nivel de falla (kA)</label>
        <input id="nivel-falla" value={nivelFallaKa} onChange={(e) => setNivelFallaKa(e.target.value)} />
        <p>Interruptor principal{interruptorPrincipal ? `: ${interruptorPrincipal.codigo}` : " (opcional)"}</p>
        <ComponentePicker onSelect={setInterruptorPrincipal} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear tablero</button>
      </form>
    </div>
  );
}
```

Nota: el `<label htmlFor="nombre-tablero">Nombre</label>` es ambiguo con cualquier otro campo "nombre" en la página — por eso el test usa `/^nombre$/i` (coincidencia exacta) en vez de `/nombre/i`, que también matchearía "Nuevo tablero" si fuera un label (no lo es, es un `h2`, pero se mantiene la anclada por claridad).

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npx vitest run src/pages/ProyectoDetallePage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProyectoDetallePage.tsx frontend/src/pages/ProyectoDetallePage.test.tsx
git commit -m "feat: add ProyectoDetallePage"
```

---

### Task 8: Frontend — `SeccionBlock`

**Files:**
- Create: `frontend/src/components/SeccionBlock.tsx`
- Test: `frontend/src/components/SeccionBlock.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`frontend/src/components/SeccionBlock.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeccionBlock } from "./SeccionBlock";
import type { Seccion } from "../api/client";

const seccion: Seccion = { id: "s1", tablero_id: "t1", nombre: "Sección 1", orden: 0 };

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
      <SeccionBlock seccion={seccion} salidas={[]} onSalidaCreada={onSalidaCreada} onSalidaActualizada={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText(/carga/i), "16");
    await userEvent.click(screen.getByRole("button", { name: /agregar salida/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/secciones/s1/salidas"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(onSalidaCreada).toHaveBeenCalledWith(expect.objectContaining({ id: "sal1" }));
  });

  it("shows a picker to override manually when a salida has no matched component", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[
          {
            id: "sal2",
            seccion_id: "s1",
            carga_valor: "10",
            carga_unidad: "A",
            formato: "unipolar",
            tipo_proteccion: "seccional_termomagnetico",
            componente_id: null,
            origen: "manual",
          },
        ]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
      />,
    );

    expect(screen.getByText(/sin match/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar código/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: FAIL — el módulo `./SeccionBlock` no existe.

- [ ] **Step 3: Implementar el componente**

`frontend/src/components/SeccionBlock.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import {
  actualizarSalida,
  crearSalida,
  type ComponenteBusqueda,
  type FormatoPolos,
  type Salida,
  type Seccion,
  type TipoProteccion,
} from "../api/client";
import { ComponentePicker } from "./ComponentePicker";

interface SeccionBlockProps {
  seccion: Seccion;
  salidas: Salida[];
  onSalidaCreada: (salida: Salida) => void;
  onSalidaActualizada: (salida: Salida) => void;
}

export function SeccionBlock({ seccion, salidas, onSalidaCreada, onSalidaActualizada }: SeccionBlockProps) {
  const [cargaValor, setCargaValor] = useState("");
  const [cargaUnidad, setCargaUnidad] = useState("A");
  const [formato, setFormato] = useState<FormatoPolos>("unipolar");
  const [tipoProteccion, setTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [error, setError] = useState<string | null>(null);

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

  async function handleOverride(salidaId: string, componente: ComponenteBusqueda) {
    const actualizada = await actualizarSalida(salidaId, componente.id);
    onSalidaActualizada(actualizada);
  }

  return (
    <div>
      <h3>{seccion.nombre}</h3>
      <ul>
        {salidas.map((salida) => (
          <li key={salida.id}>
            {salida.carga_valor} {salida.carga_unidad} — {salida.formato} —{" "}
            {salida.componente_id ? `propuesto: ${salida.componente_id}` : "sin match"}
            {!salida.componente_id && (
              <ComponentePicker onSelect={(componente) => handleOverride(salida.id, componente)} />
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label htmlFor={`carga-${seccion.id}`}>Carga</label>
        <input id={`carga-${seccion.id}`} value={cargaValor} onChange={(e) => setCargaValor(e.target.value)} />
        <label htmlFor={`unidad-${seccion.id}`}>Unidad</label>
        <select id={`unidad-${seccion.id}`} value={cargaUnidad} onChange={(e) => setCargaUnidad(e.target.value)}>
          <option value="A">A</option>
          <option value="kW">kW</option>
        </select>
        <label htmlFor={`formato-${seccion.id}`}>Formato</label>
        <select
          id={`formato-${seccion.id}`}
          value={formato}
          onChange={(e) => setFormato(e.target.value as FormatoPolos)}
        >
          <option value="unipolar">Unipolar</option>
          <option value="bipolar">Bipolar</option>
          <option value="tetrapolar">Tetrapolar</option>
        </select>
        <label htmlFor={`proteccion-${seccion.id}`}>Protección</label>
        <select
          id={`proteccion-${seccion.id}`}
          value={tipoProteccion}
          onChange={(e) => setTipoProteccion(e.target.value as TipoProteccion)}
        >
          <option value="seccional_termomagnetico">Termomagnético</option>
          <option value="seccional_diferencial">Diferencial</option>
        </select>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Agregar salida</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx
git commit -m "feat: add SeccionBlock component"
```

---

### Task 9: Frontend — `TableroPage`

**Files:**
- Create: `frontend/src/pages/TableroPage.tsx`
- Test: `frontend/src/pages/TableroPage.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`frontend/src/pages/TableroPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TableroPage } from "./TableroPage";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/tableros/t1"]}>
      <Routes>
        <Route path="/tableros/:id" element={<TableroPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TableroPage", () => {
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
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "t1",
            proyecto_id: "p1",
            nombre: "TG1",
            nivel_falla_ka: "10.00",
            interruptor_principal_id: "c1",
          }),
        });
      }),
    );
  });

  it("shows the tablero header and its existing secciones", async () => {
    renderPage();

    expect(await screen.findByText("TG1")).toBeInTheDocument();
    expect(await screen.findByText("Sección 1")).toBeInTheDocument();
  });

  it("adds a new sección", async () => {
    renderPage();
    await screen.findByText("Sección 1");

    await userEvent.type(screen.getByLabelText(/nueva sección/i), "Sección nueva");
    await userEvent.click(screen.getByRole("button", { name: /agregar sección/i }));

    expect(await screen.findByText("Sección nueva")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npx vitest run src/pages/TableroPage.test.tsx`
Expected: FAIL — el módulo `./TableroPage` no existe.

- [ ] **Step 3: Implementar la página**

`frontend/src/pages/TableroPage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  crearSeccion,
  listarSalidas,
  listarSecciones,
  obtenerTablero,
  type Salida,
  type Seccion,
  type Tablero,
} from "../api/client";
import { EsquemaVisual } from "../components/EsquemaVisual";
import { SeccionBlock } from "../components/SeccionBlock";

interface SeccionConSalidas {
  seccion: Seccion;
  salidas: Salida[];
}

export function TableroPage() {
  const { id } = useParams<{ id: string }>();
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
  const [nombreSeccion, setNombreSeccion] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    cargar(id);
  }, [id]);

  async function cargar(tableroId: string) {
    const [tableroCargado, seccionesCargadas] = await Promise.all([
      obtenerTablero(tableroId),
      listarSecciones(tableroId),
    ]);
    setTablero(tableroCargado);
    const conSalidas = await Promise.all(
      seccionesCargadas.map(async (seccion) => ({ seccion, salidas: await listarSalidas(seccion.id) })),
    );
    setSecciones(conSalidas);
  }

  async function handleAgregarSeccion(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const seccion = await crearSeccion(id, nombreSeccion, secciones.length);
      setSecciones((actuales) => [...actuales, { seccion, salidas: [] }]);
      setNombreSeccion("");
    } catch {
      setError("No se pudo crear la sección");
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

  if (!tablero) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{tablero.nombre}</h1>
      <p>Nivel de falla: {tablero.nivel_falla_ka} kA</p>
      <p>
        Interruptor principal: {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}
      </p>
      <EsquemaVisual tieneInterruptorPrincipal={!!tablero.interruptor_principal_id} secciones={secciones} />
      {secciones.map(({ seccion, salidas }) => (
        <SeccionBlock
          key={seccion.id}
          seccion={seccion}
          salidas={salidas}
          onSalidaCreada={(salida) => handleSalidaCreada(seccion.id, salida)}
          onSalidaActualizada={(salida) => handleSalidaActualizada(seccion.id, salida)}
        />
      ))}
      <form onSubmit={handleAgregarSeccion}>
        <label htmlFor="nombre-seccion">Nueva sección</label>
        <input id="nombre-seccion" value={nombreSeccion} onChange={(e) => setNombreSeccion(e.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Agregar sección</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npx vitest run src/pages/TableroPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TableroPage.tsx frontend/src/pages/TableroPage.test.tsx
git commit -m "feat: add TableroPage"
```

---

### Task 10: Frontend — `ParametrosCalculoPage`

**Files:**
- Create: `frontend/src/pages/ParametrosCalculoPage.tsx`
- Test: `frontend/src/pages/ParametrosCalculoPage.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/pages/ParametrosCalculoPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParametrosCalculoPage } from "./ParametrosCalculoPage";

describe("ParametrosCalculoPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tension_mono_v: "220.00",
          tension_tri_v: "380.00",
          cos_phi: "0.90",
          ratio_selectividad: "1.60",
        }),
      }),
    );
  });

  it("loads and saves the calculation parameters", async () => {
    render(<ParametrosCalculoPage />);

    const tensionMono = (await screen.findByLabelText(/tensión monofásica/i)) as HTMLInputElement;
    expect(tensionMono.value).toBe("220.00");

    await userEvent.clear(tensionMono);
    await userEvent.type(tensionMono, "230");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/parametros-calculo"),
      expect.objectContaining({ method: "PUT" }),
    );
    expect(await screen.findByText(/guardado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd frontend && npx vitest run src/pages/ParametrosCalculoPage.test.tsx`
Expected: FAIL — el módulo `./ParametrosCalculoPage` no existe.

- [ ] **Step 3: Implementar la página**

`frontend/src/pages/ParametrosCalculoPage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { actualizarParametrosCalculo, obtenerParametrosCalculo, type ParametroCalculo } from "../api/client";

export function ParametrosCalculoPage() {
  const [parametros, setParametros] = useState<ParametroCalculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    obtenerParametrosCalculo()
      .then(setParametros)
      .catch(() => setError("No se pudieron cargar los parámetros"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!parametros) return;
    setError(null);
    setGuardado(false);
    try {
      const actualizados = await actualizarParametrosCalculo(parametros);
      setParametros(actualizados);
      setGuardado(true);
    } catch {
      setError("No se pudieron guardar los parámetros");
    }
  }

  if (!parametros) return <p>Cargando...</p>;

  return (
    <form onSubmit={handleSubmit}>
      <h1>Parámetros de cálculo</h1>
      <label htmlFor="tension-mono">Tensión monofásica (V)</label>
      <input
        id="tension-mono"
        value={parametros.tension_mono_v}
        onChange={(e) => setParametros({ ...parametros, tension_mono_v: e.target.value })}
      />
      <label htmlFor="tension-tri">Tensión trifásica (V)</label>
      <input
        id="tension-tri"
        value={parametros.tension_tri_v}
        onChange={(e) => setParametros({ ...parametros, tension_tri_v: e.target.value })}
      />
      <label htmlFor="cos-phi">Cos φ</label>
      <input
        id="cos-phi"
        value={parametros.cos_phi}
        onChange={(e) => setParametros({ ...parametros, cos_phi: e.target.value })}
      />
      <label htmlFor="ratio-selectividad">Ratio de selectividad</label>
      <input
        id="ratio-selectividad"
        value={parametros.ratio_selectividad}
        onChange={(e) => setParametros({ ...parametros, ratio_selectividad: e.target.value })}
      />
      {error && <p role="alert">{error}</p>}
      {guardado && <p>Guardado</p>}
      <button type="submit">Guardar</button>
    </form>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd frontend && npx vitest run src/pages/ParametrosCalculoPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ParametrosCalculoPage.tsx frontend/src/pages/ParametrosCalculoPage.test.tsx
git commit -m "feat: add ParametrosCalculoPage"
```

---

### Task 11: Rutas, Dashboard y verificación final

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Agregar las rutas nuevas**

`frontend/src/App.tsx` (reemplazar el archivo completo):
```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { CatalogoPage } from "./pages/CatalogoPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ParametrosCalculoPage } from "./pages/ParametrosCalculoPage";
import { ProyectoDetallePage } from "./pages/ProyectoDetallePage";
import { ProyectosPage } from "./pages/ProyectosPage";
import { TableroPage } from "./pages/TableroPage";

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
        <Route
          path="/proyectos"
          element={
            <RequireAuth>
              <ProyectosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/proyectos/:id"
          element={
            <RequireAuth>
              <ProyectoDetallePage />
            </RequireAuth>
          }
        />
        <Route
          path="/tableros/:id"
          element={
            <RequireAuth>
              <TableroPage />
            </RequireAuth>
          }
        />
        <Route
          path="/parametros-calculo"
          element={
            <RequireAuth>
              <ParametrosCalculoPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

`frontend/src/pages/DashboardPage.tsx` (reemplazar el archivo completo):
```tsx
import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <div>
      <h1>Panel</h1>
      <Link to="/proyectos">Proyectos</Link>
      <Link to="/catalogo">Importar catálogo</Link>
      <Link to="/parametros-calculo">Parámetros de cálculo</Link>
    </div>
  );
}
```

- [ ] **Step 2: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: PASS — todos los tests (los preexistentes de auth/login/catálogo + los 15 nuevos de este ciclo).

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sin errores de tipos.

- [ ] **Step 4: Correr toda la suite de backend (por las dudas — no se tocó nada de backend en este task, pero confirma que el ciclo completo queda verde)**

Run: `cd backend && venv/Scripts/python -m pytest -v`
Expected: PASS (81 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: wire up routes for proyectos/tableros/parametros-calculo"
```

---

## Self-review notes

- **Cobertura de la spec:** Task 1 cubre el endpoint de búsqueda de catálogo; Task 2 cierra el gap de endpoints de listado descubierto durante la planificación (necesario para que la UI sobreviva a un refresh); Tasks 3-5 cubren el cliente API y los dos componentes reutilizables; Tasks 6-7 cubren proyectos/tableros; Tasks 8-9 cubren secciones/salidas + esquema visual integrado; Task 10 cubre parámetros de cálculo; Task 11 cierra el flujo de navegación.
- **Decisión de alcance:** el picker de interruptor principal vive en el formulario de creación de tablero (`ProyectoDetallePage`), no en `TableroPage` después de creado — evita agregar un `PATCH /tableros/{id}` que la spec no pidió y que no hacía falta.
- **Consistencia de tipos:** `FormatoPolos`, `TipoProteccion`, `ComponenteBusqueda`, `Salida`, `Seccion`, `Tablero`, `Proyecto`, `ParametroCalculo` se definen una sola vez en `api/client.ts` (Task 3) y se importan desde ahí en todos los componentes/páginas posteriores — ningún tipo se redefine.
