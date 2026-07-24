import type { CadDocument } from "./types";

/**
 * Genera el contenido textual de un archivo DXF (AutoCAD ASCII standard AC1015)
 * a partir de una estructura de datos `CadDocument`.
 */
export function exportCadDocumentToDxf(doc: CadDocument): string {
  const lines: string[] = [];

  const addLine = (code: number, value: string | number) => {
    lines.push(code.toString().padStart(3, " "));
    lines.push(value.toString());
  };

  // Header Section
  addLine(0, "SECTION");
  addLine(2, "HEADER");
  addLine(9, "$ACADVER");
  addLine(1, "AC1015"); // AutoCAD 2000 format
  addLine(9, "$INSUNITS");
  addLine(70, 4); // 4 = Millimeters
  addLine(0, "ENDSEC");

  // Tables Section (Layers)
  addLine(0, "SECTION");
  addLine(2, "TABLES");
  addLine(0, "TABLE");
  addLine(2, "LAYER");
  addLine(70, doc.layers.length);

  doc.layers.forEach((layer) => {
    addLine(0, "LAYER");
    addLine(2, layer.id);
    addLine(70, 0);
    addLine(62, 7); // Color blanco/negro por defecto o id color
    addLine(6, "CONTINUOUS");
  });

  addLine(0, "ENDTAB");

  // Tabla STYLE (Fuente ISOCPEUR)
  addLine(0, "TABLE");
  addLine(2, "STYLE");
  addLine(70, 1);
  addLine(0, "STYLE");
  addLine(2, "ISOCPEUR");
  addLine(70, 0);
  addLine(40, 0.0);
  addLine(41, 1.0);
  addLine(50, 0.0);
  addLine(71, 0);
  addLine(42, 0.2);
  addLine(3, "isocpeur.ttf");
  addLine(0, "ENDTAB");
  addLine(0, "ENDSEC");

  // Entities Section
  addLine(0, "SECTION");
  addLine(2, "ENTITIES");

  doc.primitives.forEach((prim) => {
    switch (prim.type) {
      case "line": {
        const lw = Math.round((prim.lineWidth || 1.5) * 15);
        addLine(0, "LINE");
        addLine(8, prim.layerId);
        addLine(370, lw); // Lineweight DXF en centésimas de mm
        addLine(10, prim.start.x.toFixed(3));
        addLine(20, (-prim.start.y).toFixed(3)); // DXF usa Y cartesiano invertido
        addLine(30, 0);
        addLine(11, prim.end.x.toFixed(3));
        addLine(21, (-prim.end.y).toFixed(3));
        addLine(31, 0);
        break;
      }
      case "rect": {
        // Un rectángulo DXF se exporta como una polilínea cerrada (LWPOLYLINE) o 4 líneas
        addLine(0, "LWPOLYLINE");
        addLine(8, prim.layerId);
        addLine(90, 4); // 4 vértices
        addLine(70, 1); // 1 = cerrada

        addLine(10, prim.x.toFixed(3));
        addLine(20, (-prim.y).toFixed(3));

        addLine(10, (prim.x + prim.width).toFixed(3));
        addLine(20, (-prim.y).toFixed(3));

        addLine(10, (prim.x + prim.width).toFixed(3));
        addLine(20, (-(prim.y + prim.height)).toFixed(3));

        addLine(10, prim.x.toFixed(3));
        addLine(20, (-(prim.y + prim.height)).toFixed(3));
        break;
      }
      case "circle": {
        addLine(0, "CIRCLE");
        addLine(8, prim.layerId);
        addLine(10, prim.cx.toFixed(3));
        addLine(20, (-prim.cy).toFixed(3));
        addLine(30, 0);
        addLine(40, prim.r.toFixed(3));
        break;
      }
      case "text": {
        addLine(0, "TEXT");
        addLine(8, prim.layerId);
        addLine(7, "ISOCPEUR");
        addLine(10, prim.x.toFixed(3));
        addLine(20, (-prim.y).toFixed(3));
        addLine(30, 0);
        addLine(40, (prim.fontSize || 3.5).toFixed(3));
        addLine(1, prim.text);

        if (prim.align === "center") {
          addLine(72, 1); // 1 = Center justification
          addLine(11, prim.x.toFixed(3));
          addLine(21, (-prim.y).toFixed(3));
          addLine(31, 0);
        } else if (prim.align === "right") {
          addLine(72, 2); // 2 = Right justification
          addLine(11, prim.x.toFixed(3));
          addLine(21, (-prim.y).toFixed(3));
          addLine(31, 0);
        }
        break;
      }
      case "dimension": {
        // Cota lineal simple como par de líneas y texto
        addLine(0, "LINE");
        addLine(8, prim.layerId);
        addLine(10, prim.start.x.toFixed(3));
        addLine(20, (-prim.start.y - prim.offset).toFixed(3));
        addLine(30, 0);
        addLine(11, prim.end.x.toFixed(3));
        addLine(21, (-prim.end.y - prim.offset).toFixed(3));
        addLine(31, 0);

        const distMm = Math.hypot(prim.end.x - prim.start.x, prim.end.y - prim.start.y);
        const midX = (prim.start.x + prim.end.x) / 2;
        const midY = (prim.start.y + prim.end.y) / 2 + prim.offset - 2;

        addLine(0, "TEXT");
        addLine(8, prim.layerId);
        addLine(10, midX.toFixed(3));
        addLine(20, (-midY).toFixed(3));
        addLine(30, 0);
        addLine(40, 3.5);
        addLine(1, prim.textOverride || `${Math.round(distMm)} mm`);
        break;
      }
      case "symbol": {
        // Representación simbólica en DXF como bloque de caja con texto
        addLine(0, "LWPOLYLINE");
        addLine(8, prim.layerId);
        addLine(90, 4);
        addLine(70, 1);
        addLine(10, (prim.x - 6).toFixed(3));
        addLine(20, (-(prim.y - 6)).toFixed(3));
        addLine(10, (prim.x + 6).toFixed(3));
        addLine(20, (-(prim.y - 6)).toFixed(3));
        addLine(10, (prim.x + 6).toFixed(3));
        addLine(20, (-(prim.y + 6)).toFixed(3));
        addLine(10, (prim.x - 6).toFixed(3));
        addLine(20, (-(prim.y + 6)).toFixed(3));

        if (prim.label) {
          addLine(0, "TEXT");
          addLine(8, prim.layerId);
          addLine(10, (prim.x - 5).toFixed(3));
          addLine(20, (-prim.y).toFixed(3));
          addLine(30, 0);
          addLine(40, 2.5);
          addLine(1, prim.label);
        }
        break;
      }
    }
  });

  addLine(0, "ENDSEC");
  addLine(0, "EOF");

  return lines.join("\n");
}

/**
 * Inicia la descarga automática del archivo .dxf en el navegador.
 */
export function downloadDxfFile(doc: CadDocument, filename = "tablero_cad.dxf") {
  const dxfContent = exportCadDocumentToDxf(doc);
  const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
