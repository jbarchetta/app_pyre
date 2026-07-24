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
}

// =========================================================================
// REGLAS ESTRUCTURALES DE MAQUETADO UNIFILAR (CAPAS Y PUNTOS FIJOS EN EJE Y)
// =========================================================================
export const UNIFILAR_LAYOUT = {
  Y_BUSBAR: 0,            // Acometida Inicial de Entrada
  Y_MAIN_BREAKER: 60,     // Interruptor Principal General Q1
  Y_DISTRIBUTION_BUS: 120,// Embarrado de Cobre L1-L2-L3-N
  Y_BRANCH_DEVICES: 260,  // Disyuntores de Salidas (Línea superior ampliada a 140mm)
  Y_TERMINALS: 400,       // Regleta de Borneras X1 (Línea inferior ampliada a 140mm)
  Y_LABELS_BOTTOM: 460,   // Textos descriptivos al pie

  OFFSET_X_TEXT: -15,     // Desplazamiento a la IZQUIERDA (-15mm) para descripciones de interruptor
  COLUMN_STEP_X: 120,     // Paso constante entre columnas de 120mm
  X_INITIAL: 100,         // Coordenada X inicial de la primera columna
};

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

function obtenerAnchoSalidaMm(salida: Salida): number {
  const { numFases, tieneNeutro } = obtenerReglaFormato(salida.formato);
  const polos = numFases + (tieneNeutro ? 1 : 0);
  return Math.max(17.5, polos * 17.5);
}

function esDiferencial(salida: Salida): boolean {
  return salida.tipo_proteccion === "seccional_diferencial";
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

  const numSecciones = Math.max(1, secciones.length);
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

    primitives.push({
      id: "unifilar-feed-line",
      layerId: "4_Unifilar",
      type: "line",
      start: { x: X_main_center, y: Y_BUSBAR },
      end: { x: X_main_center, y: Y_DISTRIBUTION_BUS },
      lineWidth: 1.5,
    });

    primitives.push({
      id: "unifilar-feed-label",
      layerId: "6_Cotas_Textos",
      type: "text",
      x: X_main_center + OFFSET_X_TEXT,
      y: Y_BUSBAR + 15,
      text: "ACOMETIDA PRINCIPAL\n3F + N (380V/220V)",
      fontSize: 6.0,
      weight: "bold",
      align: "right",
    });

    // Interruptor Principal General Q1 en Y_MAIN_BREAKER (= 60mm) centrado en el distribuidor
    if (tieneInterruptorPrincipal) {
      const mainPoles = interruptorPrincipal?.polos || 4;
      const mainAmp = interruptorPrincipal?.corriente_nominal_a || 63;
      primitives.push({
        id: "unifilar-main-symbol",
        layerId: "4_Unifilar",
        type: "symbol",
        x: X_main_center,
        y: Y_MAIN_BREAKER,
        symbolType: "breaker_main",
        label: `Q1 MAIN (${mainAmp}A / ${mainPoles}P)`,
        sublabel: interruptorPrincipal?.codigo || "ABB Tmax T1",
        dataId: "main-breaker",
        interactive: true,
      });

      // Texto de especificación desplazado a la IZQUIERDA (-15mm, RIGHT ALIGN)
      primitives.push({
        id: "unifilar-main-spec-txt",
        layerId: "6_Cotas_Textos",
        type: "text",
        x: X_main_center + OFFSET_X_TEXT,
        y: Y_MAIN_BREAKER + 5,
        text: `Q1 MAIN: ${mainAmp}A (${mainPoles}P)\n${interruptorPrincipal?.codigo || "ABB T1"}`,
        fontSize: 6.0,
        weight: "bold",
        align: "right",
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

        primitives.push({
          id: `cable-top-guide-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "line",
          start: { x: X_col + 6, y: cableTopY },
          end: { x: X_col + 24, y: cableTopY },
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

        // Símbolo del Disyuntor / Diferencial en Y_BRANCH_DEVICES (= 260mm) (Símbolos en color adaptativo Auto: Negro en Light, Blanco en Dark)
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

        // 4. Conductor Vertical Inferior AMPLIADO (260mm -> 400mm)
        primitives.push({
          id: `wire-bottom-${salida.id}`,
          layerId: "4_Unifilar",
          type: "line",
          start: { x: X_col, y: Y_BRANCH_DEVICES + 10 },
          end: { x: X_col, y: Y_TERMINALS },
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
          end: { x: X_col + 24, y: cableBotY },
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

        // Bornera de Salida en Y_TERMINALS (= 400mm) (Sin fondo de color)
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

        // Texto Explicativo Completo del Circuito (sin truncar a 15 caracteres, multilínea 6.5mm Bold)
        const rawEtiqueta = salida.etiqueta || salida.descripcion_personalizada || (salida.componente_id ? "" : "RESERVA");
        const fullTextUsuario = rawEtiqueta ? wrapText(rawEtiqueta.toUpperCase(), 20) : "RESERVA";

        primitives.push({
          id: `load-txt-lbl-${salida.id}`,
          layerId: "6_Cotas_Textos",
          type: "text",
          x: X_col,
          y: Y_LABELS_POS - 1,
          text: fullTextUsuario,
          fontSize: 6.5,
          weight: "bold",
          align: "center",
          color: "auto",
        });
      });
    });

    return {
      title: "Esquema Unifilar CAD IEC (ISOCPEUR)",
      layers: CAPAS_ESTANDAR_CAD,
      primitives,
      bounds: { minX: 0, minY: 0, maxX: totalWidth, maxY: Y_LABELS_BOTTOM + 80 },
    };
  }

  // =========================================================================
  // 2. VISTA TOPOGRÁFICA (ELEVACIÓN FÍSICA A ESCALA DE GABINETE EN MM)
  // =========================================================================
  if (modoVisual === "topografico") {
    const marginX = 60;
    const marginY = 60;
    const railSpacingY = 170;

    const anchoGabinete = params.gabineteAnchoMm || Math.max(600, marginX * 2 + maxSalidas * 50 + 120);
    const altoGabinete = params.gabineteAltoMm || Math.max(800, marginY * 2 + (numSecciones + (tieneInterruptorPrincipal ? 1 : 0)) * railSpacingY + 60);

    // 1. Marco Exterior del Gabinete
    primitives.push({
      id: "gab-outer-stroke",
      layerId: "0_Gabinete",
      type: "rect",
      x: marginX,
      y: marginY,
      width: anchoGabinete,
      height: altoGabinete,
      stroke: "#94A3B8",
      lineWidth: 2,
    });

    // Marco Interno Puerta / Chasis
    primitives.push({
      id: "gab-inner-frame",
      layerId: "0_Gabinete",
      type: "rect",
      x: marginX + 15,
      y: marginY + 15,
      width: anchoGabinete - 30,
      height: altoGabinete - 30,
      stroke: "#475569",
      lineWidth: 1,
    });

    // Canaletas Laterales Verticales
    const canaletaWidth = 40;
    primitives.push({
      id: "duct-v-left",
      layerId: "3_Cablecanal",
      type: "rect",
      x: marginX + 25,
      y: marginY + 30,
      width: canaletaWidth,
      height: altoGabinete - 60,
      stroke: "#64748B",
      fill: "rgba(100, 116, 139, 0.15)",
      label: "CANALETA VERTICAL 40mm",
    });

    primitives.push({
      id: "duct-v-right",
      layerId: "3_Cablecanal",
      type: "rect",
      x: marginX + anchoGabinete - 25 - canaletaWidth,
      y: marginY + 30,
      width: canaletaWidth,
      height: altoGabinete - 60,
      stroke: "#64748B",
      fill: "rgba(100, 116, 139, 0.15)",
      label: "CANALETA VERTICAL 40mm",
    });

    // Cotas Mecánicas en mm
    primitives.push({
      id: "dim-gab-width",
      layerId: "6_Cotas_Textos",
      type: "dimension",
      start: { x: marginX, y: marginY },
      end: { x: marginX + anchoGabinete, y: marginY },
      offset: -25,
      textOverride: `ANCHO GABINETE: ${anchoGabinete} mm`,
    });

    primitives.push({
      id: "dim-gab-height",
      layerId: "6_Cotas_Textos",
      type: "dimension",
      start: { x: marginX, y: marginY },
      end: { x: marginX, y: marginY + altoGabinete },
      offset: -25,
      textOverride: `ALTO GABINETE: ${altoGabinete} mm`,
    });

    let currentRailY = marginY + 70;
    const railX = marginX + 25 + canaletaWidth + 10;
    const railW = anchoGabinete - 50 - canaletaWidth * 2 - 20;

    // Riel Principal si existe Q1
    if (tieneInterruptorPrincipal) {
      primitives.push({
        id: "rail-main-din",
        layerId: "1_Equipos_DIN",
        type: "rect",
        x: railX,
        y: currentRailY + 20,
        width: railW,
        height: 35,
        stroke: "#CBD5E1",
        fill: "rgba(203, 213, 225, 0.2)",
        label: "RIEL DIN 35mm (PRINCIPAL)",
      });

      const q1Width = Math.max(90, (interruptorPrincipal?.polos || 3) * 30);
      const q1X = railX + (railW - q1Width) / 2;

      const dxfBlock = symbolRegistry.getSymbol(interruptorPrincipal?.codigo || "");

      if (dxfBlock) {
        dxfBlock.primitives.forEach((p, idx) => {
          primitives.push({
            ...p,
            id: `q1-dxf-${idx}`,
            layerId: "1_Equipos_DIN",
            x: q1X + (p as any).x,
            y: currentRailY + (p as any).y,
            dataId: "main-breaker",
            interactive: true,
          } as CadPrimitive);
        });
      } else {
        primitives.push({
          id: "q1-main-box",
          layerId: "1_Equipos_DIN",
          type: "rect",
          x: q1X,
          y: currentRailY,
          width: q1Width,
          height: 75,
          fill: "#1E3A8A",
          stroke: "#3B82F6",
          label: `Q1 ${interruptorPrincipal?.corriente_nominal_a || 63}A`,
          dataId: "main-breaker",
          interactive: true,
        });

        primitives.push({
          id: "q1-main-txt",
          layerId: "6_Cotas_Textos",
          type: "text",
          x: q1X + q1Width / 2,
          y: currentRailY + 38,
          text: interruptorPrincipal?.codigo || "MAIN BREAKER",
          fontSize: 3.5,
          align: "center",
          weight: "bold",
        });
      }

      currentRailY += railSpacingY;
    }

    // Secciones y Salidas en Rieles DIN
    secciones.forEach((secGroup, secIdx) => {
      const railY = currentRailY + 25;

      primitives.push({
        id: `duct-h-${secIdx}`,
        layerId: "3_Cablecanal",
        type: "rect",
        x: railX,
        y: currentRailY - 15,
        width: railW,
        height: 25,
        stroke: "#64748B",
        fill: "rgba(100, 116, 139, 0.15)",
        label: "CABLECANAL HORIZONTAL 25mm",
      });

      primitives.push({
        id: `rail-sec-${secIdx}`,
        layerId: "1_Equipos_DIN",
        type: "rect",
        x: railX,
        y: railY,
        width: railW,
        height: 35,
        stroke: "#CBD5E1",
        fill: "rgba(203, 213, 225, 0.2)",
        label: `RIEL DIN (SECCIÓN ${secGroup.seccion.nombre || secIdx + 1})`,
      });

      let currentCompX = railX + 15;

      secGroup.salidas.forEach((salida, salIdx) => {
        const compW = obtenerAnchoSalidaMm(salida);
        const compH = 65;
        const compY = railY - 15;
        const diff = esDiferencial(salida);
        const amp = obtenerAmperaje(salida);

        const dxfBlock = symbolRegistry.getSymbol(salida.componente_codigo || "");

        if (dxfBlock) {
          dxfBlock.primitives.forEach((p, idx) => {
            primitives.push({
              ...p,
              id: `sal-${salida.id}-dxf-${idx}`,
              layerId: "1_Equipos_DIN",
              x: currentCompX + (p as any).x,
              y: compY + (p as any).y,
              dataId: salida.id,
              interactive: true,
            } as CadPrimitive);
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
            label: `${salida.etiqueta || `Q${salIdx + 1}`}`,
            dataId: salida.id,
            interactive: true,
          });

          primitives.push({
            id: `comp-txt-${salida.id}`,
            layerId: "6_Cotas_Textos",
            type: "text",
            x: currentCompX + compW / 2,
            y: compY + compH / 2,
            text: `${salida.etiqueta || `Q${salIdx + 1}`}\n${amp}`,
            fontSize: 3,
            align: "center",
          });
        }

        currentCompX += compW + 12;
      });

      currentRailY += railSpacingY;
    });

    // Regleta de Bornes al fondo del Chasis
    const borneraY = marginY + altoGabinete - 60;
    primitives.push({
      id: "term-strip-bg",
      layerId: "5_Borneras",
      type: "rect",
      x: railX,
      y: borneraY,
      width: railW,
      height: 30,
      stroke: "#8B5CF6",
      fill: "rgba(139, 92, 246, 0.2)",
      label: "REGLETA DE BORNES DE SALIDA X1",
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
