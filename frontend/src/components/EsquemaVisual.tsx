import { useId } from "react";
import type { Salida, Seccion } from "../api/client";

const ANCHO_CARD = 114;
const ALTO_CARD = 48;
const GAP_X = 14;

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

const CAPAS_POR_DEFECTO: Capas = { codigos: true, embarrado: true };

interface EsquemaVisualProps {
  tieneInterruptorPrincipal: boolean;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  zoom?: number;
  capas?: Capas;
  hoveredSalidaId?: string | null;
  onSalidaHover?: (salidaId: string | null) => void;
  onSalidaClick?: (salida: Salida) => void;
}

export function EsquemaVisual({
  tieneInterruptorPrincipal,
  secciones,
  zoom = 1,
  capas = CAPAS_POR_DEFECTO,
  hoveredSalidaId,
  onSalidaHover,
  onSalidaClick,
}: EsquemaVisualProps) {
  const patternId = useId();

  // Calcular el número máximo de salidas para definir el ancho del viewBox
  const maxSalidas = Math.max(1, ...secciones.map((s) => s.salidas.length));
  const anchoViewBox = Math.max(520, 40 + maxSalidas * (ANCHO_CARD + GAP_X));

  const offsetEmbarrado = capas.embarrado ? 45 : 10;
  const ALTO_SECCION = 115;
  const altoBase = 65 + offsetEmbarrado + Math.max(1, secciones.length) * ALTO_SECCION;

  const anchoRenderizado = anchoViewBox * zoom;
  const altoRenderizado = altoBase * zoom;

  const mainBreakerX = anchoViewBox / 2 - 75;
  const mainBreakerY = 12;
  const busbarY = 12 + offsetEmbarrado;

  return (
    <svg
      role="img"
      aria-label="Esquema visual del tablero"
      width={anchoRenderizado}
      height={altoRenderizado}
      viewBox={`0 0 ${anchoViewBox} ${altoBase}`}
      className="bg-white rounded border border-gray-200 select-none shadow-inner"
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
          <rect width={6} height={6} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={6} stroke="#b91c1c" strokeWidth={2} />
        </pattern>
      </defs>

      {/* Interruptor Principal Q1 (Top Center) */}
      {tieneInterruptorPrincipal && (
        <g data-testid="interruptor-principal">
          <rect
            x={mainBreakerX}
            y={mainBreakerY}
            width={150}
            height={32}
            fill="#ffffff"
            stroke="#b91c1c"
            strokeWidth={2}
            rx={3}
          />
          <text
            x={anchoViewBox / 2}
            y={mainBreakerY + 20}
            fill="#b91c1c"
            fontSize={10}
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            MAIN BREAKER Q1
          </text>
          {/* Línea vertical desde el Principal hacia el embarrado */}
          {capas.embarrado && (
            <line
              x1={anchoViewBox / 2}
              y1={mainBreakerY + 32}
              x2={anchoViewBox / 2}
              y2={busbarY}
              stroke="#374151"
              strokeWidth={2}
            />
          )}
        </g>
      )}

      {/* Busbar / Embarrado General */}
      {capas.embarrado && (
        <g data-testid="embarrado">
          {/* Línea horizontal principal del embarrado */}
          <line
            x1={20}
            y1={busbarY}
            x2={anchoViewBox - 20}
            y2={busbarY}
            stroke="#374151"
            strokeWidth={2.5}
          />
          {/* Etiqueta del embarrado */}
          <text x={24} y={busbarY - 6} fontSize={9} fontWeight="bold" fill="#4b5563" fontFamily="sans-serif">
            L1, L2, L3 + N + PE
          </text>
        </g>
      )}

      {/* Secciones y Salidas */}
      {secciones.map(({ seccion, salidas }, seccionIndex) => {
        const seccionNum = seccion.orden != null ? seccion.orden + 1 : seccionIndex + 1;
        const seccionY = busbarY + 20 + seccionIndex * ALTO_SECCION;

        return (
          <g key={seccion.id}>
            {/* Nombre de la sección */}
            <text x={20} y={seccionY - 6} fontSize={10} fontWeight="bold" fill="#6b7280" fontFamily="sans-serif">
              FILA {seccionNum} — {seccion.nombre.toUpperCase()}
            </text>

            {salidas.map((salida, salidaIndex) => {
              const salidaNum = salidaIndex + 1;
              const codigoAuto = `F${seccionNum}.${salidaNum}`;
              const cardX = 20 + salidaIndex * (ANCHO_CARD + GAP_X);
              const cardY = seccionY;

              const asignada = !!salida.componente_id;
              const isHovered = hoveredSalidaId === salida.id;

              const fill = isHovered
                ? "#fff5f5"
                : !asignada
                ? "#fffbe6"
                : "#ffffff";

              const strokeColor = isHovered
                ? "#b91c1c"
                : !asignada
                ? "#d97706"
                : "#374151";

              const strokeWidth = isHovered ? 2.5 : 1.5;

              const formatoText = FORMATO_LABEL[salida.formato] ?? "1P";
              const cargaTexto = `${salida.carga_unidad === "A" ? Math.round(Number(salida.carga_valor)) : salida.carga_valor}${salida.carga_unidad}`;
              const protecLabel = salida.tipo_proteccion === "seccional_diferencial" ? "Diff" : formatoText;

              return (
                <g
                  key={salida.id}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => onSalidaHover?.(salida.id)}
                  onMouseLeave={() => onSalidaHover?.(null)}
                  onClick={() => onSalidaClick?.(salida)}
                >
                  {/* Bajada vertical desde la línea del embarrado hasta la tarjeta del elemento */}
                  {capas.embarrado && (
                    <line
                      x1={cardX + ANCHO_CARD / 2}
                      y1={busbarY}
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
                    strokeDasharray={asignada ? undefined : "3,2"}
                    rx={2}
                  />

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

                  {/* Formato de Polos (ej. 3P, 1P) */}
                  <text
                    x={cardX + ANCHO_CARD - 8}
                    y={cardY + 14}
                    fontFamily="sans-serif"
                    fontSize={9}
                    fill="#6b7280"
                    textAnchor="end"
                  >
                    {formatoText}
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

                  {/* Tag / Nombre asignado por el analista */}
                  <text
                    x={cardX + 8}
                    y={cardY + 38}
                    fontFamily="sans-serif"
                    fontSize={10}
                    fontWeight={salida.etiqueta ? "bold" : "600"}
                    fill={salida.etiqueta ? "#b91c1c" : "#6b7280"}
                  >
                    {salida.etiqueta ? salida.etiqueta.toUpperCase() : (salida.componente_codigo ?? "SIN MATCH")}
                  </text>

                  {/* Bajada vertical desde la tarjeta hacia la etiqueta de amperios */}
                  <line
                    x1={cardX + ANCHO_CARD / 2}
                    y1={cardY + ALTO_CARD}
                    x2={cardX + ANCHO_CARD / 2}
                    y2={cardY + ALTO_CARD + 14}
                    stroke="#374151"
                    strokeWidth={1.5}
                  />

                  {/* Badge de Amperios / Tipo (pill inferior) */}
                  {capas.codigos && (
                    <g data-testid={`salida-${salida.id}-codigo`}>
                      <rect
                        x={cardX + ANCHO_CARD / 2 - 34}
                        y={cardY + ALTO_CARD + 10}
                        width={68}
                        height={16}
                        rx={2}
                        fill={salida.tipo_proteccion === "seccional_diferencial" ? "#b91c1c" : "#374151"}
                      />
                      <text
                        x={cardX + ANCHO_CARD / 2}
                        y={cardY + ALTO_CARD + 21}
                        fontFamily="sans-serif"
                        fontSize={9}
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
