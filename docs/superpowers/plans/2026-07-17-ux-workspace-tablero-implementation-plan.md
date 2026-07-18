# UX del workspace de tablero — ajustes post-lanzamiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuatro ajustes de UX sobre el workspace de tablero recién mergeado: edición de Icc/interruptor principal vía modal (en vez de texto suelto que reflowea la página), esquema visual angosto con selector de secciones al costado, indicador de resultados + paginación en la búsqueda de catálogo, y breadcrumb de vuelta a Proyectos.

**Architecture:** `DetalleTablero` se reestructura en dos tareas secuenciales (layout de dos columnas primero, después el cambio de interacción a modal) para minimizar el riesgo de reescribir el mismo archivo dos veces desde cero. La búsqueda de catálogo cambia de contrato (`GET /catalogo/buscar` pasa de devolver una lista a `{resultados, total}`) — backend y su único consumidor (`ComponentePicker`) se hacen en tareas separadas pero secuenciales, ya que el cambio de contrato deja el frontend sin compilar hasta que ambas terminan.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 (sin cambios de stack), FastAPI + SQLAlchemy (backend, sin cambios de stack).

---

## Spec coverage check (self-review, done antes de las tareas)

| Spec section | Task(s) |
|---|---|
| 1. Modal Icc + interruptor principal | Task 2 |
| 2. Layout dos columnas + selector de secciones | Task 1 |
| 3. Búsqueda: indicador + paginación | Task 4, Task 5 |
| 4. Breadcrumb a Proyectos | Task 3 |
| Verificación final | Task 6 |

---

### Task 1: `DetalleTablero` — layout de dos columnas + selector de secciones

**Files:**
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`

Este task NO toca la edición de nivel de falla/interruptor principal (eso es el Task 2) — solo reestructura el layout: el esquema visual pasa a ocupar ~1/3 del ancho, y a la derecha aparece un selector de secciones (una pestaña por sección) en vez de mostrarlas todas apiladas.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar todo el contenido de `frontend/src/components/DetalleTablero.test.tsx`:

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

  it("shows the Nueva sección form directly when there are no secciones yet, with no selector", async () => {
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

    expect(await screen.findByLabelText(/nueva sección/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("adds a new sección and adds a tab for it", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.type(screen.getByLabelText(/nueva sección/i), "Sección nueva");
    await userEvent.click(screen.getByRole("button", { name: /agregar sección/i }));

    expect(await screen.findByRole("tab", { name: "Sección nueva" })).toBeInTheDocument();
  });

  it("edits nivel de falla and reports the change upward", async () => {
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

    await userEvent.click(screen.getByRole("button", { name: /editar nivel de falla/i }));
    const input = screen.getByLabelText(/nuevo nivel de falla/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "16");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/nivel de falla.*16.00 kA/i)).toBeInTheDocument();
    expect(onTableroActualizado).toHaveBeenCalledWith(expect.objectContaining({ nivel_falla_ka: "16.00" }));
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

Nota: el test de "edits nivel de falla" usa `/nivel de falla.*16.00 kA/i` (regex más laxo) en vez de `/nivel de falla: 16.00 kA/i` porque el Task 2 va a cambiar el texto exacto de esa línea (agrega "(Icc)") — este regex sigue siendo válido después de ese cambio sin tener que volver a tocar este test.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- DetalleTablero`
Expected: FAIL — no existe `role="tab"` todavía, todas las secciones se muestran apiladas.

- [ ] **Step 3: Implementar el nuevo layout**

Reemplazar todo el contenido de `frontend/src/components/DetalleTablero.tsx`:

```tsx
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  actualizarTablero,
  crearSeccion,
  listarSalidas,
  listarSecciones,
  type ComponenteBusqueda,
  type Salida,
  type Seccion,
  type Tablero,
} from "../api/client";
import type { Capas } from "./EsquemaVisual";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";
import { ComponentePicker } from "./ComponentePicker";
import { SeccionBlock } from "./SeccionBlock";

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

export function DetalleTablero({
  tablero,
  onTableroActualizado,
  vista,
  onZoomChange,
  onCapasChange,
}: DetalleTableroProps) {
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
  const [seccionSeleccionadaRaw, setSeccionSeleccionadaRaw] = useState<string | null>(null);
  const [nombreSeccion, setNombreSeccion] = useState("");
  const [editandoNivelFalla, setEditandoNivelFalla] = useState(false);
  const [nivelFallaKaEdit, setNivelFallaKaEdit] = useState("");
  const [editandoInterruptorPrincipal, setEditandoInterruptorPrincipal] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const seccionSeleccionadaId = secciones.some((s) => s.seccion.id === seccionSeleccionadaRaw)
    ? seccionSeleccionadaRaw
    : (secciones[0]?.seccion.id ?? null);
  const seccionSeleccionada = secciones.find((s) => s.seccion.id === seccionSeleccionadaId) ?? null;

  async function handleAgregarSeccion(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const seccion = await crearSeccion(tablero.id, nombreSeccion, secciones.length);
      setSecciones((actuales) => [...actuales, { seccion, salidas: [] }]);
      setNombreSeccion("");
    } catch {
      setError("No se pudo crear la sección");
    }
  }

  async function handleGuardarNivelFalla(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { nivel_falla_ka: nivelFallaKaEdit });
      onTableroActualizado(actualizado);
      setEditandoNivelFalla(false);
    } catch {
      setError("No se pudo actualizar el nivel de falla");
    }
  }

  async function handleSeleccionarInterruptorPrincipal(componente: ComponenteBusqueda) {
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { interruptor_principal_id: componente.id });
      onTableroActualizado(actualizado);
      setEditandoInterruptorPrincipal(false);
    } catch {
      setError("No se pudo actualizar el interruptor principal");
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

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2">
          Nivel de falla: {tablero.nivel_falla_ka} kA{" "}
          {!editandoNivelFalla && (
            <button
              type="button"
              className="text-abb-red underline text-sm"
              onClick={() => {
                setNivelFallaKaEdit(tablero.nivel_falla_ka);
                setEditandoNivelFalla(true);
              }}
            >
              editar nivel de falla
            </button>
          )}
        </p>
        {editandoNivelFalla && (
          <form onSubmit={handleGuardarNivelFalla} className="mt-2 flex flex-col gap-2">
            <label htmlFor="nivel-falla-edit">Nuevo nivel de falla (kA)</label>
            <input
              id="nivel-falla-edit"
              value={nivelFallaKaEdit}
              onChange={(e) => setNivelFallaKaEdit(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button
                type="button"
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
                onClick={() => setEditandoNivelFalla(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
        <p className="flex flex-wrap items-center gap-2">
          Interruptor principal: {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}{" "}
          {!editandoInterruptorPrincipal && (
            <button
              type="button"
              className="text-abb-red underline text-sm"
              onClick={() => setEditandoInterruptorPrincipal(true)}
            >
              editar interruptor principal
            </button>
          )}
        </p>
        {editandoInterruptorPrincipal && (
          <div className="mt-2 flex flex-col gap-2">
            <ComponentePicker onSelect={handleSeleccionarInterruptorPrincipal} />
            <button
              type="button"
              className="self-start border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              onClick={() => setEditandoInterruptorPrincipal(false)}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

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
          {secciones.length > 0 && (
            <div
              role="tablist"
              aria-label="Secciones del tablero"
              className="flex flex-wrap gap-1 border-b border-surface-stroke"
            >
              {secciones.map(({ seccion }) => (
                <button
                  key={seccion.id}
                  role="tab"
                  type="button"
                  aria-selected={seccion.id === seccionSeleccionadaId}
                  onClick={() => setSeccionSeleccionadaRaw(seccion.id)}
                  className={`px-4 py-2 text-sm uppercase tracking-widest ${
                    seccion.id === seccionSeleccionadaId
                      ? "border-b-2 border-abb-red text-abb-red"
                      : "text-secondary hover:text-on-background"
                  }`}
                >
                  {seccion.nombre}
                </button>
              ))}
            </div>
          )}
          {seccionSeleccionada && (
            <SeccionBlock
              seccion={seccionSeleccionada.seccion}
              salidas={seccionSeleccionada.salidas}
              onSalidaCreada={(salida) => handleSalidaCreada(seccionSeleccionada.seccion.id, salida)}
              onSalidaActualizada={(salida) => handleSalidaActualizada(seccionSeleccionada.seccion.id, salida)}
            />
          )}
          <form onSubmit={handleAgregarSeccion} className="mt-6 flex flex-col gap-2">
            <label htmlFor="nombre-seccion">Nueva sección</label>
            <input id="nombre-seccion" value={nombreSeccion} onChange={(e) => setNombreSeccion(e.target.value)} />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white"
            >
              Agregar sección
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- DetalleTablero`
Expected: PASS (6 tests)

- [ ] **Step 5: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan (el resto de la suite no debería verse afectado — `SeccionBlock`, `EsquemaVisualCanvas`, `ComponentePicker` no cambiaron).

- [ ] **Step 6: Commit**

```bash
git add src/components/DetalleTablero.tsx src/components/DetalleTablero.test.tsx
git commit -m "feat: split esquema visual and secciones into a two-column layout with a section picker"
```

---

### Task 2: `DetalleTablero` — modal para Icc / interruptor principal

**Files:**
- Modify: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/components/DetalleTablero.test.tsx`

Reemplaza los triggers de texto suelto ("editar nivel de falla" / "editar interruptor principal") por un ícono `edit` que abre un modal, reutilizando el mismo patrón de accesibilidad que `ProyectosPage.tsx` (`role="dialog"`, foco inicial, Escape, backdrop, foco restaurado). Se usa un solo estado `modoEdicion` (en vez de dos booleans independientes) para que nunca puedan quedar dos modales abiertos al mismo tiempo.

- [ ] **Step 1: Actualizar los tests para el nuevo trigger + modal**

Reemplazar el test `"edits nivel de falla and reports the change upward"` y agregar dos tests nuevos en `frontend/src/components/DetalleTablero.test.tsx` (mantener los otros 5 tests del Task 1 sin cambios):

```tsx
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

    await userEvent.click(screen.getByRole("button", { name: /editar nivel de falla/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const input = screen.getByLabelText(/nuevo nivel de falla/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "16");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/nivel de falla.*16.00 kA/i)).toBeInTheDocument();
    expect(onTableroActualizado).toHaveBeenCalledWith(expect.objectContaining({ nivel_falla_ka: "16.00" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the nivel de falla modal with Escape without saving", async () => {
    renderDetalle();
    await screen.findByRole("tab", { name: "Sección 1" });

    await userEvent.click(screen.getByRole("button", { name: /editar nivel de falla/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits interruptor principal via modal and reports the change upward", async () => {
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

    await userEvent.click(screen.getByRole("button", { name: /editar interruptor principal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N250");
    await userEvent.click(await screen.findByRole("button", { name: /XT2N250/i }));

    expect(onTableroActualizado).toHaveBeenCalledWith(expect.objectContaining({ interruptor_principal_id: "c2" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
```

Nota importante: el mock de `/catalogo/buscar` en el tercer test ya usa la forma nueva `{resultados, total}` — eso es porque el Task 4/5 de este mismo plan cambia el contrato del endpoint. Si este Task 2 se ejecuta ANTES del Task 4/5 (que es el orden de este plan), `ComponentePicker` todavía espera un array plano en este punto — **ajustar el mock según el estado real de `ComponentePicker.tsx` al momento de correr este task** (ver Step 2, que exige correr los tests contra el código real antes de asumir cuál forma usar). Si el picker todavía devuelve un array plano, usar `json: async () => [{ id: "c2", ... }]` en cambio.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- DetalleTablero`
Expected: FAIL — los triggers todavía son botones de texto, no hay `role="dialog"` en el DOM.

Antes de seguir: correr `cd frontend && npm test -- ComponentePicker` y leer `frontend/src/components/ComponentePicker.tsx` para confirmar si `buscarCatalogo` ya devuelve `{resultados, total}` o todavía un array — ajustar el mock del tercer test de este Step 1 si hace falta, como se indica en la nota de arriba.

- [ ] **Step 3: Implementar el modal**

Reemplazar todo el contenido de `frontend/src/components/DetalleTablero.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  actualizarTablero,
  crearSeccion,
  listarSalidas,
  listarSecciones,
  type ComponenteBusqueda,
  type Salida,
  type Seccion,
  type Tablero,
} from "../api/client";
import type { Capas } from "./EsquemaVisual";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";
import { ComponentePicker } from "./ComponentePicker";
import { SeccionBlock } from "./SeccionBlock";

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

type ModoEdicion = "nivel_falla" | "interruptor_principal" | null;

export function DetalleTablero({
  tablero,
  onTableroActualizado,
  vista,
  onZoomChange,
  onCapasChange,
}: DetalleTableroProps) {
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
  const [seccionSeleccionadaRaw, setSeccionSeleccionadaRaw] = useState<string | null>(null);
  const [nombreSeccion, setNombreSeccion] = useState("");
  const [modoEdicion, setModoEdicion] = useState<ModoEdicion>(null);
  const [nivelFallaKaEdit, setNivelFallaKaEdit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nivelFallaTriggerRef = useRef<HTMLButtonElement>(null);
  const interruptorTriggerRef = useRef<HTMLButtonElement>(null);
  const nivelFallaInputRef = useRef<HTMLInputElement>(null);
  const interruptorDialogRef = useRef<HTMLDivElement>(null);

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

  const seccionSeleccionadaId = secciones.some((s) => s.seccion.id === seccionSeleccionadaRaw)
    ? seccionSeleccionadaRaw
    : (secciones[0]?.seccion.id ?? null);
  const seccionSeleccionada = secciones.find((s) => s.seccion.id === seccionSeleccionadaId) ?? null;

  const cerrarModal = useCallback(() => {
    setModoEdicion((modoAnterior) => {
      const triggerAnterior = modoAnterior === "nivel_falla" ? nivelFallaTriggerRef : interruptorTriggerRef;
      triggerAnterior.current?.focus();
      return null;
    });
    setError(null);
  }, []);

  useEffect(() => {
    if (!modoEdicion) return;
    if (modoEdicion === "nivel_falla") {
      nivelFallaInputRef.current?.focus();
    } else {
      interruptorDialogRef.current?.focus();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modoEdicion, cerrarModal]);

  async function handleAgregarSeccion(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const seccion = await crearSeccion(tablero.id, nombreSeccion, secciones.length);
      setSecciones((actuales) => [...actuales, { seccion, salidas: [] }]);
      setNombreSeccion("");
    } catch {
      setError("No se pudo crear la sección");
    }
  }

  async function handleGuardarNivelFalla(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { nivel_falla_ka: nivelFallaKaEdit });
      onTableroActualizado(actualizado);
      cerrarModal();
    } catch {
      setError("No se pudo actualizar el nivel de falla");
    }
  }

  async function handleSeleccionarInterruptorPrincipal(componente: ComponenteBusqueda) {
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { interruptor_principal_id: componente.id });
      onTableroActualizado(actualizado);
      cerrarModal();
    } catch {
      setError("No se pudo actualizar el interruptor principal");
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

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2">
          Nivel de falla (Icc): {tablero.nivel_falla_ka} kA
          <button
            ref={nivelFallaTriggerRef}
            type="button"
            aria-label="Editar nivel de falla"
            onClick={() => {
              setNivelFallaKaEdit(tablero.nivel_falla_ka);
              setModoEdicion("nivel_falla");
            }}
          >
            <span className="material-symbols-outlined text-abb-red text-sm">edit</span>
          </button>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          Interruptor principal: {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}
          <button
            ref={interruptorTriggerRef}
            type="button"
            aria-label="Editar interruptor principal"
            onClick={() => setModoEdicion("interruptor_principal")}
          >
            <span className="material-symbols-outlined text-abb-red text-sm">edit</span>
          </button>
        </p>
      </div>

      {modoEdicion === "nivel_falla" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModal}>
          <form
            onSubmit={handleGuardarNivelFalla}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nivel-falla-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="nivel-falla-modal-titulo" className="text-lg font-bold">
              Nivel de falla (Icc)
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
                onClick={cerrarModal}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {modoEdicion === "interruptor_principal" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModal}>
          <div
            ref={interruptorDialogRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="interruptor-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="interruptor-modal-titulo" className="text-lg font-bold">
              Interruptor principal
            </h2>
            <ComponentePicker onSelect={handleSeleccionarInterruptorPrincipal} />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={cerrarModal}
              className="mt-4 self-start border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
            >
              Cancelar
            </button>
          </div>
        </div>
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
          {secciones.length > 0 && (
            <div
              role="tablist"
              aria-label="Secciones del tablero"
              className="flex flex-wrap gap-1 border-b border-surface-stroke"
            >
              {secciones.map(({ seccion }) => (
                <button
                  key={seccion.id}
                  role="tab"
                  type="button"
                  aria-selected={seccion.id === seccionSeleccionadaId}
                  onClick={() => setSeccionSeleccionadaRaw(seccion.id)}
                  className={`px-4 py-2 text-sm uppercase tracking-widest ${
                    seccion.id === seccionSeleccionadaId
                      ? "border-b-2 border-abb-red text-abb-red"
                      : "text-secondary hover:text-on-background"
                  }`}
                >
                  {seccion.nombre}
                </button>
              ))}
            </div>
          )}
          {seccionSeleccionada && (
            <SeccionBlock
              seccion={seccionSeleccionada.seccion}
              salidas={seccionSeleccionada.salidas}
              onSalidaCreada={(salida) => handleSalidaCreada(seccionSeleccionada.seccion.id, salida)}
              onSalidaActualizada={(salida) => handleSalidaActualizada(seccionSeleccionada.seccion.id, salida)}
            />
          )}
          <form onSubmit={handleAgregarSeccion} className="mt-6 flex flex-col gap-2">
            <label htmlFor="nombre-seccion">Nueva sección</label>
            <input id="nombre-seccion" value={nombreSeccion} onChange={(e) => setNombreSeccion(e.target.value)} />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white"
            >
              Agregar sección
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

Nota: `error` ahora se comparte entre los dos modales, el formulario de nueva sección, y ya no se usa para nada más — igual que antes de este task (mismo patrón, un solo `error` state global del componente).

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- DetalleTablero`
Expected: PASS (8 tests)

- [ ] **Step 5: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetalleTablero.tsx src/components/DetalleTablero.test.tsx
git commit -m "feat: replace inline nivel de falla / interruptor principal editing with accessible modals, label as Icc"
```

---

### Task 3: `ProyectoWorkspacePage` — breadcrumb de vuelta a Proyectos

**Files:**
- Modify: `frontend/src/pages/ProyectoWorkspacePage.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Agregar al `describe("ProyectoWorkspacePage", ...)` existente en `frontend/src/pages/ProyectoWorkspacePage.test.tsx`:

```tsx
  it("shows a link back to Proyectos", async () => {
    mockFetchConDosTableros();
    renderPage();
    await screen.findByRole("tab", { name: "TG1" });

    expect(screen.getByRole("link", { name: /proyectos/i })).toHaveAttribute("href", "/proyectos");
  });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd frontend && npm test -- ProyectoWorkspacePage`
Expected: FAIL — no hay ningún link a `/proyectos` en la página.

- [ ] **Step 3: Agregar el breadcrumb**

En `frontend/src/pages/ProyectoWorkspacePage.tsx`, cambiar el import de react-router-dom:

```tsx
import { Link, useParams, useSearchParams } from "react-router-dom";
```

Y agregar el breadcrumb como primer elemento dentro del `return`, antes del `<h1>`:

```tsx
      <Link to="/proyectos" className="text-sm text-secondary hover:text-on-background">
        ← Proyectos
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{proyecto.nombre}</h1>
```

(Reemplaza la línea `<h1 className="text-2xl font-bold">{proyecto.nombre}</h1>` existente por las dos líneas de arriba — se le agrega `mt-2` al h1 para dejar aire respecto del breadcrumb.)

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- ProyectoWorkspacePage`
Expected: PASS (9 tests)

- [ ] **Step 5: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProyectoWorkspacePage.tsx src/pages/ProyectoWorkspacePage.test.tsx
git commit -m "feat: add a breadcrumb link back to Proyectos from the tablero workspace"
```

---

### Task 4: Backend — paginación y total de coincidencias en `/catalogo/buscar`

**Files:**
- Modify: `backend/app/routers/catalogo.py`
- Modify: `backend/tests/test_catalogo_buscar_endpoint.py`

Cambia el contrato del endpoint: de `list[ComponenteBusquedaResponse]` a `{resultados: [...], total: N}`, agrega `limit`/`offset` como query params opcionales (default `limit=20, offset=0`, tope de `limit` en 50).

- [ ] **Step 1: Reescribir los tests para el nuevo contrato**

Reemplazar todo el contenido de `backend/tests/test_catalogo_buscar_endpoint.py`:

```python
from decimal import Decimal

from app.models import CatalogoComponente
from app.scripts.create_user import create_user


def _login(client, db_session, email="buscarcat.test@pyre.com"):
    create_user(email, "Analista de Prueba", "clave-segura-123", "analista", db=db_session)
    client.post("/auth/login", json={"email": email, "password": "clave-segura-123"})


def _componente(db_session, codigo, descripcion, codigo_comercial=None):
    componente = CatalogoComponente(
        proveedor="ABB",
        codigo=codigo,
        codigo_comercial=codigo_comercial,
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
    assert body["total"] == 1
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)
    assert body["resultados"][0]["codigo"] == "ZQXBUSCAR-C1"


def test_buscar_encuentra_por_descripcion(client, db_session):
    _login(client, db_session, email="buscarcat2.test@pyre.com")
    componente = _componente(db_session, "ZQXBUSCAR-C2", "Interruptor ZQXBUSCAR especial")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR especial"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)


def test_buscar_con_termino_corto_devuelve_vacio(client, db_session):
    _login(client, db_session, email="buscarcat3.test@pyre.com")

    response = client.get("/catalogo/buscar", params={"q": "z"})

    assert response.status_code == 200
    assert response.json() == {"resultados": [], "total": 0}


def test_buscar_encuentra_por_codigo_comercial(client, db_session):
    _login(client, db_session, email="buscarcat4.test@pyre.com")
    componente = _componente(db_session, "COD-INTERNO-1", "Interruptor sin match textual", codigo_comercial="ZQXBUSCAR-SH201")

    response = client.get("/catalogo/buscar", params={"q": "ZQXBUSCAR-SH201"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["resultados"]) == 1
    assert body["resultados"][0]["id"] == str(componente.id)
    assert body["resultados"][0]["codigo_comercial"] == "ZQXBUSCAR-SH201"


def test_buscar_prioriza_coincidencia_de_prefijo_en_codigo(client, db_session):
    _login(client, db_session, email="buscarcat5.test@pyre.com")
    en_descripcion = _componente(db_session, "AAA-OTRO-COD", "Interruptor con ZQXPRI200 en el medio del texto")
    prefijo_codigo = _componente(db_session, "ZQXPRI-C1", "Interruptor cualquiera")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPRI"})

    body = response.json()
    ids = [c["id"] for c in body["resultados"]]
    assert ids.index(str(prefijo_codigo.id)) < ids.index(str(en_descripcion.id))


def test_buscar_devuelve_total_de_coincidencias_mayor_a_los_resultados_devueltos(client, db_session):
    _login(client, db_session, email="buscarcat6.test@pyre.com")
    for i in range(25):
        _componente(db_session, f"ZQXPAG-{i:03d}", f"Interruptor de paginación {i}")

    response = client.get("/catalogo/buscar", params={"q": "ZQXPAG"})

    body = response.json()
    assert body["total"] == 25
    assert len(body["resultados"]) == 20


def test_buscar_respeta_offset_y_limit_sin_duplicar_resultados(client, db_session):
    _login(client, db_session, email="buscarcat7.test@pyre.com")
    for i in range(25):
        _componente(db_session, f"ZQXOFF-{i:03d}", f"Interruptor de offset {i}")

    primera_pagina = client.get("/catalogo/buscar", params={"q": "ZQXOFF", "limit": 20, "offset": 0}).json()
    segunda_pagina = client.get("/catalogo/buscar", params={"q": "ZQXOFF", "limit": 20, "offset": 20}).json()

    assert len(primera_pagina["resultados"]) == 20
    assert len(segunda_pagina["resultados"]) == 5
    ids_primera = {c["id"] for c in primera_pagina["resultados"]}
    ids_segunda = {c["id"] for c in segunda_pagina["resultados"]}
    assert ids_primera.isdisjoint(ids_segunda)


def test_buscar_limita_el_limit_maximo_a_50(client, db_session):
    _login(client, db_session, email="buscarcat8.test@pyre.com")
    for i in range(60):
        _componente(db_session, f"ZQXMAX-{i:03d}", f"Interruptor de tope {i}")

    response = client.get("/catalogo/buscar", params={"q": "ZQXMAX", "limit": 1000})

    body = response.json()
    assert body["total"] == 60
    assert len(body["resultados"]) == 50
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: FAIL — el endpoint todavía devuelve una lista plana, no `{resultados, total}`, y no acepta `limit`/`offset`.

- [ ] **Step 3: Implementar el endpoint**

En `backend/app/routers/catalogo.py`, reemplazar desde la clase `ComponenteBusquedaResponse` hasta el final del archivo:

```python
class ComponenteBusquedaResponse(BaseModel):
    id: str
    codigo: str
    codigo_comercial: str | None
    descripcion: str
    precio_neto: Decimal | None

    model_config = {"from_attributes": True}


class BusquedaCatalogoResponse(BaseModel):
    resultados: list[ComponenteBusquedaResponse]
    total: int


_LIMIT_MAXIMO = 50
_LIMIT_POR_DEFECTO = 20


@router.get("/buscar", response_model=BusquedaCatalogoResponse)
def buscar_componentes(
    q: str = "",
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

    total = db.query(CatalogoComponente).filter(filtro).count()

    componentes = (
        db.query(CatalogoComponente)
        .filter(filtro)
        .order_by(relevancia, CatalogoComponente.codigo)
        .offset(offset)
        .limit(limit)
        .all()
    )

    return BusquedaCatalogoResponse(
        resultados=[
            ComponenteBusquedaResponse(
                id=str(c.id),
                codigo=c.codigo,
                codigo_comercial=c.codigo_comercial,
                descripcion=c.descripcion,
                precio_neto=c.precio_neto,
            )
            for c in componentes
        ],
        total=total,
    )
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd backend && venv/Scripts/python -m pytest tests/test_catalogo_buscar_endpoint.py -v`
Expected: PASS (9 tests)

- [ ] **Step 5: Correr toda la suite de backend**

Run: `cd backend && venv/Scripts/python -m pytest -q`
Expected: todos los tests pasan (108 + los nuevos de este archivo).

- [ ] **Step 6: Commit**

```bash
git add app/routers/catalogo.py tests/test_catalogo_buscar_endpoint.py
git commit -m "feat: add pagination and total count to GET /catalogo/buscar"
```

---

### Task 5: Frontend — `ComponentePicker` con indicador de resultados y "Cargar más"

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/components/ComponentePicker.tsx`
- Modify: `frontend/src/components/ComponentePicker.test.tsx`

Depende del Task 4 (el backend ya debe devolver `{resultados, total}`). Este task actualiza el cliente HTTP y el único componente que lo consume en el mismo paso, para no dejar el build roto entre commits.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar todo el contenido de `frontend/src/components/ComponentePicker.test.tsx`:

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
        json: async () => ({
          resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
          total: 1,
        }),
      }),
    );
    const onSelect = vi.fn();
    render(<ComponentePicker onSelect={onSelect} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await userEvent.click(await screen.findByRole("button", { name: /SH201-C16/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", codigo: "SH201-C16" }));
  });

  it("shows 'sin resultados' when the search returns nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultados: [], total: 0 }) }),
    );
    render(<ComponentePicker onSelect={vi.fn()} />);

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
    render(<ComponentePicker onSelect={vi.fn()} />);

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
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByText(/mostrando 1 de 2 resultados/i);

    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));

    expect(await screen.findByRole("button", { name: /SH201-C20/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SH201-C16/i })).toBeInTheDocument();
    expect(screen.getByText(/mostrando 2 de 2 resultados/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- ComponentePicker`
Expected: FAIL — `buscarCatalogo` todavía espera un array, y el componente no soporta paginación ni indicador de cantidad.

- [ ] **Step 3: Actualizar `api/client.ts`**

En `frontend/src/api/client.ts`, reemplazar la función `buscarCatalogo` y agregar el nuevo tipo justo antes de ella (dejar `ComponenteBusqueda` sin cambios):

```ts
export interface ResultadoBusquedaCatalogo {
  resultados: ComponenteBusqueda[];
  total: number;
}

export async function buscarCatalogo(
  q: string,
  opciones?: { limit?: number; offset?: number },
): Promise<ResultadoBusquedaCatalogo> {
  const params = new URLSearchParams({ q });
  if (opciones?.limit !== undefined) params.set("limit", String(opciones.limit));
  if (opciones?.offset !== undefined) params.set("offset", String(opciones.offset));
  const response = await fetch(`${API_BASE_URL}/catalogo/buscar?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo buscar en el catálogo");
  return response.json();
}
```

- [ ] **Step 4: Actualizar `ComponentePicker.tsx`**

Reemplazar todo el contenido de `frontend/src/components/ComponentePicker.tsx`:

```tsx
import { useState } from "react";
import { buscarCatalogo, type ComponenteBusqueda } from "../api/client";

const RESULTADOS_POR_PAGINA = 20;

interface ComponentePickerProps {
  onSelect: (componente: ComponenteBusqueda) => void;
}

export function ComponentePicker({ onSelect }: ComponentePickerProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ComponenteBusqueda[] | null>(null);
  const [total, setTotal] = useState(0);

  async function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResultados(null);
      setTotal(0);
      return;
    }
    const respuesta = await buscarCatalogo(value, { limit: RESULTADOS_POR_PAGINA, offset: 0 });
    setResultados(respuesta.resultados);
    setTotal(respuesta.total);
  }

  async function handleCargarMas() {
    if (resultados === null) return;
    const respuesta = await buscarCatalogo(query, { limit: RESULTADOS_POR_PAGINA, offset: resultados.length });
    setResultados((actuales) => [...(actuales ?? []), ...respuesta.resultados]);
  }

  return (
    <div className="relative">
      <input
        aria-label="Buscar código o descripción"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full border border-surface-stroke p-2"
      />
      {resultados !== null && resultados.length === 0 && <p className="text-secondary">sin resultados</p>}
      {resultados !== null && resultados.length > 0 && (
        <div className="absolute z-10 w-full border border-t-0 border-surface-stroke bg-white">
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
              className="w-full border-t border-surface-stroke p-2 text-sm uppercase tracking-widest text-abb-red hover:bg-industrial-gray"
            >
              Cargar más
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- ComponentePicker`
Expected: PASS (5 tests)

- [ ] **Step 6: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan (`DetalleTablero.test.tsx` y `ProyectoWorkspacePage.test.tsx`, que también usan `ComponentePicker` indirectamente en sus mocks de `/catalogo/buscar`, deben seguir pasando con la forma nueva `{resultados, total}` — si algún mock de esos archivos todavía usa un array plano para `/catalogo/buscar`, corregirlo a la forma `{resultados: [...], total: N}` en este mismo commit).

- [ ] **Step 7: Verificar el build**

Run: `cd frontend && npm run build`
Expected: build exitoso, sin errores de TypeScript (el cambio de tipo de retorno de `buscarCatalogo` debe estar completamente propagado).

- [ ] **Step 8: Commit**

```bash
git add src/api/client.ts src/components/ComponentePicker.tsx src/components/ComponentePicker.test.tsx
git commit -m "feat: add result count indicator and Cargar más pagination to ComponentePicker"
```

---

### Task 6: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan.

- [ ] **Step 2: Correr toda la suite de backend**

Run: `cd backend && venv/Scripts/python -m pytest -q`
Expected: todos los tests pasan.

- [ ] **Step 3: Verificar que el frontend compila para producción**

Run: `cd frontend && npm run build`
Expected: build exitoso.

- [ ] **Step 4: Verificación manual en el navegador de preview**

Levantar `backend` y `frontend` vía `preview_start`, loguearse, y recorrer:
1. Abrir un tablero: el esquema visual ocupa ~1/3 del ancho, a la derecha aparece el selector de secciones ("Sección 1", etc.), clickear otra sección cambia la tabla mostrada.
2. "Nivel de falla (Icc)" tiene un ícono de lápiz al lado, no un link de texto; clickearlo abre un modal (no reflowea la página), Escape lo cierra, clickear afuera lo cierra, guardar actualiza el valor y cierra el modal.
3. Mismo comportamiento para "editar interruptor principal" (ícono + modal con el buscador adentro).
4. En el buscador de componentes (dentro del modal de interruptor principal, o en cualquier `ComponentePicker`), buscar un término común: aparece "Mostrando X de Y resultados" y, si `Y > X`, un botón "Cargar más" que trae la página siguiente sin borrar los resultados ya visibles.
5. Desde el workspace de un tablero, hay un link "← Proyectos" arriba del nombre del proyecto que vuelve a `/proyectos`.

- [ ] **Step 5: Commit final (si la verificación manual encontró algo, corregirlo en un commit separado antes de este paso)**

No hace falta actualizar `CLAUDE.md` para este ciclo — es un ajuste de UX sobre una fase ya marcada como mergeada, no una fase nueva.
