import type { CadDocument, CadPoint, CadPrimitive, ViewportTransform } from "../core/types";
import { worldToScreen, screenToWorld } from "../core/transform";

export interface CadEngineOptions {
  theme?: "dark" | "light";
  showGrid?: boolean;
  showCrosshair?: boolean;
  gridSizeMm?: number;
  snapToGrid?: boolean;
  activeLayerIds?: Set<string>;
  hoveredDataId?: string | null;
  selectedDataId?: string | null;
  measurementToolActive?: boolean;
  measureStartPoint?: CadPoint | null;
}

export class CadCanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      this.ctx = this.createMockContext();
    } else {
      this.ctx = context;
    }
  }

  private createMockContext(): CanvasRenderingContext2D {
    const noop = () => {};
    return {
      save: noop,
      restore: noop,
      scale: noop,
      fillRect: noop,
      strokeRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      fill: noop,
      arc: noop,
      fillText: noop,
      setLineDash: noop,
      clientWidth: 800,
      clientHeight: 600,
    } as unknown as CanvasRenderingContext2D;
  }

  public render(doc: CadDocument, transform: ViewportTransform, mousePosPx: { x: number; y: number } | null, options: CadEngineOptions = {}) {
    const { canvas, ctx } = this;
    const {
      theme = "dark",
      showGrid = true,
      showCrosshair = true,
      gridSizeMm = 10,
      activeLayerIds = new Set(doc.layers.filter((l) => l.visible).map((l) => l.id)),
      hoveredDataId,
      selectedDataId,
      measurementToolActive,
      measureStartPoint,
    } = options;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Fondo según Tema Dark / Light
    ctx.fillStyle = theme === "light" ? "#FFFFFF" : "#0F172A";
    ctx.fillRect(0, 0, width, height);

    // 1. Grilla CAD
    if (showGrid) {
      this.renderGrid(width, height, transform, gridSizeMm, theme);
    }

    // 2. Renderizado de Primitivas por Capas
    doc.primitives.forEach((prim) => {
      if (!activeLayerIds.has(prim.layerId)) return;

      const layer = doc.layers.find((l) => l.id === prim.layerId);
      let rawColor = prim.color || layer?.color;
      let color = rawColor || (theme === "light" ? "#000000" : "#FFFFFF");

      if (rawColor === "auto" || rawColor === "AUTO") {
        color = theme === "light" ? "#000000" : "#FFFFFF";
      } else if (theme === "light" && (color === "#F8FAFC" || color === "#E2E8F0" || color === "#FFFFFF")) {
        color = "#000000";
      }

      const isHovered = Boolean(hoveredDataId && prim.dataId === hoveredDataId);
      const isSelected = Boolean(selectedDataId && prim.dataId === selectedDataId);

      this.renderPrimitive(prim, transform, color, isHovered, isSelected, theme);
    });

    // 3. Herramienta de Medición
    if (measurementToolActive && mousePosPx) {
      const mouseWorld = screenToWorld(mousePosPx, transform);
      if (measureStartPoint) {
        this.renderMeasurement(measureStartPoint, mouseWorld, transform, theme);
      }
    }

    // 4. Retícula / Crosshair CAD & Coordenadas
    if (showCrosshair && mousePosPx) {
      this.renderCrosshair(width, height, mousePosPx, transform, theme);
    }

    ctx.restore();
  }

  private renderGrid(width: number, height: number, transform: ViewportTransform, gridSizeMm: number, theme: "dark" | "light") {
    const { ctx } = this;
    const stepPx = gridSizeMm * transform.zoom;
    if (stepPx < 4) return;

    const startWorld = screenToWorld({ x: 0, y: 0 }, transform);
    const endWorld = screenToWorld({ x: width, y: height }, transform);

    const firstX = Math.floor(startWorld.x / gridSizeMm) * gridSizeMm;
    const lastX = Math.ceil(endWorld.x / gridSizeMm) * gridSizeMm;

    const firstY = Math.floor(startWorld.y / gridSizeMm) * gridSizeMm;
    const lastY = Math.ceil(endWorld.y / gridSizeMm) * gridSizeMm;

    ctx.lineWidth = 0.5;

    for (let x = firstX; x <= lastX; x += gridSizeMm) {
      const screenX = x * transform.zoom + transform.panX;
      const isMajor = x % (gridSizeMm * 5) === 0;
      if (theme === "light") {
        ctx.strokeStyle = isMajor ? "rgba(148, 163, 184, 0.8)" : "rgba(226, 232, 240, 0.7)";
      } else {
        ctx.strokeStyle = isMajor ? "rgba(51, 65, 85, 0.6)" : "rgba(30, 41, 59, 0.4)";
      }
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }

    for (let y = firstY; y <= lastY; y += gridSizeMm) {
      const screenY = y * transform.zoom + transform.panY;
      const isMajor = y % (gridSizeMm * 5) === 0;
      if (theme === "light") {
        ctx.strokeStyle = isMajor ? "rgba(148, 163, 184, 0.8)" : "rgba(226, 232, 240, 0.7)";
      } else {
        ctx.strokeStyle = isMajor ? "rgba(51, 65, 85, 0.6)" : "rgba(30, 41, 59, 0.4)";
      }
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }
  }

  private renderPrimitive(
    prim: CadPrimitive,
    transform: ViewportTransform,
    color: string,
    isHovered: boolean,
    isSelected: boolean,
    theme: "dark" | "light"
  ) {
    const { ctx } = this;

    ctx.save();

    if (isSelected) {
      ctx.strokeStyle = "#0284C7";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#0284C7";
      ctx.shadowBlur = 8;
    } else if (isHovered) {
      ctx.strokeStyle = "#D97706";
      ctx.lineWidth = 2.5;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, (prim.lineWidth || 1.5) * transform.zoom);
    }

    switch (prim.type) {
      case "line": {
        const s = worldToScreen(prim.start, transform);
        const e = worldToScreen(prim.end, transform);
        if (prim.lineDash) ctx.setLineDash(prim.lineDash);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        break;
      }

      case "rect": {
        const s = worldToScreen({ x: prim.x, y: prim.y }, transform);
        const w = prim.width * transform.zoom;
        const h = prim.height * transform.zoom;

        if (prim.fill && prim.fill !== "none" && !isSelected && !isHovered) {
          ctx.fillStyle = prim.fill;
          ctx.fillRect(s.x, s.y, w, h);
        }

        if (prim.color && prim.color !== "none" && (prim.lineWidth ?? 1) > 0) {
          ctx.strokeRect(s.x, s.y, w, h);
        }

        if (prim.label && w > 30 && h > 15) {
          ctx.fillStyle = isSelected || isHovered ? (theme === "light" ? "#0F172A" : "#FFFFFF") : (theme === "light" ? "#1E293B" : "#E2E8F0");
          ctx.font = `${Math.max(10, Math.min(14, 12 * transform.zoom))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(prim.label, s.x + w / 2, s.y + h / 2);
        }
        break;
      }

      case "circle": {
        const center = worldToScreen({ x: prim.cx, y: prim.cy }, transform);
        const r = prim.r * transform.zoom;

        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        if (prim.fill) {
          ctx.fillStyle = prim.fill;
          ctx.fill();
          ctx.strokeStyle = prim.fill;
        }
        ctx.stroke();
        break;
      }

      case "text": {
        const pos = worldToScreen({ x: prim.x, y: prim.y }, transform);
        ctx.fillStyle = isSelected || isHovered ? "#D97706" : color;
        const fontSizePx = Math.max(5, prim.fontSize * transform.zoom * 1.6);
        ctx.font = `${prim.weight === "bold" ? "600 " : ""}${fontSizePx}px "ISOCPEUR", "JetBrains Mono", monospace, sans-serif`;
        ctx.textAlign = prim.align || "left";
        ctx.textBaseline = prim.baseline || "alphabetic";

        const textLines = prim.text.split("\n");
        textLines.forEach((line, i) => {
          ctx.fillText(line, pos.x, pos.y + i * (fontSizePx * 1.25));
        });
        break;
      }

      case "dimension": {
        const s = worldToScreen(prim.start, transform);
        const e = worldToScreen(prim.end, transform);
        const offsetPx = prim.offset * transform.zoom;

        const dimSy = s.y + offsetPx;
        const dimEy = e.y + offsetPx;

        ctx.strokeStyle = theme === "light" ? "#475569" : "#94A3B8";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, dimSy + (offsetPx > 0 ? 5 : -5));
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x, dimEy + (offsetPx > 0 ? 5 : -5));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(s.x, dimSy);
        ctx.lineTo(e.x, dimEy);
        ctx.stroke();

        this.drawTick(s.x, dimSy);
        this.drawTick(e.x, dimEy);

        const midX = (s.x + e.x) / 2;
        const distMm = Math.hypot(prim.end.x - prim.start.x, prim.end.y - prim.start.y);

        ctx.fillStyle = theme === "light" ? "#0F172A" : "#F8FAFC";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = offsetPx > 0 ? "bottom" : "top";
        ctx.fillText(prim.textOverride || `${Math.round(distMm)} mm`, midX, dimSy - 2);
        break;
      }

      case "symbol": {
        const pos = worldToScreen({ x: prim.x, y: prim.y }, transform);
        this.renderSymbol(prim.symbolType, pos.x, pos.y, transform.zoom, prim.label, prim.sublabel, isHovered || isSelected, theme);
        break;
      }
    }

    ctx.restore();
  }

  private drawTick(x: number, y: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 4);
    ctx.lineTo(x + 4, y - 4);
    ctx.stroke();
  }

  private renderSymbol(
    symbolType: string,
    x: number,
    y: number,
    zoom: number,
    label?: string,
    sublabel?: string,
    highlighted = false,
    theme: "dark" | "light" = "dark"
  ) {
    const { ctx } = this;
    ctx.strokeStyle = highlighted ? "#D97706" : (theme === "light" ? "#059669" : "#10B981");
    ctx.lineWidth = 2;

    switch (symbolType) {
      case "breaker_main":
      case "breaker_out": {
        ctx.strokeRect(x - 12, y - 12, 24, 24);
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 8);
        ctx.lineTo(x + 8, y - 8);
        ctx.stroke();
        break;
      }
      case "diff_switch": {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText("Δ", x - 3, y + 4);
        break;
      }
      case "terminal_block": {
        ctx.fillStyle = "#8B5CF6";
        ctx.fillRect(x - 8, y - 8, 16, 16);
        ctx.strokeRect(x - 8, y - 8, 16, 16);
        break;
      }
    }

    if (label) {
      ctx.fillStyle = theme === "light" ? "#0F172A" : "#F8FAFC";
      ctx.font = `${Math.max(10, 11 * zoom)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 16, y - 4);
      if (sublabel) {
        ctx.fillStyle = theme === "light" ? "#475569" : "#94A3B8";
        ctx.font = `${Math.max(9, 9 * zoom)}px sans-serif`;
        ctx.fillText(sublabel, x + 16, y + 10);
      }
    }
  }

  private renderMeasurement(startWorld: CadPoint, endWorld: CadPoint, transform: ViewportTransform, theme: "dark" | "light") {
    const { ctx } = this;
    const s = worldToScreen(startWorld, transform);
    const e = worldToScreen(endWorld, transform);

    ctx.save();
    ctx.strokeStyle = "#DB2777";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();

    const distMm = Math.hypot(endWorld.x - startWorld.x, endWorld.y - startWorld.y);
    const midX = (s.x + e.x) / 2;
    const midY = (s.y + e.y) / 2;

    ctx.fillStyle = theme === "light" ? "#BE185D" : "#F472B6";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Cota: ${distMm.toFixed(1)} mm`, midX, midY - 8);

    ctx.restore();
  }

  private renderCrosshair(
    width: number,
    height: number,
    mousePosPx: { x: number; y: number },
    transform: ViewportTransform,
    theme: "dark" | "light"
  ) {
    const { ctx } = this;
    const mouseWorld = screenToWorld(mousePosPx, transform);

    ctx.save();
    ctx.strokeStyle = theme === "light" ? "rgba(71, 85, 105, 0.4)" : "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, mousePosPx.y);
    ctx.lineTo(width, mousePosPx.y);
    ctx.moveTo(mousePosPx.x, 0);
    ctx.lineTo(mousePosPx.x, height);
    ctx.stroke();

    const coordsText = `X: ${mouseWorld.x.toFixed(1)} mm  Y: ${mouseWorld.y.toFixed(1)} mm`;
    ctx.fillStyle = theme === "light" ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(mousePosPx.x + 10, mousePosPx.y + 10, 190, 24);
    ctx.strokeStyle = theme === "light" ? "#CBD5E1" : "#334155";
    ctx.strokeRect(mousePosPx.x + 10, mousePosPx.y + 10, 190, 24);

    ctx.fillStyle = theme === "light" ? "#0284C7" : "#38BDF8";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(coordsText, mousePosPx.x + 18, mousePosPx.y + 22);

    ctx.restore();
  }
}
