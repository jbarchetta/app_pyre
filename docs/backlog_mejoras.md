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
| ✅ | CORS con `allow_methods=["*"]`/`allow_headers=["*"]` + credentials | Ciclo 9c — lista explícita (`e2461d9`) |
| 🟡 | Sin rate limiting en login (brute-force ilimitado) | Fuera de alcance ciclo 9 (justificado: red interna, logins fallidos ya auditados) — re-evaluar en Fase E si hay exposición externa |
| ✅ | Sin headers de seguridad HTTP (`X-Frame-Options`, `CSP`, etc.) | Ciclo 9c (`e2461d9`) |
| ✅ | Sin logging de eventos de seguridad (logins fallidos, 403 por propiedad) — hay `audit_log` de negocio pero no de acceso | Ciclo 9d — `login_exitoso`/`login_fallido`/`acceso_denegado_propiedad` en `audit_log` (`7207f90`) |
| ⬜ | JWT sin refresh ni revocación (8h de validez, logout solo borra cookie del cliente) | Evaluar en Fase E si hay exposición externa |
| ✅ | Sin política de contraseñas (`create_user` acepta `"a"`) | Ciclo 9d — mínimo 8 caracteres (`7207f90`) |
| ⬜ | Upgrade `bcrypt>=4.1` (desbloqueado tras eliminar passlib) | Próximo mantenimiento de dependencias |
| 🟡 | `POST /auth/reset-password` no requiere sesión ni prueba de identidad — cualquiera con un email conocido puede resetear la contraseña de otro usuario | Decisión explícita del usuario 2026-07-29: aceptado como laxo mientras el sistema esté en fase controlada (analista/supervisor internos, sin exposición externa) — **revisar antes de cualquier despliegue con acceso público, requiere auth o token de un solo uso** |
| 🟡 | Login auto-crea `analista@pyre.com`/`supervisor@pyre.com` con password fija `clave-demo-123` si no existen, en todo entorno no-`production` | Mismo criterio que el ítem anterior — deuda de auth aceptada para esta fase, re-evaluar en Fase E |

## Estabilidad / performance

| Estado | Hallazgo | Destino |
|---|---|---|
| ✅ | Tests solo pasaban por orden alfabético de archivos (tabla `catalogo_componente` compartida) | Ciclo 8 — truncate por test en `conftest.py` (`8a84909`) |
| ✅ | N+1 en `_salida_response`/`_tablero_response` (1 query extra por fila) | Ciclo 9a — batch fetch con dict, no `relationship()` (`cd71dd6`) |
| ✅ | Listados sin paginación defensiva (`GET /proyectos`, tableros, secciones, salidas) | Ciclo 9b — `limit`/`offset` defensivos, orden estable (`07c3c25`) |
| ✅ | Frontend Dockerfile corre dev server (sin build optimizado) | Ciclo 9g — multi-stage build + nginx (`8c6f65b`) |
| ✅ | Sin CI — las 2 suites dependen de disciplina manual | Ciclo 9f — GitHub Actions mínimo (`ed09047`) |
| ✅ | Sin tests de carga/estrés (motor de propuesta y búsqueda de catálogo a escala real) | Ciclo 9h — seed de 5.000 componentes, conteo de queries (`3cc3756`) |
| 🟦 | Sin capa de servicios: lógica de negocio en routers (va a crecer con BOM) | Evaluar al diseñar ciclo 11 (BOM) |
| ⬜ | `client.ts` monolítico (400+ líneas, todos los dominios) — separar por dominio cuando crezca | Evaluar en ciclo 11 o antes del cotizador |
| ⬜ | Estado del workspace por prop drilling (15+ `useState` en `DetalleTablero`) — evaluar React Query/Zustand | Evaluar antes del cotizador/BOM UI |
| 🟡 | Responses construidas a mano (`_salida_response`/`_tablero_response`): cada campo nuevo toca 5 archivos | Evaluado en ciclo 9a — se mantiene deliberadamente (contrato explícito campo-a-campo); re-evaluar si el BOM duplica campos |

## Deuda técnica conocida

| Estado | Hallazgo | Destino |
|---|---|---|
| ✅ | TODO `bcd6068`: guards de respuestas stale en `ProyectoWorkspacePage` son inertes (closures congelados — ya resuelto en `SeccionBlock` con refs, falta replicar) | Ciclo 9e — refs sincronizados, TODO eliminado (`fe25402`) |
| ✅ | Errores del backend se descartan en el frontend (`catch` genérico — el usuario no ve "La carga en amperios debe ser un número entero") | Ciclo 10a (`9f34c08`, `99b4ed8`) |
| ✅ | 3 ramas obsoletas mergeadas + CLAUDE.md desactualizado (ciclo 7) | Housekeeping 2026-07-19 (`a1bd59d`) |
| 🟦 | Migración `7c4084aba894` (enum TRIPOLAR) sin downgrade posible (limitación de Postgres) | Aceptado — documentado, no requiere acción |
| 🟡 | Asignación manual inconsistente con carga no se valida ni advierte | 🟡 `docs/consultas_ingenieria.md` #3 — pendiente decisión del usuario |
| ✅ | `motor_reglas.seleccionar_gabinete_nollmann` tenía un `sort()`+`return` duplicado e inalcanzable (copy-paste) | Housekeeping 2026-07-29 |
| ✅ | `app/main.py` aplicaba `ALTER TABLE ... IF NOT EXISTS` crudo para 3 columnas de `salida` en cada arranque, en paralelo a Alembic | Housekeeping 2026-07-29 — migración `7e765fcca671`, hack eliminado |
| 🟡 | `ReglaCablecanal` (modelo + CRUD completo) no está conectado a `motor_reglas.seleccionar_cablecanal_zoloda` — editar reglas desde la API no afecta el cálculo | 🟡 `docs/consultas_ingenieria.md` #6 — pendiente decisión de ingeniería sobre cuál mecanismo es el autoritativo |
| ✅ | `docs/consultas_ingenieria.md` había sido reemplazado entero, perdiendo 4 preguntas abiertas sin resolución real en el código | Housekeeping 2026-07-29 — restauradas + renumeradas, referencia rota en `reglas_negocio.md:71` verificada |

## UI/UX (del análisis de la auditoría)

| Estado | Hallazgo | Destino |
|---|---|---|
| ✅ | Formularios numéricos sin validación inline (carga "16.5" A llega al backend y vuelve 400 genérico) | Ciclo 10a (`f64c105`) |
| ✅ | Carga masiva de salidas cuesta ~6 clicks por salida | Ciclo 10b — "Agregar y otra" + Enter submit + duplicar + Drag & Drop |
| ✅ | `ComponentePicker` no recuerda búsqueda/filtros entre aperturas | Ciclo 10a (`ef0f183`), categorías diferenciales ampliadas en Ciclo 10b |
| ✅ | `EsquemaVisual` pasivo (sin hover↔tabla ni click→editar) | Ciclo 10b — bidireccional |
| ✅ | Dashboard es un callejón sin salida (3 links, sin contenido) | Ciclo 10b — rediseño completo con métricas y 1-click navigate |
| ✅ | Sin confirmación de "cambios sin guardar" al cerrar modales de edición | Ciclo 10a (`ae1d485`, `6baace6`) |
| ✅ | Íconos de estado sin leyenda (auto/manual/sin match requieren tooltip) | Resuelto incidentalmente junto al pedido de reemplazar el texto "propuesto:" por ícono (`714eb1d`) — `title` en cada ícono |
| ✅ | Tablas de salidas sin scroll horizontal en pantallas chicas | Ciclo 10a (`e677d1e`) |
| ✅ | Indicadores de carga ausentes en la mayoría de los fetches | Ciclo 10a (`3d48505`) |

## Funcionalidad pendiente de roadmap (no son hallazgos de auditoría)

| Estado | Ítem | Destino |
|---|---|---|
| ✅ | BOM (generación + precios congelados + cascada `bom_linea` en borrados — ver `reglas_negocio.md` → Pendiente) | Ciclo 11 — cierra Fase C (`07d45e9`) |
| 🟦 | Fase D: precios/mano de obra (usar estructura real de `MO IT 1`–`MO IT 8/9` del Excel de costeo — revisar junto al usuario) | Post-Fase C |
| ⬜ | Fase E: exportables + hardening de deploy | — |
| ⬜ | Pista B: agente de extracción CAD/PDF (guard-rail de ~3000 trazos vectoriales/página documentado en `CLAUDE.md`) | Paralela, sin asignar |
| 🟡 | Cobertura de `atributos` MCCB (~1.925 filas "partes interruptivas" sin extraer) | 🟡 `docs/consultas_ingenieria.md` #1 |
| 🟡 | Filtro por "regulación" (sin fuente de datos en el catálogo actual) | 🟡 `docs/consultas_ingenieria.md` #2 |

---

## Ciclos propuestos (orden acordado con el usuario 2026-07-19)

1. **Ciclo 8 — Hardening** ✅ mergeado (spec/plan en `docs/superpowers/`).
2. **Ciclo 9 — Calidad y deuda técnica** ✅ implementado en la rama `feat/fase-c-calidad-infra`, pendiente de merge (spec/plan en `docs/superpowers/`).
3. **Ciclo 10 — UX del analista**: ítems 🟦 de UI/UX. ✅ implementado (`9f34c08`, `714eb1d`, etc.).
4. **Ciclo 11 — BOM**: cierra Fase C. ✅ implementado (`07d45e9`).
