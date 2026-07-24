# AGENTS.md - Workspace Project Rules

## Reglas de Diseño del Esquema Unifilar (Unifilar Schematic Standards)

1. **Estructura Descriptiva del Elemento (Junto al Símbolo)**:
   - **Línea 1 (TAG de Elemento)**: Mantiene la nomenclatura única `Q101`, `Q102`, `Q103`... para termomagnéticos y `D101`, `D102`... para diferenciales en fuente **6.5mm Bold** (`12.5px`).
   - **Línea 2 (Designación de Tipo)**: Muestra el texto precedido por **ABB en color rojo** (`#DC2626`) y a continuación el modelo de designación comercial (ej. `ABB S201-C16` o `ABB F202 AC-25/0.03`) en fuente **6.0mm Bold**.
   - **Línea 3 (Código SAP)**: Muestra el código de pedido / SAP de ABB (ej. `2CDS251001R0164`) en fuente **6.0mm Normal**.
   - **Línea Eliminada**: La línea antigua de corriente y polos (`32A 2P`) queda permanentemente **eliminada** de esta sección.

2. **Referencia de Ubicación (`F<fila>.<posicion>`)**:
   - La etiqueta de posición por fila y salida (ej. `F1.1`, `F1.2`, `F2.1`) se ubica únicamente en el área descriptiva al pie de cada salida en fuente **6.5mm Bold** (`12.5px`) y **nunca reemplaza el TAG del elemento**.

3. **Conexión de Acometida Principal (Q1)**:
   - El interruptor principal general (Q1) se conecta de forma totalmente centrada con respecto a la línea del barral principal distribuidor.

4. **Color de Líneas de Potencia y Barral Principal**:
   - El barral / embarrado principal y las líneas de energía/potencia son de **Color Verde** (`#10B981` en CAD / `#059669` en SVG).

5. **Dots de Conexión de Ramales (-20% de tamaño)**:
   - Los nodos de conexión al embarrado se renderizan rellenos del mismo **Verde** de las líneas (`#10B981` / `#059669`) con radio compacto `r = 4.0px`.

6. **Calibres de Cables (+1mm de elevación sobre guía)**:
   - Las etiquetas de calibre del cable (superiores e inferiores) se fijan en fuente **6.0mm Bold** y se elevan **1mm por encima** de la línea guía horizontal.

7. **Contenedor Transparente de Texto al Pie**:
   - El contenedor del pie es **100% transparente sin bordes ni fondos visibles** (`fill="none"`, `stroke="none"`).
