# Implementation Plan — Ciclo 10b: Auditoría UX y Mejoras Integrales del Analista

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 11 user-identified UX and workflow improvements across backend models, REST endpoints, motor diagnostics, Dashboard, Proyectos workspace, SeccionBlock table, interactive Blueprint, and ComponentePicker.

**Architecture:**
- **Backend:**
  - Add `codigo_obra` and `fecha_inicio` to `Proyecto` model and schemas (`backend/app/models/proyecto.py`, `backend/app/schemas/proyecto.py`).
  - Add `etiqueta` (circuit tag) to `Salida` model and schemas (`backend/app/models/tablero.py`, `backend/app/schemas/tablero.py`).
  - Add explicit diagnostic messages (`motivo_sin_match`) in motor proposal (`backend/app/motor/propuesta.py`).
  - Add reorder endpoint `POST /secciones/{id}/salidas/reordenar` and duplicate endpoint `POST /salidas/{id}/duplicar`.
- **Frontend:**
  - Landing Dashboard page (`DashboardPage.tsx`) with project statistics and recent items.
  - Enhanced `ProyectosPage.tsx` with Cards/Table view toggle, search bar, status filter, month grouping, author, and `codigo_obra`.
  - Prominent "Crear mi primer tablero" Hero State in empty workspace.
  - Highly visible `← Volver a Proyectos` button and breadcrumb.
  - Redesigned `SeccionBlock` table: `Etiqueta` column, state icon moved next to SAP/Commercial code with diagnostic tooltip, "Duplicar" action button, and Drag & Drop reordering.
  - Interactive `EsquemaVisual`: bidirectional hover highlight, click-to-scroll/edit, and circuit tag display.
  - Enhanced `ComponentePicker`: improved category mapping for differential breakers.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL, React 19, TypeScript, Vitest, Pytest.

Spec: [2026-07-20-ciclo-10b-ux-feedback-design.md](file:///d:/.proyectos/PYRE/calculador_tab/docs/superpowers/specs/2026-07-20-ciclo-10b-ux-feedback-design.md)

---

## User Review Required

> [!IMPORTANT]
> **Cambios en esquema de base de datos:** Se añadirán las columnas `codigo_obra` y `fecha_inicio` en `proyecto`, y `etiqueta` en `salida`. Las migraciones de Alembic se ejecutarán de forma compatible hacia adelante.
>
> **Reordenamiento por Drag & Drop:** Se usará el API nativo de Drag & Drop de HTML5/React con persistencia de `posicion_orden` para máxima compatibilidad y cero dependencias pesadas de terceros.

---

## Proposed Changes

### Backend

#### [MODIFY] [proyecto.py (model)](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/models/proyecto.py)
- Añadir `codigo_obra: Mapped[str | None]` y `fecha_inicio: Mapped[datetime | None]`.

#### [MODIFY] [proyecto.py (schema)](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/schemas/proyecto.py)
- Añadir `codigo_obra`, `fecha_inicio`, `analista_nombre` a Pydantic schemas.

#### [MODIFY] [tablero.py (model)](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/models/tablero.py)
- Añadir `etiqueta: Mapped[str | None]` en `Salida`.

#### [MODIFY] [tablero.py (schema)](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/schemas/tablero.py)
- Añadir `etiqueta` y `motivo_sin_match` en `SalidaResponse`.

#### [MODIFY] [propuesta.py](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/motor/propuesta.py)
- Generar explicaciones de diagnósticos para `componente_id = NULL`.

#### [MODIFY] [salidas.py (router)](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/routers/salidas.py)
- Endpoints `POST /salidas/{id}/duplicar` y `POST /secciones/{id}/salidas/reordenar`.

---

### Frontend

#### [NEW] [DashboardPage.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/pages/DashboardPage.tsx)
- Página de bienvenida post-login con métricas, proyectos recientes y accesos directos.

#### [MODIFY] [ProyectosPage.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/pages/ProyectosPage.tsx)
- Selector Vista Tarjetas / Vista Tabla.
- Input de búsqueda global + filtro de estado.
- Agrupación por mes de creación.
- Campos `codigo_obra`, `fecha_inicio` y autor.

#### [MODIFY] [ProyectoWorkspacePage.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/pages/ProyectoWorkspacePage.tsx)
- Botón de volver `← Volver a Proyectos` destacado.
- Hero State / Empty state "Creá tu primer tablero".

#### [MODIFY] [SeccionBlock.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/components/SeccionBlock.tsx)
- Nueva columna `Etiqueta`.
- Ícono de estado agrupado con Código SAP/Comercial + Tooltip de diagnóstico.
- Botón de acción `Duplicar`.
- Reordenamiento por arrastrar y soltar (Drag & Drop).

#### [MODIFY] [EsquemaVisual.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/components/EsquemaVisual.tsx)
- Muestra `etiqueta` y datos de circuito dentro de los bloques.
- Resaltado interactivo bidireccional al hacer hover entre el blueprint y la tabla de salidas.

#### [MODIFY] [ComponentePicker.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/components/ComponentePicker.tsx)
- Soporte extendido para búsqueda de disyuntores diferenciales.

---

## Plan de Tareas

### Task 1: Rama de trabajo y actualización de modelos backend
- [ ] Crear rama `feat/ciclo-10b-ux-feedback`.
- [ ] Modificar `backend/app/models/proyecto.py` (`codigo_obra`, `fecha_inicio`).
- [ ] Modificar `backend/app/models/tablero.py` (`etiqueta`).
- [ ] Crear migración de Alembic y ejecutarla.
- [ ] Actualizar schemas Pydantic en `proyecto.py` y `tablero.py`.

### Task 2: Backend — Diagnósticos de "Sin Match" y endpoints de Duplicar / Reordenar
- [ ] Actualizar `propuesta.py` para devolver `motivo_sin_match`.
- [ ] Implementar `POST /salidas/{id}/duplicar` en `salidas.py`.
- [ ] Implementar `POST /secciones/{id}/salidas/reordenar` en `salidas.py`.
- [ ] Escribir tests pytest en `tests/test_salidas_endpoint.py`.

### Task 3: Frontend — Cliente API y Dashboard Landing Page
- [ ] Actualizar `frontend/src/api/client.ts` con nuevos campos y endpoints (`duplicarSalida`, `reordenarSalidas`).
- [ ] Crear `frontend/src/pages/DashboardPage.tsx` con métricas, accesos directos y proyectos recientes.
- [ ] Conectar `/dashboard` en el router de React.

### Task 4: Frontend — Rediseño de Vista de Proyectos (Tarjetas/Tabla, Filtros, Agrupación, Metadata)
- [ ] Añadir toggle de vista Tarjetas vs Tabla en `ProyectosPage.tsx`.
- [ ] Añadir input de búsqueda en vivo y filtro por estado.
- [ ] Añadir sección agrupada por mes.
- [ ] Añadir campos `codigo_obra`, `fecha_inicio` y `autor` en tarjetas y modales de proyecto.

### Task 5: Frontend — Hero State y Navegación de Retorno Visible
- [ ] Destacar botón `← Volver a Proyectos` en `ProyectoWorkspacePage.tsx` y navbar.
- [ ] Rediseñar la pantalla de proyecto vacía con un Hero State prominente `[ + Crear mi primer tablero ]`.

### Task 6: Frontend — Rediseño de Tabla de Salidas (Etiqueta, Ícono de Estado, Duplicar, Drag & Drop)
- [ ] Añadir columna `Etiqueta` en `SeccionBlock.tsx`.
- [ ] Trasladar el ícono de estado al lado del Código SAP/Comercial con Tooltip explicativo del `motivo_sin_match`.
- [ ] Añadir botón "Duplicar salida".
- [ ] Implementar Drag & Drop para reordenar salidas dentro de una sección.

### Task 7: Frontend — Blueprint Interactivo Bidireccional y Búsqueda de Diferenciales
- [ ] Muestra de etiquetas y datos en `EsquemaVisual.tsx`.
- [ ] Implementar resaltado interactivo bidireccional (hover en blueprint ↔ hover en tabla de salidas).
- [ ] Ajustar categorías y filtros de disyuntores diferenciales en `ComponentePicker.tsx`.

### Task 8: Verificación Final y Documentación
- [ ] Ejecutar pytest backend (`100% passed`).
- [ ] Ejecutar vitest frontend (`100% passed`).
- [ ] Ejecutar `npm run build` en frontend.
- [ ] Actualizar `docs/backlog_mejoras.md` y `CLAUDE.md`.
- [ ] Commit y merge de `feat/ciclo-10b-ux-feedback` a `master`.

---

## Verification Plan

### Automated Tests
- `cd backend && venv/Scripts/python.exe -m pytest -q`
- `cd frontend && npx vitest run`
- `cd frontend && npm run build`

### Manual Verification
1. Ingresar tras login y verificar la nueva **Landing Dashboard** con métricas y proyectos recientes.
2. Ir a Proyectos, alternar entre vista Tarjetas y vista Tabla, probar el buscador, filtro por estado y la agrupación por mes.
3. Crear un proyecto nuevo y verificar el **Hero State** destacado para crear el primer tablero.
4. Abrir un tablero y verificar la visibilidad del botón de retorno a Proyectos.
5. En la tabla de salidas: probar el nuevo campo `Etiqueta` (ej. "PG01"), el botón "Duplicar" y arrastrar filas para reordenar.
6. En salidas sin match, colocar el mouse sobre el ícono de estado y verificar el mensaje explícito del diagnóstico.
7. Pasar el mouse sobre los bloques del Blueprint y verificar que se resalta la fila de la tabla correspondiente (y viceversa).
