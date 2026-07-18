import { useEffect, useRef, useState } from "react";
import { buscarCatalogo, type ComponenteBusqueda } from "../api/client";

const RESULTADOS_POR_PAGINA = 20;

interface ComponentePickerProps {
  categorias: string[];
  onSelect: (componente: ComponenteBusqueda) => void;
  onCancel: () => void;
  titulo?: string;
}

export function ComponentePicker({
  categorias,
  onSelect,
  onCancel,
  titulo = "Buscar componente",
}: ComponentePickerProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ComponenteBusqueda[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const solicitudActualRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  async function handleChange(value: string) {
    setQuery(value);
    const idSolicitud = ++solicitudActualRef.current;
    if (value.trim().length < 2) {
      setResultados(null);
      setTotal(0);
      return;
    }
    const respuesta = await buscarCatalogo(value, { limit: RESULTADOS_POR_PAGINA, offset: 0, categorias });
    if (idSolicitud !== solicitudActualRef.current) return;
    setResultados(respuesta.resultados);
    setTotal(respuesta.total);
  }

  async function handleCargarMas() {
    if (resultados === null || cargandoMas) return;
    const idSolicitud = ++solicitudActualRef.current;
    setCargandoMas(true);
    try {
      const respuesta = await buscarCatalogo(query, {
        limit: RESULTADOS_POR_PAGINA,
        offset: resultados.length,
        categorias,
      });
      if (idSolicitud !== solicitudActualRef.current) return;
      setResultados((actuales) => [...(actuales ?? []), ...respuesta.resultados]);
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-picker-titulo"
        className="flex w-[700px] max-w-full flex-col gap-2 border border-surface-stroke bg-white p-8"
      >
        <h2 id="component-picker-titulo" className="text-lg font-bold">
          {titulo}
        </h2>
        <input
          ref={inputRef}
          aria-label="Buscar código o descripción"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full border border-surface-stroke p-2"
        />
        {resultados !== null && resultados.length === 0 && <p className="text-secondary">sin resultados</p>}
        {resultados !== null && resultados.length > 0 && (
          <div className="max-h-96 overflow-y-auto border border-surface-stroke">
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
                disabled={cargandoMas}
                className="w-full border-t border-surface-stroke p-2 text-sm uppercase tracking-widest text-abb-red hover:bg-industrial-gray disabled:opacity-50"
              >
                {cargandoMas ? "Cargando..." : "Cargar más"}
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 self-start border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
