"""
Generador paramétrico de armarios eléctricos Nollmann (NOLLBOX) en DXF.

QUÉ RESUELVE
------------
El intento anterior (generar_armario_dxf.py en la raíz) dibujaba un armario con
números inventados a ojo (marco de 600, rieles de 413mm, separación 140mm) que
no coincidían con ningún NOLLBOX real. Este generador está anclado en la
geometría MEDIDA de los cuatro DXF base de Nollmann que hay en
frontend/public/dxf/ (NOLLBOX 450x600, 600x600, 600x750, 600x1050).

Reglas derivadas de esos archivos (todas verificadas contra los 4 tamaños):

  * El marco exterior dibujado = dimensión nominal - 38 mm.
      600 -> 562,  450 -> 412,  750 -> 712,  1050 -> 1012.
  * Marcos concéntricos a offsets por lado IDÉNTICOS en todos los tamaños:
      gabinete (0) -> puerta (1.6) -> tapa (6.9 / 8.5) -> placa de montaje (35.5).
  * Rieles DIN: cantidad = round(H_nominal / 150) - 1
      600 -> 3,  750 -> 4,  1050 -> 6.
    Separación vertical exacta de 150 mm, alto de perfil 45 mm, largo = ancho de
    la placa de montaje menos un margen lateral, centrados verticalmente.

Con esas reglas, un solo script genera cualquier armario (tamaño estándar del
catálogo o medida arbitraria) produciendo:
  - un DXF R2010 en milímetros, con capas separadas y polilíneas cerradas;
  - un PNG de control para revisar la vista sin abrir un CAD.

USO
---
    python generar_armario.py                # genera los 4 estándar del catálogo
    python generar_armario.py 600x750        # genera una medida puntual
    python generar_armario.py 800x1200       # medida arbitraria (fuera de catálogo)
    python generar_armario.py --sin-png      # solo DXF, sin render de control

Requiere: ezdxf (obligatorio) y matplotlib (opcional, solo para el PNG).
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

import ezdxf

# ---------------------------------------------------------------------------
# CONSTANTES GEOMÉTRICAS (medidas de los NOLLBOX reales, no inventadas)
# ---------------------------------------------------------------------------

# El dibujo del gabinete es la medida nominal menos este valor (por lado ya
# incluido: es la diferencia total entre nominal y marco dibujado).
MARGEN_NOMINAL_A_MARCO = 38.0

# Offsets POR LADO de cada marco concéntrico respecto del marco exterior.
# Medidos idénticos en el NOLLBOX de 450 y en el de 600 de ancho.
OFFSET_PUERTA = 1.6          # línea de la puerta / junta
OFFSET_TAPA_EXT = 6.9        # contorno externo de la tapa
OFFSET_TAPA_INT = 8.5        # contorno interno de la tapa
OFFSET_PLACA_MONTAJE = 35.5  # placa de montaje (área útil donde van los rieles)

# Riel DIN (perfil dibujado en vista frontal).
RIEL_SEPARACION = 150.0      # separación vertical entre ejes de rieles
RIEL_ALTO_PERFIL = 45.0      # alto del perfil del riel en la vista
RIEL_MARGEN_LATERAL = 25.0   # margen a cada lado dentro de la placa de montaje
RIEL_ALTURA_MODULO = 35.0    # alto del cuerpo del riel; el resto es la pestaña

# Capas del DXF (nombre, color ACI).
CAPA_GABINETE = ("GABINETE", 7)   # blanco/negro: cuerpo y puerta
CAPA_PLACA = ("PLACA", 8)         # gris: placa de montaje
CAPA_RIELES = ("RIELES", 3)       # verde: rieles DIN


# Catálogo de tamaños estándar Nollmann (nominal ancho x alto, en mm).
CATALOGO_ESTANDAR = [
    (450, 600),
    (600, 600),
    (600, 750),
    (600, 1050),
]


@dataclass
class Armario:
    """Un armario a generar, definido por su medida nominal en milímetros."""

    ancho_nominal: float
    alto_nominal: float

    @property
    def ancho_marco(self) -> float:
        return self.ancho_nominal - MARGEN_NOMINAL_A_MARCO

    @property
    def alto_marco(self) -> float:
        return self.alto_nominal - MARGEN_NOMINAL_A_MARCO

    @property
    def cantidad_rieles(self) -> int:
        # Regla derivada: 600->3, 750->4, 1050->6. Mínimo 1 riel.
        return max(1, round(self.alto_nominal / RIEL_SEPARACION) - 1)

    @property
    def etiqueta(self) -> str:
        return f"{int(self.ancho_nominal)}x{int(self.alto_nominal)}"


def _rect(msp, x0, y0, x1, y1, layer):
    """Rectángulo como LWPOLYLINE cerrada."""
    msp.add_lwpolyline(
        [(x0, y0), (x1, y0), (x1, y1), (x0, y1)],
        close=True,
        dxfattribs={"layer": layer},
    )


def _riel_din(msp, x, y_centro, largo, layer):
    """
    Perfil de riel DIN en vista frontal: un rectángulo del cuerpo del riel más
    dos líneas que insinúan la pestaña superior e inferior del perfil omega.
    """
    medio = RIEL_ALTURA_MODULO / 2.0
    y0 = y_centro - medio
    y1 = y_centro + medio
    _rect(msp, x, y0, x + largo, y1, layer)
    # Pestañas (líneas horizontales apenas por fuera del cuerpo).
    pest = (RIEL_ALTO_PERFIL - RIEL_ALTURA_MODULO) / 2.0
    msp.add_line((x, y0 - pest), (x + largo, y0 - pest), dxfattribs={"layer": layer})
    msp.add_line((x, y1 + pest), (x + largo, y1 + pest), dxfattribs={"layer": layer})


def construir_dxf(armario: Armario):
    """Construye y devuelve el documento ezdxf para un armario."""
    doc = ezdxf.new("R2010")
    doc.header["$INSUNITS"] = 4  # milímetros

    for nombre, color in (CAPA_GABINETE, CAPA_PLACA, CAPA_RIELES):
        doc.layers.add(name=nombre, color=color)

    msp = doc.modelspace()

    w = armario.ancho_marco
    h = armario.alto_marco
    gab = CAPA_GABINETE[0]
    placa = CAPA_PLACA[0]
    rieles = CAPA_RIELES[0]

    # Origen en (0,0) = esquina inferior izquierda del marco exterior.
    # 1) Marcos concéntricos.
    _rect(msp, 0, 0, w, h, gab)  # gabinete exterior
    for off, capa in (
        (OFFSET_PUERTA, gab),
        (OFFSET_TAPA_EXT, gab),
        (OFFSET_TAPA_INT, gab),
        (OFFSET_PLACA_MONTAJE, placa),
    ):
        _rect(msp, off, off, w - off, h - off, capa)

    # 2) Rieles DIN dentro de la placa de montaje, centrados verticalmente.
    placa_x0 = OFFSET_PLACA_MONTAJE
    placa_ancho = w - 2 * OFFSET_PLACA_MONTAJE
    riel_x0 = placa_x0 + RIEL_MARGEN_LATERAL
    riel_largo = placa_ancho - 2 * RIEL_MARGEN_LATERAL

    n = armario.cantidad_rieles
    alto_util = h - 2 * OFFSET_PLACA_MONTAJE
    centro_y = OFFSET_PLACA_MONTAJE + alto_util / 2.0
    # Distribución simétrica alrededor del centro con paso fijo de 150 mm.
    y0_riel = centro_y - (n - 1) * RIEL_SEPARACION / 2.0
    for i in range(n):
        _riel_din(msp, riel_x0, y0_riel + i * RIEL_SEPARACION, riel_largo, rieles)

    return doc


def exportar_png(doc, ruta_png, armario: Armario):
    """Render de control con matplotlib. Silencioso si matplotlib no está."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("  (matplotlib no instalado: se omite el PNG de control)")
        return False

    color_map = {CAPA_GABINETE[0]: "black", CAPA_PLACA[0]: "#888888", CAPA_RIELES[0]: "#188038"}
    msp = doc.modelspace()

    fig, ax = plt.subplots(figsize=(6, 6 * armario.alto_marco / armario.ancho_marco))
    ax.set_aspect("equal")
    ax.axis("off")

    for e in msp:
        c = color_map.get(e.dxf.layer, "black")
        if e.dxftype() == "LWPOLYLINE":
            pts = [(x, y) for x, y, *_ in e.get_points()]
            if e.closed:
                pts.append(pts[0])
            xs, ys = zip(*pts)
            ax.plot(xs, ys, color=c, linewidth=1.1)
        elif e.dxftype() == "LINE":
            ax.plot(
                [e.dxf.start.x, e.dxf.end.x],
                [e.dxf.start.y, e.dxf.end.y],
                color=c,
                linewidth=0.9,
            )

    m = 15
    ax.set_xlim(-m, armario.ancho_marco + m)
    ax.set_ylim(-m, armario.alto_marco + m)
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    fig.savefig(ruta_png, dpi=200, bbox_inches="tight", pad_inches=0.1)
    plt.close(fig)
    return True


def generar(armario: Armario, carpeta_salida: str, con_png: bool = True) -> None:
    import os

    os.makedirs(carpeta_salida, exist_ok=True)
    doc = construir_dxf(armario)

    ruta_dxf = os.path.join(carpeta_salida, f"armario_{armario.etiqueta}.dxf")
    doc.saveas(ruta_dxf)

    n_lw = len(list(doc.modelspace().query("LWPOLYLINE")))
    n_ln = len(list(doc.modelspace().query("LINE")))
    print(
        f"[{armario.etiqueta}] marco {armario.ancho_marco:.0f}x{armario.alto_marco:.0f} mm, "
        f"{armario.cantidad_rieles} riel(es)  ->  {ruta_dxf}  "
        f"({n_lw} polilíneas, {n_ln} líneas)"
    )

    if con_png:
        ruta_png = os.path.join(carpeta_salida, f"armario_{armario.etiqueta}.png")
        if exportar_png(doc, ruta_png, armario):
            print(f"           control  ->  {ruta_png}")


def _parsear_medida(texto: str) -> Armario:
    try:
        a, h = texto.lower().replace(" ", "").split("x")
        return Armario(float(a), float(h))
    except ValueError:
        raise SystemExit(f"Medida inválida: {texto!r}. Usá el formato ANCHOxALTO, ej. 600x750.")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generador paramétrico de armarios Nollmann en DXF.")
    parser.add_argument(
        "medidas",
        nargs="*",
        help="Medidas ANCHOxALTO en mm (ej. 600x750). Sin argumentos genera el catálogo estándar.",
    )
    parser.add_argument("--salida", default="salida", help="Carpeta de salida (por defecto: ./salida).")
    parser.add_argument("--sin-png", action="store_true", help="No generar el PNG de control.")
    args = parser.parse_args(argv)

    if args.medidas:
        armarios = [_parsear_medida(m) for m in args.medidas]
    else:
        armarios = [Armario(a, h) for a, h in CATALOGO_ESTANDAR]
        print("Sin medidas indicadas: genero el catálogo estándar Nollmann.\n")

    import os

    carpeta = args.salida
    if not os.path.isabs(carpeta):
        carpeta = os.path.join(os.path.dirname(os.path.abspath(__file__)), carpeta)

    for arm in armarios:
        generar(arm, carpeta, con_png=not args.sin_png)


if __name__ == "__main__":
    main(sys.argv[1:])
