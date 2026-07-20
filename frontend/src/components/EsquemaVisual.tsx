import { useId } from "react";
import type { Salida, Seccion } from "../api/client";

const ANCHO_POR_POLO = 28;
const ALTO = 30;
const ANCHO_BASE = 520;
const ALTO_EMBARRADO = 35;

const POLOS_POR_FORMATO: Record<Salida["formato"], number> = {
  unipolar: 1,
  bipolar: 2,
  tripolar: 3,
  tetrapolar: 4,
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
  const offsetEmbarrado = capas.embarrado ? ALTO_EMBARRADO : 0;
  const altoBase = 60 + offsetEmbarrado + secciones.length * (ALTO + 32) + 20;
  const anchoRenderizado = ANCHO_BASE * zoom;
  const altoRenderizado = altoBase * zoom;

  return (
    <svg
      role="img"
      aria-label="Esquema visual del tablero"
      width={anchoRenderizado}
      height={altoRenderizado}
      viewBox={`0 0 ${ANCHO_BASE} ${altoBase}`}
      className="bg-white rounded border border-gray-200 select-none shadow-inner"
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
          <rect width={4} height={4} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={4} stroke="#1a1c1c" strokeWidth={2} />
        </pattern>
      </defs>

      {/* Busbar / Embarrado */}
      {capas.embarrado && (
        <g data-testid="embarrado">
          <rect
            x={10}
            y={8}
            width={ANCHO_BASE - 20}
            height={22}
            fill="#f3f4f6"
            stroke="#4b5563"
            strokeDasharray="4,2"
            rx={3}
          />
          <text x={20} y={23} fontSize={9} fontWeight="bold" fill="#374151" fontFamily="sans-serif">
            BUSBAR GENERAL (R-S-T-N)
          </text>
        </g>
      )}

      {/* Interruptor Principal */}
      {tieneInterruptorPrincipal && (
        <g data-testid="interruptor-principal">
          <rect
            x={20}
            y={10 + offsetEmbarrado}
            width={120}
            height={ALTO}
            fill="#e31f26"
            rx={2}
          />
          <text
            x={80}
            y={10 + offsetEmbarrado + 18}
            fill="#ffffff"
            fontSize={9}
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            PRINCIPAL
          </text>
        </g>
      )}

      {/* Secciones y Salidas */}
      {secciones.map(({ seccion, salidas }, seccionIndex) => {
        const y = 60 + offsetEmbarrado + seccionIndex * (ALTO + 32);
        let x = 20;

        return (
          <g key={seccion.id}>
            {/* Título de la sección */}
            <text x={10} y={y - 8} fontSize={10} fontWeight="bold" fill="#6b7280" fontFamily="sans-serif">
              {seccion.nombre.toUpperCase()}
            </text>

            {salidas.map((salida) => {
              const ancho = ANCHO_POR_POLO * POLOS_POR_FORMATO[salida.formato];
              const rectX = x;
              x += ancho + 6;

              const asignada = !!salida.componente_id;
              const isHovered = hoveredSalidaId === salida.id;

              const fill = !asignada
                ? "#fffbe6"
                : salida.tipo_proteccion === "seccional_diferencial"
                ? `url(#${patternId})`
                : "#1f2937";

              const strokeColor = isHovered
                ? "#e31f26"
                : !asignada
                ? "#f59e0b"
                : "#111827";

              const strokeWidth = isHovered ? 3 : 1;

              return (
                <g
                  key={salida.id}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => onSalidaHover?.(salida.id)}
                  onMouseLeave={() => onSalidaHover?.(null)}
                  onClick={() => onSalidaClick?.(salida)}
                >
                  {/* Bloque del Breaker */}
                  <rect
                    data-testid={`salida-${salida.id}`}
                    x={rectX}
                    y={y}
                    width={ancho}
                    height={ALTO}
                    fill={fill}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={asignada ? undefined : "3,2"}
                    rx={2}
                  />

                  {/* Tag/Etiqueta arriba del breaker */}
                  {salida.etiqueta && (
                    <text
                      x={rectX + ancho / 2}
                      y={y - 3}
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={8}
                      fontWeight="bold"
                      fill="#e31f26"
                      textAnchor="middle"
                    >
                      {salida.etiqueta}
                    </text>
                  )}

                  {/* Texto de Carga/Polos */}
                  {capas.codigos && (
                    <text
                      data-testid={`salida-${salida.id}-codigo`}
                      x={rectX + ancho / 2}
                      y={y + ALTO + 12}
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={8}
                      fontWeight={isHovered ? "bold" : "normal"}
                      fill={isHovered ? "#e31f26" : "#374151"}
                      textAnchor="middle"
                    >
                      {salida.carga_unidad === "A" ? Math.round(Number(salida.carga_valor)) : salida.carga_valor}
                      {salida.carga_unidad}
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
}
