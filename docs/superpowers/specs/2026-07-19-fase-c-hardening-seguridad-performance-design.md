# Fase C — Ciclo 8: Hardening de seguridad y performance

**Fecha:** 2026-07-19
**Estado:** aprobada para implementar
**Origen:** auditoría técnica completa del proyecto (seguridad, estabilidad, mantenibilidad) realizada el 2026-07-19 sobre `master` post-ciclo-7.

## Contexto

La auditoría encontró la base sólida (bcrypt, JWT en cookie httponly, ORM parametrizado, auditoría de precios) pero 5 problemas concretos que hay que cerrar antes de seguir construyendo encima (especialmente antes de BOM, que va a llamar al motor en lote y a persistir `bom_linea`):

1. **El motor de propuesta carga todo el catálogo a memoria por cada salida** — `proponer_componente()` hace `.all()` sobre todos los componentes con `atributos`/`precio_neto` (~5.800 filas hoy) y filtra en Python. Cada `POST`/`PATCH /salidas` paga ese costo. Crece linealmente con el catálogo y se multiplica por salida cargada.
2. **`passlib==1.7.4` es dependencia abandonada** (último release 2020) e incompatible con `bcrypt>=4.1` — cualquier upgrade de bcrypt rompe el login. `requirements.txt` la pinea a `bcrypt==4.0.1` como parche, no como solución.
3. **Secretos de desarrollo sin guard-rail** — `config.py` tiene defaults `jwt_secret="dev-secret-change-me"` y password de DB `tablero_dev_pw`; nada impide levantar en `production` con esos valores (JWT forjeable por cualquiera).
4. **Upload de Excel sin límites ni validación de tipo** — `POST /catalogo/importar` hace `await archivo.read()` completo a memoria, sin tope de tamaño ni chequeo de que sea realmente un `.xlsx`.
5. **Sin autorización por propiedad** — ningún endpoint compara `proyecto.analista_id` con `usuario.id`. Cualquier analista autenticado puede ver/editar/borrar proyectos de otro, contradiciendo `docs/reglas_negocio.md` ("el analista crea/edita **sus propios** proyectos; el supervisor ve todos").

## Decisiones de diseño

### 8a. Motor de propuesta con filtros en SQL

Mover los filtros de `tipo`, `polos`, `corriente_nominal_a` y `capacidad_corte_ka` al `WHERE` de la query usando operadores JSONB de SQLAlchemy (`atributos["tipo"].as_string()`, `atributos["polos"].as_integer()`, `.as_float()` para los numéricos) — el mismo patrón ya usado y probado en `GET /catalogo/buscar` (ciclo 7).

La **selectividad se queda en Python**: es la comparación `nominal_aguas_arriba >= corriente_candidato * ratio_selectividad` con `Decimal` exacto; el loop itera sobre el conjunto ya filtrado por SQL (decenas de filas, no miles), ordenado por `precio_neto`/`codigo`, y devuelve el primero que la cumple. Comportamiento observable idéntico al actual — los tests existentes de `test_motor_propuesta.py` son la red de seguridad, sin cambios funcionales esperados.

Fuera de alcance: índice GIN sobre `atributos` entero (innecesario a esta escala — el filtro por `tipo`/`polos` ya reduce el scan a cientos de filas; se evalúa si el catálogo crece 10x).

### 8b. `passlib` → `bcrypt` directo

Reescribir `hash_password`/`verify_password` en `app/auth/security.py` llamando a `bcrypt.hashpw`/`bcrypt.checkpw` directamente, y eliminar `passlib` de `requirements.txt`.

**Compatibilidad:** los hashes existentes generados por passlib son bcrypt estándar (`$2b$12$...`), verificables por `bcrypt.checkpw` sin migración — los usuarios actuales siguen pudiendo loguearse. Test de regresión con un hash literal generado por passlib para garantizarlo.

Nota: bcrypt trunca passwords a 72 bytes (comportamiento histórico, igual que passlib+bcrypt). No se cambia semántica.

### 8c. Guard-rail de secretos en producción

Validador en `Settings` (pydantic): si `environment == "production"`, la app **falla al arrancar** si `jwt_secret` es uno de los defaults conocidos (`dev-secret-change-me`, `change-me-in-production`, vacío) o si `database_url` contiene el password de desarrollo (`tablero_dev_pw`). En `development`/`test` no cambia nada.

### 8d. Validación de upload de Excel

En `POST /catalogo/importar`, antes de parsear:

- **Tamaño máximo 20 MB** (`20 * 1024 * 1024`): se lee con `archivo.read(MAX + 1)` y se rechaza con **413** si excede. El catálogo real de ABB pesa ~2 MB; 20 MB es margen más que suficiente.
- **Magic bytes de ZIP** (`PK\x03\x04`): todo `.xlsx` es un ZIP; se rechaza con **400** si no los tiene. Cubre archivos renombrados, `.xls` viejo (OLE2, que el parser no maneja de todos modos) y basura binaria.

### 8e. Autorización por propiedad

Regla (alineada a `docs/reglas_negocio.md`):

- **Supervisor**: acceso total a todos los proyectos (leer, editar, borrar, y a los recursos anidados).
- **Analista**: solo sus propios proyectos (`proyecto.analista_id == usuario.id`). En `GET /proyectos` la lista se filtra a los suyos; en `GET` por id / `PATCH` / `DELETE` sobre proyecto ajeno → **403**. Lo mismo para recursos anidados (tablero → proyecto, sección → tablero → proyecto, salida → sección → tablero → proyecto), resolviendo la cadena de padres.
- **Reasignación** ("proyectos reasignables entre analistas sin bloqueo"): `PATCH /proyectos/{id}` acepta `analista_id` opcional, **solo settable por supervisor** (un analista no puede auto-asignarse proyectos ajenos ni ceder los suyos — la reasignación es una decisión de supervisión).

Implementación: helper `_verificar_acceso_proyecto(db, proyecto_id, usuario)` (404 si no existe, 403 si ajeno) reutilizado en todos los routers, con variantes que resuelven desde tablero/sección/salida.

**Sin migración de datos**: los proyectos existentes ya tienen `analista_id` poblado.

## Decisión explícita que queda registrada (no se implementa en este ciclo)

Durante el ciclo se detectó (vía tests de cobertura escritos incidentalmente) que **una salida con componente asignado manualmente conserva ese componente aunque la carga cambie** — el motor no recalcula ni valida que el componente manual siga siendo adecuado para la nueva carga (podría quedar subdimensionado). Es el comportamiento deliberado del ciclo de asignación manual ("el analista manda"), pero tiene un riesgo eléctrico real. **Se mantiene el comportamiento actual**; la pregunta "¿el sistema debe re-validar o advertir cuando una asignación manual queda inconsistente con la carga?" se eleva al usuario junto con el resultado del ciclo — si decide advertir, es un ciclo propio (flag `inconsistente` en `SalidaResponse` + badge en UI).

## Fuera de alcance

- Rate limiting en login (recomendado para exposición externa; el sistema es interno — se re-evalúa en Fase E/hardening de deploy).
- Refresh tokens / revocación de JWT.
- Headers de seguridad HTTP, HTTPS, CI/CD, Dockerfile multi-stage de frontend (van al ciclo 9 de calidad/infra).
- Capa de servicios entre routers y motor (se evalúa en el ciclo de BOM, que es donde la lógica va a crecer).

## Estrategia de testing (TDD)

- **8a**: los tests existentes de `test_motor_propuesta.py` deben pasar sin modificarse (comportamiento idéntico). Nuevo test que verifica que la propuesta no considera componentes sin `precio_neto` aunque cumplan atributos (cobertura del filtro en SQL).
- **8b**: test de regresión con hash literal `$2b$...` generado por passlib → `verify_password` debe aceptarlo. Tests existentes de `test_security.py`/`test_auth.py` sin cambios.
- **8c**: nuevo `test_config.py` — `Settings` con `environment=production` + secret default → `ValidationError`; con secret real → OK; en `development` con defaults → OK.
- **8d**: tests en `test_catalogo_import_endpoint.py` — archivo >20MB → 413; contenido no-ZIP → 400; `.xlsx` válido sigue importando.
- **8e**: nuevo `test_autorizacion_propiedad.py` — analista B no puede listar/ver/editar/borrar proyecto de A (ni sus tableros/secciones/salidas); supervisor sí; supervisor reasigna `analista_id`; analista no puede setear `analista_id`. **Los tests existentes usan un solo usuario por test** — deben seguir pasando (crean su propio proyecto y operan sobre él).

## Criterios de corte

- Las 5 mejoras implementadas con TDD, ambas suites (pytest + vitest) en verde.
- Frontend sin cambios funcionales necesarios (los 403 nuevos solo aparecen en flujos imposibles desde la UI actual — la lista filtrada hace que un analista nunca vea proyectos ajenos).
- `docs/reglas_negocio.md` actualizado con la regla de autorización efectiva y `CLAUDE.md` con el estado del ciclo.
