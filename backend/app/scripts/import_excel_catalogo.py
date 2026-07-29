import io
import os
from app.catalogo.parser_abb import parse_abb_workbook
from app.catalogo.parser_otros import parse_otros_workbook
from app.catalogo.upsert import upsert_componentes
from app.database import SessionLocal
from app.models import Usuario


def import_excel_catalogo():
    # Detect ABB
    abb_paths = [
        "/app/R-IN-003_ABB.xlsx",
        "R-IN-003_ABB.xlsx",
        "samples/catalogo/R-IN-003 ABB 2026 06 - 26-XXX-XXX V1.xlsx",
        "../samples/catalogo/R-IN-003 ABB 2026 06 - 26-XXX-XXX V1.xlsx",
    ]
    abb_path = next((p for p in abb_paths if os.path.exists(p)), None)

    # Detect Otros (PYRE)
    otros_paths = [
        "/app/1-Lista_de_Precios_2025.xlsx",
        "1-Lista_de_Precios_2025.xlsx",
        "samples/catalogo/1-Lista de Precios 2025.xlsx",
        "../samples/catalogo/1-Lista de Precios 2025.xlsx",
    ]
    otros_path = next((p for p in otros_paths if os.path.exists(p)), None)

    db = SessionLocal()
    try:
        usuario = db.query(Usuario).first()
        usuario_id = usuario.id if usuario else None

        if abb_path:
            print(f"Importando catálogo ABB desde: {abb_path}...")
            with open(abb_path, "rb") as f:
                contenido = f.read()
            items = parse_abb_workbook(io.BytesIO(contenido), archivo_origen=os.path.basename(abb_path))
            print(f"Filas procesadas (ABB): {len(items)}")
            resultado = upsert_componentes(db, items, usuario_id=usuario_id)
            print("Resultado import ABB:", resultado)
        else:
            print("Catálogo ABB no encontrado en las rutas especificadas.")

        if otros_path:
            print(f"Importando catálogo PYRE (Otros) desde: {otros_path}...")
            with open(otros_path, "rb") as f:
                contenido = f.read()
            items = parse_otros_workbook(io.BytesIO(contenido), archivo_origen=os.path.basename(otros_path))
            print(f"Filas procesadas (Otros): {len(items)}")
            resultado = upsert_componentes(db, items, usuario_id=usuario_id)
            print("Resultado import PYRE/Otros:", resultado)
        else:
            print("Catálogo PYRE (Otros) no encontrado en las rutas especificadas.")

    finally:
        db.close()


if __name__ == "__main__":
    import_excel_catalogo()
