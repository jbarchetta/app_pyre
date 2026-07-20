# Fase C — Ciclo 9: Calidad y deuda técnica (performance, seguridad menor, infra)

**Fecha:** 2026-07-19
**Estado:** aprobada para implementar
**Origen:** `docs/backlog_mejoras.md` (tracker de la auditoría 2026-07-19) — todos los ítems 🟦 de "Seguridad" (menores), "Estabilidad/performance" y "Deuda técnica" asignados a este ciclo. Sigue al ciclo 8 (hardening, mergeado) y precede al ciclo 10 (UX) y 11 (BOM).

## Contexto

El ciclo 8 cerró los 5 agujeros críticos. Queda la capa de calidad estructural: queries N+1, listados sin freno, CORS/headers permisivos, eventos de seguridad sin registrar, un TODO de stale closures en el frontend, y la infra básica para que las dos suites corran solas (CI) y el frontend pueda servirse optimizado (Dockerfile multi-stage). El usuario pidió explícitamente para este ciclo: **tests profundos de calidad y documentación exhaustiva**.

## Alcance y decisiones de diseño

### 9a. Eliminar N+1 en listados de salidas y tableros

**Problema:** `_salida_response(db, salida)` hace `db.get(CatalogoComponente, salida.componente_id)` por fila; `listar_salidas` con N salidas = N+1 queries. Ídem `_tablero_response` con `interruptor_principal_id`.

**Decisión:** **batch fetch con dict, NO agregar `relationship()` a los modelos.** Los modelos hoy solo tienen columnas FK (sin relaciones ORM); introducir `relationship()` + `selectinload` es una decisión de mayor alcance (afecta imports circulares potenciales, serialización accidental, API de los modelos) y no es necesaria para este fix. Implementación: helper `_componentes_por_id(db, ids)` que hace un solo `SELECT ... WHERE id IN (:ids)` y devuelve `dict[UUID, CatalogoComponente]`; los endpoints de listado lo usan una vez y pasan el componente ya resuelto al response builder. Los endpoints individuales (GET por id) no cambian (1 query extra es irrelevante ahí).

**Response builders manuales se quedan** (evaluación pedida por el backlog): el contrato explícito campo-a-campo entre modelo y schema Pydantic es una ventaja (cambios de contrato visibles en diff). El costo (tocar 5 archivos por campo nuevo) se acepta a esta escala. Re-evaluar solo si el BOM duplica campos en las respuestas.

**Test profundo:** conteo de statements SQL (listener `before_cursor_execute`) en `listar_salidas` con 5 salidas → el número de queries es **constante e independiente de N** (antes: crecía con N). Ídem `listar_tableros`.

### 9b. Paginación defensiva en listados

**Problema:** `GET /proyectos` (y tableros/secciones/salidas) devuelven todo sin límite ni orden garantizado.

**Decisión:** paginación **defensiva y backward-compatible**, no rediseño de UX:
- Todos los listados aceptan `limit`/`offset` opcionales con **default generoso (200) y tope duro (500)**; respuestas siguen siendo arrays (el frontend no cambia — ciclo 10 decide si hay UI de paginación).
- **Orden estable obligatorio** (paginar sin `ORDER BY` es inválido en Postgres): proyectos por `creado_en desc, id`; tableros por `creado_en, id`; secciones ya ordenan por `orden` (+ tiebreaker `id`); salidas por `posicion_orden` (+ `id`).
- Clamps: `limit` fuera de rango → acotado; `offset < 0` → 0. Sin 400s por paginación inválida (defensiva, no punitiva).

**Tests profundos:** clamps (limit=9999 → 500, limit=0 → 1, offset=-5 → 0), estabilidad de orden entre páginas (mismo tiebreak → sin duplicados ni saltos), compatibilidad (sin params → comportamiento actual para ≤200 filas).

### 9c. CORS explícito + headers de seguridad

**CORS:** `allow_methods=["GET","POST","PATCH","PUT","DELETE","OPTIONS"]`, `allow_headers=["Content-Type","Authorization"]` (de `["*"]`). Origen único ya estaba bien.

**Headers de seguridad** (middleware propio, todas las respuestas):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy: default-src 'none'` (API JSON pura — no sirve HTML; el frontend los define nginx/index.html, no este backend)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` **solo si `environment == "production"`** (HSTS sobre HTTP en dev rompería localhost).

**Tests:** presencia y valor exacto en `/health` y en una respuesta 401 (los headers deben estar también en errores — el middleware corre siempre); preflight CORS `OPTIONS` refleja los métodos/headers explícitos; HSTS ausente en `test`.

### 9d. Logging de eventos de seguridad + política mínima de contraseña

**Eventos a `audit_log`** (mismo mecanismo existente — coherencia con la convención del proyecto):
- `login_exitoso` / `login_fallido` — `entidad="usuario"`, `entidad_id=email intentado`, **sin password ni hash en `detalle`** (solo email + motivo genérico "credenciales inválidas" — no distinguir "usuario no existe" de "password incorrecta" para no filtrar existencia de cuentas).
- `acceso_denegado_propiedad` — en los helpers de `ownership.py` cuando un analista toca recurso ajeno: `entidad="proyecto"`, `entidad_id=id del proyecto`, `detalle={"recurso": "tablero|seccion|salida|proyecto", "usuario_id": str}`. Se hace `db.commit()` del log ANTES de levantar el 403 (el raise hace rollback de la request, no del evento).

**Política mínima de contraseña** en `create_user`: largo mínimo 8 caracteres → `ValueError` descriptivo si no cumple. No hay endpoint de cambio de password todavía, así que el único punto de entrada es el script — política ahí es suficiente por ahora. Complejidad (mayúsculas/números/símbolos) explícitamente fuera: sistema interno, usuarios creados por supervisión.

**Tests profundos:** login fallido escribe exactamente 1 fila y NO contiene la password; login exitoso escribe `login_exitoso`; 403 de propiedad escribe `acceso_denegado_propiedad` con el proyecto correcto y la request sigue devolviendo 403; password corta rechazada en `create_user`.

### 9e. Fix stale closures en `ProyectoWorkspacePage` (frontend)

**Problema (TODO `bcd6068`):** `handleSubmit`/`handleRenombrarTablero` guardan contra respuestas stale comparando estado leído por closure (`if (!modalNuevoTablero) return`), que queda congelado en el render — guards inertes. Ya resuelto en `SeccionBlock`/`DetalleTablero` con refs.

**Decisión:** replicar el patrón de refs (`modalNuevoTableroRef`, `tableroEnEdicionIdRef`) sincronizadas con `useEffect`, eliminar el TODO. Comportamiento: cancelar el modal mientras el POST/PATCH está en vuelo → la respuesta se descarta silenciosamente (no se crea el tablero en estado local, no se muestra error fantasma).

**Test profundo (Vitest):** promesa diferida manualmente — abrir modal, submit, resolver la promesa DESPUÉS de cancelar → el tablero no aparece en la lista y no hay error. Ídem renombrar. (El patrón de test ya existe para `SeccionBlock`; replicar.)

### 9f. CI mínimo (GitHub Actions)

`.github/workflows/ci.yml` — en push y PR a `master`:
- **backend**: servicio `postgres:16-alpine` (mismas credenciales dev + healthcheck), step que crea `tablero_test` con `psql`, `pip install -r requirements.txt`, `pytest -q`.
- **frontend**: `npm ci`, `npm test` (vitest run) y `npm run build` (vitest no typechecka todo — el build con `tsc -b` atrapa errores de tipos que los tests no ven).

### 9g. Frontend Dockerfile multi-stage

Hoy: `npm run dev` (Vite dev server) en el servicio `frontend` de compose. Nuevo:
- **Stage build**: `node:20-slim`, `npm ci`, `npm run build` (con `ARG VITE_API_BASE_URL`).
- **Stage serve**: `nginx:alpine` sirviendo `dist/` con `nginx.conf` propio: SPA fallback (`try_files $uri /index.html`) + headers básicos de caché para assets fingerprinted.
- `docker-compose.yml`: puerto `5180:80` y `VITE_API_BASE_URL` como build arg.
- El flujo dev diario no cambia: `npm run dev` local (documentado en `docs/README.md`); compose pasa a ser "stack de integración production-like" — actualizar `docs/README.md`.
- **Verificación:** `docker compose build frontend` + levantar + `curl localhost:5180` devuelve el index (y una ruta cliente como `/login` también, por el fallback).

### 9h. Tests de calidad profunda (escala real)

- **Motor a escala:** seed de 5.000 componentes vía `bulk_insert` (mezcla de tipos/polos/corrientes, algunos elegibles) → `proponer_componente` devuelve el correcto **y ejecuta exactamente 1 query** (listener de statements). Sin assertion de tiempo absoluto (flaky en CI) — la regresión O(n) queda trabada por conteo de queries y por el hecho de que el `WHERE` corre en SQL.
- **Búsqueda a escala:** mismo seed + `GET /catalogo/buscar?q=...` → resultado correcto paginado, `total` consistente, y la query usa el índice (verificación indirecta: tiempo generoso <2s en CI, marcado como `slow` si se necesita).

## Fuera de alcance (con justificación)

- **Rate limiting en login:** sistema interno de red de confianza; usuarios creados solo por supervisión; los logins fallidos ya quedan auditados en 9d (señal para detectar abuso). Re-evaluar en Fase E si hay exposición externa.
- **Refresh/revocación de JWT:** misma justificación.
- **Paginación con UI** ("Cargar más" en Proyectos): ciclo 10 (UX). Acá solo el contrato defensivo.
- **React Query/Zustand y split de `client.ts`:** evaluación antes del cotizador/BOM UI (backlog ⬜).
- **Capa de servicios routers↔motor:** evaluar al diseñar ciclo 11 (BOM), que es donde la lógica crece.

## Estrategia de testing global

TDD por tarea (rojo → verde → commit), como siempre. Además de los tests de cada ítem: suite backend completa y suite frontend completa verdes antes del merge. Estimado de tests nuevos: ~25 backend (bordes de paginación, headers, CORS, logging, conteo de queries, escala) + ~2 frontend (cancel-in-flight).

## Criterios de corte

- 9a-9h implementados con TDD; suites verdes (pytest + vitest + `npm run build`).
- CI corriendo en GitHub Actions sobre la propia rama (verde antes de mergear).
- `docs/backlog_mejoras.md` con los ítems marcados ✅; `CLAUDE.md` actualizado; plan con notas de bitácora reales; `docs/README.md` actualizado por el cambio del servicio frontend.
