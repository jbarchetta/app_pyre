import { useEffect, useState } from "react";
import {
  generarBomTablero,
  limpiarBomTablero,
  obtenerBomTablero,
  type BomResumenTablero,
} from "../api/client";
import { Button } from "./common/Button";

interface BomPanelProps {
  tableroId: string;
  tableroNombre: string;
  onAmpliar?: () => void;
  isCompact?: boolean;
}

export function BomPanel({ tableroId, tableroNombre, onAmpliar, isCompact = false }: BomPanelProps) {
  const [bom, setBom] = useState<BomResumenTablero | null>(null);
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const res = await obtenerBomTablero(tableroId);
        if (!unmounted) setBom(res);
      } catch (err) {
        if (!unmounted) setError(err instanceof Error ? err.message : "Error al cargar BOM");
      } finally {
        if (!unmounted) setCargando(false);
      }
    }
    cargar();
    return () => {
      unmounted = true;
    };
  }, [tableroId]);

  const handleGenerar = async () => {
    setGenerando(true);
    setError(null);
    try {
      const res = await generarBomTablero(tableroId);
      setBom(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el BOM");
    } finally {
      setGenerando(false);
    }
  };

  const handleLimpiar = async () => {
    if (!window.confirm("¿Está seguro de eliminar la lista de materiales generada?")) return;
    setCargando(true);
    try {
      await limpiarBomTablero(tableroId);
      const res = await obtenerBomTablero(tableroId);
      setBom(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar el BOM");
    } finally {
      setCargando(false);
    }
  };

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(valor);
  };

  const formatearFecha = (isoString: string | null) => {
    if (!isoString) return null;
    try {
      const fecha = new Date(isoString);
      return fecha.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 flex items-center justify-center text-abb-red shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              LISTA DE MATERIALES (BOM)
            </h3>
            <p className="text-[11px] text-slate-500 font-sans truncate max-w-[220px]">
              {tableroNombre}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onAmpliar && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAmpliar}
              title="Expandir vista completa del BOM"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Ampliar
            </Button>
          )}
          {bom && Array.isArray(bom?.lineas) && bom.lineas.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLimpiar}
              disabled={cargando || generando}
              title="Borrar cotización generada"
            >
              Limpiar
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerar}
            disabled={generando || cargando}
            isLoading={generando}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {bom && Array.isArray(bom?.lineas) && bom.lineas.length > 0 ? "Recalcular" : "Generar BOM"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Main State Handling */}
      {cargando ? (
        <div className="py-8 text-center text-xs text-slate-500">
          <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-abb-red" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Cargando BOM del tablero...
        </div>
      ) : !bom || !Array.isArray(bom?.lineas) || bom.lineas.length === 0 ? (
        <div className="py-6 border border-dashed border-slate-300 dark:border-slate-800 rounded-lg text-center p-4 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Sin lista de materiales generada
          </p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Consolida los interruptores y gabinetes del tablero congelando los precios netos de catálogo.
          </p>
          <Button variant="primary" size="sm" onClick={handleGenerar} isLoading={generando}>
            Generar BOM
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* High-Contrast Engineering Metadata Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono border border-slate-800 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                PRECIOS CONGELADOS
              </span>
              {bom.fecha_congelamiento && (
                <span className="text-slate-300 text-[10px]">
                  {formatearFecha(bom.fecha_congelamiento)}
                </span>
              )}
            </div>
            <div className="text-slate-300 text-[10px]">
              Ítems: <strong className="text-white font-bold">{bom.total_items_count}</strong>
            </div>
          </div>

          {/* High-Contrast Engineering Table */}
          <div className="overflow-x-auto border border-slate-300 dark:border-slate-800 rounded-lg shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-100 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                  <th className="py-2 px-3 font-semibold">Código SAP</th>
                  <th className="py-2 px-3 font-semibold">Desig. Comercial</th>
                  {!isCompact && <th className="py-2 px-3 font-semibold">Descripción</th>}
                  {!isCompact && <th className="py-2 px-3 font-semibold">Categoría</th>}
                  <th className="py-2 px-2 text-center font-semibold">Cant.</th>
                  {!isCompact && <th className="py-2 px-3 text-right font-semibold">Precio Unit.</th>}
                  <th className="py-2 px-3 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {bom.lineas.map((linea, idx) => (
                  <tr
                    key={linea.id}
                    className={`transition-colors ${
                      idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-850"
                    } hover:bg-red-50/40 dark:hover:bg-slate-800`}
                  >
                    <td className="py-2 px-3 font-mono font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                      {linea.componente_codigo}
                    </td>
                    <td className="py-2 px-3 font-sans font-bold text-slate-900 dark:text-white text-xs">
                      {linea.componente_codigo_comercial ? (
                        <span>
                          <span className="text-abb-red font-extrabold mr-1">ABB</span>
                          {linea.componente_codigo_comercial}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    {!isCompact && (
                      <td className="py-2 px-3 text-slate-800 dark:text-slate-200 max-w-xs truncate text-[11px]" title={linea.componente_descripcion}>
                        {linea.componente_descripcion}
                      </td>
                    )}
                    {!isCompact && (
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[10px]">
                        {linea.componente_categoria || "General"}
                      </td>
                    )}
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {linea.cantidad}
                    </td>
                    {!isCompact && (
                      <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                        {formatearMoneda(linea.precio_unitario_congelado)}
                      </td>
                    )}
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                      {formatearMoneda(linea.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Clean Executive Total Card */}
          <div className="flex justify-end pt-1">
            <div className="bg-slate-900 text-white p-3 rounded-lg flex items-center justify-between gap-4 w-full sm:w-auto border border-slate-800 shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Costo Total Materiales
              </span>
              <span className="text-xl font-mono font-extrabold text-abb-red">
                {formatearMoneda(bom.costo_total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
