import { useState } from "react";
import type { Salida, Seccion } from "../api/client";
import { EsquemaVisual, type Capas } from "./EsquemaVisual";

const ZOOM_PASO = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

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

  return (
    <div className="border border-surface-stroke bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-surface-stroke bg-industrial-gray p-3">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-abb-red">schema</span>
          Vista Unifilar / Blueprint
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Alejar"
            onClick={() => onZoomChange(limitar(zoom - ZOOM_PASO))}
            className="p-1 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-lg">zoom_out</span>
          </button>
          <button
            type="button"
            aria-label="Ajustar zoom"
            title="Restablecer a 100%"
            className="border border-gray-300 px-2 py-0.5 font-mono text-xs rounded hover:bg-gray-200"
            onClick={() => onZoomChange(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Acercar"
            onClick={() => onZoomChange(limitar(zoom + ZOOM_PASO))}
            className="p-1 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-lg">zoom_in</span>
          </button>
          <button
            type="button"
            aria-label="Capas"
            onClick={() => setPanelCapasAbierto((abierto) => !abierto)}
            className="p-1 text-gray-600 hover:text-abb-red rounded hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-lg">layers</span>
          </button>
        </div>
      </div>
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
      <div className="blueprint-grid flex max-h-[70vh] justify-center overflow-auto p-4">
        <EsquemaVisual
          tieneInterruptorPrincipal={tieneInterruptorPrincipal}
          secciones={secciones}
          zoom={zoom}
          capas={capas}
          hoveredSalidaId={hoveredSalidaId}
          onSalidaHover={onSalidaHover}
          onSalidaClick={onSalidaClick}
        />
      </div>
    </div>
  );
}
