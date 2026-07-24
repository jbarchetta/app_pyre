import type { CadPrimitive } from "../core/types";

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
   * Obtiene un símbolo registrado por código SAP o nombre de bloque DXF.
   */
  public getSymbol(key: string): DxfSymbolBlock | undefined {
    if (!key) return undefined;
    return this.symbols.get(key.toLowerCase());
  }

  /**
   * Retorna todos los símbolos registrados.
   */
  public getAllSymbols(): DxfSymbolBlock[] {
    return Array.from(this.symbols.values());
  }
}

export const symbolRegistry = new SymbolRegistry();
