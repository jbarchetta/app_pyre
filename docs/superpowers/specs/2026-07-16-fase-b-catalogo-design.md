# Fase B — Catálogo: Diseño

## Contexto

Fase A dejó un esquema `catalogo_componente` rígido (pensado solo para interruptores: `tipo` enum, `polos`/`corriente_nominal_a`/`capacidad_corte_ka`/`ancho_mm`/`alto_mm` todos NOT NULL). Al inspeccionar los archivos reales que PYRE va a subir, quedó claro que ese esquema no alcanza:

- **`R-IN-003 ABB 2026 06 - 26-XXX-XXX V1.xlsx`** (pestaña `Lista de Precios 202606`, único tab relevante — el resto son de manejo interno de ABB): 12.207 filas / 25 columnas, con **todo** el catálogo comercial de ABB en Argentina — interruptores termomagnéticos, diferenciales, contactores, arrancadores suaves, UPS, relés de protección, accesorios, etc. No es una tabla plana: es una jerarquía de hasta 4-5 niveles (categoría → familia → curva/capacidad de corte → polos → a veces un código de sub-familia) marcada visualmente por tamaño y negrita de fuente en la celda, no por columnas.
- **`1-Lista de Precios 2025.xlsx`** (pestaña `Lista de Precios`): catálogo de materiales no-ABB — Barras de Distribución (cobre, con precio calculado desde peso×precio del cobre×scrap), Conductores, Terminales, Accesorios Tableros, Canalizaciones, Bandejas, Instalaciones Eléctricas, Gabinetes. Misma lógica de jerarquía por posición de columna (categoría en columna A, sub-familia en columna B, luego una fila de encabezados local `Cod/Unidad/Descripcion/...` que puede variar de layout entre secciones) en vez de un layout fijo.
- **`TABLA POLOS TABLEROS SECC. CON CAMBIOS.xlsx`**: parece ser la herramienta interna actual de costeo (pestañas MAT/MO por tipo de tablero). Por pedido explícito del usuario, **no se analiza en esta fase** — queda para más adelante, probablemente relevante para Fase C/D.

Decisión del usuario: administrar el catálogo ABB **completo** (los 12.207 registros, con su jerarquía), no solo lo que necesita el MVP de tableros seccionables — para poder reutilizarlo en otros proyectos de PYRE más adelante. El motor de configuración de fases posteriores va a filtrar sobre esta base ya consolidada, no al revés.

## Riesgo aceptado

El parseo de jerarquía por firma de fuente (tamaño + negrita) funciona de forma limpia y verificada en las secciones de interruptores termomagnéticos (las relevantes para el MVP). Sobre el resto del catálogo (contactores, UPS, relés, accesorios — con estilos de sección menos consistentes) el parser aplica el mismo algoritmo general pero **no se valida fila por fila** en esta fase, dado que nada del sistema consulta esas categorías todavía. Es una importación "mejor esfuerzo" para esas zonas: si alguna categoría queda con un `categoria_path` imperfecto, se corrige cuando la fase que la necesite (v2: contactores/guardamotores) la use por primera vez, sin necesidad de rediseñar el importador.

## Modelo de datos (reemplaza `catalogo_componente` de Fase A)

```
catalogo_componente
  id                uuid pk
  proveedor         string        -- "ABB", "MENDOCOBRE", etc. (texto libre, no enum)
  codigo            string        -- Codigo SAP (ABB) / Cod (otros materiales)
  codigo_comercial  string null   -- Codigo Comercial (solo ABB)
  categoria_path    jsonb         -- ["Interruptores Termomagnéticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Unipolares"]
  categoria_raiz    string        -- primer elemento de categoria_path, indexado
  descripcion       text
  unidad            string        -- "Unidad" / "Mts" / "Kg"
  precio_lista      numeric null
  precio_neto       numeric null  -- precio "vigente" por defecto para el motor de configuración
  atributos         jsonb null    -- specs que varían por tipo (polos, corriente_nominal_a, capacidad_corte_ka, curva, peso_kg_m, etc.); columna reservada en Fase B, sin popular — la extracción de estos valores desde la descripción/breadcrumb es responsabilidad de Fase C (motor de configuración), que es quien primero los necesita y quien mejor sabe qué formato le sirve para matchear
  archivo_origen    string        -- nombre del archivo importado (trazabilidad)
  fila_origen       integer       -- número de fila en el Excel origen
  vigente_desde     timestamptz

  unique(proveedor, codigo)

catalogo_precio_historial   -- sin cambios de Fase A: componente_id, precio_anterior, precio_nuevo, usuario_id, creado_en
```

`unique(proveedor, codigo)` es la clave de upsert: re-importar el mismo archivo actualiza precios existentes (con historial) e inserta los códigos nuevos, sin duplicar.

## Algoritmo de jerarquía — ABB (por firma de fuente)

Se mantiene una pila `path: list[(firma, texto)]` mientras se recorre la hoja fila por fila:

- Fila con columna A vacía y columna B con texto → es una fila de **encabezado de sección**. Su firma es `(tamaño_fuente, negrita)` de la celda B.
  - Si esa firma ya está en `path` en la posición *i* → la sección "vuelve" a ese nivel: `path = path[:i] + [(firma, texto)]` (se descarta todo lo más profundo).
  - Si la firma es nueva → se agrega al final de `path` (nuevo nivel, más profundo).
- Fila con columna A no vacía → es una **fila de producto**. `categoria_path = [texto for (firma, texto) in path]` en ese momento; se lee el resto de columnas por **nombre de encabezado** (mapeado desde la fila 1), no por posición fija, para tolerar que ABB reordene columnas en futuras versiones.

## Algoritmo de jerarquía — otros materiales (por posición de columna + encabezado local)

- Columna A con texto → nueva categoría de nivel 1 (`categoria_raiz`), resetea el estado de sección.
- Columna A vacía, columna B con texto que sea exactamente `"Cod"` → fila de **encabezado de datos**: se captura el mapeo columna→etiqueta desde esa fila (varía de layout entre secciones — Barras de Distribución usa columnas distintas a Accesorios Tableros) y el estado pasa a "leyendo datos".
- Columna A vacía, columna B con texto, estado todavía no es "leyendo datos" → es una etiqueta de sub-familia (ej. "Cable Canal Ranurado"); se guarda como el segundo nivel de `categoria_path` y se sigue esperando el encabezado.
- Columna A vacía, columna B con texto, estado "leyendo datos" → fila de producto; se lee por el mapeo de columnas capturado.
- Secciones sin fila `"Cod"` (ej. "Gabinetes", que en el archivo real solo tiene notas de texto libre) no producen filas de producto — se registra en el resultado del import cuántas filas de esa categoría se pudieron parsear, para que quede visible que necesita carga manual.

`precio_neto` para otros materiales = columna `"Total U$S)"` (ya resuelta a USD por la planilla, sea que la fuente haya sido en pesos o dólares). `precio_lista` = columna `"Precio Lista ((U$S)"` cuando está presente (puede quedar null).

## Import: flujo y endpoint

Dado que todo el archivo (12.207 filas + fuente) parsea en ~1.3s, **no hace falta cola de tareas** — el import corre síncrono dentro del request HTTP (evita levantar Redis/Celery antes de que el agente de extracción CAD/PDF los necesite de verdad, YAGNI).

`POST /catalogo/importar` (rol analista o supervisor, ambos pueden subir):
1. Recibe el `.xlsx` subido + un campo `proveedor` que determina qué parser usar (`abb` o `otros`).
2. Parsea a una lista de filas candidatas en memoria.
3. Por cada fila: upsert por `(proveedor, codigo)`. Si el precio cambió respecto al valor existente, escribe `catalogo_precio_historial`. Si es código nuevo, inserta.
4. Devuelve un resumen: `{ total_filas, nuevos, actualizados, sin_cambios, categorias_sin_datos: [...] }` — este resumen se guarda también en `audit_log` (usuario + timestamp + resumen), visible para todos los analistas.

## Fuera de alcance de esta fase

- Recalcular en vivo la fórmula de precio de las Barras de Distribución (peso × precio del cobre × tipo de cambio) — se toma el valor `Total` tal cual está en la celda, como pidió el usuario ("por ahora tomaremos esos valores tal cual están").
- Cualquier lógica que use `atributos` (polos, corriente nominal, capacidad de corte) para matching automático — eso es Fase C (motor de configuración). Fase B solo administra el catálogo.
- El archivo `TABLA POLOS TABLEROS SECC.` — se revisa en una fase posterior.
