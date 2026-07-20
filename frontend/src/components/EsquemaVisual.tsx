import { useId } from "react";
import type { Salida, Seccion } from "../api/client";

const ANCHO_CARD = 114;
const ALTO_CARD = 48;
const GAP_X = 14;
const ALTO_SECCION = 130;

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
  panX?: number;
  panY?: number;
  capas?: Capas;
  hoveredSalidaId?: string | null;
  onSalidaHover?: (salidaId: string | null) => void;
  onSalidaClick?: (salida: Salida) => void;
}

export function EsquemaVisual({
  tieneInterruptorPrincipal,
  secciones,
  zoom = 1,
  panX = 0,
  panY = 0,
  capas = CAPAS_POR_DEFECTO,
  hoveredSalidaId,
  onSalidaHover,
  onSalidaClick,
}: EsquemaVisualProps) {
  const patternId = useId();

  // Calcular el número máximo de salidas para definir el ancho del viewBox
  const maxSalidas = Math.max(1, ...secciones.map((s) => s.salidas.length));
  const anchoViewBox = Math.max(540, 60 + maxSalidas * (ANCHO_CARD + GAP_X));

  const offsetPrincipal = tieneInterruptorPrincipal ? 95 : 20;
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
  const fila1SubBusbarY = fila1CardY - 14;

  const ultimaSeccionY = 12 + offsetPrincipal + (numSecciones - 1) * ALTO_SECCION;
  const ultimoSubBusbarY = ultimaSeccionY - 14;

  return (
    <svg
      role="img"
      aria-label="Esquema visual del tablero"
      viewBox={`${vX} ${vY} ${vWidth} ${vHeight}`}
      className="w-full max-w-full h-auto min-h-[320px] max-h-[65vh] bg-white rounded-lg border border-gray-200 select-none shadow-sm transition-all duration-200"
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
          <rect width={6} height={6} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={6} stroke="#b91c1c" strokeWidth={2} />
        </pattern>
      </defs>

      {/* Interruptor Principal Estandarizado (Top Center con Tono Rojo Especial) */}
      {tieneInterruptorPrincipal && (
        <g data-testid="interruptor-principal">
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
            3P
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

          {/* Texto principal en la tarjeta */}
          <text
            x={mainBreakerX + 8}
            y={mainBreakerY + 38}
            fontFamily="sans-serif"
            fontSize={10}
            fontWeight="bold"
            fill="#b91c1c"
          >
            MAIN BREAKER
          </text>

          {/* Bajada vertical limpia directamente hacia el sub-embarrado de la Fila 1 */}
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
                MAIN / 3P
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
