# Ciclo 10a — Feedback de formularios, picker con memoria, tablas responsive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six frontend-only UX fixes from the auditoría backlog: inline validation for integer amperage, loading indicators where missing, real backend error messages instead of generic ones, a discard-changes confirmation on edit modals, per-context search memory in `ComponentePicker`, and horizontal scroll for the salidas table on small screens.

**Architecture:** Every task lives entirely in `frontend/src/` — no backend changes (the backend already returns `{"detail": "..."}` on every `HTTPException`, and the "integer amperage" business rule is deliberately left untouched this cycle, see `docs/consultas_ingenieria.md` #4). Changes are spread across `api/client.ts` (a new shared error-propagation helper) and five components/pages, each independently testable.

**Tech Stack:** React 19/TypeScript + Vite + Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-07-20-ciclo-10a-feedback-formularios-design.md`

---

## Task 1: Rama

- [ ] **Step 1: Create the feature branch**

```bash
git checkout master
git pull --ff-only 2>/dev/null || true
git checkout -b feat/ciclo-10a-feedback-formularios
```

- [ ] **Step 2: Confirm both suites are green before starting**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q` and `cd frontend && npx vitest run`
Expected: both pass (no changes yet, this just confirms the starting point is clean).

---

## Task 2: Validación inline de carga en amperios (A)

**Files:**
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/SeccionBlock.test.tsx`, inside the `describe("SeccionBlock", ...)` block (before its closing `});`):

```tsx
  it("shows an inline error and disables submit when carga en A has decimals (new salida form)", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /nueva salida/i }));
    await userEvent.type(screen.getByLabelText(/^carga$/i), "16.5");

    expect(screen.getByText(/los amperios deben ser un valor entero/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar salida/i })).toBeDisabled();
  });

  it("does not show the inline error for a decimal carga when the unit is kW", async () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /nueva salida/i }));
    await userEvent.selectOptions(screen.getByLabelText(/^unidad$/i), "kW");
    await userEvent.type(screen.getByLabelText(/^carga$/i), "16.5");

    expect(screen.queryByText(/los amperios deben ser un valor entero/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar salida/i })).not.toBeDisabled();
  });

  it("shows the inline error and disables Guardar when editing a salida's carga to a decimal in A", async () => {
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
    const input = screen.getByLabelText(/^carga$/i);
    await userEvent.clear(input);
    await userEvent.type(input, "20.5");

    expect(screen.getByText(/los amperios deben ser un valor entero/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeDisabled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: the 3 new tests FAIL (no inline validation exists yet — both forms currently use a plain `<label>Carga</label>` with no `id`, so `getByLabelText(/^carga$/i)` will also fail to resolve until Step 3 adds the `htmlFor`/`id` pairing needed for the label queries to work).

- [ ] **Step 3: Implement**

In `frontend/src/components/SeccionBlock.tsx`, replace the "Nueva salida" form's Carga field:

```tsx
          <div>
            <label htmlFor={`carga-${seccion.id}`}>Carga</label>
            <input id={`carga-${seccion.id}`} value={cargaValor} onChange={(e) => setCargaValor(e.target.value)} />
          </div>
```

with:

```tsx
          <div>
            <label htmlFor={`carga-${seccion.id}`}>Carga</label>
            <input id={`carga-${seccion.id}`} value={cargaValor} onChange={(e) => setCargaValor(e.target.value)} />
            {cargaInvalidaEntero && (
              <p className="text-error text-sm">Los amperios deben ser un valor entero</p>
            )}
          </div>
```

Add the derived boolean right after the `useState` declarations (after the line `const [tipoProteccion, setTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");`):

```tsx
  const cargaInvalidaEntero = cargaUnidad === "A" && cargaValor.trim() !== "" && Number(cargaValor) % 1 !== 0;
```

Update the "Agregar salida" submit button to disable when invalid:

```tsx
            <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
              Agregar salida
            </button>
```

becomes:

```tsx
            <button
              type="submit"
              disabled={cargaInvalidaEntero}
              className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50"
            >
              Agregar salida
            </button>
```

Now the edit modal's Carga field — replace:

```tsx
            <label htmlFor="edit-carga-valor">Carga</label>
            <input
              id="edit-carga-valor"
              ref={editCargaInputRef}
              value={editCargaValor}
              onChange={(e) => setEditCargaValor(e.target.value)}
            />
```

with:

```tsx
            <label htmlFor="edit-carga-valor">Carga</label>
            <input
              id="edit-carga-valor"
              ref={editCargaInputRef}
              value={editCargaValor}
              onChange={(e) => setEditCargaValor(e.target.value)}
            />
            {editCargaInvalidaEntero && (
              <p className="text-error text-sm">Los amperios deben ser un valor entero</p>
            )}
```

Add the derived boolean right after the `useState` declarations for the edit fields (after `const [editTipoProteccion, setEditTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");`):

```tsx
  const editCargaInvalidaEntero =
    editCargaUnidad === "A" && editCargaValor.trim() !== "" && Number(editCargaValor) % 1 !== 0;
```

Update the edit modal's "Guardar" button:

```tsx
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
```

becomes:

```tsx
              <button
                type="submit"
                disabled={editCargaInvalidaEntero}
                className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50"
              >
                Guardar
              </button>
```

(There are two "Guardar" submit buttons of this exact original shape in the file after Task 6/7 land later in this plan too — at this point in the plan, only the edit-salida modal's "Guardar" exists with this exact text, so the replacement is unambiguous right now.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS (no regressions in other files that reference these buttons/labels).

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx
git commit -m "feat: validate integer amperage inline in salida forms"
```

---

## Task 3: Indicadores de carga (B)

**Files:**
- Modify: `frontend/src/pages/ProyectosPage.tsx`
- Modify: `frontend/src/pages/ProyectosPage.test.tsx`
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/pages/ProyectosPage.test.tsx`, inside the `describe("ProyectosPage", ...)` block (before its closing `});`), a test using a manually-deferred fetch response so "Cargando..." is observable before the list resolves:

```tsx
  it("shows a loading indicator before the projects list resolves", async () => {
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const pending = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nuevo proyecto/i })).not.toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => [{ id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" }],
    });
    await screen.findByText(/Proyecto Existente/i);
  });
```

Append to `frontend/src/components/DetalleTablero.test.tsx`, inside the `describe("DetalleTablero", ...)` block (before its closing `});`):

```tsx
  it("shows a loading indicator before the secciones list resolves", async () => {
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const pending = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    renderDetalle();

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Principal" })).not.toBeInTheDocument();

    resolveFetch({ ok: true, json: async () => [] });
    await screen.findByRole("tab", { name: "Principal" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx src/components/DetalleTablero.test.tsx`
Expected: the 2 new tests FAIL — both pages currently render the (empty) list immediately instead of a loading state, so `screen.getByText(/cargando/i)` throws.

- [ ] **Step 3: Implement**

In `frontend/src/pages/ProyectosPage.tsx`, change:

```tsx
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
```

to:

```tsx
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
```

Add an early return right before the final `return (` of the component (i.e., immediately after the closing `}` of `handleConfirmarBorrado`, before the line `return (`):

```tsx
  if (proyectos === null) return <p>Cargando...</p>;

  return (
```

(`proyectos.map(...)` inside the JSX below this point is unaffected — TypeScript narrows `proyectos` to `Proyecto[]` for the rest of the function body after this guard.)

In `frontend/src/components/DetalleTablero.tsx`, change:

```tsx
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
```

to:

```tsx
  const [secciones, setSecciones] = useState<SeccionConSalidas[] | null>(null);
```

This file computes `tabActivo`/`seccionSeleccionada`/`filaABorrarCantidadElementos` from `secciones` **before** all hooks have run (`useCerrarAlClickFuera` and the Escape-key `useEffect` are called after those derived values) — inserting an early return before those hook calls would violate the Rules of Hooks (hooks would be skipped on the loading render but called on every other render). So instead, those three derived values fall back to an empty array while loading, and the actual early return goes right before the final JSX return, after every hook has already run unconditionally.

Change:

```tsx
  const tabActivo =
    tabSeleccionadoRaw &&
    (tabSeleccionadoRaw === TAB_PRINCIPAL || secciones.some((s) => s.seccion.id === tabSeleccionadoRaw))
      ? tabSeleccionadoRaw
      : (secciones[0]?.seccion.id ?? TAB_PRINCIPAL);
  const seccionSeleccionada = secciones.find((s) => s.seccion.id === tabActivo) ?? null;
```

to:

```tsx
  const tabActivo =
    tabSeleccionadoRaw &&
    (tabSeleccionadoRaw === TAB_PRINCIPAL || (secciones ?? []).some((s) => s.seccion.id === tabSeleccionadoRaw))
      ? tabSeleccionadoRaw
      : ((secciones ?? [])[0]?.seccion.id ?? TAB_PRINCIPAL);
  const seccionSeleccionada = (secciones ?? []).find((s) => s.seccion.id === tabActivo) ?? null;
```

Change:

```tsx
  const filaABorrarCantidadElementos = filaABorrar
    ? (secciones.find((s) => s.seccion.id === filaABorrar.id)?.salidas.length ?? 0)
    : 0;
```

to:

```tsx
  const filaABorrarCantidadElementos = filaABorrar
    ? ((secciones ?? []).find((s) => s.seccion.id === filaABorrar.id)?.salidas.length ?? 0)
    : 0;
```

Add the early return immediately before the final `return (`:

```tsx
  if (secciones === null) return <p>Cargando...</p>;

  return (
```

(Everything inside the returned JSX — including `secciones.map(({ seccion }) => ...)` for the tabs — is unaffected, since `secciones` is narrowed to non-null for the rest of the function body after this guard.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/ProyectosPage.test.tsx src/components/DetalleTablero.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ProyectosPage.tsx frontend/src/pages/ProyectosPage.test.tsx frontend/src/components/DetalleTablero.tsx frontend/src/components/DetalleTablero.test.tsx
git commit -m "fix: show a loading indicator in ProyectosPage and DetalleTablero before data arrives"
```

---

## Task 4: Propagar errores del backend — capa de cliente API (C, parte 1)

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Implement the shared helper and apply it everywhere**

Replace the **entire contents** of `frontend/src/api/client.ts` with the following (every `if (!response.ok) throw new Error("...")` line is replaced by a call to a new `lanzarSiNoOk` helper that reads `detail` from the error body when present; `fetchCurrentUser` and `logout` are untouched since they don't throw on error today):

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Lee el body de una respuesta de error y usa el campo `detail` que devuelve
// FastAPI (`HTTPException(detail=...)`) en vez de un mensaje genérico
// hardcodeado, para que el analista vea el motivo real (ej. "La carga en
// amperios debe ser un número entero") en vez de "No se pudo crear la salida".
// Si el body no es JSON válido (error de red, 500 sin body, etc.) se usa el
// mensaje de fallback.
async function lanzarSiNoOk(response: Response, mensajePorDefecto: string): Promise<void> {
  if (response.ok) return;
  let detalle: string | undefined;
  try {
    const body = await response.json();
    detalle = typeof body?.detail === "string" ? body.detail : undefined;
  } catch {
    // body no es JSON válido -- se usa el fallback
  }
  throw new Error(detalle ?? mensajePorDefecto);
}

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

  await lanzarSiNoOk(response, "Credenciales inválidas");

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

  await lanzarSiNoOk(response, "No se pudo importar el catálogo");

  return response.json();
}

export interface Proyecto {
  id: string;
  cliente: string;
  nombre: string;
  analista_id: string;
  estado: string;
}

export async function listarProyectos(): Promise<Proyecto[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar los proyectos");
  return response.json();
}

export async function crearProyecto(cliente: string, nombre: string): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ cliente, nombre }),
  });
  await lanzarSiNoOk(response, "No se pudo crear el proyecto");
  return response.json();
}

export async function obtenerProyecto(id: string): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo obtener el proyecto");
  return response.json();
}

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
  await lanzarSiNoOk(response, "No se pudo actualizar el proyecto");
  return response.json();
}

export async function eliminarProyecto(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar el proyecto");
}

export interface Tablero {
  id: string;
  proyecto_id: string;
  nombre: string;
  nivel_falla_ka: string;
  interruptor_principal_id: string | null;
  interruptor_principal_codigo?: string | null;
  interruptor_principal_codigo_comercial?: string | null;
  interruptor_principal_descripcion?: string | null;
  interruptor_principal_polos?: number | null;
  interruptor_principal_corriente_nominal_a?: string | null;
  interruptor_principal_capacidad_corte_ka?: string | null;
}

export async function listarTableros(proyectoId: string): Promise<Tablero[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${proyectoId}/tableros`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar los tableros");
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
  await lanzarSiNoOk(response, "No se pudo crear el tablero");
  return response.json();
}

export async function obtenerTablero(id: string): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo obtener el tablero");
  return response.json();
}

export interface TableroUpdate {
  nombre?: string;
  nivel_falla_ka?: string;
  interruptor_principal_id?: string | null;
}

export async function actualizarTablero(id: string, cambios: TableroUpdate): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  await lanzarSiNoOk(response, "No se pudo actualizar el tablero");
  return response.json();
}

export async function eliminarTablero(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar el tablero");
}

export interface Seccion {
  id: string;
  tablero_id: string;
  nombre: string;
  orden: number;
}

export async function listarSecciones(tableroId: string): Promise<Seccion[]> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar las secciones");
  return response.json();
}

export async function crearSeccion(tableroId: string, nombre: string, orden: number): Promise<Seccion> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nombre, orden }),
  });
  await lanzarSiNoOk(response, "No se pudo crear la sección");
  return response.json();
}

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
  await lanzarSiNoOk(response, "No se pudo actualizar la sección");
  return response.json();
}

export async function eliminarSeccion(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/secciones/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar la sección");
}

export type FormatoPolos = "unipolar" | "bipolar" | "tripolar" | "tetrapolar";
export type TipoProteccion = "seccional_termomagnetico" | "seccional_diferencial";

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
  componente_descripcion?: string | null;
  origen: string;
  asignado_manualmente: boolean;
}

export interface SalidaInput {
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
}

export async function listarSalidas(seccionId: string): Promise<Salida[]> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar las salidas");
  return response.json();
}

export async function crearSalida(seccionId: string, datos: SalidaInput): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  await lanzarSiNoOk(response, "No se pudo crear la salida");
  return response.json();
}

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
  await lanzarSiNoOk(response, "No se pudo actualizar la salida");
  return response.json();
}

export async function eliminarSalida(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/salidas/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar la salida");
}

export interface ComponenteBusqueda {
  id: string;
  codigo: string;
  codigo_comercial: string | null;
  descripcion: string;
  precio_neto: string | null;
}

export interface ResultadoBusquedaCatalogo {
  resultados: ComponenteBusqueda[];
  total: number;
}

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
  await lanzarSiNoOk(response, "No se pudo buscar en el catálogo");
  return response.json();
}

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
  await lanzarSiNoOk(response, "No se pudieron obtener las opciones de filtro");
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

export interface ParametroCalculo {
  tension_mono_v: string;
  tension_tri_v: string;
  cos_phi: string;
  ratio_selectividad: string;
}

export async function obtenerParametrosCalculo(): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron obtener los parámetros de cálculo");
  return response.json();
}

export async function actualizarParametrosCalculo(parametros: ParametroCalculo): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(parametros),
  });
  await lanzarSiNoOk(response, "No se pudieron actualizar los parámetros de cálculo");
  return response.json();
}

export function formatearCorriente(valor: string | number | null | undefined): string {
  if (!valor) return "—";
  const num = Number(valor);
  if (isNaN(num)) return String(valor);
  if (num % 1 === 0) {
    return Math.round(num).toString();
  }
  return num.toString();
}
```

- [ ] **Step 2: Run the full frontend suite to verify no regressions**

Run: `cd frontend && npx vitest run`
Expected: all PASS — this step is purely additive (same thrown message text on the fallback path, since every `mensajePorDefecto` is byte-identical to the string that was there before), so no existing test that asserts on the old generic message should break.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: propagate the backend's actual error detail instead of a generic fallback"
```

---

## Task 5: Propagar errores del backend — componentes (C, parte 2)

**Files:**
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`
- Modify: `frontend/src/pages/ProyectosPage.tsx`
- Modify: `frontend/src/pages/ProyectosPage.test.tsx`
- Modify: `frontend/src/pages/ParametrosCalculoPage.tsx`
- Modify: `frontend/src/pages/ParametrosCalculoPage.test.tsx`

Task 4 made `api/client.ts` throw the backend's real `detail` message. This task makes every `catch` block that calls `setError(...)` actually use that thrown message instead of discarding it — today every one of them is a bare `catch { setError("hardcoded string") }`, which doesn't even bind the caught error.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/SeccionBlock.test.tsx`:

```tsx
  it("shows the backend's actual error message when creating a salida fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "La carga en amperios debe ser un número entero" }),
      }),
    );
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /nueva salida/i }));
    await userEvent.type(screen.getByLabelText(/^carga$/i), "16");
    await userEvent.click(screen.getByRole("button", { name: /agregar salida/i }));

    expect(await screen.findByText("La carga en amperios debe ser un número entero")).toBeInTheDocument();
  });
```

Append to `frontend/src/components/DetalleTablero.test.tsx`:

```tsx
  it("shows the backend's actual error message when saving the Icc fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          return Promise.resolve({ ok: false, json: async () => ({ detail: "Nivel de falla inválido" }) });
        }
        if (url.includes("/secciones") && url.includes("/salidas")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url.includes("/secciones")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }),
    );
    renderDetalle();
    await screen.findByRole("tab", { name: "Principal" });

    await userEvent.click(screen.getByRole("button", { name: /editar intensidad de cortocircuito/i }));
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText("Nivel de falla inválido")).toBeInTheDocument();
  });
```

Append to `frontend/src/pages/ProyectoWorkspacePage.test.tsx`:

```tsx
  it("shows the backend's actual error message when creating a tablero fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({ ok: false, json: async () => ({ detail: "Nombre de tablero duplicado" }) });
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

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG1");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));

    expect(await screen.findByText("Nombre de tablero duplicado")).toBeInTheDocument();
  });
```

Append to `frontend/src/pages/ProyectosPage.test.tsx`:

```tsx
  it("shows the backend's actual error message when creating a proyecto fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve({ ok: false, json: async () => ({ detail: "El cliente es obligatorio" }) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "p1", cliente: "Cliente A", nombre: "Proyecto Existente", analista_id: "a1", estado: "en_curso" }],
        });
      }),
    );

    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /nuevo proyecto/i }));
    await userEvent.type(screen.getByLabelText(/nombre/i), "Proyecto Nuevo");
    await userEvent.click(screen.getByRole("button", { name: /crear proyecto/i }));

    expect(await screen.findByText("El cliente es obligatorio")).toBeInTheDocument();
  });
```

Read the existing `frontend/src/pages/ParametrosCalculoPage.test.tsx` first to confirm its existing fetch-mocking convention (it should already have a `beforeEach` or per-test `vi.stubGlobal("fetch", ...)` returning a `ParametroCalculo` object on GET), then append inside its `describe(...)` block:

```tsx
  it("shows the backend's actual error message when saving parametros fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          return Promise.resolve({ ok: false, json: async () => ({ detail: "cos_phi debe estar entre 0 y 1" }) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ tension_mono_v: "220", tension_tri_v: "380", cos_phi: "0.9", ratio_selectividad: "1.6" }),
        });
      }),
    );
    render(<ParametrosCalculoPage />);
    await screen.findByRole("button", { name: /^guardar$/i });

    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByText("cos_phi debe estar entre 0 y 1")).toBeInTheDocument();
  });
```

(Adapt the render/import setup to whatever `ParametrosCalculoPage.test.tsx` already uses — if it wraps in a router or has other required providers, match that, and reuse its existing imports rather than duplicating them.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx src/components/DetalleTablero.test.tsx src/pages/ProyectoWorkspacePage.test.tsx src/pages/ProyectosPage.test.tsx src/pages/ParametrosCalculoPage.test.tsx`
Expected: the 5 new tests FAIL — every catch today shows its own hardcoded string, not the backend's `detail`.

- [ ] **Step 3: Implement**

In `frontend/src/components/SeccionBlock.tsx`, there are 4 bare `catch { ... }` blocks. Change each to bind and use the caught error:

```tsx
    } catch {
      setError("No se pudo crear la salida");
    }
```
→
```tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la salida");
    }
```

```tsx
    } catch {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError("No se pudo actualizar la salida");
    }
```
→
```tsx
    } catch (err) {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError(err instanceof Error ? err.message : "No se pudo actualizar la salida");
    }
```

```tsx
    } catch {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError("No se pudo reasignar el componente");
    }
```
→
```tsx
    } catch (err) {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError(err instanceof Error ? err.message : "No se pudo reasignar el componente");
    }
```

```tsx
    } catch {
      setError("No se pudo borrar la salida");
    } finally {
```
→
```tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la salida");
    } finally {
```

In `frontend/src/components/DetalleTablero.tsx`, there are 5 bare `catch { ... }` blocks (`handleGuardarNivelFalla`, `handleSeleccionarInterruptorPrincipal`, `handleCrearFila`, `handleRenombrarFila`, `handleConfirmarBorrarFila`). Apply the same transformation to each — bind `(err)` and replace the hardcoded `setError("...")` string with `setError(err instanceof Error ? err.message : "...")`, keeping every existing ref-guard (`if (!modalIccRef.current) return;` etc.) exactly as-is, only changing the `catch` binding and the `setError` line. The 5 original messages to preserve as fallback: `"No se pudo actualizar la intensidad de cortocircuito"`, `"No se pudo actualizar el interruptor principal"`, `"No se pudo crear la fila"`, `"No se pudo renombrar la fila"`, `"No se pudo borrar la fila"`.

In `frontend/src/pages/ProyectoWorkspacePage.tsx`, there are 3 bare `catch { ... }` blocks (`handleSubmit`, `handleRenombrarTablero`, `handleConfirmarBorrarTablero`). Same transformation, preserving the ref-guards and these 3 fallback messages: `"No se pudo crear el tablero"`, `"No se pudo renombrar el tablero"`, `"No se pudo borrar el tablero"`.

In `frontend/src/pages/ProyectosPage.tsx`, there are 2 bare `catch { ... }` blocks. `handleSubmit`'s catch currently reads:

```tsx
    } catch {
      setError(modal?.tipo === "editar" ? "No se pudo actualizar el proyecto" : "No se pudo crear el proyecto");
    }
```

Change to:

```tsx
    } catch (err) {
      const mensajePorDefecto = modal?.tipo === "editar" ? "No se pudo actualizar el proyecto" : "No se pudo crear el proyecto";
      setError(err instanceof Error ? err.message : mensajePorDefecto);
    }
```

`handleConfirmarBorrado`'s catch:

```tsx
    } catch {
      setError("No se pudo borrar el proyecto");
    } finally {
```

becomes:

```tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el proyecto");
    } finally {
```

In `frontend/src/pages/ParametrosCalculoPage.tsx`, the single catch:

```tsx
    } catch {
      setError("No se pudieron guardar los parámetros");
    }
```

becomes:

```tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los parámetros");
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx src/components/DetalleTablero.test.tsx src/pages/ProyectoWorkspacePage.test.tsx src/pages/ProyectosPage.test.tsx src/pages/ParametrosCalculoPage.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS — every existing test that triggers a generic-error path (`ok: false` with no `detail` in its mock body) still gets the same fallback message as before, since `lanzarSiNoOk` falls back to `mensajePorDefecto` when the body has no `detail`.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx frontend/src/components/DetalleTablero.tsx frontend/src/components/DetalleTablero.test.tsx frontend/src/pages/ProyectoWorkspacePage.tsx frontend/src/pages/ProyectoWorkspacePage.test.tsx frontend/src/pages/ProyectosPage.tsx frontend/src/pages/ProyectosPage.test.tsx frontend/src/pages/ParametrosCalculoPage.tsx frontend/src/pages/ParametrosCalculoPage.test.tsx
git commit -m "fix: surface the backend's real error message in every form's catch block"
```

---

## Task 6: Confirmación al cerrar sin guardar — SeccionBlock (D, parte 1)

**Files:**
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`

Per the design: confirms **always** on close-without-save for edit modals (no dirty-value comparison). Only the "Editar salida" modal is an edit modal in this file — "Nueva salida" is an inline creation form, not a modal, and is out of scope.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/SeccionBlock.test.tsx`:

```tsx
  it("asks for confirmation before discarding an edit when closing via Cancelar", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.getByText(/¿descartar cambios\?/i)).toBeInTheDocument();
    // The edit form itself is no longer shown while the discard confirmation is up.
    expect(screen.queryByText(/^editar salida$/i)).not.toBeInTheDocument();
  });

  it("returns to the edit modal when cancelling the discard confirmation", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.getByText(/editar salida/i)).toBeInTheDocument();
    expect(screen.queryByText(/¿descartar cambios\?/i)).not.toBeInTheDocument();
  });

  it("closes the edit modal without saving when confirming the discard", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^descartar$/i }));

    expect(screen.queryByText(/editar salida/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/¿descartar cambios\?/i)).not.toBeInTheDocument();
  });

  it("asks for confirmation before discarding when pressing Escape in the edit modal", async () => {
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
    await userEvent.keyboard("{Escape}");

    expect(screen.getByText(/¿descartar cambios\?/i)).toBeInTheDocument();
  });
```

Note: there are now two `role="dialog"` elements with a "Cancelar" button in this component's edit flow at different times (the edit form's own Cancelar, and — after this task — the discard-confirmation's Cancelar), but never simultaneously rendered (the edit form is hidden while the discard confirmation is up, per the assertions above), so `getByRole("button", { name: /^cancelar$/i })` stays unambiguous at each point in these tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: the 4 new tests FAIL — today "Cancelar"/Escape close the edit modal directly, with no confirmation step.

- [ ] **Step 3: Implement**

In `frontend/src/components/SeccionBlock.tsx`, add a new state variable right after `const [salidaEnEdicion, setSalidaEnEdicion] = useState<Salida | null>(null);`:

```tsx
  const [confirmandoDescarteEdicion, setConfirmandoDescarteEdicion] = useState(false);
```

Add two new functions right after `cerrarEdicion` (which stays as the function that does the **real** close — it's now only called once the discard is confirmed):

```tsx
  function solicitarCierreEdicion() {
    setConfirmandoDescarteEdicion(true);
  }

  function confirmarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
    cerrarEdicion();
  }

  function cancelarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
  }
```

Change the `useCerrarAlClickFuera` call from:

```tsx
  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarEdicion);
```

to:

```tsx
  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(solicitarCierreEdicion);
```

In the Escape-key `useEffect`, change:

```tsx
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarEdicion();
    }
```

to:

```tsx
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") solicitarCierreEdicion();
    }
```

Change the edit modal's own "Cancelar" button from:

```tsx
              <button
                type="button"
                onClick={cerrarEdicion}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
```

to:

```tsx
              <button
                type="button"
                onClick={solicitarCierreEdicion}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
```

Change the edit modal's render condition from:

```tsx
      {salidaEnEdicion && !pickerAbierto && (
```

to:

```tsx
      {salidaEnEdicion && !pickerAbierto && !confirmandoDescarteEdicion && (
```

Finally, render the discard-confirmation dialog right after the edit modal's closing `)}` and before the `{salidaEnEdicion && pickerAbierto && (` block (i.e., insert this new block between the two):

```tsx
      {salidaEnEdicion && confirmandoDescarteEdicion && (
        <ConfirmDialog
          titulo="¿Descartar cambios?"
          mensaje="Vas a perder los cambios que hiciste en esta salida."
          onConfirm={confirmarDescarteEdicion}
          onCancel={cancelarDescarteEdicion}
        />
      )}
```

`ConfirmDialog`'s confirm button is labeled "Borrar" (see `frontend/src/components/ConfirmDialog.tsx:60`, hardcoded — it's currently only ever used for delete confirmations) — for a discard-changes confirmation, "Borrar" is the wrong label. `ConfirmDialog` gains a new optional prop `textoConfirmar` (defaulting to the current `"Borrar"`, so every other existing usage across the app is unaffected):

In `frontend/src/components/ConfirmDialog.tsx`, change:

```tsx
interface ConfirmDialogProps {
  titulo: string;
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmando?: boolean;
  error?: string | null;
}

export function ConfirmDialog({
  titulo,
  mensaje,
  onConfirm,
  onCancel,
  confirmando = false,
  error = null,
}: ConfirmDialogProps) {
```

to:

```tsx
interface ConfirmDialogProps {
  titulo: string;
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmando?: boolean;
  error?: string | null;
  textoConfirmar?: string;
}

export function ConfirmDialog({
  titulo,
  mensaje,
  onConfirm,
  onCancel,
  confirmando = false,
  error = null,
  textoConfirmar = "Borrar",
}: ConfirmDialogProps) {
```

and change the confirm button:

```tsx
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmando}
            className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50"
          >
            Borrar
          </button>
```

to:

```tsx
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmando}
            className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50"
          >
            {textoConfirmar}
          </button>
```

Then update the discard-confirmation block added above to pass `textoConfirmar="Descartar"`:

```tsx
      {salidaEnEdicion && confirmandoDescarteEdicion && (
        <ConfirmDialog
          titulo="¿Descartar cambios?"
          mensaje="Vas a perder los cambios que hiciste en esta salida."
          textoConfirmar="Descartar"
          onConfirm={confirmarDescarteEdicion}
          onCancel={cancelarDescarteEdicion}
        />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx src/components/ConfirmDialog.test.tsx`
Expected: all PASS — including every pre-existing `ConfirmDialog.test.tsx` test, since `textoConfirmar` defaults to `"Borrar"` (unchanged behavior when the prop isn't passed).

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx frontend/src/components/ConfirmDialog.tsx
git commit -m "feat: confirm before discarding unsaved changes when closing the edit-salida modal"
```

---

## Task 7: Confirmación al cerrar sin guardar — DetalleTablero + ProyectoWorkspacePage (D, parte 2)

**Files:**
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

`DetalleTablero.tsx`'s `cerrarModales` is shared across **both** edit-type modals (Icc, Renombrar fila) **and** the create-type modal (Nueva fila) — the discard confirmation applies only to the edit ones. Same situation in `ProyectoWorkspacePage.tsx`: `cerrarModales` is shared between Nuevo tablero (create) and Renombrar tablero (edit).

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/DetalleTablero.test.tsx`:

```tsx
  it("asks for confirmation before discarding the Icc edit when closing via Cancelar", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Principal" });

    await userEvent.click(screen.getByRole("button", { name: /editar intensidad de cortocircuito/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.getByText(/¿descartar cambios\?/i)).toBeInTheDocument();
  });

  it("closes the Icc modal without saving when confirming the discard", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Principal" });

    await userEvent.click(screen.getByRole("button", { name: /editar intensidad de cortocircuito/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^descartar$/i }));

    // "Nuevo nivel de falla" only exists inside the Icc modal itself, unlike
    // the permanent "Intensidad de Cortocircuito (Icc): X kA" line on the
    // page, which stays regardless of modal state and would make a text
    // match on the heading's wording ambiguous.
    expect(screen.queryByLabelText(/nuevo nivel de falla/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/¿descartar cambios\?/i)).not.toBeInTheDocument();
  });

  it("does not ask for confirmation when cancelling the create-fila modal", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Principal" });

    await userEvent.click(screen.getByRole("button", { name: /^nueva fila$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.queryByText(/¿descartar cambios\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^nueva fila$/i)).not.toBeInTheDocument();
  });
```

(Adapt `renderDetalle()` and the fixture setup exactly as already established at the top of this file — reuse the existing `tablero`/`beforeEach` fetch stub, don't redefine them.)

Append to `frontend/src/pages/ProyectoWorkspacePage.test.tsx`:

```tsx
  it("asks for confirmation before discarding the rename-tablero edit when closing via Cancelar", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /renombrar tablero activo/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.getByText(/¿descartar cambios\?/i)).toBeInTheDocument();
  });

  it("does not ask for confirmation when cancelling the create-tablero modal", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    await userEvent.click(screen.getByRole("button", { name: /^nuevo tablero$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(screen.queryByText(/¿descartar cambios\?/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /nuevo tablero/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/DetalleTablero.test.tsx src/pages/ProyectoWorkspacePage.test.tsx`
Expected: the 5 new tests FAIL — today Cancelar closes every modal directly with no confirmation, for both create and edit modals alike.

- [ ] **Step 3: Implement**

In `frontend/src/components/DetalleTablero.tsx`, add new state right after `const [error, setError] = useState<string | null>(null);`:

```tsx
  const [confirmandoDescarteEdicion, setConfirmandoDescarteEdicion] = useState(false);
```

Add a helper that determines whether the currently-open modal is an edit-type modal (Icc or renombrar fila — **not** Nueva fila, which is creation), plus the request/confirm/cancel functions, right after `cerrarModales`:

```tsx
  function esEdicionEnCurso() {
    return modalIcc || filaEnEdicion !== null;
  }

  function solicitarCierreModales() {
    if (esEdicionEnCurso()) {
      setConfirmandoDescarteEdicion(true);
    } else {
      cerrarModales();
    }
  }

  function confirmarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
    cerrarModales();
  }

  function cancelarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
  }
```

Change the `useCerrarAlClickFuera` call from `useCerrarAlClickFuera(cerrarModales)` to `useCerrarAlClickFuera(solicitarCierreModales)`.

In the Escape-key `useEffect`, change `if (e.key === "Escape") cerrarModales();` to `if (e.key === "Escape") solicitarCierreModales();`.

Change the Icc modal's "Cancelar" button (`onClick={cerrarModales}` inside the `modalIcc && (...)` block) to `onClick={solicitarCierreModales}`.

Change the "Renombrar fila" modal's "Cancelar" button (`onClick={cerrarModales}` inside the `filaEnEdicion && (...)` block) to `onClick={solicitarCierreModales}`.

Leave the "Nueva fila" modal's "Cancelar" button (`onClick={cerrarModales}` inside `modalNuevaFila && (...)`) **unchanged** — it stays wired directly to `cerrarModales`, since creation doesn't need confirmation.

Change the Icc modal's render condition from `{modalIcc && (` to `{modalIcc && !confirmandoDescarteEdicion && (`.

Change the "Renombrar fila" modal's render condition from `{filaEnEdicion && (` to `{filaEnEdicion && !confirmandoDescarteEdicion && (`.

Add the discard-confirmation dialog right after the `{filaEnEdicion && ... (` block's closing `)}` and before `{filaABorrar && (`:

```tsx
      {(modalIcc || filaEnEdicion) && confirmandoDescarteEdicion && (
        <ConfirmDialog
          titulo="¿Descartar cambios?"
          mensaje="Vas a perder los cambios que hiciste."
          textoConfirmar="Descartar"
          onConfirm={confirmarDescarteEdicion}
          onCancel={cancelarDescarteEdicion}
        />
      )}
```

In `frontend/src/pages/ProyectoWorkspacePage.tsx`, add new state right after `const [error, setError] = useState<string | null>(null);`:

```tsx
  const [confirmandoDescarteEdicion, setConfirmandoDescarteEdicion] = useState(false);
```

Add the same shape of helper/request/confirm/cancel functions right after `cerrarModales`:

```tsx
  function solicitarCierreModales() {
    if (tableroEnEdicion) {
      setConfirmandoDescarteEdicion(true);
    } else {
      cerrarModales();
    }
  }

  function confirmarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
    cerrarModales();
  }

  function cancelarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
  }
```

Change `useCerrarAlClickFuera(cerrarModales)` to `useCerrarAlClickFuera(solicitarCierreModales)`.

In the Escape-key `useEffect`, change `if (e.key === "Escape") cerrarModales();` to `if (e.key === "Escape") solicitarCierreModales();`.

Change the "Renombrar tablero" modal's "Cancelar" button (`onClick={cerrarModales}` inside the `tableroEnEdicion && (...)` block) to `onClick={solicitarCierreModales}`.

Leave the "Nuevo tablero" modal's "Cancelar" button (`onClick={cerrarModales}` inside `modalNuevoTablero && !pickerAbierto && (...)`) **unchanged**.

Change the "Renombrar tablero" modal's render condition from `{tableroEnEdicion && (` to `{tableroEnEdicion && !confirmandoDescarteEdicion && (`.

Add the discard-confirmation dialog right after that block's closing `)}` and before `{tableroABorrar && (`:

```tsx
      {tableroEnEdicion && confirmandoDescarteEdicion && (
        <ConfirmDialog
          titulo="¿Descartar cambios?"
          mensaje="Vas a perder los cambios que hiciste."
          textoConfirmar="Descartar"
          onConfirm={confirmarDescarteEdicion}
          onCancel={cancelarDescarteEdicion}
        />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/DetalleTablero.test.tsx src/pages/ProyectoWorkspacePage.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DetalleTablero.tsx frontend/src/components/DetalleTablero.test.tsx frontend/src/pages/ProyectoWorkspacePage.tsx frontend/src/pages/ProyectoWorkspacePage.test.tsx
git commit -m "feat: confirm before discarding unsaved changes in Icc/renombrar-fila/renombrar-tablero modals"
```

---

## Task 8: `ComponentePicker` recuerda última búsqueda por contexto (E)

**Files:**
- Create: `frontend/src/components/componentePickerMemoria.ts`
- Create: `frontend/src/components/componentePickerMemoria.test.ts`
- Modify: `frontend/src/components/ComponentePicker.tsx`
- Modify: `frontend/src/components/ComponentePicker.test.tsx`
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.tsx`

- [ ] **Step 1: Write the failing test for the memory module**

Create `frontend/src/components/componentePickerMemoria.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { obtenerMemoria, guardarMemoria, limpiarMemoriaParaTests } from "./componentePickerMemoria";

describe("componentePickerMemoria", () => {
  beforeEach(() => {
    limpiarMemoriaParaTests();
  });

  it("returns undefined for a context that was never saved", () => {
    expect(obtenerMemoria("nunca-usado")).toBeUndefined();
  });

  it("returns exactly what was saved for a given context", () => {
    guardarMemoria("interruptor-principal", {
      query: "XT2N",
      filtroPolos: 3,
      filtroCorriente: "16",
      filtroCapacidad: null,
    });

    expect(obtenerMemoria("interruptor-principal")).toEqual({
      query: "XT2N",
      filtroPolos: 3,
      filtroCorriente: "16",
      filtroCapacidad: null,
    });
  });

  it("keeps different contexts independent", () => {
    guardarMemoria("interruptor-principal", { query: "XT2N", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });
    guardarMemoria("salida-componente", { query: "S200", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });

    expect(obtenerMemoria("interruptor-principal")?.query).toBe("XT2N");
    expect(obtenerMemoria("salida-componente")?.query).toBe("S200");
  });

  it("overwrites the previous value for the same context", () => {
    guardarMemoria("salida-componente", { query: "primero", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });
    guardarMemoria("salida-componente", { query: "segundo", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });

    expect(obtenerMemoria("salida-componente")?.query).toBe("segundo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/componentePickerMemoria.test.ts`
Expected: FAIL with "Cannot find module './componentePickerMemoria'".

- [ ] **Step 3: Implement the memory module**

Create `frontend/src/components/componentePickerMemoria.ts`:

```ts
// Memoria en RAM (no localStorage) de la última búsqueda/filtros de
// ComponentePicker, por contexto -- se resetea al recargar la página, que es
// el comportamiento esperado: "recordar durante la sesión de carga", no
// persistir indefinidamente. Cada caller de ComponentePicker pasa su propio
// contextKey (ej. "interruptor-principal", "salida-componente") para que
// buscar un interruptor principal y buscar el componente de una salida no se
// pisen entre sí.
export interface MemoriaBusqueda {
  query: string;
  filtroPolos: number | null;
  filtroCorriente: string | null;
  filtroCapacidad: string | null;
}

const memoria = new Map<string, MemoriaBusqueda>();

export function obtenerMemoria(contextKey: string): MemoriaBusqueda | undefined {
  return memoria.get(contextKey);
}

export function guardarMemoria(contextKey: string, valor: MemoriaBusqueda): void {
  memoria.set(contextKey, valor);
}

// Solo para tests -- limpia el estado del módulo entre tests ya que el Map
// vive a nivel de módulo y persistiría entre archivos/tests sin esto.
export function limpiarMemoriaParaTests(): void {
  memoria.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/componentePickerMemoria.test.ts`
Expected: all 4 PASS.

- [ ] **Step 5: Write the failing tests for `ComponentePicker`**

Append to `frontend/src/components/ComponentePicker.test.tsx`, inside its `describe(...)` block. Read the existing file first to confirm its exact `CATEGORIAS`/fetch-mocking conventions (established in earlier cycles) and match them — the tests below assume a `CATEGORIAS` constant already exists at the top of the file:

```tsx
  it("prefills the query and filters from a previous search in the same context", async () => {
    guardarMemoria("test-contexto-recordado", {
      query: "XT2N",
      filtroPolos: 3,
      filtroCorriente: null,
      filtroCapacidad: null,
    });
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

    render(
      <ComponentePicker
        categorias={CATEGORIAS}
        contextKey="test-contexto-recordado"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText(/buscar código/i)).toHaveValue("XT2N");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("q=XT2N"), expect.anything());
  });

  it("does not prefill from a different context", async () => {
    guardarMemoria("otro-contexto", { query: "S200", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });
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

    render(
      <ComponentePicker
        categorias={CATEGORIAS}
        contextKey="un-contexto-nuevo-sin-memoria"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText(/buscar código/i)).toHaveValue("");
  });

  it("remembers the query for its context after typing", async () => {
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

    render(
      <ComponentePicker categorias={CATEGORIAS} contextKey="test-contexto-guardar" onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N");

    expect(obtenerMemoria("test-contexto-guardar")?.query).toBe("XT2N");
  });
```

Add the import at the top of `frontend/src/components/ComponentePicker.test.tsx`:

```tsx
import { guardarMemoria, obtenerMemoria, limpiarMemoriaParaTests } from "./componentePickerMemoria";
```

And reset the memory module between tests — add (or extend, if a `beforeEach` already exists in this file) at the top of the `describe(...)` block:

```tsx
  beforeEach(() => {
    limpiarMemoriaParaTests();
  });
```

(If `beforeEach` and `afterEach`/other setup already exist in this file, merge this call into the existing `beforeEach` rather than adding a second one — read the file first to check.)

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx`
Expected: the 3 new tests FAIL — `contextKey` isn't a real prop yet (TypeScript error) and there's no memory wiring.

- [ ] **Step 7: Implement in `ComponentePicker.tsx`**

Add the import:

```tsx
import { guardarMemoria, obtenerMemoria, type MemoriaBusqueda } from "./componentePickerMemoria";
```

Add `contextKey` to the props interface:

```tsx
interface ComponentePickerProps {
  categorias: string[];
  contextKey: string;
  onSelect: (componente: ComponenteBusqueda) => void;
  onCancel: () => void;
  titulo?: string;
}
```

Add `contextKey` to the destructured props:

```tsx
export function ComponentePicker({
  categorias,
  contextKey,
  onSelect,
  onCancel,
  titulo = "Buscar componente",
}: ComponentePickerProps) {
```

Right after the destructured props (before `const [query, setQuery] = useState("");`), read the remembered value once:

```tsx
  const memoriaInicial = obtenerMemoria(contextKey);
```

Change the four `useState` initializers that follow to use it:

```tsx
  const [query, setQuery] = useState("");
```
→
```tsx
  const [query, setQuery] = useState(memoriaInicial?.query ?? "");
```

```tsx
  const [filtroPolos, setFiltroPolos] = useState<number | null>(null);
```
→
```tsx
  const [filtroPolos, setFiltroPolos] = useState<number | null>(memoriaInicial?.filtroPolos ?? null);
```

```tsx
  const [filtroCorriente, setFiltroCorriente] = useState<string | null>(null);
```
→
```tsx
  const [filtroCorriente, setFiltroCorriente] = useState<string | null>(memoriaInicial?.filtroCorriente ?? null);
```

```tsx
  const [filtroCapacidad, setFiltroCapacidad] = useState<string | null>(null);
```
→
```tsx
  const [filtroCapacidad, setFiltroCapacidad] = useState<string | null>(memoriaInicial?.filtroCapacidad ?? null);
```

Change the mount effect that currently searches with a hardcoded empty string:

```tsx
  useEffect(() => {
    obtenerOpcionesFiltro(categorias).then(setOpciones).catch(() => {});
    buscar("", 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

to (search with whatever `query` was initialized to, which already reflects the remembered value):

```tsx
  useEffect(() => {
    obtenerOpcionesFiltro(categorias).then(setOpciones).catch(() => {});
    buscar(query, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Add a new effect that persists to memory whenever the query or filters change — place it right after the mount effect above:

```tsx
  useEffect(() => {
    const valor: MemoriaBusqueda = { query, filtroPolos, filtroCorriente, filtroCapacidad };
    guardarMemoria(contextKey, valor);
  }, [contextKey, query, filtroPolos, filtroCorriente, filtroCapacidad]);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ComponentePicker.test.tsx src/components/componentePickerMemoria.test.ts`
Expected: all PASS. Also confirm every pre-existing test in `ComponentePicker.test.tsx` still passes — they'll need `contextKey` added to their `<ComponentePicker ... />` calls, since it's now a required prop; if any fail with a TypeScript error about the missing prop, add e.g. `contextKey="test"` to each (any distinct string works for tests that don't specifically test the memory feature).

- [ ] **Step 9: Update the three call sites with real context keys**

In `frontend/src/components/SeccionBlock.tsx`, change:

```tsx
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          titulo="Cambiar componente"
          onSelect={handleReasignarComponente}
          onCancel={() => setPickerAbierto(false)}
        />
```

to:

```tsx
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="salida-componente"
          titulo="Cambiar componente"
          onSelect={handleReasignarComponente}
          onCancel={() => setPickerAbierto(false)}
        />
```

In `frontend/src/components/DetalleTablero.tsx`, change:

```tsx
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          titulo="Interruptor principal"
          onSelect={handleSeleccionarInterruptorPrincipal}
          onCancel={cerrarModales}
        />
```

to:

```tsx
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="interruptor-principal"
          titulo="Interruptor principal"
          onSelect={handleSeleccionarInterruptorPrincipal}
          onCancel={cerrarModales}
        />
```

(This `onCancel={cerrarModales}` is unchanged from Task 7 — the interruptor-principal picker is a self-contained `ComponentePicker`, not one of the raw inline modals affected by the discard-confirmation work.)

In `frontend/src/pages/ProyectoWorkspacePage.tsx`, change:

```tsx
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          titulo="Interruptor principal"
          onSelect={(componente) => {
            setInterruptorPrincipal(componente);
            setPickerAbierto(false);
          }}
          onCancel={() => setPickerAbierto(false)}
        />
```

to (same `"interruptor-principal"` key as `DetalleTablero.tsx` — both are searching for the same kind of thing, so sharing the remembered search between "pick a principal while editing a tablero" and "pick a principal while creating one" is the intended behavior):

```tsx
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="interruptor-principal"
          titulo="Interruptor principal"
          onSelect={(componente) => {
            setInterruptorPrincipal(componente);
            setPickerAbierto(false);
          }}
          onCancel={() => setPickerAbierto(false)}
        />
```

- [ ] **Step 10: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 11: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/componentePickerMemoria.ts frontend/src/components/componentePickerMemoria.test.ts frontend/src/components/ComponentePicker.tsx frontend/src/components/ComponentePicker.test.tsx frontend/src/components/SeccionBlock.tsx frontend/src/components/DetalleTablero.tsx frontend/src/pages/ProyectoWorkspacePage.tsx
git commit -m "feat: remember ComponentePicker's last search/filters per context"
```

---

## Task 9: Tabla de salidas responsive (F)

**Files:**
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/SeccionBlock.test.tsx`:

```tsx
  it("wraps the salidas table in a horizontally scrollable container", () => {
    render(
      <SeccionBlock
        seccion={seccion}
        salidas={[salidaConMatch]}
        onSalidaCreada={vi.fn()}
        onSalidaActualizada={vi.fn()}
        onSalidaBorrada={vi.fn()}
      />,
    );

    const tabla = screen.getByRole("table");
    expect(tabla.parentElement).toHaveClass("overflow-x-auto");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: FAIL — the table's direct parent is currently the outer `<div className="mt-4 border border-surface-stroke bg-white">`, which doesn't have `overflow-x-auto`.

- [ ] **Step 3: Implement**

Change:

```tsx
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-surface-stroke text-xs uppercase tracking-widest text-secondary">
            <th scope="col" className="p-3">Carga</th>
            <th scope="col" className="p-3">Formato</th>
            <th scope="col" className="p-3">Estado</th>
            <th scope="col" className="p-3">Código SAP</th>
            <th scope="col" className="p-3">Código Comercial</th>
            <th scope="col" className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {salidas.map((salida) => (
            <FilaSalida
              key={salida.id}
              salida={salida}
              onAbrirEdicion={abrirEdicion}
              onConfirmarBorrado={(sal, trigger) => {
                ultimoTriggerRef.current = trigger;
                setSalidaABorrar(sal);
              }}
            />
          ))}
        </tbody>
      </table>
```

to:

```tsx
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-surface-stroke text-xs uppercase tracking-widest text-secondary">
              <th scope="col" className="p-3">Carga</th>
              <th scope="col" className="p-3">Formato</th>
              <th scope="col" className="p-3">Estado</th>
              <th scope="col" className="p-3">Código SAP</th>
              <th scope="col" className="p-3">Código Comercial</th>
              <th scope="col" className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {salidas.map((salida) => (
              <FilaSalida
                key={salida.id}
                salida={salida}
                onAbrirEdicion={abrirEdicion}
                onConfirmarBorrado={(sal, trigger) => {
                  ultimoTriggerRef.current = trigger;
                  setSalidaABorrar(sal);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/SeccionBlock.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SeccionBlock.tsx frontend/src/components/SeccionBlock.test.tsx
git commit -m "fix: wrap the salidas table in a horizontal-scroll container for small screens"
```

---

## Task 10: Verificación final

**Files:** none (verification + documentation only)

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && venv/Scripts/python.exe -m pytest -q`
Expected: all PASS (unaffected by this cycle — no backend files were touched — but confirms nothing else broke).

- [ ] **Step 2: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all PASS.

- [ ] **Step 3: Build the frontend**

Run: `cd frontend && npm run build`
Expected: succeeds with no `tsc` errors (this is the same check the CI job from ciclo 9 runs).

- [ ] **Step 4: Browser walkthrough**

Using the running app (`docker compose up -d --build` if not already up; login as analista):
1. Open a tablero, go to a fila, click "Nueva salida", type "16.5" in Carga with unit A — confirm the inline error appears and "Agregar salida" is disabled; switch unit to kW — confirm the error clears.
2. Open "Editar salida" on an existing salida, type an Escape or click the backdrop — confirm the "¿Descartar cambios?" dialog appears instead of closing directly; confirm "Cancelar" returns to the edit form, and "Descartar" closes without saving.
3. Open "Nueva salida" (creation, not edit) and click "Cancelar" — confirm it closes directly with **no** discard confirmation.
4. Force a real backend validation error (e.g. try to create a salida with an invalid combination the backend rejects) and confirm the error text shown matches the backend's actual message, not a generic one.
5. Open the `ComponentePicker` for "Cambiar componente" on a salida, search for something, cancel out, add another salida and open the picker again — confirm the previous search/filters are prefilled. Open the picker for "Interruptor principal" instead — confirm it does **not** show the salida-componente search (different context).
6. Resize the browser to a narrow width (e.g. 375px) with a tablero that has several salidas — confirm the salidas table scrolls horizontally instead of compressing illegibly.
7. Reload `/proyectos` and `/proyectos/:id` with the network throttled (or via DevTools) — confirm "Cargando..." shows briefly instead of a flash of an empty grid/workspace.

- [ ] **Step 5: Update `docs/backlog_mejoras.md`**

Mark the 6 items covered by ciclo 10a as ✅ in the "UI/UX" table, referencing this cycle. Read the current file first (it may have shifted since this plan was written) and apply the same style as the ciclo 9 closeout (✅ with a short note + commit reference).

- [ ] **Step 6: Update `CLAUDE.md`**

Add a note to the Fase C status bullet describing ciclo 10a's scope (mirroring the style of the ciclo 8/9 entries already there), and reference the spec/plan paths. Mark it "completo en la rama `feat/ciclo-10a-feedback-formularios`, pendiente de merge" until the merge step actually happens.

- [ ] **Step 7: Commit the documentation updates**

```bash
git add docs/backlog_mejoras.md CLAUDE.md
git commit -m "docs: close out ciclo 10a in backlog and CLAUDE.md"
```
