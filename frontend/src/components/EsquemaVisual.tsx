import type { Salida, Seccion } from "../api/client";

const ANCHO_POR_POLO = 24;
const ALTO = 24;

const POLOS_POR_FORMATO: Record<Salida["formato"], number> = {
  unipolar: 1,
  bipolar: 2,
  tetrapolar: 4,
};

const COLOR_POR_TIPO: Record<Salida["tipo_proteccion"], string> = {
  seccional_termomagnetico: "#4a90d9",
  seccional_diferencial: "#d94a6a",
};

interface EsquemaVisualProps {
  tieneInterruptorPrincipal: boolean;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
}

export function EsquemaVisual({ tieneInterruptorPrincipal, secciones }: EsquemaVisualProps) {
  const alturaTotal = 50 + secciones.length * (ALTO + 20) + 20;

  return (
    <svg role="img" aria-label="Esquema visual del tablero" width={480} height={alturaTotal}>
      {tieneInterruptorPrincipal && (
        <rect data-testid="interruptor-principal" x={20} y={10} width={120} height={ALTO} fill="#e0a030" />
      )}
      {secciones.map(({ seccion, salidas }, seccionIndex) => {
        const y = 50 + seccionIndex * (ALTO + 20);
        let x = 20;
        return (
          <g key={seccion.id}>
            {salidas.map((salida) => {
              const ancho = ANCHO_POR_POLO * POLOS_POR_FORMATO[salida.formato];
              const rectX = x;
              x += ancho + 4;
              return (
                <rect
                  key={salida.id}
                  data-testid={`salida-${salida.id}`}
                  x={rectX}
                  y={y}
                  width={ancho}
                  height={ALTO}
                  fill={salida.componente_id ? COLOR_POR_TIPO[salida.tipo_proteccion] : "none"}
                  stroke={salida.componente_id ? "none" : "#888"}
                  strokeDasharray={salida.componente_id ? undefined : "2,2"}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
