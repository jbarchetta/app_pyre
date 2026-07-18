# UX del workspace de tablero — ajustes post-lanzamiento — Design

## Contexto

Después de mergear el rediseño de UI (`docs/superpowers/specs/2026-07-17-rediseno-ui-esquema-visual-design.md`), el usuario revisó la app en vivo y encontró cuatro problemas de UX concretos en la pantalla de workspace de proyecto/tablero. Este documento cubre esos cuatro ajustes — es un ciclo de refinamiento sobre el trabajo recién mergeado, no una fase nueva.

## 1. Edición de Icc vía modal en vez de texto suelto

El trigger "editar nivel de falla" es hoy un `<button>` de texto plano que, al hacer click, inserta un formulario inline que empuja el resto de la página hacia abajo (`DetalleTablero.tsx`). Mismo problema para "editar interruptor principal".

**Terminología**: `nivel_falla_ka` ya está documentado en `docs/diccionario_datos.md` como el **Icc** del punto de instalación (distinto de `Icn`/`Icu`, que son la capacidad de corte de cada componente del catálogo). La UI nunca mostraba "Icc" — solo "nivel de falla" en español. Se agrega "Icc" al label sin sacar "nivel de falla" (para que un analista sin el vocabulario técnico todavía entienda de qué se trata): **"Nivel de falla (Icc)"**.

**Cambio de interacción**: el trigger de texto se reemplaza por un ícono lineal (`material-symbols-outlined`, ícono `edit` — mismo set ya usado en `EsquemaVisualCanvas` para zoom/capas) junto al valor mostrado. Al hacer click abre un modal, reutilizando el mismo patrón de accesibilidad ya construido para el modal de "Nuevo proyecto" (`ProyectosPage.tsx`): `role="dialog"`, `aria-modal`, foco inicial en el input, cierre por Escape, cierre por click en el backdrop, foco restaurado al ícono trigger al cerrar. Mismo tratamiento para "editar interruptor principal" (ícono `edit` + modal con el `ComponentePicker` adentro).

No cambia la lógica de guardado (`actualizarTablero`, `onTableroActualizado`) — es un cambio de interacción/presentación, no de datos.

## 2. Layout del esquema visual — canvas angosto + panel de secciones

Hoy `EsquemaVisualCanvas` ocupa el 100% del ancho disponible, y `DetalleTablero` apila todo verticalmente en una sola columna: info de nivel de falla/interruptor → canvas → todas las secciones (una tabla `SeccionBlock` por sección, todas expandidas y visibles a la vez) → formulario de nueva sección.

**Nuevo layout**: dos columnas a partir del punto donde hoy empieza el canvas.
- **Columna izquierda (~1/3 a 1/2 del ancho, `lg:w-1/3` con fallback a ancho completo en mobile)**: el `EsquemaVisualCanvas`, sin cambios internos — solo se lo envuelve en un contenedor angosto en vez de dejarlo estirarse.
- **Columna derecha**: un selector de secciones — una lista de botones tipo pestaña/acordeón, uno por sección existente ("Sección 1", "Sección 2", ...), más el formulario "Nueva sección" al final de esa misma lista. Al elegir una sección se muestra su `SeccionBlock` (tabla de salidas + formulario de agregar salida) debajo del selector, dentro de la misma columna derecha. Solo una sección visible/expandida a la vez — no todas apiladas como hoy.
- Si el tablero no tiene ninguna sección todavía, la columna derecha muestra directamente el formulario "Nueva sección" (sin selector vacío).
- La primera sección de la lista queda seleccionada por defecto al cargar el tablero (o al crear la primera sección).

La info de nivel de falla / interruptor principal (con sus nuevos triggers de ícono+modal del punto 1) se mantiene arriba de las dos columnas, sin cambios de posición — solo cambia su propio trigger de edición.

## 3. Búsqueda de catálogo — indicador de resultados + paginación

**Estado actual** (confirmado en código): `GET /catalogo/buscar` devuelve como máximo 20 resultados (`.limit(20)` hardcodeado en `backend/app/routers/catalogo.py`), sin parámros de paginación ni indicador de cuántos resultados totales existen. `ComponentePicker.tsx` dispara una búsqueda por cada tecleo (sin debounce) a partir de 2 caracteres.

**Cambios de este ciclo** (se deja filtros por categoría para un ciclo aparte — requiere diseñar qué filtros exponer y toca más superficie de backend):

- **Backend**: agregar un `COUNT` de coincidencias totales junto a los 20 resultados actuales, y parámetros `limit`/`offset` opcionales en `GET /catalogo/buscar` (default `limit=20, offset=0`, tope máximo de `limit` en 50 para no permitir traer el catálogo completo de una). La respuesta pasa de `list[ComponenteBusquedaResponse]` a un objeto `{resultados: [...], total: N}`.
- **Frontend**: `ComponentePicker` muestra "Mostrando X de N resultados" debajo de la lista cuando `total > resultados.length`, y un botón "Cargar más" al pie de la lista que pide la siguiente página (`offset += limit`) y agrega los resultados nuevos a los ya mostrados (no reemplaza la lista).

## 4. Volver a Proyectos desde el workspace

`ProyectoWorkspacePage` no tiene ningún link de vuelta a `/proyectos` — el único indicio es que el ítem "Proyectos" del sidebar queda resaltado (por el matching por defecto de `NavLink`), pero no hay una acción explícita de "volver".

**Cambio**: agregar un breadcrumb simple arriba del `<h1>` del proyecto: `← Proyectos` como `<Link to="/proyectos">`, estilo texto con el mismo tratamiento visual liviano que otros elementos de navegación secundaria (`text-secondary`, hover `text-on-background`).

## Fuera de alcance de este ciclo

- Filtros por categoría/tipo en la búsqueda de catálogo (documentado arriba, deliberadamente pospuesto).
- Página de Proyectos con filtros y más datos (fechas, número de proyecto) — mencionado por el usuario pero explícitamente para "seguir revisando", no incluido en esta lista de cuatro puntos.
- Cualquier otro ítem que el usuario agregue a su lista en revisión — este documento cubre solo los cuatro puntos ya confirmados.

## Testing

Mismo patrón que el resto del frontend (Vitest + Testing Library):
- Modal de Icc/interruptor principal: mismos tipos de test que el modal de `ProyectosPage` (abre/cierra, guarda, Escape, backdrop).
- Selector de secciones: cambiar de sección muestra la tabla correspondiente y oculta las demás; sección por defecto seleccionada al cargar.
- Backend de búsqueda: test de `total` correcto con más de 20 coincidencias, test de `offset`/`limit` trayendo la página siguiente sin duplicar resultados, test de tope máximo de `limit`.
- Frontend de búsqueda: "Cargar más" agrega resultados sin reemplazar los existentes; el indicador de cantidad aparece solo cuando hay más resultados que los mostrados.
- Breadcrumb: link presente y apunta a `/proyectos`.
