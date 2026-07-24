# AGENTS.md - Workspace Project Rules

## Reglas de Diseño del Esquema Unifilar (Unifilar Schematic Standards)

1. **Color de Líneas de Potencia y Barral Principal**: El barral / embarrado principal y las líneas de energía/potencia son de **Color Verde** (`#10B981` en CAD / `#059669` en SVG).
2. **Dots de Conexión de Ramales**: Los puntos / nodos de conexión de ramales al embarrado principal se renderizan agrandados (radio `r = 5px`) y con el mismo color **Verde** exacto de las líneas de energía (`#10B981` / `#059669`).
3. **Color Adaptativo de Elementos y Símbolos (Auto)**: Todos los símbolos unifilares (disyuntores diferenciales, interruptores termomagnéticos, bornes de conexión, marcas de polos/fases y textos) son de color adaptativo **Auto**:
   - En **Modo Dark**: Se renderizan en **Blanco** (`#FFFFFF`).
   - En **Modo Light**: Se renderizan en **Negro / Slate Oscuro** (`#000000` / `#0f172a`).
4. **Escala de Texto Incrementada (+25% adicional)**: La tipografía de etiquetas de ubicación (`F1.1`), especificaciones, amperajes y códigos en el esquema unifilar se incrementa para maximizar la legibilidad en pantalla y pantalla completa.
5. **Contenedor Transparente de Texto de Salida**: Cada salida en la parte inferior de la línea cuenta con un cuadro contenedor de texto de **110mm de ancho** centrado en la línea de salida (espacio libre de 5mm a cada lado), con **fondo transparente y sin borde visible** (`fill="none"`, `stroke="none"`), de forma que únicamente se aprecie la información del texto alineada al centro.
6. **Nomenclatura de Ubicación del Elemento**: Las salidas y elementos unifilares se identifican obligatoriamente por su ubicación en el tablero según su fila (sección) y posición dentro de la fila con el formato `F<fila>.<posicion>` (ejemplos: `F1.1`, `F1.2`, `F2.1`).
