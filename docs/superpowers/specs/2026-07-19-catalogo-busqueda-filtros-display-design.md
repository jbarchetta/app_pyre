# Catálogo: búsqueda scoped, filtros estructurados, display legible y fix de modales — Design

## Contexto

Después de mergear el ciclo de CRUD/Filas/Buscador (`docs/superpowers/specs/2026-07-18-workspace-crud-filas-design.md`), el usuario probó la app real y encontró cuatro problemas concretos, todos centrados en cómo se busca, filtra y muestra el catálogo dentro de `ComponentePicker`:

1. **El picker trae demasiado ruido.** Buscar "XT" con el filtro maestro de categorías ya aplicado (`CATEGORIAS_INTERRUPTORES`) sigue devolviendo miles de resultados. Investigación real contra la base: dentro de "Interruptores automáticos en caja moldeada" hay 2.639 filas, pero solo 1.513 son interruptores reales (familia "SACE Tmax XT") — las otras 1.126 son accesorios (terminales, mandos, bloqueos, relés de servicio, conectores) que comparten la misma `categoria_raiz` que los interruptores. El filtro maestro por categoría no distingue "interruptor" de "accesorio de interruptor" dentro de la misma categoría.
2. **Los componentes ya asignados se muestran como UUID crudo**, no como algo que un humano pueda leer (ej. `propuesto: cecc7313-b925-4077-92e8-015ca7910ca9` en vez de `propuesto: 1SDA067004R1`). Pasa en tres lugares: el badge de estado en `SeccionBlock`, el modal de editar salida, y la pestaña "Principal" de `DetalleTablero`.
3. **Los modales se cierran solos** al seleccionar texto con el mouse dentro de un campo, si la selección termina fuera del modal. Es un bug de la plataforma (cómo el navegador resuelve el evento `click` cuando el `mousedown` y el `mouseup` caen en elementos distintos), no de la lógica de la app — pero como todos los modales de la app comparten el mismo patrón de "click en el fondo cierra", el bug es sistémico. Reproducido en el modal de editar salida; el mensaje de error "No se pudo actualizar la salida" que el usuario veía después es consecuencia de este bug (el modal se cierra a mitad de una edición y el estado queda inconsistente), no un problema del backend — se confirmó que el `PATCH /salidas/{id}` funciona correctamente cuando se lo llama directo.
4. **No hay forma de acotar la búsqueda más allá del texto libre.** El usuario quiere filtrar por polos, corriente nominal (In) y capacidad de corte (kA) — datos que ya están extraídos en `atributos` desde el ciclo de Fase C #3, listos para usar sin tocar el parser.

Explícitamente fuera de este ciclo (confirmado con el usuario): el feature de accesorios de interruptor (selector visual con íconos por accesorio, agrupado por línea, con una meta aspiracional de un agente que lea manuales ABB para aprender compatibilidad — ver memoria `accesorios_interruptor_vision`), filtro por tensión (no extraída hoy, necesitaría parser nuevo), y filtro por familia/serie (reemplazado por polos/In/kA, que ya están disponibles sin trabajo adicional).

## A. Búsqueda scoped a interruptores reales

- `GET /catalogo/buscar` suma un query param opcional `solo_con_atributos: bool = False`. Cuando es `true`, agrega `AND atributos IS NOT NULL` al filtro existente. Es opt-in (no cambia el comportamiento por defecto) para no romper otros contextos de búsqueda futuros (cables, terminales) que sí podrían necesitar mostrar filas sin `atributos`.
- `ComponentePicker`, en su único contexto de uso actual (interruptores), lo manda siempre en `true`. Esto saca del medio tanto los accesorios (0% tienen `atributos`, verificado empíricamente) como el 15-36% de interruptores reales sin `atributos` extraído (la pregunta abierta #1 de `docs/consultas_ingenieria.md`, las "partes interruptivas" Tmax XT). El analista puede seguir cargando esos componentes a mano si sabe el código exacto vía el buscador de texto sin este filtro — pero eso no es parte de este ciclo (no hay hoy una superficie de búsqueda sin `categorias`/`solo_con_atributos` accesible al analista fuera del picker).
- No se toca el parser ni la extracción de `atributos` — esta decisión usa una señal que ya existe.

## B. Filtros estructurados (polos, corriente nominal, capacidad de corte)

- Nuevo endpoint `GET /catalogo/opciones-filtro`, con los mismos query params `categorias` (repetible) y `solo_con_atributos` que `/catalogo/buscar`, que devuelve los valores **realmente presentes** en el catálogo para ese scope, no una lista hardcodeada:

  ```json
  {
    "polos": [1, 2, 3, 4],
    "corrientes_nominales_a": [16, 20, 25, 32, 40, 50, 63, 80, 100, ...],
    "capacidades_corte_ka": [10, 15, 18, 25, 36, 50, 70, ...]
  }
  ```

  Implementado como `SELECT DISTINCT` sobre `atributos->>'polos'`, `atributos->>'corriente_nominal_a'`, `atributos->>'capacidad_corte_ka'` filtrado por `categoria_raiz IN (...)` y `atributos IS NOT NULL`, valores ordenados ascendente. Se autoactualiza con cada reimport del catálogo — no hay nada que mantener a mano.
- `GET /catalogo/buscar` suma tres query params opcionales: `polos: int | None`, `corriente_nominal_a: Decimal | None`, `capacidad_corte_ka: Decimal | None`. Cada uno, si viene, agrega una igualdad exacta sobre el campo correspondiente de `atributos` al filtro existente (además de `categorias`/`solo_con_atributos`/el texto libre, todos combinables).
- `ComponentePicker` gana un botón "Filtros" a la derecha del campo de texto (no debajo — ahorra una fila). Al abrirse, muestra un panel con tres selects (Polos / Corriente (In) / Capacidad de corte), poblados al montar el componente con una llamada a `/catalogo/opciones-filtro` (scoped por las mismas `categorias` que ya recibe el picker). Los filtros elegidos se muestran además como chips removibles debajo del panel (acento rojo ABB, con "✕" para sacarlos sin reabrir el select). Cambiar cualquier filtro dispara una nueva búsqueda igual que cambiar el texto (mismo debounce/guard de solicitud obsoleta que ya existe, mismo reseteo de paginación a offset 0).
- Estética: bordes finos, fondo gris claro para el panel cuando está abierto, mayúsculas con tracking para las etiquetas — mismo lenguaje visual que el resto de la app, sin agregar colores nuevos.

## C. Mostrar código legible en vez del UUID

- `SalidaResponse` (backend) suma dos campos opcionales: `componente_codigo: str | None` y `componente_codigo_comercial: str | None`, resueltos con un lookup a `CatalogoComponente` cuando `componente_id` no es `None` (mismo patrón que ya usa `_salida_response`, solo agrega el join). Mismo tratamiento para `TableroResponse` con el `interruptor_principal_id`.
- Frontend: los tres lugares que hoy muestran `salida.componente_id`/`tablero.interruptor_principal_id` crudo pasan a mostrar `componente_codigo` (con `componente_codigo_comercial` como texto secundario si están disponibles, mismo formato que ya usa `ComponentePicker` para sus resultados: `código — descripción`). Si por algún motivo el lookup no encuentra el componente (dato huérfano), se muestra el `componente_id` crudo como fallback — nunca un campo vacío.
- Los tipos `Salida`/`Tablero` en `frontend/src/api/client.ts` se extienden con los mismos dos campos opcionales.

## D. Fix del cierre accidental de modales

- Causa raíz: todos los modales de la app cierran con `onClick={cerrarX}` en el div de fondo (`fixed inset-0 bg-black/40`). Cuando el usuario hace un drag de selección de texto dentro de un campo del modal y el `mouseup` termina fuera del modal, el navegador dispara el evento `click` sobre el ancestro común de `mousedown` y `mouseup` — que es el propio fondo — cerrando el modal aunque la intención era solo seleccionar texto.
- Fix: un hook compartido `useCerrarAlClickFuera(onClose: () => void)` en `frontend/src/hooks/` (nuevo directorio) que devuelve `{ onMouseDown, onClick }` para spreadear en el div de fondo. Solo cierra si el `mousedown` **también** ocurrió directamente sobre el fondo (`e.target === e.currentTarget` en `onMouseDown`, guardado en un ref) — no alcanza con que el `click` resuelto termine ahí.
- Se aplica en los ~8 modales existentes que usan este patrón: `ConfirmDialog`, `ComponentePicker`, el modal de Nuevo/Editar proyecto (`ProyectosPage`), los tres modales de `ProyectoWorkspacePage` (Nuevo tablero, Renombrar tablero — el de confirmar borrado ya usa `ConfirmDialog`), los cuatro de `DetalleTablero` (Icc, interruptor principal vía `ComponentePicker`, nueva fila, renombrar fila), y el de editar salida en `SeccionBlock`. Cambio mínimo por archivo: reemplazar `onClick={cerrarX}` por `{...useCerrarAlClickFuera(cerrarX)}` en el div de fondo — no toca la lógica de negocio de ningún modal.
- El comportamiento de Escape y del botón "Cancelar" explícito no cambia — este fix es específico al cierre por click en el fondo.

## Fuera de alcance de este ciclo

- Feature de accesorios de interruptor (selector visual, íconos, agente lector de manuales) — ver memoria `accesorios_interruptor_vision`, ligado a Fase D/BOM.
- Filtro por tensión — no extraída hoy, requiere regex nuevo en el parser.
- Filtro por familia/serie — reemplazado por polos/In/kA en esta iteración.
- Cualquier cambio al parser de Excel (`parser_abb.py`) — todo este ciclo trabaja con datos ya extraídos.

## Testing

- Backend: tests para `solo_con_atributos` (con y sin el parámetro, confirmando que excluye filas con `atributos IS NULL`), para cada uno de los tres filtros nuevos de `/catalogo/buscar` (`polos`, `corriente_nominal_a`, `capacidad_corte_ka`, combinables entre sí y con `categorias`/texto), y para `/catalogo/opciones-filtro` (devuelve solo valores realmente presentes, ordenados, scoped por `categorias`). Tests para `componente_codigo`/`componente_codigo_comercial` en `SalidaResponse`/`TableroResponse`, incluyendo el caso `componente_id = None` (ambos campos `None`, sin error).
- Frontend: tests para el panel de filtros en `ComponentePicker` (abre/cierra, aplica cada filtro, combina con texto, chips remueven filtros individualmente), para el display de código legible en los tres lugares (badge, modal de edición, pestaña Principal), y un test dedicado para `useCerrarAlClickFuera` (mousedown+click ambos en el fondo → cierra; mousedown en un hijo del modal + click resuelto en el fondo → NO cierra — este es el caso que reproduce el bug reportado).
