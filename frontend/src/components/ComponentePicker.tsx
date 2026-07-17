import { useState } from "react";
import { buscarCatalogo, type ComponenteBusqueda } from "../api/client";

interface ComponentePickerProps {
  onSelect: (componente: ComponenteBusqueda) => void;
}

export function ComponentePicker({ onSelect }: ComponentePickerProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ComponenteBusqueda[] | null>(null);

  async function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResultados(null);
      return;
    }
    const encontrados = await buscarCatalogo(value);
    setResultados(encontrados);
  }

  return (
    <div className="relative">
      <input
        aria-label="Buscar código o descripción"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full border border-surface-stroke p-2"
      />
      {resultados !== null && resultados.length === 0 && <p className="text-secondary">sin resultados</p>}
      {resultados !== null && resultados.length > 0 && (
        <ul className="absolute z-10 w-full border border-t-0 border-surface-stroke bg-white">
          {resultados.map((componente) => (
            <li key={componente.id}>
              <button
                type="button"
                onClick={() => onSelect(componente)}
                className="flex w-full items-center gap-2 p-2 text-left hover:bg-industrial-gray"
              >
                <span className="font-mono text-sm">{componente.codigo}</span>
                <span className="text-secondary">— {componente.descripcion}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
