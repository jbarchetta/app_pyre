from decimal import Decimal

import openpyxl

from app.catalogo.types import ComponenteImportado


def parse_abb_workbook(file_obj, archivo_origen: str) -> list[ComponenteImportado]:
    wb = openpyxl.load_workbook(file_obj, data_only=True)
    ws = wb[_find_lista_de_precios_sheet(wb)]
    header_map = _read_header_map(ws, header_row=1)

    resultados: list[ComponenteImportado] = []
    path: list[tuple[tuple[float, bool], str]] = []

    codigo_col = header_map["Codigo SAP"]
    comercial_col = header_map["Codigo Comercial"]

    for row_idx in range(3, ws.max_row + 1):
        codigo_cell = ws.cell(row=row_idx, column=codigo_col)
        comercial_cell = ws.cell(row=row_idx, column=comercial_col)

        if codigo_cell.value is None and comercial_cell.value is not None:
            texto = str(comercial_cell.value).strip()
            if texto:
                firma = (comercial_cell.font.sz, bool(comercial_cell.font.bold))
                _update_path(path, firma, texto)
        elif codigo_cell.value is not None:
            resultados.append(_build_componente(ws, row_idx, header_map, path, archivo_origen))

    return resultados


def _find_lista_de_precios_sheet(wb) -> str:
    candidatos = [s for s in wb.sheetnames if s.strip().lower().startswith("lista de precios")]
    if len(candidatos) != 1:
        raise ValueError(f"Se esperaba exactamente una pestaña 'Lista de Precios...', se encontraron: {candidatos}")
    return candidatos[0]


def _read_header_map(ws, header_row: int) -> dict[str, int]:
    header_map = {}
    for col in range(1, ws.max_column + 1):
        value = ws.cell(row=header_row, column=col).value
        if value:
            header_map[str(value).strip()] = col
    return header_map


def _update_path(path: list[tuple[tuple, str]], firma: tuple, texto: str) -> None:
    for i, (existing_firma, _) in enumerate(path):
        if existing_firma == firma:
            del path[i:]
            break
    path.append((firma, texto))


def _decimal_or_none(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _build_componente(ws, row_idx, header_map, path, archivo_origen) -> ComponenteImportado:
    def cell(label):
        col = header_map.get(label)
        return ws.cell(row=row_idx, column=col).value if col else None

    comercial = cell("Codigo Comercial")
    return ComponenteImportado(
        proveedor="ABB",
        codigo=str(cell("Codigo SAP")).strip(),
        codigo_comercial=str(comercial).strip() if comercial else None,
        categoria_path=[texto for _, texto in path],
        descripcion=str(cell("Descripcion") or "").strip(),
        unidad="Unidad",
        precio_lista=_decimal_or_none(cell("Precio de Lista USD")),
        precio_neto=_decimal_or_none(cell("Precio NETO USD")),
        archivo_origen=archivo_origen,
        fila_origen=row_idx,
    )
