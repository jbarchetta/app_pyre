import { useState, useRef } from "react";
import type { Salida, Seccion } from "../api/client";
import { EsquemaVisual, type Capas } from "./EsquemaVisual";

const ZOOM_PASO = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

interface EsquemaVisualCanvasProps {
  tieneInterruptorPrincipal: boolean;
  secciones: { seccion: Seccion; salidas: Salida[] }[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
  capas: Capas;
  onCapasChange: (capas: Capas) => void;
  hoveredSalidaId?: string | null;
  onSalidaHover?: (salidaId: string | null) => void;
  onSalidaClick?: (salida: Salida) => void;
}

function limitar(valor: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(valor.toFixed(2))));
}

export function EsquemaVisualCanvas({
  tieneInterruptorPrincipal,
  secciones,
  zoom,
  onZoomChange,
  capas,
  onCapasChange,
  hoveredSalidaId,
  onSalidaHover,
  onSalidaClick,
}: EsquemaVisualCanvasProps) {
  const [panelCapasAbierto, setPanelCapasAbierto] = useState(false);
  const [modalAmpliado, setModalAmpliado] = useState(false);

  // Estados de pan (arrastre con ratón)
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Solo arrastrar con el botón principal (izquierdo)
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
    };
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
    onZoomChange(1);
    setPanX(0);
    setPanY(0);
  };

  const renderControles = (esModal: boolean) => (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Alejar"
        onClick={() => onZoomChange(limitar(zoom - ZOOM_PASO))}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition"
        title="Alejar (-)"
      >
        <span className="material-symbols-outlined text-lg">zoom_out</span>
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
        onClick={() => onZoomChange(limitar(zoom + ZOOM_PASO))}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition"
        title="Acercar (+)"
      >
        <span className="material-symbols-outlined text-lg">zoom_in</span>
      </button>
      <button
        type="button"
        aria-label="Capas"
        onClick={() => setPanelCapasAbierto((abierto) => !abierto)}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition"
        title="Capas del esquema"
      >
        <span className="material-symbols-outlined text-lg">layers</span>
      </button>
      <button
        type="button"
        aria-label={esModal ? "Salir de pantalla completa" : "Pantalla completa"}
        onClick={() => setModalAmpliado(!esModal)}
        className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition ml-1"
        title={esModal ? "Salir de pantalla completa (Esc)" : "Ampliar a pantalla completa"}
      >
        <span className="material-symbols-outlined text-lg">
          {esModal ? "fullscreen_exit" : "fullscreen"}
        </span>
      </button>
    </div>
  );

  return (
    <>
      <div className="border border-surface-stroke bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* Cabecera del Blueprint */}
        <div className="flex items-center justify-between border-b border-surface-stroke bg-industrial-gray p-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-abb-red">schema</span>
            Blueprint (50% Ancho)
          </span>
          {renderControles(false)}
        </div>

        {/* Panel desplegable de capas */}
        {panelCapasAbierto && (
          <div className="flex gap-4 border-b border-surface-stroke p-3 bg-gray-50 text-xs font-medium">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={capas.codigos}
                onChange={(e) => onCapasChange({ ...capas, codigos: e.target.checked })}
                className="accent-abb-red"
              />
              Amperios / Etiquetas
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={capas.embarrado}
                onChange={(e) => onCapasChange({ ...capas, embarrado: e.target.checked })}
                className="accent-abb-red"
              />
              Embarrado General
            </label>
          </div>
        )}

        {/* Área del Blueprint con Pan (arrastre de ratón) */}
        <div
          className={`blueprint-grid flex min-h-[360px] max-h-[70vh] justify-center overflow-hidden p-4 bg-gray-50/50 ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          title="Mantené presionado el ratón para desplazar la vista (Pan)"
        >
          <EsquemaVisual
            tieneInterruptorPrincipal={tieneInterruptorPrincipal}
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

      {/* Modal Ampliado (Pantalla Completa) */}
      {modalAmpliado && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between bg-industrial-gray px-4 py-3 rounded-t-xl border-b border-surface-stroke">
            <span className="font-mono text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-abb-red text-xl">schema</span>
              Blueprint Unifilar (Pantalla Completa)
            </span>
            <div className="flex items-center gap-2">
              {renderControles(true)}
              <button
                type="button"
                aria-label="Cerrar modal de pantalla completa"
                onClick={() => setModalAmpliado(false)}
                className="p-1.5 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200 transition ml-2"
                title="Cerrar (Esc)"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>

          <div
            className={`flex-1 bg-white rounded-b-xl shadow-2xl p-6 overflow-hidden flex items-center justify-center ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <EsquemaVisual
              tieneInterruptorPrincipal={tieneInterruptorPrincipal}
              secciones={secciones}
              zoom={zoom}
              panX={panX}
              panY={panY}
              capas={capas}
              hoveredSalidaId={hoveredSalidaId}
              onSalidaHover={onSalidaHover}
              onSalidaClick={(salida) => {
                onSalidaClick?.(salida);
                setModalAmpliado(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
