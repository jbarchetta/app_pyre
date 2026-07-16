# Reglas de negocio

## Alcance de esta fase
Solo tableros seccionables: interruptor principal + interruptores seccionales (con o sin disyuntor/diferencial), alimentando cargas e iluminación. Contactores, guardamotores y soft starters quedan fuera hasta v2+.

## Motor de configuración (a implementar en el plan de Fase C)
1. El analista carga carga (kW o A) + formato (uni/bi/tetrapolar) por salida.
2. El sistema determina la corriente nominal necesaria.
3. Evalúa selectividad contra el interruptor aguas arriba de la sección.
4. Determina la capacidad de corte mínima según `tablero.nivel_falla_ka`.
5. Propone el componente de catálogo que cumple esas condiciones al menor costo; el analista confirma o cambia.

Las reglas de selectividad/capacidad de corte deben vivir como datos configurables, no como lógica hardcodeada — pendiente de tabla de reglas en el plan de Fase C.

## Precios
- Materiales: suma de `catalogo_componente.precio_vigente` (congelado en `bom_linea.precio_unitario_congelado` al cotizar) para el interruptor principal + cada salida confirmada.
- Mano de obra: estimación del proyecto completo, excluyendo gestión de compra — pendiente de definir tabla de tasas/tiempos en el plan de Fase D.
- Impuestos, costos financieros y tipo de cambio quedan fuera del sistema; el analista los calcula externamente sobre el Excel exportado.

## Roles
- **Analista**: crea/edita sus propios proyectos; puede subir/actualizar catálogo.
- **Supervisor**: además ve y revisa los proyectos de todos los analistas.
- Toda subida de catálogo queda auditada (`catalogo_precio_historial`, `audit_log`) y es visible para todos los analistas.
- Los proyectos son reasignables entre analistas sin bloqueo.

## Importación de catálogo

- Cualquiera de los dos roles (analista o supervisor) puede subir un archivo de catálogo.
- La clave de identificación de un componente es `(proveedor, codigo)`. Volver a subir un archivo con el mismo código actualiza el componente existente en vez de duplicarlo.
- Si el precio (`precio_lista` o `precio_neto`) cambió respecto al valor guardado, se escribe una fila en `catalogo_precio_historial` antes de actualizar — nunca se pierde el precio anterior.
- Toda importación queda registrada en `audit_log` con el resumen (nuevos/actualizados/sin cambios), visible para todos los analistas.
- El catálogo ABB se importa completo (todas las categorías, no solo las de tableros seccionables) para poder reutilizarse en otros proyectos de PYRE. La jerarquía de categorías (`categoria_path`) se parsea automáticamente desde el formato visual del Excel de ABB (tamaño/negrita de fuente) — funciona de forma verificada para interruptores termomagnéticos y diferenciales; en categorías menos usadas por ahora (contactores, UPS, relés, accesorios) el parseo es "mejor esfuerzo" y se corrige cuando una fase futura empiece a usarlas.
- Celdas de precio no numéricas (ej. `"Consultar"` en ABB, `"#DIV/0!"` en el archivo de otros materiales — confirmado contra los archivos reales: ~0.5% de las filas de ABB y ~10% de las filas de otros materiales) se importan igual, con el precio en `NULL`, en vez de abortar toda la importación — el sistema registra un warning en el log del backend por cada celda así, pero no bloquea el resto del archivo.

Este documento se actualiza a medida que se implementan las fases posteriores.
