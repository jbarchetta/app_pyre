# Generador paramétrico de armarios Nollmann (DXF)

Genera la vista frontal de armarios eléctricos Nollmann (NOLLBOX) en DXF desde
un solo script, para cualquier medida — de catálogo o arbitraria.

## Por qué este generador y no el anterior

El primer intento (`generar_armario_dxf.py` en la raíz del repo) dibujaba el
armario con medidas inventadas a ojo (marco de 600, rieles de 413 mm, separación
de 140 mm) que **no coincidían con ningún NOLLBOX real**. Por eso el resultado
nunca era correcto.

Este generador está anclado en la geometría **medida** de los cuatro DXF base de
Nollmann (`frontend/public/dxf/NOLLBOX *.dxf`). Las reglas se derivaron
comparando los cuatro tamaños entre sí, no adivinando:

| Regla | Valor | Verificado en |
|---|---|---|
| Marco dibujado | nominal − 38 mm | 450→412, 600→562, 750→712, 1050→1012 |
| Marcos concéntricos (offset por lado) | 1.6 / 6.9 / 8.5 mm | idénticos en 450 y 600 de ancho |
| Placa de montaje (offset por lado) | 35.5 mm | idem |
| Cantidad de rieles DIN | round(alto / 150) − 1 | 600→3, 750→4, 1050→6 |
| Separación entre rieles | 150 mm exactos | los cuatro base |
| Alto de perfil del riel | 45 mm | los cuatro base |

## Uso

```bash
# desde generador_armarios/, con el venv del backend (tiene ezdxf y matplotlib):
../backend/venv/Scripts/python.exe generar_armario.py            # catálogo estándar
../backend/venv/Scripts/python.exe generar_armario.py 600x750    # una medida puntual
../backend/venv/Scripts/python.exe generar_armario.py 800x1200   # medida arbitraria
../backend/venv/Scripts/python.exe generar_armario.py --sin-png  # solo DXF
```

Cada armario produce, en `salida/`:
- `armario_ANCHOxALTO.dxf` — DXF R2010 en milímetros, con capas `GABINETE`,
  `PLACA` y `RIELES`, y polilíneas cerradas (verificado: 0 errores de auditoría
  al releerlo con ezdxf).
- `armario_ANCHOxALTO.png` — render de control para revisar la vista sin abrir
  un CAD (requiere matplotlib; si no está, se omite sin error).

## Dependencias

- `ezdxf` — obligatorio.
- `matplotlib` — opcional, solo para el PNG de control.

Ambas ya están instaladas en `backend/venv`.

## Alcance actual y próximos pasos

Hoy genera la **vista frontal** (marcos + placa + rieles), que es la base
geométrica correcta. Extensiones naturales, en orden de utilidad:

1. Carátula con cuadro de rótulo (código de armario, cliente, medidas).
2. Puertas de cables / troqueles laterales según la variante NOLLBOX.
3. Colocación de los módulos (interruptores) sobre los rieles a partir del BOM,
   para pasar de "armario vacío" a "armario poblado".
