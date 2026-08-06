import sys
import os
from decimal import Decimal
from datetime import datetime

# Configure path
sys.path.append(os.path.abspath("."))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.database import SessionLocal
from app.models import CatalogoComponente, Usuario

def seed_construccion_data():
    db = SessionLocal()
    try:
        # Get first user for audit log / tracking
        usuario = db.query(Usuario).first()
        usuario_id = usuario.id if usuario else None

        # 1. NOLLMANN CABINETS (NIS)
        # Table Page 6 (NIS, Depth 225, Coef 1 Prof 225 used as price_neto)
        nis_cabinets = [
            # Code, Width, Height, Lines150, Polos150, Total150, Lines200, Polos200, Total200, Price
            ("NIS 300.300.XX", 300, 300, 1, 10, 10, 1, 10, 10, Decimal("50.00")),
            ("NIS 300.450.XX", 300, 450, 2, 10, 20, 2, 10, 20, Decimal("63.00")),
            ("NIS 450.450.XX", 450, 450, 2, 16, 32, 2, 16, 32, Decimal("75.00")),
            ("NIS 300.600.XX", 300, 600, 3, 10, 30, 2, 10, 20, Decimal("82.00")),
            ("NIS 450.600.XX", 450, 600, 3, 16, 48, 2, 16, 32, Decimal("84.00")),
            ("NIS 600.600.XX", 600, 600, 3, 24, 72, 2, 24, 48, Decimal("128.00")),
            ("NIS 300.750.XX", 300, 750, 4, 10, 40, 3, 10, 30, Decimal("102.00")),
            ("NIS 450.750.XX", 450, 750, 4, 16, 64, 3, 16, 48, Decimal("120.00")),
            ("NIS 600.750.XX", 600, 750, 4, 24, 96, 3, 24, 72, Decimal("145.00")),
            ("NIS 750.750.XX", 750, 750, 4, 32, 128, 3, 32, 96, Decimal("187.00")),
            ("NIS 300.900.XX", 300, 900, 5, 10, 50, 4, 10, 40, Decimal("129.00")),
            ("NIS 450.900.XX", 450, 900, 5, 16, 80, 4, 16, 64, Decimal("154.00")),
            ("NIS 600.900.XX", 600, 900, 5, 24, 120, 4, 24, 96, Decimal("172.00")),
            ("NIS 750.900.XX", 750, 900, 5, 32, 160, 4, 32, 128, Decimal("210.00")),
            ("NIS 300.1050.XX", 300, 1050, 6, 10, 60, 5, 10, 50, Decimal("154.00")),
            ("NIS 450.1050.XX", 450, 1050, 6, 16, 96, 5, 16, 80, Decimal("184.00")),
            ("NIS 600.1050.XX", 600, 1050, 6, 24, 144, 5, 24, 120, Decimal("209.00")),
            ("NIS 750.1050.XX", 750, 1050, 6, 32, 192, 5, 32, 160, Decimal("264.00")),
            ("NIS 300.1200.XX", 300, 1200, 6, 10, 60, 6, 10, 60, Decimal("170.00")),
            ("NIS 450.1200.XX", 450, 1200, 7, 16, 112, 6, 16, 96, Decimal("203.00")),
            ("NIS 600.1200.XX", 600, 1200, 7, 24, 168, 6, 24, 144, Decimal("235.00")),
            ("NIS 750.1200.XX", 750, 1200, 7, 32, 224, 6, 32, 192, Decimal("300.00")),
            ("NIS 600.1350.XX", 600, 1350, 8, 24, 192, 6, 24, 144, Decimal("401.00")),
            ("NIS 750.1350.XX", 750, 1350, 8, 32, 256, 6, 32, 192, Decimal("473.00")),
            ("NIS 1000.1350.XX", 1000, 1350, 8, 45, 360, 6, 45, 270, Decimal("605.00")),
            ("NIS 600.1500.XX", 600, 1500, 9, 24, 216, 7, 24, 168, Decimal("400.00")),
            ("NIS 750.1500.XX", 750, 1500, 9, 32, 288, 7, 32, 224, Decimal("476.00")),
            ("NIS 600.1650.XX", 600, 1650, 10, 24, 240, 8, 24, 192, Decimal("429.00")),
            ("NIS 750.1650.XX", 750, 1650, 10, 32, 320, 8, 32, 256, Decimal("506.00")),
            ("NIS 600.1800.XX", 600, 1800, 11, 24, 264, 9, 24, 216, Decimal("462.00")),
            ("NIS 750.1800.XX", 750, 1800, 11, 32, 352, 9, 32, 288, Decimal("544.00")),
            ("NIS 600.2000.XX", 600, 2000, 12, 24, 288, 9, 24, 216, Decimal("460.00")),
            ("NIS 750.2000.XX", 750, 2000, 12, 32, 384, 9, 32, 288, Decimal("600.00")),
        ]

        print("Seeding Nollmann NIS Cabinets...")
        for code, w, h, l150, p150, t150, l200, p200, t200, price in nis_cabinets:
            # Check if exists
            existing = db.query(CatalogoComponente).filter(
                CatalogoComponente.proveedor == "Nollmann",
                CatalogoComponente.codigo == code
            ).first()

            attrs = {
                "tipo": "gabinete",
                "ancho_mm": w,
                "alto_mm": h,
                "profundidad_mm": 225,
                "lineas_150": l150,
                "polos_linea_150": p150,
                "total_polos_150": t150,
                "lineas_200": l200,
                "polos_linea_200": p200,
                "total_polos_200": t200,
            }

            if not existing:
                comp = CatalogoComponente(
                    proveedor="Nollmann",
                    codigo=code,
                    codigo_comercial=code,
                    categoria_path=["Gabinetes", "Nöll Box"],
                    categoria_raiz="Gabinetes",
                    descripcion=f"Gabinete Nöll Box Metálico Estanco NIS {w}x{h}x225 mm",
                    unidad="U",
                    precio_lista=price,
                    precio_neto=price,
                    atributos=attrs,
                    archivo_origen="nollman_6.pdf",
                    fila_origen=0,
                )
                db.add(comp)
            else:
                existing.atributos = attrs
                existing.precio_neto = price
                existing.precio_lista = price

        # 2. NÖLLMED DISTRIBUTORS (NRT and BD Series)
        distributors = [
            # Code, Desc, Current, Connections, Price, Original File, Series
            ("NRT125BB", "Distribuidor NRT 3+N 125A Riel DIN (Cu 12x4 M5)", 125, 10, Decimal("41.60"), "nollman_110.pdf", "NRT"),
            ("NRT125", "Distribuidor NRT 3+N 125A Riel DIN (Cu 12x4 M5)", 125, 10, Decimal("53.30"), "nollman_110.pdf", "NRT"),
            ("NRT160", "Distribuidor NRT 3+N 160A Riel DIN (Cu 16x4 M6)", 160, 12, Decimal("72.80"), "nollman_110.pdf", "NRT"),
            ("NRT200", "Distribuidor NRT 3+N 200A Riel DIN (Cu 20x4 M6)", 200, 12, Decimal("86.00"), "nollman_110.pdf", "NRT"),
            ("NRT250", "Distribuidor NRT 3+N 250A Riel DIN (Paso 40mm)", 250, 15, Decimal("120.00"), "nollman_110.pdf", "NRT"),
            # BD Series (20x4 -> 200A, 20x3 -> 160A, 20x2 -> 125A)
            ("BD20415", "Distribuidor BD 4 barras 20x4 mm 15 conexiones 200A", 200, 15, Decimal("164.30"), "nollman_110.pdf", "BD"),
            ("BD20430", "Distribuidor BD 4 barras 20x4 mm 30 conexiones 200A", 200, 30, Decimal("234.30"), "nollman_110.pdf", "BD"),
            ("BD20445", "Distribuidor BD 4 barras 20x4 mm 45 conexiones 200A", 200, 45, Decimal("325.30"), "nollman_110.pdf", "BD"),
            ("BD20312", "Distribuidor BD 4 barras 20x3 mm 12 conexiones 160A", 160, 12, Decimal("133.90"), "nollman_110.pdf", "BD"),
            ("BD20324", "Distribuidor BD 4 barras 20x3 mm 24 conexiones 160A", 160, 24, Decimal("195.00"), "nollman_110.pdf", "BD"),
            ("BD20336", "Distribuidor BD 4 barras 20x3 mm 36 conexiones 160A", 160, 36, Decimal("260.00"), "nollman_110.pdf", "BD"),
            ("BD20212", "Distribuidor BD 4 barras 20x2 mm 12 conexiones 125A", 125, 12, Decimal("93.30"), "nollman_110.pdf", "BD"),
            ("BD20224", "Distribuidor BD 4 barras 20x2 mm 24 conexiones 125A", 125, 24, Decimal("130.00"), "nollman_110.pdf", "BD"),
            ("BD20236", "Distribuidor BD 4 barras 20x2 mm 36 conexiones 125A", 125, 36, Decimal("182.00"), "nollman_110.pdf", "BD"),
            # BD Series (30x4 -> 250A, 30x3 -> 200A, 30x2 -> 160A)
            ("BD30418", "Distribuidor BD 4 barras 30x4 mm 18 conexiones 250A", 250, 18, Decimal("218.90"), "nollman_110.pdf", "BD"),
            ("BD30424", "Distribuidor BD 4 barras 30x4 mm 24 conexiones 250A", 250, 24, Decimal("320.30"), "nollman_110.pdf", "BD"),
            ("BD30436", "Distribuidor BD 4 barras 30x4 mm 38 conexiones 250A", 250, 38, Decimal("417.40"), "nollman_110.pdf", "BD"),
            ("BD30318", "Distribuidor BD 4 barras 30x3 mm 18 conexiones 200A", 200, 18, Decimal("143.00"), "nollman_110.pdf", "BD"),
            ("BD30324", "Distribuidor BD 4 barras 30x3 mm 24 conexiones 200A", 200, 24, Decimal("234.00"), "nollman_110.pdf", "BD"),
            ("BD30336", "Distribuidor BD 4 barras 30x3 mm 38 conexiones 200A", 200, 38, Decimal("348.40"), "nollman_110.pdf", "BD"),
            ("BD30218", "Distribuidor BD 4 barras 30x2 mm 18 conexiones 160A", 160, 18, Decimal("130.00"), "nollman_110.pdf", "BD"),
            ("BD30224", "Distribuidor BD 4 barras 30x2 mm 24 conexiones 160A", 160, 24, Decimal("182.00"), "nollman_110.pdf", "BD"),
            ("BD30236", "Distribuidor BD 4 barras 30x2 mm 38 conexiones 160A", 160, 38, Decimal("236.60"), "nollman_110.pdf", "BD"),
        ]

        print("Seeding Nöllmed Distributors...")
        for code, desc, current, connections, price, file, series in distributors:
            existing = db.query(CatalogoComponente).filter(
                CatalogoComponente.proveedor == "Nöllmed",
                CatalogoComponente.codigo == code
            ).first()

            attrs = {
                "tipo": "distribuidor",
                "corriente_nominal_a": current,
                "conexiones": connections,
                "series": series
            }

            if not existing:
                comp = CatalogoComponente(
                    proveedor="Nöllmed",
                    codigo=code,
                    codigo_comercial=code,
                    categoria_path=["Distribuidores", f"Serie {series}"],
                    categoria_raiz="Distribuidores",
                    descripcion=desc,
                    unidad="U",
                    precio_lista=price,
                    precio_neto=price,
                    atributos=attrs,
                    archivo_origen=file,
                    fila_origen=0,
                )
                db.add(comp)
            else:
                existing.atributos = attrs
                existing.precio_neto = price
                existing.precio_lista = price

        # 3. ABB MAIN BREAKERS (125A, 250A, 320A)
        main_breakers = [
            ("1SDA066807R1", "XT1B 160 TMD 125-1250 4p F F", "ABB Tmax XT1B 125A 4P", 125, 4, 25, Decimal("320.00")),
            ("1SDA068062R1", "XT3N 250 TMD 250-2500 4p F F", "ABB Tmax XT3N 250A 4P", 250, 4, 36, Decimal("580.00")),
            ("1SDA100150R1", "XT4N 320 TMA 320-3200 4p F F", "ABB Tmax XT4N 320A 4P", 320, 4, 36, Decimal("890.00")),
        ]

        print("Seeding ABB Main Breakers (125A, 250A, 320A)...")
        for code, code_com, desc, current, poles, kA, price in main_breakers:
            existing = db.query(CatalogoComponente).filter(
                CatalogoComponente.proveedor == "ABB",
                CatalogoComponente.codigo == code
            ).first()

            attrs = {
                "tipo": "termomagnetico",
                "polos": poles,
                "corriente_nominal_a": current,
                "capacidad_corte_ka": kA,
            }

            if not existing:
                comp = CatalogoComponente(
                    proveedor="ABB",
                    codigo=code,
                    codigo_comercial=code_com,
                    categoria_path=["Interruptores Termomagnéticos", "Caja Moldeada (MCCB)"],
                    categoria_raiz="Interruptores Termomagnéticos",
                    descripcion=desc,
                    unidad="U",
                    precio_lista=price,
                    precio_neto=price,
                    atributos=attrs,
                    archivo_origen="abb_mccb.pdf",
                    fila_origen=0,
                )
                db.add(comp)
            else:
                existing.atributos = attrs
                existing.precio_neto = price
                existing.precio_lista = price

        db.commit()
        print("¡Gabinetes, distribuidores e interruptores sembrados con éxito en la base de datos!")
    except Exception as e:
        db.rollback()
        print(f"Error al sembrar datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_construccion_data()
