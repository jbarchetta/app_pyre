# Ciclo 10a — Feedback de formularios, picker con memoria, tablas responsive — Design

## Contexto

Origen: `docs/backlog_mejoras.md` sección "UI/UX (del análisis de la auditoría)" — hallazgos de la auditoría técnica del 2026-07-19 sobre el estado del proyecto. El usuario decidió dividir el Ciclo 10 (UX del analista) en tres sub-ciclos por tamaño/tema; este es el primero (10a), el más chico y transversal. El orden acordado es 10a → 10b (`EsquemaVisual` bidireccional) → 10c (Dashboard + carga masiva de salidas).

Seis ítems del backlog entran en este sub-ciclo:

- Validación inline de carga en amperios (formularios numéricos sin validación).
- Indicadores de carga ausentes en la mayoría de los fetches.
- Errores del backend descartados en el frontend (mensaje genérico en vez del real).
- Sin confirmación de "cambios sin guardar" al cerrar modales de edición.
- `ComponentePicker` no recuerda búsqueda/filtros entre aperturas.
- Tablas de salidas sin scroll horizontal en pantallas chicas.

## A. Validación inline de carga en amperios

**Hallazgo importante durante el brainstorming, no cambia el alcance de este ciclo:** el usuario revisó documentación real de ABB sobre líneas de "Miniature Circuit Breaker" y encontró calibres fraccionarios por debajo de 2A (0.2, 0.3, 0.5, 0.75, 1, 1.6A) — solo a partir de 2A los calibres son enteros. Esto sugiere que la regla de negocio actual ("la carga en amperios debe ser un número entero", `backend/app/motor/calculo.py:13`) podría estar rechazando valores reales de catálogo. El usuario todavía no terminó de revisar el resto de las líneas ABB (interruptores en caja moldeada, etc.), así que **este ciclo no toca la regla de negocio** — se documenta como pregunta abierta en `docs/consultas_ingenieria.md` (#4) y se resuelve en un ciclo aparte cuando la revisión esté completa.

**Alcance de 10a:** mover la validación de la regla *actual* (entero exacto cuando `carga_unidad === "A"`) del backend al frontend, para que el analista vea el problema antes de enviar el formulario en vez de recibir un 400 genérico.

- En `SeccionBlock.tsx`, tanto el formulario de "Nueva salida" como el modal de "Editar salida": cuando `carga_unidad === "A"` y el valor tipeado en el campo "Carga" tiene parte decimal no nula, se muestra un mensaje de validación inline debajo del campo ("Los amperios deben ser un valor entero") y el botón de submit (`Agregar salida`/`Guardar`) queda deshabilitado hasta que se corrija. Con `carga_unidad === "kW"` no hay restricción (la regla de negocio ya acepta decimales ahí).
- La validación se evalúa en cada cambio del campo (`onChange`), no solo al submit, para que el mensaje aparezca/desaparezca en tiempo real mientras el analista tipea.
- El backend sigue validando igual (`calcular_corriente_nominal`) — esto es una mejora de UX que evita el viaje redondo al servidor para el caso común, no un reemplazo de la validación real. Si por algún motivo el frontend y el backend llegaran a discrepar (no debería pasar, ambos aplican la misma regla), el backend sigue siendo la fuente de verdad y el 400 real se propaga (ver sección C).

## B. Indicadores de carga

**Problema confirmado:** `ProyectosPage.tsx` inicializa `proyectos` en `useState<Proyecto[]>([])` y `DetalleTablero.tsx` inicializa `secciones` en `useState<SeccionConSalidas[]>([])` — ambos no tienen forma de distinguir "todavía no llegó la respuesta" de "la respuesta llegó y está vacía". El resto de la app (`ParametrosCalculoPage`, `ProyectoWorkspacePage`) ya usa el patrón correcto (`useState<T | null>(null)` + `if (x === null) return <p>Cargando...</p>`).

**Cambio:** replicar el patrón ya establecido en los dos componentes que lo tienen roto:

- `ProyectosPage.tsx`: `proyectos` pasa a `Proyecto[] | null`, inicializado en `null`; mientras sea `null`, la página muestra `<p>Cargando...</p>` en vez de la grilla vacía.
- `DetalleTablero.tsx`: `secciones` pasa a `SeccionConSalidas[] | null`, mismo tratamiento.

No se toca `ComponentePicker` (ya tiene su propio indicador para "Cargar más") ni `ParametrosCalculoPage`/`ProyectoWorkspacePage` (ya correctos).

## C. Propagar mensajes de error del backend

**Problema:** en varios `catch` (`SeccionBlock.tsx`, `DetalleTablero.tsx`, `ProyectoWorkspacePage.tsx`, `ProyectosPage.tsx`, `ParametrosCalculoPage.tsx`) el mensaje real que devuelve el backend en el body (`{"detail": "..."}`) se descarta y se reemplaza por un string genérico hardcodeado (ej. `"No se pudo crear la salida"`), incluso cuando el backend sí explica el problema (ej. `"La carga en amperios debe ser un número entero"`).

**Cambio, en dos capas (verificado: hace falta tocar ambas, no solo una):**

1. `api/client.ts` — las funciones que hoy hacen `throw new Error("mensaje genérico")` en la rama `!response.ok` pasan a intentar leer `await response.json()` y usar el campo `detail` si existe (`throw new Error(body.detail ?? "mensaje genérico de fallback")`). Si el body no es JSON válido o no tiene `detail` (error de red, 500 sin body, etc.), se conserva el mensaje genérico actual como fallback.
2. Los componentes que consumen esas funciones — verificado en `SeccionBlock.tsx`, todos sus `catch` son `catch { setError("mensaje hardcodeado") }`, **sin siquiera capturar el error** (no `catch (err)`). Estos catch pasan a `catch (err) { setError(err instanceof Error ? err.message : "mensaje genérico de fallback") }`, para cada operación (crear salida, actualizar salida, reasignar componente, borrar salida). Mismo tratamiento en los catch equivalentes de `DetalleTablero.tsx`, `ProyectoWorkspacePage.tsx`, `ProyectosPage.tsx`, `ParametrosCalculoPage.tsx` — se audita cada uno durante el plan (no se asume que todos tengan la misma forma exacta que `SeccionBlock`).

## D. Confirmación simple al cerrar sin guardar

**Decisión (confirmada con el usuario):** sin trackear "dirty" por campo — cualquier intento de cerrar un modal de **edición** (no de creación con campos vacíos) vía Escape, click en el fondo, o el botón "Cancelar" pasa por una confirmación (`ConfirmDialog`, "¿Descartar cambios?") antes de cerrar. Es deliberadamente la versión simple: no compara valores contra el estado original, así que confirma siempre, haya cambiado algo o no.

**Alcance — modales de edición afectados:**
- `SeccionBlock.tsx`: modal de "Editar salida".
- `DetalleTablero.tsx`: modal de "Editar Icc", modal de "Renombrar fila".
- `ProyectoWorkspacePage.tsx`: modal de "Renombrar tablero".

**Verificado, no aplica:** `ParametrosCalculoPage.tsx` no usa un modal — es un formulario inline en su propia página, sin `role="dialog"` ni botón "Cancelar" que cierre nada. El concepto de "cerrar sin guardar" no tiene un punto de intercepción ahí (el analista simplemente navega a otra página), así que queda fuera de esta sección.

**Fuera de alcance:** modales de **creación** ("Nueva salida", "Nuevo tablero", "Nuevo proyecto") — no tiene sentido confirmar el descarte de un formulario que arrancó vacío. El picker de componentes (`ComponentePicker`) y los diálogos de confirmación de borrado (`ConfirmDialog` para deletes) tampoco aplican — no son "ediciones" en este sentido.

**Mecanismo:** cada modal de edición afectado gana un estado intermedio — al intentar cerrar (via `useCerrarAlClickFuera`, Escape, o el botón Cancelar), en vez de cerrar directo se abre el `ConfirmDialog` de descarte; confirmar cierra el modal de edición (descartando cambios no guardados), cancelar vuelve al modal de edición tal como estaba.

## E. `ComponentePicker` recuerda última búsqueda por contexto

**Decisión (confirmada con el usuario):** memoria por contexto, no compartida globalmente — así elegir el interruptor principal y elegir el componente de una salida no se pisan entre sí, pero abrir el picker repetidamente para cargar salidas similares (mismo contexto) sí recuerda la última búsqueda.

**Mecanismo:** `ComponentePicker` gana un nuevo prop requerido `contextKey: string`. Un módulo nuevo (`frontend/src/components/componentePickerMemoria.ts` o similar) mantiene un `Map<string, { query: string; filtroPolos: number | null; filtroCorriente: string | null; filtroCapacidad: string | null }>` en memoria de módulo (no `localStorage` — se resetea al recargar la página, que es el comportamiento esperado: "recordar durante la sesión de carga", no persistir indefinidamente). Al montar, `ComponentePicker` lee la entrada de `contextKey` si existe y prellena `query`/filtros; al cambiar cualquiera de esos valores, actualiza la entrada.

**`contextKey` por caller:**
- `DetalleTablero.tsx` (elegir interruptor principal): `"interruptor-principal"`.
- `SeccionBlock.tsx` (nueva salida / cambiar componente de una salida existente): `"salida-componente"` (mismo key para ambos casos — es el mismo tipo de búsqueda, cargar salidas similares se beneficia de compartir la memoria entre "nueva" y "cambiar").

## F. Tablas de salidas responsive

**Cambio:** la tabla de salidas en `SeccionBlock.tsx` se envuelve en un contenedor `<div className="overflow-x-auto">` para que en pantallas angostas la tabla haga scroll horizontal en vez de comprimir columnas ilegiblemente. Cambio puramente de CSS/estructura, sin lógica nueva.

## Fuera de alcance de este ciclo

- Corregir la regla de negocio de "amperios enteros" — pendiente de que el usuario termine de revisar las líneas ABB (ver `docs/consultas_ingenieria.md` #4).
- `EsquemaVisual` bidireccional, Dashboard con contenido real, flujo de carga masiva de salidas — Ciclos 10b y 10c respectivamente.
- Persistencia de la memoria del picker entre sesiones (`localStorage`) — deliberadamente en memoria de módulo, no persistida.

## Testing

- Backend: sin cambios de comportamiento (la regla de amperios no se toca) — no se esperan tests backend nuevos para este ciclo salvo que la sección C revele algún endpoint que hoy no incluya `detail` en su respuesta de error (a confirmar durante el plan).
- Frontend: tests para la validación inline (mensaje aparece/desaparece, submit deshabilitado), para el indicador de carga en `ProyectosPage`/`DetalleTablero` (fixture con fetch pendiente, confirma "Cargando..." antes de resolver), para la propagación de errores reales del backend (mock de `fetch` con un `detail` específico, confirma que se muestra tal cual y no el genérico), para la confirmación de cierre (abrir modal de edición, intentar cerrar, confirma que aparece el `ConfirmDialog`, confirma que "Cancelar" vuelve al modal y "Descartar" cierra), para la memoria del picker (dos aperturas con el mismo `contextKey` recuerdan la búsqueda; dos `contextKey` distintos no se pisan), y un test de humo para el `overflow-x-auto` de la tabla (o se omite si es puramente visual sin lógica que testear).
