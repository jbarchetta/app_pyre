# Fase C (ciclo 2) — UI mínima del configurador

## Alcance de este ciclo

UI funcional (sin pulido visual — eso queda para la fase de diseño de UI del roadmap general) que cubre el flujo completo de carga manual-asistida sobre el backend ya construido en el ciclo 1 (`docs/superpowers/specs/2026-07-16-fase-c-motor-configuracion-design.md`):

1. Listar/crear proyectos (reemplaza el stub actual del Dashboard).
2. Crear un tablero dentro de un proyecto (nombre, nivel de falla, interruptor principal).
3. Agregar secciones y, dentro de cada sección, agregar salidas — viendo en vivo la propuesta del motor o cargando manualmente si no hay match.
4. Ver el tablero como esquema visual esquemático (cajas proporcionales por salida), no como diagrama unifilar completo.
5. Editar los parámetros de cálculo (tensiones, cos φ, ratio de selectividad).

**Fuera de alcance de este ciclo:** BOM (derivación de líneas de cable/terminal/etiqueta — ver nota de referencia en `reglas_negocio.md` sobre la metodología interna de PYRE), exportables a Excel, diagrama unifilar completo, agente de extracción CAD/PDF, pulido visual/diseño de marca.

## Hallazgo que amplía el alcance de backend

Fase B nunca construyó un endpoint de búsqueda/listado sobre `catalogo_componente` (solo `POST /catalogo/importar`). Este ciclo necesita poder buscar un componente para: (a) elegir el interruptor principal de un tablero, (b) elegir manualmente el componente de una salida sin propuesta automática. Se agrega:

**`GET /catalogo/buscar?q=<texto>`** — filtra por `codigo ILIKE %q%` OR `descripcion ILIKE %q%`, devuelve hasta 20 resultados (id, codigo, descripcion, precio_neto), ordenados por `codigo`. Requiere autenticación (cualquier rol). Si `q` es vacío o tiene menos de 2 caracteres, devuelve lista vacía (evita escanear ~10k filas en cada tecla).

## Layout

Una sola página por tablero, con todo anidado y visible a la vez — no wizard por pasos ni maestro-detalle. El flujo real es ir y volver (agregar sección, cargar salidas, ajustar), no lineal; un wizard fuerza una linealidad que no refleja el uso real. Estructura:

```
/proyectos              — listar proyectos, crear uno nuevo
/proyectos/:id          — detalle de proyecto: lista de tableros, crear uno nuevo
/tableros/:id           — página principal del ciclo:
                            - datos del tablero (nombre, nivel_falla_ka, interruptor principal)
                            - esquema visual (SVG) de todas las secciones/salidas
                            - por sección: lista de salidas + mini-form para agregar una nueva
                            - botón "+ agregar sección"
/parametros-calculo      — form de parámetros de cálculo (tensiones, cos φ, ratio)
```

`DashboardPage` deja de ser un stub y redirige a `/proyectos` (o se fusiona con ella — decisión de implementación, no de diseño).

## Esquema visual

SVG generado en el cliente a partir de los datos ya cargados de tablero/secciones/salidas (sin tocar el backend). Reglas:

- Cada salida es un rectángulo cuyo ancho es `24px × cantidad_de_polos` (unipolar=24px, bipolar=48px, tetrapolar=96px), alto fijo (24px).
- Color por `tipo_proteccion`: termomagnético en azul, diferencial en rosa/magenta.
- Si `componente_id` es `null` (sin match), el rectángulo se dibuja punteado en gris en vez de con color — señal visual de "falta resolver".
- El interruptor principal del tablero se dibuja como un rectángulo más grande (ancho fijo mayor, ej. 120px) arriba de todas las secciones.
- Las salidas dentro de una sección se dibujan en fila; las secciones se apilan verticalmente con su nombre como etiqueta.
- Objetivo: que el analista se oriente sobre el formato físico que está tomando el tablero mientras lo carga — no es un diagrama eléctrico unifilar (con líneas de conexión, cable, etc.), que queda fuera de alcance.

## Componentes (frontend, `frontend/src/`)

Siguiendo el patrón ya establecido (`pages/CatalogoPage.tsx`: páginas con estado local vía `useState`, sin librería de manejo de estado global; `api/client.ts`: funciones `fetch` planas con tipos, sin librería de HTTP):

- `pages/ProyectosPage.tsx` — listar + crear proyectos.
- `pages/ProyectoDetallePage.tsx` — listar + crear tableros de un proyecto.
- `pages/TableroPage.tsx` — página principal: datos del tablero, esquema visual, secciones, formularios de salida.
- `pages/ParametrosCalculoPage.tsx` — form de parámetros.
- `components/ComponentePicker.tsx` — input de búsqueda + lista de resultados, reutilizado para elegir interruptor principal y para el override manual de una salida. Recibe `onSelect(componente)` como prop — no sabe para qué se usa la selección.
- `components/EsquemaVisual.tsx` — recibe `tablero` (con sus secciones/salidas ya cargadas) y devuelve el SVG. Componente puro de presentación, sin fetch propio.
- `api/client.ts` — se agregan funciones tipadas: `listarProyectos`, `crearProyecto`, `obtenerProyecto`, `crearTablero`, `obtenerTablero`, `crearSeccion`, `crearSalida`, `actualizarSalida`, `buscarCatalogo`, `obtenerParametrosCalculo`, `actualizarParametrosCalculo`.

## Manejo de errores

- Errores de red/4xx de la API se muestran como `<p role="alert">` cerca del formulario que falló (mismo patrón que `CatalogoPage.tsx`), no un toast global ni modal.
- `ComponentePicker` sin resultados muestra "sin resultados" en vez de lista vacía silenciosa.
- Si `crear_salida` devuelve `componente_id: null`, la UI lo muestra explícitamente como "sin match — elegí manualmente" con el picker inline, no como un error.

## Testing

- **Backend**: `GET /catalogo/buscar` — test de integración (con auth, sin auth, con resultados, sin resultados, `q` corto devuelve vacío).
- **Frontend (Vitest + Testing Library, seguir el patrón de `CatalogoPage.test.tsx`/`LoginPage.test.tsx`)**:
  - `ProyectosPage`: crear proyecto, listar proyectos existentes.
  - `TableroPage`: crear sección, crear salida con propuesta automática (mock de la respuesta), crear salida sin match muestra el picker, override manual actualiza la salida.
  - `ComponentePicker`: no busca con menos de 2 caracteres, muestra resultados, `onSelect` se llama con el componente clickeado.
  - `EsquemaVisual`: ancho de rectángulo proporcional a polos, color correcto por tipo, estado punteado cuando `componente_id` es `null` (test de snapshot/props, no pixel-perfect).

## Documentación a actualizar

- Ninguna adicional más allá de lo ya cubierto en el ciclo 1 — este ciclo no cambia modelo de datos ni reglas de negocio, solo expone lo existente.
