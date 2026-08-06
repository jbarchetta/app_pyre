"""
Riel DIN TH35 generado 100% por código (sin pegar bloques).

Prueba de método: el riel del NOLLBOX real mide 34,9 mm de alto (TH35 estándar
IEC 60715) con ranuras oblongas de extremos R2,5 y un perfil "sombrero" cuyos
cortes horizontales están a Y = 0 / 4,9 / 14,9 / 19,9 / 29 / 34,8 mm. Esas
medidas se reproducen acá paramétricamente para cualquier largo.
"""

from __future__ import annotations

import ezdxf

# Medidas del perfil TH35, tomadas del bloque "RIEL DIN" del NOLLBOX real.
ALTO = 35.0          # alto total del perfil
CEJA = 5.0           # alto de las cejas superior/inferior (pestañas del sombrero)
RANURA_ALTO = 5.0    # alto de la ranura oblonga central
RANURA_LARGO = 18.0  # largo del cuerpo recto de cada ranura (sin los extremos R)
RANURA_R = 2.5       # radio de los extremos redondeados de la ranura
RANURA_PASO = 25.0   # paso entre centros de ranuras
MARGEN_RANURA = 12.0 # margen sin ranurar en cada extremo del riel


def _obround(msp, cx, cy, largo_recto, radio, layer):
    """Ranura oblonga (obround) horizontal centrada en (cx, cy)."""
    hl = largo_recto / 2.0
    # Polilínea con bulges: dos semicírculos en los extremos.
    # bulge = tan(theta/4); semicírculo => theta=180° => bulge = 1.
    puntos = [
        (cx - hl, cy - radio, 0, 0, 0),
        (cx + hl, cy - radio, 0, 0, 1),   # bulge 1 -> semicírculo derecho
        (cx + hl, cy + radio, 0, 0, 0),
        (cx - hl, cy + radio, 0, 0, 1),   # bulge 1 -> semicírculo izquierdo
    ]
    msp.add_lwpolyline(puntos, format="xyseb", close=True, dxfattribs={"layer": layer})


def dibujar_riel(msp, x0, y0, largo, layer="RIELES"):
    """
    Dibuja un riel DIN TH35 de `largo` mm con su esquina inferior izquierda del
    perfil en (x0, y0). Devuelve (ancho, alto) ocupados.
    """
    # Perfil sombrero: cuerpo central + dos cejas. Lo represento con el
    # rectángulo del cuerpo y las líneas de las cejas (el corte que se ve de
    # frente), fiel a los Y medidos del real.
    y_ceja_inf = y0 + CEJA
    y_ceja_sup = y0 + ALTO - CEJA

    # Contorno exterior del perfil.
    msp.add_lwpolyline(
        [(x0, y0), (x0 + largo, y0), (x0 + largo, y0 + ALTO), (x0, y0 + ALTO)],
        close=True,
        dxfattribs={"layer": layer},
    )
    # Líneas de las cejas (doblez del sombrero).
    msp.add_line((x0, y_ceja_inf), (x0 + largo, y_ceja_inf), dxfattribs={"layer": layer})
    msp.add_line((x0, y_ceja_sup), (x0 + largo, y_ceja_sup), dxfattribs={"layer": layer})

    # Ranuras oblongas en la banda central, a paso fijo, centradas.
    cy = y0 + ALTO / 2.0
    util = largo - 2 * MARGEN_RANURA
    n = int(util // RANURA_PASO)
    if n >= 1:
        # centrar la fila de ranuras
        span = (n - 1) * RANURA_PASO
        x_ini = x0 + largo / 2.0 - span / 2.0
        for i in range(n):
            _obround(msp, x_ini + i * RANURA_PASO, cy, RANURA_LARGO - 2 * RANURA_R, RANURA_R, layer)

    return largo, ALTO


def main():
    doc = ezdxf.new("R2010")
    doc.header["$INSUNITS"] = 4
    doc.layers.add(name="RIELES", color=3)
    msp = doc.modelspace()

    dibujar_riel(msp, 0, 0, 440.0)  # riel de 440 mm (como el del NOLLBOX 600)

    import os

    salida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "salida", "riel_din_440.dxf")
    doc.saveas(salida)
    print("riel generado ->", salida)

    # Render de control.
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from ezdxf.addons.drawing import RenderContext, Frontend
        from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

        fig = plt.figure(figsize=(10, 1.6))
        ax = fig.add_axes([0, 0, 1, 1])
        Frontend(RenderContext(doc), MatplotlibBackend(ax)).draw_layout(msp, finalize=False)
        ax.set_aspect("equal")
        ax.axis("off")
        ax.autoscale()
        png = salida.replace(".dxf", ".png")
        fig.savefig(png, dpi=150, facecolor="white")
        plt.close(fig)
        print("control ->", png)
    except ImportError:
        pass


if __name__ == "__main__":
    main()
