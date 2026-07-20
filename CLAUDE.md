# Configurador de Tableros PYRE

Sistema web para PYRE (integrador ABB) que administra el catálogo de componentes, arma tableros seccionables (interruptor principal + salidas), genera BOM y calcula precios. Plazo: ~30 días desde 2026-07-16.

**Antes de tocar código, leé en este orden:**

1. `docs/README.md` — cómo levantar el stack local (Docker, puertos, login de prueba).
2. `docs/superpowers/specs/2026-07-16-configurador-tableros-design.md` — diseño general del sistema (todas las fases).
3. `docs/superpowers/specs/2026-07-16-fase-b-catalogo-design.md` — diseño del catálogo (Fase B).
4. `docs/superpowers/plans/*.md` — planes de implementación ya ejecutados, con notas inline (`> **Note:**`) documentando bugs/gotchas reales encontrados durante la implementación (no son solo planes, son bitácora técnica).
5. `docs/diccionario_datos.md` y `docs/reglas_negocio.md` — qué significa cada tabla/columna y las reglas de negocio vigentes. Se actualizan a medida que avanzan las fases.
6. `docs/consultas_ingenieria.md` — preguntas de negocio/eléctricas abiertas que necesitan confirmación de un ingeniero de PYRE, no adivinar.
7. `docs/backlog_mejoras.md` — tracker de hallazgos de la auditoría técnica 2026-07-19 con estado por ítem y mapeo a ciclos. Se actualiza al cerrar cada ciclo (marcar hecho, replanificar diferido, agregar descubierto).

## Estado (actualizar al final de cada fase)

- ✅ **Fase A — Fundaciones**: Docker Compose, auth (analista/supervisor), modelo de datos base, login React funcionando. Mergeada a `master`.
- ✅ **Fase B — Catálogo**: importador de Excel ABB (jerarquía completa; el Excel tiene 10.247 filas de datos pero ~9.062 son componentes reales, el resto son filas de sección con "Codigo SAP" en blanco) + otros materiales, con historial de precios y auditoría. Mergeada a `master`.
- 🟨 **Fase C — Motor de configuración + BOM + esquema visual**: ciclos 1 a 10b mergeados a `master` (ciclo 10b: Auditoría UX y Mejoras Integrales del Analista — Dashboard Landing Page con métricas, Proyectos en tarjetas/tabla con buscador y filtros por estado y agrupación por mes, metadata `codigo_obra`/`fecha_inicio`/autor, botón `← Volver a Proyectos` destacado, Hero CTA `[ + Crear mi primer tablero ]`, tabla de salidas con etiqueta de circuito, diagnóstico explícito de "Sin Match", duplicación en 1-click, reordenamiento por Drag & Drop, EsquemaVisual blueprint interactivo bidireccional y filtrado de disyuntores diferenciales en `ComponentePicker` — spec en `docs/superpowers/specs/2026-07-20-ciclo-10b-ux-feedback-design.md`, plan en `docs/superpowers/plans/2026-07-20-ciclo-10b-ux-feedback-implementation-plan.md`). Specs base: `docs/superpowers/specs/2026-07-16-fase-c-motor-configuracion-design.md`, `docs/superpowers/specs/2026-07-16-fase-c-ui-configurador-design.md`, `docs/superpowers/specs/2026-07-16-catalogo-abb-atributos-design.md`. Falta: Ciclo 11 (BOM).
- ⬜ **Pista B — Agente de extracción CAD/PDF**: no arrancada (pensada para correr en paralelo a la pista principal). Gotcha real encontrado al probar conversión de PDF→markdown con `pymupdf4llm` sobre documentos reales de proyecto (`project/`, gitignored): páginas con una cantidad muy alta de trazos vectoriales (sello oficial, plano técnico detallado — un caso real tenía ~62.000) hacen que el motor de detección de tablas/layout de `pymupdf4llm` se cuelgue (tardó ~40 min en una página vs. ~0.2s normal). Mitigación que funcionó: contar `page.get_drawings()` por página y, si supera un umbral (~3000), usar extracción de texto plano (`page.get_text()`) en vez del pipeline de layout para esa página puntual. Tenerlo en cuenta al diseñar el pipeline de extracción de Pista B — sea cual sea la librería, va a necesitar un guard-rail similar para no colgarse con planos/sellos reales.
- ⬜ **Fase D/E — Precios/mano de obra + exportables + UI pulida + hardening**: no arrancadas.

## Convenciones del proyecto

- Backend: Python/FastAPI + SQLAlchemy 2.0 (`Mapped[]`/`mapped_column()`) + Alembic + PostgreSQL. Frontend: React/TypeScript + Vite + Vitest.
- TDD siempre: test que falla → implementación mínima → test pasa → commit.
- JSON en Postgres siempre como `JSONB` (no `JSON` genérico) — necesario para indexar/consultar más adelante.
- `venv` del backend en `backend/venv/` (no está en git). `docker compose up -d db` antes de correr tests.
- Ramas de feature por fase (`feat/fase-x-...`), merge local a `master` al terminar, con los dos suites de test en verde.
- Un archivo Excel confidencial de PYRE (`samples/catalogo/TABLA POLOS TABLEROS SECC. CON CAMBIOS.xlsx`) es la herramienta interna actual de costeo — el usuario pidió explícitamente no analizarlo todavía ("lo analizaremos luego"). No lo abras sin que te lo pidan.
- `samples/catalogo/` tiene archivos reales de proveedores (gitignored, confidenciales) — útiles para verificar parsers contra datos reales antes de dar una fase por terminada.
