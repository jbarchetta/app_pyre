import { useState } from "react";
import { buscarCatalogo, type ComponenteBusqueda } from "../api/client";

const RESULTADOS_POR_PAGINA = 20;

interface ComponentePickerProps {
  onSelect: (componente: ComponenteBusqueda) => void;
}

export function ComponentePicker({ onSelect }: ComponentePickerProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ComponenteBusqueda[] | null>(null);
  const [total, setTotal] = useState(0);

  async function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResultados(null);
      setTotal(0);
      return;
    }
    const respuesta = await buscarCatalogo(value, { limit: RESULTADOS_POR_PAGINA, offset: 0 });
    setResultados(respuesta.resultados);
    setTotal(respuesta.total);
  }

  async function handleCargarMas() {
    if (resultados === null) return;
    const respuesta = await buscarCatalogo(query, { limit: RESULTADOS_POR_PAGINA, offset: resultados.length });
    setResultados((actuales) => [...(actuales ?? []), ...respuesta.resultados]);
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
        <div className="absolute z-10 w-full border border-t-0 border-surface-stroke bg-white">
          <ul>
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
          <p className="border-t border-surface-stroke p-2 text-xs text-secondary">
            Mostrando {resultados.length} de {total} resultados
          </p>
          {resultados.length < total && (
            <button
              type="button"
              onClick={handleCargarMas}
              className="w-full border-t border-surface-stroke p-2 text-sm uppercase tracking-widest text-abb-red hover:bg-industrial-gray"
            >
              Cargar más
            </button>
          )}
        </div>
      )}
    </div>
  );
}
