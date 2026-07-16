# Diccionario de datos

Ver el modelo completo en `backend/app/models/`. Resumen de cada tabla y su propósito:

- **usuario** — cuentas del sistema. `rol` es `analista` o `supervisor`. Ambos roles pueden subir catálogo.
- **proyecto** — un proyecto de cliente. `analista_id` es el propietario actual (reasignable). El supervisor ve todos.
- **tablero** — un tablero dentro de un proyecto. `nivel_falla_ka` es el Icc del punto de instalación, usado por el motor de configuración para calcular capacidad de corte mínima de cada salida.
- **seccion** — módulo/columna física de un tablero.
- **salida** — una "necesidad" cargada por el analista o propuesta por el agente de IA (`origen`). Nunca se considera confirmada hasta que `origen` es `manual` o `ia_confirmada`.
- **bom_linea** — línea de BOM derivada de las salidas confirmadas. `precio_unitario_congelado` fija el precio al momento de cotizar, independiente de cambios posteriores del catálogo.
- **catalogo_componente** — catálogo de componentes (ABB + otros proveedores), con dimensiones en mm para el esquema visual.
- **catalogo_precio_historial** — todo cambio de precio de catálogo, auditado.
- **extraccion_cad** — resultado crudo de una extracción de IA sobre un archivo CAD/PDF, pendiente de revisión por un analista.
- **audit_log** — trazabilidad genérica de acciones sobre catálogo/proyectos/BOM.

Este documento se actualiza a medida que se agregan tablas/columnas en fases posteriores.
