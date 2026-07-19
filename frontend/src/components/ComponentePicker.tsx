import { useEffect, useRef, useState } from "react";
import { buscarCatalogo, obtenerOpcionesFiltro, type ComponenteBusqueda, type OpcionesFiltro } from "../api/client";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";

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
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [opciones, setOpciones] = useState<OpcionesFiltro | null>(null);
  const [filtroPolos, setFiltroPolos] = useState<number | null>(null);
  const [filtroCorriente, setFiltroCorriente] = useState<string | null>(null);
  const [filtroCapacidad, setFiltroCapacidad] = useState<string | null>(null);
  const solicitudActualRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { onMouseDown, onClick } = useCerrarAlClickFuera(onCancel);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    obtenerOpcionesFiltro(categorias).then(setOpciones);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  interface FiltrosOverride {
    polos?: number | null;
    corriente?: string | null;
    capacidad?: string | null;
  }

  function filtrosActivos(overrides?: FiltrosOverride) {
    const polos = overrides && "polos" in overrides ? overrides.polos : filtroPolos;
    const corriente = overrides && "corriente" in overrides ? overrides.corriente : filtroCorriente;
    const capacidad = overrides && "capacidad" in overrides ? overrides.capacidad : filtroCapacidad;
    return {
      solo_con_atributos: true as const,
      ...(polos !== null && polos !== undefined ? { polos } : {}),
      ...(corriente !== null && corriente !== undefined ? { corriente_nominal_a: corriente } : {}),
      ...(capacidad !== null && capacidad !== undefined ? { capacidad_corte_ka: capacidad } : {}),
    };
  }

  async function buscar(valor: string, desde: number, overrides?: FiltrosOverride) {
    const idSolicitud = ++solicitudActualRef.current;
    if (valor.trim().length < 2) {
      setResultados(null);
      setTotal(0);
      return;
    }
    const respuesta = await buscarCatalogo(valor, {
      limit: RESULTADOS_POR_PAGINA,
      offset: desde,
      categorias,
      ...filtrosActivos(overrides),
    });
    if (idSolicitud !== solicitudActualRef.current) return;
    if (desde === 0) {
      setResultados(respuesta.resultados);
    } else {
      setResultados((actuales) => [...(actuales ?? []), ...respuesta.resultados]);
    }
    setTotal(respuesta.total);
  }

  async function handleChange(value: string) {
    setQuery(value);
    await buscar(value, 0);
  }

  async function handleCargarMas() {
    if (resultados === null || cargandoMas) return;
    setCargandoMas(true);
    try {
      await buscar(query, resultados.length);
    } finally {
      setCargandoMas(false);
    }
  }

  // El setter de estado (`actualizar`) es asincrónico: si `buscar` leyera el
  // filtro desde el estado del componente inmediatamente después de llamarlo,
  // todavía vería el valor viejo (closure de este render). Por eso el valor
  // nuevo también se pasa explícito como override para la búsqueda inmediata.
  function handleFiltroChange(actualizar: () => void, overrides: FiltrosOverride) {
    actualizar();
    if (query.trim().length >= 2) buscar(query, 0, overrides);
  }

  const hayFiltrosActivos = filtroPolos !== null || filtroCorriente !== null || filtroCapacidad !== null;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40"
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-picker-titulo"
        className="flex w-[700px] max-w-full flex-col gap-3 border border-surface-stroke bg-white p-8"
      >
        <h2 id="component-picker-titulo" className="text-lg font-bold">
          {titulo}
        </h2>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            aria-label="Buscar código o descripción"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className="flex-1 border border-surface-stroke p-2"
          />
          <button
            type="button"
            aria-expanded={filtrosAbiertos}
            onClick={() => setFiltrosAbiertos((actual) => !actual)}
            className="flex items-center gap-2 whitespace-nowrap border border-surface-stroke px-4 py-2 text-xs uppercase tracking-widest text-secondary hover:border-abb-red hover:text-abb-red"
          >
            <span aria-hidden="true">⚙</span> Filtros
          </button>
        </div>

        {filtrosAbiertos && (
          <div className="flex flex-wrap gap-5 border border-surface-stroke bg-industrial-gray p-4">
            <div className="min-w-[110px] flex-1">
              <label htmlFor="filtro-polos" className="mb-1 block text-[10px] uppercase tracking-widest text-secondary">
                Polos
              </label>
              <select
                id="filtro-polos"
                value={filtroPolos ?? ""}
                onChange={(e) => {
                  const valor = e.target.value ? Number(e.target.value) : null;
                  handleFiltroChange(() => setFiltroPolos(valor), { polos: valor });
                }}
                className="w-full border border-surface-stroke bg-white p-2 text-sm"
              >
                <option value="">Todos</option>
                {(opciones?.polos ?? []).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[110px] flex-1">
              <label
                htmlFor="filtro-corriente"
                className="mb-1 block text-[10px] uppercase tracking-widest text-secondary"
              >
                Corriente (In)
              </label>
              <select
                id="filtro-corriente"
                value={filtroCorriente ?? ""}
                onChange={(e) => {
                  const valor = e.target.value || null;
                  handleFiltroChange(() => setFiltroCorriente(valor), { corriente: valor });
                }}
                className="w-full border border-surface-stroke bg-white p-2 text-sm"
              >
                <option value="">Todos</option>
                {(opciones?.corrientes_nominales_a ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}A
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[110px] flex-1">
              <label
                htmlFor="filtro-capacidad"
                className="mb-1 block text-[10px] uppercase tracking-widest text-secondary"
              >
                Capacidad de corte
              </label>
              <select
                id="filtro-capacidad"
                value={filtroCapacidad ?? ""}
                onChange={(e) => {
                  const valor = e.target.value || null;
                  handleFiltroChange(() => setFiltroCapacidad(valor), { capacidad: valor });
                }}
                className="w-full border border-surface-stroke bg-white p-2 text-sm"
              >
                <option value="">Todos</option>
                {(opciones?.capacidades_corte_ka ?? []).map((k) => (
                  <option key={k} value={k}>
                    {k}kA
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {hayFiltrosActivos && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-secondary">Activos:</span>
            {filtroPolos !== null && (
              <button
                type="button"
                onClick={() => handleFiltroChange(() => setFiltroPolos(null), { polos: null })}
                className="border border-abb-red px-2 py-1 text-xs uppercase tracking-widest text-abb-red"
              >
                {filtroPolos} polos ✕
              </button>
            )}
            {filtroCorriente !== null && (
              <button
                type="button"
                onClick={() => handleFiltroChange(() => setFiltroCorriente(null), { corriente: null })}
                className="border border-abb-red px-2 py-1 text-xs uppercase tracking-widest text-abb-red"
              >
                {filtroCorriente}A ✕
              </button>
            )}
            {filtroCapacidad !== null && (
              <button
                type="button"
                onClick={() => handleFiltroChange(() => setFiltroCapacidad(null), { capacidad: null })}
                className="border border-abb-red px-2 py-1 text-xs uppercase tracking-widest text-abb-red"
              >
                {filtroCapacidad}kA ✕
              </button>
            )}
          </div>
        )}

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
          className="mt-1 self-start border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
