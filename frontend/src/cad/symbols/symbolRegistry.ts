import type { CadPrimitive } from "../core/types";
import { parseDxfToSymbolBlock } from "../core/dxfImporter";

export interface DxfSymbolBlock {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  primitives: Omit<CadPrimitive, "id" | "layerId">[];
}

class SymbolRegistry {
  private symbols: Map<string, DxfSymbolBlock> = new Map();

  /**
   * Registra un bloque de componentes desde un archivo DXF parseado.
   */
  public registerSymbol(symbol: DxfSymbolBlock) {
    this.symbols.set(symbol.id.toLowerCase(), symbol);
    this.symbols.set(symbol.name.toLowerCase(), symbol);
  }

  /**
   * Obtiene un símbolo registrado por código SAP, nombre de bloque DXF o tipo.
   */
  public getSymbol(key: string): DxfSymbolBlock | undefined {
    if (!key) return undefined;
    const k = key.toLowerCase().trim();
    if (this.symbols.has(k)) return this.symbols.get(k);

    // Búsqueda por alias de termomagnéticas / disyuntores por polos (1P, 2P, 3P, 4P)
    if (k.includes("cbr_x1f") || k.includes("1p") || k.includes("unipolar") || k.includes("s201") || k.includes("sh201") || k.includes("2cds251") || k.includes("2cds201")) {
      return this.symbols.get("abb_topo_cbr_x1f");
    }
    if (k.includes("cbr_x2f") || k.includes("diyx2") || k.includes("f202") || k.includes("2p") || k.includes("bipolar") || k.includes("s202") || k.includes("sh202") || k.includes("2cds252") || k.includes("2cds202") || k.includes("2csf202")) {
      return this.symbols.get("abb_topo_cbr_x2f");
    }
    if (k.includes("cbr_x3f") || k.includes("3p") || k.includes("tripolar") || k.includes("s203") || k.includes("sh203") || k.includes("2cds253") || k.includes("2cds203")) {
      return this.symbols.get("abb_topo_cbr_x3f");
    }
    if (k.includes("cbr_x4f") || k.includes("f204") || k.includes("temx4") || k.includes("4p") || k.includes("tetrapolar") || k.includes("s204") || k.includes("sh204") || k.includes("2cds254") || k.includes("2cds204") || k.includes("2csf204")) {
      return this.symbols.get("abb_topo_cbr_x4f");
    }

    return undefined;
  }

  /**
   * Retorna todos los símbolos registrados.
   */
  public getAllSymbols(): DxfSymbolBlock[] {
    return Array.from(this.symbols.values());
  }
}

export const symbolRegistry = new SymbolRegistry();

// Bloques base síncronos MCB ABB en mm reales (85mm alto, 17.5mm/polo)
symbolRegistry.registerSymbol({
  id: "abb_topo_cbr_x1f",
  name: "Termomagnética Unipolar 1P (17.5mm x 85mm)",
  widthMm: 17.5,
  heightMm: 85,
  primitives: [
    { type: "line", start: { x: 0, y: 0 }, end: { x: 17.5, y: 0 } },
    { type: "line", start: { x: 17.5, y: 0 }, end: { x: 17.5, y: 85 } },
    { type: "line", start: { x: 17.5, y: 85 }, end: { x: 0, y: 85 } },
    { type: "line", start: { x: 0, y: 85 }, end: { x: 0, y: 0 } },
    { type: "line", start: { x: 2, y: 32.5 }, end: { x: 15.5, y: 32.5 } },
    { type: "line", start: { x: 2, y: 52.5 }, end: { x: 15.5, y: 52.5 } },
    { type: "circle", cx: 8.75, cy: 8, r: 3.5 },
    { type: "circle", cx: 8.75, cy: 77, r: 3.5 },
  ] as any,
});

symbolRegistry.registerSymbol({
  id: "abb_topo_cbr_x2f",
  name: "Termomagnética Bipolar 2P (35.0mm x 85mm)",
  widthMm: 35.0,
  heightMm: 85,
  primitives: [
    { type: "line", start: { x: 0, y: 0 }, end: { x: 35, y: 0 } },
    { type: "line", start: { x: 35, y: 0 }, end: { x: 35, y: 85 } },
    { type: "line", start: { x: 35, y: 85 }, end: { x: 0, y: 85 } },
    { type: "line", start: { x: 0, y: 85 }, end: { x: 0, y: 0 } },
    { type: "line", start: { x: 17.5, y: 0 }, end: { x: 17.5, y: 85 } },
    { type: "line", start: { x: 3, y: 32.5 }, end: { x: 32, y: 32.5 } },
    { type: "line", start: { x: 3, y: 52.5 }, end: { x: 32, y: 52.5 } },
    { type: "circle", cx: 8.75, cy: 8, r: 3.5 },
    { type: "circle", cx: 26.25, cy: 8, r: 3.5 },
    { type: "circle", cx: 8.75, cy: 77, r: 3.5 },
    { type: "circle", cx: 26.25, cy: 77, r: 3.5 },
  ] as any,
});

symbolRegistry.registerSymbol({
  id: "abb_topo_cbr_x3f",
  name: "Termomagnética Tripolar 3P (52.5mm x 85mm)",
  widthMm: 52.5,
  heightMm: 85,
  primitives: [
    { type: "line", start: { x: 0, y: 0 }, end: { x: 52.5, y: 0 } },
    { type: "line", start: { x: 52.5, y: 0 }, end: { x: 52.5, y: 85 } },
    { type: "line", start: { x: 52.5, y: 85 }, end: { x: 0, y: 85 } },
    { type: "line", start: { x: 0, y: 85 }, end: { x: 0, y: 0 } },
    { type: "line", start: { x: 17.5, y: 0 }, end: { x: 17.5, y: 85 } },
    { type: "line", start: { x: 35.0, y: 0 }, end: { x: 35.0, y: 85 } },
    { type: "line", start: { x: 3, y: 32.5 }, end: { x: 49.5, y: 32.5 } },
    { type: "line", start: { x: 3, y: 52.5 }, end: { x: 49.5, y: 52.5 } },
    { type: "circle", cx: 8.75, cy: 8, r: 3.5 },
    { type: "circle", cx: 26.25, cy: 8, r: 3.5 },
    { type: "circle", cx: 43.75, cy: 8, r: 3.5 },
    { type: "circle", cx: 8.75, cy: 77, r: 3.5 },
    { type: "circle", cx: 26.25, cy: 77, r: 3.5 },
    { type: "circle", cx: 43.75, cy: 77, r: 3.5 },
  ] as any,
});

symbolRegistry.registerSymbol({
  id: "abb_topo_cbr_x4f",
  name: "Termomagnética Tetrapolar 4P (70.0mm x 85mm)",
  widthMm: 70.0,
  heightMm: 85,
  primitives: [
    { type: "line", start: { x: 0, y: 0 }, end: { x: 70, y: 0 } },
    { type: "line", start: { x: 70, y: 0 }, end: { x: 70, y: 85 } },
    { type: "line", start: { x: 70, y: 85 }, end: { x: 0, y: 85 } },
    { type: "line", start: { x: 0, y: 85 }, end: { x: 0, y: 0 } },
    { type: "line", start: { x: 17.5, y: 0 }, end: { x: 17.5, y: 85 } },
    { type: "line", start: { x: 35.0, y: 0 }, end: { x: 35.0, y: 85 } },
    { type: "line", start: { x: 52.5, y: 0 }, end: { x: 52.5, y: 85 } },
    { type: "line", start: { x: 3, y: 32.5 }, end: { x: 67, y: 32.5 } },
    { type: "line", start: { x: 3, y: 52.5 }, end: { x: 67, y: 52.5 } },
    { type: "circle", cx: 8.75, cy: 8, r: 3.5 },
    { type: "circle", cx: 26.25, cy: 8, r: 3.5 },
    { type: "circle", cx: 43.75, cy: 8, r: 3.5 },
    { type: "circle", cx: 61.25, cy: 8, r: 3.5 },
    { type: "circle", cx: 8.75, cy: 77, r: 3.5 },
    { type: "circle", cx: 26.25, cy: 77, r: 3.5 },
    { type: "circle", cx: 43.75, cy: 77, r: 3.5 },
    { type: "circle", cx: 61.25, cy: 77, r: 3.5 },
  ] as any,
});

let preloadingPromise: Promise<void> | null = null;

export async function preloadDxfSymbols(): Promise<void> {
  if (preloadingPromise) return preloadingPromise;
  preloadingPromise = (async () => {
    try {
      const dxfFiles = [
        { url: "/dxf/abb_topo_cbr_x1f.dxf", id: "abb_topo_cbr_x1f", name: "Termomagnética Unipolar 1P", w: 17.5, h: 85 },
        { url: "/dxf/abb_topo_cbr_x2f.dxf", id: "abb_topo_cbr_x2f", name: "Termomagnética Bipolar 2P", w: 35.0, h: 85 },
        { url: "/dxf/abb_topo_cbr_x3f.dxf", id: "abb_topo_cbr_x3f", name: "Termomagnética Tripolar 3P", w: 52.5, h: 85 },
        { url: "/dxf/abb_topo_cbr_x4f.dxf", id: "abb_topo_cbr_x4f", name: "Termomagnética Tetrapolar 4P", w: 70.0, h: 85 },
        { url: "/dxf/abb_unif_4p.dxf", id: "abb_unif_4p", name: "Símbolo Unifilar 4P", w: 30, h: 60 },
        { url: "/dxf/abb_unif_term.dxf", id: "abb_unif_term", name: "Símbolo Unifilar Termomagnético", w: 20, h: 40 },
        { url: "/dxf/abb_unif_born.dxf", id: "abb_unif_born", name: "Símbolo Unifilar Borne", w: 10, h: 20 },
        { url: "/dxf/NOLLBOX 450x600x225 + kit din.dxf", id: "nollbox_450x600", name: "Gabinete Nollbox 450x600x225", w: 450, h: 600 },
        { url: "/dxf/NOLLBOX 600x600x225 + kit din.dxf", id: "nollbox_600x600", name: "Gabinete Nollbox 600x600x225", w: 600, h: 600 },
        { url: "/dxf/NOLLBOX 600x750x225 + kit din.dxf", id: "nollbox_600x750", name: "Gabinete Nollbox 600x750x225", w: 600, h: 750 },
        { url: "/dxf/NOLLBOX 600X1050x225 + kit din.dxf", id: "nollbox_600x1050", name: "Gabinete Nollbox 600x1050x225", w: 600, h: 1050 },
      ];

      for (const item of dxfFiles) {
        try {
          const res = await fetch(item.url);
          if (res.ok) {
            const text = await res.text();
            const symbol = parseDxfToSymbolBlock(text, item.id, item.name, item.w, item.h);
            symbolRegistry.registerSymbol(symbol);
          }
        } catch {
          // ignorar errores individuales
        }
      }
    } catch {
      // ignorar
    }
  })();
  return preloadingPromise;
}
