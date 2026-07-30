import { useState, useRef, useMemo, useEffect } from "react";
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsPointingOutIcon,
  Square3Stack3DIcon,
  XMarkIcon,
  CpuChipIcon,
  LockClosedIcon,
  LockOpenIcon,
} from "@heroicons/react/24/outline";
import { CadViewerCanvas } from "./CadViewerCanvas";
import { EsquemaVisual } from "./EsquemaVisual";
import type { Salida, Seccion } from "../api/client";
import type { Capas, InterruptorPrincipalInfo } from "./EsquemaVisual";

import type { ModoVisual, ModoVisualState } from "../utils/vistaStorage";
import { Button } from "./common/Button";

interface EsquemaVisualCanvasProps {
  tieneInterruptorPrincipal: boolean;
  interruptorPrincipal?: InterruptorPrincipalInfo | null;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  obtenerVistaModo?: (modo: ModoVisual) => ModoVisualState;
  onModoStateChange?: (modo: ModoVisual, cambios: Partial<ModoVisualState>) => void;
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
  pasoMm?: number | null;
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
  obtenerVistaModo,
  onModoStateChange,
  zoom: zoomProp = 1,
  onZoomChange,
  capas: capasProp = { codigos: true, embarrado: true },
  onCapasChange,
  hoveredSalidaId,
  onSalidaHover,
  onSalidaClick,
  gabineteSugeridoAncho,
  gabineteSugeridoAlto,
  pasoMm,
  modoVisual: modoVisualProp = "bloques",
  panelLateralColapsado,
  onTogglePanelLateral,
  tabActivo,
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

  const estadoBloquesActual = obtenerVistaModo ? obtenerVistaModo("bloques") : null;
  const zoomEfectivo = estadoBloquesActual ? estadoBloquesActual.zoom : zoomProp;
  const capasEfectivas = estadoBloquesActual ? estadoBloquesActual.capas : capasProp;

  const handleZoomChange = (nuevoZoom: number) => {
    const z = limitar(nuevoZoom);
    if (onModoStateChange) {
      onModoStateChange("bloques", { zoom: z });
    }
    if (onZoomChange) onZoomChange(z);
  };

  const handleCapasChange = (nuevasCapas: Capas) => {
    if (onModoStateChange) {
      onModoStateChange("bloques", { capas: nuevasCapas });
    }
    if (onCapasChange) onCapasChange(nuevasCapas);
  };

  // Estado del Candado para Zoom por Rueda (Por defecto BLOQUEADO = false para no interceptar el scroll de la página)
  const [zoomDesbloqueado, setZoomDesbloqueado] = useState(false);
  const zoomDesbloqueadoRef = useRef(zoomDesbloqueado);
  zoomDesbloqueadoRef.current = zoomDesbloqueado;

  const lockInactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const reiniciarInactivityLockTimer = () => {
    if (lockInactivityTimerRef.current) {
      clearTimeout(lockInactivityTimerRef.current);
    }
    lockInactivityTimerRef.current = setTimeout(() => {
      setZoomDesbloqueado(false);
    }, 8000);
  };

  // Bloqueo automático del candado al cambiar de pestaña o de modo visual
  useEffect(() => {
    setZoomDesbloqueado(false);
  }, [tabActivo, modoVisualState]);

  const zoomRef = useRef(zoomEfectivo);
  zoomRef.current = zoomEfectivo;

  const handleZoomChangeRef = useRef(handleZoomChange);
  handleZoomChangeRef.current = handleZoomChange;

  // Event listener nativo no-pasivo para rueda en área SVG Bloques (solo intercepta si el candado está abierto)
  useEffect(() => {
    const containerEl = svgAreaRef.current;
    if (!containerEl) return;

    const onWheelNative = (e: Event) => {
      const we = e as WheelEvent;
      // Si el candado está cerrado (false), desviamos la rueda para hacer SCROLL a la página principal (<main> o window)
      if (!zoomDesbloqueadoRef.current) {
        let scrollAmount = we.deltaY;
        if (we.deltaMode === 1) {
          scrollAmount *= 33; // Convertir muescas de rueda Windows (líneas) a píxeles
        } else if (we.deltaMode === 2) {
          scrollAmount *= window.innerHeight;
        }

        const mainEl = document.querySelector('main');
        let scrolled = false;
        if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
          const prev = mainEl.scrollTop;
          mainEl.scrollTop += scrollAmount;
          if (mainEl.scrollTop !== prev) {
            scrolled = true;
          }
        }
        if (!scrolled) {
          window.scrollBy({ top: scrollAmount });
        }
        e.preventDefault();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const delta = we.deltaY < 0 ? ZOOM_PASO : -ZOOM_PASO;
      const z = limitar(zoomRef.current + delta);
      if (handleZoomChangeRef.current) handleZoomChangeRef.current(z);
      reiniciarInactivityLockTimer();
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
      const we = e as WheelEvent;
      if (!zoomDesbloqueadoRef.current) {
        let scrollAmount = we.deltaY;
        if (we.deltaMode === 1) {
          scrollAmount *= 33;
        } else if (we.deltaMode === 2) {
          scrollAmount *= window.innerHeight;
        }

        const mainEl = document.querySelector('main');
        let scrolled = false;
        if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
          const prev = mainEl.scrollTop;
          mainEl.scrollTop += scrollAmount;
          if (mainEl.scrollTop !== prev) {
            scrolled = true;
          }
        }
        if (!scrolled) {
          window.scrollBy({ top: scrollAmount });
        }
        e.preventDefault();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const delta = we.deltaY < 0 ? ZOOM_PASO : -ZOOM_PASO;
      const z = limitar(zoomRef.current + delta);
      if (handleZoomChangeRef.current) handleZoomChangeRef.current(z);
      reiniciarInactivityLockTimer();
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
    const dx = (e.clientX - dragStartRef.current.x) / zoomEfectivo;
    const dy = (e.clientY - dragStartRef.current.y) / zoomEfectivo;
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

  const [canvasHoveredId, setCanvasHoveredId] = useState<string | null>(null);

  // Información de la Salida hovered ÚNICAMENTE cuando se hace hover dentro de la ventana de diseño
  const hoveredSalidaInfo = useMemo(() => {
    if (!canvasHoveredId) return null;
    if (canvasHoveredId === "main-breaker") {
      return {
        tag: "Q1 MAIN",
        titulo: interruptorPrincipal?.descripcion || "Interruptor Principal Cabecera",
        codigo: interruptorPrincipal?.codigo_comercial || interruptorPrincipal?.codigo || "-",
        corriente: interruptorPrincipal?.corriente_nominal_a ? `${interruptorPrincipal.corriente_nominal_a}A` : "-",
        polos: interruptorPrincipal?.polos ? `${interruptorPrincipal.polos}P` : "-",
        seccion: "Entrada Principal",
        cable: "-",
      };
    }

    if (canvasHoveredId === "q1-busbar-block") {
      return {
        tag: "EMBARRADO",
        titulo: "Bloque Distribuidor / Embarrado General",
        codigo: "DIST-COBRE-160A",
        corriente: "160A / 250A",
        polos: "3P+N / 4P",
        seccion: "Fila 1 (Cabecera)",
        cable: "Barras de Cobre",
        alimentadoPor: "Q1 MAIN",
      };
    }

    if (canvasHoveredId.startsWith("canal-")) {
      if (canvasHoveredId.includes("vert-izq")) {
        return {
          tag: "CANALETA VERT-IZQ",
          titulo: "Cable Canal Vertical Izquierdo (25x40 mm)",
          codigo: "CANAL-RAN-25X40",
          corriente: "25 x 40 mm",
          polos: "Ranurada",
          seccion: "Canalización Z=0",
          cable: "Llenado Máx 65%",
        };
      }
      if (canvasHoveredId.includes("vert-der")) {
        return {
          tag: "CANALETA VERT-DER",
          titulo: "Cable Canal Vertical Derecho (25x40 mm)",
          codigo: "CANAL-RAN-25X40",
          corriente: "25 x 40 mm",
          polos: "Ranurada",
          seccion: "Canalización Z=0",
          cable: "Llenado Máx 65%",
        };
      }
      if (canvasHoveredId.includes("horiz-bot")) {
        return {
          tag: "CANALETA HORIZ-BOT",
          titulo: "Cable Canal Horizontal Inferior con Ingletes a 45°",
          codigo: "CANAL-RAN-25X40",
          corriente: "25 x 40 mm",
          polos: "Ingletes 45°",
          seccion: "Canalización Z=0",
          cable: "Llenado Máx 65%",
        };
      }
      if (canvasHoveredId.includes("corner")) {
        return {
          tag: "INGLETE 45°",
          titulo: "Corte a 45° en Esquina de Canaleta Inferior",
          codigo: "INGLETE-45",
          corriente: "Bisel 45°",
          polos: "BOM Real",
          seccion: "Canalización Z=0",
          cable: "Empalme Esquina",
        };
      }
      return {
        tag: "CANALETA HORIZ",
        titulo: "Cable Canal Horizontal Intermedio (25x40 mm)",
        codigo: "CANAL-RAN-25X40",
        corriente: "25 x 40 mm",
        polos: "Ranurada",
        seccion: "Canalización Z=0",
        cable: "Llenado Máx 65%",
      };
    }
    for (let secIdx = 0; secIdx < secciones.length; secIdx++) {
      const sec = secciones[secIdx];
      const foundIdx = sec.salidas.findIndex((sal) => sal.id === canvasHoveredId);
      if (foundIdx !== -1) {
        const found = sec.salidas[foundIdx];
        const codComercial = found.componente_codigo_comercial || found.componente_codigo;
        const corrienteNum = Number(found.corriente_nominal_a) || Number(found.carga_valor) || 0;
        const corrienteDisplay = corrienteNum > 0 ? `${corrienteNum}A` : found.carga_valor ? `${found.carga_valor}A` : "-";
        const posicionFallback = `F${secIdx + 1}.${foundIdx + 1}`;

        return {
          tag: found.posicion_codigo || posicionFallback,
          titulo: found.componente_descripcion || found.descripcion_personalizada || found.etiqueta || "Interruptor de Salida",
          codigo: codComercial || null,
          corriente: corrienteDisplay,
          polos: found.formato || "-",
          curva: found.curva || "C",
          seccion: sec.seccion.nombre,
          cable: found.seccion_cable_mm2 ? `${found.seccion_cable_mm2} mm²` : "-",
          alimentadoPor: found.alimentado_por_codigo || null,
        };
      }
    }
    return null;
  }, [canvasHoveredId, secciones, interruptorPrincipal]);

  const handleZoomIn = () => handleZoomChange(zoomEfectivo + ZOOM_PASO);
  const handleZoomOut = () => handleZoomChange(zoomEfectivo - ZOOM_PASO);

  const renderControlesSVG = (esModal: boolean) => (
    <div className="flex items-center gap-1">
      <Button
        size="xs"
        variant="ghost"
        icon={<MagnifyingGlassMinusIcon className="w-4 h-4" />}
        aria-label="Alejar"
        onClick={handleZoomOut}
        title="Alejar (-)"
      />
      <Button
        size="xs"
        variant="secondary"
        onClick={resetPanAndZoom}
        title="Restablecer vista a 100%"
        aria-label="Ajustar zoom"
      >
        <span className="font-mono text-xs font-bold">{Math.round(zoomEfectivo * 100)}%</span>
      </Button>
      <Button
        size="xs"
        variant="ghost"
        icon={<MagnifyingGlassPlusIcon className="w-4 h-4" />}
        aria-label="Acercar"
        onClick={handleZoomIn}
        title="Acercar (+)"
      />
      <Button
        size="xs"
        variant={zoomDesbloqueado ? "primary" : "ghost"}
        icon={
          zoomDesbloqueado ? (
            <LockOpenIcon className="w-4 h-4 text-white" />
          ) : (
            <LockClosedIcon className="w-4 h-4 text-slate-400" />
          )
        }
        aria-label={zoomDesbloqueado ? "Bloquear zoom por rueda" : "Habilitar zoom por rueda"}
        onClick={() => {
          const next = !zoomDesbloqueado;
          setZoomDesbloqueado(next);
          if (next) reiniciarInactivityLockTimer();
        }}
        title={
          zoomDesbloqueado
            ? "Zoom rueda DESBLOQUEADO (Haz clic para bloquear y permitir scroll normal de página)"
            : "Zoom rueda BLOQUEADO (Permite scroll normal de página. Haz clic para habilitar zoom rueda)"
        }
      />
      <Button
        size="xs"
        variant={panelCapasAbierto ? "secondary" : "ghost"}
        icon={<Square3Stack3DIcon className="w-4 h-4" />}
        aria-label="Capas"
        onClick={() => setPanelCapasAbierto((abierto) => !abierto)}
        title="Gestor de Capas"
      />
      {!esModal && (
        <Button
          size="xs"
          variant="ghost"
          icon={<ArrowsPointingOutIcon className="w-4 h-4" />}
          aria-label="Pantalla completa"
          onClick={() => setModalAmpliado(true)}
          title="Pantalla completa"
        />
      )}
    </div>
  );

  const renderInfoHoverHUD = (isModal: boolean) => {
    if (!hoveredSalidaInfo) {
      if (canvasHoveredId) {
        return (
          <div
            className={`absolute ${
              isModal ? "bottom-8" : "bottom-4"
            } left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-slate-100 border border-slate-700 shadow-xl backdrop-blur-md rounded-md px-4 py-1.5 text-xs font-mono select-none pointer-events-none transition-all duration-300 animate-fade-in`}
          >
            [CAD INSPECT] Pasa el cursor sobre cualquier línea o elemento para ver detalles técnicos
          </div>
        );
      }
      return null;
    }

    return (
      <div className={`absolute ${isModal ? "bottom-8" : "bottom-4"} left-1/2 -translate-x-1/2 z-50 bg-white/95 text-slate-900 border border-slate-300/80 shadow-[0_8px_30px_rgba(0,0,0,0.15)] backdrop-blur-md rounded-md px-4 py-1.5 flex items-center space-x-4 max-w-[92%] whitespace-nowrap text-xs font-sans select-none pointer-events-none transition-all duration-300 ease-out transform translate-y-0 animate-fade-in`}>
        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="bg-slate-100 text-emerald-800 border border-emerald-300 font-mono font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
            {hoveredSalidaInfo.tag}
          </span>
          {hoveredSalidaInfo.alimentadoPor && (
            <span className="bg-red-50 text-abb-red border border-red-200 font-mono font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
              Alimentado por {hoveredSalidaInfo.alimentadoPor}
            </span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

        <div className="flex items-center space-x-2 truncate max-w-lg shrink">
          <span className="font-semibold text-slate-900 text-xs truncate">{hoveredSalidaInfo.titulo}</span>
          {hoveredSalidaInfo.codigo && (
            <span className="text-[11px] font-mono text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
              {hoveredSalidaInfo.codigo}
            </span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

        <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Calibre:</span>
            <strong className="text-emerald-700 font-bold">{hoveredSalidaInfo.corriente}</strong>
          </div>
          <div className="flex items-center space-x-1 border-l border-slate-200 pl-3">
            <span className="text-[10px] text-slate-400 font-sans uppercase">Polos:</span>
            <strong className="text-sky-700 font-bold">{hoveredSalidaInfo.polos}</strong>
          </div>
          {hoveredSalidaInfo.cable !== "-" && (
            <div className="flex items-center space-x-1 border-l border-slate-200 pl-3">
              <span className="text-[10px] text-slate-400 font-sans uppercase">Cable:</span>
              <strong className="text-purple-700 font-bold">{hoveredSalidaInfo.cable}</strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-3">
      <div className="flex items-center justify-between bg-industrial-gray border border-surface-stroke rounded-xl px-4 py-2 shadow-sm">
        <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setModoVisualState("bloques")}
            className={`px-3 py-1 text-xs font-sans rounded-md transition-all ${
              modoVisualState === "bloques"
                ? "bg-abb-red text-white font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
            }`}
          >
            Bloques
          </button>
          <button
            type="button"
            onClick={() => setModoVisualState("topografico")}
            className={`px-3 py-1 text-xs font-sans rounded-md transition-all ${
              modoVisualState === "topografico"
                ? "bg-abb-red text-white font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
            }`}
          >
            Topográfico
          </button>
          <button
            type="button"
            onClick={() => setModoVisualState("unifilar")}
            className={`px-3 py-1 text-xs font-sans rounded-md transition-all ${
              modoVisualState === "unifilar"
                ? "bg-abb-red text-white font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
            }`}
          >
            Unifilar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] font-mono text-gray-500 hidden sm:block">
            {modoVisualState === "bloques"
              ? "Modo Bloques"
              : `Motor CAD DXF - Modo ${modoVisualState === "topografico" ? "Topográfico 2D" : "Esquema Unifilar"}`}
          </div>

          {panelLateralColapsado && onTogglePanelLateral && (
            <button
              type="button"
              onClick={onTogglePanelLateral}
              title="Expandir tarjetas laterales"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-sans font-normal rounded-lg border border-gray-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors shrink-0"
            >
              <ArrowsPointingOutIcon className="w-3.5 h-3.5 text-abb-red shrink-0" />
              <span>Expandir tarjetas laterales</span>
            </button>
          )}
        </div>
      </div>

      {/* RENDER SEGÚN EL MODO SELECCIONADO */}
      {modoVisualState === "bloques" ? (
        /* VISTA ORIGINAL DE BLOQUES (BLUEPRINT SVG) SIN MANDOS DE DISEÑO CAD */
        <>
          <div className="border border-surface-stroke bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col h-[620px]">
            {/* Cabecera del Blueprint Bloques */}
            <div className="flex items-center justify-between border-b border-surface-stroke bg-industrial-gray px-4 py-2.5 min-h-[42px] shrink-0">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <CpuChipIcon className="w-4 h-4 text-abb-red" />
                Blueprint Bloques
              </span>
              {renderControlesSVG(false)}
            </div>

            {/* Panel desplegable de capas */}
            {panelCapasAbierto && (
              <div className="flex gap-4 border-b border-surface-stroke px-4 py-2.5 bg-gray-50 text-xs font-medium shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capasEfectivas.codigos}
                    onChange={(e) => handleCapasChange({ ...capasEfectivas, codigos: e.target.checked })}
                    className="accent-abb-red"
                  />
                  Amperios / Etiquetas
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capasEfectivas.embarrado}
                    onChange={(e) => handleCapasChange({ ...capasEfectivas, embarrado: e.target.checked })}
                    className="accent-abb-red"
                  />
                  Embarrado General
                </label>
              </div>
            )}

            {/* Área del Blueprint con Pan y Zoom */}
            <div
              ref={svgAreaRef}
              style={{
                overscrollBehavior: zoomDesbloqueado ? "contain" : "auto",
                touchAction: zoomDesbloqueado ? "none" : "auto",
              }}
              className={`flex-1 w-full justify-center overflow-hidden bg-slate-50/50 relative ${
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
                zoom={zoomEfectivo}
                panX={panX}
                panY={panY}
                capas={capasEfectivas}
                hoveredSalidaId={hoveredSalidaId}
                onSalidaHover={(id) => {
                  setCanvasHoveredId(id);
                  if (onSalidaHover) onSalidaHover(id);
                }}
                onSalidaClick={onSalidaClick}
              />
              {/* HUD Inspector en modo SVG normal */}
              {renderInfoHoverHUD(false)}
            </div>
          </div>

          {/* Modal Ampliado Pantalla Completa para SVG Bloques */}
          {modalAmpliado && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="w-full h-full max-w-7xl max-h-[94vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-300 relative">
                <div className="flex items-center justify-between bg-industrial-gray px-4 py-3 border-b border-surface-stroke">
                  <span className="font-mono text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <CpuChipIcon className="w-5 h-5 text-abb-red" />
                    Blueprint Bloques (Pantalla Completa)
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    {renderControlesSVG(true)}
                    <button
                      type="button"
                      aria-label="Cerrar modal de pantalla completa"
                      onClick={() => setModalAmpliado(false)}
                      className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition border-l border-gray-300 pl-3 ml-1"
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
                    zoom={zoomEfectivo}
                    panX={panX}
                    panY={panY}
                    capas={capasEfectivas}
                    hoveredSalidaId={hoveredSalidaId}
                    onSalidaHover={(id) => {
                      setCanvasHoveredId(id);
                      if (onSalidaHover) onSalidaHover(id);
                    }}
                    onSalidaClick={(salida) => {
                      if (onSalidaClick) onSalidaClick(salida);
                      setModalAmpliado(false);
                    }}
                  />

                  {/* BARRA DE INSPECCIÓN CAD TÉCNICA (HUD COMPACTO EN UNA SOLA LÍNEA) */}
                  {renderInfoHoverHUD(true)}
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
          obtenerVistaModo={obtenerVistaModo}
          onModoStateChange={onModoStateChange}
          zoom={zoomProp}
          onZoomChange={onZoomChange}
          capas={capasProp}
          onCapasChange={onCapasChange}
          hoveredSalidaId={hoveredSalidaId}
          onSalidaHover={onSalidaHover}
          onSalidaClick={onSalidaClick}
          gabineteSugeridoAncho={gabineteSugeridoAncho}
          gabineteSugeridoAlto={gabineteSugeridoAlto}
          pasoMm={pasoMm}
          modoVisual={modoVisualState}
          onModoVisualChange={setModoVisualState}
        />
      )}
    </div>
  );
}
