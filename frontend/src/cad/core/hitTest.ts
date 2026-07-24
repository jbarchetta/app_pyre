import type { CadPoint, CadPrimitive } from "./types";

/**
 * Distancia mínima de un punto `p` a un segmento `ab`.
 */
export function distanceToSegment(p: CadPoint, a: CadPoint, b: CadPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Determina si un punto está dentro de un rectángulo.
 */
export function pointInRect(p: CadPoint, x: number, y: number, width: number, height: number): boolean {
  return p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height;
}

/**
 * Busca la primera primitiva interactiva en las capas activas bajo el punto `point` (mm).
 */
export function findPrimitiveAtPoint(
  point: CadPoint,
  primitives: CadPrimitive[],
  activeLayerIds: Set<string>,
  toleranceMm = 3
): CadPrimitive | null {
  // Recorrer en orden inverso (las más superiores primero)
  for (let i = primitives.length - 1; i >= 0; i--) {
    const prim = primitives[i];
    if (prim.interactive === false || !activeLayerIds.has(prim.layerId)) {
      continue;
    }

    switch (prim.type) {
      case "rect": {
        if (pointInRect(point, prim.x, prim.y, prim.width, prim.height)) {
          return prim;
        }
        break;
      }
      case "line": {
        if (distanceToSegment(point, prim.start, prim.end) <= toleranceMm) {
          return prim;
        }
        break;
      }
      case "circle": {
        const dist = Math.hypot(point.x - prim.cx, point.y - prim.cy);
        if (dist <= prim.r + toleranceMm) {
          return prim;
        }
        break;
      }
      case "symbol": {
        // Área aproximada del símbolo de 24x24 mm centrada/offset
        if (pointInRect(point, prim.x - 12, prim.y - 12, 24, 24)) {
          return prim;
        }
        break;
      }
    }
  }
  return null;
}

/**
 * Redondea las coordenadas al punto de grilla más cercano.
 */
export function snapToGrid(point: CadPoint, gridSizeMm = 10): CadPoint {
  if (gridSizeMm <= 0) return point;
  return {
    x: Math.round(point.x / gridSizeMm) * gridSizeMm,
    y: Math.round(point.y / gridSizeMm) * gridSizeMm,
  };
}
