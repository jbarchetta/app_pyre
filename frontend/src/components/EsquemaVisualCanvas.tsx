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
}: EsquemaVisualCanvasProps) {
  const [panelCapasAbierto, setPanelCapasAbierto] = useState(false);

  return (
    <div className="border border-surface-stroke bg-white">
      <div className="flex items-center justify-between border-b border-surface-stroke bg-industrial-gray p-4">
        <span className="font-mono text-xs uppercase text-secondary">Vista frontal — Blueprint 1:20</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Alejar" onClick={() => onZoomChange(limitar(zoom - ZOOM_PASO))}>
            <span className="material-symbols-outlined">zoom_out</span>
          </button>
          <button
            type="button"
            aria-label="Ajustar zoom"
            className="font-mono text-xs"
            onClick={() => onZoomChange(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="Acercar" onClick={() => onZoomChange(limitar(zoom + ZOOM_PASO))}>
            <span className="material-symbols-outlined">zoom_in</span>
          </button>
          <button type="button" aria-label="Capas" onClick={() => setPanelCapasAbierto((abierto) => !abierto)}>
            <span className="material-symbols-outlined">layers</span>
          </button>
        </div>
      </div>
      {panelCapasAbierto && (
        <div className="flex gap-4 border-b border-surface-stroke p-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={capas.codigos}
              onChange={(e) => onCapasChange({ ...capas, codigos: e.target.checked })}
            />
            Códigos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={capas.embarrado}
              onChange={(e) => onCapasChange({ ...capas, embarrado: e.target.checked })}
            />
            Embarrado
          </label>
        </div>
      )}
      <div className="blueprint-grid flex justify-center overflow-auto p-8">
        <EsquemaVisual
          tieneInterruptorPrincipal={tieneInterruptorPrincipal}
          secciones={secciones}
          zoom={zoom}
          capas={capas}
        />
      </div>
    </div>
  );
}
