# Backlog de mejoras — tracker de la auditoría técnica 2026-07-19

Origen: auditoría completa del proyecto (seguridad, estabilidad, mantenibilidad, UI/UX) realizada el 2026-07-19 sobre `master` post-ciclo-7. Una copia snapshot de esa auditoría quedó guardada en `project/KIMI visión completa del código.md` (gitignored) — **este backlog es el tracker canónico y versionado**; el snapshot no se actualiza. Cada hallazgo tiene estado y destino planeado. **Este documento se actualiza al cerrar cada ciclo** (convención pedida por el usuario al cerrar ciclo 8): marcar lo hecho, replanificar lo diferido, agregar lo nuevo que se descubra.

Leyenda: ✅ hecho (con ciclo/commit) · 🟦 planeado (ciclo asignado) · ⬜ sin asignar · 🟡 bloqueado por decisión externa.

---

## Seguridad

| Estado | Hallazgo | Destino |
|---|---|---|
| ✅ | Motor de propuesta traía todo el catálogo a memoria por salida (O(n) en Python) | Ciclo 8 — filtros SQL JSONB (`8a84909`) |
| ✅ | `passlib` abandonado, incompatible con `bcrypt>=4.1` | Ciclo 8 — bcrypt directo (`65421a0`) |
| ✅ | Secretos default de desarrollo sin guard-rail de producción | Ciclo 8 — validator en `Settings` (`3594d6b`) |
| ✅ | Upload de Excel sin límite de tamaño ni validación de tipo | Ciclo 8 — 20 MB + magic bytes ZIP (`f6ba20d`) |
| ✅ | Sin autorización por propiedad (analista podía operar proyectos ajenos) | Ciclo 8 — `ownership.py` + reasignación solo-supervisor (`393581d`) |
| 🟦 | CORS con `allow_methods=["*"]`/`allow_headers=["*"]` + credentials | Ciclo 9 — lista explícita |
| 🟦 | Sin rate limiting en login (brute-force ilimitado) | Ciclo 9 o Fase E — re-evaluar si el sistema se expone fuera de la red interna |
| 🟦 | Sin headers de seguridad HTTP (`X-Frame-Options`, `CSP`, etc.) | Ciclo 9 |
| 🟦 | Sin logging de eventos de seguridad (logins fallidos, 403 por propiedad) — hay `audit_log` de negocio pero no de acceso | Ciclo 9 — mismo mecanismo `audit_log` o logging estándar |
| ⬜ | JWT sin refresh ni revocación (8h de validez, logout solo borra cookie del cliente) | Evaluar en Fase E si hay exposición externa |
| ⬜ | Sin política de contraseñas (`create_user` acepta `"a"`) | Ciclo 9 o junto a gestión de usuarios |
| ⬜ | Upgrade `bcrypt>=4.1` (desbloqueado tras eliminar passlib) | Próximo mantenimiento de dependencias |

## Estabilidad / performance

| Estado | Hallazgo | Destino |
|---|---|---|
| ✅ | Tests solo pasaban por orden alfabético de archivos (tabla `catalogo_componente` compartida) | Ciclo 8 — truncate por test en `conftest.py` (`8a84909`) |
| 🟦 | N+1 en `_salida_response`/`_tablero_response` (1 query extra por fila) | Ciclo 9 — `joinedload`/`selectinload` |
| 🟦 | Listados sin paginación defensiva (`GET /proyectos`, tableros, secciones, salidas) | Ciclo 9 |
| 🟦 | Frontend Dockerfile corre dev server (sin build optimizado) | Ciclo 9 — multi-stage build + nginx |
| 🟦 | Sin CI — las 2 suites dependen de disciplina manual | Ciclo 9 — GitHub Actions mínimo |
| ⬜ | Sin tests de carga/estrés (motor de propuesta y búsqueda de catálogo a escala real) | Ciclo 9 o cuando el catálogo crezca 3-5x |
| 🟦 | Sin capa de servicios: lógica de negocio en routers (va a crecer con BOM) | Evaluar al diseñar ciclo 11 (BOM) |
| ⬜ | `client.ts` monolítico (400+ líneas, todos los dominios) — separar por dominio cuando crezca | Evaluar en ciclo 11 o antes del cotizador |
| ⬜ | Estado del workspace por prop drilling (15+ `useState` en `DetalleTablero`) — evaluar React Query/Zustand | Evaluar antes del cotizador/BOM UI |
| ⬜ | Responses construidas a mano (`_salida_response`/`_tablero_response`): cada campo nuevo toca 5 archivos | Con el N+1 del ciclo 9, evaluar helper/serializer |

## Deuda técnica conocida

| Estado | Hallazgo | Destino |
|---|---|---|
| 🟦 | TODO `bcd6068`: guards de respuestas stale en `ProyectoWorkspacePage` son inertes (closures congelados — ya resuelto en `SeccionBlock` con refs, falta replicar) | Ciclo 9 o 10 |
| 🟦 | Errores del backend se descartan en el frontend (`catch` genérico — el usuario no ve "La carga en amperios debe ser un número entero") | Ciclo 10 |
| ✅ | 3 ramas obsoletas mergeadas + CLAUDE.md desactualizado (ciclo 7) | Housekeeping 2026-07-19 (`a1bd59d`) |
| 🟦 | Migración `7c4084aba894` (enum TRIPOLAR) sin downgrade posible (limitación de Postgres) | Aceptado — documentado, no requiere acción |
| 🟡 | Asignación manual inconsistente con carga no se valida ni advierte | 🟡 `docs/consultas_ingenieria.md` #3 — pendiente decisión del usuario |

## UI/UX (del análisis de la auditoría)

| Estado | Hallazgo | Destino |
|---|---|---|
| 🟦 | Formularios numéricos sin validación inline (carga "16.5" A llega al backend y vuelve 400 genérico) | Ciclo 10 |
| 🟦 | Carga masiva de salidas cuesta ~6 clicks por salida | Ciclo 10 — "Agregar y otra" + Enter submit |
| 🟦 | `ComponentePicker` no recuerda búsqueda/filtros entre aperturas | Ciclo 10 |
| 🟦 | `EsquemaVisual` pasivo (sin hover↔tabla ni click→editar) | Ciclo 10 — bidireccional |
| 🟦 | Dashboard es un callejón sin salida (3 links, sin contenido) | Ciclo 10 |
| 🟦 | Sin confirmación de "cambios sin guardar" al cerrar modales de edición | Ciclo 10 |
| 🟦 | Íconos de estado sin leyenda (auto/manual/sin match requieren tooltip) | Ciclo 10 |
| 🟦 | Tablas de salidas sin scroll horizontal en pantallas chicas | Ciclo 10 |
| ⬜ | Indicadores de carga ausentes en la mayoría de los fetches | Ciclo 10 |

## Funcionalidad pendiente de roadmap (no son hallazgos de auditoría)

| Estado | Ítem | Destino |
|---|---|---|
| 🟦 | BOM (generación + precios congelados + cascada `bom_linea` en borrados — ver `reglas_negocio.md` → Pendiente) | Ciclo 11 — cierra Fase C |
| 🟦 | Fase D: precios/mano de obra (usar estructura real de `MO IT 1`–`MO IT 8/9` del Excel de costeo — revisar junto al usuario) | Post-Fase C |
| ⬜ | Fase E: exportables + hardening de deploy | — |
| ⬜ | Pista B: agente de extracción CAD/PDF (guard-rail de ~3000 trazos vectoriales/página documentado en `CLAUDE.md`) | Paralela, sin asignar |
| 🟡 | Cobertura de `atributos` MCCB (~1.925 filas "partes interruptivas" sin extraer) | 🟡 `docs/consultas_ingenieria.md` #1 |
| 🟡 | Filtro por "regulación" (sin fuente de datos en el catálogo actual) | 🟡 `docs/consultas_ingenieria.md` #2 |

---

## Ciclos propuestos (orden acordado con el usuario 2026-07-19)

1. **Ciclo 8 — Hardening** ✅ mergeado (spec/plan en `docs/superpowers/`).
2. **Ciclo 9 — Calidad y deuda técnica**: ítems 🟦 de seguridad/estabilidad/deuda de la tabla.
3. **Ciclo 10 — UX del analista**: ítems 🟦 de UI/UX.
4. **Ciclo 11 — BOM**: cierra Fase C. Prerequisito: revisar con el usuario la estructura del Excel de costeo (`MAT`/`MO IT`) que el usuario habilitó para esta fase.
