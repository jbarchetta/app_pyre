import { describe, it, expect } from "vitest";
import { exportCadDocumentToDxf } from "./dxfExporter";
import type { CadDocument } from "./types";

describe("dxfExporter module", () => {
  it("exports a valid DXF string with HEADER, TABLES, ENTITIES and EOF", () => {
    const doc: CadDocument = {
      title: "Test Tablero CAD",
      layers: [{ id: "0_Gabinete", name: "Gabinete", color: "#000000", visible: true, locked: false }],
      primitives: [
        {
          id: "rect1",
          layerId: "0_Gabinete",
          type: "rect",
          x: 0,
          y: 0,
          width: 600,
          height: 800,
        },
        {
          id: "line1",
          layerId: "0_Gabinete",
          type: "line",
          start: { x: 0, y: 0 },
          end: { x: 600, y: 800 },
        },
        {
          id: "text1",
          layerId: "0_Gabinete",
          type: "text",
          x: 100,
          y: 200,
          text: "GABINETE PRINCIPAL 600x800",
          fontSize: 10,
        },
      ],
      bounds: { minX: 0, minY: 0, maxX: 600, maxY: 800 },
    };

    const dxfString = exportCadDocumentToDxf(doc);

    expect(dxfString).toContain("SECTION");
    expect(dxfString).toContain("HEADER");
    expect(dxfString).toContain("AC1015");
    expect(dxfString).toContain("LWPOLYLINE");
    expect(dxfString).toContain("LINE");
    expect(dxfString).toContain("TEXT");
    expect(dxfString).toContain("GABINETE PRINCIPAL 600x800");
    expect(dxfString).toContain("EOF");
  });
});
