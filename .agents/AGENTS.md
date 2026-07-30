# AGENTS.md - Workspace Project Rules

## Reglas de Diseño del Esquema Unifilar (Unifilar Schematic Standards)

1. **Estructura Descriptiva del Elemento (Junto al Símbolo)**:
   - **Línea 1 (TAG de Elemento)**: Mantiene la nomenclatura única `Q101`, `Q102`, `Q103`... para termomagnéticos y `D101`, `D102`... para diferenciales en fuente **6.5mm Bold** (`12.5px`).
   - **Línea 2 (Designación de Tipo)**: Muestra el texto precedido por **ABB en color rojo** (`#DC2626`) y a continuación el modelo de designación comercial (ej. `ABB S201-C16` o `ABB F202 AC-25/0.03`) en fuente **6.0mm Bold**.
   - **Línea 3 (Código SAP)**: Muestra el código de pedido / SAP de ABB (ej. `2CDS251001R0164`) en fuente **6.0mm Normal**.
   - **Línea Eliminada**: La línea antigua de corriente y polos (`32A 2P`) queda permanentemente **eliminada** de esta sección.

2. **Interruptor Principal General (Q1)**:
   - **Símbolo**: Utiliza el mismo símbolo termomagnético normalizado (seccionador con cruz 'X', gatillo y stubs de empalme) en reemplazo del antiguo cuadrado genérico.
   - **Largo Ampliado (+25mm en Ambas Líneas)**: El tramo de entrada superior y el tramo de salida inferior de Q1 se amplían **+25mm cada uno**, fijando `Y_MAIN_BREAKER = 115mm` y `Y_DISTRIBUTION_BUS = 210mm` para un maquetado amplio y despejado.
   - **Flecha Entrante**: Al inicio de la línea de acometida (aguas arriba del Q1) se renderiza una punta de flecha entrante ($\downarrow$) que indica la alimentación del cliente.
   - **Textos Descriptivos**: Aplica la misma estructura de 3 líneas descriptivas a la izquierda del símbolo (Línea 1: TAG `Q1` en 6.5mm Bold, Línea 2: `ABB <Modelo>` en 6.0mm Bold con ABB en rojo, Línea 3: `<Código SAP>` en 6.0mm Normal).
   - **Polos y Calibres Duplicados**: Incorpora símbolos de polos y calibres de cable (`16 mm²`, `35 mm²`, `70 mm²`) tanto **aguas arriba** como **aguas abajo** de Q1.
   - **Conexión**: Se conecta centrado con respecto al embarrado distribuidor con un dot verde `r = 4.0px`.

3. **Reubicación de Símbolos de Polos/Fases**:
   - Los ticks/símbolos de polos tanto de las líneas **aguas arriba** como de las líneas **aguas abajo** del elemento se desplazan **10mm hacia abajo**.

4. **Símbolo de Bornes Sin Fondo de Color**:
   - El símbolo de bornera / borne de salida no posee fondo de color relleno (`fill="none"`).

5. **Eliminación de Línea Aguas Abajo del Borne**:
   - Se elimina la línea conductora que se extendía por debajo del borne de salida.

6. **Reubicación del Contenedor de Texto de Salida (+10mm Arriba)**:
   - El bloque de texto del pie (referencia de posición `F1.1`, etiqueta explicativa del circuito) se eleva **10mm hacia arriba** directamente debajo del borne.

7. **Texto Explicativo del Pie (Sin Truncar y Multi-línea)**:
   - El texto explicativo de la salida (etiqueta del circuito ingresada por el usuario) se despliega **completo sin recortarse a 15 caracteres**. Se ajusta de forma multilínea llenando el ancho del contenedor.
   - En caso de que la salida no posea etiqueta o referencia personalizada, en su lugar se despliega el texto **`Sin Referencia`** formateado en **Fuente Normal, Cursiva y Gris Atenuado** (`weight: "normal"`, `fontStyle: "italic"`, `color: "#94A3B8"`).
   - Las antiguas líneas inferiores de polos/amperaje (`32A / 2P`) y código SAP secundario quedan **eliminadas** del contenedor del pie.

8. **Símbolos DXF con Líneas de Conexión**:
   - Los símbolos de termomagnéticos y diferenciales (`abb_unif_term.dxf`) incorporan líneas de conexión de entrada (superior) y salida (inferior) que sirven como punto de empalme directo de los conductores verticalmente.
   - El símbolo de borne (`abb_unif_born.dxf`) únicamente posee línea de conexión superior. No posee conductor aguas abajo.

9. **Referencia de Ubicación (`F<fila>.<posicion>`)**:
   - La etiqueta de posición por fila y salida (ej. `F1.1`, `F1.2`, `F2.1`) se ubica en el área descriptiva del pie en fuente **6.5mm Bold** (`12.5px`) y **nunca reemplaza el TAG del elemento**.

10. **Color de Líneas de Potencia y Barral Principal**:
   - El barral / embarrado principal y las líneas de energía/potencia son de **Color Verde** (`#10B981` en CAD / `#059669` en SVG).

11. **Dots de Conexión de Ramales (-20% de tamaño)**:
   - Los nodos de conexión al embarrado se renderizan rellenos del mismo **Verde** de las líneas (`#10B981` / `#059669`) con radio compacto `r = 4.0px`.

12. **Formato de Calibre del Cable (Únicamente mm² sin prefijos)**:
   - Las etiquetas de calibre del cable muestran **exclusivamente la sección transversal del conductor** (ej. `70 mm²`, `35 mm²`, `16 mm²`, `6 mm²`, `4 mm²`) eliminando el prefijo de polos (`4x` / `3x`). Se posicionan en fuente **6.0mm Bold** elevadas 1mm sobre la guía horizontal.

13. **Contenedor Transparente de Texto al Pie**:
   - El contenedor del pie es **100% transparente sin bordes ni fondos visibles** (`fill="none"`, `stroke="none"`).

14. **Menú Desplegable de Exportación (DXF y PDF Profesional, Sin PNG)**:
   - Se elimina permanentemente la opción de exportación a PNG.
   - Se reemplaza por un botón desplegable profesional con las opciones de descarga **`Exportar AutoCAD (.dxf)`** y **`Exportar Plano PDF (.pdf)`** (PDF vectorial con cuadro de rotulación de ingeniería).

15. **Sincronización Hover Tabla vs. Ventana CAD**:
   - Al pasar el cursor por las filas de la tabla de componentes se **ilumina en verde brillante resplandeciente (`#10B981`) la línea de circuito** en el plano CAD sin abrir el modal flotante.
   - El modal flotante HUD solo se despliega cuando el puntero del ratón se desplaza activamente **dentro de la ventana de diseño CAD**.

16. **Ocultamiento de Riel DIN 35 Bajo Elementos**:
   - El dibujo del riel DIN 35 no se dibuja ni traspasa por debajo de los equipos montados. Todo módulo (interruptor principal, termomagnética o diferencial) incluye una máscara opaca de fondo (`fill="bg"`) que oculta limpiamente cualquier tramo de riel DIN que coincida con el cuerpo del elemento.

## Reglas de Arquitectura y Diseño de Software (Engineering & Architectural Principles)

1. **Seguridad Nivel Empresa (Zero Trust)**:
   - **Autorización por Propiedad**: Todos los endpoints de modificación (`PATCH`, `DELETE`) en el backend deben verificar pertenencia/ownership a nivel fila.
   - **Protección DoS**: Aplicar rate-limiting (`slowapi`) en endpoints sensibles (`/auth/login`, `/catalogo/importar`).
   - **Headers Rígidos & Sanitización**: Habilitar HSTS, CSP y sanitizar archivos cargados al servidor.
   - **Trazabilidad & Auditoría**: Registrar en `tabla_auditoria` todo cambio en precios, borrados o sobrescrituras de componentes.

2. **Adaptabilidad & Principios SOLID (Clean Architecture)**:
   - **Motor de Reglas Estratégico**: Estructurar las validaciones eléctricas en clases de reglas independientes y desacopladas (`Open/Closed Principle`).
   - **Desacoplamiento del Visor CAD**: Interfaz genérica de renderizado (`BoardRenderAdapter`) separando la vista en React de los exportadores vectoriales (DXF, PDF, SVG).
   - **Resiliencia Frontend**: Proteger componentes reactivos y visores vectoriales con `Error Boundaries` de React 19 para evitar fallos globales de UI.

3. **Escalabilidad & High Performance**:
   - **Prevención de N+1 Queries**: Utilizar exclusivamente `selectinload()` / `joinedload()` en SQLAlchemy 2.0.
   - **Indexación Postgres**: Mantener índices B-Tree en columnas de búsqueda rápida y GIN sobre metadatos JSONB.
   - **Aislamiento de Estado del Canvas**: Mantener transformaciones dinámicas del canvas CAD fuera del árbol de renderizado reactivo del DOM para asegurar 60 FPS estables.

4. **Matriz de Calidad y Pruebas (TDD Inviolable)**:
   - Todo cálculo eléctrico, regla de construcción o endpoint debe contar con su correspondiente suite de pruebas unitarias e integrales antes de ser mergeado.

5. **Rigor Técnico e Invarianza Física (Zero Silent Adaptation / No Guesswork)**:
   - **Tolerancia Cero a la Asunción Silenciosa**: NUNCA modificar fórmulas de ingeniería, constantes físicas o capacidades de catálogo para "hacerlos encajar" con un dibujo CAD defectuoso, cota mal trazada o dimensión inconsistente.
   - **Verificación contra Tablas de Verdad**: Si una dimensión ingresada (ej. 835x798 mm) o archivo DXF subido difiere de las tablas de ingeniería/catálogos oficiales (ej. planillas de Nollmann de 24 polos/fila), el agente y el sistema DEBEN rechazar la asunción, alertar explícitamente la discrepancia de cotas y consultar hasta tener el dato fuente correcto.

6. **Estructura Tridimensional Z & Layout Coherente de Cable Canal (Canaletas Ranuradas)**:
   - **Niveles de Profundidad Z**: El Cable Canal (canaleta ranurada) se monta **directamente sobre la bandeja posterior** ($Z = 0\text{ mm}$). Los rieles DIN y los equipos (termomagnéticos, diferenciales) se elevan **$110\text{ mm}$ sobre banquitos regulables** ($Z = 110\text{ mm}$).
   - **Ausencia de Colisión X, Y, Z**: Las canaletas corren por el fondo sin interferir ni colisionar con las carcasas de los equipos que flotan en el nivel superior ($Z = 110\text{ mm}$).
   - **Líneas Continuas Sólidas**: Las canaletas se dibujan vectorialmente con **líneas continuas sólidas** (nunca punteadas).
   - **Prohibición de Canaleta en Borde Superior**: Bajo ningún concepto se dibuja canaleta horizontal en el borde superior por encima de Fila 0 (espacio reservado para acometida y bloque distribuidor).
   - **Origen de Canaletas Verticales Laterales**: Las canaletas verticales pegadas a los bordes laterales izquierdo y derecho nacen **debajo de Fila 0 / $Q1$** (en la canaleta horizontal situada entre Fila 0 y Fila 1).
   - **Ingletes a 45° en Esquinas Inferiores**: En la canaleta horizontal inferior (ubicada por debajo de la última fila), los empalmes de las esquinas izquierda y derecha se trazan con **cortes biselados exactos a 45° (ingletes)** para cómputo real de metraje en BOM.
   - **Invarianza Perimétrica**: Si se selecciona un cable canal de mayor sección, el perímetro exterior extremo del trazado se mantiene fijo e inalterable.

7. **Linkeo de Elementos y Flexibilidad de Ubicación**:
   - **Disposición en Misma Fila o Filas Distintas**: Los elementos vinculados (ej. Termomagnética seccional y Disyuntor diferencial asociado) pueden posicionarse **en la misma fila adyacentes (lado a lado)** o en filas separadas según el espacio del tablero.
   - **Cálculo de Cable de Interconexión**:
     - *Misma Fila (Lado a Lado)*: Salida inferior de termomagnética conecta directamente a la entrada superior del diferencial por puente corto de peinado ($15\text{ cm} - 25\text{ cm}$).
     - *Filas Distintas*: El cable discurre por la canaleta vertical lateral recorriendo la distancia inter-filas.
   - **Permisividad Total de Polos Aguas Arriba / Abajo**: Queda **estrictamente eliminada** cualquier restricción o alarma por alimentar salidas bipolares/unipolares desde interruptores o diferenciales tetrapolares ($4\text{P}$) o tripolares ($3\text{P}$) aguas arriba. La distribución monofásica/bifásica derivada de cabeceras polifásicas es un patrón estándar totalmente válido.

8. **Disposición del Interruptor Principal ($Q1$) y Bloque de Embarrado Distribuidor**:
   - **Ubicación del Interruptor Principal ($Q1$)**: Se posiciona alineado al **extremo izquierdo** de la fila superior (Fila 1), al mismo nivel X que los primeros módulos de las filas inferiores.
   - **Longitud del Riel DIN de Cabecera**: El riel DIN 35 que soporta a $Q1$ se acorta para tener **únicamente la longitud justa y exacta para alojar la carcasa del interruptor principal**.
   - **Reserva de Espacio para Barras / Distribuidoras**: El espacio libre generado a la derecha de $Q1$ en la misma fila superior se reserva para el **Bloque de Barras / Distribuidoras de Cobre**, montado al nivel de la bandeja posterior. Se renderiza vectorialmente como un contenedor rectangular delimitado con etiqueta *"Bloque Distribuidor / Embarrado"* hasta definir su diseño vectorial definitivo.


