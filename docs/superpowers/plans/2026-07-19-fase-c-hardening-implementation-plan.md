# Fase C — Ciclo 8: Plan de implementación (hardening)

**Spec:** `docs/superpowers/specs/2026-07-19-fase-c-hardening-seguridad-performance-design.md`
**Rama:** `feat/fase-c-hardening` — **MERGEADA a `master` el 2026-07-19** (fast-forward, hasta `69cebb2`; rama eliminada).
**Convención:** TDD por tarea — test que falla → implementación mínima → verde → commit.

Baseline antes de empezar: pytest 145 verde, vitest 105 verde (14 archivos), `docker compose up -d db` corriendo.
**Resultado final:** pytest 164 verde (+19 tests), vitest 105 verde (sin cambios de UI).

> **Note (incidente de arranque):** antes de crear la rama aparecieron en el working tree tests no commiteados (`test_salidas_endpoint.py`) escritos incidentalmente por un subagente de análisis durante la auditoría. Al correrlos: 1 fallaba por la fragilidad de tabla compartida (ver Task 2) y otro codificaba un comportamiento distinto al vigente para asignación manual + cambio de carga (ver spec → "Decisión explícita"). Se descartaron con `git checkout` (no eran trabajo deliberado de nadie), pero dejaron dos hallazgos útiles: la fragilidad de aislamiento que se arregló en Task 2, y la pregunta de producto que quedó como `docs/consultas_ingenieria.md` #3. Lección operativa: los subagentes de lectura deben ser estrictamente de solo-lectura; conviene verificar `git status` antes y después de tareas delegadas.

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

> **Note (hallazgo grande del ciclo):** al correr subconjuntos de la suite apareció un fallo que parecía regresión del cambio SQL (`test_motor_configuracion_integracion` esperaba su propio componente y recibía otro), pero con `git stash` se confirmó que **fallaba igual sin el cambio**: era fragilidad preexistente de la suite. `catalogo_componente` era tabla compartida por toda la sesión y los fixtures `SAL-*` de `test_salidas_endpoint.py` (más baratos) le ganaban la propuesta al fixture del test de integración — la suite completa solo pasaba porque el orden alfabético ejecuta `test_motor_configuracion_integracion` ANTES que `test_salidas_endpoint`. Fix definitivo: fixture `autouse` en `conftest.py` que hace `TRUNCATE catalogo_componente, catalogo_precio_historial CASCADE` antes de cada test — cada test ve solo sus fixtures y cualquier subconjunto corre verde en cualquier orden (verificado). Efecto colateral positivo: los "umbrales defensivos" de `test_motor_propuesta.py` quedaron innecesarios (se conservan como claridad de intención; el NOTE del archivo se actualizó). Moraleja: una suite verde "de casualidad de orden" es una suite rota que todavía no se descubre — el truncate por test debería haber estado desde el principio; evaluar lo mismo para `proyecto`/`tablero`/`seccion`/`salida` si algún test nuevo vuelve a depender de acumulación.

---

## Task 3 — 8b: passlib → bcrypt directo

**Archivos:** `backend/app/auth/security.py`, `backend/requirements.txt`

1. **Test primero** — en `backend/tests/test_security.py`: hash literal generado con passlib 1.7.4 (`$2b$12$...`, capturado antes de desinstalar) verifica OK contra su password; hash de otro password falla.
2. Reescribir `hash_password` (`bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()`) y `verify_password` (`bcrypt.checkpw`).
3. Quitar `passlib==1.7.4` de `requirements.txt`. `bcrypt==4.0.1` queda pineado igual (upgrade de bcrypt es decisión separada, fuera de este ciclo).
4. Correr `test_security.py`, `test_auth.py`, `test_create_user.py` — verde.
5. Commit: `refactor: replace abandoned passlib with direct bcrypt calls`

> **Gotcha a verificar:** generar el hash literal ANTES de desinstalar passlib (`python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('test-clave-123'))"`) y pegarlo en el test.

> **Note (ejecutado):** los hashes de passlib son bcrypt estándar `$2b$12$`, así que `bcrypt.checkpw` los verifica sin migración — usuarios existentes no se ven afectados (test de regresión `test_verify_password_acepta_hash_legacy_de_passlib` lo traba). `bcrypt` queda pineado a `4.0.1` por ahora; con passlib eliminado, el upgrade a `bcrypt>=4.1` ya está desbloqueado y queda en el backlog (`docs/backlog_mejoras.md`).

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

> **Note (gotcha de entorno en tests):** `conftest.py` exporta `TABLERO_JWT_SECRET=test-secret` al proceso, así que un test que aserte el valor default del secret falla aunque instancie `Settings(_env_file=None)` — las env vars del proceso tienen precedencia sobre los defaults de pydantic-settings. Los tests de "arranca en development/test" asertan solo `environment`, no el valor del secret. Y `Settings(_env_file=None)` es imprescindible en todos los tests de config: sin eso heredan el `.env` local del desarrollador y el test pasa/falla según la máquina.

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

> **Note (ejecutado):** el riesgo no se materializó — la suite existente pasó sin tocar un solo test (usa un usuario por test sobre sus propios recursos). Dos decisiones tomadas en implementación: (1) analista que intenta setear `analista_id` recibe **403** (no "ignorar silenciosamente" — un intento de reasignación sin privilegio debe ser visible, no descartado); (2) reasignación a usuario inexistente o con rol != analista recibe **400** (evita proyectos huérfanos por FK o asignar a un supervisor). Y un tropiezo mecánico que la suite pescó al instante: al reemplazar lookups manuales por los helpers `obtener_*_autorizado`, en `eliminar_seccion` el primer reemplazo descartó el valor de retorno y dejó `db.delete(seccion)` referenciando una variable inexistente (NameError → 500; lo detectó `test_delete_seccion_borra_sus_salidas`). Regla para estas reescrituras: si el recurso se usa después del chequeo, el helper siempre asigna (`seccion = obtener_...`), no se descarta.

---

## Task 7 — Cierre del ciclo (EJECUTADO)

1. ✅ Suite backend completa verde (164) + suite frontend verde (105) — sin cambios de UI necesarios: `GET /proyectos` filtrado por propiedad hace que un analista nunca vea proyectos ajenos, los 403 solo son alcanzables por requests directos a la API.
2. ✅ `docs/reglas_negocio.md` → nueva subsección "Autorización por propiedad (enforced desde ciclo 8)"; `docs/diccionario_datos.md` → entrada `proyecto` actualizada.
3. ✅ `CLAUDE.md` → ciclo 8 mergeado.
4. ✅ Merge fast-forward a `master` (hasta `69cebb2`) y rama eliminada, con confirmación del usuario.
5. ✅ Housekeeping previo del ciclo (commit `a1bd59d` en master): eliminadas 3 ramas obsoletas ya mergeadas (`feat/fase-c-motor-configuracion`, `fix/salida-formato-carga-icono-origen`, `claude/infallible-jennings-8e7e4c` — esta última requirió remover antes su worktree en `.claude/worktrees/`, cuya única modificación sin commitear — recordatorio de cascada de `bom_linea` — se portó a `docs/reglas_negocio.md` antes de borrarla).

> **Note (convención reforzada por el usuario):** al cerrar este ciclo el usuario pidió explícitamente mantener y elevar el rigor documental del proyecto. Todo ciclo futuro debe dejar: spec + plan con `> **Note:**` de bitácora (bugs/gotchas REALES encontrados, no solo lo planeado), `CLAUDE.md` al día, y el tracker `docs/backlog_mejoras.md` actualizado con lo hecho y lo diferido.
