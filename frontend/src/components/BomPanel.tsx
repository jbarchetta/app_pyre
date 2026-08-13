import { useEffect, useState } from "react";
import {
  generarBomTablero,
  limpiarBomTablero,
  obtenerBomTablero,
  type BomResumenTablero,
} from "../api/client";
import { Button } from "./common/Button";
import { ConfirmDialog } from "./ConfirmDialog";

interface BomPanelProps {
  tableroId: string;
  tableroNombre: string;
  onAmpliar?: () => void;
  isCompact?: boolean;
}

type TabCategoriaBOM = "todos" | "abb" | "nollmann" | "cables" | "terminales";

export function BomPanel({ tableroId, tableroNombre, onAmpliar, isCompact = false }: BomPanelProps) {
  const [bom, setBom] = useState<BomResumenTablero | null>(null);
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabCatActiva, setTabCatActiva] = useState<TabCategoriaBOM>("todos");
  const [modalLimpiarConfirm, setModalLimpiarConfirm] = useState(false);

  const cargarBom = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await obtenerBomTablero(tableroId);
      setBom(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la lista de materiales");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (tableroId) {
      cargarBom();
    }
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

  const handleConfirmarLimpiar = async () => {
    setModalLimpiarConfirm(false);
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

  const lineasFiltradas = (bom?.lineas ?? []).filter((linea) => {
    if (tabCatActiva === "todos") return true;

    const catLow = (linea.componente_categoria || "").toLowerCase();
    const descLow = (linea.componente_descripcion || "").toLowerCase();
    const marcaLow = (linea.componente_marca || "").toLowerCase();

    if (tabCatActiva === "abb") {
      return (
        marcaLow === "abb" ||
        catLow.includes("termomagn") ||
        catLow.includes("diferencial") ||
        catLow.includes("interruptor") ||
        catLow.includes("accesorios") ||
        descLow.includes("abb")
      );
    }
    if (tabCatActiva === "nollmann") {
      return (
        marcaLow.includes("noll") ||
        catLow.includes("gabinete") ||
        descLow.includes("noll") ||
        descLow.includes("nis") ||
        descLow.includes("gabinete")
      );
    }
    if (tabCatActiva === "cables") {
      return (
        catLow.includes("cable") ||
        catLow.includes("conductor") ||
        catLow.includes("distribuidor") ||
        catLow.includes("canal") ||
        descLow.includes("cable") ||
        descLow.includes("distribuidor")
      );
    }
    if (tabCatActiva === "terminales") {
      return (
        catLow.includes("bornera") ||
        catLow.includes("terminal") ||
        catLow.includes("riel") ||
        descLow.includes("bornera") ||
        descLow.includes("terminal") ||
        descLow.includes("riel")
      );
    }
    return true;
  });

  const subtotalFiltrado = lineasFiltradas.reduce((acc, item) => {
    const val = Number(item.subtotal);
    const p = Number(item.precio_unitario_congelado);
    const sub = !isNaN(val) ? val : !isNaN(p) ? p * item.cantidad : 0;
    return acc + sub;
  }, 0);

  return (
    <div className="bg-surface border border-line rounded-card shadow-sm overflow-hidden space-y-0">
      {/* Top Header matching reference image tag bar style */}
      <div className="bg-surface-inverse px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-ink-inverse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-control bg-brand flex items-center justify-center text-white shrink-0 shadow-xs font-bold dato-tecnico text-xs">
            ABB
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 text-ink-inverse">
              LISTA DE MATERIALES · {tableroNombre}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] dato-tecnico">
              <span className="px-2 py-0.5 rounded-control bg-surface-inverse-raised text-ink-inverse-muted border border-line-inverse">
                PROYECTO PYRE
              </span>
              <span className="px-2 py-0.5 rounded-control bg-brand-tint text-brand border border-brand-line font-bold">
                IEC 61439-1
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onAmpliar && (
            <Button
              variant="secondary"
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
              onClick={() => setModalLimpiarConfirm(true)}
              disabled={cargando || generando}
              className="text-rose-400 hover:text-white hover:bg-rose-900/40 border border-rose-800/40"
              title="Limpiar y recálculo del BOM"
            >
              Limpiar BOM
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
          <div className="p-3 bg-danger-tint border border-danger-line text-danger text-xs rounded-card font-medium">
            {error}
          </div>
        )}

        {/* State Handling */}
        {cargando ? (
          <div className="py-12 text-center text-xs text-ink-muted dato-tecnico">
            <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-brand" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Cargando BOM del tablero...
          </div>
        ) : !bom || !Array.isArray(bom?.lineas) || bom.lineas.length === 0 ? (
          <div className="py-8 border-2 border-dashed border-line rounded-card text-center p-6 space-y-3 bg-surface-sunken">
            <p className="text-sm font-bold text-ink">
              Sin lista de materiales generada
            </p>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              Consolida los interruptores y gabinetes del tablero congelando los precios netos de catálogo.
            </p>
            <Button variant="primary" size="sm" onClick={handleGenerar} isLoading={generando}>
              Generar BOM
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Control Segmentado de Pestañas Categorizadas Normalizado */}
            <div className="flex flex-wrap items-center gap-1 bg-surface-sunken p-1.5 rounded-card border border-line text-xs font-sans select-none">
              <button
                type="button"
                onClick={() => setTabCatActiva("todos")}
                className={`px-3 py-1.5 rounded-control transition-all ${
                  tabCatActiva === "todos"
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "text-ink-muted hover:text-ink hover:bg-surface font-medium"
                }`}
              >
                Total Unificado ({bom.lineas.length})
              </button>
              <button
                type="button"
                onClick={() => setTabCatActiva("abb")}
                className={`px-3 py-1.5 rounded-control transition-all ${
                  tabCatActiva === "abb"
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "text-ink-muted hover:text-ink hover:bg-surface font-medium"
                }`}
              >
                Componentes ABB
              </button>
              <button
                type="button"
                onClick={() => setTabCatActiva("nollmann")}
                className={`px-3 py-1.5 rounded-control transition-all ${
                  tabCatActiva === "nollmann"
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "text-ink-muted hover:text-ink hover:bg-surface font-medium"
                }`}
              >
                Gabinetes y Distribuidores (Nollmann / Nöllmed)
              </button>
              <button
                type="button"
                onClick={() => setTabCatActiva("cables")}
                className={`px-3 py-1.5 rounded-control transition-all ${
                  tabCatActiva === "cables"
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "text-ink-muted hover:text-ink hover:bg-surface font-medium"
                }`}
              >
                Cables y Conectores
              </button>
              <button
                type="button"
                onClick={() => setTabCatActiva("terminales")}
                className={`px-3 py-1.5 rounded-control transition-all ${
                  tabCatActiva === "terminales"
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "text-ink-muted hover:text-ink hover:bg-surface font-medium"
                }`}
              >
                Terminales y Accesorios
              </button>
            </div>

            {/* High-Contrast Grid Table with Left Vertical Color Bars */}
            <div className="overflow-x-auto border border-line rounded-card shadow-xs bg-surface">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-inverse text-ink-inverse font-mono text-[11px] uppercase tracking-wider border-b border-line-inverse">
                    <th className="py-2.5 px-2 text-center font-bold w-10">ID</th>
                    <th className="py-2.5 px-3 font-bold">Código SAP</th>
                    <th className="py-2.5 px-3 font-bold">Desig. Comercial</th>
                    {!isCompact && <th className="py-2.5 px-3 font-bold">Descripción</th>}
                    {!isCompact && <th className="py-2.5 px-3 font-bold">Categoría</th>}
                    <th className="py-2.5 px-2 text-center font-bold">Cant.</th>
                    {!isCompact && <th className="py-2.5 px-3 text-right font-bold">Precio Unit.</th>}
                    <th className="py-2.5 px-3 text-right font-bold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {lineasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={isCompact ? 5 : 8} className="p-6 text-center text-xs text-ink-muted italic">
                        No hay ítems en esta categoría.
                      </td>
                    </tr>
                  ) : (
                    lineasFiltradas.map((linea, idx) => {
                      // Left color bar category determination
                      const isBreaker =
                        linea.componente_marca === "ABB" ||
                        linea.componente_categoria?.toLowerCase().includes("termomagn") ||
                        linea.componente_categoria?.toLowerCase().includes("diferencial");
                      const isEnclosure =
                        linea.componente_marca === "Nollmann" ||
                        linea.componente_categoria?.toLowerCase().includes("gabinete");
                      const borderClass = isBreaker
                        ? "border-l-4 border-l-brand"
                        : isEnclosure
                        ? "border-l-4 border-l-info"
                        : "border-l-4 border-l-warning";

                      const esGabineteNollmann =
                        linea.componente_marca === "Nollmann" ||
                        linea.componente_categoria?.toLowerCase().includes("gabinete") ||
                        linea.componente_descripcion?.toLowerCase().includes("noll");

                      return (
                        <tr
                          key={linea.id}
                          className={`transition-colors ${borderClass} ${
                            idx % 2 === 0 ? "bg-surface" : "bg-surface-sunken/40"
                          } hover:bg-brand-tint/50`}
                        >
                          <td className="py-2.5 px-2 text-center dato-tecnico font-bold text-ink-muted text-[11px]">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 px-3 dato-tecnico font-bold text-ink text-[11px]">
                            {linea.componente_codigo}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-bold text-ink text-xs">
                            {linea.componente_codigo_comercial ? (
                              <span>
                                {esGabineteNollmann ? (
                                  <span className="text-info font-extrabold mr-1">Nollmann</span>
                                ) : linea.componente_marca === "ABB" || !linea.componente_marca ? (
                                  <span className="text-brand font-extrabold mr-1">ABB</span>
                                ) : (
                                  <span className="text-ink font-extrabold mr-1">{linea.componente_marca}</span>
                                )}
                                {linea.componente_codigo_comercial}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          {!isCompact && (
                            <td className="py-2.5 px-3 text-ink max-w-xs truncate text-[11px]" title={linea.componente_descripcion}>
                              {linea.componente_descripcion}
                            </td>
                          )}
                          {!isCompact && (
                            <td className="py-2.5 px-3 text-ink-muted text-[11px] font-medium">
                              <span className="px-2 py-0.5 rounded-control bg-surface-sunken border border-line text-ink-muted text-[10px]">
                                {linea.componente_categoria || "General"}
                              </span>
                            </td>
                          )}
                          <td className="py-2.5 px-2 text-center dato-tecnico font-bold text-ink text-xs">
                            {linea.cantidad}
                          </td>
                          {!isCompact && (
                            <td className="py-2.5 px-3 text-right dato-tecnico text-ink-muted text-[11px]">
                              {formatearMoneda(linea.precio_unitario_congelado)}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right dato-tecnico font-extrabold text-ink text-xs">
                            {formatearMoneda(linea.subtotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Financial Summary Card */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
              <div className="text-xs dato-tecnico text-ink-muted">
                Mostrando <strong className="text-ink">{lineasFiltradas.length}</strong> de <strong className="text-ink">{bom.lineas.length}</strong> ítems
              </div>
              <div className="bg-surface-inverse text-ink-inverse p-4 rounded-card flex items-center justify-between gap-6 w-full sm:w-auto border border-line-inverse shadow-card">
                <span className="text-xs font-mono uppercase tracking-wider text-ink-inverse-muted font-bold">
                  {tabCatActiva === "todos" ? "Total General Tablero" : `Subtotal (${lineasFiltradas.length} ítems)`}
                </span>
                <span className="text-2xl dato-tecnico font-extrabold text-brand">
                  {formatearMoneda(tabCatActiva === "todos" ? bom.costo_total : subtotalFiltrado)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {modalLimpiarConfirm && (
        <ConfirmDialog
          titulo="Limpiar Lista de Materiales (BOM)"
          mensaje={`¿Estás seguro de que deseas vaciar y recargar la lista de materiales generada para el tablero "${tableroNombre}"?`}
          textoConfirmar="Limpiar BOM"
          confirmando={cargando}
          onConfirm={handleConfirmarLimpiar}
          onCancel={() => setModalLimpiarConfirm(false)}
        />
      )}
    </div>
  );
}
