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
}

export function BomPanel({ tableroId, tableroNombre }: BomPanelProps) {
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
    <div className="bg-surface border border-surface-stroke rounded-lg p-5 shadow-sm space-y-5">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-surface-stroke pb-4 gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg
              className="w-5 h-5 text-abb-red"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Lista de Materiales y Costeo (BOM) — {tableroNombre}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Consolida los interruptores principales, salidas, accesorios y gabinetes congelando precios netos de catálogo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bom && bom.lineas.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLimpiar}
              disabled={cargando || generando}
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
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {bom && bom.lineas.length > 0 ? "Recalcular con Precios Vigentes" : "Generar Lista de Materiales"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
          {error}
        </div>
      )}

      {/* Main Content */}
      {cargando ? (
        <div className="py-12 text-center text-sm text-gray-500">
          <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-abb-red" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Cargando BOM del tablero...
        </div>
      ) : !bom || bom.lineas.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-center p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            BOM no generado
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Aún no se ha generado la Lista de Materiales para este tablero. Haz clic en **Generar Lista de Materiales** para recopilar los componentes asignados y congelar sus precios netos de catálogo.
          </p>
          <Button variant="primary" size="sm" onClick={handleGenerar} isLoading={generando}>
            Generar Lista de Materiales
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Metadata Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/60 rounded-md text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● Precios Congelados
              </span>
              {bom.fecha_congelamiento && (
                <span className="text-gray-600 dark:text-gray-300">
                  Emitido el: <strong>{formatearFecha(bom.fecha_congelamiento)}</strong>
                </span>
              )}
            </div>
            <div className="text-gray-600 dark:text-gray-300 font-mono">
              Total de ítems: <strong>{bom.total_items_count}</strong>
            </div>
          </div>

          {/* BOM Table */}
          <div className="overflow-x-auto border border-gray-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Código SAP / ABB</th>
                  <th className="py-2.5 px-3">Desig. Comercial</th>
                  <th className="py-2.5 px-3">Descripción</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-center">Cant.</th>
                  <th className="py-2.5 px-3 text-right">Precio Net. Cong.</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {bom.lineas.map((linea) => (
                  <tr
                    key={linea.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-gray-700 dark:text-gray-300">
                      {linea.componente_codigo}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-gray-900 dark:text-white">
                      {linea.componente_codigo_comercial ? (
                        <span>
                          <span className="text-abb-red font-bold mr-1">ABB</span>
                          {linea.componente_codigo_comercial}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 max-w-xs truncate" title={linea.componente_descripcion}>
                      {linea.componente_descripcion}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-[11px]">
                      {linea.componente_categoria || "General"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-gray-900 dark:text-white">
                      {linea.cantidad}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatearMoneda(linea.precio_unitario_congelado)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {formatearMoneda(linea.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Total Card */}
          <div className="flex justify-end pt-2">
            <div className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 p-4 rounded-lg flex items-center gap-6 min-w-[280px]">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                  Costo Total Materiales
                </p>
                <p className="text-2xl font-bold font-mono text-abb-red">
                  {formatearMoneda(bom.costo_total)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
