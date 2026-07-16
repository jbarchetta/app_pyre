import io
from decimal import Decimal

import openpyxl

from app.catalogo.parser_otros import parse_otros_workbook


def _build_sample_workbook() -> io.BytesIO:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lista de Precios"

    ws.cell(row=4, column=1, value="Accesorios Tableros")
    ws.cell(row=6, column=2, value="Cable Canal Ranurado")
    header_cols = {2: "Cod", 3: "Unidad", 4: "Descripcion", 7: "Precio Lista ((U$S)", 10: "Total U$S)"}
    for col, label in header_cols.items():
        ws.cell(row=8, column=col, value=label)
    ws.cell(row=9, column=2, value="A00000")
    ws.cell(row=9, column=3, value="Un.")
    ws.cell(row=9, column=4, value="Cable Canal Ranurado 15x15")
    ws.cell(row=9, column=10, value=4.78)

    ws.cell(row=12, column=1, value="Gabinetes")
    ws.cell(row=13, column=2, value="SELECCION DE GABINETES A MEDIDA")
    ws.cell(row=14, column=4, value="NOLLMED")

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def test_parses_data_rows_with_local_header_and_breadcrumb():
    resultados = parse_otros_workbook(_build_sample_workbook(), archivo_origen="test.xlsx")

    assert len(resultados) == 1
    item = resultados[0]
    assert item.codigo == "A00000"
    assert item.categoria_path == ["Accesorios Tableros", "Cable Canal Ranurado"]
    assert item.precio_neto == Decimal("4.78")
    assert item.precio_lista is None
    assert item.proveedor == "OTROS"
    assert item.unidad == "Un."
    assert item.fila_origen == 9


def test_section_without_cod_header_yields_no_rows():
    resultados = parse_otros_workbook(_build_sample_workbook(), archivo_origen="test.xlsx")

    gabinetes = [r for r in resultados if r.categoria_path[0] == "Gabinetes"]
    assert gabinetes == []
