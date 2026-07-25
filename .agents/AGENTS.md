# AGENTS.md - Workspace Project Rules

## Reglas de Diseño del Esquema Unifilar (Unifilar Schematic Standards)

1. **Estructura Descriptiva del Elemento (Junto al Símbolo)**:
   - **Línea 1 (TAG de Elemento)**: Mantiene la nomenclatura única `Q101`, `Q102`, `Q103`... para termomagnéticos y `D101`, `D102`... para diferenciales en fuente **6.5mm Bold** (`12.5px`).
   - **Línea 2 (Designación de Tipo)**: Muestra el texto precedido por **ABB en color rojo** (`#DC2626`) y a continuación el modelo de designación comercial (ej. `ABB S201-C16` o `ABB F202 AC-25/0.03`) en fuente **6.0mm Bold**.
   - **Línea 3 (Código SAP)**: Muestra el código de pedido / SAP de ABB (ej. `2CDS251001R0164`) en fuente **6.0mm Normal**.
   - **Línea Eliminada**: La línea antigua de corriente y polos (`32A 2P`) queda permanentemente **eliminada** de esta sección.

2. **Reubicación de Símbolos de Polos/Fases**:
   - Los ticks/símbolos de polos tanto de las líneas **aguas arriba** como de las líneas **aguas abajo** del elemento se desplazan **10mm hacia abajo**.

3. **Símbolo de Bornes Sin Fondo de Color**:
   - El símbolo de bornera / borne de salida no posee fondo de color relleno (`fill="none"`).

4. **Eliminación de Línea Aguas Abajo del Borne**:
   - Se elimina la línea conductora que se extendía por debajo del borne de salida.

5. **Reubicación del Contenedor de Texto de Salida (+10mm Arriba)**:
   - El bloque de texto del pie (referencia de posición `F1.1`, etiqueta explicativa del circuito) se eleva **10mm hacia arriba** directamente debajo del borne.

6. **Texto Explicativo del Pie (Sin Truncar y Multi-línea)**:
   - El texto explicativo de la salida (etiqueta del circuito ingresada por el usuario) se despliega **completo sin recortarse a 15 caracteres**. Se ajusta de forma multilínea llenando el ancho del contenedor.
   - En caso de que la salida no posea etiqueta o referencia personalizada, en su lugar se despliega el texto **`Sin Referencia`** formateado en **Fuente Normal, Cursiva y Gris Atenuado** (`weight: "normal"`, `fontStyle: "italic"`, `color: "#94A3B8"`).
   - Las antiguas líneas inferiores de polos/amperaje (`32A / 2P`) y código SAP secundario quedan **eliminadas** del contenedor del pie.

7. **Símbolos DXF con Líneas de Conexión**:
   - Los símbolos de termomagnéticos y diferenciales (`abb_unif_term.dxf`) incorporan líneas de conexión de entrada (superior) y salida (inferior) que sirven como punto de empalme directo de los conductores verticalmente.
   - El símbolo de borne (`abb_unif_born.dxf`) únicamente posee línea de conexión superior. No posee conductor aguas abajo.

8. **Referencia de Ubicación (`F<fila>.<posicion>`)**:
   - La etiqueta de posición por fila y salida (ej. `F1.1`, `F1.2`, `F2.1`) se ubica en el área descriptiva del pie en fuente **6.5mm Bold** (`12.5px`) y **nunca reemplaza el TAG del elemento**.

9. **Conexión de Acometida Principal (Q1)**:
   - El interruptor principal general (Q1) se conecta de forma totalmente centrada con respecto a la línea del barral principal distribuidor.

10. **Color de Líneas de Potencia y Barral Principal**:
   - El barral / embarrado principal y las líneas de energía/potencia son de **Color Verde** (`#10B981` en CAD / `#059669` en SVG).

11. **Dots de Conexión de Ramales (-20% de tamaño)**:
   - Los nodos de conexión al embarrado se renderizan rellenos del mismo **Verde** de las líneas (`#10B981` / `#059669`) con radio compacto `r = 4.0px`.

12. **Calibres de Cables (+1mm de elevación sobre guía)**:
   - Las etiquetas de calibre del cable (superiores e inferiores) se fijan en fuente **6.0mm Bold** y se elevan **1mm por encima** de la línea guía horizontal.

13. **Contenedor Transparente de Texto al Pie**:
   - El contenedor del pie es **100% transparente sin bordes ni fondos visibles** (`fill="none"`, `stroke="none"`).
