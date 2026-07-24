import DxfParser from "dxf-parser";
import type { CadPrimitive } from "./types";

export function parseDxfToCadPrimitives(dxfText: string, layerId = "4_Unifilar"): CadPrimitive[] {
  const parser = new DxfParser();
  const primitives: CadPrimitive[] = [];

  try {
    const dxf = parser.parseSync(dxfText);
    if (!dxf || !dxf.entities) return primitives;

    dxf.entities.forEach((entity: any, idx: number) => {
      switch (entity.type) {
        case "LINE": {
          primitives.push({
            id: `dxf-line-${idx}`,
            layerId,
            type: "line",
            start: { x: entity.vertices[0].x, y: -entity.vertices[0].y },
            end: { x: entity.vertices[1].x, y: -entity.vertices[1].y },
          });
          break;
        }
        case "LWPOLYLINE":
        case "POLYLINE": {
          if (entity.vertices && entity.vertices.length > 1) {
            for (let i = 0; i < entity.vertices.length - 1; i++) {
              primitives.push({
                id: `dxf-poly-${idx}-${i}`,
                layerId,
                type: "line",
                start: { x: entity.vertices[i].x, y: -entity.vertices[i].y },
                end: { x: entity.vertices[i + 1].x, y: -entity.vertices[i + 1].y },
              });
            }
            if (entity.shape) { // Polilínea cerrada
              const last = entity.vertices.length - 1;
              primitives.push({
                id: `dxf-poly-close-${idx}`,
                layerId,
                type: "line",
                start: { x: entity.vertices[last].x, y: -entity.vertices[last].y },
                end: { x: entity.vertices[0].x, y: -entity.vertices[0].y },
              });
            }
          }
          break;
        }
        case "CIRCLE": {
          primitives.push({
            id: `dxf-circle-${idx}`,
            layerId,
            type: "circle",
            cx: entity.center.x,
            cy: -entity.center.y,
            r: entity.radius,
          });
          break;
        }
        case "TEXT":
        case "MTEXT": {
          const rawText = entity.text || "";
          // Limpiar códigos de formato de MText de AutoCAD (ej. \C18;\c0;...)
          const cleanText = rawText.replace(/\\C\d+;|\\[fF][^;]+;|\\H[^;]+;|\\W[^;]+;|\^[CA]/g, "").trim();

          if (cleanText) {
            primitives.push({
              id: `dxf-text-${idx}`,
              layerId,
              type: "text",
              x: entity.position ? entity.position.x : entity.startPoint.x,
              y: entity.position ? -entity.position.y : -entity.startPoint.y,
              text: cleanText,
              fontSize: entity.height || 3.5,
            });
          }
          break;
        }
      }
    });
  } catch (err) {
    console.warn("Error parseando DXF:", err);
  }

  return primitives;
}

export async function loadDxfFromUrl(url: string, layerId = "4_Unifilar"): Promise<CadPrimitive[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    return parseDxfToCadPrimitives(text, layerId);
  } catch {
    return [];
  }
}
