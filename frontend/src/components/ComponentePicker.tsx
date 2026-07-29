import { useEffect, useRef, useState } from "react";
import {
  buscarCatalogo,
  obtenerOpcionesFiltro,
  type ComponenteBusqueda,
  type OpcionesFiltro,
  type TipoProteccion,
} from "../api/client";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";
import { guardarMemoria, obtenerMemoria, type MemoriaBusqueda } from "./componentePickerMemoria";

const RESULTADOS_POR_PAGINA = 20;

interface ComponentePickerProps {
  categorias: string[];
  contextKey: string;
  onSelect: (componente: ComponenteBusqueda) => void;
  onCancel: () => void;
  titulo?: string;
  tipoProteccion?: TipoProteccion;
  sensibilidadMa?: number | null;
  admiteAccesorios?: boolean | null;
}

interface FiltroOptionObj {
  value: number | string;
  label: string;
}

interface FiltroSelectProps {
  id: string;
  label: string;
  value: number | string;
  options: (number | string | FiltroOptionObj)[];
  unidad?: string;
  onChange: (value: string) => void;
}

function FiltroSelect({ id, label, value, options, unidad, onChange }: FiltroSelectProps) {
  return (
    <div className="min-w-[110px] flex-1">
      <label htmlFor={id} className="mb-1 block text-[10px] uppercase tracking-widest text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-surface-stroke bg-white p-2 text-sm"
      >
        <option value="">Todos</option>
        {options.map((opcion) => {
          if (typeof opcion === "object" && opcion !== null) {
            return (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            );
          }
          return (
            <option key={opcion} value={opcion}>
              {opcion}
              {unidad ?? ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

interface FiltroChipProps {
  label: string;
  onRemove: () => void;
}

function FiltroChip({ label, onRemove }: FiltroChipProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="border border-abb-red px-2 py-1 text-xs uppercase tracking-widest text-abb-red"
    >
      {label} ✕
    </button>
  );
}

export function ComponentePicker({
  categorias,
  contextKey,
  onSelect,
  onCancel,
  titulo = "Buscar componente",
  tipoProteccion,
  sensibilidadMa,
  admiteAccesorios,
}: ComponentePickerProps) {
  const memoriaInicial = obtenerMemoria(contextKey);
  
  const initialTipo = tipoProteccion !== undefined ? (tipoProteccion ?? null) : (memoriaInicial?.filtroTipo ?? null);
  const isSameTipo = (memoriaInicial?.filtroTipo || null) === (initialTipo || null);
  const initialQuery = (memoriaInicial && isSameTipo) ? (memoriaInicial.query ?? "") : "";

  const [activeTab, setActiveTab] = useState<"estandar" | "otro">("estandar");
  const categoriasBusqueda = activeTab === "estandar" ? categorias : ["Fusibles y seccionadores bajo carga", "Terminales", "Bandejas", "Canalizaciones"];

  const [query, setQuery] = useState(initialQuery);
  const [resultados, setResultados] = useState<ComponenteBusqueda[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(Boolean(tipoProteccion));
  const [opciones, setOpciones] = useState<OpcionesFiltro | null>(null);

  const [filtroTipo, setFiltroTipo] = useState<string | null>(initialTipo);
  const [filtroPolos, setFiltroPolos] = useState<number | null>(
    (memoriaInicial && isSameTipo) ? memoriaInicial.filtroPolos : null
  );
  const [filtroCorriente, setFiltroCorriente] = useState<string | null>(
    (memoriaInicial && isSameTipo) ? memoriaInicial.filtroCorriente : null
  );
  const [filtroCapacidad, setFiltroCapacidad] = useState<string | null>(
    (memoriaInicial && isSameTipo) ? memoriaInicial.filtroCapacidad : null
  );
  const [filtroSensibilidad, setFiltroSensibilidad] = useState<number | null>(
    sensibilidadMa !== undefined ? (sensibilidadMa ?? null) : (memoriaInicial?.filtroSensibilidad ?? null)
  );
  const [filtroAccesorios, setFiltroAccesorios] = useState<boolean | null>(
    admiteAccesorios !== undefined ? (admiteAccesorios ?? null) : (memoriaInicial?.filtroAccesorios ?? null)
  );

  function handleSwitchTab(tab: "estandar" | "otro") {
    setActiveTab(tab);
    setQuery("");
    setResultados(null);
    setTotal(0);
    setFiltroTipo(null);
    setFiltroPolos(null);
    setFiltroCorriente(null);
    setFiltroCapacidad(null);
    setFiltroSensibilidad(null);
    setFiltroAccesorios(null);
  }

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
    obtenerOpcionesFiltro(categoriasBusqueda, filtroTipo ?? undefined).then(setOpciones).catch(() => {});
    buscar(query, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, activeTab]);

  useEffect(() => {
    const valor: MemoriaBusqueda = {
      query,
      filtroTipo,
      filtroPolos,
      filtroCorriente,
      filtroCapacidad,
      filtroSensibilidad,
      filtroAccesorios,
    };
    guardarMemoria(contextKey, valor);
  }, [contextKey, query, filtroTipo, filtroPolos, filtroCorriente, filtroCapacidad, filtroSensibilidad, filtroAccesorios]);

  interface FiltrosOverride {
    tipo?: string | null;
    polos?: number | null;
    corriente?: string | null;
    capacidad?: string | null;
    sensibilidad?: number | null;
    accesorios?: boolean | null;
  }

  function filtrosActivos(overrides?: FiltrosOverride) {
    const tipo = overrides && "tipo" in overrides ? overrides.tipo : filtroTipo;
    const polos = overrides && "polos" in overrides ? overrides.polos : filtroPolos;
    const corriente = overrides && "corriente" in overrides ? overrides.corriente : filtroCorriente;
    const capacidad = overrides && "capacidad" in overrides ? overrides.capacidad : filtroCapacidad;
    const sensibilidad = overrides && "sensibilidad" in overrides ? overrides.sensibilidad : filtroSensibilidad;
    const accesorios = overrides && "accesorios" in overrides ? overrides.accesorios : filtroAccesorios;

    return {
      solo_con_atributos: true as const,
      ...(tipo ? { tipo } : {}),
      ...(polos !== null && polos !== undefined ? { polos } : {}),
      ...(corriente !== null && corriente !== undefined ? { corriente_nominal_a: corriente } : {}),
      ...(capacidad !== null && capacidad !== undefined ? { capacidad_corte_ka: capacidad } : {}),
      ...(sensibilidad !== null && sensibilidad !== undefined ? { sensibilidad_ma: sensibilidad } : {}),
      ...(accesorios !== null && accesorios !== undefined ? { admite_accesorios: accesorios } : {}),
    };
  }

  async function buscar(valor: string, desde: number, overrides?: FiltrosOverride) {
    const idSolicitud = ++solicitudActualRef.current;
    const queryLimpia = valor.trim();

    if (queryLimpia.length === 1) {
      return;
    }

    const filtros = filtrosActivos(overrides);
    const hayCriterios =
      categoriasBusqueda.length > 0 ||
      filtros.tipo !== undefined ||
      filtros.polos !== undefined ||
      filtros.corriente_nominal_a !== undefined ||
      filtros.capacidad_corte_ka !== undefined ||
      filtros.sensibilidad_ma !== undefined ||
      filtros.admite_accesorios !== undefined;

    if (queryLimpia.length < 2 && !hayCriterios) {
      setResultados(null);
      setTotal(0);
      return;
    }

    const respuesta = await buscarCatalogo(valor, {
      limit: RESULTADOS_POR_PAGINA,
      offset: desde,
      categorias: categoriasBusqueda,
      ...filtros,
    });
    if (idSolicitud !== solicitudActualRef.current) return;

    const resultadosNuevos = respuesta?.resultados ?? [];
    const totalNuevo = respuesta?.total ?? 0;

    if (desde === 0) {
      setResultados(resultadosNuevos);
    } else {
      setResultados((actuales) => [...(actuales ?? []), ...resultadosNuevos]);
    }
    setTotal(totalNuevo);
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

  function handleFiltroChange(actualizar: () => void, overrides: FiltrosOverride) {
    actualizar();
    buscar(query, 0, overrides);
  }

  const esDiferencial = filtroTipo === "seccional_diferencial";

  // Opciones de polos con etiquetas descriptivas
  const polosOpciones: FiltroOptionObj[] = (opciones?.polos ?? [])
    .filter((p) => (!esDiferencial || p === 2 || p === 4))
    .map((p) => {
      let label = `${p} polos`;
      if (p === 1) label = "1P (Unipolar)";
      if (p === 2) label = "2P (Bipolar)";
      if (p === 3) label = "3P (Tripolar)";
      if (p === 4) label = "4P (Tetrapolar)";
      return { value: p, label };
    });

  const hayFiltrosActivos =
    filtroTipo !== null ||
    filtroPolos !== null ||
    filtroCorriente !== null ||
    filtroCapacidad !== null ||
    filtroSensibilidad !== null ||
    filtroAccesorios !== null;

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
        <h2 id="component-picker-titulo" className="text-lg font-bold text-gray-900">
          {titulo}
        </h2>

        {/* Pestañas: Estándar vs Otro */}
        <div className="flex border-b border-gray-200 mb-2">
          <button
            type="button"
            onClick={() => handleSwitchTab("estandar")}
            className={`py-2 px-4 text-xs uppercase font-bold tracking-wider border-b-2 transition ${
              activeTab === "estandar"
                ? "border-abb-red text-abb-red bg-red-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Protecciones Estándar
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab("otro")}
            className={`py-2 px-4 text-xs uppercase font-bold tracking-wider border-b-2 transition ${
              activeTab === "otro"
                ? "border-abb-red text-abb-red bg-red-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            Otros (Fusibles / Seccionadores)
          </button>
        </div>

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
            <FiltroSelect
              id="filtro-tipo"
              label="Tipo de Protección"
              value={filtroTipo ?? ""}
              options={[
                { value: "seccional_termomagnetico", label: "Termomagnético" },
                { value: "seccional_diferencial", label: "Diferencial" },
              ]}
              onChange={(value) => {
                const valor = value || null;
                handleFiltroChange(() => setFiltroTipo(valor), { tipo: valor });
              }}
            />
            <FiltroSelect
              id="filtro-polos"
              label={esDiferencial ? "Tamaño (Polos)" : "Polos"}
              value={filtroPolos ?? ""}
              options={polosOpciones}
              onChange={(value) => {
                const valor = value ? Number(value) : null;
                handleFiltroChange(() => setFiltroPolos(valor), { polos: valor });
              }}
            />

            {esDiferencial && (
              <FiltroSelect
                id="filtro-sensibilidad"
                label="Sensibilidad (IΔn)"
                value={filtroSensibilidad ?? ""}
                options={(opciones?.sensabilidades_ma ?? opciones?.sensibilidades_ma ?? []).map((s: number) => ({
                  value: s,
                  label: `${s} mA`,
                }))}
                onChange={(value) => {
                  const valor = value ? Number(value) : null;
                  handleFiltroChange(() => setFiltroSensibilidad(valor), { sensibilidad: valor });
                }}
              />
            )}

            <FiltroSelect
              id="filtro-corriente"
              label="Corriente (In)"
              value={filtroCorriente ?? ""}
              options={opciones?.corrientes_nominales_a ?? []}
              unidad="A"
              onChange={(value) => {
                const valor = value || null;
                handleFiltroChange(() => setFiltroCorriente(valor), { corriente: valor });
              }}
            />

            {!esDiferencial && (
              <FiltroSelect
                id="filtro-capacidad"
                label="Capacidad de corte"
                value={filtroCapacidad ?? ""}
                options={opciones?.capacidades_corte_ka ?? []}
                unidad="kA"
                onChange={(value) => {
                  const valor = value || null;
                  handleFiltroChange(() => setFiltroCapacidad(valor), { capacidad: valor });
                }}
              />
            )}

            <FiltroSelect
              id="filtro-accesorios"
              label="Accesorios"
              value={filtroAccesorios === null ? "" : String(filtroAccesorios)}
              options={[
                { value: "true", label: "Con accesorios" },
                { value: "false", label: "Sin accesorios" },
              ]}
              onChange={(value) => {
                const valor = value === "" ? null : value === "true";
                handleFiltroChange(() => setFiltroAccesorios(valor), { accesorios: valor });
              }}
            />
          </div>
        )}

        {hayFiltrosActivos && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-secondary">Activos:</span>
            {filtroTipo !== null && (
              <FiltroChip
                label={filtroTipo === "seccional_diferencial" ? "Diferencial" : "Termomagnético"}
                onRemove={() => handleFiltroChange(() => setFiltroTipo(null), { tipo: null })}
              />
            )}
            {filtroPolos !== null && (
              <FiltroChip
                label={filtroPolos === 2 ? "2P (Bipolar)" : filtroPolos === 4 ? "4P (Tetrapolar)" : `${filtroPolos} polos`}
                onRemove={() => handleFiltroChange(() => setFiltroPolos(null), { polos: null })}
              />
            )}
            {filtroSensibilidad !== null && (
              <FiltroChip
                label={`Sens: ${filtroSensibilidad}mA`}
                onRemove={() => handleFiltroChange(() => setFiltroSensibilidad(null), { sensibilidad: null })}
              />
            )}
            {filtroCorriente !== null && (
              <FiltroChip
                label={`${filtroCorriente}A`}
                onRemove={() => handleFiltroChange(() => setFiltroCorriente(null), { corriente: null })}
              />
            )}
            {filtroCapacidad !== null && (
              <FiltroChip
                label={`${filtroCapacidad}kA`}
                onRemove={() => handleFiltroChange(() => setFiltroCapacidad(null), { capacidad: null })}
              />
            )}
            {filtroAccesorios !== null && (
              <FiltroChip
                label={filtroAccesorios ? "Con accesorios" : "Sin accesorios"}
                onRemove={() => handleFiltroChange(() => setFiltroAccesorios(null), { accesorios: null })}
              />
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
