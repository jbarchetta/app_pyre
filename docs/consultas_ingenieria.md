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

## Resueltas

_(ninguna todavía)_
