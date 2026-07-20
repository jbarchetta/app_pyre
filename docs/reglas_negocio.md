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

### Referencia: metodología interna de costeo de PYRE (para Fase D y BOM)

`samples/catalogo/TABLA POLOS TABLEROS SECC. CON CAMBIOS.xlsx` (confidencial, gitignored) es la planilla que PYRE usa hoy a mano para costear tableros. No se analizó su contenido numérico en detalle (son datos internos de costeo), pero su **estructura** es relevante para fases futuras:

- **Hoja `MAT`**: 5 tablas (TABLA 0 a TABLA 4) que calculan cable/barra/terminales/etiquetas necesarios según el calibre (corriente nominal) del interruptor aguas arriba, para cada tramo de la instalación (cabecera→barra, barra→disyuntor, disyuntor→térmica, térmica→bornera, barra→térmica directo). Implica que el **BOM no puede limitarse a los interruptores** — cada salida confirmada también genera línea(s) de cable/terminal/etiqueta derivadas de su calibre. Pendiente de diseñar en el ciclo de BOM de Fase C.
- **Hojas `MO IT 1` a `MO IT 8/9`**: tiempos de mano de obra (minutos) por tarea — armado de gabinete, montaje de componentes, armado de barras (acometida y distribución), cableado de distribución, cableado de comando/instrumentación, ensayos FAT, documentación. Es la base real para la "tabla de tasas/tiempos configurable" que Fase D necesita — conviene revisarla junto al usuario al planear esa fase, en vez de inventar una estructura desde cero.
- **Hoja `GRAFICO`**: contiene un diagrama unifilar (imagen) de referencia — confirmado con el usuario que **no** es el modelo a seguir para el "esquema visual" del sistema (ver más abajo).

### Pendiente: cascada de borrado de `bom_linea` cuando arranque el BOM

`BomLinea.tablero_id` (`backend/app/models/tablero.py`) es `ForeignKey("tablero.id")` `NOT NULL`, sin `ondelete` en el esquema y sin cascada ORM. Los borrados en cascada de `eliminar_proyecto` (`backend/app/routers/proyectos.py`) y `eliminar_tablero` (`backend/app/routers/tableros.py`) hoy no tocan `bom_linea` porque **todavía no hay ningún router que escriba filas ahí** (BOM sigue "Falta" en el estado de Fase C de `CLAUDE.md`). En cuanto el ciclo de BOM empiece a persistir `bom_linea`, ambos endpoints van a necesitar un paso `db.query(BomLinea).filter(BomLinea.tablero_id.in_(...)).delete(...)` **antes** de los deletes existentes de `seccion`/`salida` (mismo patrón hijo-a-padre), o el borrado de un tablero/proyecto con BOM generado va a explotar con `IntegrityError` (500) sin manejar. No es un bug hoy — es un recordatorio para no perderlo al diseñar el ciclo de BOM.

### Esquema visual (aclaración de alcance)

El "esquema visual" del roadmap (`configurador-tableros-design.md`) es deliberadamente simple: un bloque proporcional por salida, dimensionado según su formato (ej. termomagnética bipolar = cuadrado de 2 unidades, tetrapolar = 4 unidades; interruptores principales/mayores = cuadrado más grande), apilado dentro de su sección. El objetivo es ayudar al analista a orientarse visualmente sobre el formato físico que está tomando el tablero mientras lo carga — **no** es un diagrama unifilar eléctrico completo (confirmado explícitamente: no se sigue el estilo de la hoja `GRAFICO` del Excel de costeo).

## Roles
- **Analista**: crea/edita sus propios proyectos; puede subir/actualizar catálogo.
- **Supervisor**: además ve y revisa los proyectos de todos los analistas.
- Toda subida de catálogo queda auditada (`catalogo_precio_historial`, `audit_log`) y es visible para todos los analistas.
- Los proyectos son reasignables entre analistas sin bloqueo.

### Autorización por propiedad (enforced desde ciclo 8)

La regla "el analista opera **sus propios** proyectos" está enforceada en el backend (`backend/app/auth/ownership.py`):

- `GET /proyectos` devuelve solo los proyectos del analista autenticado; el supervisor recibe la lista completa.
- Cualquier `GET`/`PATCH`/`POST`/`DELETE` sobre un proyecto ajeno — o sobre un recurso anidado de un proyecto ajeno (tablero → sección → salida, resuelto por cadena de padres) — devuelve **403** al analista; el supervisor accede sin restricción.
- La **reasignación** se hace con `PATCH /proyectos/{id}` + `analista_id` y es **exclusiva del supervisor** (un analista no puede ceder su proyecto ni tomar uno ajeno). El `analista_id` destino debe ser un usuario existente con rol `analista` (400 si no).

### Contraseñas y eventos de seguridad (enforced desde ciclo 9)

- `create_user` rechaza contraseñas de menos de 8 caracteres (`ValueError`) — sin requisito de complejidad (mayúsculas/números/símbolos): sistema interno, usuarios creados solo por supervisión. Único punto de entrada de contraseñas hoy (no hay endpoint de cambio de password).
- Cada login exitoso o fallido queda auditado en `audit_log` (`accion="login_exitoso"`/`"login_fallido"`, `entidad="usuario"`, `entidad_id=email intentado`). La contraseña intentada nunca se persiste. Un login fallido **no distingue** "el email no existe" de "la password es incorrecta" (mismo evento genérico, `usuario_id` null cuando el email no corresponde a ningún usuario) — evita filtrar qué cuentas existen.
- Cada acceso denegado por propiedad (403 de `ownership.py`) queda auditado como `acceso_denegado_propiedad`, con `entidad="proyecto"` y el id del proyecto — el evento se commitea antes de levantar el 403, así que la request sigue devolviendo 403 aunque el commit del log falle por otra razón.

## Importación de catálogo

- Cualquiera de los dos roles (analista o supervisor) puede subir un archivo de catálogo.
- La clave de identificación de un componente es `(proveedor, codigo)`. Volver a subir un archivo con el mismo código actualiza el componente existente en vez de duplicarlo.
- Si el precio (`precio_lista` o `precio_neto`) cambió respecto al valor guardado, se escribe una fila en `catalogo_precio_historial` antes de actualizar — nunca se pierde el precio anterior.
- Toda importación queda registrada en `audit_log` con el resumen (nuevos/actualizados/sin cambios), visible para todos los analistas.
- El catálogo ABB se importa completo (todas las categorías, no solo las de tableros seccionables) para poder reutilizarse en otros proyectos de PYRE. La jerarquía de categorías (`categoria_path`) se parsea automáticamente desde el formato visual del Excel de ABB (tamaño/negrita de fuente) — funciona de forma verificada para interruptores termomagnéticos y diferenciales; en categorías menos usadas por ahora (contactores, UPS, relés, accesorios) el parseo es "mejor esfuerzo" y se corrige cuando una fase futura empiece a usarlas.
- Celdas de precio no numéricas (ej. `"Consultar"` en ABB, `"#DIV/0!"` en el archivo de otros materiales — confirmado contra los archivos reales: ~0.5% de las filas de ABB y ~10% de las filas de otros materiales) se importan igual, con el precio en `NULL`, en vez de abortar toda la importación — el sistema registra un warning en el log del backend por cada celda así, pero no bloquea el resto del archivo.

### Categorías de ABB en alcance del motor de configuración

El motor solo puede proponer componentes de estas categorías (`categoria_path[0]` del catálogo ABB) porque son las únicas con capacidad de corte (Icn/Icu) disponible de forma consistente en el Excel real de ABB:

- `Interruptores Termomagnéticos` (y las variantes "con"/"sin posibilidad de utilizar accesorios") → `tipo=seccional_termomagnetico`.
- `Interruptores automáticos en caja moldeada` (MCCB, familia Tmax XT) → `tipo=seccional_termomagnetico`, típicamente los candidatos a interruptor principal por su corriente/capacidad de corte mayor. **Excepción dentro de esta categoría:** las subcategorías `Partes interruptivas` (repuestos del mecanismo de disparo, sin carcasa) y `Relés electrónicos avanzados` (accesorios de protección) quedan deliberadamente sin `atributos` — ver `docs/consultas_ingenieria.md` #1, todavía no está confirmado con ingeniería si una "parte interruptiva" es un producto instalable por sí sola.
- `Interruptores termomagnéticos con protección diferencial` → `tipo=seccional_diferencial`.

`Interruptores Diferenciales` (puros) quedan fuera: el Excel real nunca trae Icn/Icu para esa familia, solo sensibilidad (mA) — no hay forma de validar que cumplan el nivel de falla del tablero. El analista los sigue pudiendo cargar manualmente.

Este documento se actualiza a medida que se implementan las fases posteriores.
