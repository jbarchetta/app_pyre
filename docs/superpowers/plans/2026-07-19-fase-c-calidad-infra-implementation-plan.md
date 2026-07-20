# Fase C — Ciclo 9: Plan de implementación (calidad y deuda técnica)

**Spec:** `docs/superpowers/specs/2026-07-19-fase-c-calidad-infra-design.md`
**Rama:** `feat/fase-c-calidad-infra`
**Convención:** TDD por tarea — test que falla → implementación mínima → verde → commit. Notas `> **Note:**` de bitácora al cerrar.

Baseline: pytest 164 verde, vitest 105 verde (14 archivos), db en `localhost:5432`.

---

## Task 1 — Rama

```powershell
git checkout -b feat/fase-c-calidad-infra
```

## Task 2 — 9a: batch fetch para N+1

**Archivos:** `backend/app/routers/salidas.py`, `backend/app/routers/tableros.py`

1. **Test primero** — `test_salidas_endpoint.py`: crear 5 salidas con componente, contar statements con listener SQLAlchemy (`event.listens_for(engine, "before_cursor_execute")` + contador) durante `GET /secciones/{id}/salidas` → asertar `count <= 4` (auth implícita por cookie, no query) y, más importante, que el count es **constante** al subir de 2 a 5 salidas (hoy crece). Ídem en `test_tableros_endpoint.py` para `GET /proyectos/{id}/tableros` con varios tableros con interruptor principal.
2. Implementar `_componentes_por_id(db, ids) -> dict[UUID, CatalogoComponente]` (un solo `IN`), usarlo en `listar_salidas` y `listar_tableros`; `_salida_response`/`_tablero_response` reciben el componente resuelto (firma: parámetro opcional `componente` — los GET individuales siguen pasando `None` y resolviendo con `db.get`).
3. Verde + commit: `perf: batch-fetch catalog components in salidas/tableros listings`

## Task 3 — 9b: paginación defensiva

**Archivos:** `backend/app/routers/proyectos.py`, `tableros.py`, `salidas.py`

1. **Test primero** (nuevos casos en los archivos de endpoint existentes):
   - `limit=9999` → devuelve todo lo que hay (cap 500 no explota), `limit=0` → se trata como 1, `offset=-5` → como 0.
   - Crear 3 proyectos, pedir `limit=2&offset=0` y `limit=2&offset=2` → sin duplicados entre páginas, orden `creado_en desc`.
   - Sin params → lista completa (compatibilidad, ≤200 filas).
2. Implementar helper compartido `_paginacion(limit, offset) -> tuple[int, int]` (clamp 1..500 / >=0) — dónde: pequeño módulo `app/routers/_paginacion.py` o en cada router (decidir: compartido, 3 usos).
3. `order_by` estable en los 4 listados (ver spec).
4. Verde + commit: `feat: defensive pagination with stable ordering on list endpoints`

## Task 4 — 9c: CORS explícito + headers de seguridad

**Archivos:** `backend/app/main.py`, nuevo `backend/app/middleware_headers.py` (o inline en main — decidir por tamaño), `backend/tests/test_cors.py`, nuevo `backend/tests/test_security_headers.py`

1. **Test primero**: headers exactos en `GET /health` (200) y en `GET /proyectos` sin auth (401) — el middleware debe aplicar también a errores. Preflight `OPTIONS /auth/login` con `Origin` + `Access-Control-Request-Method: POST` → `access-control-allow-methods` contiene POST y NO es `*`. HSTS ausente en `test`.
2. Implementar middleware `@app.middleware("http")` que agrega los 4 headers fijos + HSTS condicional. CORS: reemplazar `["*"]` por listas explícitas.
3. Verde + commit: `feat: explicit CORS methods/headers and security headers middleware`

> Nota: `test_cors.py` existe — revisar qué aserta hoy antes de tocar (puede asertar `*`).

## Task 5 — 9d: logging de seguridad + password mínimo

**Archivos:** `backend/app/routers/auth.py`, `backend/app/auth/ownership.py`, `backend/app/scripts/create_user.py`

1. **Test primero**:
   - `test_auth.py`: login con password incorrecta → 401 + exactamente 1 fila `audit_log` con `accion="login_fallido"`, `entidad_id=email`, y el `detalle` **no** contiene la password. Login OK → `login_exitoso`.
   - `test_autorizacion_propiedad.py`: el 403 de propiedad escribe `acceso_denegado_propiedad` con `entidad="proyecto"` y el id correcto (y la response sigue 403).
   - `test_create_user.py`: password de 7 chars → `ValueError`; 8+ → OK.
2. Implementar: escritura de `AuditLog` en `login` (ambos caminos, commit antes de return/raise), en `verificar_acceso_proyecto` (commit antes del raise — los helpers reciben `db` ya), y validación de largo en `create_user`.
3. Verde + commit: `feat: audit security events (login outcomes, ownership denials) and min password length`

## Task 6 — 9e: stale closures en ProyectoWorkspacePage

**Archivos:** `frontend/src/pages/ProyectoWorkspacePage.tsx`, `frontend/src/pages/ProyectoWorkspacePage.test.tsx`

1. **Test primero**: promesa diferida — abrir "Nuevo tablero", completar, submit, **cancelar el modal antes de resolver**, resolver → el tablero NO aparece en las pestañas y no hay `role="alert"`. Ídem renombrar (el nombre no cambia). Rojo con el código actual (guards inertes).
2. Implementar refs (`modalNuevoTableroRef`, `tableroEnEdicionIdRef`) sincronizadas por `useEffect`, reemplazar los guards de closure, eliminar el comentario TODO (`bcd6068`).
3. Verde + commit: `fix: replace inert stale-response guards with live refs in ProyectoWorkspacePage`

## Task 7 — 9f: CI GitHub Actions

**Archivo:** `.github/workflows/ci.yml` (nuevo)

- Job `backend`: `postgres:16-alpine` service (user/db/password dev, `--health-cmd pg_isready`), step `psql ... CREATE DATABASE tablero_test`, `pip install -r backend/requirements.txt`, `pytest -q` (env `TABLERO_DATABASE_URL=...@localhost:5432/tablero_test`, `TABLERO_ENVIRONMENT=test`, `TABLERO_JWT_SECRET=ci-secret`).
- Job `frontend`: `npm ci`, `npm test`, `npm run build` (working-directory `frontend`).
- `on: push (branches: master) + pull_request`.
- Sin push a remoto configurado todavía → el archivo queda listo; validar sintaxis con un parser YAML local.

## Task 8 — 9g: Dockerfile multi-stage

**Archivos:** `frontend/Dockerfile`, `frontend/nginx.conf` (nuevo), `docker-compose.yml`, `docs/README.md`

1. Stage `build`: `npm ci`, `ARG VITE_API_BASE_URL`, `npm run build`. Stage `serve`: `nginx:alpine`, copiar `dist/` + `nginx.conf` (SPA fallback `try_files $uri /index.html`, `Cache-Control` largo para `/assets/`).
2. Compose: servicio `frontend` con `build.args.VITE_API_BASE_URL: http://localhost:8010`, puerto `5180:80`.
3. `docker compose build frontend` + `up -d frontend` + verificar `curl localhost:5180` y `curl localhost:5180/login` (200 con index).
4. Actualizar `docs/README.md` (sección stack completo: ahora es production-like; el HMR dev sigue siendo `npm run dev` local).
5. Commit: `build: multi-stage frontend Dockerfile with nginx SPA fallback`

## Task 9 — 9h: tests de escala

**Archivo:** `backend/tests/test_motor_escala.py` (nuevo)

1. Seed 5.000 componentes con `db.bulk_insert_mappings`/`bulk_save_objects` (mezcla determinística: solo unos pocos elegibles baratos), `proponer_componente` → resultado correcto + **exactamente 1 statement** (listener).
2. `GET /catalogo/buscar?q=<término común>` sobre el seed → total correcto, página 1 ordenada por relevancia, y tiempo < 2s (generoso, anti-regresión grosera; si resulta flaky en CI, quitar el tiempo y dejar solo conteo/corrección).
3. Commit: `test: add scale tests for propuesta query count and catalog search`

## Task 10 — Cierre

1. Suites completas verdes (pytest, vitest, `npm run build`).
2. Plan: notas de bitácora reales; `CLAUDE.md` (ciclo 9); `docs/backlog_mejoras.md` (ítems → ✅); `docs/README.md` (frontend production-like); `docs/reglas_negocio.md` si aplica (password mínimo, eventos de seguridad auditados).
3. Pedir confirmación y mergear; borrar rama.

> **Note (bitácora real):**
> - **9d**: `AuditLog.usuario_id` era `nullable=False` — un login fallido con un email que no corresponde a ningún usuario no tiene actor autenticado al que atribuirlo. Se agregó una migración (`6e2a42990735`) para hacerlo nullable, ya que el requisito explícito de no distinguir "usuario inexistente" de "password incorrecta" obliga a auditar ambos casos con el mismo evento genérico.
> - **9d/9a**: dos migraciones nuevas de este ciclo (`1b967dfcdb91` para `asignado_manualmente` — de un pedido de UX resuelto en paralelo antes de este ciclo — y `6e2a42990735`) chocaron con el mismo falso positivo de autogenerate ya documentado en ciclos anteriores: los 3 índices GIN trigram de `catalogo_componente` se crearon con SQL crudo y Alembic los marca como "removidos" en cada `--autogenerate`. Hay que revisar y limpiar ese ruido a mano en cada migración nueva — no es un problema real, pero es fácil de arrastrar sin querer si no se lo revisa.
> - **9e**: al auditar el estado del repo antes de arrancar este ciclo, se encontró que el fix de stale closures en `ProyectoWorkspacePage` ya estaba implementado (refs vivas, TODO `bcd6068` eliminado) pero sin el test de promesa diferida que el plan pedía. Se agregó el test faltante en vez de reimplementar el fix — sirvió además para confirmar que el patrón funciona igual que en `SeccionBlock`.
> - **9f**: al correr `npm run build` (parte del job de CI) se encontró un error real de `tsc` invisible para `vitest run`: varios fixtures de test tipados como `Salida` no tenían el campo `asignado_manualmente`, que se había vuelto requerido en `api/client.ts` sin actualizar todos los fixtures. Exactamente el escenario que motivó incluir `npm run build` en el job de frontend en vez de conformarse con `vitest run` solo.
