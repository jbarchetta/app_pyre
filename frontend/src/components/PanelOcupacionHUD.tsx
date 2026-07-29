import type { Salida, Seccion } from "../api/client";
import { calcularCapacidadPolosFila, obtenerPolosSalida } from "../cad/generators/boardCadGenerator";

export interface PanelOcupacionHUDProps {
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  gabineteAnchoMm?: number | null;
  visible?: boolean;
  theme?: "light" | "dark";
}

export function PanelOcupacionHUD({
  secciones,
  gabineteAnchoMm,
  visible = true,
  theme = "dark",
}: PanelOcupacionHUDProps) {
  if (!visible || !secciones || secciones.length === 0) return null;

  const capacidadFila = calcularCapacidadPolosFila(gabineteAnchoMm);
  const isLight = theme === "light";

  return (
    <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none">
      {/* Panel HUD Ultra-Compacto con Soporte de Tema Dark/Light */}
      <div
        className={`w-44 rounded-card p-2.5 shadow-card backdrop-blur-md space-y-1.5 border pointer-events-auto transition-colors duration-200 ${
          isLight
            ? "bg-surface/95 border-line text-ink shadow-slate-200/80"
            : "bg-surface-inverse/95 border-line-inverse text-ink-inverse shadow-black/50"
        }`}
      >
        <div className={`border-b pb-1 flex items-center justify-between ${isLight ? "border-line" : "border-line-inverse"}`}>
          <span className={`font-mono text-[10px] font-bold tracking-wider uppercase ${isLight ? "text-ink-muted" : "text-sky-400"}`}>
            Ocupación
          </span>
          <span className={`text-[10px] dato-tecnico font-semibold ${isLight ? "text-ink-subtle" : "text-ink-inverse-muted"}`}>
            Máx: {capacidadFila} P/Fila
          </span>
        </div>

        <div className="space-y-1">
          {secciones.map((group, idx) => {
            const polosUsados = group.salidas.reduce((sum, s) => sum + obtenerPolosSalida(s), 0);
            const porcentaje = Math.min(100, Math.round((polosUsados / capacidadFila) * 100));

            let colorBadge = isLight
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
            let barColor = "bg-emerald-500";

            if (porcentaje >= 90) {
              colorBadge = isLight
                ? "bg-red-50 text-abb-red border-red-200"
                : "bg-rose-500/20 text-rose-300 border-rose-500/40";
              barColor = isLight ? "bg-abb-red" : "bg-rose-500";
            } else if (porcentaje >= 75) {
              colorBadge = isLight
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40";
              barColor = "bg-amber-500";
            }

            return (
              <div
                key={group.seccion.id}
                className={`rounded px-2 py-1 flex flex-col gap-0.5 border ${
                  isLight
                    ? "bg-slate-50/80 border-slate-100"
                    : "bg-slate-800/60 border-slate-700/50"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                    Fila {idx + 1}
                  </span>
                  <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                    {polosUsados}/{capacidadFila}
                  </span>
                  <span className={`text-[10px] font-bold px-1 py-0.2 rounded border ${colorBadge}`}>
                    {porcentaje}%
                  </span>
                </div>

                {/* Barra visual de progreso */}
                <div className={`w-full rounded-full h-1 overflow-hidden mt-0.5 ${isLight ? "bg-slate-200" : "bg-slate-700/50"}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
