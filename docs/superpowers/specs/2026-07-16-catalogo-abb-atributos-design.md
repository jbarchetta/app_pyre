# Poblar atributos del catálogo ABB (Fase C, ciclo 3)

## Alcance de este ciclo

Extender el importador de catálogo de ABB (Fase B, `backend/app/catalogo/parser_abb.py`) para que derive las specs eléctricas del interruptor (`tipo`, `polos`, `corriente_nominal_a`, `capacidad_corte_ka`) a partir del texto real del Excel (`categoria_path`/`descripcion`) y las guarde en `catalogo_componente.atributos`. Hoy ese campo queda vacío para todo lo importado desde Fase B — el motor de configuración (Fase C ciclo 1) lo asume poblado pero nada lo llena. Este ciclo cierra esa brecha, usando los archivos reales de `samples/catalogo/` (no el Excel de costeo confidencial) como referencia para diseñar y probar el parseo.

**Fuera de alcance:** BOM, esquema visual, UI del configurador (siguen en pausa, según lo acordado). `parser_otros.py` (materiales no-ABB) no se toca — el concepto de `tipo_proteccion` es específico de interruptores.

## Categorías del catálogo real de ABB

Investigando el Excel real (`R-IN-003 ABB...xlsx`, no confidencial) encontré que "interruptor" no es una categoría homogénea — hay familias con formatos de texto distintos y con datos disponibles distintos:

| Categoría raíz | Formato de descripción | Capacidad de corte disponible | Alcance |
|---|---|---|---|
| `Interruptores Termomagnéticos` (+ variantes "con/sin posibilidad de accesorios") | `"Interruptor termomagnético {formato} In {N}A Icn = {X}kA @ ..."` | Sí (Icn, a veces también Icu) | **Sí** → `tipo=seccional_termomagnetico` |
| `Interruptores termomagnéticos con protección diferencial` | `"...{formato} In={N}, {X}kA, curva {C}, Sens={N}mA"` | Sí (en `categoria_path[1]`, ej. `"hasta 6kA"`) | **Sí** → `tipo=seccional_diferencial` |
| `Interruptores automáticos en caja moldeada` (MCCB) | `"Interruptor Tmax XT {formato} In = {N}A - Icu = {X}kA, ..."` | Sí (Icu) | **Sí** → `tipo=seccional_termomagnetico` (candidatos a interruptor principal, confirmado con el usuario) |
| `Interruptores Diferenciales` (puros) | `"Interruptor diferencial {formato} In {N}A. Sens = {N} mA"` | **No** — solo sensibilidad, sin Icn/Icu en ningún lado | No — queda sin `atributos` |
| `Interruptores abiertos en aire` (ACB), `Seccionador de Línea`, `Fusibles y seccionadores`, `Contactores`, `Arrancadores suaves`, resto | — | — | No — fuera del alcance v1 de "tableros seccionables" (`reglas_negocio.md`) o no son interruptores con capacidad de corte |

Para `seccional_diferencial`, el motor usa la familia combinada (termomagnético+diferencial) porque es la única que trae capacidad de corte real. Los diferenciales puros quedan sin `atributos` — el analista los sigue pudiendo buscar y elegir a mano (`ComponentePicker`), pero el motor nunca los propone automáticamente porque no puede validar que cumplan el nivel de falla del tablero.

## Reglas de extracción

Tres familias, tres extractores (mismo criterio "mejor esfuerzo" que ya usa el resto del importador — si una fila de una categoría en-alcance no matchea, queda sin `atributos` y se loguea un warning, sin abortar el import):

**1. Termomagnéticos modulares + MCCB** (comparten patrón):
- `polos`: del último nivel de `categoria_path` — `Unipolares?`→1, `Bipolares?`→2, `Tripolares?`→3, `Tetrapolares?`→4 (case-insensitive, tolerante a sufijos como `"Tripolares (3p)"` de MCCB).
- `corriente_nominal_a`: regex `In\s*=?\s*(\d+(?:[.,]\d+)?)\s*A?` sobre la descripción. **Nota real encontrada:** algunas filas de la variante "sin accesorios" tienen un typo del proveedor sin espacio (`"Interruptortermomagnético"`) — el regex no depende de matchear ese prefijo literal, solo busca el patrón `In ...`.
- `capacidad_corte_ka`: regex `Ic[nu]\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*kA`, buscando **todas** las ocurrencias (la variante "con accesorios" trae Icn *e* Icu en la misma descripción) y tomando el **valor menor** — más conservador para no sobrestimar la capacidad real del componente.
- Las comas decimales (`4,5kA`) se normalizan a punto antes de convertir a `Decimal`.

**2. Combo termomagnético+diferencial:**
- `polos`: de la descripción (esta familia no lo pone en `categoria_path`) — mismo patrón de palabras que arriba.
- `corriente_nominal_a`: regex `In\s*=\s*(\d+(?:[.,]\d+)?)`.
- `capacidad_corte_ka`: del segundo nivel de `categoria_path` (ej. `"hasta 6kA"` → regex `(\d+(?:[.,]\d+)?)\s*kA`) — más confiable que parsear el número suelto en la descripción.

**3. Todo lo demás:** `atributos = None`, sin excepción ni warning (categorías fuera de alcance, no es un error).

## Arquitectura

Se extiende `parser_abb.py`, no se agrega un script de backfill aparte:

- `ComponenteImportado` (`app/catalogo/types.py`) gana un campo `atributos: dict | None`.
- Nueva función `_extraer_atributos(categoria_path: list[str], descripcion: str) -> dict | None` en `parser_abb.py`, con un dispatch por familia (matchea `categoria_path[0]` contra las tres reglas de arriba).
- `_build_componente` la llama y setea `atributos` en el `ComponenteImportado` resultante.
- `upsert_componentes` (`app/catalogo/upsert.py`) ya tiene un campo `atributos` en el modelo `CatalogoComponente` — solo hace falta que copie `item.atributos` al crear/actualizar (hoy no lo toca porque `ComponenteImportado` nunca lo traía).

Ventaja de este enfoque sobre un backfill separado: cada reimportación del catálogo (que ya pasa por acá para actualizar precios) re-deriva los atributos frescos — no hay un segundo proceso que se pueda desincronizar del parser.

## Testing

- **Unitario** sobre `_extraer_atributos`, con fixtures tomados de filas reales (sin copiar el archivo, solo los strings de categoria_path/descripcion): las 4 variantes de polos en modulares, la variante "con accesorios" con Icn+Icu simultáneos (verifica que toma el menor), el typo sin espacio, el combo termomagnético+diferencial, MCCB con "Icu", coma decimal, y categorías fuera de alcance (diferencial puro, seccionador) devolviendo `None`.
- **Integración**: extender `test_parser_abb.py` (ya usa un workbook sintético en memoria, mismo patrón) para verificar que `atributos` sale poblado en el resultado de `parse_abb_workbook`.
- **Upsert**: extender `test_upsert_catalogo.py` para verificar que `atributos` se guarda y se actualiza en reimportaciones.
- **Verificación manual** (no automatizada, el archivo es confidencial/pesado): correr `parse_abb_workbook` contra el Excel real de `samples/catalogo/` y confirmar que la proporción de filas con `atributos` poblado en las categorías en-alcance es alta y los valores son razonables.

## Documentación a actualizar

- `docs/diccionario_datos.md`: la nota sobre `atributos` deja de decir "el importador todavía no lo puebla" — pasa a documentar el contrato real y qué categorías quedan sin poblar y por qué.
- `docs/reglas_negocio.md`: agregar una sección breve listando las categorías de ABB en/fuera de alcance para el motor.
