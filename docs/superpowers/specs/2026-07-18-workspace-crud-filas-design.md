# CRUD faltante + reestructuración a "Filas" + buscador mejorado — Design

## Contexto

Después de dos ciclos de rediseño de UI, el usuario revisó el workspace de tablero en profundidad y encontró un conjunto de gaps funcionales (no solo visuales) más una confusión conceptual real en el modelo mental de la pantalla. Este documento cubre ese ciclo completo — CRUD faltante, renombrar "Sección" a "Fila" con el interruptor principal integrado como una fila más, un buscador de catálogo más cómodo, y pulido visual dirigido.

Explícitamente fuera de este ciclo: el feature de accesorios de interruptor (bobinas de tensión cero, mando manual, etc. ligados a BOM con diagrama CAD/SVG) — se aborda después, cuando encaremos BOM (Fase D). Ver `bom_vision_objetivo_final` en memoria para el alcance completo que debe tener el BOM final.

## A. CRUD faltante

### Proyecto
- `nombre` y `cliente` pasan a ser editables desde `ProyectoWorkspacePage`, vía un ícono "editar" junto al título (mismo patrón de modal accesible ya establecido: `role="dialog"`, foco, Escape, backdrop, restauración de foco).
- Backend: `PATCH /proyectos/{id}` nuevo (hoy no existe ningún endpoint de actualización de proyecto), aceptando `nombre`/`cliente` opcionales (`exclude_unset`, mismo patrón que `PATCH /tableros/{id}`).
- Borrado de proyecto: ícono en cada tarjeta de `ProyectosPage` (esquina, con `stopPropagation` para no disparar la navegación del `<Link>` que envuelve la tarjeta), con modal de confirmación que indica cuántos tableros tiene adentro. Cascada completa (proyecto → tableros → filas → salidas) al confirmar.
- Nota de alcance: el mecanismo de "consolidación" para impedir editar un trabajo terminado, mencionado por el usuario, queda **fuera de este ciclo** ("lo veremos más adelante") — no se implementa ningún bloqueo de edición por estado del proyecto ahora.

### Tablero
- Nombre editable, borrado con confirmación (avisando cantidad de filas/elementos adentro), creación — los tres accesibles desde un grupo de íconos ubicado a la **derecha** del nivel de pestañas de tablero (no pegados al texto de cada pestaña — deja espacio para sumar acciones después). El ícono de renombrar/borrar actúa sobre la pestaña activa.
- Backend: `PATCH /tableros/{id}` ya soporta `nombre`? — **no**, hoy solo acepta `nivel_falla_ka`/`interruptor_principal_id` (`TableroUpdate` en `backend/app/routers/tableros.py`). Se agrega `nombre: str | None = None` al schema.
- Backend: `DELETE /tableros/{id}` nuevo, cascada manual (borra salidas de sus secciones, luego las secciones, luego el tablero) dentro de una transacción — no hay `ondelete="CASCADE"` a nivel de DB hoy (verificado en `backend/app/models/tablero.py`), así que el borrado en cascada se hace explícito en el router, no vía constraint.
- Backend: `DELETE /proyectos/{id}` nuevo, mismo patrón de cascada manual extendida (proyecto → tableros → secciones → salidas).

### Fila (ex-Sección)
- Mismo patrón un nivel abajo: grupo de íconos a la derecha de las pestañas de fila dentro del tablero activo — renombrar fila activa, borrar fila activa (avisa cantidad de elementos adentro), "＋ Nueva fila".
- Backend: `PATCH /secciones/{id}` nuevo (hoy no existe), acepta `nombre`.
- Backend: `DELETE /secciones/{id}` nuevo, cascada manual (borra sus salidas primero).

### Elemento (salida)
- La tabla de cada fila (hoy `SeccionBlock`) suma una columna **Acciones** con ícono editar y borrar por fila de la tabla.
- **Editar** abre un modal (mismo patrón grande del punto C) que permite modificar `carga_valor`/`carga_unidad`/`formato`/`tipo_proteccion` **y** reasignar el componente — incluso si ya tenía un componente "propuesto" automáticamente, no solo cuando estaba "sin match" como hoy.
- Backend: `PATCH /salidas/{id}` ya existe pero solo acepta `componente_id` (`backend/app/routers/salidas.py`) — se extiende para aceptar también `carga_valor`/`carga_unidad`/`formato`/`tipo_proteccion` opcionales. Si cambian `carga_valor`/`formato`/`tipo_proteccion`, el motor vuelve a correr `proponer_componente` (mismo comportamiento que la creación) salvo que el usuario haya fijado un `componente_id` explícito en el mismo pedido, en cuyo caso ese valor gana.
- Backend: `DELETE /salidas/{id}` nuevo.

### Confirmación de borrado (patrón único, reutilizado en los 4 niveles)
Modal genérico de confirmación: título "Confirmar borrado", cuerpo con el nombre de lo que se borra y, cuando aplica, cuántos elementos hijos se llevan puestos ("Esto va a borrar el tablero 'TG1' y sus 2 filas con 5 elementos."), botón primario rojo "Borrar" + "Cancelar". Mismo patrón de accesibilidad (`role="dialog"`, foco, Escape, backdrop) que los demás modales de este proyecto.

## B. Reestructuración: "Sección" → "Fila", interruptor principal como fila

- Rename puramente de cara al usuario: todo texto visible ("Nueva Sección", "Sección 1", etc.) pasa a decir "Fila" ("Nueva Fila", "Fila 1"). El modelo de datos, la tabla `seccion`, los endpoints `/tableros/{id}/secciones` y el tipo `Seccion` en el frontend **no se renombran** — es un cambio de copy, no de esquema, para no arrastrar una migración de datos y renombrado de API sin necesidad real.
- El interruptor principal deja de ser un campo aislado arriba de las pestañas. Pasa a ser la **primera pestaña**, con estas diferencias respecto a una fila real:
  - Siempre presente (no se puede borrar, no tiene ícono de borrado propio).
  - No es una `Seccion`/lista de `Salida`s — su "tabla" es una vista de una sola fila mostrando el componente asignado (o "sin definir"), con un ícono editar que abre el buscador (punto C) para elegir/cambiar el interruptor principal.
  - Se distingue visualmente de las filas reales (label "Principal" en vez de un nombre editable, sin ícono de borrado).
- Las filas reales (ex-secciones) se muestran como pestañas subsiguientes, cada una con su tabla (con la columna Acciones del punto A).
- La línea de "Intensidad de Cortocircuito (Icc)" (ver punto D) queda **fuera** de las pestañas de fila — es información propia del tablero, no una fila.

## C. Buscador de catálogo

- `ComponentePicker` dispara un **modal** (mismo patrón `role="dialog"` ya establecido) en vez de un dropdown inline absoluto — se usa en los tres contextos actuales (elegir interruptor principal, crear tablero, elegir/reasignar componente de una salida) y en cualquier picker futuro.
- El modal es más ancho (~700px) y la lista de resultados vive en su propia caja con `max-height` + `overflow-y: auto` — nunca vuelve a estirar el alto de toda la página (esto también corrige el bug de la barra de scroll de toda la página que reportó el usuario).
- **Filtro maestro por categoría**: `ComponentePicker` recibe una prop **requerida** `categorias: string[]` (lista de `categoria_raiz` válidas para ese contexto de búsqueda) — no opcional, para forzar que cada uso futuro declare explícitamente su alcance en vez de heredar un default implícito equivocado. Para este ciclo, los tres usos actuales (interruptor principal, creación de tablero, elección de componente de salida) pasan la misma constante: las familias de interruptores ya usadas por el motor de propuesta (`FAMILIAS_TERMOMAGNETICO` ∪ `{FAMILIA_DIFERENCIAL_COMBO}`, definidas en `backend/app/catalogo/parser_abb.py`).
- Backend: `GET /catalogo/buscar` suma un query param `categorias` (repetible, ej. `?categorias=Interruptores%20Termomagnéticos&categorias=...`), que agrega `AND categoria_raiz = ANY(...)` al filtro existente. Si no se manda `categorias`, no filtra por categoría (mantiene compatibilidad, aunque el frontend siempre la va a mandar después de este cambio).
- El picker inline que hoy vive dentro de la celda "Estado" de `SeccionBlock` (para salidas "sin match") desaparece como dropdown independiente — se consolida en el modal de edición de salida del punto A (un solo lugar para elegir/cambiar componente, no dos mecanismos distintos).
- "Regulación" (rango de regulación térmica/magnética ajustable) **no se agrega** como filtro en este ciclo — se investigó el catálogo real completo (9.062 filas) y ese dato no existe como texto extraíble en las descripciones de interruptores (solo aparece en accesorios no relacionados, como el bloqueo de regulación o el tiempo de un relé diferencial). Queda documentado en `docs/consultas_ingenieria.md` como pregunta abierta para cuando haya una fuente de datos técnica de ABB distinta a la lista de precios actual.

## D. Pulido visual

- "Nivel de falla (Icc)" pasa a **"Intensidad de Cortocircuito (Icc)"**, en una línea de info propia del tablero (título + valor + ícono editar), visualmente separada de las pestañas de fila — no es una fila, es metadata del tablero.
- Íconos de gestión (editar, borrar, nuevo): color `text-on-background` (gris oscuro/negro) en reposo, `text-abb-red` al hover — reutiliza el único acento de marca ya definido en vez de sumar un color nuevo. El rojo queda reservado para: hover de íconos de gestión, botones primarios (Crear/Guardar), y estado de pestaña activa — no para íconos en reposo.
- "Nuevo Tablero" dejó de ser un formulario largo debajo de todo el contenido — ahora es el ícono "＋" del grupo de íconos a nivel de pestañas de tablero (abre modal, no un formulario en la página).

## Fuera de alcance de este ciclo

- Feature de accesorios de interruptor (bobinas, mando manual, mando en puerta, etc.) y su diagrama CAD/SVG — ciclo aparte, ligado a BOM.
- Filtro por "regulación" — documentado como pregunta abierta, no implementado (falta la fuente de datos).
- Mecanismo de "consolidación"/bloqueo de edición de proyectos terminados — mencionado por el usuario como algo a resolver más adelante.
- Cualquier otro ítem que el usuario siga agregando en su revisión — este documento cubre solo lo confirmado en esta sesión de brainstorming.

## Testing

Mismo patrón que el resto del proyecto (backend: pytest + Postgres real; frontend: Vitest + Testing Library):
- Backend: un test por endpoint nuevo (`PATCH`/`DELETE` de proyecto, tablero, sección, salida extendido), incluyendo casos de cascada (borrar un tablero borra sus filas y salidas; borrar un proyecto borra todo lo de abajo) y el filtro `categorias` en `/catalogo/buscar` (con y sin el parámetro, confirmando que categorías fuera de la lista quedan excluidas).
- Frontend: por cada ícono nuevo (editar/borrar en sus 4 niveles), un test de que abre el modal correcto y de que la acción exitosa actualiza la UI; un test de que "Cancelar"/Escape en el modal de confirmación de borrado no borra nada; un test de que el modal de búsqueda grande solo trae resultados de las categorías permitidas (mockeando la URL con el query param `categorias`); un test de que el interruptor principal se muestra como primera pestaña, sin ícono de borrado, distinto visualmente de una fila real.
