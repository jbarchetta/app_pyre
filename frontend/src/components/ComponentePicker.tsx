import { useEffect, useRef, useState } from "react";
import { WrenchIcon } from "@heroicons/react/24/outline";
import { Modal } from "./common/Modal";
import {
  buscarCatalogo,
  obtenerOpcionesFiltro,
  type ComponenteBusqueda,
  type OpcionesFiltro,
  type TipoProteccion,
} from "../api/client";
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
    <Modal
      titulo={titulo}
      subtitulo="Selección de componentes del catálogo oficial ABB"
      icon={<WrenchIcon className="w-5 h-5 text-abb-red" />}
      onClose={onCancel}
      size="xl"
      footer={
        <button
          type="button"
          onClick={onCancel}
          className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold px-5 py-2 text-xs rounded-lg transition cursor-pointer"
        >
          Cerrar selección
        </button>
      }
    >
      {/* Pestañas: Estándar vs Otro */}
      <div className="flex border-b border-slate-200 mb-2">
        <button
          type="button"
          onClick={() => handleSwitchTab("estandar")}
          className={`py-2.5 px-4 text-xs uppercase font-bold tracking-wider border-b-2 transition cursor-pointer ${
            activeTab === "estandar"
              ? "border-abb-red text-abb-red bg-red-50/50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          Protecciones Estándar
        </button>
        <button
          type="button"
          onClick={() => handleSwitchTab("otro")}
          className={`py-2.5 px-4 text-xs uppercase font-bold tracking-wider border-b-2 transition cursor-pointer ${
            activeTab === "otro"
              ? "border-abb-red text-abb-red bg-red-50/50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          Otros (Fusibles / Seccionadores)
        </button>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          aria-label="Buscar código o descripción"
          placeholder="Buscar por código o descripción comercial ABB..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:ring-1 focus:ring-abb-red focus:border-abb-red focus:outline-none shadow-sm"
        />
        <button
          type="button"
          aria-expanded={filtrosAbiertos}
          onClick={() => setFiltrosAbiertos((actual) => !actual)}
          className="flex items-center gap-2 whitespace-nowrap border border-slate-300 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:border-abb-red hover:text-abb-red transition cursor-pointer"
        >
          <span aria-hidden="true">⚙</span> Filtros
        </button>
      </div>

      {filtrosAbiertos && (
        <div className="flex flex-wrap gap-4 border border-slate-200 bg-slate-50/70 rounded-lg p-4">
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
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Activos:</span>
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

      {resultados !== null && resultados.length === 0 && <p className="text-slate-500 italic p-4 text-center">Sin resultados encontrados</p>}
      {resultados !== null && resultados.length > 0 && (
        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg shadow-inner">
          <ul className="divide-y divide-slate-100">
            {resultados.map((componente) => (
              <li key={componente.id}>
                <button
                  type="button"
                  onClick={() => onSelect(componente)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-red-50/50 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-abb-red bg-red-50 px-2 py-0.5 rounded border border-red-100 group-hover:bg-abb-red group-hover:text-white transition">{componente.codigo}</span>
                    <span className="text-sm font-medium text-slate-800">{componente.descripcion}</span>
                  </div>
                  {componente.codigo_comercial && (
                    <span className="text-xs text-slate-400 font-mono">{componente.codigo_comercial}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-200 p-2.5 text-xs text-slate-500 bg-slate-50 font-medium text-center">
            Mostrando {resultados.length} de {total} resultados
          </p>
          {resultados.length < total && (
            <button
              type="button"
              onClick={handleCargarMas}
              disabled={cargandoMas}
              className="w-full border-t border-slate-200 p-2.5 text-xs font-bold uppercase tracking-wider text-abb-red hover:bg-red-50 disabled:opacity-50 transition cursor-pointer"
            >
              {cargandoMas ? "Cargando..." : "Cargar más resultados"}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
