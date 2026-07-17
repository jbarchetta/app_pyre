# Rediseño de UI + modelador gráfico del esquema visual — Design

## Contexto y objetivo

La UI mínima de Fase C (ciclo 2) es funcional pero visualmente es el scaffold por defecto de Vite: sin marca, sin jerarquía visual, formularios sueltos sin layout. El spec original (`2026-07-16-configurador-tableros-design.md`) marca como prioridad alta que el producto se vea profesional porque es visible a terceros (el cliente final de PYRE), y deja el esquema visual del tablero como "cajas proporcionales simples" explícitamente pendiente de mejorar.

Este ciclo aborda ambas cosas: (1) una dirección visual completa para toda la app, y (2) un modelador gráfico real para el esquema visual del tablero (zoom, capas, múltiples tableros por pestañas), en vez de las cajas SVG lisas actuales.

Fuera de alcance de este ciclo (se mantiene el orden ya acordado: esquema visual + UI primero, el resto después): BOM/cotizador, exportables a Excel/PDF, diagrama unifilar completo con cableado, modo oscuro, agente de extracción CAD/PDF.

## Dirección visual

Basada en una maqueta de Stitch aprobada por el usuario (industrial/técnico, identidad ABB-adyacente). Tokens extraídos de esa maqueta, a trasladar a `tailwind.config.js`:

**Colores:**
| Token | Valor | Uso |
|---|---|---|
| `background` / `surface` | `#f9f9f9` | fondo general |
| `surface-container-lowest` | `#ffffff` | tarjetas, paneles |
| `on-background` | `#1a1c1c` | texto principal |
| `secondary` | `#5e5e5f` | texto secundario |
| `surface-stroke` | `#D1D1D1` | bordes |
| `industrial-gray` | `#F4F4F4` | paneles secundarios (barras de header de tabla/canvas) |
| `abb-red` (primary) | `#E31F26` | único acento — interactivo, interruptor principal, estados activos |
| `error` | `#ba1a1a` | errores de validación (distinto del acento para no perder la semántica) |

**Geometría:** `border-radius: 0` en todos los componentes (botones, inputs, tarjetas, tablas). Es la firma visual "plano técnico" de esta dirección — no se mezcla con esquinas redondeadas en ningún componente nuevo.

**Tipografía:** Hanken Grotesk (texto, títulos, botones) vía Google Fonts; JetBrains Mono para códigos de componente, valores técnicos (A, kA, polos) y celdas de tablas de datos. Botones y labels de navegación en mayúsculas con `letter-spacing` amplio (`tracking-widest`), como en la maqueta.

**Iconografía:** Material Symbols Outlined (Google Fonts), estilo lineal.

**Modo de color:** solo claro en este ciclo. La maqueta aprobada no define paleta oscura; no se inventa una sin referencia. Modo oscuro queda para un ciclo futuro si se pide.

## Arquitectura de estilos

Se instala Tailwind como dependencia real del proyecto (`tailwindcss`, `postcss`, `autoprefixer` + el plugin `@tailwindcss/forms` que ya usa la maqueta para los `<select>`/`<input>` nativos) — no vía CDN. `tailwind.config.js` define los tokens de la tabla anterior como `theme.extend.colors` y `borderRadius: { DEFAULT: '0px', lg: '0px', xl: '0px', full: '9999px' }` (se preserva `full` para los status dots/badges circulares si hicieran falta).

`frontend/src/index.css` deja de tener las variables/estilos del scaffold de Vite; pasa a tener solo las tres directivas de Tailwind (`@tailwind base/components/utilities`) más el `@import` de las fuentes de Google Fonts. La migración de página a página ocurre en las tareas de implementación de esta misma spec — no hay una etapa previa "migrar CSS" separada del resto del trabajo.

## Navegación y estructura de rutas

**Shell global:** un componente `Layout` (header superior + sidebar izquierda, según la maqueta) envuelve todas las rutas autenticadas en `App.tsx` en un único punto — usando un `<Route element={<Layout />}>` padre de React Router con rutas hijas anidadas (`<Outlet />`), en vez de envolver cada página individualmente.

**Ítems del sidebar:**
- **Proyectos** (activo) → `/proyectos`
- **Catálogo** (activo) → `/catalogo` (hoy es solo importación; sigue siéndolo en este ciclo)
- **Parámetros de cálculo** (activo) → `/parametros-calculo`
- **Cotizador** (deshabilitado, badge "Próximo módulo") — representa BOM + precios, la etapa siguiente a esta. Deshabilitado de verdad (no navega), no es un link roto.

No se agregan ítems especulativos sin fase asignada (ej. "Certificación" de la maqueta original queda fuera del nav — se agrega el día que exista una fase real para eso).

**Fusión de `ProyectoDetallePage` + `TableroPage`:** pasan a ser una sola pantalla "workspace" en la ruta `/proyectos/:id`. Dentro, una tira de pestañas lista los tableros del proyecto (`GET /proyectos/{id}/tableros`, ya existe); la pestaña activa determina qué tablero se muestra. Si el proyecto no tiene tableros, se muestra un estado vacío con el formulario de "crear tablero" en foco en vez de una tira de pestañas vacía. Se elimina la ruta `/tableros/:id` — todo el detalle de un tablero vive dentro de su pestaña en `/proyectos/:id`. El id del tablero activo se refleja en la URL como query param (`/proyectos/:id?tablero=<tableroId>`) para que el link sea compartible y el back/forward del navegador funcione, sin necesitar una ruta anidada nueva por tablero.

## Modelador gráfico del esquema visual

Reemplaza `EsquemaVisual.tsx` actual (rectángulos SVG lisos) por un canvas con la estética blueprint de la maqueta: panel con borde, fondo de grilla técnica (`linear-gradient` repetido, CSS puro, sin imagen), barra superior con label + controles.

**Contenido del SVG** (mismo modelo de datos que hoy — sin cambios de backend):
- Interruptor principal: caja con acento rojo (`stroke`/`fill` de `abb-red`), si el tablero tiene uno asignado.
- Cada salida: caja cuyo ancho es proporcional a sus polos (igual que hoy — `ANCHO_POR_POLO * POLOS_POR_FORMATO[formato]`). Con componente asignado, se distingue `tipo_proteccion` por relleno en vez de introducir un segundo color (la paleta aprobada es monocromática + rojo, un segundo tono rompería esa identidad): `seccional_termomagnetico` = relleno sólido `on-background`; `seccional_diferencial` = relleno con patrón de rayas diagonales (`<pattern>` SVG) del mismo `on-background` sobre blanco. Ambas con borde sólido `on-background`. Sin componente: borde punteado, sin relleno (comportamiento ya existente, se conserva).
- Capa "Códigos" activa: label en JetBrains Mono con el código del componente y sus valores (A, polos) dentro o debajo de cada caja con componente asignado.
- Capa "Embarrado" activa: franja punteada superior fija, puramente decorativa/referencial (no hay dato de embarrado en el modelo — se documenta así para que no se asuma que es un campo real).

**Zoom:** botones "+"/"−" (Material Symbols `zoom_in`/`zoom_out`) que escalan el `viewBox` del SVG entre 50% y 200% en pasos de 25%, más un botón "ajustar" que vuelve a 100%. Implementado con estado de React (`nivelZoom`) que recalcula el `viewBox`, sin dependencias nuevas. No incluye zoom por scroll/pinch en este ciclo.

**Capas:** botón "capas" (ícono `layers`) que abre un panel pequeño con dos checkboxes (Códigos, Embarrado), ambas activas por defecto. Estado local de React, un objeto `{ codigos: boolean; embarrado: boolean }`.

**Pestañas multi-tablero:** ver sección de rutas arriba. El estado de zoom y capas se guarda en un mapa `Record<tableroId, { zoom: number; capas: {...} }>` en el componente padre (la pantalla workspace), así cambiar de pestaña y volver conserva la vista — no persiste entre recargas de página (se pierde al refrescar), eso queda para un ciclo futuro si hace falta.

Fuera de alcance explícito de este ciclo: vista dividida side-by-side, abrir/cerrar pestañas dinámicamente, reordenar pestañas, persistencia de zoom/capas entre sesiones, zoom por gesto.

## Resto de las pantallas

- **`ProyectosPage`:** la lista `<ul>` pasa a una grilla de tarjetas (borde recto, sin sombra) con cliente, nombre y cantidad de tableros. El formulario "nuevo proyecto" se mueve a un panel lateral/modal que se abre con un botón, en vez de estar siempre visible debajo de la lista.
- **`CatalogoPage`:** mismo alcance funcional (solo importación), restyle de inputs/select/botón con los tokens nuevos. No se agrega una pantalla de búsqueda/exploración del catálogo en este ciclo (se deja anotado como candidato a ciclo futuro — es el "buscador" mencionado por el usuario).
- **`SeccionBlock` / lista de salidas:** de `<li>` de texto plano a filas de tabla — código en JetBrains Mono, estado como badge/punto de color ("propuesto" vs "sin match"), siguiendo el patrón de la tabla BOM de la maqueta.
- **`ComponentePicker`:** mismo comportamiento, restyle como input de búsqueda con dropdown de resultados (borde recto, código en mono font).
- **`ParametrosCalculoPage`, `DashboardPage`, `LoginPage`:** restyle directo con los patrones compartidos (tarjeta, inputs, botón primario), sin cambios de estructura/interacción.

## Patrones de componentes compartidos

Se documentan como clases/utilidades Tailwind reutilizables (no como componentes React separados, salvo que la duplicación lo justifique durante la implementación):
- Botón primario: fondo `abb-red`, texto blanco, sin radius, uppercase, `tracking-widest`.
- Botón secundario: transparente, borde `on-background`, mismo tipografía.
- Badge/status dot: cuadrado chico (no círculo, coherente con `radius: 0`) de color semántico.
- Tarjeta: fondo blanco, borde `surface-stroke`, sin sombra.
- Tabla de datos: header `industrial-gray` uppercase mono, filas con hover `industrial-gray`, celdas de código en JetBrains Mono.

## Testing

Se mantiene Vitest + React Testing Library, mismo patrón que el resto del frontend. Casos nuevos a cubrir:
- `Layout`: ítems activos navegan, ítem deshabilitado ("Cotizador") no navega y no tiene `href`/`onClick` funcional.
- Pantalla workspace: cambiar de pestaña muestra los datos del tablero correspondiente; estado vacío cuando el proyecto no tiene tableros; el query param `tablero` referencia el tablero activo.
- Canvas del esquema visual: zoom in/out cambian el `viewBox` dentro del rango 50%-200%; toggle de capas oculta/muestra los elementos correspondientes (labels de código, franja de embarrado); el estado de zoom/capas se conserva al volver a una pestaña ya visitada y se pierde al recargar (no se testea persistencia entre reloads porque explícitamente no existe).

No se agregan tests de regresión visual (screenshot testing) en este ciclo — verificación manual en el navegador de preview, como el resto del proyecto.
