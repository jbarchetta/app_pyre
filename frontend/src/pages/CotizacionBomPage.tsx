import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  listarProyectos,
  listarTableros,
  obtenerBomProyecto,
  type BomResumenProyecto,
  type Proyecto,
  type Tablero,
} from "../api/client";
import { BomPanel } from "../components/BomPanel";

export function CotizacionBomPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [tableros, setTableros] = useState<Tablero[]>([]);
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState<string>("");
  const [tableroSeleccionadoId, setTableroSeleccionadoId] = useState<string>("todos");
  const [bomProyecto, setBomProyecto] = useState<BomResumenProyecto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de proyectos
  useEffect(() => {
    async function cargar() {
      try {
        const lista = await listarProyectos();
        setProyectos(lista);
        const urlProyectoId = searchParams.get("proyecto");
        if (urlProyectoId && lista.some((p) => p.id === urlProyectoId)) {
          setProyectoSeleccionadoId(urlProyectoId);
        } else if (lista.length > 0) {
          setProyectoSeleccionadoId(lista[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar lista de proyectos");
      }
    }
    cargar();
  }, [searchParams]);

  // Cargar tableros del proyecto seleccionado
  const cargarTablerosYBom = useCallback(async () => {
    if (!proyectoSeleccionadoId) return;
    setCargando(true);
    setError(null);
    try {
      const listTableros = await listarTableros(proyectoSeleccionadoId);
      setTableros(listTableros);
      const resBom = await obtenerBomProyecto(proyectoSeleccionadoId);
      setBomProyecto(resBom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la cotización del proyecto");
    } finally {
      setCargando(false);
    }
  }, [proyectoSeleccionadoId]);

  useEffect(() => {
    cargarTablerosYBom();
  }, [cargarTablerosYBom]);

  const handleCambiarProyecto = (pId: string) => {
    setProyectoSeleccionadoId(pId);
    setTableroSeleccionadoId("todos");
    setSearchParams({ proyecto: pId });
  };

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(valor);
  };

  const proyectoActual = proyectos.find((p) => p.id === proyectoSeleccionadoId);

  return (
    <div className="space-y-6">
      {/* Cabecera Unificada Ejecutiva de Cotización */}
      <div className="bg-surface border border-line p-4 rounded-card shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-brand uppercase tracking-wider mb-0.5">
            <svg className="w-3.5 h-3.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            MÓDULO DE COTIZACIÓN Y MATERIALES (BOM)
          </div>
          <h1 className="text-lg font-bold text-ink tracking-tight">
            {proyectoActual ? proyectoActual.nombre : "Cotización de Proyecto"}
          </h1>
          {proyectoActual && (
            <p className="text-xs text-ink-muted mt-0.5">
              Cliente: <strong className="text-ink">{proyectoActual.cliente}</strong> · Tableros: <strong className="text-ink">{tableros.length}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seleccionador de Proyecto */}
          <div>
            <label htmlFor="select-proyecto-bom" className="block text-[10px] font-mono uppercase font-bold text-slate-400 mb-1">
              Proyecto
            </label>
            <select
              id="select-proyecto-bom"
              value={proyectoSeleccionadoId}
              onChange={(e) => handleCambiarProyecto(e.target.value)}
              className="border border-[#2E3B4E] bg-[#242E3E] px-3 py-1.5 text-xs font-bold text-slate-100 rounded-xl focus:ring-1 focus:ring-abb-red"
            >
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.cliente})
                </option>
              ))}
            </select>
          </div>

          {/* Seleccionador de Tablero */}
          <div>
            <label htmlFor="select-tablero-bom" className="block text-[10px] font-mono uppercase font-bold text-slate-400 mb-1">
              Tablero
            </label>
            <select
              id="select-tablero-bom"
              value={tableroSeleccionadoId}
              onChange={(e) => setTableroSeleccionadoId(e.target.value)}
              className="border border-[#2E3B4E] bg-[#242E3E] px-3 py-1.5 text-xs font-bold text-slate-100 rounded-xl focus:ring-1 focus:ring-abb-red"
            >
              <option value="todos">Todos los Tableros (Consolidado)</option>
              {tableros.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Total Acumulado */}
          <div className="bg-[#242E3E] px-4 py-2 rounded-xl border border-[#2E3B4E] text-right shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">
              Presupuesto Total
            </span>
            <span className="text-xl font-mono font-extrabold text-abb-red">
              {formatearMoneda(bomProyecto?.costo_total_proyecto || 0)}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="py-16 text-center text-sm text-slate-500">
          <svg className="animate-spin h-7 w-7 mx-auto mb-3 text-abb-red" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Cargando cotización del proyecto...
        </div>
      ) : !proyectoActual ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No hay proyectos creados. Crea un proyecto en el menú **Proyectos** para empezar a cotizar.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Render BOM Tables */}
          {tableroSeleccionadoId === "todos" ? (
            <div className="space-y-6">
              {tableros.map((t) => (
                <BomPanel key={t.id} tableroId={t.id} tableroNombre={t.nombre} isCompact={false} />
              ))}
            </div>
          ) : (
            <div>
              {tableros.find((t) => t.id === tableroSeleccionadoId) && (
                <BomPanel
                  tableroId={tableroSeleccionadoId}
                  tableroNombre={tableros.find((t) => t.id === tableroSeleccionadoId)!.nombre}
                  isCompact={false}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
