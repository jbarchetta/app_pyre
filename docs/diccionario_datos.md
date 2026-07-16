# Diccionario de datos

Ver el modelo completo en `backend/app/models/`. Resumen de cada tabla y su propósito:

- **usuario** — cuentas del sistema. `rol` es `analista` o `supervisor`. Ambos roles pueden subir catálogo.
- **proyecto** — un proyecto de cliente. `analista_id` es el propietario actual (reasignable). El supervisor ve todos.
- **tablero** — un tablero dentro de un proyecto. `nivel_falla_ka` es el Icc del punto de instalación, usado por el motor de configuración para calcular capacidad de corte mínima de cada salida.
- **seccion** — módulo/columna física de un tablero.
- **salida** — una "necesidad" cargada por el analista o propuesta por el agente de IA (`origen`). Nunca se considera confirmada hasta que `origen` es `manual` o `ia_confirmada`.
- **bom_linea** — línea de BOM derivada de las salidas confirmadas. `precio_unitario_congelado` fija el precio al momento de cotizar, independiente de cambios posteriores del catálogo.
- **catalogo_componente** — catálogo de componentes de cualquier proveedor (ABB, y proveedores de otros materiales como barras de cobre, conductores, gabinetes, etc.). Esquema flexible: `categoria_path` guarda el camino completo de categorización tal como aparece en el Excel origen (ej. `["Interruptores Termomagnéticos", "SH200 L", "Curva C - Icn: 4,5kA (IEC 60898)", "Unipolares"]`), `categoria_raiz` es el primer nivel (indexado, para filtrar rápido). `precio_neto` es el precio que usa por defecto el motor de configuración; `precio_lista` se guarda de referencia. `atributos` es un campo JSON reservado para specs eléctricas (polos, corriente nominal, capacidad de corte) que **todavía no se completa en esta fase** — lo puebla el motor de configuración de la fase siguiente. `archivo_origen`/`fila_origen` trazan cada registro a la celda del Excel del que vino. `precio_lista`/`precio_neto` en `NULL` es un estado sobrecargado — puede significar que la celda origen estaba genuinamente vacía, o que contenía un valor no numérico como `"Consultar"` (precio a consultar de ABB) o un resultado de fórmula rota de Excel como `"#DIV/0!"`; el parser trata los tres casos por igual como "sin precio utilizable", registrando un warning para los dos últimos casos pero sin distinguirlos en los datos guardados. Un futuro mantenedor no debería asumir que `NULL` siempre significa que el proveedor no tiene precio para ese SKU.
- **catalogo_precio_historial** — todo cambio de precio de catálogo, auditado.
- **extraccion_cad** — resultado crudo de una extracción de IA sobre un archivo CAD/PDF, pendiente de revisión por un analista.
- **audit_log** — trazabilidad genérica de acciones sobre catálogo/proyectos/BOM.

Este documento se actualiza a medida que se agregan tablas/columnas en fases posteriores.
