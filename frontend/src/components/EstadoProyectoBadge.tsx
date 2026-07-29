import { Badge, type BadgeTone } from "./common";

/**
 * Badge de estado de proyecto.
 *
 * Estaba duplicado en tres lugares con criterios distintos: las tarjetas de
 * ProyectosPage usaban `bg-green-100/text-green-800`, su tabla usaba
 * `bg-emerald-50` con borde, y el Dashboard tenía su propia cadena de
 * ternarios. El mismo estado se veía de tres formas segun donde lo miraras.
 */
const ESTADOS: Record<string, { label: string; tone: BadgeTone }> = {
  en_curso: { label: "En curso", tone: "info" },
  finalizado: { label: "Finalizado", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export function EstadoProyectoBadge({ estado }: { estado: string }) {
  // Si el backend agrega un estado nuevo, se muestra crudo en tono neutro en
  // vez de desaparecer.
  const { label, tone } = ESTADOS[estado] ?? { label: estado, tone: "neutral" as const };
  return <Badge tone={tone}>{label}</Badge>;
}
