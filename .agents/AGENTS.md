# AGENTS.md - Workspace Project Rules

## Reglas de Diseño del Esquema Unifilar (Unifilar Schematic Standards)

1. **TAG de Elementos vs Referencia de Posición**:
   - **TAG de Elemento (Junto al símbolo)**: Se mantiene la nomenclatura única de componentes `Q101`, `Q102`, `Q103`... para interruptores termomagnéticos, y `D101`, `D102`... para disyuntores diferenciales.
   - **Referencia de Ubicación (`F<fila>.<posicion>`)**: La etiqueta de ubicación según fila y posición (ej. `F1.1`, `F1.2`, `F2.1`) se ubica en el área descriptiva al pie de cada salida como guía de posición en el tablero y **nunca reemplaza el TAG del elemento**.
2. **Conexión de Acometida Principal (Q1)**: El interruptor principal general (Q1) se conecta de forma totalmente centrada con respecto a la línea del barral principal distribuidor.
3. **Color de Líneas de Potencia y Barral Principal**: El barral / embarrado principal y las líneas de energía/potencia se renderizan en **Color Verde** (`#10B981` en CAD / `#059669` en SVG).
4. **Dots de Conexión de Ramales (-20% de tamaño)**: Los nodos de conexión al embarrado se renderizan rellenos del mismo **Verde** de las líneas (`#10B981` / `#059669`) con un tamaño compacto (radio `r = 4.0px`).
5. **Color Adaptativo de Elementos y Símbolos (Auto)**: Símbolos, marcas de fase, bornes y textos son de color **Auto** (Negro `#000000` en Light Mode / Blanco `#FFFFFF` en Dark Mode).
6. **Contenedor Transparente de Texto de Salida**: El contenedor al pie de cada salida tiene 110mm de ancho centrado en la línea (con 5mm libres a los lados) y es **100% transparente sin bordes ni fondos visibles** (`fill="none"`, `stroke="none"`).
