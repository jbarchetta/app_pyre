# Rediseño de UI + modelador gráfico del esquema visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt Tailwind CSS with the approved visual direction (industrial/blueprint, ABB red accent, sharp corners), add a global nav shell, rebuild the esquema visual as a functional graphical modeler (zoom, layers, per-tablero state via tabs), and restyle the remaining pages.

**Architecture:** Tailwind v4 via `@tailwindcss/vite` (no separate PostCSS config needed), theme tokens defined in `index.css` via `@theme`. A new `Layout` component wraps all authenticated routes with a header+sidebar shell. `EsquemaVisual` (pure SVG renderer) is wrapped by a new `EsquemaVisualCanvas` (toolbar: zoom, layers) which is a fully controlled component — its zoom/layers state lives one level up, in the new `ProyectoWorkspacePage`, keyed by tablero id, so switching tabs preserves each tablero's view. `ProyectoWorkspacePage` replaces `ProyectoDetallePage` + `TableroPage`, adding a tab strip over the tableros of a proyecto.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`, `@tailwindcss/forms`), Vitest + React Testing Library (existing conventions, `globals: true`, jsdom environment).

---

## Spec coverage check (self-review, done before tasks below)

| Spec section | Task(s) |
|---|---|
| Dirección visual / tokens | Task 1 |
| Arquitectura de estilos (Tailwind) | Task 1 |
| Shell global + nav (activo/deshabilitado) | Task 2, Task 3 |
| Fusión rutas workspace + pestañas | Task 3, Task 6, Task 7 |
| Modelador gráfico: canvas blueprint + patrón diferencial | Task 4 |
| Modelador gráfico: zoom | Task 5 |
| Modelador gráfico: capas | Task 5 |
| Persistencia zoom/capas por pestaña | Task 7, Task 8 |
| Eliminar ruta `/tableros/:id`, borrar archivos viejos | Task 3, Task 9 |
| `ProyectosPage` grilla + modal | Task 10 |
| `SeccionBlock` tabla + badges | Task 11 |
| Resto de pantallas (Catálogo, ComponentePicker, Parámetros, Login, Dashboard) | Task 12 |
| Verificación final | Task 13 |

---

### Task 1: Instalar y configurar Tailwind CSS v4

**Files:**
- Modify: `frontend/package.json` (vía `npm install`)
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/index.css`

No hay un "test que falla" natural para configuración de build — se verifica corriendo el build y confirmando que no rompe nada existente.

- [ ] **Step 1: Instalar dependencias**

```bash
cd frontend
npm install tailwindcss @tailwindcss/vite @tailwindcss/forms
```

- [ ] **Step 2: Agregar el plugin de Tailwind a Vite**

Editar `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 3: Reemplazar `index.css` con los tokens de la dirección visual aprobada**

Reemplazar todo el contenido de `frontend/src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
@import "tailwindcss";
@plugin "@tailwindcss/forms";

@theme {
  --color-background: #f9f9f9;
  --color-surface: #f9f9f9;
  --color-surface-container-lowest: #ffffff;
  --color-on-background: #1a1c1c;
  --color-secondary: #5e5e5f;
  --color-surface-stroke: #d1d1d1;
  --color-industrial-gray: #f4f4f4;
  --color-abb-red: #e31f26;
  --color-error: #ba1a1a;

  --font-sans: "Hanken Grotesk", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--color-background);
  color: var(--color-on-background);
}

.material-symbols-outlined {
  font-family: "Material Symbols Outlined";
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  vertical-align: middle;
}
```

Nota de convención (no requiere código, es una regla para el resto de las tareas): **no se usan utilidades `rounded-*`** en ningún componente nuevo o restyleado, salvo `rounded-full` si hiciera falta un elemento circular. Como Tailwind no aplica radius por defecto, esto logra la estética "esquinas rectas" del spec sin pelear con la escala de radius de Tailwind v4.

- [ ] **Step 4: Verificar que el build no se rompe**

```bash
cd frontend
npm run build
```

Expected: build exitoso, sin errores de Tailwind/PostCSS. Puede haber warnings de TypeScript preexistentes no relacionados — no deben ser nuevos.

- [ ] **Step 5: Verificar que los tests existentes siguen pasando**

```bash
npm test
```

Expected: mismos tests que pasaban antes (no debería haber cambiado ningún componente todavía).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/index.css
git commit -m "feat: adopt Tailwind CSS v4 with the approved visual tokens"
```

---

### Task 2: Componente `Layout` (shell de navegación)

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Test: `frontend/src/components/Layout.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// frontend/src/components/Layout.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";

function renderLayout() {
  render(
    <MemoryRouter initialEntries={["/proyectos"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/proyectos" element={<p>Página de proyectos</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  it("renders active nav items as links to their route", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/proyectos");
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByRole("link", { name: "Parámetros de cálculo" })).toHaveAttribute(
      "href",
      "/parametros-calculo",
    );
  });

  it("renders the Cotizador item as disabled, not a link", () => {
    renderLayout();
    expect(screen.queryByRole("link", { name: /cotizador/i })).not.toBeInTheDocument();
    expect(screen.getByText("Cotizador")).toBeInTheDocument();
    expect(screen.getByText(/próximo módulo/i)).toBeInTheDocument();
  });

  it("renders the matched child route via Outlet", () => {
    renderLayout();
    expect(screen.getByText("Página de proyectos")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd frontend && npm test -- Layout`
Expected: FAIL — `Cannot find module './Layout'`

- [ ] **Step 3: Implementar el componente**

```tsx
// frontend/src/components/Layout.tsx
import { NavLink, Outlet } from "react-router-dom";

interface NavItem {
  label: string;
  to: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Proyectos", to: "/proyectos" },
  { label: "Catálogo", to: "/catalogo" },
  { label: "Parámetros de cálculo", to: "/parametros-calculo" },
  { label: "Cotizador", to: "/cotizador", disabled: true },
];

export function Layout() {
  return (
    <div className="flex min-h-screen bg-surface text-on-background">
      <aside className="flex w-64 flex-col gap-2 border-r border-surface-stroke bg-industrial-gray px-4 py-8">
        <p className="mb-8 px-2 text-lg font-bold text-abb-red">CONFIGURADOR PYRE</p>
        <nav className="flex flex-col gap-1" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) =>
            item.disabled ? (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex items-center justify-between px-3 py-3 text-sm uppercase tracking-widest text-secondary opacity-50"
              >
                {item.label}
                <span className="font-mono text-[10px]">Próximo módulo</span>
              </span>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-3 text-sm uppercase tracking-widest ${
                    isActive ? "bg-abb-red text-white" : "text-secondary hover:bg-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-16 items-center border-b border-surface-stroke bg-white px-8">
          <span className="material-symbols-outlined mr-2 text-abb-red">settings_input_component</span>
          <span className="text-lg font-bold text-abb-red">CONFIGURADOR PYRE</span>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd frontend && npm test -- Layout`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/Layout.test.tsx
git commit -m "feat: add Layout shell with header and sidebar navigation"
```

---

### Task 3: Integrar `Layout` en `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

No hay `App.test.tsx` existente. La verificación es manual (Step 3) más el resto de la suite (Step 2), ya que este cambio es routing puro sin lógica nueva propia.

- [ ] **Step 1: Reescribir `App.tsx` con rutas anidadas bajo `Layout`**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { CatalogoPage } from "./pages/CatalogoPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ParametrosCalculoPage } from "./pages/ParametrosCalculoPage";
import { ProyectosPage } from "./pages/ProyectosPage";
import { ProyectoWorkspacePage } from "./pages/ProyectoWorkspacePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/proyectos" element={<ProyectosPage />} />
          <Route path="/proyectos/:id" element={<ProyectoWorkspacePage />} />
          <Route path="/parametros-calculo" element={<ParametrosCalculoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

Nota: esto referencia `ProyectoWorkspacePage`, que todavía no existe — se crea en el Task 6 (Tasks 4 y 5 no la tocan, solo preparan `EsquemaVisual`/`EsquemaVisualCanvas`). El proyecto no compilará hasta completar ese task; por eso este cambio se commitea junto con el Task 6, no antes. Dejar este Step 1 hecho pero **no commitear todavía** — seguir directo con los Tasks 4, 5 y 6 antes de volver a este archivo.

- [ ] **Step 2 (se completa al final del Task 6): Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan, incluidos los nuevos de `ProyectoWorkspacePage`.

- [ ] **Step 3 (se completa al final del Task 6): Verificar manualmente en el navegador de preview**

Levantar el dev server (`preview_start` con el config `frontend` de `.claude/launch.json`), loguearse, y confirmar que el sidebar aparece, que "Cotizador" está deshabilitado, y que navegar a Proyectos/Catálogo/Parámetros funciona.

- [ ] **Step 4 (se completa al final del Task 6): Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire Layout shell into routing and merge tablero routes into workspace"
```

---

### Task 4: `EsquemaVisual` — estética blueprint + patrón para diferencial + capas

**Files:**
- Modify: `frontend/src/components/EsquemaVisual.tsx`
- Modify: `frontend/src/components/EsquemaVisual.test.tsx`

Este task cambia intencionalmente el comportamiento de color aprobado en el spec (relleno sólido/patrón en vez de dos colores) — los tests existentes que verifican `fill="#4a90d9"` / `fill="#d94a6a"` quedan desactualizados a propósito y se reescriben.

- [ ] **Step 1: Reescribir los tests para reflejar el nuevo comportamiento**

Reemplazar todo el contenido de `frontend/src/components/EsquemaVisual.test.tsx`:

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

  it("draws a tripolar rectangle three poles wide", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-tri", formato: "tripolar" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-tri")).toHaveAttribute("width", "72");
  });

  it("fills a termomagnetico salida solid", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-term" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-term")).toHaveAttribute("fill", "#1a1c1c");
  });

  it("fills a diferencial salida with the diagonal-stripe pattern", () => {
    render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-dif", tipo_proteccion: "seccional_diferencial" })] }]}
      />,
    );

    expect(screen.getByTestId("salida-sal-dif")).toHaveAttribute("fill", "url(#rayas-diferencial)");
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

  it("renders the interruptor principal block only when present, in the accent color", () => {
    const { rerender } = render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} />);
    expect(screen.queryByTestId("interruptor-principal")).not.toBeInTheDocument();

    rerender(<EsquemaVisual tieneInterruptorPrincipal={true} secciones={[]} />);
    expect(screen.getByTestId("interruptor-principal")).toHaveAttribute("fill", "#e31f26");
  });

  it("shows the componente code label when the codigos layer is on and hides it when off", () => {
    const { rerender } = render(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-label" })] }]}
        capas={{ codigos: true, embarrado: true }}
      />,
    );
    expect(screen.getByTestId("salida-sal-label-codigo")).toBeInTheDocument();

    rerender(
      <EsquemaVisual
        tieneInterruptorPrincipal={false}
        secciones={[{ seccion, salidas: [salida({ id: "sal-label" })] }]}
        capas={{ codigos: false, embarrado: true }}
      />,
    );
    expect(screen.queryByTestId("salida-sal-label-codigo")).not.toBeInTheDocument();
  });

  it("shows the embarrado band when the embarrado layer is on and hides it when off", () => {
    const { rerender } = render(
      <EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} capas={{ codigos: true, embarrado: true }} />,
    );
    expect(screen.getByTestId("embarrado")).toBeInTheDocument();

    rerender(
      <EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} capas={{ codigos: true, embarrado: false }} />,
    );
    expect(screen.queryByTestId("embarrado")).not.toBeInTheDocument();
  });

  it("scales the viewBox down when zoomed in, so content renders larger", () => {
    render(<EsquemaVisual tieneInterruptorPrincipal={false} secciones={[]} zoom={2} />);

    const svg = screen.getByRole("img", { name: /esquema visual del tablero/i });
    const [, , viewBoxAncho] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect(viewBoxAncho).toBe(240);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- EsquemaVisual`
Expected: FAIL — los tests de color/capas/zoom fallan porque el componente no soporta esas props ni el patrón todavía.

- [ ] **Step 3: Implementar el componente**

```tsx
// frontend/src/components/EsquemaVisual.tsx
import type { Salida, Seccion } from "../api/client";

const ANCHO_POR_POLO = 24;
const ALTO = 24;
const ANCHO_BASE = 480;
const ALTO_EMBARRADO = 30;

const POLOS_POR_FORMATO: Record<Salida["formato"], number> = {
  unipolar: 1,
  bipolar: 2,
  tripolar: 3,
  tetrapolar: 4,
};

export interface Capas {
  codigos: boolean;
  embarrado: boolean;
}

const CAPAS_POR_DEFECTO: Capas = { codigos: true, embarrado: true };

interface EsquemaVisualProps {
  tieneInterruptorPrincipal: boolean;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  zoom?: number;
  capas?: Capas;
}

export function EsquemaVisual({
  tieneInterruptorPrincipal,
  secciones,
  zoom = 1,
  capas = CAPAS_POR_DEFECTO,
}: EsquemaVisualProps) {
  const offsetEmbarrado = capas.embarrado ? ALTO_EMBARRADO : 0;
  const altoBase = 50 + offsetEmbarrado + secciones.length * (ALTO + 20) + 20;
  const anchoViewBox = ANCHO_BASE / zoom;
  const altoViewBox = altoBase / zoom;

  return (
    <svg
      role="img"
      aria-label="Esquema visual del tablero"
      width={ANCHO_BASE}
      height={altoBase}
      viewBox={`0 0 ${anchoViewBox} ${altoViewBox}`}
    >
      <defs>
        <pattern id="rayas-diferencial" patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
          <rect width={4} height={4} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={4} stroke="#1a1c1c" strokeWidth={2} />
        </pattern>
      </defs>
      {capas.embarrado && (
        <rect
          data-testid="embarrado"
          x={10}
          y={5}
          width={ANCHO_BASE - 20}
          height={20}
          fill="none"
          stroke="#1a1c1c"
          strokeDasharray="4,2"
        />
      )}
      {tieneInterruptorPrincipal && (
        <rect
          data-testid="interruptor-principal"
          x={20}
          y={10 + offsetEmbarrado}
          width={120}
          height={ALTO}
          fill="#e31f26"
        />
      )}
      {secciones.map(({ seccion, salidas }, seccionIndex) => {
        const y = 50 + offsetEmbarrado + seccionIndex * (ALTO + 20);
        let x = 20;
        return (
          <g key={seccion.id}>
            {salidas.map((salida) => {
              const ancho = ANCHO_POR_POLO * POLOS_POR_FORMATO[salida.formato];
              const rectX = x;
              x += ancho + 4;
              const asignada = !!salida.componente_id;
              const fill = !asignada
                ? "none"
                : salida.tipo_proteccion === "seccional_diferencial"
                  ? "url(#rayas-diferencial)"
                  : "#1a1c1c";
              return (
                <g key={salida.id}>
                  <rect
                    data-testid={`salida-${salida.id}`}
                    x={rectX}
                    y={y}
                    width={ancho}
                    height={ALTO}
                    fill={fill}
                    stroke="#1a1c1c"
                    strokeDasharray={asignada ? undefined : "2,2"}
                  />
                  {capas.codigos && asignada && (
                    <text
                      data-testid={`salida-${salida.id}-codigo`}
                      x={rectX + ancho / 2}
                      y={y + ALTO + 10}
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={8}
                      textAnchor="middle"
                    >
                      {salida.carga_valor}
                      {salida.carga_unidad}
                    </text>
                  )}
                </g>
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

Run: `cd frontend && npm test -- EsquemaVisual`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/EsquemaVisual.tsx src/components/EsquemaVisual.test.tsx
git commit -m "feat: redesign esquema visual with blueprint style, diagonal pattern for diferencial, and layers"
```

---

### Task 5: `EsquemaVisualCanvas` — zoom y capas funcionales

**Files:**
- Create: `frontend/src/components/EsquemaVisualCanvas.tsx`
- Test: `frontend/src/components/EsquemaVisualCanvas.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

```tsx
// frontend/src/components/EsquemaVisualCanvas.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";

describe("EsquemaVisualCanvas", () => {
  it("calls onZoomChange with an increased value when clicking zoom in", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={1}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /acercar/i }));

    expect(onZoomChange).toHaveBeenCalledWith(1.25);
  });

  it("does not go below the 0.5 minimum when zooming out", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={0.5}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /alejar/i }));

    expect(onZoomChange).toHaveBeenCalledWith(0.5);
  });

  it("does not go above the 2.0 maximum when zooming in", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={2}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /acercar/i }));

    expect(onZoomChange).toHaveBeenCalledWith(2);
  });

  it("resets zoom to 100% when clicking the zoom label", async () => {
    const onZoomChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={1.5}
        onZoomChange={onZoomChange}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /ajustar zoom/i }));

    expect(onZoomChange).toHaveBeenCalledWith(1);
  });

  it("opens the layers panel and toggles a layer", async () => {
    const onCapasChange = vi.fn();
    render(
      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={false}
        secciones={[]}
        zoom={1}
        onZoomChange={vi.fn()}
        capas={{ codigos: true, embarrado: true }}
        onCapasChange={onCapasChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^capas$/i }));
    await userEvent.click(screen.getByLabelText(/embarrado/i));

    expect(onCapasChange).toHaveBeenCalledWith({ codigos: true, embarrado: false });
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- EsquemaVisualCanvas`
Expected: FAIL — `Cannot find module './EsquemaVisualCanvas'`

- [ ] **Step 3: Implementar el componente**

```tsx
// frontend/src/components/EsquemaVisualCanvas.tsx
import { useState } from "react";
import type { Salida, Seccion } from "../api/client";
import { EsquemaVisual, type Capas } from "./EsquemaVisual";

const ZOOM_PASO = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

interface EsquemaVisualCanvasProps {
  tieneInterruptorPrincipal: boolean;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
  capas: Capas;
  onCapasChange: (capas: Capas) => void;
}

function limitar(valor: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(valor.toFixed(2))));
}

export function EsquemaVisualCanvas({
  tieneInterruptorPrincipal,
  secciones,
  zoom,
  onZoomChange,
  capas,
  onCapasChange,
}: EsquemaVisualCanvasProps) {
  const [panelCapasAbierto, setPanelCapasAbierto] = useState(false);

  return (
    <div className="border border-surface-stroke bg-white">
      <div className="flex items-center justify-between border-b border-surface-stroke bg-industrial-gray p-4">
        <span className="font-mono text-xs uppercase text-secondary">Vista frontal — Blueprint 1:20</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Alejar" onClick={() => onZoomChange(limitar(zoom - ZOOM_PASO))}>
            <span className="material-symbols-outlined">zoom_out</span>
          </button>
          <button
            type="button"
            aria-label="Ajustar zoom"
            className="font-mono text-xs"
            onClick={() => onZoomChange(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="Acercar" onClick={() => onZoomChange(limitar(zoom + ZOOM_PASO))}>
            <span className="material-symbols-outlined">zoom_in</span>
          </button>
          <button type="button" aria-label="Capas" onClick={() => setPanelCapasAbierto((abierto) => !abierto)}>
            <span className="material-symbols-outlined">layers</span>
          </button>
        </div>
      </div>
      {panelCapasAbierto && (
        <div className="flex gap-4 border-b border-surface-stroke p-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={capas.codigos}
              onChange={(e) => onCapasChange({ ...capas, codigos: e.target.checked })}
            />
            Códigos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={capas.embarrado}
              onChange={(e) => onCapasChange({ ...capas, embarrado: e.target.checked })}
            />
            Embarrado
          </label>
        </div>
      )}
      <div className="blueprint-grid flex justify-center overflow-auto p-8">
        <EsquemaVisual
          tieneInterruptorPrincipal={tieneInterruptorPrincipal}
          secciones={secciones}
          zoom={zoom}
          capas={capas}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Agregar la utilidad `blueprint-grid` usada arriba**

Agregar al final de `frontend/src/index.css` (creado en el Task 1):

```css
@utility blueprint-grid {
  background-image:
    linear-gradient(var(--color-surface-stroke) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-surface-stroke) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- EsquemaVisualCanvas`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/EsquemaVisualCanvas.tsx src/index.css
git commit -m "feat: add functional zoom and layers toolbar around the esquema visual canvas"
```

---

### Task 6: `ProyectoWorkspacePage` — pestañas de tableros + estado vacío

**Files:**
- Create: `frontend/src/pages/ProyectoWorkspacePage.tsx`
- Test: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

Este task cubre solo la estructura de pestañas y el estado vacío. El detalle del tablero activo (secciones/salidas/esquema) se agrega en el Task 7 para mantener los pasos chicos.

- [ ] **Step 1: Escribir los tests que fallan**

```tsx
// frontend/src/pages/ProyectoWorkspacePage.test.tsx
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

  it("creates a new tablero, adds a tab for it, and activates it", async () => {
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

    await userEvent.type(screen.getByLabelText(/^nombre$/i), "TG3");
    await userEvent.click(screen.getByRole("button", { name: /crear tablero/i }));

    expect(await screen.findByRole("tab", { name: "TG3" })).toHaveAttribute("aria-selected", "true");
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- ProyectoWorkspacePage`
Expected: FAIL — `Cannot find module './ProyectoWorkspacePage'`

- [ ] **Step 3: Implementar la página (versión con pestañas, sin el detalle del tablero activo todavía)**

```tsx
// frontend/src/pages/ProyectoWorkspacePage.tsx
import { useEffect, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  crearTablero,
  listarTableros,
  obtenerProyecto,
  type ComponenteBusqueda,
  type Proyecto,
  type Tablero,
} from "../api/client";
import { ComponentePicker } from "../components/ComponentePicker";

// Icc estándar de arranque para no bloquear la creación del tablero — el
// analista lo puede editar desde el detalle del tablero si el estudio
// eléctrico del sitio da un valor distinto.
const NIVEL_FALLA_KA_POR_DEFECTO = "10";

export function ProyectoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tableros, setTableros] = useState<Tablero[]>([]);
  const [nombre, setNombre] = useState("");
  const [nivelFallaKa, setNivelFallaKa] = useState(NIVEL_FALLA_KA_POR_DEFECTO);
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

  const tableroActivoId = searchParams.get("tablero") ?? tableros[0]?.id ?? null;
  const tableroActivo = tableros.find((t) => t.id === tableroActivoId) ?? null;

  function handleSeleccionarTablero(tableroId: string) {
    setSearchParams({ tablero: tableroId });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const tablero = await crearTablero(id, nombre, nivelFallaKa, interruptorPrincipal?.id ?? null);
      setTableros((actuales) => [...actuales, tablero]);
      setNombre("");
      setNivelFallaKa(NIVEL_FALLA_KA_POR_DEFECTO);
      setInterruptorPrincipal(null);
      setSearchParams({ tablero: tablero.id });
    } catch {
      setError("No se pudo crear el tablero");
    }
  }

  if (!proyecto) return <p>Cargando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">{proyecto.nombre}</h1>
      <p className="text-secondary">{proyecto.cliente}</p>

      {tableros.length > 0 && (
        <div role="tablist" aria-label="Tableros del proyecto" className="mt-6 flex gap-1 border-b border-surface-stroke">
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

      {tableroActivo === null && (
        <p className="mt-6 text-secondary">Creá tu primer tablero para empezar a configurarlo.</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-bold">Nuevo tablero</h2>
        <label htmlFor="nombre-tablero">Nombre</label>
        <input id="nombre-tablero" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label htmlFor="nivel-falla">Nivel de falla (kA)</label>
        <input id="nivel-falla" value={nivelFallaKa} onChange={(e) => setNivelFallaKa(e.target.value)} />
        <p>Interruptor principal{interruptorPrincipal ? `: ${interruptorPrincipal.codigo}` : " (opcional)"}</p>
        <ComponentePicker onSelect={setInterruptorPrincipal} />
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Crear tablero
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- ProyectoWorkspacePage`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProyectoWorkspacePage.tsx src/pages/ProyectoWorkspacePage.test.tsx
git commit -m "feat: add ProyectoWorkspacePage with a tab per tablero"
```

- [ ] **Step 6: Volver al Task 3 y completar sus Steps 2-4 (ahora diferidos hasta acá)**

`ProyectoWorkspacePage` ya existe, así que el cambio de rutas en `App.tsx` (Task 3, Step 1) ya compila. Ir al Task 3 y ejecutar sus Steps 2 (correr la suite), 3 (verificación manual) y 4 (commit) antes de seguir con el Task 7.

---

### Task 7: Detalle del tablero activo dentro del workspace

**Files:**
- Create: `frontend/src/components/DetalleTablero.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.tsx`
- Test: `frontend/src/components/DetalleTablero.test.tsx`
- Modify: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

`DetalleTablero` recibe el `tablero` activo como prop (ya viene completo desde `listarTableros`, no hace falta un fetch aparte) y porta la lógica que antes vivía en `TableroPage`: edición de nivel de falla/interruptor principal, secciones, salidas y el canvas del esquema visual.

- [ ] **Step 1: Escribir el test que falla para `DetalleTablero`**

```tsx
// frontend/src/components/DetalleTablero.test.tsx
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

  it("shows the tablero's existing secciones", async () => {
    render(
      <DetalleTablero
        tablero={tablero}
        onTableroActualizado={vi.fn()}
        vista={{ zoom: 1, capas: { codigos: true, embarrado: true } }}
        onZoomChange={vi.fn()}
        onCapasChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Sección 1")).toBeInTheDocument();
  });

  it("adds a new sección", async () => {
    render(
      <DetalleTablero
        tablero={tablero}
        onTableroActualizado={vi.fn()}
        vista={{ zoom: 1, capas: { codigos: true, embarrado: true } }}
        onZoomChange={vi.fn()}
        onCapasChange={vi.fn()}
      />,
    );
    await screen.findByText("Sección 1");

    await userEvent.type(screen.getByLabelText(/nueva sección/i), "Sección nueva");
    await userEvent.click(screen.getByRole("button", { name: /agregar sección/i }));

    expect(await screen.findByText("Sección nueva")).toBeInTheDocument();
  });

  it("edits nivel de falla and reports the change upward", async () => {
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
    await screen.findByText("Sección 1");

    await userEvent.click(screen.getByRole("button", { name: /editar nivel de falla/i }));
    const input = screen.getByLabelText(/nuevo nivel de falla/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "16");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/nivel de falla: 16.00 kA/i)).toBeInTheDocument();
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

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd frontend && npm test -- DetalleTablero`
Expected: FAIL — `Cannot find module './DetalleTablero'`

- [ ] **Step 3: Implementar `DetalleTablero`**

```tsx
// frontend/src/components/DetalleTablero.tsx
import { useEffect, useState, type FormEvent } from "react";
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
  const [nombreSeccion, setNombreSeccion] = useState("");
  const [editandoNivelFalla, setEditandoNivelFalla] = useState(false);
  const [nivelFallaKaEdit, setNivelFallaKaEdit] = useState("");
  const [editandoInterruptorPrincipal, setEditandoInterruptorPrincipal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, [tablero.id]);

  async function cargar() {
    const seccionesCargadas = await listarSecciones(tablero.id);
    const conSalidas = await Promise.all(
      seccionesCargadas.map(async (seccion) => ({ seccion, salidas: await listarSalidas(seccion.id) })),
    );
    setSecciones(conSalidas);
  }

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
      <p>
        Nivel de falla: {tablero.nivel_falla_ka} kA{" "}
        {!editandoNivelFalla && (
          <button
            type="button"
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
        <form onSubmit={handleGuardarNivelFalla}>
          <label htmlFor="nivel-falla-edit">Nuevo nivel de falla (kA)</label>
          <input
            id="nivel-falla-edit"
            value={nivelFallaKaEdit}
            onChange={(e) => setNivelFallaKaEdit(e.target.value)}
          />
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => setEditandoNivelFalla(false)}>
            Cancelar
          </button>
        </form>
      )}
      <p>
        Interruptor principal: {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}{" "}
        {!editandoInterruptorPrincipal && (
          <button type="button" onClick={() => setEditandoInterruptorPrincipal(true)}>
            editar interruptor principal
          </button>
        )}
      </p>
      {editandoInterruptorPrincipal && (
        <div>
          <ComponentePicker onSelect={handleSeleccionarInterruptorPrincipal} />
          <button type="button" onClick={() => setEditandoInterruptorPrincipal(false)}>
            Cancelar
          </button>
        </div>
      )}

      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={!!tablero.interruptor_principal_id}
        secciones={secciones}
        zoom={vista.zoom}
        onZoomChange={onZoomChange}
        capas={vista.capas}
        onCapasChange={onCapasChange}
      />

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

- [ ] **Step 4: Correr el test de `DetalleTablero` y verificar que pasa**

Run: `cd frontend && npm test -- DetalleTablero`
Expected: PASS (4 tests)

- [ ] **Step 5: Cablear `DetalleTablero` dentro de `ProyectoWorkspacePage`**

En `frontend/src/pages/ProyectoWorkspacePage.tsx`, agregar el import y el estado de vista, y renderizar `DetalleTablero` para el tablero activo:

```tsx
import { DetalleTablero } from "../components/DetalleTablero";
import type { Capas } from "../components/EsquemaVisual";
```

Agregar debajo de los demás `useState`:

```tsx
  const VISTA_POR_DEFECTO: { zoom: number; capas: Capas } = { zoom: 1, capas: { codigos: true, embarrado: true } };
  const [vistaEstado, setVistaEstado] = useState<Record<string, { zoom: number; capas: Capas }>>({});
```

Agregar antes del `return`:

```tsx
  function obtenerVista(tableroId: string) {
    return vistaEstado[tableroId] ?? VISTA_POR_DEFECTO;
  }

  function handleTableroActualizado(actualizado: Tablero) {
    setTableros((actuales) => actuales.map((t) => (t.id === actualizado.id ? actualizado : t)));
  }

  function handleZoomChange(tableroId: string, zoom: number) {
    setVistaEstado((actual) => ({ ...actual, [tableroId]: { ...obtenerVista(tableroId), zoom } }));
  }

  function handleCapasChange(tableroId: string, capas: Capas) {
    setVistaEstado((actual) => ({ ...actual, [tableroId]: { ...obtenerVista(tableroId), capas } }));
  }
```

Reemplazar el bloque `{tableroActivo === null && (...)}` por:

```tsx
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
```

- [ ] **Step 6: Agregar tests de integración en `ProyectoWorkspacePage.test.tsx`**

Agregar al final de `describe("ProyectoWorkspacePage", ...)`:

```tsx
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

    expect(await screen.findByText("Sección 1")).toBeInTheDocument();
  });
```

- [ ] **Step 7: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add src/components/DetalleTablero.tsx src/components/DetalleTablero.test.tsx src/pages/ProyectoWorkspacePage.tsx src/pages/ProyectoWorkspacePage.test.tsx
git commit -m "feat: wire tablero detail (secciones, salidas, esquema visual) into the workspace tabs"
```

---

### Task 8: Persistencia de zoom/capas al cambiar de pestaña

**Files:**
- Modify: `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

La lógica ya quedó implementada en el Task 7 (`vistaEstado` vive en `ProyectoWorkspacePage`, no en `DetalleTablero`). Este task es la prueba explícita de esa garantía — si falla, revela que el estado quedó mal ubicado.

- [ ] **Step 1: Escribir el test que falla (o pasa, confirmando el diseño)**

Agregar a `frontend/src/pages/ProyectoWorkspacePage.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Correr el test**

Run: `cd frontend && npm test -- ProyectoWorkspacePage`
Expected: PASS — si este test falla, el bug es que `DetalleTablero` está manejando el zoom con estado local en vez de recibirlo por props desde `ProyectoWorkspacePage` (revisar el Task 7, Step 5).

- [ ] **Step 3: Commit**

```bash
git add src/pages/ProyectoWorkspacePage.test.tsx
git commit -m "test: verify zoom/layers state survives switching tablero tabs"
```

---

### Task 9: Eliminar rutas y archivos obsoletos

**Files:**
- Delete: `frontend/src/pages/ProyectoDetallePage.tsx`
- Delete: `frontend/src/pages/ProyectoDetallePage.test.tsx`
- Delete: `frontend/src/pages/TableroPage.tsx`
- Delete: `frontend/src/pages/TableroPage.test.tsx`
- Confirm: `frontend/src/App.tsx` ya no referencia `/tableros/:id` (hecho en el Task 3)

- [ ] **Step 1: Borrar los archivos reemplazados por el workspace**

```bash
cd frontend
rm src/pages/ProyectoDetallePage.tsx src/pages/ProyectoDetallePage.test.tsx
rm src/pages/TableroPage.tsx src/pages/TableroPage.test.tsx
```

- [ ] **Step 2: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan (no debería haber ninguna referencia rota a los archivos borrados).

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npm run build`
Expected: build exitoso.

- [ ] **Step 4: Verificar manualmente en el navegador de preview**

Levantar el dev server, loguearse, ir a un proyecto con al menos un tablero, confirmar: pestañas visibles, esquema visual con zoom/capas funcionando, `/tableros/:id` ya no es una ruta accesible (redirige o 404 según el comportamiento de `BrowserRouter` sin esa ruta).

- [ ] **Step 5: Commit**

```bash
git add -A src/pages/
git commit -m "chore: remove ProyectoDetallePage and TableroPage, superseded by the workspace"
```

---

### Task 10: `ProyectosPage` — grilla de tarjetas + modal de creación

**Files:**
- Modify: `frontend/src/pages/ProyectosPage.tsx`
- Modify: `frontend/src/pages/ProyectosPage.test.tsx`

- [ ] **Step 1: Actualizar el test para reflejar el modal**

Reemplazar el contenido de `frontend/src/pages/ProyectosPage.test.tsx`:

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

  it("lists existing projects as cards", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Proyecto Existente/i)).toBeInTheDocument();
  });

  it("does not show the creation form until the button is clicked", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    expect(screen.queryByLabelText(/^cliente$/i)).not.toBeInTheDocument();
  });

  it("opens the modal, creates a new project, and adds it to the list", async () => {
    render(
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Proyecto Existente/i);

    await userEvent.click(screen.getByRole("button", { name: /nuevo proyecto/i }));
    await userEvent.type(screen.getByLabelText(/^cliente$/i), "Cliente Nuevo");
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Proyecto Nuevo");
    await userEvent.click(screen.getByRole("button", { name: /crear proyecto/i }));

    expect(await screen.findByText(/Proyecto Nuevo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- ProyectosPage`
Expected: FAIL — el botón "Nuevo proyecto" y el comportamiento de modal todavía no existen.

- [ ] **Step 3: Implementar la página**

```tsx
// frontend/src/pages/ProyectosPage.tsx
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { crearProyecto, listarProyectos, type Proyecto } from "../api/client";

export function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
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
      setModalAbierto(false);
    } catch {
      setError("No se pudo crear el proyecto");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proyectos</h1>
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white"
        >
          Nuevo proyecto
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proyectos.map((proyecto) => (
          <Link
            key={proyecto.id}
            to={`/proyectos/${proyecto.id}`}
            className="border border-surface-stroke bg-white p-6 hover:border-abb-red"
          >
            <p className="font-bold">{proyecto.nombre}</p>
            <p className="text-secondary">{proyecto.cliente}</p>
          </Link>
        ))}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleSubmit}
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 className="text-lg font-bold">Nuevo proyecto</h2>
            <label htmlFor="cliente">Cliente</label>
            <input id="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {error && <p role="alert">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Crear proyecto
              </button>
              <button type="button" onClick={() => setModalAbierto(false)} className="px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- ProyectosPage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProyectosPage.tsx src/pages/ProyectosPage.test.tsx
git commit -m "feat: restyle ProyectosPage as a card grid with a creation modal"
```

---

### Task 11: `SeccionBlock` — tabla de salidas con badges

**Files:**
- Modify: `frontend/src/components/SeccionBlock.tsx`
- Modify: `frontend/src/components/SeccionBlock.test.tsx`

- [ ] **Step 1: Actualizar el test para el nuevo marcado (roles de tabla)**

Reemplazar el segundo `it` de `frontend/src/components/SeccionBlock.test.tsx` (el primero no cambia):

```tsx
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

    const fila = screen.getByRole("row", { name: /10 a/i });
    expect(fila).toHaveTextContent(/sin match/i);
    expect(screen.getByLabelText(/buscar código/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd frontend && npm test -- SeccionBlock`
Expected: FAIL — todavía es una lista `<ul>`, no hay `role="row"`.

- [ ] **Step 3: Implementar el componente como tabla**

```tsx
// frontend/src/components/SeccionBlock.tsx
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
    <div className="mt-4 border border-surface-stroke bg-white">
      <h3 className="border-b border-surface-stroke bg-industrial-gray p-4 font-bold uppercase tracking-widest">
        {seccion.nombre}
      </h3>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-surface-stroke text-xs uppercase tracking-widest text-secondary">
            <th className="p-3">Carga</th>
            <th className="p-3">Formato</th>
            <th className="p-3">Estado</th>
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
                  <span className="inline-flex flex-col gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 border border-secondary" /> sin match
                    </span>
                    <ComponentePicker onSelect={(componente) => handleOverride(salida.id, componente)} />
                  </span>
                )}
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
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Agregar salida
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npm test -- SeccionBlock`
Expected: PASS (2 tests)

- [ ] **Step 5: Correr toda la suite de frontend (por las referencias cruzadas desde `DetalleTablero`)**

Run: `cd frontend && npm test`
Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add src/components/SeccionBlock.tsx src/components/SeccionBlock.test.tsx
git commit -m "feat: restyle SeccionBlock as a data table with status badges"
```

---

### Task 12: Restyle del resto de las pantallas (visual únicamente)

**Files:**
- Modify: `frontend/src/pages/CatalogoPage.tsx`
- Modify: `frontend/src/components/ComponentePicker.tsx`
- Modify: `frontend/src/pages/ParametrosCalculoPage.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

Estas cinco pantallas no cambian de estructura ni de comportamiento (mismos ids/labels/roles que ya cubren los tests existentes) — solo se agregan clases de Tailwind con los patrones ya establecidos (tarjeta blanca con borde, botón primario rojo uppercase, inputs con `@tailwindcss/forms`). No se agregan tests nuevos porque no hay comportamiento nuevo que probar; la suite existente actúa como red de seguridad de que no se rompió nada.

- [ ] **Step 1: Restyle `CatalogoPage.tsx`**

Envolver el `<form>` existente en una tarjeta y aplicar clases a los controles, sin tocar `id`/`name`/texto de ningún elemento:

```tsx
// frontend/src/pages/CatalogoPage.tsx
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
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3 border border-surface-stroke bg-white p-8">
      <h1 className="text-xl font-bold">Importar catálogo</h1>
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
      {error && <p role="alert" className="text-error">{error}</p>}
      <button type="submit" className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
        Importar
      </button>
      {resumen && (
        <p data-testid="resumen" className="font-mono text-sm">
          Total: {resumen.total_filas} — Nuevos: {resumen.nuevos} — Actualizados: {resumen.actualizados} — Sin
          cambios: {resumen.sin_cambios}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Restyle `ComponentePicker.tsx`**

```tsx
// frontend/src/components/ComponentePicker.tsx
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
    <div className="relative">
      <input
        aria-label="Buscar código o descripción"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full border border-surface-stroke p-2"
      />
      {resultados !== null && resultados.length === 0 && <p className="text-secondary">sin resultados</p>}
      {resultados !== null && resultados.length > 0 && (
        <ul className="absolute z-10 w-full border border-t-0 border-surface-stroke bg-white">
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
      )}
    </div>
  );
}
```

- [ ] **Step 3: Restyle `ParametrosCalculoPage.tsx`**

Envolver el `<form>` en la misma tarjeta y aplicar las mismas clases de botón/inputs que en `CatalogoPage`, sin tocar ningún `id` ni texto:

```tsx
// frontend/src/pages/ParametrosCalculoPage.tsx
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
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3 border border-surface-stroke bg-white p-8">
      <h1 className="text-xl font-bold">Parámetros de cálculo</h1>
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
      {error && <p role="alert" className="text-error">{error}</p>}
      {guardado && <p>Guardado</p>}
      <button type="submit" className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
        Guardar
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Restyle `LoginPage.tsx`**

```tsx
// frontend/src/pages/LoginPage.tsx
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
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <form
        onSubmit={handleSubmit}
        className="flex w-96 flex-col gap-3 border border-surface-stroke bg-white p-8"
      >
        <h1 className="text-xl font-bold text-abb-red">Configurador de Tableros PYRE</h1>
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
        {error && <p role="alert" className="text-error">{error}</p>}
        <button type="submit" className="mt-2 bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Ingresar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Restyle `DashboardPage.tsx`**

```tsx
// frontend/src/pages/DashboardPage.tsx
import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Panel</h1>
      <div className="mt-6 flex flex-col gap-2">
        <Link to="/proyectos" className="border border-surface-stroke bg-white p-4 hover:border-abb-red">
          Proyectos
        </Link>
        <Link to="/catalogo" className="border border-surface-stroke bg-white p-4 hover:border-abb-red">
          Importar catálogo
        </Link>
        <Link to="/parametros-calculo" className="border border-surface-stroke bg-white p-4 hover:border-abb-red">
          Parámetros de cálculo
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan sin cambios (ningún `id`, `label` ni texto se modificó).

- [ ] **Step 7: Commit**

```bash
git add src/pages/CatalogoPage.tsx src/components/ComponentePicker.tsx src/pages/ParametrosCalculoPage.tsx src/pages/LoginPage.tsx src/pages/DashboardPage.tsx
git commit -m "style: apply shared Tailwind patterns to catalogo, picker, parametros, login and dashboard"
```

---

### Task 13: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests pasan.

- [ ] **Step 2: Verificar que compila para producción**

Run: `cd frontend && npm run build`
Expected: build exitoso, sin errores de TypeScript nuevos.

- [ ] **Step 3: Correr toda la suite de backend (por las dudas — no se tocó backend en este plan)**

Run: `cd backend && venv/Scripts/python -m pytest -q`
Expected: mismos tests pasando que antes de este plan.

- [ ] **Step 4: Verificación manual en el navegador de preview**

Levantar `frontend` vía `preview_start`, loguearse, y recorrer:
1. Sidebar visible, "Cotizador" deshabilitado con badge "Próximo módulo".
2. Proyectos: tarjetas + modal de creación funcionando.
3. Abrir un proyecto con 2+ tableros: pestañas visibles, cambiar de pestaña cambia el contenido.
4. Esquema visual: zoom in/out cambia el tamaño visual del contenido, panel de capas oculta/muestra códigos y la franja de embarrado.
5. Cambiar de pestaña y volver: el zoom aplicado se mantiene.
6. Agregar una sección y una salida: aparecen en la tabla con el badge correspondiente.
7. Catálogo, Parámetros de cálculo, Login: visualmente consistentes con la nueva dirección (blanco/gris, acento rojo, tipografía Hanken Grotesk + JetBrains Mono).

- [ ] **Step 5: Actualizar `CLAUDE.md`**

Editar la línea de Fase C en `CLAUDE.md` (sección Estado) agregando un quinto ciclo:

```
... y 5 (rediseño de UI con Tailwind + modelador gráfico del esquema visual: zoom, capas, pestañas por tablero con estado independiente — spec en `docs/superpowers/specs/2026-07-17-rediseno-ui-esquema-visual-design.md`) mergeados a `master`.
```

- [ ] **Step 6: Commit final de docs**

```bash
git add CLAUDE.md
git commit -m "docs: mark UI redesign + esquema visual modeler cycle as done"
```
