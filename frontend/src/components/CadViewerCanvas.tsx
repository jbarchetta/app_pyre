import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsPointingOutIcon,
  Square3Stack3DIcon,
  DocumentArrowDownIcon,
  AdjustmentsHorizontalIcon,
  SunIcon,
  MoonIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { Salida, Seccion } from "../api/client";
import type { CadPoint, ViewportTransform } from "../cad/core/types";
import { zoomAtPoint, calculateFitToScreen, screenToWorld } from "../cad/core/transform";
import { findPrimitiveAtPoint, snapToGrid } from "../cad/core/hitTest";
import { downloadDxfFile } from "../cad/core/dxfExporter";
import { generateBoardCadDocument, type InterruptorPrincipalInfo } from "../cad/generators/boardCadGenerator";
import { CadCanvasEngine } from "../cad/engine/CadCanvasEngine";
import type { Capas } from "./EsquemaVisual";

interface CadViewerCanvasProps {
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
  gabineteSugeridoAncho?: number | null;
  gabineteSugeridoAlto?: number | null;
  modoVisual?: "topografico" | "bloques" | "unifilar";
  onModoVisualChange?: (modo: "topografico" | "bloques" | "unifilar") => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

function limitar(valor: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(valor.toFixed(2))));
}

export function CadViewerCanvas({
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
  modoVisual: modoVisualProp = "topografico",
}: CadViewerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CadCanvasEngine | null>(null);

  const [modoVisual, setModoVisualState] = useState<"topografico" | "bloques" | "unifilar">(modoVisualProp);

  useEffect(() => {
    if (modoVisualProp) setModoVisualState(modoVisualProp);
  }, [modoVisualProp]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showGrid, setShowGrid] = useState(true);
  const [snapGrid, setSnapGrid] = useState(false);
  const [panelCapasAbierto, setPanelCapasAbierto] = useState(false);
  const [modalAmpliado, setModalAmpliado] = useState(false);
  const [herramientaMedir, setHerramientaMedir] = useState(false);
  const [puntoInicioMedicion, setPuntoInicioMedicion] = useState<CadPoint | null>(null);

  // Documento CAD generado paramétricamente
  const cadDoc = useMemo(() => {
    return generateBoardCadDocument({
      tieneInterruptorPrincipal,
      interruptorPrincipal,
      secciones,
      modoVisual,
      gabineteAnchoMm: gabineteSugeridoAncho,
      gabineteAltoMm: gabineteSugeridoAlto,
    });
  }, [tieneInterruptorPrincipal, interruptorPrincipal, secciones, modoVisual, gabineteSugeridoAncho, gabineteSugeridoAlto]);

  // Estado de capas internas
  const [capasInternas, setCapasInternas] = useState<Capas>(capas);

  useEffect(() => {
    setCapasInternas(capas);
  }, [capas]);

  const activeLayerIds = useMemo(() => {
    const active = new Set<string>();
    cadDoc.layers.forEach((l) => {
      if (l.id === "2_Embarrado" && !capasInternas.embarrado) return;
      if (l.id === "6_Cotas_Textos" && !capasInternas.codigos) return;
      active.add(l.id);
    });
    return active;
  }, [cadDoc.layers, capasInternas]);

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

  // Transformación de Viewport (Zoom y Pan)
  const [transform, setTransform] = useState<ViewportTransform>({ zoom, panX: 50, panY: 50 });

  // Sincronizar zoom prop desde el padre solo si difiere significativamente
  useEffect(() => {
    setTransform((t) => {
      const targetZoom = limitar(zoom);
      if (Math.abs(t.zoom - targetZoom) < 0.01) return t;
      return { ...t, zoom: targetZoom };
    });
  }, [zoom]);

  const [mousePosPx, setMousePosPx] = useState<{ x: number; y: number } | null>(null);

  // Arrastre / Pan
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Inicializar motor Canvas
  useEffect(() => {
    if (canvasRef.current) {
      engineRef.current = new CadCanvasEngine(canvasRef.current);
    }
  }, []);

  // Event listener nativo no-pasivo sobre el contenedor del lienzo CAD
  useEffect(() => {
    const el = containerRef.current || canvasRef.current;
    if (!el) return;

    const onWheelNative = (e: Event) => {
      e.preventDefault();
      const we = e as WheelEvent;
      const rect = el.getBoundingClientRect();
      const pixel = { x: we.clientX - rect.left, y: we.clientY - rect.top };

      const zoomFactor = we.deltaY < 0 ? 1.15 : 0.85;
      setTransform((prevTransform) => {
        const targetZoom = limitar(prevTransform.zoom * zoomFactor);
        const nextTransform = zoomAtPoint(pixel, prevTransform, targetZoom);
        if (onZoomChange) onZoomChange(nextTransform.zoom);
        return nextTransform;
      });
    };

    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheelNative);
    };
  }, [onZoomChange]);

  // Función para ajustar el dibujo a la pantalla (Fit Bounds)
  const handleFitToScreen = useCallback(() => {
    const w = containerRef.current?.clientWidth || window.innerWidth || 800;
    const h = containerRef.current?.clientHeight || window.innerHeight || 600;
    const nextTransform = calculateFitToScreen(cadDoc.bounds, w, h, 40);
    setTransform(nextTransform);
  }, [cadDoc.bounds]);

  // Auto fit al cambiar de modo visual o al alternar pantalla completa
  useEffect(() => {
    handleFitToScreen();
  }, [modoVisual, modalAmpliado, handleFitToScreen]);

  // Ciclo de renderizado
  useEffect(() => {
    if (!engineRef.current || !canvasRef.current) return;
    engineRef.current.render(cadDoc, transform, mousePosPx, {
      theme,
      showGrid,
      activeLayerIds,
      hoveredDataId: hoveredSalidaId,
      measurementToolActive: herramientaMedir,
      measureStartPoint: puntoInicioMedicion,
    });
  }, [cadDoc, transform, mousePosPx, theme, showGrid, activeLayerIds, hoveredSalidaId, herramientaMedir, puntoInicioMedicion]);

  const changeZoom = (delta: number) => {
    const nuevoZoom = limitar(transform.zoom + delta);
    setTransform((t) => ({ ...t, zoom: nuevoZoom }));
    if (onZoomChange) {
      onZoomChange(nuevoZoom);
    }
  };

  const resetZoom = () => {
    setTransform((t) => ({ ...t, zoom: 1 }));
    if (onZoomChange) {
      onZoomChange(1);
    }
  };

  // Eventos de Mouse
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pixel = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      let worldPoint = screenToWorld(pixel, transform);

      if (snapGrid) {
        worldPoint = snapToGrid(worldPoint, 10);
      }

      if (herramientaMedir) {
        if (!puntoInicioMedicion) {
          setPuntoInicioMedicion(worldPoint);
        } else {
          setPuntoInicioMedicion(null);
        }
        return;
      }

      const clickedPrim = findPrimitiveAtPoint(worldPoint, cadDoc.primitives, activeLayerIds);
      if (clickedPrim && clickedPrim.dataId && onSalidaClick) {
        const todasSalidas = secciones.flatMap((s) => s.salidas);
        const salidaEncontrada = todasSalidas.find((s) => s.id === clickedPrim.dataId);
        if (salidaEncontrada) {
          onSalidaClick(salidaEncontrada);
          return;
        }
      }

      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX: transform.panX, panY: transform.panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pixel = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setMousePosPx(pixel);

    const worldPoint = screenToWorld(pixel, transform);

    if (onSalidaHover) {
      const hoveredPrim = findPrimitiveAtPoint(worldPoint, cadDoc.primitives, activeLayerIds);
      onSalidaHover(hoveredPrim?.dataId || null);
    }

    if (isDragging && dragStartRef.current) {
      const dragStart = dragStartRef.current;
      if (!dragStart) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const initialPanX = dragStart.panX;
      const initialPanY = dragStart.panY;

      setTransform((prev) => ({
        ...prev,
        panX: initialPanX + dx,
        panY: initialPanY + dy,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const toggleCapasProp = (key: keyof Capas) => {
    const nextCapas = { ...capasInternas, [key]: !capasInternas[key] };
    setCapasInternas(nextCapas);
    if (onCapasChange) {
      onCapasChange(nextCapas);
    }
  };

  const exportPng = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `tablero_cad_${modoVisual}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const zoomPorcentajeText = `${Math.round(transform.zoom * 100)}%`;

  return (
    <div
      className={`transition-all duration-200 ${
        modalAmpliado
          ? "fixed inset-0 z-50 w-screen h-screen flex flex-col bg-slate-950 p-2"
          : `relative flex flex-col w-full h-[620px] rounded-xl overflow-hidden border shadow-2xl ${
              theme === "light" ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-800 text-slate-200"
            }`
      }`}
    >
      {/* BARRA DE HERRAMIENTAS CAD */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b text-xs z-10 select-none ${
          theme === "light" && !modalAmpliado ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-slate-950/90 border-slate-800 text-slate-200"
        }`}
      >
        {/* Título de Modo CAD Activo */}
        <div className="flex items-center space-x-2 font-mono font-bold text-xs uppercase tracking-wider text-slate-300">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>VISTA CAD {modoVisual === "topografico" ? "TOPOGRÁFICA 2D" : "UNIFILAR"}</span>
        </div>

        {/* Controles de Vista & Zoom con aria-labels */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => changeZoom(0.25)}
            aria-label="Acercar"
            title="Zoom In (+)"
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white"
          >
            <MagnifyingGlassPlusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => changeZoom(-0.25)}
            aria-label="Alejar"
            title="Zoom Out (-)"
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white"
          >
            <MagnifyingGlassMinusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            aria-label="Ajustar zoom"
            title="Ajustar a Pantalla / Reset Zoom"
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white flex items-center space-x-1"
          >
            <ArrowsPointingOutIcon className="w-4 h-4" />
            <span className="font-mono text-xs">{zoomPorcentajeText}</span>
          </button>
        </div>

        {/* Switch de Tema Dark / Light */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className={`px-2.5 py-1 rounded-md border text-xs flex items-center space-x-1 font-medium transition-colors ${
              theme === "light"
                ? "bg-amber-100 border-amber-300 text-amber-900"
                : "bg-slate-800 border-slate-700 text-sky-300"
            }`}
            title="Cambiar Tema Dark / Light"
          >
            {theme === "light" ? <SunIcon className="w-4 h-4 text-amber-600" /> : <MoonIcon className="w-4 h-4 text-sky-400" />}
            <span>{theme === "light" ? "Light" : "Dark"}</span>
          </button>

          <button
            onClick={() => setShowGrid((g) => !g)}
            className={`px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${
              showGrid ? "bg-sky-950/50 border-sky-700 text-sky-400" : "border-slate-700 text-slate-500"
            }`}
          >
            GRID: {showGrid ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setSnapGrid((s) => !s)}
            className={`px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${
              snapGrid ? "bg-yellow-950/50 border-yellow-700 text-yellow-400" : "border-slate-700 text-slate-500"
            }`}
          >
            SNAP: {snapGrid ? "10mm" : "OFF"}
          </button>

          <button
            onClick={() => {
              setHerramientaMedir((m) => !m);
              setPuntoInicioMedicion(null);
            }}
            className={`px-2.5 py-1 rounded-md border text-xs flex items-center space-x-1 transition-colors ${
              herramientaMedir
                ? "bg-pink-900/50 border-pink-700 text-pink-300"
                : "border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
            <span>Medir</span>
          </button>

          <button
            onClick={() => setPanelCapasAbierto((p) => !p)}
            aria-label="Capas"
            className={`p-1.5 rounded-md hover:bg-slate-800 text-slate-300 flex items-center space-x-1 ${
              panelCapasAbierto ? "bg-slate-800 text-sky-400" : ""
            }`}
            title="Gestor de Capas CAD"
          >
            <Square3Stack3DIcon className="w-4 h-4" />
            <span>Capas</span>
          </button>

          <button
            onClick={() => setModalAmpliado((m) => !m)}
            aria-label="Pantalla completa"
            className={`p-1.5 rounded-md text-slate-300 hover:text-white ${
              modalAmpliado ? "bg-sky-600 text-white" : "hover:bg-slate-800"
            }`}
            title={modalAmpliado ? "Salir de Pantalla Completa" : "Pantalla Completa"}
          >
            {modalAmpliado ? <XMarkIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
          </button>
        </div>

        {/* Acciones de Exportación */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => downloadDxfFile(cadDoc, `tablero_pyre_${modoVisual}.dxf`)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-md flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            <span>Exportar DXF</span>
          </button>

          <button
            onClick={exportPng}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium border border-slate-700"
          >
            PNG
          </button>
        </div>
      </div>

      {/* PANEL FLOTANTE DE CAPAS CAD */}
      {panelCapasAbierto && (
        <div className="absolute top-12 right-4 z-20 w-64 bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1">
              <Square3Stack3DIcon className="w-4 h-4 text-sky-400" />
              <span>Capas CAD (Layers)</span>
            </h4>
            <button onClick={() => setPanelCapasAbierto(false)} className="text-slate-500 hover:text-white text-xs">
              ✕
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 text-xs cursor-pointer">
              <span className="font-mono text-xs text-slate-200">embarrado</span>
              <input
                type="checkbox"
                aria-label="embarrado"
                checked={capasInternas.embarrado}
                onChange={() => toggleCapasProp("embarrado")}
                className="rounded border-slate-700 text-blue-600 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 text-xs cursor-pointer">
              <span className="font-mono text-xs text-slate-200">codigos</span>
              <input
                type="checkbox"
                aria-label="codigos"
                checked={capasInternas.codigos}
                onChange={() => toggleCapasProp("codigos")}
                className="rounded border-slate-700 text-blue-600 focus:ring-0"
              />
            </label>
          </div>
        </div>
      )}

      {/* CANVAS PRINCIPAL CAD */}
      <div ref={containerRef} className="flex-1 w-full h-full relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* BARRA / BANNER DE SINCRONIZACIÓN DE TABLA EN HOVER (PANTALLA COMPLETA Y DISEÑO) */}
        {hoveredSalidaInfo ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-950/95 text-white border border-purple-500/60 shadow-2xl backdrop-blur-md rounded-xl px-4 py-2.5 flex items-center space-x-4 max-w-4xl animate-fade-in text-xs font-mono select-none">
            <div className="flex items-center space-x-2 shrink-0 border-r border-slate-800 pr-3">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
              <span className="bg-purple-600 text-white font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
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
              <div className="text-center">
                <span className="block text-[9px] text-slate-400 uppercase">Calibre</span>
                <span className="font-bold text-emerald-400">{hoveredSalidaInfo.corriente}</span>
              </div>
              <div className="text-center">
                <span className="block text-[9px] text-slate-400 uppercase">Polos</span>
                <span className="font-bold text-sky-400">{hoveredSalidaInfo.polos}</span>
              </div>
              <div className="text-center">
                <span className="block text-[9px] text-slate-400 uppercase">Cable</span>
                <span className="font-bold text-purple-300">{hoveredSalidaInfo.cable}</span>
              </div>
            </div>
          </div>
        ) : modalAmpliado ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-950/80 text-slate-400 border border-slate-800 shadow-lg backdrop-blur-md rounded-full px-4 py-1.5 text-xs font-mono text-center select-none pointer-events-none">
            Pasa el puntero sobre cualquier elemento o línea para ver la fila de la tabla
          </div>
        ) : null}
      </div>
    </div>
  );
}
