# Implementation Plan — Ciclo 11: Generación de BOM, congelamiento de precios y cotización por tablero

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the BOM (Bill of Materials) generation engine, price freezing in `bom_linea`, cascaded deletion safeguards for tableros/proyectos, REST API endpoints (`GET` and `POST /tableros/{id}/bom/generar`), and the Cotizador/BOM UI tab in `DetalleTablero`.

**Architecture:**
- **Backend:**
  - Generator service `backend/app/bom/generador.py` to aggregate components (principal breaker + confirmed salida components), compute unit prices and subtotals, and atomically refresh `bom_linea`.
  - Schema Pydantic `backend/app/schemas/bom.py` (`BomLineaResponse`, `BomResponse`).
  - Router `backend/app/routers/bom.py` exposing `GET /tableros/{id}/bom` and `POST /tableros/{id}/bom/generar`, with ownership verification.
  - Cascaded delete additions in `backend/app/routers/tableros.py` and `backend/app/routers/proyectos.py`.
- **Frontend:**
  - Types and API client functions in `frontend/src/api/client.ts` (`obtenerBomTablero`, `generarBomTablero`).
  - UI Tab "BOM / Cotización" in `frontend/src/components/DetalleTablero.tsx` with formatted table, totals, timestamp, and a "Recalcular / Congelar BOM" action button.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL, React 19, TypeScript, Vitest, Pytest.

Spec: [2026-07-20-ciclo-11-bom-design.md](file:///d:/.proyectos/PYRE/calculador_tab/docs/superpowers/specs/2026-07-20-ciclo-11-bom-design.md)

---

## User Review Required

> [!IMPORTANT]
> **Cascada de borrado en `bom_linea`:** Al eliminar un tablero o proyecto, se eliminarán preventivamente sus filas en `bom_linea` antes de borrar la entidad padre. Esto garantiza la integridad referencial y evita errores 500 (`IntegrityError`).
>
> **Alcance de Materiales en este Ciclo:** Consolidador basado exclusivamente en componentes asignados (interruptor principal + salidas). Los materiales derivados de calibre (cables, terminales, barras) se integrarán en la Fase D según la especificación de costeo `MAT`.

---

## Proposed Changes

### Backend

#### [NEW] [generador.py](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/bom/generador.py)
- Servicio que consulta el interruptor principal y las salidas del tablero.
- Agrupa por `componente_id`, calcula cantidades, congela `precio_unitario_congelado` (`precio_neto` actual).
- Transaccionalmente limpia e inserta registros en `bom_linea`.

#### [NEW] [bom.py (schemas)](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/schemas/bom.py)
- Pydantic models: `BomLineaResponse`, `BomResponse`.

#### [NEW] [bom.py (router)](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/routers/bom.py)
- `GET /tableros/{tablero_id}/bom`
- `POST /tableros/{tablero_id}/bom/generar`

#### [MODIFY] [main.py](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/main.py)
- Incluir el router `app.include_router(bom.router)`.

#### [MODIFY] [tableros.py](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/routers/tableros.py)
- Agregar eliminación preventiva en `bom_linea` antes de borrar un tablero.

#### [MODIFY] [proyectos.py](file:///d:/.proyectos/PYRE/calculador_tab/backend/app/routers/proyectos.py)
- Agregar eliminación preventiva en `bom_linea` antes de borrar un proyecto.

#### [NEW] [test_bom.py](file:///d:/.proyectos/PYRE/calculador_tab/backend/tests/test_bom.py)
- Unit and integration tests for BOM generation, refresh, cascaded deletes, and ownership access.

---

### Frontend

#### [MODIFY] [client.ts](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/api/client.ts)
- Interfaces `BomLineaResponse`, `BomResponse`.
- Functions `obtenerBomTablero`, `generarBomTablero`.

#### [MODIFY] [DetalleTablero.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/components/DetalleTablero.tsx)
- Añadir pestaña "BOM / Cotización" en la barra de navegación de pestañas del tablero.
- Renderizar tabla de BOM con desglose de ítems, precio unitario congelado, subtotal y total de materiales.
- Botón para refrescar/congelar BOM.

#### [MODIFY] [DetalleTablero.test.tsx](file:///d:/.proyectos/PYRE/calculador_tab/frontend/src/components/DetalleTablero.test.tsx)
- Pruebas unitarias para verificar el renderizado de la pestaña BOM y la llamada a la API de generación.

---

## Plan de Tareas

### Task 1: Crear la rama de trabajo
- [ ] Crear rama `feat/ciclo-11-bom` a partir de `master`.
- [ ] Verificar que ambas suites (pytest y vitest) estén en verde.

### Task 2: Backend — Schemas Pydantic y Servicio Generador de BOM
- [ ] Crear `backend/app/schemas/bom.py` con `BomLineaResponse` y `BomResponse`.
- [ ] Crear `backend/app/bom/generador.py` con función `generar_bom_tablero(db, tablero_id)`.
- [ ] Escribir tests unitarios en `backend/tests/test_bom.py` para la lógica del generador.

### Task 3: Backend — Router REST `/tableros/{id}/bom` y Registro en `main.py`
- [ ] Crear `backend/app/routers/bom.py` con endpoints `GET` y `POST /tableros/{id}/bom/generar`.
- [ ] Aplicar guard de propiedad (`verificar_propiedad_tablero`).
- [ ] Registrar router en `backend/app/main.py`.
- [ ] Escribir tests de integración de endpoints en `backend/tests/test_bom.py`.

### Task 4: Backend — Cascada de borrado explícita de `bom_linea`
- [ ] Actualizar `eliminar_tablero` en `tableros.py` para borrar `bom_linea`.
- [ ] Actualizar `eliminar_proyecto` en `proyectos.py` para borrar `bom_linea`.
- [ ] Escribir test en `backend/tests/test_bom.py` verificando borrado sin `IntegrityError`.

### Task 5: Frontend — Cliente API (`client.ts`)
- [ ] Añadir tipos `BomLineaResponse` y `BomResponse` en `frontend/src/api/client.ts`.
- [ ] Añadir `obtenerBomTablero` y `generarBomTablero`.

### Task 6: Frontend — Pestaña "BOM / Cotización" en `DetalleTablero.tsx`
- [ ] Añadir pestaña "BOM / Cotización" en la lista de pestañas de `DetalleTablero.tsx`.
- [ ] Implementar vista de tabla con ítems congelados, subtotales y total general.
- [ ] Añadir botón "Recalcular / Congelar BOM".
- [ ] Escribir tests en `DetalleTablero.test.tsx`.

### Task 7: Verificación final y actualización de documentos
- [ ] Ejecutar pytest backend (`100% passed`).
- [ ] Ejecutar vitest frontend (`100% passed`).
- [ ] Ejecutar `npm run build` en frontend.
- [ ] Actualizar `docs/backlog_mejoras.md` y `CLAUDE.md`.
- [ ] Commit y merge de `feat/ciclo-11-bom` a `master`.

---

## Verification Plan

### Automated Tests
- `cd backend && venv/Scripts/python.exe -m pytest -q`
- `cd frontend && npx vitest run`
- `cd frontend && npm run build`

### Manual Verification
1. Abrir un tablero con interruptor principal y varias salidas confirmadas.
2. Hacer click en la pestaña "BOM / Cotización".
3. Clickear "Recalcular / Congelar BOM" y verificar que se genera la lista consolidada de ítems con sus cantidades, precios congelados y subtotal.
4. Borrar una salida o cambiar un componente y volver al BOM; verificar que el precio congelado previo se mantiene hasta que se presione nuevamente "Recalcular / Congelar BOM".
5. Borrar un tablero que posea un BOM congelado y verificar que la operación concluye exitosamente sin errores de base de datos.
