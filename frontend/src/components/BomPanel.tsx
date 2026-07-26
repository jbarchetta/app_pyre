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
    <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden space-y-0">
      {/* Top Header matching reference image tag bar style */}
      <div className="bg-[#2C3645] px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-abb-red flex items-center justify-center text-white shrink-0 shadow-sm font-bold font-mono text-xs">
            ABB
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 text-slate-100">
              LISTA DE MATERIALES · {tableroNombre}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 border border-slate-600">
                PROYECTO PYRE
              </span>
              <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                IEC 61439-1
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* State Handling */}
        {cargando ? (
          <div className="py-12 text-center text-xs text-slate-500 font-mono">
            <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-abb-red" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Cargando BOM del tablero...
          </div>
        ) : !bom || !Array.isArray(bom?.lineas) || bom.lineas.length === 0 ? (
          <div className="py-8 border-2 border-dashed border-slate-300 rounded-xl text-center p-6 space-y-3 bg-slate-50">
            <p className="text-sm font-bold text-slate-800">
              Sin lista de materiales generada
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Consolida los interruptores y gabinetes del tablero congelando los precios netos de catálogo.
            </p>
            <Button variant="primary" size="sm" onClick={handleGenerar} isLoading={generando}>
              Generar BOM
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tag Pills bar matching reference image */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono font-bold text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  PRECIOS CONGELADOS
                </span>
                {bom.fecha_congelamiento && (
                  <span className="text-slate-300 text-[11px]">
                    Emisión: {formatearFecha(bom.fecha_congelamiento)}
                  </span>
                )}
              </div>
              <div className="text-slate-300 text-xs">
                Total ítems: <strong className="text-white font-mono font-bold">{bom.total_items_count}</strong>
              </div>
            </div>

            {/* High-Contrast Grid Table with Left Vertical Color Bars */}
            <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#2C3645] text-slate-100 font-mono text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <th className="py-2.5 px-3 font-bold">Código SAP</th>
                    <th className="py-2.5 px-3 font-bold">Desig. Comercial</th>
                    {!isCompact && <th className="py-2.5 px-3 font-bold">Descripción</th>}
                    {!isCompact && <th className="py-2.5 px-3 font-bold">Categoría</th>}
                    <th className="py-2.5 px-2 text-center font-bold">Cant.</th>
                    {!isCompact && <th className="py-2.5 px-3 text-right font-bold">Precio Unit.</th>}
                    <th className="py-2.5 px-3 text-right font-bold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {bom.lineas.map((linea, idx) => {
                    // Left color bar category determination
                    const isBreaker = linea.componente_categoria?.toLowerCase().includes("termomagn") || linea.componente_categoria?.toLowerCase().includes("diferencial");
                    const isEnclosure = linea.componente_categoria?.toLowerCase().includes("gabinete");
                    const borderClass = isBreaker ? "border-l-4 border-l-abb-red" : isEnclosure ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-amber-500";

                    return (
                      <tr
                        key={linea.id}
                        className={`transition-colors ${borderClass} ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                        } hover:bg-red-50/50`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-[11px]">
                          {linea.componente_codigo}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 text-xs">
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
                          <td className="py-2.5 px-3 text-slate-800 max-w-xs truncate text-[11px]" title={linea.componente_descripcion}>
                            {linea.componente_descripcion}
                          </td>
                        )}
                        {!isCompact && (
                          <td className="py-2.5 px-3 text-slate-600 text-[11px] font-medium">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px]">
                              {linea.componente_categoria || "General"}
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900 text-xs">
                          {linea.cantidad}
                        </td>
                        {!isCompact && (
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 text-[11px]">
                            {formatearMoneda(linea.precio_unitario_congelado)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 text-xs">
                          {formatearMoneda(linea.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Financial Summary Card */}
            <div className="flex justify-end pt-2">
              <div className="bg-[#2C3645] text-white p-4 rounded-xl flex items-center justify-between gap-6 w-full sm:w-auto border border-slate-800 shadow-md">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
                  Total General Tablero
                </span>
                <span className="text-2xl font-mono font-extrabold text-abb-red">
                  {formatearMoneda(bom.costo_total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
