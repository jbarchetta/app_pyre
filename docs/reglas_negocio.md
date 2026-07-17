# Reglas de negocio

## Alcance de esta fase
Solo tableros seccionables: interruptor principal + interruptores seccionales (con o sin disyuntor/diferencial), alimentando cargas e iluminación. Contactores, guardamotores y soft starters quedan fuera hasta v2+.

## Motor de configuración

1. El analista carga carga (kW o A) + formato (uni/bi/tetrapolar) + tipo de protección (termomagnético/diferencial) por salida.
2. Corriente nominal: si la carga está en A, se usa tal cual. Si está en kW: `kW*1000 / (tension_mono_v * cos_phi)` para uni/bipolar, `kW*1000 / (tension_tri_v * √3 * cos_phi)` para tetrapolar. `tension_mono_v` (220V), `tension_tri_v` (380V) y `cos_phi` (0.9) son configurables en `parametro_calculo`.
3. Selectividad: el nominal del interruptor aguas arriba (hoy siempre `tablero.interruptor_principal`, no hay sub-interruptores por sección) debe ser `>= nominal_propuesto * ratio_selectividad` (default 1.6, configurable). Es una regla simplificada por ratio, no una tabla de curvas de fabricante — pendiente para un ciclo posterior si se necesita mayor precisión.
4. Capacidad de corte: el componente propuesto debe tener `capacidad_corte_ka >= tablero.nivel_falla_ka`.
5. De los componentes de catálogo que cumplen tipo de protección + polos (según formato) + corriente + capacidad de corte + selectividad, se propone el de menor `precio_neto` (desempate por `codigo`). Si ninguno cumple, la salida queda sin componente propuesto (`componente_id = NULL`) y el analista lo completa manualmente (`PATCH /salidas/{id}`).

El motor asume que `catalogo_componente.atributos` tiene las claves `tipo`/`polos`/`corriente_nominal_a`/`capacidad_corte_ka` pobladas — ver nota en `diccionario_datos.md` sobre el estado del importador de ABB. Implementado en `backend/app/motor/` (`calculo.py`, `parametros.py`, `propuesta.py`) y expuesto vía `POST /secciones/{id}/salidas`, `PATCH /salidas/{id}`, `GET`/`PUT /parametros-calculo`.

## Precios
- Materiales: suma de `catalogo_componente.precio_neto` (congelado en `bom_linea.precio_unitario_congelado` al cotizar) para el interruptor principal + cada salida confirmada.
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
