import { useState, useRef, useMemo, useEffect } from "react";
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Square3Stack3DIcon,
  XMarkIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { CadViewerCanvas } from "./CadViewerCanvas";
import { EsquemaVisual } from "./EsquemaVisual";
import type { Salida, Seccion } from "../api/client";
import type { Capas, InterruptorPrincipalInfo } from "./EsquemaVisual";

interface EsquemaVisualCanvasProps {
  tieneInterruptorPrincipal: boolean;
  interruptorPrincipal?: InterruptorPrincipalInfo | null;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  capas?: Capas;
  onCapasChange?: (capas: Capas) => void;
  hoveredSalidaId?: string | null;
  onSalidaHover?: (salidaId: string | null) => void;
  onSalidaClick?: (salida: Salida) => void;
  tabActivo?: string;
  accesorios?: any[];
  sugerencias?: any;
  onAsociarAccesorio?: (componenteId: string) => void;
  onDesasociarAccesorio?: (componenteId: string) => void;
  onAbrirAccesorioManual?: () => void;
  metodoEntrada?: string | null;
  metodoSalida?: string | null;
  bornerasTipo?: string | null;
  cablecanalSugerido?: string | null;
  gabineteSugeridoAncho?: number | null;
  gabineteSugeridoAlto?: number | null;
  tableroId?: string;
  modoVisual?: "bloques" | "topografico" | "unifilar";
  panelLateralColapsado?: boolean;
  onTogglePanelLateral?: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_PASO = 0.25;

function limitar(valor: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(valor.toFixed(2))));
}

export function EsquemaVisualCanvas({
  tieneInterruptorPrincipal,
  interruptorPrincipal,
  secciones,
  zoom = 1,
  onZoomChange,
  capas = { codigos: true, embarrado: true },
  onCapasChange,
  hoveredSalidaId,
  onSalidaHover,
  onSalidaClick,
  gabineteSugeridoAncho,
  gabineteSugeridoAlto,
  modoVisual: modoVisualProp = "bloques",
  panelLateralColapsado,
  onTogglePanelLateral,
}: EsquemaVisualCanvasProps) {
  const [modoVisualState, setModoVisualState] = useState<"bloques" | "topografico" | "unifilar">(modoVisualProp);
  const [panelCapasAbierto, setPanelCapasAbierto] = useState(false);
  const [modalAmpliado, setModalAmpliado] = useState(false);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const svgAreaRef = useRef<HTMLDivElement>(null);
  const modalAreaRef = useRef<HTMLDivElement>(null);

  const handleZoomChange = (nuevoZoom: number) => {
    const z = limitar(nuevoZoom);
    if (onZoomChange) onZoomChange(z);
  };

  const handleCapasChange = (nuevasCapas: Capas) => {
    if (onCapasChange) onCapasChange(nuevasCapas);
  };

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  // Event listener nativo no-pasivo para rueda en área SVG Bloques (evita scroll de página)
  useEffect(() => {
    const containerEl = svgAreaRef.current;
    if (!containerEl) return;

    const onWheelNative = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const we = e as WheelEvent;
      const delta = we.deltaY < 0 ? ZOOM_PASO : -ZOOM_PASO;
      const z = limitar(zoomRef.current + delta);
      if (onZoomChangeRef.current) onZoomChangeRef.current(z);
    };

    containerEl.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      containerEl.removeEventListener("wheel", onWheelNative);
    };
  }, []);

  // Event listener nativo no-pasivo para rueda en modal de pantalla completa SVG Bloques
  useEffect(() => {
    const modalEl = modalAreaRef.current;
    if (!modalEl || !modalAmpliado) return;

    const onWheelNative = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const we = e as WheelEvent;
      const delta = we.deltaY < 0 ? ZOOM_PASO : -ZOOM_PASO;
      const z = limitar(zoomRef.current + delta);
      if (onZoomChangeRef.current) onZoomChangeRef.current(z);
    };

    modalEl.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      modalEl.removeEventListener("wheel", onWheelNative);
    };
  }, [modalAmpliado]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = (e.clientX - dragStartRef.current.x) / zoom;
    const dy = (e.clientY - dragStartRef.current.y) / zoom;
    setPanX(dragStartRef.current.panX - dx);
    setPanY(dragStartRef.current.panY - dy);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const resetPanAndZoom = () => {
    handleZoomChange(1);
    setPanX(0);
    setPanY(0);
  };

  // Información de la Salida hovered para sincronización con la tabla
  const hoveredSalidaInfo = useMemo(() => {
    if (!hoveredSalidaId) return null;
    if (hoveredSalidaId === "main-breaker") {
      return {
        tag: "MAIN BREAKER",
        titulo: interruptorPrincipal?.descripcion || "Interruptor Principal Cabecera",
        codigo: interruptorPrincipal?.codigo_comercial || interruptorPrincipal?.codigo || "-",
        corriente: interruptorPrincipal?.corriente_nominal_a ? `${interruptorPrincipal.corriente_nominal_a}A` : "-",
        polos: interruptorPrincipal?.polos ? `${interruptorPrincipal.polos}P` : "-",
        seccion: "Entrada Principal",
        cable: "-",
      };
    }
    for (const sec of secciones) {
      const found = sec.salidas.find((sal) => sal.id === hoveredSalidaId);
      if (found) {
        return {
          tag: found.posicion_codigo || `Salida ${(found.orden ?? found.posicion_orden ?? 0) + 1}`,
          titulo: found.componente_descripcion || found.descripcion_personalizada || "Interruptor de Salida",
          codigo: found.componente_codigo_comercial || found.componente_id || "Sin catálogo",
          corriente: `${found.corriente_nominal_a || 0}A`,
          polos: found.formato || "-",
          curva: found.curva || "C",
          seccion: sec.seccion.nombre,
          cable: found.seccion_cable_mm2 ? `${found.seccion_cable_mm2} mm²` : "-",
        };
      }
    }
    return null;
  }, [hoveredSalidaId, secciones, interruptorPrincipal]);

  // Controles superiores de vista (Zoom, Capas, Pantalla completa)
  const renderControlesSVG = (esModal: boolean) => (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Alejar"
        onClick={() => handleZoomChange(zoom - ZOOM_PASO)}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition"
        title="Alejar (-)"
      >
        <MagnifyingGlassMinusIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="Ajustar zoom"
        title="Restablecer vista a 100%"
        className="border border-gray-300 px-2 py-0.5 font-mono text-xs rounded hover:bg-gray-200 transition font-bold"
        onClick={resetPanAndZoom}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Acercar"
        onClick={() => handleZoomChange(zoom + ZOOM_PASO)}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition"
        title="Acercar (+)"
      >
        <MagnifyingGlassPlusIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="Capas"
        onClick={() => setPanelCapasAbierto((abierto) => !abierto)}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition"
        title="Capas del esquema"
      >
        <Square3Stack3DIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label={esModal ? "Salir de pantalla completa" : "Pantalla completa"}
        onClick={() => setModalAmpliado(!esModal)}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition ml-1"
        title={esModal ? "Salir de pantalla completa (Esc)" : "Ampliar a pantalla completa"}
      >
        {esModal ? (
          <ArrowsPointingInIcon className="w-4 h-4" />
        ) : (
          <ArrowsPointingOutIcon className="w-4 h-4" />
        )}
      </button>
    </div>
  );

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Pestañas de Selector de Modo Visual */}
      <div className="flex items-center justify-between bg-industrial-gray border border-surface-stroke rounded-xl px-4 py-2 shadow-sm">
        <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setModoVisualState("bloques")}
            className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-colors ${
              modoVisualState === "bloques"
                ? "bg-abb-red text-white text-abb-red shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Bloques
          </button>
          <button
            type="button"
            onClick={() => setModoVisualState("topografico")}
            className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-colors ${
              modoVisualState === "topografico"
                ? "bg-abb-red text-white text-abb-red shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Topográfico
          </button>
          <button
            type="button"
            onClick={() => setModoVisualState("unifilar")}
            className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-colors ${
              modoVisualState === "unifilar"
                ? "bg-abb-red text-white text-abb-red shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Unifilar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] font-mono text-gray-500 hidden sm:block">
            {modoVisualState === "bloques"
              ? "Esquema Vectorial SVG - Modo Bloques"
              : `Motor CAD DXF - Modo ${modoVisualState === "topografico" ? "Topográfico 2D" : "Esquema Unifilar"}`}
          </div>

          {panelLateralColapsado && onTogglePanelLateral && (
            <button
              type="button"
              onClick={onTogglePanelLateral}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-sm transition ml-2"
              title="Expandir tarjetas laterales"
            >
              <ArrowsPointingOutIcon className="w-4 h-4 text-abb-red" />
              <span className="hidden md:inline">EXPANDIR TARJETAS</span>
            </button>
          )}
        </div>
      </div>

      {/* RENDER SEGÚN EL MODO SELECCIONADO */}
      {modoVisualState === "bloques" ? (
        /* VISTA ORIGINAL DE BLOQUES (BLUEPRINT SVG) SIN MANDOS DE DISEÑO CAD */
        <>
          <div className="border border-surface-stroke bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            {/* Cabecera del Blueprint Bloques */}
            <div className="flex items-center justify-between border-b border-surface-stroke bg-industrial-gray px-4 py-2.5 min-h-[42px]">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <CpuChipIcon className="w-4 h-4 text-abb-red" />
                Blueprint Bloques (Esquema SVG)
              </span>
              {renderControlesSVG(false)}
            </div>

            {/* Panel desplegable de capas */}
            {panelCapasAbierto && (
              <div className="flex gap-4 border-b border-surface-stroke px-4 py-2.5 bg-gray-50 text-xs font-medium">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capas.codigos}
                    onChange={(e) => handleCapasChange({ ...capas, codigos: e.target.checked })}
                    className="accent-abb-red"
                  />
                  Amperios / Etiquetas
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capas.embarrado}
                    onChange={(e) => handleCapasChange({ ...capas, embarrado: e.target.checked })}
                    className="accent-abb-red"
                  />
                  Embarrado General
                </label>
              </div>
            )}

            {/* Área del Blueprint con Pan y Zoom */}
            <div
              ref={svgAreaRef}
              style={{ overscrollBehavior: "contain", touchAction: "none" }}
              className={`flex min-h-[380px] max-h-[70vh] justify-center overflow-hidden bg-slate-50/50 ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              title="Mantené presionado el ratón para desplazar (Pan) o usá la rueda para hacer Zoom"
            >
              <EsquemaVisual
                tieneInterruptorPrincipal={tieneInterruptorPrincipal}
                interruptorPrincipal={interruptorPrincipal}
                secciones={secciones}
                zoom={zoom}
                panX={panX}
                panY={panY}
                capas={capas}
                hoveredSalidaId={hoveredSalidaId}
                onSalidaHover={onSalidaHover}
                onSalidaClick={onSalidaClick}
              />
            </div>
          </div>

          {/* Modal Ampliado Pantalla Completa para SVG Bloques */}
          {modalAmpliado && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="w-full h-full max-w-7xl max-h-[94vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-300 relative">
                <div className="flex items-center justify-between bg-industrial-gray px-4 py-3 border-b border-surface-stroke">
                  <span className="font-mono text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <CpuChipIcon className="w-5 h-5 text-abb-red" />
                    Blueprint Bloques (Pantalla Completa)
                  </span>
                  <div className="flex items-center gap-2">
                    {renderControlesSVG(true)}
                    <button
                      type="button"
                      aria-label="Cerrar modal de pantalla completa"
                      onClick={() => setModalAmpliado(false)}
                      className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition ml-2"
                      title="Cerrar (Esc)"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div
                  ref={modalAreaRef}
                  style={{ overscrollBehavior: "contain", touchAction: "none" }}
                  className={`flex-1 w-full h-full bg-slate-50/90 p-6 overflow-hidden flex items-center justify-center relative ${
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <EsquemaVisual
                    tieneInterruptorPrincipal={tieneInterruptorPrincipal}
                    interruptorPrincipal={interruptorPrincipal}
                    secciones={secciones}
                    zoom={zoom}
                    panX={panX}
                    panY={panY}
                    capas={capas}
                    hoveredSalidaId={hoveredSalidaId}
                    onSalidaHover={onSalidaHover}
                    onSalidaClick={(salida) => {
                      if (onSalidaClick) onSalidaClick(salida);
                      setModalAmpliado(false);
                    }}
                  />

                  {/* BARRA / BANNER DE SINCRONIZACIÓN DE TABLA EN HOVER (HUD CAD TÉCNICO) */}
                  {hoveredSalidaInfo ? (
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 text-slate-100 border border-emerald-500/50 shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-xl rounded-lg px-4 py-2.5 flex items-center space-x-4 max-w-4xl animate-fade-in text-xs font-mono select-none pointer-events-none">
                      <div className="flex items-center space-x-2 shrink-0 border-r border-slate-800 pr-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-600/50 font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
                          {hoveredSalidaInfo.tag}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 truncate max-w-xs">{hoveredSalidaInfo.titulo}</span>
                        <span className="text-[10px] text-slate-400">
                          FILA: <strong className="text-slate-200">{hoveredSalidaInfo.seccion}</strong> | CÓD: <strong className="text-amber-400">{hoveredSalidaInfo.codigo}</strong>
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 border-l border-slate-800 pl-3 shrink-0">
                        <div className="text-center px-1">
                          <span className="block text-[9px] text-slate-400 font-sans tracking-wider uppercase">Calibre</span>
                          <span className="font-bold text-emerald-400">{hoveredSalidaInfo.corriente}</span>
                        </div>
                        <div className="text-center px-1 border-l border-slate-800/60">
                          <span className="block text-[9px] text-slate-400 font-sans tracking-wider uppercase">Polos</span>
                          <span className="font-bold text-sky-400">{hoveredSalidaInfo.polos}</span>
                        </div>
                        <div className="text-center px-1 border-l border-slate-800/60">
                          <span className="block text-[9px] text-slate-400 font-sans tracking-wider uppercase">Cable</span>
                          <span className="font-bold text-purple-300">{hoveredSalidaInfo.cable}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 bg-slate-950/85 text-slate-400 border border-slate-800 shadow-xl backdrop-blur-md rounded-full px-5 py-1.5 text-xs font-mono text-center select-none pointer-events-none">
                      [CAD INSPECT] Pasa el cursor sobre cualquier línea o elemento para ver detalles técnicos
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* VISOR CAD DXF PARA TOPOGRÁFICO Y UNIFILAR CON MANDOS DE DISEÑO COMPLETOS */
        <CadViewerCanvas
          tieneInterruptorPrincipal={tieneInterruptorPrincipal}
          interruptorPrincipal={interruptorPrincipal}
          secciones={secciones}
          zoom={zoom}
          onZoomChange={onZoomChange}
          capas={capas}
          onCapasChange={onCapasChange}
          hoveredSalidaId={hoveredSalidaId}
          onSalidaHover={onSalidaHover}
          onSalidaClick={onSalidaClick}
          gabineteSugeridoAncho={gabineteSugeridoAncho}
          gabineteSugeridoAlto={gabineteSugeridoAlto}
          modoVisual={modoVisualState}
          onModoVisualChange={setModoVisualState}
        />
      )}
    </div>
  );
}
