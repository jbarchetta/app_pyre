import { useId } from "react";
import type { Salida, Seccion, ComponenteBusqueda, AccesoriosSugeridos } from "../api/client";
import { existeIncompatibilidadLink } from "../api/client";

const ANCHO_CARD = 114;
const ALTO_CARD = 48;
const GAP_X = 14;
const ALTO_SECCION = 160;

const FORMATO_LABEL: Record<Salida["formato"], string> = {
  unipolar: "1P",
  bipolar: "2P",
  tripolar: "3P",
  tetrapolar: "4P",
};

export interface Capas {
  codigos: boolean;
  embarrado: boolean;
}

export interface InterruptorPrincipalInfo {
  id?: string | null;
  codigo?: string | null;
  codigo_comercial?: string | null;
  descripcion?: string | null;
  corriente_nominal_a?: number | string | null;
  polos?: number | null;
}

const CAPAS_POR_DEFECTO: Capas = { codigos: true, embarrado: true };

interface EsquemaVisualProps {
  tieneInterruptorPrincipal: boolean;
  interruptorPrincipal?: InterruptorPrincipalInfo | null;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  zoom?: number;
  panX?: number;
  panY?: number;
  capas?: Capas;
  hoveredSalidaId?: string | null;
  onSalidaHover?: (salidaId: string | null) => void;
  onSalidaClick?: (salida: Salida) => void;
  tabActivo?: string;
  accesorios?: ComponenteBusqueda[];
  sugerencias?: AccesoriosSugeridos | null;
  onAsociarAccesorio?: (componenteId: string) => void;
  onDesasociarAccesorio?: (componenteId: string) => void;
  onAbrirAccesorioManual?: () => void;
  metodoEntrada?: string | null;
  metodoSalida?: string | null;
  modoVisual?: "bloques" | "unifilar" | "tablero";
  bornerasTipo?: string | null;
  cablecanalSugerido?: string | null;
  gabineteSugeridoAncho?: number | null;
  gabineteSugeridoAlto?: number | null;
}

export function EsquemaVisual({
  tieneInterruptorPrincipal,
  interruptorPrincipal,
  secciones,
  zoom = 1,
  panX = 0,
  panY = 0,
  capas = CAPAS_POR_DEFECTO,
  hoveredSalidaId,
  onSalidaHover,
  onSalidaClick,
  tabActivo,
  accesorios = [],
  sugerencias,
  onAsociarAccesorio,
  onDesasociarAccesorio,
  onAbrirAccesorioManual,
  metodoEntrada,
  metodoSalida,
  modoVisual = "bloques",
  bornerasTipo,
  cablecanalSugerido,
  gabineteSugeridoAncho,
  gabineteSugeridoAlto,
}: EsquemaVisualProps) {
  const patternId = useId();
  const todasLasSalidas = secciones.flatMap((s) => s.salidas);

  // Calcular el número máximo de salidas para definir el ancho del viewBox
  const maxSalidas = Math.max(1, ...secciones.map((s) => s.salidas.length));
  const anchoViewBox = Math.max(540, 60 + maxSalidas * (ANCHO_CARD + GAP_X));

  const offsetPrincipal = tieneInterruptorPrincipal ? 115 : 20;
  const numSecciones = Math.max(1, secciones.length);
  const altoBase = 40 + offsetPrincipal + numSecciones * ALTO_SECCION;
  const vWidth = anchoViewBox / zoom;
  const vHeight = altoBase / zoom;
  const vX = (anchoViewBox - vWidth) / 2 + panX;
  const vY = panY;

  const mainBreakerWidth = 134;
  const mainBreakerX = anchoViewBox / 2 - mainBreakerWidth / 2;
  const mainBreakerY = 12;

  const fila1CardY = 12 + offsetPrincipal;
  const fila1SubBusbarY = fila1CardY - 24;

  const ultimaSeccionY = 12 + offsetPrincipal + (numSecciones - 1) * ALTO_SECCION;
  const ultimoSubBusbarY = ultimaSeccionY - 24;

  // Datos reales del interruptor principal
  const mainPolosText = `${interruptorPrincipal?.polos ?? 3}P`;
  const mainAmperajeText = interruptorPrincipal?.corriente_nominal_a
    ? `${Math.round(Number(interruptorPrincipal.corriente_nominal_a))}A`
    : "MAIN";
  const mainCodigoText = interruptorPrincipal?.codigo ?? interruptorPrincipal?.codigo_comercial ?? "MAIN BREAKER";
  const mainCodigoAcortado = mainCodigoText.length > 12 ? `${mainCodigoText.slice(0, 11)}…` : mainCodigoText;

  const mainTooltipInfo = [
    `MAIN BREAKER Q1`,
    `Carga Principal: ${mainAmperajeText}`,
    `Polos: ${mainPolosText}`,
    interruptorPrincipal?.codigo ? `Código SAP: ${interruptorPrincipal.codigo}` : undefined,
    interruptorPrincipal?.descripcion ? `Descripción: ${interruptorPrincipal.descripcion}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const renderUnifilar = () => {
    const uWidth = anchoViewBox / zoom;
    const uHeight = altoBase / zoom;
    const uX = (anchoViewBox - uWidth) / 2 + panX;
    const uY = panY;

    const renderPhaseTicks = (x: number, y: number, polesCount: number) => {
      const ticks = [];
      const tickSpacing = 4;
      const startY = y - ((polesCount - 1) * tickSpacing) / 2;
      for (let i = 0; i < polesCount; i++) {
        const cy = startY + i * tickSpacing;
        ticks.push(
          <line
            key={i}
            x1={x - 4}
            y1={cy + 2}
            x2={x + 4}
            y2={cy - 2}
            stroke="#000000"
            strokeWidth={1.5}
          />
        );
      }
      return <g>{ticks}</g>;
    };

    const renderBreakerSymbol = (x: number, y: number, isDiff: boolean, _hasMatch: boolean) => {
      const color = "#000000";
      return (
        <g transform={`translate(${x}, ${y})`}>
          <rect x={-5} y={-10} width={10} height={20} fill="#ffffff" />
          <line x1={0} y1={-10} x2={6} y2={6} stroke={color} strokeWidth={2} />
          {isDiff ? (
            <path
              d="M -7,-2 A 6,6 0 1,0 5,-2 A 6,6 0 1,0 -7,-2"
              fill="none"
              stroke={color}
              strokeWidth={1.2}
              strokeDasharray="1.5 1.5"
            />
          ) : (
            <path d="M -2.5,4 L 2.5,9 M -2.5,9 L 2.5,4" stroke={color} strokeWidth={1.4} />
          )}
        </g>
      );
    };

    const fila1CardY = 12 + offsetPrincipal;
    const fila1SubBusbarY = fila1CardY - 14;
    const ultimaSeccionY = 12 + offsetPrincipal + (numSecciones - 1) * ALTO_SECCION;
    const ultimoSubBusbarY = ultimaSeccionY - 14;

    const row1BusbarWidth = 30 + (secciones[0]?.salidas.length || 1) * (ANCHO_CARD + GAP_X) - GAP_X;
    const q1X = Math.max(anchoViewBox / 2, (12 + row1BusbarWidth) / 2);

    return (
      <svg
        role="img"
        aria-label="Esquema unifilar CAD"
        viewBox={`${uX} ${uY} ${uWidth} ${uHeight}`}
        className="w-full h-full bg-[#ffffff] select-none transition-all duration-200"
      >
        <defs>
          <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={anchoViewBox} height={altoBase} fill="url(#cad-grid)" />

        {tieneInterruptorPrincipal && (
          <g>
            {/* Input line from Client */}
            <line x1={q1X} y1={10} x2={q1X} y2={50} stroke="#059669" strokeWidth={1.2} />
            {/* Double arrowhead pointing down */}
            <path d={`M ${q1X - 4} 20 L ${q1X} 25 L ${q1X + 4} 20`} fill="none" stroke="#059669" strokeWidth={1.2} />
            <path d={`M ${q1X - 4} 27 L ${q1X} 32 L ${q1X + 4} 27`} fill="none" stroke="#059669" strokeWidth={1.2} />
            <text x={q1X + 14} y={24} fontSize={11.5} fontFamily="sans-serif" fontWeight="bold" fill="#0f172a">CLIENTE</text>

            {renderPhaseTicks(q1X, 38, interruptorPrincipal?.polos ?? 3)}
            {renderBreakerSymbol(q1X, 50, false, true)}
            <text x={q1X + 16} y={45} fontSize={14} fontFamily="monospace" fontWeight="bold" fill="#0f172a">Q1</text>
            <text x={q1X + 16} y={58} fontSize={11} fontFamily="sans-serif" fill="#0f172a">
              {mainAmperajeText} / {mainPolosText}
            </text>
            <text x={q1X + 16} y={70} fontSize={10} fontFamily="monospace" fill="#475569">
              {mainCodigoAcortado}
            </text>
            
            {/* Direct vertical feed line from Q1 to Row 1 Busbar Center */}
            <line
              x1={q1X}
              y1={65}
              x2={q1X}
              y2={fila1SubBusbarY}
              stroke="#059669"
              strokeWidth={1.5}
            />
            {/* Dot de conexión verde (r=4.0, 20% más pequeño) */}
            <circle cx={q1X} cy={fila1SubBusbarY} r={4.0} fill="#059669" />
          </g>
        )}

        {capas.embarrado && (
          <line
            x1={12}
            y1={fila1SubBusbarY}
            x2={12}
            y2={ultimoSubBusbarY}
            stroke="#059669"
            strokeWidth={1.8}
          />
        )}

        {secciones.map(({ seccion, salidas }, sIdx) => {
          const cardY = 12 + offsetPrincipal + sIdx * ALTO_SECCION;
          const rowBusbarY = cardY - 24;
          const seccionNum = seccion.orden != null ? seccion.orden + 1 : sIdx + 1;
          const rowWidth = 30 + salidas.length * (ANCHO_CARD + GAP_X) - GAP_X;

          return (
            <g key={`unifilar-row-${seccion.id}`}>
              {capas.embarrado && (
                <line
                  x1={12}
                  y1={rowBusbarY}
                  x2={sIdx === 0 && tieneInterruptorPrincipal ? Math.max(rowWidth, q1X) : rowWidth}
                  y2={rowBusbarY}
                  stroke="#059669"
                  strokeWidth={1.5}
                />
              )}

              {salidas.map((salida, salIdx) => {
                const hasMatch = !!salida.componente_id;
                const isDirectHover = hoveredSalidaId === salida.id;
                const cardX = 30 + salIdx * (ANCHO_CARD + GAP_X);
                const x = cardX + ANCHO_CARD / 2;

                const parent = salida.alimentado_por_salida_id
                  ? todasLasSalidas.find((s) => s.id === salida.alimentado_por_salida_id)
                  : null;
                const hasParent = !!parent;

                const isParent = todasLasSalidas.some((s) => s.alimentado_por_salida_id === salida.id);

                const hasLinkError = !!(
                  parent &&
                  existeIncompatibilidadLink(
                    salida.formato,
                    salida.tipo_proteccion,
                    parent.formato,
                    parent.tipo_proteccion
                  )
                );

                let parentCode = "";
                if (hasParent && parent) {
                  secciones.forEach((s, pSIdx) => {
                    const oIdx = s.salidas.findIndex(o => o.id === parent.id);
                    if (oIdx !== -1) {
                      const pSecNum = s.seccion.orden != null ? s.seccion.orden + 1 : pSIdx + 1;
                      parentCode = `F${pSecNum}.${oIdx + 1}`;
                    }
                  });
                }

                const children = todasLasSalidas.filter((s) => s.alimentado_por_salida_id === salida.id);
                const childrenCodes = children.map((c) => {
                  let cCode = "";
                  secciones.forEach((s, cSIdx) => {
                    const oIdx = s.salidas.findIndex(o => o.id === c.id);
                    if (oIdx !== -1) {
                      const cSecNum = s.seccion.orden != null ? s.seccion.orden + 1 : cSIdx + 1;
                      cCode = `F${cSecNum}.${oIdx + 1}`;
                    }
                  });
                  return cCode;
                }).filter(Boolean);
                const childrenLabel = childrenCodes.join(", ");

                const isDiff = salida.tipo_proteccion === "seccional_diferencial";
                const prefixTag = isDiff ? "D" : "Q";
                const tagElemento = `${prefixTag}${101 + salIdx}`;
                const polesCount = FORMATO_LABEL[salida.formato] ? parseInt(FORMATO_LABEL[salida.formato].charAt(0)) : 2;
                const labelPoles = FORMATO_LABEL[salida.formato] ?? "2P";
                const labelCarga = `${salida.carga_unidad === "A" ? Math.round(Number(salida.carga_valor)) : salida.carga_valor}${salida.carga_unidad}`;
                const codeAuto = `F${seccionNum}.${salIdx + 1}`;
                const isToBornera = bornerasTipo !== "ninguno" && bornerasTipo != null;

                const strokeColor = isDirectHover ? "#b91c1c" : "#0f172a";

                return (
                  <g
                    key={salida.id}
                    className="cursor-pointer"
                    onMouseEnter={() => onSalidaHover?.(salida.id)}
                    onMouseLeave={() => onSalidaHover?.(null)}
                    onClick={() => onSalidaClick?.(salida)}
                  >
                    {/* Dot de conexión verde a la línea principal (r=4.0, 20% más pequeño) */}
                    {!hasParent && (
                      <circle cx={x} cy={rowBusbarY} r={4.0} fill="#059669" />
                    )}

                    {hasParent ? (
                      <g>
                        <line
                          x1={x}
                          y1={cardY + 6}
                          x2={x}
                          y2={cardY - 8}
                          stroke={strokeColor}
                          strokeWidth={1.8}
                        />
                        <path
                          d={`M ${x - 4} ${cardY - 12} L ${x} ${cardY - 8} L ${x + 4} ${cardY - 12}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={1.8}
                        />
                        <text
                          x={x}
                          y={cardY - 15}
                          fontSize={10}
                          fontFamily="monospace"
                          fill={strokeColor}
                          textAnchor="middle"
                        >
                          {`DESDE ${parentCode}`}
                        </text>
                      </g>
                    ) : (
                      <line
                        x1={x}
                        y1={rowBusbarY}
                        x2={x}
                        y2={cardY + 6}
                        stroke={strokeColor}
                        strokeWidth={1.8}
                      />
                    )}

                    {renderPhaseTicks(x, cardY - 2, polesCount)}
                    {renderBreakerSymbol(x, cardY + 16, isDiff, hasMatch)}
                    <text x={x + 12} y={cardY + 20} fontSize={12} fontFamily="monospace" fontWeight="bold" fill="#0f172a">{tagElemento}</text>

                    {hasLinkError && (
                      <g
                        transform={`translate(${x + 24}, ${cardY + 16})`}
                        className="cursor-help"
                      >
                        <polygon
                          points="0,-8 8,6 -8,6"
                          fill="#f59e0b"
                          stroke="#d97706"
                          strokeWidth={1.2}
                          strokeLinejoin="round"
                        />
                        <text
                          y={4}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="bold"
                          fill="#ffffff"
                          fontFamily="sans-serif"
                        >
                          !
                        </text>
                      </g>
                    )}

                    {isParent ? (
                      <g>
                        <line
                          x1={x}
                          y1={cardY + 26}
                          x2={x}
                          y2={cardY + 45}
                          stroke={strokeColor}
                          strokeWidth={1.8}
                        />
                        <path
                          d={`M ${x - 4} ${cardY + 41} L ${x} ${cardY + 45} L ${x + 4} ${cardY + 41}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={1.8}
                        />
                        <text
                          x={x}
                          y={cardY + 54}
                          fontSize={10}
                          fontFamily="monospace"
                          fill={strokeColor}
                          textAnchor="middle"
                        >
                          {`A ${childrenLabel}`}
                        </text>
                      </g>
                    ) : isToBornera ? (
                      <g>
                        {/* Símbolo de borne de conexión en negro */}
                        <line
                          x1={x}
                          y1={cardY + 26}
                          x2={x}
                          y2={cardY + 48}
                          stroke={strokeColor}
                          strokeWidth={1.8}
                        />
                        <circle cx={x} cy={cardY + 48} r={5} fill="#ffffff" stroke="#000000" strokeWidth={1.8} />
                        <circle cx={x} cy={cardY + 48} r={2} fill="#000000" />
                      </g>
                    ) : (
                      <g>
                        {/* Union line from breaker to dashed line */}
                        <line
                          x1={x}
                          y1={cardY + 26}
                          x2={x}
                          y2={cardY + 40}
                          stroke={strokeColor}
                          strokeWidth={1.8}
                        />
                        <line
                          x1={x}
                          y1={cardY + 40}
                          x2={x}
                          y2={cardY + 58}
                          stroke={strokeColor}
                          strokeWidth={1.8}
                          strokeDasharray="2 2"
                        />
                      </g>
                    )}

                    {/* Contenedor de Texto de Salida (Transparente sin borde - Solo texto visible) */}
                    <rect
                      x={x - 55}
                      y={cardY + 58}
                      width={110}
                      height={50}
                      fill="none"
                      stroke="none"
                    />

                    {/* Referencia de Posición (F1.1, F1.2, etc.) */}
                    <text
                      x={x}
                      y={cardY + 73}
                      fontSize={12.5}
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={isDirectHover ? "#b91c1c" : "#0f172a"}
                      textAnchor="middle"
                    >
                      {codeAuto}
                    </text>
                    <text
                      x={x}
                      y={cardY + 87}
                      fontSize={14}
                      fontFamily="sans-serif"
                      fontWeight={salida.etiqueta ? "bold" : "normal"}
                      fill={isDirectHover ? "#b91c1c" : salida.etiqueta ? "#1f2937" : "#d97706"}
                      textAnchor="middle"
                    >
                      {salida.etiqueta ? salida.etiqueta.toUpperCase().slice(0, 15) : (salida.componente_id ? "" : "RESERVA")}
                    </text>
                    <text
                      x={x}
                      y={cardY + 101}
                      fontSize={14}
                      fontFamily="sans-serif"
                      fill="#0f172a"
                      textAnchor="middle"
                    >
                      {labelCarga} / {labelPoles}
                    </text>
                    {salida.componente_codigo && (
                      <text
                        x={x}
                        y={cardY + 114}
                        fontSize={12.5}
                        fontFamily="monospace"
                        fill="#64748b"
                        textAnchor="middle"
                      >
                        {salida.componente_codigo.slice(0, 15)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  };

  const renderTablero = () => {
    const sectionsCount = secciones.length;
    const q1Poles = interruptorPrincipal?.polos ?? 3;
    const q1Width = q1Poles === 4 ? 120 : 90;

    const getPolesOfFormat = (fmt: Salida["formato"]) => {
      if (fmt === "unipolar") return 1;
      if (fmt === "bipolar") return 2;
      if (fmt === "tripolar") return 3;
      if (fmt === "tetrapolar") return 4;
      return 2;
    };

    const getBorneWidthForSalida = (salida: Salida) => {
      const ratingVal = Number(salida.carga_valor) || 16;
      if (ratingVal <= 16) return 5;
      if (ratingVal <= 25) return 6;
      if (ratingVal <= 32) return 8;
      if (ratingVal <= 50) return 10;
      return 12;
    };

    const hasLateralIzq = false;
    const hasLateralDer = false;
    const hasInferior = false;
    const totalBornesWidth = 0;

    const rowWidths = secciones.map((sec) =>
      sec.salidas.reduce((sum, sal) => sum + getPolesOfFormat(sal.formato) * 18, 0)
    );

    const maxSeccionWidth = Math.max(q1Width, ...rowWidths);
    const margin = 27;

    const parsedCanal = (cablecanalSugerido || "40x40").split("x");
    let canalW = parseInt(parsedCanal[0]) || 40;
    const canalH = parseInt(parsedCanal[1]) || 40;

    const rail_width = Math.max(120, maxSeccionWidth);

    // 1. Calculate base layout width (Column model)
    // Column1 starts flush at the left edge of the bandeja: x_left_canal = margin
    // Column2 is fixed clearance = 15mm -> x_rail_start = margin + canalW + 15
    // Column3 is elements width = rail_width
    // Column5 is right cablecanal, placed flush at the right edge of the bandeja!
    // Column4 is all remaining space on the right side between Column3 end and Column5.
    const calculated_width = (margin * 2) + (canalW * 2) + 30 + rail_width;
    const cabinet_width = gabineteSugeridoAncho || calculated_width;

    const x_left_canal = margin;
    const x_rail_start = margin + canalW + 15;
    const x_right_canal = cabinet_width - margin - canalW;

    // 2. Calculate base layout height (Row model)
    const q1Height = tieneInterruptorPrincipal ? 130 : 0;

    let base_row0Y = margin;
    let base_canal0Y = 0;
    let current_y = margin;

    if (tieneInterruptorPrincipal) {
      base_row0Y = margin + 80;
      base_canal0Y = base_row0Y + q1Height + (60 - canalH) / 2; // centers the canal in the Row3 space (60mm)
      current_y = base_row0Y + q1Height + 60 + canalH;
    } else {
      base_canal0Y = margin;
      current_y = margin + canalH;
    }

    const base_rowYPositions: number[] = [];
    const base_rowCanalYPositions: number[] = [];

    for (let i = 0; i < sectionsCount; i++) {
      const rowY = current_y + 15;
      base_rowYPositions.push(rowY);
      base_rowCanalYPositions.push(rowY + 95 + 15);
      current_y = rowY + 95 + 15 + canalH;
    }

    const calculated_height = current_y + margin;

    const base_topCanalY = tieneInterruptorPrincipal ? base_canal0Y : margin;

    // Determine cabinet_height and shiftY
    const cabinet_height = gabineteSugeridoAlto || calculated_height;
    const extra_height = cabinet_height - calculated_height;
    const shiftY = extra_height > 0 ? extra_height / 2 : 0; // only shift if positive to center

    // Apply shiftY
    const row0Y = base_row0Y + shiftY;
    const canal0Y = base_canal0Y + shiftY;
    const topCanalY = base_topCanalY + shiftY;
    const rowYPositions = base_rowYPositions.map(y => y + shiftY);
    const rowCanalYPositions = base_rowCanalYPositions.map(y => y + shiftY);
    const borneraInferiorY = 0;

    const uWidth = cabinet_width / zoom;
    const uHeight = cabinet_height / zoom;
    const uX = (cabinet_width - uWidth) / 2 + panX;
    const uY = panY;

    const renderCableCanal = (cx: number, cy: number, cw: number, ch: number, isVertical: boolean) => {
      return (
        <g key={`canal-${cx}-${cy}-${isVertical ? "v" : "h"}`}>
          <rect x={cx} y={cy} width={cw} height={ch} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />
        </g>
      );
    };

    const renderDINRail = (rx: number, ry: number, rw: number, rh: number, keyVal: string) => {
      return (
        <rect
          key={keyVal}
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth={1}
          rx={1}
        />
      );
    };

    const renderQ1InCabinet = (qx: number, qy: number, qw: number, qh: number) => {
      const svgFilename = `/svg/abb_rec005.svg`;
      const svgAspect = 36.27 / 82.32;
      
      let imgH = qh;
      let imgW = qh * svgAspect;
      if (imgW > qw) {
        imgW = qw;
        imgH = qw / svgAspect;
      }
      
      const imgX = qx + (qw - imgW) / 2;
      const imgY = qy + (qh - imgH) / 2;

      return (
        <g key="q1-cabinet">
          <image
            href={svgFilename}
            x={imgX}
            y={imgY}
            width={imgW}
            height={imgH}
            preserveAspectRatio="xMidYMid meet"
          />
          <text
            x={qx + qw/2}
            y={qy - 8}
            fontSize={9}
            fontFamily="monospace"
            fontWeight="bold"
            fill="#0f172a"
            textAnchor="middle"
          >
            Q1
          </text>
          <text
            x={qx + qw/2}
            y={qy + qh + 12}
            fontSize={8}
            fontFamily="sans-serif"
            fontWeight="bold"
            fill="#0f172a"
            textAnchor="middle"
          >
            {mainAmperajeText} / {mainPolosText}
          </text>
          <text
            x={qx + qw/2}
            y={qy + qh + 22}
            fontSize={7}
            fontFamily="monospace"
            fill="#64748b"
            textAnchor="middle"
          >
            {mainCodigoAcortado}
          </text>
        </g>
      );
    };

    const renderMCBInCabinet = (mx: number, my: number, mw: number, mh: number, isDiff: boolean, hasMatch: boolean, sid: string) => {
      const poles = mw / 18;
      const strokeColor = "#0f172a";
      const strokeDash = hasMatch ? undefined : "3 3";

      if (hasMatch) {
        const numPoles = Math.min(4, Math.max(1, Math.round(poles)));
        const svgFilename = `/svg/abb_rec00${numPoles}.svg`;

        return (
          <g key={`mcb-${sid}`}>
            <image
              href={svgFilename}
              x={mx}
              y={my}
              width={mw}
              height={mh}
              preserveAspectRatio="xMidYMid meet"
            />
            {isDiff && (
              <g transform={`translate(${mx + 7}, ${my + 10})`}>
                <circle cx={0} cy={0} r={4} fill="#ffffff" stroke={strokeColor} strokeWidth={1} />
                <text x={0} y={2} fontSize={6} fontFamily="sans-serif" fontWeight="bold" fill="#0f172a" textAnchor="middle">T</text>
              </g>
            )}
          </g>
        );
      }

      // If it is RESERVA (no match), draw the legacy CAD dashed slot
      const dividers = [];
      for (let p = 1; p < poles; p++) {
        dividers.push(
          <line key={p} x1={mx + p * 18} y1={my} x2={mx + p * 18} y2={my + mh} stroke={strokeColor} strokeWidth={0.8} strokeDasharray={strokeDash} />
        );
      }

      return (
        <g key={`mcb-${sid}`}>
          <rect x={mx} y={my} width={mw} height={mh} rx={2} fill="#ffffff" stroke={strokeColor} strokeWidth={1.2} strokeDasharray={strokeDash} />
          {dividers}
        </g>
      );
    };

    return (
      <svg
        role="img"
        aria-label="Disposición física a escala real del tablero"
        viewBox={`${uX} ${uY} ${uWidth} ${uHeight}`}
        className="w-full h-full bg-[#ffffff] select-none transition-all duration-200"
      >
        {/* Cabinet Enclosure */}
        <rect x={1} y={1} width={cabinet_width - 2} height={cabinet_height - 2} rx={4} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
        {/* Inner backing plate / Bandeja interior (margin = 27 = 3x from outer edge) */}
        <rect x={margin} y={margin} width={cabinet_width - margin * 2} height={cabinet_height - margin * 2} rx={2} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />

        {/* DIN Rails */}
        {tieneInterruptorPrincipal && renderDINRail(x_rail_start, row0Y + q1Height/2 - 10, rail_width, 20, "rail-q1")}
        {rowYPositions.map((ry, index) => renderDINRail(x_rail_start, ry + 95/2 - 10, rail_width, 20, `rail-${index}`))}
        {hasInferior && renderDINRail(x_rail_start, borneraInferiorY + 15, rail_width, 15, "rail-borne-inf")}

        {/* Cable Canals */}
        {!tieneInterruptorPrincipal && renderCableCanal(x_left_canal, margin, x_right_canal + canalW - x_left_canal, canalH, false)}
        {tieneInterruptorPrincipal && renderCableCanal(x_left_canal, canal0Y, x_right_canal + canalW - x_left_canal, canalH, false)}
        {rowCanalYPositions.map((cy) => renderCableCanal(x_left_canal, cy, x_right_canal + canalW - x_left_canal, canalH, false))}
        
        {/* Vertical Cable Canals */}
        {renderCableCanal(x_left_canal, topCanalY, canalW, calculated_height - margin - topCanalY, true)}
        {renderCableCanal(x_right_canal, topCanalY, canalW, calculated_height - margin - topCanalY, true)}

        {/* Main Breaker */}
        {tieneInterruptorPrincipal && renderQ1InCabinet(x_rail_start + rail_width/2 - q1Width/2, row0Y, q1Width, q1Height)}

        {/* Section Row Components */}
        {secciones.map(({ seccion, salidas }, sIdx) => {
          const rowY = rowYPositions[sIdx];
          const aboveCanalY = sIdx === 0
            ? (tieneInterruptorPrincipal ? canal0Y : margin)
            : rowCanalYPositions[sIdx - 1];
          let startCompX = x_rail_start + 10;
          const seccionNum = seccion.orden != null ? seccion.orden + 1 : sIdx + 1;

          return (
            <g key={`sec-comp-${seccion.id}`}>
              {salidas.map((salida, salIdx) => {
                const poles = getPolesOfFormat(salida.formato);
                const w = poles * 18;
                const isDiff = salida.tipo_proteccion === "seccional_diferencial";
                const hasMatch = !!salida.componente_id;
                const rating = `${salida.carga_unidad === "A" ? Math.round(Number(salida.carga_valor)) : salida.carga_valor}${salida.carga_unidad}`;
                const codeAuto = `F${seccionNum}.${salIdx + 1}`;

                const parent = salida.alimentado_por_salida_id
                  ? todasLasSalidas.find((s) => s.id === salida.alimentado_por_salida_id)
                  : null;
                const hasLinkError = !!(
                  parent &&
                  existeIncompatibilidadLink(
                    salida.formato,
                    salida.tipo_proteccion,
                    parent.formato,
                    parent.tipo_proteccion
                  )
                );

                const mcbX = startCompX;
                startCompX += w;

                return (
                  <g
                    key={salida.id}
                    className="cursor-pointer"
                    onMouseEnter={() => onSalidaHover?.(salida.id)}
                    onMouseLeave={() => onSalidaHover?.(null)}
                    onClick={() => onSalidaClick?.(salida)}
                  >
                    {renderMCBInCabinet(mcbX, rowY, w, 95, isDiff, hasMatch, salida.id)}
                    {capas.codigos && (
                      <g key={`canal-labels-${salida.id}`}>
                        <text
                          x={mcbX + w / 2}
                          y={aboveCanalY + 18}
                          fontSize={10}
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill="#0f172a"
                          textAnchor="middle"
                        >
                          {codeAuto}
                        </text>
                        {hasMatch && (
                          <text
                            x={mcbX + w / 2}
                            y={aboveCanalY + 30}
                            fontSize={9}
                            fontFamily="sans-serif"
                            fontWeight="bold"
                            fill="#475569"
                            textAnchor="middle"
                          >
                            {rating}
                          </text>
                        )}
                      </g>
                    )}
                    {hasLinkError && (
                      <g
                        transform={`translate(${mcbX + w - 10}, ${rowY + 15})`}
                        className="cursor-help"
                      >
                        <polygon
                          points="0,-8 8,6 -8,6"
                          fill="#f59e0b"
                          stroke="#d97706"
                          strokeWidth={1.2}
                          strokeLinejoin="round"
                        />
                        <text
                          y={4}
                          textAnchor="middle"
                          fontSize={7}
                          fontWeight="bold"
                          fill="#ffffff"
                          fontFamily="sans-serif"
                        >
                          !
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Terminal Blocks - Inferior */}
        {hasInferior && (() => {
          let borneX = x_rail_start + rail_width / 2 - totalBornesWidth / 2;
          let currentBorneX = borneX;

          return (
            <g key="bornes-inferiores">
              {todasLasSalidas.map((salida, idx) => {
                let seccionNum = 1;
                let salidaNum = 1;
                secciones.forEach((s, sIdx) => {
                  const oIdx = s.salidas.findIndex(o => o.id === salida.id);
                  if (oIdx !== -1) {
                    seccionNum = s.seccion.orden != null ? s.seccion.orden + 1 : sIdx + 1;
                    salidaNum = oIdx + 1;
                  }
                });
                const codeAuto = `F${seccionNum}.${salidaNum}`;
                const poles = getPolesOfFormat(salida.formato);
                const bWidth = getBorneWidthForSalida(salida);

                const groupBornes = [];
                for (let p = 0; p < poles; p++) {
                  const bx = currentBorneX;
                  currentBorneX += bWidth;

                  groupBornes.push(
                    <g key={`borne-${salida.id}-p-${p}`} transform={`translate(${bx}, ${borneraInferiorY})`}>
                      <rect x={0.5} y={0} width={bWidth - 1} height={50} fill="#ffffff" stroke="#0f172a" strokeWidth={1} rx={0.5} />
                      <circle cx={bWidth / 2} cy={8} r={1} fill="#0f172a" />
                      <circle cx={bWidth / 2} cy={42} r={1} fill="#0f172a" />
                      <rect x={1.5} y={15} width={bWidth - 3} height={20} fill="#ffffff" stroke="#0f172a" strokeWidth={0.5} rx={0.5} />
                      {p === 0 && (
                        <text
                          x={bWidth / 2}
                          y={25}
                          transform={`rotate(-90 ${bWidth / 2} 25)`}
                          fontSize={5.5}
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill="#0f172a"
                          textAnchor="middle"
                        >
                          {codeAuto}
                        </text>
                      )}
                    </g>
                  );
                }

                // Add separator if not last
                if (idx < todasLasSalidas.length - 1) {
                  const sx = currentBorneX;
                  currentBorneX += 4;
                  groupBornes.push(
                    <rect
                      key={`sep-${salida.id}`}
                      x={sx}
                      y={borneraInferiorY}
                      width={4}
                      height={50}
                      fill="#64748b"
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  );
                }

                return <g key={`group-${salida.id}`}>{groupBornes}</g>;
              })}
            </g>
          );
        })()}

        {/* Terminal Blocks - Lateral Izquierda */}
        {hasLateralIzq && (() => {
          const x_bornera_start = margin;
          const borneYStart = topCanalY + 50;

          let currentBorneY = borneYStart;

          return (
            <g key="bornes-laterales-izq">
              {todasLasSalidas.map((salida, idx) => {
                let seccionNum = 1;
                let salidaNum = 1;
                secciones.forEach((s, sIdx) => {
                  const oIdx = s.salidas.findIndex(o => o.id === salida.id);
                  if (oIdx !== -1) {
                    seccionNum = s.seccion.orden != null ? s.seccion.orden + 1 : sIdx + 1;
                    salidaNum = oIdx + 1;
                  }
                });
                const codeAuto = `F${seccionNum}.${salidaNum}`;
                const poles = getPolesOfFormat(salida.formato);
                const bWidth = getBorneWidthForSalida(salida);

                const groupBornes = [];
                for (let p = 0; p < poles; p++) {
                  const by = currentBorneY;
                  currentBorneY += bWidth;

                  groupBornes.push(
                    <g key={`borne-${salida.id}-p-${p}`} transform={`translate(${x_bornera_start}, ${by})`}>
                      <rect x={0} y={0.5} width={40} height={bWidth - 1} fill="#ffffff" stroke="#0f172a" strokeWidth={1} rx={0.5} />
                      <circle cx={6} cy={bWidth / 2} r={1} fill="#0f172a" />
                      <circle cx={34} cy={bWidth / 2} r={1} fill="#0f172a" />
                      {p === 0 && (
                        <text
                          x={20}
                          y={bWidth / 2 + 2.5}
                          fontSize={6.5}
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill="#0f172a"
                          textAnchor="middle"
                        >
                          {codeAuto}
                        </text>
                      )}
                    </g>
                  );
                }

                // Add separator if not last
                if (idx < todasLasSalidas.length - 1) {
                  const sy = currentBorneY;
                  currentBorneY += 4;
                  groupBornes.push(
                    <rect
                      key={`sep-${salida.id}`}
                      x={x_bornera_start}
                      y={sy}
                      width={40}
                      height={4}
                      fill="#64748b"
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  );
                }

                return <g key={`group-${salida.id}`}>{groupBornes}</g>;
              })}
            </g>
          );
        })()}

        {/* Terminal Blocks - Lateral Derecha */}
        {hasLateralDer && (() => {
          const x_bornera_start = cabinet_width - margin - 40;
          const borneYStart = topCanalY + 50;

          let currentBorneY = borneYStart;

          return (
            <g key="bornes-laterales-der">
              {todasLasSalidas.map((salida, idx) => {
                let seccionNum = 1;
                let salidaNum = 1;
                secciones.forEach((s, sIdx) => {
                  const oIdx = s.salidas.findIndex(o => o.id === salida.id);
                  if (oIdx !== -1) {
                    seccionNum = s.seccion.orden != null ? s.seccion.orden + 1 : sIdx + 1;
                    salidaNum = oIdx + 1;
                  }
                });
                const codeAuto = `F${seccionNum}.${salidaNum}`;
                const poles = getPolesOfFormat(salida.formato);
                const bWidth = getBorneWidthForSalida(salida);

                const groupBornes = [];
                for (let p = 0; p < poles; p++) {
                  const by = currentBorneY;
                  currentBorneY += bWidth;

                  groupBornes.push(
                    <g key={`borne-${salida.id}-p-${p}`} transform={`translate(${x_bornera_start}, ${by})`}>
                      <rect x={0} y={0.5} width={40} height={bWidth - 1} fill="#ffffff" stroke="#0f172a" strokeWidth={1} rx={0.5} />
                      <circle cx={6} cy={bWidth / 2} r={1} fill="#0f172a" />
                      <circle cx={34} cy={bWidth / 2} r={1} fill="#0f172a" />
                      {p === 0 && (
                        <text
                          x={20}
                          y={bWidth / 2 + 2.5}
                          fontSize={6.5}
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill="#0f172a"
                          textAnchor="middle"
                        >
                          {codeAuto}
                        </text>
                      )}
                    </g>
                  );
                }

                // Add separator if not last
                if (idx < todasLasSalidas.length - 1) {
                  const sy = currentBorneY;
                  currentBorneY += 4;
                  groupBornes.push(
                    <rect
                      key={`sep-${salida.id}`}
                      x={x_bornera_start}
                      y={sy}
                      width={40}
                      height={4}
                      fill="#64748b"
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  );
                }

                return <g key={`group-${salida.id}`}>{groupBornes}</g>;
              })}
            </g>
          );
        })()}
      </svg>
    );
  };

  if (modoVisual === "unifilar") {
    return renderUnifilar();
  }

  if (modoVisual === "tablero") {
    return renderTablero();
  }

  if (modoVisual === "bloques" && tabActivo === "principal") {
    const vWidth = 540;
    const vHeight = 360;
    const vX = 0;
    const vY = 0;

    const accList = Array.isArray(accesorios) ? accesorios : [];
    const motorInstalled = accList.find((a) => /motor|mando/i.test(a.descripcion || ""));
    const aperturaInstalled = accList.find((a) => /apertura/i.test(a.descripcion || ""));
    const minimaInstalled = accList.find((a) => /mínima|cero/i.test(a.descripcion || ""));
    const auxInstalled = accList.find((a) => /contacto|auxiliar/i.test(a.descripcion || ""));

    const motorSugerido = sugerencias?.motorizacion;
    const aperturaSugerido = sugerencias?.bobina_apertura;
    const minimaSugerido = sugerencias?.bobina_cero_tension;
    const auxSugerido = sugerencias?.contactos_auxiliares;

    const handleSlotClick = (installed: any, sugerido: any) => {
      if (installed) {
        if (onDesasociarAccesorio) onDesasociarAccesorio(installed.id);
      } else if (sugerido) {
        if (onAsociarAccesorio) onAsociarAccesorio(sugerido.id);
      } else {
        if (onAbrirAccesorioManual) onAbrirAccesorioManual();
      }
    };

    const numPoles = interruptorPrincipal?.polos ?? 3;
    const switchWidth = numPoles === 4 ? 168 : 126;
    const switchX = 270 - switchWidth / 2;
    const switchY = 90;

    // Spacing of terminals based on poles
    const centers: number[] = [];
    if (numPoles === 3) {
      centers.push(270 - 40, 270, 270 + 40);
    } else {
      centers.push(270 - 60, 270 - 20, 270 + 20, 270 + 60);
    }

    return (
      <svg
        role="img"
        aria-label="Disposición física del interruptor principal"
        viewBox={`${vX} ${vY} ${vWidth} ${vHeight}`}
        className="w-full h-full bg-[#1a202c] select-none rounded-xl border border-slate-700 shadow-xl transition-all duration-200"
      >
        <defs>
          <linearGradient id="metal-plate-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a5568" />
            <stop offset="50%" stopColor="#2d3748" />
            <stop offset="100%" stopColor="#1a202c" />
          </linearGradient>
          <linearGradient id="mccb-body-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#cbd5e0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="mccb-dark-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <pattern id="ribs-pattern" width="6" height="20" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="20" stroke="#1e293b" strokeWidth="2" />
            <rect x="2" y="0" width="4" height="20" fill="#64748b" opacity="0.3" />
          </pattern>
        </defs>

        {/* Gabinete Externo / Cofre */}
        <rect x={30} y={20} width={480} height={320} rx={16} fill="url(#metal-plate-grad)" stroke="#4a5568" strokeWidth={4} />
        {/* Placa de Montaje Interna */}
        <rect x={46} y={36} width={448} height={288} rx={10} fill="#f1f5f9" stroke="#cbd5e0" strokeWidth={2} />

        {/* Riel DIN o Riel de Soporte detrás del Breaker */}
        <rect x={60} y={160} width={420} height={36} fill="#cbd5e0" rx={2} stroke="#94a3b8" strokeWidth={1} />
        <line x1={60} y1={168} x2={480} y2={168} stroke="#f1f5f9" strokeWidth={1} />
        <line x1={60} y1={188} x2={480} y2={188} stroke="#f1f5f9" strokeWidth={1} />

        {/* --- CONEXIONES: Entradas (Acometida) --- */}
        {centers.map((cx, idx) => {
          const cy = switchY - 12;
          if (metodoEntrada === "barral") {
            // Thick copper busbars going straight up
            return (
              <g key={`in-barral-${idx}`}>
                <rect x={cx - 6} y={36} width={12} height={cy - 36} fill="#ea580c" stroke="#c2410c" strokeWidth={1.5} />
                <line x1={cx - 6} y1={60} x2={cx + 6} y2={60} stroke="#4a0404" strokeWidth={1.5} />
              </g>
            );
          } else {
            // Curved cables going up
            return (
              <path
                key={`in-cable-${idx}`}
                d={`M ${cx} ${cy} Q ${cx - 8} ${cy - 25} ${cx} 36`}
                fill="none"
                stroke="#334155"
                strokeWidth={5}
                strokeLinecap="round"
              />
            );
          }
        })}

        {/* --- CONEXIONES: Salidas (Distribución) --- */}
        {centers.map((cx, idx) => {
          const cy = switchY + 180 + 12;
          if (metodoSalida === "barra_cobre") {
            // Copper bars extending down
            return (
              <g key={`out-bar-${idx}`}>
                <rect x={cx - 6} y={cy} width={12} height={266 - cy} fill="#ea580c" stroke="#c2410c" strokeWidth={1.5} />
              </g>
            );
          } else {
            // Flexible cables down to distribution lines
            return (
              <path
                key={`out-cable-${idx}`}
                d={`M ${cx} ${cy} Q ${cx + 10} ${cy + 25} ${cx} 288`}
                fill="none"
                stroke="#0f172a"
                strokeWidth={5}
                strokeLinecap="round"
              />
            );
          }
        })}

        {/* Horizontal copper main busbar structure if output is copper bars */}
        {metodoSalida === "barra_cobre" && (
          <g>
            <rect x={80} y={262} width={380} height={16} fill="#ea580c" stroke="#c2410c" strokeWidth={2} rx={2} />
            <circle cx={100} cy={270} r={3} fill="#1e293b" />
            <circle cx={440} cy={270} r={3} fill="#1e293b" />
          </g>
        )}

        {/* --- CUERPO PRINCIPAL DEL MCCB (Detalle Técnico Alto) --- */}
        <g id="mccb-switch-block">
          {/* Lugs / Terminales de Cobre en los Polos - Arriba */}
          {centers.map((cx, idx) => (
            <g key={`top-lug-${idx}`}>
              <rect x={cx - 12} y={switchY - 22} width={24} height={24} rx={3} fill="#cbd5e0" stroke="#475569" strokeWidth={1.5} />
              <circle cx={cx} cy={switchY - 12} r={4.5} fill="#94a3b8" stroke="#1e293b" strokeWidth={1} />
              <circle cx={cx} cy={switchY - 12} r={1.5} fill="#1e293b" />
            </g>
          ))}

          {/* Lugs / Terminales de Cobre en los Polos - Abajo */}
          {centers.map((cx, idx) => (
            <g key={`bot-lug-${idx}`}>
              <rect x={cx - 12} y={switchY + 178} width={24} height={24} rx={3} fill="#cbd5e0" stroke="#475569" strokeWidth={1.5} />
              <circle cx={cx} cy={switchY + 188} r={4.5} fill="#94a3b8" stroke="#1e293b" strokeWidth={1} />
              <circle cx={cx} cy={switchY + 188} r={1.5} fill="#1e293b" />
            </g>
          ))}

          {/* Caja Base del Breaker */}
          <rect x={switchX} y={switchY} width={switchWidth} height={180} rx={6} fill="url(#mccb-body-grad)" stroke="#0f172a" strokeWidth={2.5} />

          {/* Zonas Acanaladas / Ribbed Sections (Patrón de rayas verticales, como la imagen) */}
          <rect x={switchX + 4} y={switchY + 8} width={switchWidth - 8} height={20} fill="url(#ribs-pattern)" stroke="#1e293b" strokeWidth={1} />
          <rect x={switchX + 4} y={switchY + 152} width={switchWidth - 8} height={20} fill="url(#ribs-pattern)" stroke="#1e293b" strokeWidth={1} />

          {/* Cubierta/Carátula Central (Faceplate gris oscuro) */}
          <rect x={switchX + 16} y={switchY + 36} width={switchWidth - 32} height={108} rx={4} fill="url(#mccb-dark-grad)" stroke="#0f172a" strokeWidth={1.5} />

          {/* Ventana de Maneta */}
          <rect x={270 - 15} y={switchY + 54} width={30} height={70} rx={3} fill="#0f172a" />
          
          {/* Líneas de colores de indicación (Rojo / Amarillo / Verde) */}
          <rect x={270 - 12} y={switchY + 56} width={24} height={8} fill="#ef4444" /> {/* Rojo arriba */}
          <line x1={270 - 18} y1={switchY + 74} x2={270 - 14} y2={switchY + 74} stroke="#eab308" strokeWidth={1.5} />
          <line x1={270 + 14} y1={switchY + 74} x2={270 + 18} y2={switchY + 74} stroke="#eab308" strokeWidth={1.5} />
          <line x1={270 - 18} y1={switchY + 98} x2={270 - 14} y2={switchY + 98} stroke="#22c55e" strokeWidth={1.5} />
          <line x1={270 + 14} y1={switchY + 98} x2={270 + 18} y2={switchY + 98} stroke="#22c55e" strokeWidth={1.5} />

          {/* Maneta del Interruptor (Toggle Switch) */}
          <rect x={270 - 10} y={switchY + 68} width={20} height={38} rx={2} fill="#f8fafc" stroke="#0f172a" strokeWidth={1.5} />
          <rect x={270 - 10} y={switchY + 68} width={20} height={16} fill="#64748b" rx={1} />
          <line x1={270 - 6} y1={switchY + 92} x2={270 + 6} y2={switchY + 92} stroke="#94a3b8" strokeWidth={2} />

          {/* Botón de Test (Push-to-trip rojo) */}
          <circle cx={switchX + 32} cy={switchY + 70} r={4.5} fill="#ef4444" stroke="#7f1d1d" strokeWidth={1} />
          <rect x={switchX + 30} y={switchY + 68} width={4} height={4} fill="#fff" opacity="0.3" />

          {/* Textos del Switch */}
          <text x={270} y={switchY + 48} fontFamily="monospace" fontSize={9} fontWeight="bold" fill="#f8fafc" textAnchor="middle">
            Q1 - {mainAmperajeText}
          </text>
          <text x={270} y={switchY + 138} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#94a3b8" textAnchor="middle">
            {mainPolosText} - {mainCodigoAcortado}
          </text>
        </g>

        {/* --- ACCESORIOS REPRESENTADOS COMO BOTONES CIRCULARES PREMIUM --- */}

        {/* 1. Mando Motorizado (Circular - Izquierda) */}
        <g
          transform="translate(100, 180)"
          className="cursor-pointer"
          onClick={() => handleSlotClick(motorInstalled, motorSugerido)}
        >
          {motorInstalled ? (
            <g>
              <circle r={28} fill="#e6fffa" stroke="#319795" strokeWidth={2.5} />
              <text y={-6} fontFamily="sans-serif" fontSize={9} fontWeight="bold" fill="#0d9488" textAnchor="middle">⚙️ MOL</text>
              <text y={8} fontFamily="monospace" fontSize={7} fill="#319795" textAnchor="middle">{motorInstalled.codigo.slice(0, 7)}…</text>
              {/* Delete badge */}
              <circle cx={20} cy={-20} r={7.5} fill="#fee2e2" stroke="#ef4444" strokeWidth={1} />
              <text cx={20} cy={-20} x={20} y={-17} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#991b1b" textAnchor="middle">×</text>
            </g>
          ) : (
            <g>
              <circle r={28} fill="#f8fafc" stroke="#cbd5e0" strokeWidth={1.5} strokeDasharray="3 3" />
              <text y={4} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#94a3b8" textAnchor="middle">+ MOTOR</text>
              {motorSugerido && (
                <circle cx={20} cy={-20} r={6} fill="#ffedd5" stroke="#f97316" strokeWidth={1.5} />
              )}
            </g>
          )}
        </g>

        {/* 2. Contactos Auxiliares (Circular - Derecha) */}
        <g
          transform="translate(440, 180)"
          className="cursor-pointer"
          onClick={() => handleSlotClick(auxInstalled, auxSugerido)}
        >
          {auxInstalled ? (
            <g>
              <circle r={28} fill="#ebf8ff" stroke="#3182ce" strokeWidth={2.5} />
              <text y={-6} fontFamily="sans-serif" fontSize={9} fontWeight="bold" fill="#2563eb" textAnchor="middle">⊸ AUX</text>
              <text y={8} fontFamily="monospace" fontSize={7} fill="#3182ce" textAnchor="middle">{auxInstalled.codigo.slice(0, 7)}…</text>
              {/* Delete badge */}
              <circle cx={20} cy={-20} r={7.5} fill="#fee2e2" stroke="#ef4444" strokeWidth={1} />
              <text cx={20} cy={-20} x={20} y={-17} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#991b1b" textAnchor="middle">×</text>
            </g>
          ) : (
            <g>
              <circle r={28} fill="#f8fafc" stroke="#cbd5e0" strokeWidth={1.5} strokeDasharray="3 3" />
              <text y={4} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#94a3b8" textAnchor="middle">+ AUX</text>
              {auxSugerido && (
                <circle cx={20} cy={-20} r={6} fill="#ffedd5" stroke="#f97316" strokeWidth={1.5} />
              )}
            </g>
          )}
        </g>

        {/* 3. Bobina de Apertura / Shunt Trip (Circular - Top Left) */}
        <g
          transform="translate(130, 75)"
          className="cursor-pointer"
          onClick={() => handleSlotClick(aperturaInstalled, aperturaSugerido)}
        >
          {aperturaInstalled ? (
            <g>
              <circle r={24} fill="#fff5f5" stroke="#ef4444" strokeWidth={2} />
              <text y={-4} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#b91c1c" textAnchor="middle">SOR</text>
              <text y={8} fontFamily="monospace" fontSize={7} fill="#ef4444" textAnchor="middle">{aperturaInstalled.codigo.slice(0, 5)}…</text>
              <circle cx={17} cy={-17} r={6.5} fill="#fee2e2" stroke="#ef4444" strokeWidth={1} />
              <text x={17} y={-14} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#991b1b" textAnchor="middle">×</text>
            </g>
          ) : (
            <g>
              <circle r={24} fill="#f8fafc" stroke="#cbd5e0" strokeWidth={1.5} strokeDasharray="3 3" />
              <text y={3} fontFamily="sans-serif" fontSize={7} fontWeight="bold" fill="#94a3b8" textAnchor="middle">+ APERT.</text>
              {aperturaSugerido && (
                <circle cx={17} cy={-17} r={5} fill="#ffedd5" stroke="#f97316" strokeWidth={1.5} />
              )}
            </g>
          )}
        </g>

        {/* 4. Bobina de Cero Tensión (Circular - Top Right) */}
        <g
          transform="translate(410, 75)"
          className="cursor-pointer"
          onClick={() => handleSlotClick(minimaInstalled, minimaSugerido)}
        >
          {minimaInstalled ? (
            <g>
              <circle r={24} fill="#fffaf0" stroke="#f97316" strokeWidth={2} />
              <text y={-4} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#c2410c" textAnchor="middle">UVR</text>
              <text y={8} fontFamily="monospace" fontSize={7} fill="#f97316" textAnchor="middle">{minimaInstalled.codigo.slice(0, 5)}…</text>
              <circle cx={17} cy={-17} r={6.5} fill="#fee2e2" stroke="#ef4444" strokeWidth={1} />
              <text x={17} y={-14} fontFamily="sans-serif" fontSize={8} fontWeight="bold" fill="#991b1b" textAnchor="middle">×</text>
            </g>
          ) : (
            <g>
              <circle r={24} fill="#f8fafc" stroke="#cbd5e0" strokeWidth={1.5} strokeDasharray="3 3" />
              <text y={3} fontFamily="sans-serif" fontSize={7} fontWeight="bold" fill="#94a3b8" textAnchor="middle">+ MÍNIMA</text>
              {minimaSugerido && (
                <circle cx={17} cy={-17} r={5} fill="#ffedd5" stroke="#f97316" strokeWidth={1.5} />
              )}
            </g>
          )}
        </g>
      </svg>
    );
  }

  return (
    <svg
      role="img"
      aria-label="Esquema visual del tablero"
      viewBox={`${vX} ${vY} ${vWidth} ${vHeight}`}
      className="w-full h-full bg-slate-50/50 select-none transition-all duration-200"
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
          <rect width={6} height={6} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={6} stroke="#b91c1c" strokeWidth={2} />
        </pattern>
      </defs>

      {/* Interruptor Principal Q1 (Estandarizado con datos reales y tooltip enriquecido) */}
      {tieneInterruptorPrincipal && (
        <g data-testid="interruptor-principal">
          <title>{mainTooltipInfo}</title>

          {/* Tarjeta del Main Breaker */}
          <rect
            x={mainBreakerX}
            y={mainBreakerY}
            width={mainBreakerWidth}
            height={ALTO_CARD}
            fill="#fff5f5"
            stroke="#b91c1c"
            strokeWidth={2}
            rx={2}
          />

          {/* Cabecera del Main Breaker */}
          <text
            x={mainBreakerX + 8}
            y={mainBreakerY + 15}
            fontFamily="sans-serif"
            fontSize={11}
            fontWeight="bold"
            fill="#b91c1c"
          >
            Q1
          </text>

          <text
            x={mainBreakerX + mainBreakerWidth - 8}
            y={mainBreakerY + 14}
            fontFamily="sans-serif"
            fontSize={9}
            fill="#b91c1c"
            fontWeight="bold"
            textAnchor="end"
          >
            {mainPolosText}
          </text>

          {/* Línea divisoria de acento rojo bajo la cabecera */}
          <line
            x1={mainBreakerX + 6}
            y1={mainBreakerY + 22}
            x2={mainBreakerX + mainBreakerWidth - 6}
            y2={mainBreakerY + 22}
            stroke="#b91c1c"
            strokeWidth={1.5}
          />

          {/* Texto principal en la tarjeta (código o nombre acortado) */}
          <text
            x={mainBreakerX + 8}
            y={mainBreakerY + 38}
            fontFamily="sans-serif"
            fontSize={10}
            fontWeight="bold"
            fill="#b91c1c"
          >
            {mainCodigoAcortado}
          </text>

          {/* Bajada vertical limpia con holgura hacia el sub-embarrado de la Fila 1 */}
          {capas.embarrado && (
            <line
              x1={anchoViewBox / 2}
              y1={mainBreakerY + ALTO_CARD + 30}
              x2={anchoViewBox / 2}
              y2={fila1SubBusbarY}
              stroke="#b91c1c"
              strokeWidth={2}
            />
          )}

          {/* Badge Pill Ampliado de Corriente del Main Breaker */}
          {capas.codigos && (
            <g>
              <line
                x1={anchoViewBox / 2}
                y1={mainBreakerY + ALTO_CARD}
                x2={anchoViewBox / 2}
                y2={mainBreakerY + ALTO_CARD + 10}
                stroke="#b91c1c"
                strokeWidth={1.5}
              />
              <rect
                x={anchoViewBox / 2 - 42}
                y={mainBreakerY + ALTO_CARD + 10}
                width={84}
                height={20}
                rx={2}
                fill="#b91c1c"
              />
              <text
                x={anchoViewBox / 2}
                y={mainBreakerY + ALTO_CARD + 23}
                fontFamily="sans-serif"
                fontSize={10.5}
                fontWeight="bold"
                fill="#ffffff"
                textAnchor="middle"
              >
                {mainAmperajeText} / {mainPolosText}
              </text>
            </g>
          )}
        </g>
      )}

      {/* Busbar / Troncal alimentador vertical lateral */}
      {capas.embarrado && (
        <g data-testid="embarrado">
          {/* Troncal alimentador vertical por el margen izquierdo (x = 12px) */}
          {numSecciones > 0 && (
            <line
              x1={12}
              y1={fila1SubBusbarY}
              x2={12}
              y2={ultimoSubBusbarY}
              stroke="#374151"
              strokeWidth={2.5}
            />
          )}
        </g>
      )}

      {/* Secciones y Salidas */}
      {secciones.map(({ seccion, salidas }, seccionIndex) => {
        const seccionNum = seccion.orden != null ? seccion.orden + 1 : seccionIndex + 1;
        const cardY = 12 + offsetPrincipal + seccionIndex * ALTO_SECCION;
        const rowBusbarY = cardY - 14;

        const anchoFila = Math.max(100, 30 + salidas.length * (ANCHO_CARD + GAP_X) - GAP_X);

        return (
          <g key={seccion.id}>
            {/* Nombre de la sección */}
            <text x={30} y={cardY - 22} fontSize={10} fontWeight="bold" fill="#6b7280" fontFamily="sans-serif">
              FILA {seccionNum} — {seccion.nombre.toUpperCase()}
            </text>

            {/* Sub-embarrado horizontal propio de esta fila */}
            {capas.embarrado && (
              <line
                x1={12}
                y1={rowBusbarY}
                x2={anchoFila}
                y2={rowBusbarY}
                stroke="#374151"
                strokeWidth={2}
              />
            )}

            {salidas.map((salida, salidaIndex) => {
              const salidaNum = salidaIndex + 1;
              const codigoAuto = `F${seccionNum}.${salidaNum}`;
              const cardX = 30 + salidaIndex * (ANCHO_CARD + GAP_X);

              const asignada = !!salida.componente_id;
              const isDirectHover = hoveredSalidaId === salida.id;
              const isAlimentadaPorHovered = !!(
                hoveredSalidaId && salida.alimentado_por_salida_id === hoveredSalidaId
              );
              const parent = salida.alimentado_por_salida_id
                ? todasLasSalidas.find((s) => s.id === salida.alimentado_por_salida_id)
                : null;
              const hasLinkError = !!(
                parent &&
                existeIncompatibilidadLink(
                  salida.formato,
                  salida.tipo_proteccion,
                  parent.formato,
                  parent.tipo_proteccion
                )
              );

              const fill = isDirectHover
                ? "#fff5f5"
                : isAlimentadaPorHovered
                ? "#eff6ff"
                : !asignada
                ? "#fffbe6"
                : "#ffffff";

              const strokeColor = isDirectHover
                ? "#b91c1c"
                : isAlimentadaPorHovered
                ? "#2563eb"
                : !asignada
                ? "#d97706"
                : "#374151";

              const strokeWidth = isDirectHover || isAlimentadaPorHovered ? 2.5 : 1.5;
              const strokeDash = undefined;

              const formatoText = FORMATO_LABEL[salida.formato] ?? "1P";
              const cargaTexto = `${salida.carga_unidad === "A" ? Math.round(Number(salida.carga_valor)) : salida.carga_valor}${salida.carga_unidad}`;
              const protecLabel = salida.tipo_proteccion === "seccional_diferencial" ? "Diff" : formatoText;

              const tagTextoCompleto = salida.etiqueta
                ? salida.etiqueta.toUpperCase()
                : (salida.componente_codigo ?? "RESERVA");

              const tagTextoAcortado = tagTextoCompleto.length > 11
                ? `${tagTextoCompleto.slice(0, 10)}…`
                : tagTextoCompleto;

              const tooltipInfo = [
                `Circuito: ${codigoAuto}${salida.etiqueta ? ` (${salida.etiqueta})` : ""}`,
                salida.alimentado_por_codigo ? `Alimentado por: ${salida.alimentado_por_codigo}` : null,
                `Carga: ${cargaTexto}`,
                `Formato: ${formatoText} (${salida.tipo_proteccion === "seccional_diferencial" ? "Diferencial" : "Termomagnético"})`,
                salida.componente_id
                  ? `Componente ABB: ${salida.componente_codigo ?? salida.componente_id}${salida.componente_descripcion ? ` - ${salida.componente_descripcion}` : ""}`
                  : `Estado: ${salida.motivo_sin_match ?? "Sin propuesta automática"}`,
              ].filter(Boolean).join("\n");

              return (
                <g
                  key={salida.id}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => onSalidaHover?.(salida.id)}
                  onMouseLeave={() => onSalidaHover?.(null)}
                  onClick={() => onSalidaClick?.(salida)}
                >
                  {/* Tooltip nativo enriquecido al pasar el ratón */}
                  <title>{tooltipInfo}</title>

                  {/* Bajada vertical corta (14px) desde el sub-embarrado de la fila hasta la tarjeta */}
                  {capas.embarrado && (
                    <line
                      x1={cardX + ANCHO_CARD / 2}
                      y1={rowBusbarY}
                      x2={cardX + ANCHO_CARD / 2}
                      y2={cardY}
                      stroke="#374151"
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Tarjeta Rectangular del Elemento */}
                  <rect
                    data-testid={`salida-${salida.id}`}
                    x={cardX}
                    y={cardY}
                    width={ANCHO_CARD}
                    height={ALTO_CARD}
                    fill={fill}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                    rx={2}
                  />

                  {/* Badge de Hijo Enlazado al Hover del Padre */}
                  {isAlimentadaPorHovered && (
                    <text
                      x={cardX + ANCHO_CARD - 8}
                      y={cardY + 15}
                      textAnchor="end"
                      fontSize={12}
                      fill="#2563eb"
                      fontFamily="sans-serif"
                    >
                      🔗
                    </text>
                  )}

                  {hasLinkError && (
                    <g
                      transform={`translate(${cardX + ANCHO_CARD}, ${cardY + ALTO_CARD / 2})`}
                      data-testid={`salida-${salida.id}-link-error`}
                      className="cursor-help"
                    >
                      <polygon
                        points="0,-10 10,8 -10,8"
                        fill="#f59e0b"
                        stroke="#d97706"
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                      />
                      <text
                        y={5}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight="bold"
                        fill="#ffffff"
                        fontFamily="sans-serif"
                      >
                        !
                      </text>
                      <title>Advertencia: Enlace de alimentación con polos incompatibles (4P vs 1P/2P/3P)</title>
                    </g>
                  )}

                  {/* Código automático prefijado (ej. F1.1) */}
                  <text
                    x={cardX + 8}
                    y={cardY + 15}
                    fontFamily="sans-serif"
                    fontSize={11}
                    fontWeight="bold"
                    fill="#111827"
                  >
                    {codigoAuto}
                  </text>

                  {/* Línea divisoria de acento rojo bajo la cabecera */}
                  <line
                    x1={cardX + 6}
                    y1={cardY + 22}
                    x2={cardX + ANCHO_CARD - 6}
                    y2={cardY + 22}
                    stroke="#b91c1c"
                    strokeWidth={1.5}
                  />

                  {/* Tag / Nombre acortado asignado por el analista */}
                  <text
                    x={cardX + 8}
                    y={cardY + 38}
                    fontFamily="sans-serif"
                    fontSize={10}
                    fontWeight={salida.etiqueta ? "bold" : "600"}
                    fill={salida.etiqueta ? "#b91c1c" : "#6b7280"}
                  >
                    {tagTextoAcortado}
                  </text>

                  {/* Bajada vertical desde la tarjeta hacia la etiqueta de amperios */}
                  <line
                    x1={cardX + ANCHO_CARD / 2}
                    y1={cardY + ALTO_CARD}
                    x2={cardX + ANCHO_CARD / 2}
                    y2={cardY + ALTO_CARD + 10}
                    stroke="#374151"
                    strokeWidth={1.5}
                  />

                  {/* Badge Pill Ampliado de Corriente / Tipo (pill inferior) */}
                  {capas.codigos && (
                    <g data-testid={`salida-${salida.id}-codigo`}>
                      <rect
                        x={cardX + ANCHO_CARD / 2 - 42}
                        y={cardY + ALTO_CARD + 10}
                        width={84}
                        height={20}
                        rx={2}
                        fill={salida.tipo_proteccion === "seccional_diferencial" ? "#b91c1c" : "#374151"}
                      />
                      <text
                        x={cardX + ANCHO_CARD / 2}
                        y={cardY + ALTO_CARD + 23}
                        fontFamily="sans-serif"
                        fontSize={10.5}
                        fontWeight="bold"
                        fill="#ffffff"
                        textAnchor="middle"
                      >
                        {cargaTexto} / {protecLabel}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
