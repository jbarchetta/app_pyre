import DxfParser from "dxf-parser";
import type { CadPrimitive } from "./types";
import type { DxfSymbolBlock } from "../symbols/symbolRegistry";

export function parseDxfToCadPrimitives(dxfText: string, layerId = "4_Unifilar"): CadPrimitive[] {
  const parser = new DxfParser();
  const primitives: CadPrimitive[] = [];

  try {
    const dxf = parser.parseSync(dxfText);
    if (!dxf || !dxf.entities) return primitives;

    dxf.entities.forEach((entity: any, idx: number) => {
      // Filtrar anotaciones o entidades fuera de rango (X > 300) si es un dibujo centrado
      switch (entity.type) {
        case "LINE": {
          if (entity.vertices && entity.vertices.length >= 2) {
            primitives.push({
              id: `dxf-line-${idx}`,
              layerId,
              type: "line",
              start: { x: entity.vertices[0].x, y: -entity.vertices[0].y },
              end: { x: entity.vertices[1].x, y: -entity.vertices[1].y },
            });
          }
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
            if (entity.shape) {
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
          if (entity.center && entity.radius != null) {
            primitives.push({
              id: `dxf-circle-${idx}`,
              layerId,
              type: "circle",
              cx: entity.center.x,
              cy: -entity.center.y,
              r: entity.radius,
            });
          }
          break;
        }
        case "ARC": {
          if (entity.center && entity.radius != null) {
            let start = entity.startAngle ?? 0;
            let end = entity.endAngle ?? (Math.PI * 2);
            if (end < start) end += Math.PI * 2;
            const steps = Math.max(4, Math.ceil((end - start) / (Math.PI / 4)));
            for (let i = 0; i < steps; i++) {
              const a1 = start + (i * (end - start)) / steps;
              const a2 = start + ((i + 1) * (end - start)) / steps;
              primitives.push({
                id: `dxf-arc-${idx}-${i}`,
                layerId,
                type: "line",
                start: {
                  x: entity.center.x + entity.radius * Math.cos(a1),
                  y: -(entity.center.y + entity.radius * Math.sin(a1)),
                },
                end: {
                  x: entity.center.x + entity.radius * Math.cos(a2),
                  y: -(entity.center.y + entity.radius * Math.sin(a2)),
                },
              });
            }
          }
          break;
        }
        case "ELLIPSE": {
          if (entity.center && entity.majorAxisEndPoint) {
            const v = entity.majorAxisEndPoint;
            const rMajor = Math.hypot(v.x, v.y);
            const ratio = entity.axisRatio ?? 1;
            const rMinor = rMajor * ratio;
            const angleMajor = Math.atan2(v.y, v.x);
            let start = entity.startAngle ?? 0;
            let end = entity.endAngle ?? (Math.PI * 2);
            if (end < start) end += Math.PI * 2;
            const steps = Math.max(6, Math.ceil((end - start) / (Math.PI / 4)));

            const getPoint = (t: number) => {
              const cosT = Math.cos(t);
              const sinT = Math.sin(t);
              const cosA = Math.cos(angleMajor);
              const sinA = Math.sin(angleMajor);
              const px = entity.center.x + rMajor * cosT * cosA - rMinor * sinT * sinA;
              const py = entity.center.y + rMajor * cosT * sinA + rMinor * sinT * cosA;
              return { x: px, y: -py };
            };

            for (let i = 0; i < steps; i++) {
              const t1 = start + (i * (end - start)) / steps;
              const t2 = start + ((i + 1) * (end - start)) / steps;
              primitives.push({
                id: `dxf-ellipse-${idx}-${i}`,
                layerId,
                type: "line",
                start: getPoint(t1),
                end: getPoint(t2),
              });
            }
          }
          break;
        }
        case "SPLINE": {
          const pts = entity.controlPoints || entity.fitPoints || entity.points;
          if (pts && pts.length > 1) {
            for (let i = 0; i < pts.length - 1; i++) {
              primitives.push({
                id: `dxf-spline-${idx}-${i}`,
                layerId,
                type: "line",
                start: { x: pts[i].x, y: -pts[i].y },
                end: { x: pts[i + 1].x, y: -pts[i + 1].y },
              });
            }
          }
          break;
        }
        case "TEXT":
        case "MTEXT": {
          const rawText = entity.text || "";
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

export function parseDxfToSymbolBlock(
  dxfText: string,
  symbolId: string,
  name: string,
  targetWidthMm?: number,
  targetHeightMm?: number
): DxfSymbolBlock {
  const rawPrimitives = parseDxfToCadPrimitives(dxfText, "1_Equipos_DIN");
  if (rawPrimitives.length === 0) {
    return { id: symbolId, name, widthMm: targetWidthMm || 70, heightMm: targetHeightMm || 88, primitives: [] };
  }

  // Filtrar entidades fuera de rango (como cotas o marcas distantes a X > 300)
  const validPrims = rawPrimitives.filter((p) => {
    if (p.type === "line") return p.start.x < 300 && p.end.x < 300;
    if (p.type === "circle") return p.cx < 300;
    if (p.type === "text") return p.x < 300;
    return true;
  });

  const primsToUse = validPrims.length > 0 ? validPrims : rawPrimitives;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  primsToUse.forEach((p) => {
    if (p.type === "line") {
      minX = Math.min(minX, p.start.x, p.end.x);
      maxX = Math.max(maxX, p.start.x, p.end.x);
      minY = Math.min(minY, p.start.y, p.end.y);
      maxY = Math.max(maxY, p.start.y, p.end.y);
    } else if (p.type === "circle") {
      minX = Math.min(minX, p.cx - p.r);
      maxX = Math.max(maxX, p.cx + p.r);
      minY = Math.min(minY, p.cy - p.r);
      maxY = Math.max(maxY, p.cy + p.r);
    } else if (p.type === "text") {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  });

  const rawWidth = Math.max(1, maxX - minX);
  const rawHeight = Math.max(1, maxY - minY);

  // Escala uniforme 1:1 para preservar perfectamente las proporciones originales de AutoCAD sin deformar
  const scale = targetWidthMm ? targetWidthMm / rawWidth : 1;
  const finalWidth = targetWidthMm || rawWidth;
  const finalHeight = rawHeight * scale;

  const normalizedPrimitives: Omit<CadPrimitive, "id" | "layerId">[] = primsToUse.map((p) => {
    if (p.type === "line") {
      return {
        type: "line",
        start: { x: (p.start.x - minX) * scale, y: (p.start.y - minY) * scale },
        end: { x: (p.end.x - minX) * scale, y: (p.end.y - minY) * scale },
        color: "auto",
        lineWidth: 1,
      };
    }
    if (p.type === "circle") {
      return {
        type: "circle",
        cx: (p.cx - minX) * scale,
        cy: (p.cy - minY) * scale,
        r: p.r * scale,
        color: "auto",
        lineWidth: 1,
      };
    }
    if (p.type === "text") {
      return {
        type: "text",
        x: (p.x - minX) * scale,
        y: (p.y - minY) * scale,
        text: p.text,
        fontSize: Math.max(2, p.fontSize * scale),
        color: "auto",
      };
    }
    return p as any;
  });

  return {
    id: symbolId,
    name,
    widthMm: finalWidth,
    heightMm: finalHeight,
    primitives: normalizedPrimitives,
  };
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
