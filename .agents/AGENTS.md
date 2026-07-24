# AGENTS.md - Workspace Project Rules

## Reglas de Diseño del Esquema Unifilar (Unifilar Schematic Standards)

1. **Color de Barral Principal**: El barral / embarrado principal utiliza el mismo color exacto que las líneas de energía (`#0f172a` / `#000000`).
2. **Dots de Conexión de Ramales**: Los puntos / nodos de conexión de ramales al embarrado principal se renderizan agrandados (radio `r = 4.5px` a `5px`) y con el mismo color exacto de las líneas de energía (`#0f172a`).
3. **Escala de Texto (+40%)**: La tipografía de etiquetas, especificaciones, amperajes y códigos en el esquema unifilar se incrementa en un 40% para maximizar la legibilidad.
4. **Símbolos en Negro**: Todos los símbolos unifilares (disyuntores diferenciales, interruptores termomagnéticos, bornes de conexión y marcas de polos/fases) se dibujan en color negro puro (`#000000` / `#0f172a`).
5. **Contenedor Cuadrado de Texto de Salida**: Cada salida en la parte inferior de la línea cuenta con un cuadro contenedor de texto de 110mm de ancho centrado en la línea de salida, manteniendo un espacio libre de 5mm a cada lado entre cuadros contiguos.
6. **Nomenclatura de Ubicación del Elemento**: Las salidas y elementos unifilares se identifican obligatoriamente por su ubicación en el tablero según su fila (sección) y posición dentro de la fila con el formato `F<fila>.<posicion>` (ejemplos: `F1.1`, `F1.2`, `F2.1`).
