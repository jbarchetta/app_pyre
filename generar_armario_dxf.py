import ezdxf
import matplotlib.pyplot as plt

# =========================================================================
# CONSTANTES MAESTRAS DE INGENIERÍA NOLLMANN NIS (1:1 VISTA A)
# =========================================================================
W = 600.0        # Ancho nominal exterior (mm)
H = 600.0        # Alto nominal exterior (mm)

DELTA_0 = 0.00   # Offset 0: Filo exterior de chapa (W x H)
DELTA_PLIEGUE = 1.60 # Offset 1: Pliegue de chapa exterior (W - 3.20)
DELTA_1 = 19.00  # Offset 2: Pestaña exterior apoyo de puerta (W - 38)
DELTA_2 = 20.60  # Offset 3: Asiento / pliegue de doblez de chapa (W - 41.20)
DELTA_3 = 25.90  # Offset 4: Marco interior de soporte de placa (W - 51.80)
DELTA_4 = 27.50  # Offset 5: Bandeja interior / subpanel posterior (W - 55)

RADIO_MARCO_EXT = 3.20  # Radio esquina exterior (mm)
RADIO_MARCO_INT = 1.60  # Radio esquina interior (mm)

TAPA_ESPESOR = 3.00     # Grosor tapa pasacables (mm)
TAPA_BISEL = 2.00       # Cateto bisel a 45° (mm)

# Posicionamiento Rieles DIN 35 desde borde superior nominal (Y=0)
DIN_FIRST_Y_FROM_TOP = 152.50         # 152.5mm desde el borde superior nominal del gabinete
DIN_PASO_Y = 150.00                   # Paso constante entre filas (150mm)

# Rieles DIN en gabinete 600x600 (3 filas, ordenadas de abajo hacia arriba en AutoCAD Y)
RAIL_CY = [(H - DIN_FIRST_Y_FROM_TOP) - i * DIN_PASO_Y for i in range(3)]
RAIL_L = W - 2 * (DELTA_4 + 20)      # Ancho útil del riel
RAIL_X0 = (W - RAIL_L) / 2.0
RAIL_H = 35.0                         # Perfil DIN TH35 (35mm)

# =========================================================================
# FUNCIONES AUXILIARES DE DIBUJO VECTORIAL
# =========================================================================
def rect(msp, off, layer):
    """Crea una LWPOLYLINE cerrada rectangular concéntrica con offset desde el borde exterior"""
    x0 = off
    y0 = off
    x1 = W - off
    y1 = H - off
    pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    return msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': layer})

def din_rail(msp, x, cy, length, layer):
    """Crea la geometría perfil DIN TH35 de 35mm con cejas"""
    y0 = cy - RAIL_H / 2.0
    y1 = cy + RAIL_H / 2.0

    # Perfil DIN TH35 exterior
    pts = [(x, y0), (x + length, y0), (x + length, y1), (x, y1)]
    poly = msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': layer})

    # Cejas superiores e inferiores (5mm)
    l1 = msp.add_line(start=(x, y0 + 5.0), end=(x + length, y0 + 5.0), dxfattribs={'layer': layer})
    l2 = msp.add_line(start=(x, y1 - 5.0), end=(x + length, y1 - 5.0), dxfattribs={'layer': layer})

    return poly, l1, l2

def tapa_pasacables(msp, y_edge, is_top, layer):
    """Crea la tapa pasacables de 3mm con biseles a 45°"""
    h = TAPA_ESPESOR
    b = TAPA_BISEL
    direction = -1 if is_top else 1

    y_outer = y_edge + direction * h
    y_inner = y_edge + direction * 1.0
    x_left = 2.5
    x_right = W - 2.5

    # Dibujar líneas del contorno
    msp.add_line((x_left + b, y_outer), (x_right - b, y_outer), dxfattribs={'layer': layer})
    msp.add_line((x_left + b, y_outer), (x_left, y_inner), dxfattribs={'layer': layer})
    msp.add_line((x_right - b, y_outer), (x_right, y_inner), dxfattribs={'layer': layer})
    msp.add_line((x_left, y_inner), (x_left, y_edge), dxfattribs={'layer': layer})
    msp.add_line((x_right, y_inner), (x_right, y_edge), dxfattribs={'layer': layer})

# =========================================================================
# GENERACIÓN DE DOCUMENTO DXF (R2010)
# =========================================================================
doc = ezdxf.new("R2010")
doc.header['$INSUNITS'] = 4  # Milímetros

doc.layers.new(name="GABINETE", dxfattribs={'color': 7, 'linetype': 'CONTINUOUS'})
doc.layers.new(name="PESTANA", dxfattribs={'color': 8, 'linetype': 'DASHED'})
doc.layers.new(name="BANDEJA", dxfattribs={'color': 8, 'linetype': 'CONTINUOUS'})
doc.layers.new(name="CANALETAS", dxfattribs={'color': 8, 'linetype': 'CONTINUOUS'})
doc.layers.new(name="RIELES", dxfattribs={'color': 3, 'linetype': 'CONTINUOUS'})
doc.layers.new(name="DISTRIBUIDOR", dxfattribs={'color': 3, 'linetype': 'DASHED'})

msp = doc.modelspace()

# 1) Las 6 polilíneas concéntricas 1:1 Nollmann NIS
rect(msp, DELTA_0, "GABINETE")  # Filo exterior chapa gabinete (W x H)
rect(msp, DELTA_PLIEGUE, "GABINETE") # Pliegue exterior chapa (1.60 mm)
rect(msp, DELTA_1, "GABINETE")  # Pestaña apoyo exterior (19.00 mm)
rect(msp, DELTA_2, "PESTANA")   # Asiento pliegue doblez (20.60 mm)
rect(msp, DELTA_3, "BANDEJA")   # Marco interior (25.90 mm)
rect(msp, DELTA_4, "BANDEJA")   # Bandeja interior (27.50 mm)

# 2) Tapas superior e inferior de 3mm con biseles a 45°
tapa_pasacables(msp, H, is_top=True, layer="GABINETE")
tapa_pasacables(msp, 0, is_top=False, layer="GABINETE")

# 3) Canaletas Ranuradas en Líneas Continuas con Ingletes a 45° (Nivel Z=0)
cw = 25.0
x_left = DELTA_4
x_right = W - DELTA_4

# Fila 0 esta arriba en AutoCAD Y (RAIL_CY[0]), Fila N-1 esta abajo (RAIL_CY[-1])
# Primera canaleta horizontal (entre Fila 0 y Fila 1)
y_first_chan = (RAIL_CY[0] + RAIL_CY[1]) / 2.0 - cw / 2.0
# Canaleta horizontal inferior (por debajo de la ultima fila)
y_bot_chan = RAIL_CY[-1] - DIN_PASO_Y / 2.0 - cw / 2.0

# Vertical Izquierda
msp.add_line((x_left, y_first_chan + cw), (x_left, y_bot_chan), dxfattribs={'layer': 'CANALETAS'})
msp.add_line((x_left + cw, y_first_chan + cw), (x_left + cw, y_bot_chan + cw), dxfattribs={'layer': 'CANALETAS'})
msp.add_line((x_left, y_first_chan + cw), (x_left + cw, y_first_chan + cw), dxfattribs={'layer': 'CANALETAS'})

# Vertical Derecha
msp.add_line((x_right, y_first_chan + cw), (x_right, y_bot_chan), dxfattribs={'layer': 'CANALETAS'})
msp.add_line((x_right - cw, y_first_chan + cw), (x_right - cw, y_bot_chan + cw), dxfattribs={'layer': 'CANALETAS'})
msp.add_line((x_right - cw, y_first_chan + cw), (x_right, y_first_chan + cw), dxfattribs={'layer': 'CANALETAS'})

# Horizontales Intermedias
for i in range(len(RAIL_CY) - 1):
    y_ch = (RAIL_CY[i] + RAIL_CY[i + 1]) / 2.0 - cw / 2.0
    msp.add_line((x_left + cw, y_ch), (x_right - cw, y_ch), dxfattribs={'layer': 'CANALETAS'})
    msp.add_line((x_left + cw, y_ch + cw), (x_right - cw, y_ch + cw), dxfattribs={'layer': 'CANALETAS'})

# Horizontal Inferior con Ingletes a 45°
msp.add_line((x_left, y_bot_chan), (x_right, y_bot_chan), dxfattribs={'layer': 'CANALETAS'})
msp.add_line((x_left + cw, y_bot_chan + cw), (x_right - cw, y_bot_chan + cw), dxfattribs={'layer': 'CANALETAS'})
# Ingletes 45°
msp.add_line((x_left, y_bot_chan), (x_left + cw, y_bot_chan + cw), dxfattribs={'layer': 'CANALETAS'})
msp.add_line((x_right, y_bot_chan), (x_right - cw, y_bot_chan + cw), dxfattribs={'layer': 'CANALETAS'})

# 4) Rieles DIN 35 horizontales y Bloque Distribuidor en Regla 8 (Fila superior)
q1_length = 72.5 # Riel DIN corto para Q1 3P/4P
for idx, cy in enumerate(RAIL_CY):
    if idx == 0:
        # Fila 0 (Top): Riel DIN corto solo para Q1 en el lado izquierdo
        din_rail(msp, RAIL_X0, cy, q1_length, "RIELES")
        # Bloque reservado a la derecha para Distribuidor / Embarrado General (sin texto)
        busbar_x = RAIL_X0 + q1_length + 25.0
        busbar_w = RAIL_L - q1_length - 25.0
        busbar_h = 65.0
        busbar_y = cy - busbar_h / 2.0
        # Recuadro punteado vacio sin texto
        pts = [(busbar_x, busbar_y), (busbar_x + busbar_w, busbar_y), (busbar_x + busbar_w, busbar_y + busbar_h), (busbar_x, busbar_y + busbar_h)]
        msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'DISTRIBUIDOR', 'linetype': 'DASHED'})
    else:
        din_rail(msp, RAIL_X0, cy, RAIL_L, "RIELES")

# Guardar DXF
dxf_filename = "armario.dxf"
doc.saveas(dxf_filename)

# =========================================================================
# EXPORTACIÓN DE CONTROL PNG CON MATPLOTLIB
# =========================================================================
fig, ax = plt.subplots(figsize=(6, 6))
ax.set_aspect('equal')
ax.axis('off')

color_map = {
    "GABINETE": "black",
    "PESTANA": "gray",
    "BANDEJA": "#475569",
    "CANALETAS": "#64748B",
    "RIELES": "green",
    "DISTRIBUIDOR": "#059669"
}

for entity in msp:
    layer = entity.dxf.layer
    c = color_map.get(layer, "black")
    if entity.dxftype() == 'LWPOLYLINE':
        points = list(entity.get_points('xy'))
        if entity.closed:
            points.append(points[0])
        xs, ys = zip(*points)
        ax.plot(xs, ys, color=c, linewidth=1.2)
    elif entity.dxftype() == 'LINE':
        start = entity.dxf.start
        end = entity.dxf.end
        ax.plot([start.x, end.x], [start.y, end.y], color=c, linewidth=1.0)

plt.xlim(-10, W + 10)
plt.ylim(-10, H + 10)
plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
png_filename = "armario_control.png"
plt.savefig(png_filename, dpi=300, bbox_inches='tight', pad_inches=0)
plt.close()

print(f"DXF generado exitosamente: {dxf_filename}")
print(f"PNG de control generado: {png_filename}")
