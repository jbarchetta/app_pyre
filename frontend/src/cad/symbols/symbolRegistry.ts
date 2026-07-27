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

    // Búsqueda por alias de termomagnética de 4 polos (tetrapolar)
    if (k.includes("temx4") || k.includes("4p") || k.includes("tetrapolar") || k.includes("3f+n") || k.includes("s204")) {
      return this.symbols.get("abb_topo_temx4");
    }
    // Búsqueda por alias de disyuntor/diferencial bipolar (2P)
    if (k.includes("diyx2") || k.includes("disyuntor") || k.includes("diferencial") || k.includes("2p") || k.includes("f202")) {
      return this.symbols.get("abb_topo_diyx2");
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

let preloadingPromise: Promise<void> | null = null;

export async function preloadDxfSymbols(): Promise<void> {
  if (preloadingPromise) return preloadingPromise;
  preloadingPromise = (async () => {
    try {
      const dxfFiles = [
        { url: "/dxf/abb_topo_temx4.dxf", id: "abb_topo_temx4", name: "Termomagnética Tetrapolar 4P", w: 70, h: 88 },
        { url: "/dxf/abb_topo_diyx2.dxf", id: "abb_topo_diyx2", name: "Disyuntor Diferencial Bipolar 2P", w: 35, h: 88 },
        { url: "/dxf/abb_unif_4p.dxf", id: "abb_unif_4p", name: "Símbolo Unifilar 4P", w: 30, h: 60 },
        { url: "/dxf/abb_unif_term.dxf", id: "abb_unif_term", name: "Símbolo Unifilar Termomagnético", w: 20, h: 40 },
        { url: "/dxf/abb_unif_born.dxf", id: "abb_unif_born", name: "Símbolo Unifilar Borne", w: 10, h: 20 },
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
