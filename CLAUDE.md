# Configurador de Tableros PYRE

Sistema web para PYRE (integrador ABB) que administra el catálogo de componentes, arma tableros seccionables (interruptor principal + salidas), genera BOM y calcula precios. Plazo: ~30 días desde 2026-07-16.

**Antes de tocar código, leé en este orden:**

1. `docs/README.md` — cómo levantar el stack local (Docker, puertos, login de prueba).
2. `docs/superpowers/specs/2026-07-16-configurador-tableros-design.md` — diseño general del sistema (todas las fases).
3. `docs/superpowers/specs/2026-07-16-fase-b-catalogo-design.md` — diseño del catálogo (Fase B).
4. `docs/superpowers/plans/*.md` — planes de implementación ya ejecutados, con notas inline (`> **Note:**`) documentando bugs/gotchas reales encontrados durante la implementación (no son solo planes, son bitácora técnica).
5. `docs/diccionario_datos.md` y `docs/reglas_negocio.md` — qué significa cada tabla/columna y las reglas de negocio vigentes. Se actualizan a medida que avanzan las fases.

## Estado (actualizar al final de cada fase)

- ✅ **Fase A — Fundaciones**: Docker Compose, auth (analista/supervisor), modelo de datos base, login React funcionando. Mergeada a `master`.
- ✅ **Fase B — Catálogo**: importador de Excel ABB (jerarquía completa, ~10.247 filas) + otros materiales, con historial de precios y auditoría. Mergeada a `master`.
- 🟨 **Fase C — Motor de configuración + BOM + esquema visual**: ciclo 1 (backend del motor de configuración: modelo de datos, reglas de cálculo, API REST) mergeado a `master`. Spec: `docs/superpowers/specs/2026-07-16-fase-c-motor-configuracion-design.md`; plan: `docs/superpowers/plans/2026-07-16-fase-c-motor-configuracion-implementation-plan.md`. Falta: UI mínima (plan aparte), poblar `atributos` desde el Excel real de ABB (el motor hoy asume esas claves ya cargadas), BOM y esquema visual.
- ⬜ **Pista B — Agente de extracción CAD/PDF**: no arrancada (pensada para correr en paralelo a la pista principal).
- ⬜ **Fase D/E — Precios/mano de obra + exportables + UI pulida + hardening**: no arrancadas.

## Convenciones del proyecto

- Backend: Python/FastAPI + SQLAlchemy 2.0 (`Mapped[]`/`mapped_column()`) + Alembic + PostgreSQL. Frontend: React/TypeScript + Vite + Vitest.
- TDD siempre: test que falla → implementación mínima → test pasa → commit.
- JSON en Postgres siempre como `JSONB` (no `JSON` genérico) — necesario para indexar/consultar más adelante.
- `venv` del backend en `backend/venv/` (no está en git). `docker compose up -d db` antes de correr tests.
- Ramas de feature por fase (`feat/fase-x-...`), merge local a `master` al terminar, con los dos suites de test en verde.
- Un archivo Excel confidencial de PYRE (`samples/catalogo/TABLA POLOS TABLEROS SECC. CON CAMBIOS.xlsx`) es la herramienta interna actual de costeo — el usuario pidió explícitamente no analizarlo todavía ("lo analizaremos luego"). No lo abras sin que te lo pidan.
- `samples/catalogo/` tiene archivos reales de proveedores (gitignored, confidenciales) — útiles para verificar parsers contra datos reales antes de dar una fase por terminada.
