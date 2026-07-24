import { describe, it, expect } from "vitest";
import { distanceToSegment, pointInRect, findPrimitiveAtPoint, snapToGrid } from "./hitTest";
import type { CadPrimitive } from "./types";

describe("hitTest module", () => {
  it("calculates distance to line segment correctly", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };

    expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3);
    expect(distanceToSegment({ x: -2, y: 0 }, a, b)).toBeCloseTo(2);
    expect(distanceToSegment({ x: 14, y: 3 }, a, b)).toBeCloseTo(5);
  });

  it("checks point in rect correctly", () => {
    expect(pointInRect({ x: 15, y: 15 }, 10, 10, 20, 20)).toBe(true);
    expect(pointInRect({ x: 5, y: 15 }, 10, 10, 20, 20)).toBe(false);
  });

  it("snaps point to grid", () => {
    expect(snapToGrid({ x: 14, y: 26 }, 10)).toEqual({ x: 10, y: 30 });
    expect(snapToGrid({ x: 12.3, y: 17.8 }, 5)).toEqual({ x: 10, y: 20 });
  });

  it("finds primitive at point considering layers and interactivity", () => {
    const rect: CadPrimitive = {
      id: "rect1",
      layerId: "layer1",
      type: "rect",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      dataId: "salida-1",
      interactive: true,
    };

    const activeLayers = new Set(["layer1"]);

    const found = findPrimitiveAtPoint({ x: 20, y: 20 }, [rect], activeLayers);
    expect(found?.id).toBe("rect1");

    const notFoundInInactiveLayer = findPrimitiveAtPoint({ x: 20, y: 20 }, [rect], new Set(["otherLayer"]));
    expect(notFoundInInactiveLayer).toBeNull();
  });
});
