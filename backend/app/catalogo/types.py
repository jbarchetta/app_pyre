from dataclasses import dataclass
from decimal import Decimal


@dataclass
class ComponenteImportado:
    proveedor: str
    codigo: str
    codigo_comercial: str | None
    categoria_path: list[str]
    descripcion: str
    unidad: str
    precio_lista: Decimal | None
    precio_neto: Decimal | None
    archivo_origen: str
    fila_origen: int
