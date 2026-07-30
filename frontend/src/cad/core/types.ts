export interface CadPoint {
  x: number; // en mm
  y: number; // en mm
}

export interface CadBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type CadColor = string; // Hex color o nombre de color CAD

export interface CadLayer {
  id: string;
  name: string;
  color: CadColor;
  visible: boolean;
  locked: boolean;
  lineWidth?: number;
  lineDash?: number[];
}

export type PrimitiveType = "line" | "rect" | "circle" | "text" | "dimension" | "symbol";

export interface BasePrimitive {
  id: string;
  layerId: string;
  type: PrimitiveType;
  color?: CadColor;
  lineWidth?: number;
  dataId?: string; // ID asociativo (ej: id de la Salida o componente)
  interactive?: boolean;
}

export interface LinePrimitive extends BasePrimitive {
  type: "line";
  start: CadPoint;
  end: CadPoint;
  lineDash?: number[];
}

export interface RectPrimitive extends BasePrimitive {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  fill?: CadColor;
  stroke?: CadColor;
  label?: string;
  lineDash?: number[];
}

export interface CirclePrimitive extends BasePrimitive {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  fill?: CadColor;
  stroke?: CadColor;
}

export interface TextPrimitive extends BasePrimitive {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number; // mm
  align?: "left" | "center" | "right";
  baseline?: "top" | "middle" | "bottom";
  rotation?: number; // grados
  weight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
}

export interface DimensionPrimitive extends BasePrimitive {
  type: "dimension";
  start: CadPoint;
  end: CadPoint;
  offset: number; // distancia de la línea de cota en mm
  textOverride?: string;
}

export interface SymbolPrimitive extends BasePrimitive {
  type: "symbol";
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  symbolType: "breaker_main" | "breaker_out" | "diff_switch" | "terminal_block" | "busbar_node" | "earth_symbol";
  label?: string;
  sublabel?: string;
}

export type CadPrimitive =
  | LinePrimitive
  | RectPrimitive
  | CirclePrimitive
  | TextPrimitive
  | DimensionPrimitive
  | SymbolPrimitive;

export interface CadDocument {
  title: string;
  layers: CadLayer[];
  primitives: CadPrimitive[];
  bounds: CadBounds;
}

export interface ViewportTransform {
  zoom: number; // escala (1 = 1px por mm a 100%)
  panX: number; // desplazamiento en px
  panY: number; // desplazamiento en px
}

export interface CadSelection {
  entityId: string | null;
  dataId: string | null;
}
