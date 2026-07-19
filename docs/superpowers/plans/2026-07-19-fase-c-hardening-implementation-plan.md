# Fase C — Ciclo 8: Plan de implementación (hardening)

**Spec:** `docs/superpowers/specs/2026-07-19-fase-c-hardening-seguridad-performance-design.md`
**Rama:** `feat/fase-c-hardening`
**Convención:** TDD por tarea — test que falla → implementación mínima → verde → commit.

Baseline antes de empezar: pytest 145 verde, vitest 105 verde (14 archivos), `docker compose up -d db` corriendo.

---

## Task 1 — Rama

```powershell
git checkout -b feat/fase-c-hardening
```

---

## Task 2 — 8a: motor de propuesta con filtros SQL

**Archivo:** `backend/app/motor/propuesta.py`

1. **Test primero** — agregar a `backend/tests/test_motor_propuesta.py`: componente que cumple todos los atributos pero tiene `precio_neto=None` no es propuesto aunque sería el único candidato → `proponer_componente` devuelve `None`. (Hoy ese filtro ya existe en el `WHERE`; el test cubre que se mantenga en SQL tras la migración de filtros.)
2. Reescribir la query moviendo `tipo`/`polos`/`corriente_nominal_a`/`capacidad_corte_ka` al `WHERE` con operadores JSONB (`atributos["tipo"].as_string() == tipo_proteccion.value`, `atributos["polos"].as_integer() == polos`, `atributos["corriente_nominal_a"].as_float() >= float(corriente)`, `atributos["capacidad_corte_ka"].as_float() >= float(corte_min)`).
3. El loop Python queda solo para `verificar_selectividad` sobre el resultado filtrado, conservando orden `precio_neto asc, codigo asc` y devolviendo el primero que la cumple.
4. Correr `test_motor_propuesta.py` + `test_salidas_endpoint.py` + `test_motor_configuracion_integracion.py` completos — deben pasar sin cambios funcionales.
5. Commit: `perf: move propuesta component filters to SQL JSONB operators`

> **Nota de comportamiento:** los filtros de rango (`>=`) en JSONB van como `as_float()` — mismas semánticas que el `Decimal` de Python para los valores reales del catálogo (todos numéricos simples: 1-4 polos, 0.5-125A, 3-100kA). Si apareciera un `atributos` con tipos raros (string en vez de número), la comparación `as_float()` devuelve NULL y la fila se excluye — mismo resultado que el `continue` actual por no cumplir.

---

## Task 3 — 8b: passlib → bcrypt directo

**Archivos:** `backend/app/auth/security.py`, `backend/requirements.txt`

1. **Test primero** — en `backend/tests/test_security.py`: hash literal generado con passlib 1.7.4 (`$2b$12$...`, capturado antes de desinstalar) verifica OK contra su password; hash de otro password falla.
2. Reescribir `hash_password` (`bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()`) y `verify_password` (`bcrypt.checkpw`).
3. Quitar `passlib==1.7.4` de `requirements.txt`. `bcrypt==4.0.1` queda pineado igual (upgrade de bcrypt es decisión separada, fuera de este ciclo).
4. Correr `test_security.py`, `test_auth.py`, `test_create_user.py` — verde.
5. Commit: `refactor: replace abandoned passlib with direct bcrypt calls`

> **Gotcha a verificar:** generar el hash literal ANTES de desinstalar passlib (`python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('test-clave-123'))"`) y pegarlo en el test.

---

## Task 4 — 8c: guard-rail de secretos en producción

**Archivo:** `backend/app/config.py`

1. **Test primero** — nuevo `backend/tests/test_config.py`:
   - `Settings` con `TABLERO_ENVIRONMENT=production` y `TABLERO_JWT_SECRET=dev-secret-change-me` → `ValidationError`.
   - `production` + `database_url` con `tablero_dev_pw` → `ValidationError`.
   - `production` + secret y URL reales → OK.
   - `development` + defaults → OK (no rompe el flujo diario).
   - Instanciar `Settings(_env_file=None)` en el test para no heredar el `.env` local.
2. Agregar `@model_validator(mode="after")` en `Settings` con los chequeos de la spec.
3. Correr suite completa — `conftest.py` setea `TABLERO_ENVIRONMENT=test`, no afecta.
4. Commit: `feat: refuse to start in production with development secrets`

---

## Task 5 — 8d: validación de upload de Excel

**Archivo:** `backend/app/routers/catalogo.py`

1. **Test primero** — en `test_catalogo_import_endpoint.py`:
   - POST con contenido `b"esto no es un excel"` → 400 con mensaje de tipo inválido.
   - POST con archivo de 20MB+1 bytes (generado en memoria, con magic bytes PK para aislar el chequeo de tamaño) → 413.
   - El test e2e existente con workbook real sigue pasando (regresión).
2. Implementar: leer con `archivo.read(_TAMANO_MAXIMO_UPLOAD + 1)`, 413 si excede; chequear `contenido.startswith(b"PK\x03\x04")`, 400 si no.
3. Correr `test_catalogo_import_endpoint.py` completo.
4. Commit: `feat: validate catalog upload size and xlsx magic bytes`

---

## Task 6 — 8e: autorización por propiedad

**Archivos:** `backend/app/routers/proyectos.py`, `tableros.py`, `salidas.py` (+ helper compartido), `backend/tests/test_autorizacion_propiedad.py` (nuevo)

1. **Test primero** — nuevo archivo de tests con dos usuarios analistas (A y B) y un supervisor:
   - `GET /proyectos` como B solo lista proyectos de B (no los de A); como supervisor lista todos.
   - `GET /proyectos/{id_de_A}` como B → 403; `PATCH` → 403; `DELETE` → 403.
   - Endpoints anidados como B sobre recursos de A → 403: `POST /proyectos/{idA}/tableros`, `GET /proyectos/{idA}/tableros`, `GET/PATCH/DELETE /tableros/{id}`, `POST/GET /tableros/{id}/secciones`, `PATCH/DELETE /secciones/{id}`, `POST/GET /secciones/{id}/salidas`, `PATCH/DELETE /salidas/{id}`.
   - Supervisor: acceso total a los de A (GET/PATCH/DELETE + anidados).
   - Reasignación: supervisor hace `PATCH /proyectos/{idA}` con `analista_id=idB` → pasa a ser de B (B ya puede editarlo, A ya no). Analista B intentando setear `analista_id` → el campo se ignora (no se aplica) o 400 — decidir en implementación, documentar elección.
2. Implementar helper en `backend/app/auth/dependencies.py` (o módulo nuevo `app/auth/ownership.py`): funciones `proyecto_de_tablero/seccion/salida` que resuelven la cadena y `verificar_acceso_proyecto(proyecto, usuario)` que levanta 403 si analista ajeno (supervisor pasa).
3. Aplicar en los ~20 endpoints listados. `GET /proyectos` filtra por `analista_id` salvo supervisor.
4. `ProyectoUpdate` acepta `analista_id: uuid.UUID | None` opcional; solo se aplica si `usuario.rol == SUPERVISOR`.
5. Correr suite backend completa — los tests existentes (un solo usuario por test) deben pasar sin cambios.
6. Commit: `feat: enforce project ownership authorization with supervisor override`

> **Riesgo principal:** algún test existente podría crear el proyecto con un usuario y operar con otro implícitamente (todos usan el mismo helper de login por test, no debería pasar). Si aparece un fallo así, es un bug del test (setup), no aflojar la regla.

---

## Task 7 — Cierre del ciclo

1. Suite backend completa verde + suite frontend verde (sin cambios de UI esperados; si `ProyectosPage` test asume ver todos los proyectos con el usuario de prueba, sigue viendo los suyos — verificar).
2. Actualizar `docs/reglas_negocio.md` (sección Roles) con la regla efectiva: analista opera solo sus proyectos; supervisor todos; reasignación vía `PATCH` con `analista_id` solo por supervisor.
3. Actualizar `docs/diccionario_datos.md` si `ProyectoUpdate` documenta campos (revisar).
4. Actualizar `CLAUDE.md` — estado del ciclo 8.
5. Pedir confirmación al usuario y mergear `feat/fase-c-hardening` → `master`.
6. Borrar la rama tras merge.
