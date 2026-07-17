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
    <div>
      <input aria-label="Buscar código o descripción" value={query} onChange={(e) => handleChange(e.target.value)} />
      {resultados !== null && resultados.length === 0 && <p>sin resultados</p>}
      {resultados !== null && (
        <ul>
          {resultados.map((componente) => (
            <li key={componente.id}>
              <button type="button" onClick={() => onSelect(componente)}>
                {componente.codigo} — {componente.descripcion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
