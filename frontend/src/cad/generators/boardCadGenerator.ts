import type { Salida, Seccion } from "../../api/client";
import type { CadDocument, CadLayer, CadPrimitive } from "../core/types";
import { symbolRegistry } from "../symbols/symbolRegistry";

export interface InterruptorPrincipalInfo {
  id?: string | null;
  codigo?: string | null;
  codigo_comercial?: string | null;
  descripcion?: string | null;
  corriente_nominal_a?: number | string | null;
  polos?: number | null;
}

export interface BoardCadGeneratorParams {
  tieneInterruptorPrincipal: boolean;
  interruptorPrincipal?: InterruptorPrincipalInfo | null;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  modoVisual: "bloques" | "unifilar" | "topografico";
  gabineteAnchoMm?: number | null;
  gabineteAltoMm?: number | null;
  pasoMm?: number | null;
}

// =========================================================================
// REGLAS ESTRUCTURALES DE MAQUETADO UNIFILAR (CAPAS Y PUNTOS FIJOS EN EJE Y)
// =========================================================================
export const UNIFILAR_LAYOUT = {
  Y_BUSBAR: 0,            // Acometida Inicial de Entrada
  Y_MAIN_BREAKER: 115,    // Interruptor Principal General Q1 (+25mm ampliado en línea superior)
  Y_DISTRIBUTION_BUS: 210,// Embarrado de Cobre L1-L2-L3-N (+25mm ampliado en línea inferior)
  Y_BRANCH_DEVICES: 350,  // Disyuntores de Salidas
  Y_TERMINALS: 490,       // Regleta de Borneras X1
  Y_LABELS_BOTTOM: 550,   // Textos descriptivos al pie

  OFFSET_X_TEXT: -15,     // Desplazamiento a la IZQUIERDA (-15mm) para descripciones de interruptor
  COLUMN_STEP_X: 120,     // Paso constante entre columnas de 120mm
  X_INITIAL: 100,         // Coordenada X inicial de la primera columna
};

function calcularCalibreAcometida(amp: number, _polos?: number): string {
  if (amp <= 25) return "4 mm²";
  if (amp <= 32) return "6 mm²";
  if (amp <= 40) return "10 mm²";
  if (amp <= 63) return "16 mm²";
  if (amp <= 80) return "25 mm²";
  if (amp <= 125) return "35 mm²";
  return "70 mm²";
}

export function wrapText(text: string, maxCharsPerLine: number = 20): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}

export const CAPAS_ESTANDAR_CAD: CadLayer[] = [
  { id: "0_Gabinete", name: "0. Gabinete & Chasis", color: "#64748B", visible: true, locked: false, lineWidth: 2 },
  { id: "1_Equipos_DIN", name: "1. Equipos & Riel DIN", color: "#3B82F6", visible: true, locked: false, lineWidth: 1.5 },
  { id: "2_Embarrado", name: "2. Embarrado de Cobre", color: "#10B981", visible: true, locked: false, lineWidth: 1.8 },
  { id: "3_Cablecanal", name: "3. Cablecanales", color: "#94A3B8", visible: true, locked: false, lineWidth: 1 },
  { id: "4_Unifilar", name: "4. Esquema Unifilar IEC", color: "#10B981", visible: true, locked: false, lineWidth: 1.2 },
  { id: "5_Borneras", name: "5. Regletas de Bornes", color: "auto", visible: true, locked: false, lineWidth: 1.2 },
  { id: "6_Cotas_Textos", name: "6. Cotas & Etiquetas", color: "auto", visible: true, locked: false, lineWidth: 1 },
];

export type FormatoPolo = "unipolar" | "bipolar" | "tripolar" | "tetrapolar";

/**
 * Regla de Formatos Fijos (Basada 1:1 en el DXF de referencia abb_unif_4p.dxf):
 * - unipolar: 1 Fase (1P)
 * - bipolar: 1 Fase + Neutro (2P / 1P+N)
 * - tripolar: 3 Fases (3P)
 * - tetrapolar: 3 Fases + Neutro (4P / 3F+N) -> Por defecto para todas las ramas
 */
export function obtenerReglaFormato(formatoStr?: string | null): {
  formato: FormatoPolo;
  numFases: number;
  tieneNeutro: boolean;
  etiquetaPolos: string;
} {
  const f = (formatoStr || "").toLowerCase().trim();

  if (f === "unipolar" || f === "1p" || f === "1f") {
    return { formato: "unipolar", numFases: 1, tieneNeutro: false, etiquetaPolos: "1P (1F)" };
  }
  if (f === "bipolar" || f === "2p" || f === "1p+n" || f === "1pn" || f === "1f+n") {
    return { formato: "bipolar", numFases: 1, tieneNeutro: true, etiquetaPolos: "2P (1F+N)" };
  }
  if (f === "tripolar" || f === "3p" || f === "3f") {
    return { formato: "tripolar", numFases: 3, tieneNeutro: false, etiquetaPolos: "3P (3F)" };
  }
  // Por defecto (y para tetrapolar / 4P / 3P+N / etc): Tetrapolar 3F+N
  return { formato: "tetrapolar", numFases: 3, tieneNeutro: true, etiquetaPolos: "4P (3F+N)" };
}

/**
 * Renderiza los ticks de polos sobre un conductor vertical a la coordenada X_col
 * replicando idénticamente la geometría del bloque referencial `abb_unif_4p.dxf`:
 * - Ticks de Fases (L1, L2, L3): Línea diagonal completa de (X_col + 4, Y - 4) a (X_col - 4, Y + 4) [Ángulo 45° de arriba-derecha a abajo-izquierda]
 * - Tick de Neutro (N): Media línea diagonal que parte EXACTAMENTE del centro (X_col, Y) a (X_col - 4, Y + 4)
 * - SIN CÍRCULOS NI FORMAS EXTRAS.
 */
function agregarTicksPolos(
  primitives: CadPrimitive[],
  salidaId: string,
  prefixId: string,
  X_col: number,
  startY: number,
  formatoStr?: string | null
) {
  const { numFases, tieneNeutro } = obtenerReglaFormato(formatoStr);

  let currentY = startY;

  // 1. Ticks de Fases (Líneas diagonales completas a 45° que cruzan el eje X_col)
  for (let f = 0; f < numFases; f++) {
    primitives.push({
      id: `tick-${prefixId}-fase-${salidaId}-${f}`,
      layerId: "4_Unifilar",
      type: "line",
      start: { x: X_col + 4, y: currentY - 4 },
      end: { x: X_col - 4, y: currentY + 4 },
      lineWidth: 1.2,
    });
    currentY += 5;
  }

  // 2. Tick de Neutro (Media línea diagonal desde el eje central X_col hacia la izquierda X_col - 4)
  if (tieneNeutro) {
    primitives.push({
      id: `tick-${prefixId}-neutro-${salidaId}`,
      layerId: "4_Unifilar",
      type: "line",
      start: { x: X_col, y: currentY },
      end: { x: X_col - 4, y: currentY + 4 },
      lineWidth: 1.2,
    });
  }
}

export function calcularCapacidadPolosFila(anchoGabineteMm?: number | null): number {
  const width = anchoGabineteMm || 600;
  if (width <= 300) return 10;
  if (width <= 450) return 16;
  if (width <= 600) return 24;
  if (width <= 750) return 32;
  return 45;
}

export function obtenerPolosSalida(salida: Salida): number {
  if (typeof (salida as any).polos === "number" && (salida as any).polos > 0) {
    return (salida as any).polos;
  }
  if (typeof (salida as any).componente_polos === "number" && (salida as any).componente_polos > 0) {
    return (salida as any).componente_polos;
  }

  const f = (salida.formato || "").toLowerCase().trim();
  const desc = (salida.descripcion_personalizada || salida.componente_descripcion || "").toLowerCase().trim();
  const cod = (salida.componente_codigo || "").toLowerCase().trim();
  const et = (salida.etiqueta || "").toLowerCase().trim();

  const text = `${f} ${desc} ${cod} ${et}`;

  // 1 Polo (Unipolar)
  if (
    f === "unipolar" ||
    f === "1p" ||
    f === "1f" ||
    text.includes("unipolar") ||
    text.includes("1p") ||
    text.includes("s201") ||
    text.includes("sh201") ||
    text.includes("x1f") ||
    cod.includes("2cds251") ||
    cod.includes("2cds201")
  ) {
    return 1;
  }

  // 2 Polos (Bipolar)
  if (
    f === "bipolar" ||
    f === "2p" ||
    f === "1p+n" ||
    f === "1pn" ||
    text.includes("bipolar") ||
    text.includes("2p") ||
    text.includes("s202") ||
    text.includes("sh202") ||
    text.includes("f202") ||
    text.includes("x2f") ||
    text.includes("diyx2") ||
    cod.includes("2cds252") ||
    cod.includes("2cds202") ||
    cod.includes("2csf202")
  ) {
    return 2;
  }

  // 3 Polos (Tripolar)
  if (
    f === "tripolar" ||
    f === "3p" ||
    f === "3f" ||
    text.includes("tripolar") ||
    text.includes("3p") ||
    text.includes("s203") ||
    text.includes("sh203") ||
    text.includes("x3f") ||
    cod.includes("2cds253") ||
    cod.includes("2cds203")
  ) {
    return 3;
  }

  // 4 Polos (Tetrapolar)
  if (
    f === "tetrapolar" ||
    f === "4p" ||
    f === "3p+n" ||
    f === "3pn" ||
    text.includes("tetrapolar") ||
    text.includes("4p") ||
    text.includes("s204") ||
    text.includes("sh204") ||
    text.includes("f204") ||
    text.includes("x4f") ||
    cod.includes("2cds254") ||
    cod.includes("2cds204") ||
    cod.includes("2csf204")
  ) {
    return 4;
  }

  if (f) {
    const regla = obtenerReglaFormato(salida.formato);
    return regla.numFases + (regla.tieneNeutro ? 1 : 0);
  }

  return 1;
}

function obtenerAnchoSalidaMm(salida: Salida): number {
  const polos = obtenerPolosSalida(salida);
  return Math.max(17.5, polos * 17.5);
}

function esDiferencial(salida: Salida): boolean {
  const tp = (salida.tipo_proteccion || "").toLowerCase();
  const cod = (salida.componente_codigo || "").toLowerCase();
  const et = (salida.etiqueta || "").toLowerCase();
  const desc = (salida.descripcion_personalizada || "").toLowerCase();
  return (
    tp.includes("diferencial") ||
    cod.includes("f204") ||
    cod.includes("f202") ||
    et.includes("diferencial") ||
    et.includes("disyuntor") ||
    desc.includes("diferencial") ||
    desc.includes("disyuntor")
  );
}

function obtenerAmperaje(salida: Salida): string {
  if (!salida.carga_valor) return "10A";
  const num = parseFloat(salida.carga_valor);
  return isNaN(num) ? salida.carga_valor : `${num}A`;
}

function calcularCalibreCableMm2(salida: Salida): string {
  const amp = parseFloat(salida.carga_valor) || 10;
  if (amp <= 10) return "2.5mm²";
  if (amp <= 16) return "2.5mm²";
  if (amp <= 25) return "4mm²";
  if (amp <= 32) return "6mm²";
  if (amp <= 40) return "10mm²";
  if (amp <= 63) return "16mm²";
  if (amp <= 80) return "25mm²";
  if (amp <= 125) return "35mm²";
  return "50mm²";
}

// Función helper para envolver/delimitar textos largos al pie y evitar solapamientos entre columnas
export function envolverTexto(texto: string, maxCharsPorLinea = 15): string[] {
  if (!texto) return [""];
  if (texto.length <= maxCharsPorLinea) return [texto];

  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let lineaActual = "";

  palabras.forEach((p) => {
    if ((lineaActual + " " + p).trim().length <= maxCharsPorLinea) {
      lineaActual = (lineaActual + " " + p).trim();
    } else {
      if (lineaActual) lineas.push(lineaActual);
      lineaActual = p.length > maxCharsPorLinea ? p.substring(0, maxCharsPorLinea) : p;
    }
  });

  if (lineaActual) lineas.push(lineaActual);
  return lineas;
}

export function generateBoardCadDocument(params: BoardCadGeneratorParams): CadDocument {
  const { tieneInterruptorPrincipal, interruptorPrincipal, secciones, modoVisual } = params;
  const primitives: CadPrimitive[] = [];

  const maxSalidas = Math.max(1, ...secciones.map((s) => s.salidas.length));

  // =========================================================================
  // 1. ESQUEMA UNIFILAR TÉCNICO COMPLETO 1:1 CON FUENTE ISOCPEUR Y DXF REFERENCIAL
  // =========================================================================
  if (modoVisual === "unifilar") {
    const {
      Y_BUSBAR,
      Y_MAIN_BREAKER,
      Y_DISTRIBUTION_BUS,
      Y_BRANCH_DEVICES,
      Y_TERMINALS,
      Y_LABELS_BOTTOM,
      OFFSET_X_TEXT,
      COLUMN_STEP_X,
      X_INITIAL,
    } = UNIFILAR_LAYOUT;

    const totalSalidasCount = secciones.reduce((acc, s) => acc + s.salidas.length, 0);
    const busbarLength = Math.max(450, totalSalidasCount * COLUMN_STEP_X + 100);
    const totalWidth = X_INITIAL + busbarLength + 100;

    // -----------------------------------------------------------------------
    // ACOMETIDA PRINCIPAL DE ENTRADA (CONECTADA AL CENTRO DEL DISTRIBUIDOR)
    // -----------------------------------------------------------------------
    const busbarStartX = X_INITIAL - 30;
    const busbarEndX = X_INITIAL + busbarLength;
    const X_main_center = (busbarStartX + busbarEndX) / 2;

    // Punta de flecha entrante en el inicio de la línea de ingreso (Y_BUSBAR = 0mm)
    primitives.push({
      id: "unifilar-feed-arrow1",
      layerId: "4_Unifilar",
      type: "line",
      start: { x: X_main_center - 5, y: Y_BUSBAR + 4 },
      end: { x: X_main_center, y: Y_BUSBAR + 12 },
      lineWidth: 1.8,
    });
    primitives.push({
      id: "unifilar-feed-arrow2",
      layerId: "4_Unifilar",
      type: "line",
      start: { x: X_main_center + 5, y: Y_BUSBAR + 4 },
      end: { x: X_main_center, y: Y_BUSBAR + 12 },
      lineWidth: 1.8,
    });

    // Líneas de acometida principal
    primitives.push({
      id: "unifilar-feed-line-top",
      layerId: "4_Unifilar",
      type: "line",
      start: { x: X_main_center, y: Y_BUSBAR },
      end: { x: X_main_center, y: Y_MAIN_BREAKER - 16 },
      lineWidth: 1.8,
    });

    primitives.push({
      id: "unifilar-feed-line-bot",
      layerId: "4_Unifilar",
      type: "line",
      start: { x: X_main_center, y: Y_MAIN_BREAKER + 16 },
      end: { x: X_main_center, y: Y_DISTRIBUTION_BUS },
      lineWidth: 1.8,
    });

    // Interruptor Principal General Q1 en Y_MAIN_BREAKER (= 90mm) centrado en el distribuidor
    if (tieneInterruptorPrincipal) {
      const mainPoles = Number(interruptorPrincipal?.polos || 4);
      const mainAmp = Number(interruptorPrincipal?.corriente_nominal_a || 63);
      const mainCalibreStr = calcularCalibreAcometida(mainAmp, mainPoles);

      // Ticks de Polos SUPERIORES (Aguas Arriba del Q1)
      agregarTicksPolos(primitives, "main", "top", X_main_center, Y_BUSBAR + 28, mainPoles === 4 ? "tetrapolar" : mainPoles === 3 ? "tripolar" : "bipolar");

      // Símbolo de Calibre del Cable SUPERIOR (Aguas Arriba) (Desplazado 15mm hacia abajo)
      const cableTopMainY = Y_BUSBAR + 67;
      const guideTopWidth = Math.max(32, mainCalibreStr.length * 5.2);
      primitives.push({
        id: "unifilar-main-cable-top-line",
        layerId: "6_Cotas_Textos",
        type: "line",
        start: { x: X_main_center - 6, y: cableTopMainY },
        end: { x: X_main_center + 6, y: cableTopMainY },
        lineWidth: 2.5,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-cable-top-guide",
        layerId: "6_Cotas_Textos",
        type: "line",
        start: { x: X_main_center + 6, y: cableTopMainY },
        end: { x: X_main_center + 6 + guideTopWidth, y: cableTopMainY },
        lineWidth: 1.0,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-cable-top-txt",
        layerId: "6_Cotas_Textos",
        type: "text",
        x: X_main_center + 9,
        y: cableTopMainY - 2.0,
        text: mainCalibreStr,
        fontSize: 6.0,
        weight: "bold",
        align: "left",
        color: "auto",
      });

      // Símbolo del Interruptor Principal Termomagnético Q1 en Y_MAIN_BREAKER (= 115mm)
      primitives.push({
        id: "unifilar-main-stub-top",
        layerId: "4_Unifilar",
        type: "line",
        start: { x: X_main_center, y: Y_MAIN_BREAKER - 16 },
        end: { x: X_main_center, y: Y_MAIN_BREAKER - 10 },
        lineWidth: 1.8,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-stub-bot",
        layerId: "4_Unifilar",
        type: "line",
        start: { x: X_main_center, y: Y_MAIN_BREAKER + 10 },
        end: { x: X_main_center, y: Y_MAIN_BREAKER + 16 },
        lineWidth: 1.8,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-arm",
        layerId: "4_Unifilar",
        type: "line",
        start: { x: X_main_center, y: Y_MAIN_BREAKER + 10 },
        end: { x: X_main_center - 7, y: Y_MAIN_BREAKER - 6 },
        lineWidth: 1.8,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-cross1",
        layerId: "4_Unifilar",
        type: "line",
        start: { x: X_main_center - 2, y: Y_MAIN_BREAKER - 9 },
        end: { x: X_main_center + 2, y: Y_MAIN_BREAKER - 5 },
        lineWidth: 1.8,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-cross2",
        layerId: "4_Unifilar",
        type: "line",
        start: { x: X_main_center + 2, y: Y_MAIN_BREAKER - 9 },
        end: { x: X_main_center - 2, y: Y_MAIN_BREAKER - 5 },
        lineWidth: 1.8,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-trigger",
        layerId: "4_Unifilar",
        type: "line",
        start: { x: X_main_center - 5, y: Y_MAIN_BREAKER - 2 },
        end: { x: X_main_center - 8, y: Y_MAIN_BREAKER + 2 },
        lineWidth: 1.2,
        color: "auto",
      });

      // TEXTOS DESCRIPTIVOS A LA IZQUIERDA DE Q1 (-15mm, RIGHT ALIGN)
      // Linea 1: TAG (Q1) (6.5mm Bold)
      primitives.push({
        id: "unifilar-main-txt-tag",
        layerId: "6_Cotas_Textos",
        type: "text",
        x: X_main_center + OFFSET_X_TEXT,
        y: Y_MAIN_BREAKER - 12,
        text: "Q1",
        fontSize: 6.5,
        weight: "bold",
        align: "right",
        dataId: "main-breaker",
        interactive: true,
        color: "auto",
      });

      // Linea 2: Designación de Tipo (ABB precedido en rojo, 6.0mm Bold)
      const mainModelo = interruptorPrincipal?.codigo_comercial || "Tmax XT1";
      primitives.push({
        id: "unifilar-main-txt-type",
        layerId: "6_Cotas_Textos",
        type: "text",
        x: X_main_center + OFFSET_X_TEXT,
        y: Y_MAIN_BREAKER - 2,
        text: `ABB ${mainModelo}`,
        fontSize: 6.0,
        weight: "bold",
        align: "right",
        color: "auto",
      });

      // Linea 3: Código SAP (6.0mm Normal)
      const mainSapCode = interruptorPrincipal?.codigo || "1SDA066791R1";
      primitives.push({
        id: "unifilar-main-txt-sap",
        layerId: "6_Cotas_Textos",
        type: "text",
        x: X_main_center + OFFSET_X_TEXT,
        y: Y_MAIN_BREAKER + 8,
        text: mainSapCode,
        fontSize: 6.0,
        align: "right",
        color: "auto",
      });

      // Ticks de Polos INFERIORES (Aguas Abajo del Q1)
      agregarTicksPolos(primitives, "main", "bot", X_main_center, Y_MAIN_BREAKER + 28, mainPoles === 4 ? "tetrapolar" : mainPoles === 3 ? "tripolar" : "bipolar");

      // Símbolo de Calibre del Cable INFERIOR (Aguas Abajo) (Desplazado 15mm hacia abajo)
      const cableBotMainY = Y_MAIN_BREAKER + 65;
      const guideBotWidth = Math.max(32, mainCalibreStr.length * 5.2);
      primitives.push({
        id: "unifilar-main-cable-bot-line",
        layerId: "6_Cotas_Textos",
        type: "line",
        start: { x: X_main_center - 6, y: cableBotMainY },
        end: { x: X_main_center + 6, y: cableBotMainY },
        lineWidth: 2.5,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-cable-bot-guide",
        layerId: "6_Cotas_Textos",
        type: "line",
        start: { x: X_main_center + 6, y: cableBotMainY },
        end: { x: X_main_center + 6 + guideBotWidth, y: cableBotMainY },
        lineWidth: 1.0,
        color: "auto",
      });
      primitives.push({
        id: "unifilar-main-cable-bot-txt",
        layerId: "6_Cotas_Textos",
        type: "text",
        x: X_main_center + 9,
        y: cableBotMainY - 2.0,
        text: mainCalibreStr,
        fontSize: 6.0,
        weight: "bold",
        align: "left",
        color: "auto",
      });

      // Dot de conexión de la acometida principal al centro del distribuidor
      primitives.push({
        id: "node-main-busbar",
        layerId: "2_Embarrado",
        type: "circle",
        cx: X_main_center,
        cy: Y_DISTRIBUTION_BUS,
        r: 4.0,
        fill: "#10B981",
        color: "#10B981",
      });
    }

    // Embarrado Principal Distribuidor de Cobre L1-L2-L3-N en Y_DISTRIBUTION_BUS (= 120mm)
    primitives.push({
      id: "unifilar-main-busbar",
      layerId: "2_Embarrado",
      type: "line",
      start: { x: busbarStartX, y: Y_DISTRIBUTION_BUS },
      end: { x: busbarEndX, y: Y_DISTRIBUTION_BUS },
      lineWidth: 1.8,
    });

    primitives.push({
      id: "unifilar-busbar-text",
      layerId: "6_Cotas_Textos",
      type: "text",
      x: busbarStartX,
      y: Y_DISTRIBUTION_BUS - 10,
      text: "EMBARRADO PRINCIPAL (L1 - L2 - L3 - N)",
      fontSize: 6.0,
      weight: "bold",
      align: "left",
    });

    // -----------------------------------------------------------------------
    // COLUMNAS POR CADA CIRCUITO/SALIDA SECUNDARIA (X_col)
    // -----------------------------------------------------------------------
    let globalOutIdx = 0;

    secciones.forEach((secGroup, _secIdx) => {
      secGroup.salidas.forEach((salida, salIdx) => {
        const i = globalOutIdx;
        globalOutIdx++;

        // Coordenada X fija de la columna i
        const X_col = X_INITIAL + 50 + i * COLUMN_STEP_X;

        const diff = esDiferencial(salida);
        const cableCalibre = calcularCalibreCableMm2(salida);

        // TAG único de Elemento (Q101, Q102... para termomagnéticos, D101, D102... para diferenciales)
        const prefixTag = diff ? "D" : "Q";
        const tagElemento = `${prefixTag}${100 + globalOutIdx}`;

        // Código de posición (F1.1, F1.2, etc.) para referencia de ubicación en la caja al pie
        const seccionNum = secGroup.seccion.orden != null ? secGroup.seccion.orden + 1 : _secIdx + 1;
        const tagPosicion = `F${seccionNum}.${salIdx + 1}`;

        // 1. Nodo de unión al Embarrado en (X_col, Y_DISTRIBUTION_BUS) (Dot de conexión r=4.0, 20% más pequeño)
        primitives.push({
          id: `node-busbar-${salida.id}`,
          layerId: "2_Embarrado",
          type: "circle",
          cx: X_col,
          cy: Y_DISTRIBUTION_BUS,
          r: 4.0,
          fill: "#10B981",
          color: "#10B981",
        });

        // 2. Conductor Vertical Superior
        primitives.push({
          id: `wire-top-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col, y: Y_DISTRIBUTION_BUS },
          end: { x: X_col, y: Y_BRANCH_DEVICES - 10 },
          lineWidth: 1.8,
        });

        // Ticks de Polos Superiores (Fases + Neutro) (10mm hacia abajo)
        agregarTicksPolos(primitives, salida.id, "top", X_col, Y_DISTRIBUTION_BUS + 30, salida.formato);

        // 3. Símbolo Indicador de Calibre del Cable SUPERIOR
        const cableTopY = Y_DISTRIBUTION_BUS + 85;
        primitives.push({
          id: `cable-top-line-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "line",
          start: { x: X_col - 6, y: cableTopY },
          end: { x: X_col + 6, y: cableTopY },
          lineWidth: 2.5,
          color: "auto",
        });

        const guideWidthBranch = Math.max(32, cableCalibre.length * 5.2);

        primitives.push({
          id: `cable-top-guide-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "line",
          start: { x: X_col + 6, y: cableTopY },
          end: { x: X_col + 6 + guideWidthBranch, y: cableTopY },
          lineWidth: 1.0,
          color: "auto",
        });

        // Texto del calibre posicionado DIRECTAMENTE SOBRE la línea guía horizontal
        primitives.push({
          id: `cable-top-txt-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col + 9,
          y: cableTopY - 2.0,
          text: cableCalibre,
          fontSize: 6.0,
          weight: "bold",
          align: "left",
          color: "auto",
        });

        // Símbolo del Disyuntor / Diferencial en Y_BRANCH_DEVICES (= 260mm) con Líneas de Conexión (DXF abb_unif_term.dxf)
        // Stub de conexión superior (inicio de entrada)
        primitives.push({
          id: `sym-stub-top-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col, y: Y_BRANCH_DEVICES - 16 },
          end: { x: X_col, y: Y_BRANCH_DEVICES - 10 },
          lineWidth: 1.8,
          color: "auto",
        });

        // Stub de conexión inferior (comienzo de salida)
        primitives.push({
          id: `sym-stub-bot-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col, y: Y_BRANCH_DEVICES + 10 },
          end: { x: X_col, y: Y_BRANCH_DEVICES + 16 },
          lineWidth: 1.8,
          color: "auto",
        });

        primitives.push({
          id: `sym-arm-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col, y: Y_BRANCH_DEVICES + 10 },
          end: { x: X_col - 7, y: Y_BRANCH_DEVICES - 6 },
          lineWidth: 1.8,
          color: "auto",
        });

        // Cruz 'X' de seccionamiento automático
        primitives.push({
          id: `sym-cross1-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col - 2, y: Y_BRANCH_DEVICES - 9 },
          end: { x: X_col + 2, y: Y_BRANCH_DEVICES - 5 },
          lineWidth: 1.8,
          color: "auto",
        });
        primitives.push({
          id: `sym-cross2-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col + 2, y: Y_BRANCH_DEVICES - 9 },
          end: { x: X_col - 2, y: Y_BRANCH_DEVICES - 5 },
          lineWidth: 1.8,
          color: "auto",
        });

        // Gatillo térmico / diferencial
        primitives.push({
          id: `sym-trigger-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col - 5, y: Y_BRANCH_DEVICES - 2 },
          end: { x: X_col - 8, y: Y_BRANCH_DEVICES + 2 },
          lineWidth: 1.2,
          color: "auto",
        });

        if (diff) {
          primitives.push({
            id: `sym-diff-toroid-${salida.id}`,
            layerId: "4_Unifilar",
            type: "circle",
            cx: X_col - 10,
            cy: Y_BRANCH_DEVICES,
            r: 4.0,
            color: "auto",
          });
        }

        // -------------------------------------------------------------------
        // TEXTOS DESCRIPTIVOS A LA IZQUIERDA DEL SÍMBOLO (RIGHT ALIGN)
        // -------------------------------------------------------------------
        // 1. Tag de Elemento (Q101, Q102... o D101, D102...) (6.5mm Bold)
        primitives.push({
          id: `txt-tag-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col + OFFSET_X_TEXT,
          y: Y_BRANCH_DEVICES - 12,
          text: tagElemento,
          fontSize: 6.5,
          weight: "bold",
          align: "right",
          dataId: salida.id,
          interactive: true,
          color: "auto",
        });

        // 2. Designación de Tipo (ABB precedido en rojo, 6.0mm Bold)
        const desigModelo = salida.componente_codigo_comercial || (diff ? "F200" : "S200");
        primitives.push({
          id: `txt-type-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col + OFFSET_X_TEXT,
          y: Y_BRANCH_DEVICES - 2,
          text: `ABB ${desigModelo}`,
          fontSize: 6.0,
          weight: "bold",
          align: "right",
          color: "auto",
        });

        // 3. Código SAP (6.0mm Normal)
        const codSAP = salida.componente_codigo || (diff ? "2CSF202101R1250" : "2CDS251001R0164");
        primitives.push({
          id: `txt-sap-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col + OFFSET_X_TEXT,
          y: Y_BRANCH_DEVICES + 8,
          text: codSAP,
          fontSize: 6.0,
          align: "right",
          color: "auto",
        });

        // 4. Conductor Vertical Inferior (conecta stub de salida con stub superior de borne)
        primitives.push({
          id: `wire-bottom-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col, y: Y_BRANCH_DEVICES + 16 },
          end: { x: X_col, y: Y_TERMINALS - 6 },
          lineWidth: 1.2,
        });

        // Ticks de Polos Inferiores (10mm hacia abajo)
        agregarTicksPolos(primitives, salida.id, "bot", X_col, Y_BRANCH_DEVICES + 30, salida.formato);

        // Símbolo Indicador de Calibre del Cable INFERIOR (AGUAS ABAJO)
        const cableBotY = Y_BRANCH_DEVICES + 95;
        primitives.push({
          id: `cable-bot-line-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "line",
          start: { x: X_col - 6, y: cableBotY },
          end: { x: X_col + 6, y: cableBotY },
          lineWidth: 2.5,
          color: "auto",
        });

        primitives.push({
          id: `cable-bot-guide-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "line",
          start: { x: X_col + 6, y: cableBotY },
          end: { x: X_col + 6 + guideWidthBranch, y: cableBotY },
          lineWidth: 1.0,
          color: "auto",
        });

        // Texto del calibre posicionado 1mm por encima de la línea guía horizontal inferior
        primitives.push({
          id: `cable-bot-txt-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col + 9,
          y: cableBotY - 2.0,
          text: cableCalibre,
          fontSize: 6.0,
          weight: "bold",
          align: "left",
          color: "auto",
        });

        // Bornera de Salida en Y_TERMINALS (= 400mm) (Símbolo DXF abb_unif_born.dxf con línea de conexión superior única)
        primitives.push({
          id: `term-stub-top-${salida.id}`,
          layerId: "5_Borneras",
          type: "line",
          start: { x: X_col, y: Y_TERMINALS - 6 },
          end: { x: X_col, y: Y_TERMINALS },
          lineWidth: 1.2,
          color: "auto",
        });

        primitives.push({
          id: `term-box-${salida.id}`,
          layerId: "5_Borneras",
          type: "rect",
          x: X_col - 4,
          y: Y_TERMINALS,
          width: 8,
          height: 8,
          fill: "none",
          color: "auto",
          lineWidth: 1.2,
        });

        primitives.push({
          id: `term-diag-${salida.id}`,
          layerId: "5_Borneras",
          type: "line",
          start: { x: X_col - 4, y: Y_TERMINALS },
          end: { x: X_col + 4, y: Y_TERMINALS + 8 },
          lineWidth: 1.2,
          color: "auto",
        });

        // Etiqueta de Borne (ej: X1.1) a la IZQUIERDA
        primitives.push({
          id: `term-label-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col + OFFSET_X_TEXT,
          y: Y_TERMINALS + 4,
          text: `X1.${globalOutIdx}`,
          fontSize: 4.0,
          weight: "bold",
          align: "right",
          color: "auto",
        });

        // -------------------------------------------------------------------
        // CONTENEDOR DE TEXTO DE SALIDA (REUBICADO 10mm HACIA ARRIBA)
        // -------------------------------------------------------------------
        const Y_LABELS_POS = Y_LABELS_BOTTOM - 10;

        primitives.push({
          id: `load-txt-box-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "rect",
          x: X_col - 55,
          y: Y_LABELS_POS - 24,
          width: 110,
          height: 52,
          fill: "none",
          color: "none",
          lineWidth: 0,
          dataId: salida.id,
          interactive: true,
        });

        // Referencia de Posición (ej. F1.1, F1.2) (6.5mm)
        primitives.push({
          id: `load-txt-tag-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col,
          y: Y_LABELS_POS - 13,
          text: tagPosicion,
          fontSize: 6.5,
          weight: "bold",
          align: "center",
          color: "auto",
        });

        // Texto Explicativo Completo del Circuito ("Sin Referencia" en fuente normal, cursiva y gris atenuado cuando no hay etiqueta)
        const rawEtiqueta = salida.etiqueta || salida.descripcion_personalizada;
        const isSinReferencia = !rawEtiqueta;
        const fullTextUsuario = isSinReferencia ? "Sin Referencia" : wrapText(rawEtiqueta.toUpperCase(), 20);

        primitives.push({
          id: `load-txt-lbl-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col,
          y: Y_LABELS_POS - 1,
          text: fullTextUsuario,
          fontSize: 6.5,
          weight: isSinReferencia ? "normal" : "bold",
          fontStyle: isSinReferencia ? "italic" : "normal",
          align: "center",
          color: isSinReferencia ? "#94A3B8" : "auto",
        });
      });
    });

    function esDiferencial(salida: Salida): boolean {
  const tp = (salida.tipo_proteccion || "").toLowerCase();
  const cod = (salida.componente_codigo || "").toLowerCase();
  const et = (salida.etiqueta || "").toLowerCase();
  const desc = (salida.descripcion_personalizada || "").toLowerCase();
  return (
    tp.includes("diferencial") ||
    cod.includes("f204") ||
    cod.includes("f202") ||
    et.includes("diferencial") ||
    et.includes("disyuntor") ||
    desc.includes("diferencial") ||
    desc.includes("disyuntor")
  );
}

    return {
      title: "Esquema Unifilar CAD IEC (ISOCPEUR)",
      layers: CAPAS_ESTANDAR_CAD,
      primitives,
      bounds: { minX: 0, minY: 0, maxX: totalWidth, maxY: Y_LABELS_BOTTOM + 80 },
    };
  }

  // =========================================================================
  // 2. VISTA TOPOGRÁFICA (ELEVACIÓN FÍSICA Y MAQUETADO DE GABINETE NOLLMANN NIS 1:1)
  // =========================================================================
  if (modoVisual === "topografico") {
    const marginX = 60;
    const marginY = 60;
    const pasoMm = params.pasoMm === 200 ? 200 : 150;

    const anchoGabinete = params.gabineteAnchoMm || 450;
    const altoGabinete = params.gabineteAltoMm || 600;

    // Dimensiones de ventana calada en carátula según nuestro catálogo verificado docs/CATALOGO_NOLLMANN.md
    const winW = (anchoGabinete <= 300) ? 180 : (anchoGabinete <= 450 ? 290 : 440);
    const winH = 45;
    const polosPorFilaMax = Math.floor(winW / 18);

    // Chasis útil
    const anchoUtil = anchoGabinete <= 300 ? 240 : (anchoGabinete <= 450 ? 395 : 540);
    const altoUtil = Math.max(300, altoGabinete - 80);

    const trayX = marginX + (anchoGabinete - anchoUtil) / 2;
    const trayY = marginY + (altoGabinete - altoUtil) / 2;

    // Dibujo paramétrico de Gabinete Nollmann NIS 1:1
    primitives.push({
      id: "gab-outer-stroke",
      layerId: "0_Gabinete",
      type: "rect",
      x: marginX,
      y: marginY,
      width: anchoGabinete,
      height: altoGabinete,
      stroke: "#64748B",
      color: "#64748B",
      fill: "none",
      lineWidth: 2,
      label: `GABINETE NOLLMANN NIS ${anchoGabinete}x${altoGabinete}x225 mm`,
    });

    // Marco Bandeja Útil / Subpanel Interior
    primitives.push({
      id: "gab-inner-frame",
      layerId: "0_Gabinete",
      type: "rect",
      x: trayX,
      y: trayY,
      width: anchoUtil,
      height: altoUtil,
      stroke: "#94A3B8",
      color: "#94A3B8",
      fill: "none",
      lineWidth: 1,
    });

    // Canaletas Laterales Verticales
    const canaletaWidth = 35;
    primitives.push({
      id: "duct-v-left",
      layerId: "3_Cablecanal",
      type: "rect",
      x: trayX + 8,
      y: trayY + 15,
      width: canaletaWidth,
      height: altoUtil - 30,
      color: "#64748B",
      stroke: "#64748B",
      fill: "none",
      lineWidth: 0.8,
    });

    primitives.push({
      id: "duct-v-right",
      layerId: "3_Cablecanal",
      type: "rect",
      x: trayX + anchoUtil - canaletaWidth - 8,
      y: trayY + 15,
      width: canaletaWidth,
      height: altoUtil - 30,
      color: "#64748B",
      stroke: "#64748B",
      fill: "none",
      lineWidth: 0.8,
    });

    // Centrado de Ventanas Caladas en Carátula y Rieles DIN 35
    const winX = marginX + (anchoGabinete - winW) / 2;
    let currentWinCenterY = marginY + 75;

    // Riel DIN Principal si existe Q1 (Fila 0)
    if (tieneInterruptorPrincipal) {
      // Ventana calada en carátula Q1
      primitives.push({
        id: "win-q1-cutout",
        layerId: "0_Gabinete",
        type: "rect",
        x: winX,
        y: currentWinCenterY - winH / 2,
        width: winW,
        height: winH,
        stroke: "#334155",
        color: "#334155",
        fill: "none",
        lineWidth: 1,
        label: `VENTANA CARÁTULA Q1 (${polosPorFilaMax} POLOS MAX)`,
      });

      // Riel DIN 35 de Q1
      primitives.push({
        id: "rail-main-din",
        layerId: "1_Equipos_DIN",
        type: "rect",
        x: winX - 10,
        y: currentWinCenterY - 17.5,
        width: winW + 20,
        height: 35,
        color: "#94A3B8",
        stroke: "#94A3B8",
        fill: "none",
        lineWidth: 0.8,
      });

      const q1Width = Math.max(90, (interruptorPrincipal?.polos || 3) * 30);
      const q1X = winX + (winW - q1Width) / 2;
      const es4PolosQ1 = (interruptorPrincipal?.polos === 4) || (interruptorPrincipal?.descripcion || "").toLowerCase().includes("4p") || (interruptorPrincipal?.codigo || "").toLowerCase().includes("s204");
      const keyQ1 = es4PolosQ1 ? "abb_topo_cbr_x4f" : "abb_topo_cbr_x3f";
      const dxfBlockQ1 = symbolRegistry.getSymbol(interruptorPrincipal?.codigo || keyQ1) || symbolRegistry.getSymbol(keyQ1);
      const q1H = dxfBlockQ1?.heightMm || 85;
      const q1Y = currentWinCenterY - q1H / 2;

      // Máscara opaca para tapar el riel bajo Q1
      primitives.push({
        id: "q1-bg-mask",
        layerId: "1_Equipos_DIN",
        type: "rect",
        x: q1X,
        y: q1Y,
        width: q1Width,
        height: q1H,
        fill: "bg",
        stroke: "none",
      });

      if (dxfBlockQ1) {
        dxfBlockQ1.primitives.forEach((p: any, idx) => {
          if (p.type === "line") {
            primitives.push({
              ...p,
              id: `q1-dxf-${idx}`,
              layerId: "1_Equipos_DIN",
              start: { x: q1X + p.start.x, y: q1Y + p.start.y },
              end: { x: q1X + p.end.x, y: q1Y + p.end.y },
              color: "auto",
              lineWidth: 0.5,
              dataId: "main-breaker",
              interactive: true,
            } as CadPrimitive);
          } else if (p.type === "circle") {
            primitives.push({
              ...p,
              id: `q1-dxf-${idx}`,
              layerId: "1_Equipos_DIN",
              cx: q1X + p.cx,
              cy: q1Y + p.cy,
              color: "auto",
              lineWidth: 0.5,
              dataId: "main-breaker",
              interactive: true,
            } as CadPrimitive);
          }
        });
      } else {
        primitives.push({
          id: "q1-main-box",
          layerId: "1_Equipos_DIN",
          type: "rect",
          x: q1X,
          y: q1Y,
          width: q1Width,
          height: q1H,
          color: "#3B82F6",
          stroke: "#3B82F6",
          fill: "none",
          dataId: "main-breaker",
          interactive: true,
        });
      }

      currentWinCenterY += pasoMm;
    }

    // Secciones y Salidas en Rieles DIN
    secciones.forEach((secGroup, secIdx) => {
      // Ventana calada en carátula para la sección
      primitives.push({
        id: `win-sec-${secIdx}-cutout`,
        layerId: "0_Gabinete",
        type: "rect",
        x: winX,
        y: currentWinCenterY - winH / 2,
        width: winW,
        height: winH,
        stroke: "#334155",
        color: "#334155",
        fill: "none",
        lineWidth: 1,
        label: `VENTANA FILA ${secIdx + 1} (${polosPorFilaMax} POLOS MAX)`,
      });

      // Riel DIN 35 de Sección
      primitives.push({
        id: `rail-sec-${secIdx}`,
        layerId: "1_Equipos_DIN",
        type: "rect",
        x: winX - 10,
        y: currentWinCenterY - 17.5,
        width: winW + 20,
        height: 35,
        color: "#94A3B8",
        stroke: "#94A3B8",
        fill: "none",
        lineWidth: 0.8,
      });

      // Canaleta horizontal intermedia entre filas
      primitives.push({
        id: `duct-h-${secIdx}`,
        layerId: "3_Cablecanal",
        type: "rect",
        x: trayX + canaletaWidth + 12,
        y: currentWinCenterY - Math.round(pasoMm / 2) - 12,
        width: anchoUtil - (canaletaWidth * 2) - 24,
        height: 24,
        color: "#64748B",
        stroke: "#64748B",
        fill: "none",
        lineWidth: 0.8,
      });

      let currentCompX = winX + 4;

      secGroup.salidas.forEach((salida) => {
        const polos = obtenerPolosSalida(salida);
        const diff = esDiferencial(salida);

        let keySalida = "abb_topo_cbr_x2f";
        if (diff) {
          keySalida = (polos >= 4) ? "abb_topo_cbr_x4f" : "abb_topo_cbr_x2f";
        } else {
          if (polos === 1) keySalida = "abb_topo_cbr_x1f";
          else if (polos === 2) keySalida = "abb_topo_cbr_x2f";
          else if (polos === 3) keySalida = "abb_topo_cbr_x3f";
          else keySalida = "abb_topo_cbr_x4f";
        }

        const dxfBlock = symbolRegistry.getSymbol(keySalida) || (salida.componente_codigo ? symbolRegistry.getSymbol(salida.componente_codigo) : null) || symbolRegistry.getSymbol(`abb_topo_cbr_x${polos}f`) || symbolRegistry.getSymbol("abb_topo_cbr_x1f");

        const compW = obtenerAnchoSalidaMm(salida);
        const compH = dxfBlock?.heightMm || 85;
        const compY = currentWinCenterY - compH / 2;

        // Evitar sobre-dibujo si sobrepasa la luz libre de la ventana de carátula
        if (currentCompX + compW > winX + winW - 2) {
          return;
        }

        // Máscara opaca de fondo para tapar el riel DIN bajo cada equipo
        primitives.push({
          id: `sal-${salida.id}-bg-mask`,
          layerId: "1_Equipos_DIN",
          type: "rect",
          x: currentCompX,
          y: compY,
          width: compW,
          height: compH,
          fill: "bg",
          stroke: "none",
        });

        if (dxfBlock) {
          dxfBlock.primitives.forEach((p: any, idx) => {
            if (p.type === "line") {
              primitives.push({
                ...p,
                id: `sal-${salida.id}-dxf-${idx}`,
                layerId: "1_Equipos_DIN",
                start: { x: currentCompX + p.start.x, y: compY + p.start.y },
                end: { x: currentCompX + p.end.x, y: compY + p.end.y },
                color: "auto",
                lineWidth: 0.5,
                dataId: salida.id,
                interactive: true,
              } as CadPrimitive);
            } else if (p.type === "circle") {
              primitives.push({
                ...p,
                id: `sal-${salida.id}-dxf-${idx}`,
                layerId: "1_Equipos_DIN",
                cx: currentCompX + p.cx,
                cy: compY + p.cy,
                color: "auto",
                lineWidth: 0.5,
                dataId: salida.id,
                interactive: true,
              } as CadPrimitive);
            }
          });
        } else {
          primitives.push({
            id: `comp-box-${salida.id}`,
            layerId: "1_Equipos_DIN",
            type: "rect",
            x: currentCompX,
            y: compY,
            width: compW,
            height: compH,
            fill: diff ? "#065F46" : "#1E40AF",
            stroke: diff ? "#10B981" : "#60A5FA",
            dataId: salida.id,
            interactive: true,
          });
        }

        // Elementos en la misma fila quedan yuxtapuestos uno al lado del otro
        currentCompX += compW;
      });

      currentWinCenterY += pasoMm;
    });

    return {
      title: "Elevación Topográfica CAD del Tablero",
      layers: CAPAS_ESTANDAR_CAD,
      primitives,
      bounds: { minX: 0, minY: 0, maxX: anchoGabinete + marginX * 2, maxY: altoGabinete + marginY * 2 },
    };
  }

  // =========================================================================
  // 3. VISTA ESQUEMA FUNCIONAL DE BLOQUES (CIRCUITOS & SECCIONES)
  // =========================================================================
  const cardWidth = 140;
  const cardHeight = 60;
  const gapX = 20;
  const gapY = 140;
  const startX = 60;
  let currentY = 50;

  // Bloque Principal Q1
  if (tieneInterruptorPrincipal) {
    primitives.push({
      id: "blk-main-card",
      layerId: "1_Equipos_DIN",
      type: "rect",
      x: startX,
      y: currentY,
      width: cardWidth * 2,
      height: cardHeight,
      fill: "#1E3A8A",
      stroke: "#3B82F6",
      label: `INTERRUPTOR PRINCIPAL Q1 - ${interruptorPrincipal?.corriente_nominal_a || 63}A`,
      dataId: "main-breaker",
      interactive: true,
    });

    primitives.push({
      id: "blk-main-subtext",
      layerId: "6_Cotas_Textos",
      type: "text",
      x: startX + cardWidth,
      y: currentY + cardHeight / 2 + 10,
      text: interruptorPrincipal?.codigo || "Q1 MAIN BREAKER ABB",
      fontSize: 3.5,
      align: "center",
    });

    currentY += gapY;
  }

  // Embarrado Distribución
  primitives.push({
    id: "blk-busbar-dist",
    layerId: "2_Embarrado",
    type: "rect",
    x: startX,
    y: currentY - 40,
    width: Math.max(500, maxSalidas * (cardWidth + gapX)),
    height: 14,
    fill: "#F59E0B",
    stroke: "#D97706",
    label: "EMBARRADO DE DISTRIBUCIÓN PRINCIPAL L1-L2-L3-N",
  });

  secciones.forEach((secGroup, secIdx) => {
    primitives.push({
      id: `sec-blk-label-${secIdx}`,
      layerId: "6_Cotas_Textos",
      type: "text",
      x: startX,
      y: currentY - 15,
      text: `SECCIÓN ${secIdx + 1}: ${secGroup.seccion.nombre || "General"}`,
      fontSize: 4.5,
      weight: "bold",
      align: "left",
    });

    secGroup.salidas.forEach((salida, salIdx) => {
      const posX = startX + salIdx * (cardWidth + gapX);
      const diff = esDiferencial(salida);
      const amp = obtenerAmperaje(salida);

      primitives.push({
        id: `blk-card-${salida.id}`,
        layerId: "1_Equipos_DIN",
        type: "rect",
        x: posX,
        y: currentY,
        width: cardWidth,
        height: cardHeight,
        fill: diff ? "#065F46" : "#1E40AF",
        stroke: diff ? "#10B981" : "#60A5FA",
        label: `${salida.etiqueta || `Circuito ${salIdx + 1}`}`,
        dataId: salida.id,
        interactive: true,
      });

      primitives.push({
        id: `blk-text-desc-${salida.id}`,
        layerId: "6_Cotas_Textos",
        type: "text",
        x: posX + cardWidth / 2,
        y: currentY + cardHeight / 2,
        text: `${salida.etiqueta || `C${salIdx + 1}`} | ${amp} (${salida.formato})\n${salida.componente_codigo || "Sin Match"}`,
        fontSize: 3,
        align: "center",
      });
    });

    currentY += gapY;
  });

  return {
    title: "Esquema Funcional de Bloques CAD",
    layers: CAPAS_ESTANDAR_CAD,
    primitives,
    bounds: { minX: 0, minY: 0, maxX: Math.max(600, maxSalidas * (cardWidth + gapX) + 120), maxY: currentY + 100 },
  };
}
