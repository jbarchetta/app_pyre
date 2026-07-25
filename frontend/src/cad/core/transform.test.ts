import { describe, it, expect } from "vitest";
import { worldToScreen, screenToWorld, calculateFitToScreen, zoomAtPoint, centerOnScreen } from "./transform";
import type { CadBounds, ViewportTransform } from "./types";

describe("transform module", () => {
  it("converts world to screen coordinates correctly", () => {
    const transform: ViewportTransform = { zoom: 2, panX: 100, panY: 50 };
    const screen = worldToScreen({ x: 10, y: 20 }, transform);
    expect(screen).toEqual({ x: 120, y: 90 });
  });

  it("converts screen to world coordinates correctly", () => {
    const transform: ViewportTransform = { zoom: 2, panX: 100, panY: 50 };
    const world = screenToWorld({ x: 120, y: 90 }, transform);
    expect(world).toEqual({ x: 10, y: 20 });
  });

  it("calculates fit to screen correctly", () => {
    const bounds: CadBounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
    const fit = calculateFitToScreen(bounds, 800, 600, 0);

    // 800 / 100 = 8, 600 / 50 = 12 -> min zoom = 8
    expect(fit.zoom).toBe(8);
    // worldCenter = (50, 25). panX = 400 - 50*8 = 0, panY = 300 - 25*8 = 100
    expect(fit.panX).toBe(0);
    expect(fit.panY).toBe(100);
  });

  it("zooms at point keeping world point under cursor static", () => {
    const current: ViewportTransform = { zoom: 1, panX: 0, panY: 0 };
    const cursorPixel = { x: 200, y: 150 };

    const next = zoomAtPoint(cursorPixel, current, 2);

    // World point at (200, 150) under zoom 2 should stay at pixel (200, 150)
    const converted = worldToScreen({ x: 200, y: 150 }, next);
    expect(converted.x).toBeCloseTo(200);
    expect(converted.y).toBeCloseTo(150);
  });

  it("centers bounds on screen without changing zoom", () => {
    const bounds: CadBounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
    const currentZoom = 2.5;

    const next = centerOnScreen(bounds, currentZoom, 800, 600);

    expect(next.zoom).toBe(2.5);
    // worldCenter = (50, 25). panX = 400 - 50*2.5 = 275, panY = 300 - 25*2.5 = 237.5
    expect(next.panX).toBe(275);
    expect(next.panY).toBe(237.5);
  });
});
