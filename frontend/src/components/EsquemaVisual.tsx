import { useId } from "react";
import type { Salida, Seccion } from "../api/client";

const ANCHO_POR_POLO = 24;
const ALTO = 24;
const ANCHO_BASE = 480;
const ALTO_EMBARRADO = 30;

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
}

export function EsquemaVisual({
  tieneInterruptorPrincipal,
  secciones,
  zoom = 1,
  capas = CAPAS_POR_DEFECTO,
}: EsquemaVisualProps) {
  const patternId = useId();
  const offsetEmbarrado = capas.embarrado ? ALTO_EMBARRADO : 0;
  const altoBase = 50 + offsetEmbarrado + secciones.length * (ALTO + 20) + 20;
  const anchoRenderizado = ANCHO_BASE * zoom;
  const altoRenderizado = altoBase * zoom;

  return (
    <svg
      role="img"
      aria-label="Esquema visual del tablero"
      width={anchoRenderizado}
      height={altoRenderizado}
      viewBox={`0 0 ${ANCHO_BASE} ${altoBase}`}
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
          <rect width={4} height={4} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={4} stroke="#1a1c1c" strokeWidth={2} />
        </pattern>
      </defs>
      {capas.embarrado && (
        <rect
          data-testid="embarrado"
          x={10}
          y={5}
          width={ANCHO_BASE - 20}
          height={20}
          fill="none"
          stroke="#1a1c1c"
          strokeDasharray="4,2"
        />
      )}
      {tieneInterruptorPrincipal && (
        <rect
          data-testid="interruptor-principal"
          x={20}
          y={10 + offsetEmbarrado}
          width={120}
          height={ALTO}
          fill="#e31f26"
        />
      )}
      {secciones.map(({ seccion, salidas }, seccionIndex) => {
        const y = 50 + offsetEmbarrado + seccionIndex * (ALTO + 20);
        let x = 20;
        return (
          <g key={seccion.id}>
            {salidas.map((salida) => {
              const ancho = ANCHO_POR_POLO * POLOS_POR_FORMATO[salida.formato];
              const rectX = x;
              x += ancho + 4;
              const asignada = !!salida.componente_id;
              const fill = !asignada
                ? "none"
                : salida.tipo_proteccion === "seccional_diferencial"
                  ? `url(#${patternId})`
                  : "#1a1c1c";
              return (
                <g key={salida.id}>
                  <rect
                    data-testid={`salida-${salida.id}`}
                    x={rectX}
                    y={y}
                    width={ancho}
                    height={ALTO}
                    fill={fill}
                    stroke="#1a1c1c"
                    strokeDasharray={asignada ? undefined : "2,2"}
                  />
                  {capas.codigos && asignada && (
                    <text
                      data-testid={`salida-${salida.id}-codigo`}
                      x={rectX + ancho / 2}
                      y={y + ALTO + 10}
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={8}
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
