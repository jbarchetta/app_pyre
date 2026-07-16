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

Este documento se actualiza a medida que se implementan las fases posteriores.
