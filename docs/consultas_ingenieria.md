# Consultas pendientes para ingeniería de PYRE

Preguntas técnicas/de negocio encontradas durante el desarrollo que requieren el criterio de un ingeniero eléctrico de PYRE, no de quien esté programando el sistema. Se resuelven a medida que haya oportunidad de consultar, y la resolución se documenta en `reglas_negocio.md` (no acá).

## Abiertas

### 1. "Parte interruptiva" de MCCB (Tmax XT) — ¿SKU completo o requiere carcasa aparte?

**Encontrado:** 2026-07-17, al medir la cobertura de la extracción de atributos del catálogo ABB (`docs/superpowers/plans/2026-07-16-catalogo-abb-atributos-implementation-plan.md`, Task 5).

**Contexto:** Dentro de `Interruptores automáticos en caja moldeada` → `SACE Tmax XT` → `Partes interruptivas - Ejecución fija (F) - Teminales anteriores (F)`, hay filas como:

> `Parte interruptiva Tmax XT2N tripolar In = 160A 36KA  ejecución fija`

Tienen polos, corriente nominal y capacidad de corte (los tres datos que necesita el motor de configuración), pero el nombre del producto dice explícitamente "parte interruptiva" — sugiere que podría ser solo un componente interno (el mecanismo de disparo) que necesita una carcasa/base aparte para ser un interruptor instalable completo, no un producto que se pueda cotizar y montar solo.

**Por qué importa:** Son ~1.925 de las 2.046 filas del catálogo real que hoy quedan sin `atributos` poblados (la mayor parte del hueco de cobertura). Si son productos completos, el motor de configuración podría empezar a proponerlos ya mismo ampliando una regex. Si no lo son, proponerlos automáticamente sería un error real — el analista terminaría con un componente que no se puede instalar solo.

**Qué se necesita:** Confirmación de un ingeniero de PYRE: ¿una "parte interruptiva" Tmax XT se cotiza/monta sola, o siempre requiere un código de carcasa/base aparte del mismo catálogo? Si requiere otra pieza, ¿cómo se relacionan los dos códigos en el Excel (por familia/modelo, ej. "XT2N")?

**Mientras tanto:** el parser (`parser_abb.py`) no extrae `atributos` para estas filas — quedan sin match, el analista las puede seguir buscando y cargando a mano vía `ComponentePicker`.

### 2. Filtro de "regulación" (rango de regulación térmica/magnética ajustable) — no hay dato extraíble en el catálogo actual

**Encontrado:** 2026-07-18, durante el brainstorming del ciclo de UX de CRUD/Filas/buscador (`docs/superpowers/specs/2026-07-18-workspace-crud-filas-design.md`).

**Contexto:** El usuario pidió poder filtrar la búsqueda de interruptores por "regulación" además de polos/In, junto a SAP/código comercial/descripción. Se corrió una extracción real contra el catálogo completo de ABB (9.062 filas) usando el parser existente (`parser_abb.py`) para confirmar si ese dato existe como texto en las descripciones: no aparece en ninguna de las 3.837 filas de interruptores en alcance. El único lugar donde aparece la palabra "regulación" es en accesorios no relacionados (ej. bloqueo de regulación, tiempo de un relé diferencial), no como un rango numérico asociado al interruptor mismo.

**Por qué importa:** Sin un dato extraíble, cualquier filtro de "regulación" tendría que basarse en otra fuente (una tabla técnica de ABB distinta a la lista de precios actual, o carga manual por el analista) — no se puede resolver ampliando la regex del parser como se hizo con polos/In/capacidad de corte.

**Qué se necesita:** Confirmación de un ingeniero de PYRE: ¿existe una fuente de datos de ABB (tabla técnica, ficha de producto, u otro documento) que liste el rango de regulación ajustable por modelo de interruptor? Si existe, ¿en qué formato, y se puede importar/cruzar por código de producto?

**Mientras tanto:** el buscador de catálogo (`ComponentePicker` + `GET /catalogo/buscar`) solo filtra por texto libre (código/código comercial/descripción) y por categoría (`categorias`) — no hay filtro estructurado por polos/In/regulación en este ciclo.

### 3. Asignación manual que queda inconsistente con la carga — ¿advertir al analista?

**Encontrado:** 2026-07-19, durante el ciclo 8 de hardening (spec `docs/superpowers/specs/2026-07-19-fase-c-hardening-seguridad-performance-design.md` → "Decisión explícita"), vía tests incidentales que codificaban el comportamiento contrario.

**Contexto:** cuando una salida tiene componente asignado manualmente (`asignado_manualmente = true`), cambios posteriores de carga/formato/protección **no** disparan recálculo ni validación: el componente manual se conserva siempre. Es el comportamiento deliberado del ciclo de asignación manual ("el analista manda"), pero tiene un riesgo eléctrico real: el analista puede asignar manualmente un interruptor de 20A a una carga de 10A, luego corregir la carga a 32A, y el sistema conserva silenciosamente un interruptor subdimensionado (tampoco valida capacidad de corte ni selectividad de las asignaciones manuales).

**Por qué importa:** una propuesta automática siempre cumple corriente/corte/selectividad; una asignación manual puede dejar de cumplirlas sin que nadie se entere. El BOM heredaría el componente incorrecto.

**Qué se necesita:** decisión de PYRE (producto + criterio eléctrico). Opciones: (a) comportamiento actual — el sistema nunca cuestiona al analista; (b) marcar la salida con un flag/badge "inconsistente con la carga actual" en la API y la tabla, **sin** tocar el componente — el analista decide; (c) advertir en el momento del cambio de carga ("la asignación manual X no cubre 32A, ¿recalcular o conservar?"). La opción (b) es la de menor fricción y la recomendada por defecto si no hay objeción.

**Mientras tanto:** se mantiene el comportamiento actual (el componente manual se conserva siempre, sin validación ni advertencia).

## Resueltas

_(ninguna todavía)_
