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
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import type { Salida, Seccion } from "../api/client";
import type { CadPoint, ViewportTransform } from "../cad/core/types";
import { zoomAtPoint, calculateFitToScreen, screenToWorld } from "../cad/core/transform";
import { findPrimitiveAtPoint, snapToGrid } from "../cad/core/hitTest";
import { downloadDxfFile } from "../cad/core/dxfExporter";
import { exportarPdfProfesional } from "../cad/core/pdfExporter";
import { generateBoardCadDocument, type InterruptorPrincipalInfo } from "../cad/generators/boardCadGenerator";
import { CadCanvasEngine } from "../cad/engine/CadCanvasEngine";
import type { Capas } from "./EsquemaVisual";

import type { ModoVisual, ModoVisualState } from "../utils/vistaStorage";
import { Button } from "./common/Button";

interface CadViewerCanvasProps {
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

import { preloadDxfSymbols } from "../cad/symbols/symbolRegistry";

export function CadViewerCanvas({
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
  modoVisual: modoVisualProp = "topografico",
}: CadViewerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CadCanvasEngine | null>(null);

  const [modoVisual, setModoVisualState] = useState<"topografico" | "bloques" | "unifilar">(modoVisualProp);
  const [dxfCargado, setDxfCargado] = useState(false);

  useEffect(() => {
    preloadDxfSymbols().then(() => setDxfCargado(true));
  }, []);

  useEffect(() => {
    if (modoVisualProp) setModoVisualState(modoVisualProp);
  }, [modoVisualProp]);

  const estadoModoActual = obtenerVistaModo ? obtenerVistaModo(modoVisual) : null;

  const zoomEfectivo = estadoModoActual ? estadoModoActual.zoom : zoomProp;
  const capasEfectivas = estadoModoActual ? estadoModoActual.capas : capasProp;

  const [themeLocal, setThemeLocal] = useState<"dark" | "light">("dark");
  const [showGridLocal, setShowGridLocal] = useState(true);
  const [snapGridLocal, setSnapGridLocal] = useState(false);
  const [panelCapasAbiertoLocal, setPanelCapasAbiertoLocal] = useState(false);
  const [herramientaMedirLocal, setHerramientaMedirLocal] = useState(false);

  const theme = estadoModoActual?.theme ?? themeLocal;
  const showGrid = estadoModoActual?.showGrid ?? showGridLocal;
  const snapGrid = estadoModoActual?.snapGrid ?? snapGridLocal;
  const herramientaMedir = estadoModoActual?.herramientaMedir ?? herramientaMedirLocal;
  const panelCapasAbierto = estadoModoActual?.panelCapasAbierto ?? panelCapasAbiertoLocal;

  const [modalAmpliado, setModalAmpliado] = useState(false);
  const [puntoInicioMedicion, setPuntoInicioMedicion] = useState<CadPoint | null>(null);

  const updateModoState = useCallback(
    (cambios: Partial<ModoVisualState>) => {
      if (onModoStateChange) {
        onModoStateChange(modoVisual, cambios);
      }
    },
    [modoVisual, onModoStateChange]
  );

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
  }, [tieneInterruptorPrincipal, interruptorPrincipal, secciones, modoVisual, gabineteSugeridoAncho, gabineteSugeridoAlto, dxfCargado]);

  // Estado de capas internas
  const [capasInternas, setCapasInternas] = useState<Capas>(capasEfectivas);

  useEffect(() => {
    setCapasInternas(capasEfectivas);
  }, [capasEfectivas]);

  const activeLayerIds = useMemo(() => {
    const active = new Set<string>();
    cadDoc.layers.forEach((l) => {
      if (l.id === "2_Embarrado" && !capasInternas.embarrado) return;
      if (l.id === "6_Cotas_Textos" && !capasInternas.codigos) return;
      active.add(l.id);
    });
    return active;
  }, [cadDoc.layers, capasInternas]);

  const [canvasHoveredId, setCanvasHoveredId] = useState<string | null>(null);
  const [menuExportarAbierto, setMenuExportarAbierto] = useState(false);

  // Información de la Salida hovered ÚNICAMENTE cuando el puntero está dentro de la ventana de diseño CAD
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
    for (const sec of secciones) {
      const found = sec.salidas.find((sal) => sal.id === canvasHoveredId);
      if (found) {
        const codComercial = found.componente_codigo_comercial || found.componente_codigo;
        const corrienteNum = Number(found.corriente_nominal_a) || Number(found.carga_valor) || 0;
        const corrienteDisplay = corrienteNum > 0 ? `${corrienteNum}A` : found.carga_valor ? `${found.carga_valor}A` : "-";

        return {
          tag: found.posicion_codigo || `Salida ${(found.orden ?? found.posicion_orden ?? 0) + 1}`,
          titulo: found.componente_descripcion || found.descripcion_personalizada || found.etiqueta || "Interruptor de Salida",
          codigo: codComercial || null,
          corriente: corrienteDisplay,
          polos: found.formato || "-",
          curva: found.curva || "C",
          seccion: sec.seccion.nombre,
          cable: found.seccion_cable_mm2 ? `${found.seccion_cable_mm2} mm²` : "-",
        };
      }
    }
    return null;
  }, [canvasHoveredId, secciones, interruptorPrincipal]);

  // Transformación de Viewport (Zoom y Pan)
  const [transform, setTransform] = useState<ViewportTransform>({
    zoom: zoomEfectivo,
    panX: estadoModoActual?.panX ?? 50,
    panY: estadoModoActual?.panY ?? 50,
  });

  // Sincronizar zoom prop desde el padre usando zoomAtPoint al centro del contenedor
  useEffect(() => {
    setTransform((t) => {
      const targetZoom = limitar(zoomEfectivo);
      if (Math.abs(t.zoom - targetZoom) < 0.005) return t;
      const w = containerRef.current?.clientWidth || window.innerWidth || 800;
      const h = containerRef.current?.clientHeight || window.innerHeight || 600;
      const centerPixel = { x: w / 2, y: h / 2 };
      return zoomAtPoint(centerPixel, t, targetZoom);
    });
  }, [zoomEfectivo]);

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

  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  // Event listener nativo no-pasivo sobre el contenedor del lienzo CAD (se vincula una sola vez)
  useEffect(() => {
    const el = containerRef.current || canvasRef.current;
    if (!el) return;

    const onWheelNative = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const we = e as WheelEvent;
      const rect = el.getBoundingClientRect();
      const pixel = { x: we.clientX - rect.left, y: we.clientY - rect.top };

      const zoomFactor = we.deltaY < 0 ? 1.15 : 0.85;
      setTransform((prevTransform) => {
        const targetZoom = limitar(prevTransform.zoom * zoomFactor);
        const nextTransform = zoomAtPoint(pixel, prevTransform, targetZoom);
        if (onZoomChangeRef.current) onZoomChangeRef.current(nextTransform.zoom);
        updateModoState({ zoom: nextTransform.zoom, panX: nextTransform.panX, panY: nextTransform.panY });
        return nextTransform;
      });
    };

    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheelNative);
    };
  }, [updateModoState]);

  // Función para ajustar el dibujo a la pantalla (Fit Bounds) y notificar al padre
  const handleFitToScreen = useCallback(() => {
    const w = containerRef.current?.clientWidth || window.innerWidth || 800;
    const h = containerRef.current?.clientHeight || window.innerHeight || 600;
    const nextTransform = calculateFitToScreen(cadDoc.bounds, w, h, 40);
    setTransform(nextTransform);
    if (onZoomChangeRef.current) {
      onZoomChangeRef.current(nextTransform.zoom);
    }
    updateModoState({ zoom: nextTransform.zoom, panX: nextTransform.panX, panY: nextTransform.panY });
  }, [cadDoc.bounds, updateModoState]);

  // Restaurar estado guardado o hacer fit to screen inicial la primera vez que se abre este modo
  useEffect(() => {
    if (!estadoModoActual?.isSaved) {
      handleFitToScreen();
    } else {
      setTransform({
        zoom: estadoModoActual.zoom,
        panX: estadoModoActual.panX ?? 50,
        panY: estadoModoActual.panY ?? 50,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoVisual]);

  // Ciclo de renderizado
  useEffect(() => {
    if (!engineRef.current || !canvasRef.current) return;
    engineRef.current.render(cadDoc, transform, mousePosPx, {
      theme,
      showGrid,
      activeLayerIds,
      hoveredDataId: hoveredSalidaId || canvasHoveredId,
      measurementToolActive: herramientaMedir,
      measureStartPoint: puntoInicioMedicion,
    });
  }, [cadDoc, transform, mousePosPx, theme, showGrid, activeLayerIds, hoveredSalidaId, canvasHoveredId, herramientaMedir, puntoInicioMedicion]);

  // ResizeObserver para re-renderizar de inmediato ante cualquier cambio de dimensión del contenedor
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (engineRef.current && canvasRef.current) {
        engineRef.current.render(cadDoc, transform, mousePosPx, {
          theme,
          showGrid,
          activeLayerIds,
          hoveredDataId: hoveredSalidaId || canvasHoveredId,
          measurementToolActive: herramientaMedir,
          measureStartPoint: puntoInicioMedicion,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [cadDoc, transform, mousePosPx, theme, showGrid, activeLayerIds, hoveredSalidaId, canvasHoveredId, herramientaMedir, puntoInicioMedicion]);

  // Zoom incremental focalizado al centro de la pantalla
  const changeZoom = (delta: number) => {
    const targetZoom = limitar(transform.zoom + delta);
    const w = containerRef.current?.clientWidth || window.innerWidth || 800;
    const h = containerRef.current?.clientHeight || window.innerHeight || 600;
    const centerPixel = { x: w / 2, y: h / 2 };
    const nextTransform = zoomAtPoint(centerPixel, transform, targetZoom);
    setTransform(nextTransform);
    if (onZoomChange) {
      onZoomChange(nextTransform.zoom);
    }
    updateModoState({ zoom: nextTransform.zoom, panX: nextTransform.panX, panY: nextTransform.panY });
  };

  const resetZoom = () => {
    handleFitToScreen();
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
    const hoveredPrim = findPrimitiveAtPoint(worldPoint, cadDoc.primitives, activeLayerIds);
    const hitId = hoveredPrim?.dataId || null;

    setCanvasHoveredId(hitId);

    if (onSalidaHover) {
      onSalidaHover(hitId);
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
    if (isDragging) {
      updateModoState({ zoom: transform.zoom, panX: transform.panX, panY: transform.panY });
    }
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleMouseLeave = () => {
    setCanvasHoveredId(null);
    if (onSalidaHover) {
      onSalidaHover(null);
    }
    handleMouseUp();
  };

  const toggleCapasProp = (key: keyof Capas) => {
    const nextCapas = { ...capasInternas, [key]: !capasInternas[key] };
    setCapasInternas(nextCapas);
    if (onCapasChange) {
      onCapasChange(nextCapas);
    }
  };

  const zoomPorcentajeText = `${Math.round(transform.zoom * 100)}%`;

  return (
    <div
      className={
        modalAmpliado
          ? `fixed inset-0 z-50 w-screen h-screen flex flex-col p-2 animate-fade-in ${
              theme === "light" ? "bg-slate-100 text-slate-900" : "bg-slate-950 text-slate-200"
            }`
          : `relative flex flex-col w-full h-[620px] rounded-xl overflow-hidden border shadow-2xl ${
              theme === "light" ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-800 text-slate-200"
            }`
      }
    >
      {/* BARRA DE HERRAMIENTAS CAD */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b text-xs z-10 select-none ${
          theme === "light"
            ? "bg-slate-100 border-slate-300 text-slate-900 shadow-sm"
            : "bg-slate-950/90 border-slate-800 text-slate-200"
        }`}
      >
        {/* Título de Modo CAD Activo */}
        <div
          className={`flex items-center space-x-2 font-mono font-bold text-xs uppercase tracking-wider ${
            theme === "light" ? "text-slate-800" : "text-slate-200"
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
          <span>VISTA CAD {modoVisual === "topografico" ? "TOPOGRÁFICA 2D" : "UNIFILAR"}</span>
        </div>

        {/* Controles de Vista & Zoom con aria-labels */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => changeZoom(0.25)}
            aria-label="Acercar"
            title="Zoom In (+)"
            className={`p-1.5 rounded-md transition-colors ${
              theme === "light"
                ? "text-slate-700 hover:text-slate-950 hover:bg-slate-200"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <MagnifyingGlassPlusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => changeZoom(-0.25)}
            aria-label="Alejar"
            title="Zoom Out (-)"
            className={`p-1.5 rounded-md transition-colors ${
              theme === "light"
                ? "text-slate-700 hover:text-slate-950 hover:bg-slate-200"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <MagnifyingGlassMinusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            aria-label="Ajustar zoom"
            title="Ajustar a Pantalla / Reset Zoom"
            className={`p-1.5 rounded-md flex items-center space-x-1 transition-colors ${
              theme === "light"
                ? "text-slate-700 hover:text-slate-950 hover:bg-slate-200"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ArrowsPointingOutIcon className="w-4 h-4" />
            <span className="font-mono text-xs">{zoomPorcentajeText}</span>
          </button>
        </div>

        {/* Switch de Tema Dark / Light y Modos CAD */}
        <div className="flex items-center space-x-2">
          <Button
            size="xs"
            variant={theme === "light" ? "secondary" : "cad-tool"}
            icon={theme === "light" ? <SunIcon className="w-3.5 h-3.5 text-amber-500" /> : <MoonIcon className="w-3.5 h-3.5 text-sky-400" />}
            onClick={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setThemeLocal(nextTheme);
              updateModoState({ theme: nextTheme });
            }}
            title="Cambiar Tema Dark / Light"
          >
            {theme === "light" ? "Light" : "Dark"}
          </Button>

          <Button
            size="xs"
            variant={showGrid ? "cad-tool-active" : "cad-tool"}
            onClick={() => {
              const nextGrid = !showGrid;
              setShowGridLocal(nextGrid);
              updateModoState({ showGrid: nextGrid });
            }}
            title={showGrid ? "Desactivar Grilla CAD" : "Activar Grilla CAD"}
          >
            GRID
          </Button>

          <Button
            size="xs"
            variant={snapGrid ? "cad-tool-active" : "cad-tool"}
            onClick={() => {
              const nextSnap = !snapGrid;
              setSnapGridLocal(nextSnap);
              updateModoState({ snapGrid: nextSnap });
            }}
            title={snapGrid ? "Desactivar Snap a Grilla (10mm)" : "Activar Snap a Grilla (10mm)"}
          >
            SNAP
          </Button>

          <Button
            size="xs"
            variant={herramientaMedir ? "cad-tool-active" : "cad-tool"}
            icon={<AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />}
            onClick={() => {
              const nextMedir = !herramientaMedir;
              setHerramientaMedirLocal(nextMedir);
              setPuntoInicioMedicion(null);
              updateModoState({ herramientaMedir: nextMedir });
            }}
          >
            Medir
          </Button>

          <Button
            size="xs"
            variant={panelCapasAbierto ? "cad-tool-active" : "cad-tool"}
            icon={<Square3Stack3DIcon className="w-3.5 h-3.5" />}
            onClick={() => {
              const nextPanel = !panelCapasAbierto;
              setPanelCapasAbiertoLocal(nextPanel);
              updateModoState({ panelCapasAbierto: nextPanel });
            }}
            title="Gestor de Capas CAD"
          >
            Capas
          </Button>

          {!modalAmpliado && (
            <button
              onClick={() => setModalAmpliado(true)}
              aria-label="Pantalla completa"
              className={`p-1.5 rounded-md transition-colors ${
                theme === "light"
                  ? "text-slate-700 hover:text-slate-950 hover:bg-slate-200"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
              title="Pantalla Completa"
            >
              <ArrowsPointingOutIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Acciones de Exportación Profesional y Cierre de Pantalla Completa */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Button
              size="xs"
              variant="primary"
              icon={<DocumentArrowDownIcon className="w-3.5 h-3.5" />}
              onClick={() => setMenuExportarAbierto((v) => !v)}
            >
              <span className="flex items-center gap-1">
                <span>Exportar</span>
                <ChevronDownIcon className="w-3 h-3" />
              </span>
            </Button>

            {menuExportarAbierto && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-700 text-slate-100 rounded-xl shadow-2xl z-50 overflow-hidden py-1 backdrop-blur-xl">
                <button
                  onClick={() => {
                    setMenuExportarAbierto(false);
                    downloadDxfFile(cadDoc, `tablero_pyre_${modoVisual}.dxf`);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800 flex items-center space-x-2.5 text-xs font-medium transition-colors"
                >
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold rounded">DXF</span>
                  <span>Exportar AutoCAD (.dxf)</span>
                </button>

                <button
                  onClick={() => {
                    setMenuExportarAbierto(false);
                    exportarPdfProfesional(cadDoc, `tablero_pyre_${modoVisual}.pdf`, canvasRef.current, theme);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800 flex items-center space-x-2.5 text-xs font-medium transition-colors border-t border-slate-800"
                >
                  <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 font-mono text-[10px] font-bold rounded">PDF</span>
                  <span>Exportar Plano PDF (.pdf)</span>
                </button>
              </div>
            )}
          </div>

          {modalAmpliado && (
            <Button
              size="xs"
              variant="secondary"
              icon={<XMarkIcon className="w-3.5 h-3.5" />}
              onClick={() => setModalAmpliado(false)}
              title="Salir de Pantalla Completa (Esc)"
              aria-label="Salir de pantalla completa"
            >
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {/* PANEL FLOTANTE DE CAPAS CAD */}
      {panelCapasAbierto && (
        <div className="absolute top-12 right-4 z-40 w-64 p-3 rounded-xl shadow-xl border backdrop-blur-md animate-fade-in transition-all">
          <div
            className={`flex items-center justify-between border-b pb-2 mb-2 ${
              theme === "light" ? "border-slate-200" : "border-slate-800"
            }`}
          >
            <h4
              className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1 ${
                theme === "light" ? "text-slate-800" : "text-slate-300"
              }`}
            >
              <Square3Stack3DIcon className="w-4 h-4 text-sky-500" />
              <span>Capas CAD (Layers)</span>
            </h4>
            <button
              onClick={() => {
                setPanelCapasAbiertoLocal(false);
                updateModoState({ panelCapasAbierto: false });
              }}
              className={theme === "light" ? "text-slate-400 hover:text-slate-800 text-xs" : "text-slate-500 hover:text-white text-xs"}
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            <label
              className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${
                theme === "light"
                  ? "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800"
                  : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-200"
              }`}
            >
              <span className="font-mono text-xs">embarrado</span>
              <input
                type="checkbox"
                aria-label="embarrado"
                checked={capasInternas.embarrado}
                onChange={() => toggleCapasProp("embarrado")}
                className="rounded border-slate-400 text-blue-600 focus:ring-0 cursor-pointer"
              />
            </label>

            <label
              className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${
                theme === "light"
                  ? "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800"
                  : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-200"
              }`}
            >
              <span className="font-mono text-xs">codigos</span>
              <input
                type="checkbox"
                aria-label="codigos"
                checked={capasInternas.codigos}
                onChange={() => toggleCapasProp("codigos")}
                className="rounded border-slate-400 text-blue-600 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* CANVAS PRINCIPAL CAD */}
      <div
        ref={containerRef}
        style={{ overscrollBehavior: "contain", touchAction: "none" }}
        className="flex-1 w-full relative cursor-crosshair overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* BARRA DE INSPECCIÓN CAD TÉCNICA (HUD COMPACTO EN UNA SOLA LÍNEA) */}
        {hoveredSalidaInfo ? (
          <div className={`absolute ${modalAmpliado ? "bottom-8" : "bottom-4"} left-1/2 -translate-x-1/2 z-50 bg-white/95 text-slate-900 border border-slate-300/80 shadow-[0_8px_30px_rgba(0,0,0,0.15)] backdrop-blur-md rounded-md px-4 py-1.5 flex items-center space-x-4 max-w-[92%] whitespace-nowrap text-xs font-sans select-none pointer-events-none transition-all duration-300 ease-out transform translate-y-0 animate-fade-in`}>
            {/* TAG DE POSICIÓN */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="bg-slate-100 text-emerald-800 border border-emerald-300 font-mono font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
                {hoveredSalidaInfo.tag}
              </span>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

            {/* DESCRIPCIÓN TÉCNICA Y CÓDIGO COMERCIAL */}
            <div className="flex items-center space-x-2 truncate max-w-lg shrink">
              <span className="font-semibold text-slate-900 text-xs truncate">{hoveredSalidaInfo.titulo}</span>
              {hoveredSalidaInfo.codigo && (
                <span className="text-[11px] font-mono text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                  {hoveredSalidaInfo.codigo}
                </span>
              )}
            </div>

            <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

            {/* MÉTRICAS TÉCNICAS (CALIBRE, POLOS, CABLE) EN FILA COMPACTA */}
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
        ) : null}
      </div>
    </div>
  );
}
