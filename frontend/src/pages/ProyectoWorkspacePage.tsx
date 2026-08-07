import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import {
  actualizarTablero,
  crearTablero,
  eliminarTablero,
  listarTableros,
  obtenerProyecto,
  CATEGORIAS_INTERRUPTORES,
  fetchCurrentUser,
  type ComponenteBusqueda,
  type Proyecto,
  type Tablero,
  type Usuario,
} from "../api/client";
import { ComponentePicker } from "../components/ComponentePicker";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DetalleTablero } from "../components/DetalleTablero";
import { Modal } from "../components/common/Modal";
import {
  cargarEstadosVistaUsuario,
  guardarEstadosVistaUsuario,
  obtenerEstadoModo,
  DEFAULTS_POR_MODO,
  type ModoVisual,
  type ModoVisualState,
} from "../utils/vistaStorage";

// Icc estándar de arranque para no bloquear la creación del tablero — el
// analista lo puede editar desde el detalle del tablero si el estudio
// eléctrico del sitio da un valor distinto.
const NIVEL_FALLA_KA_POR_DEFECTO = "10";

export function ProyectoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tableros, setTableros] = useState<Tablero[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [nivelFallaKa, setNivelFallaKa] = useState(NIVEL_FALLA_KA_POR_DEFECTO);
  const [interruptorPrincipal, setInterruptorPrincipal] = useState<ComponenteBusqueda | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [modalNuevoTablero, setModalNuevoTablero] = useState(false);
  const [tableroEnEdicion, setTableroEnEdicion] = useState<Tablero | null>(null);
  const [nombreTableroEdit, setNombreTableroEdit] = useState("");
  const [tableroABorrar, setTableroABorrar] = useState<Tablero | null>(null);
  const [borrandoTablero, setBorrandoTablero] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const modalNuevoTableroRef = useRef(false);
  const tableroEnEdicionIdRef = useRef<string | null>(null);

  useEffect(() => {
    modalNuevoTableroRef.current = modalNuevoTablero;
  }, [modalNuevoTablero]);

  useEffect(() => {
    tableroEnEdicionIdRef.current = tableroEnEdicion ? tableroEnEdicion.id : null;
  }, [tableroEnEdicion]);

  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [estadosModos, setEstadosModos] = useState<Record<string, Record<ModoVisual, ModoVisualState>>>({});

  useEffect(() => {
    fetchCurrentUser().then((u) => {
      if (u) {
        setCurrentUser(u);
        setEstadosModos(cargarEstadosVistaUsuario(u.id));
      }
    });
  }, []);

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      const p = await obtenerProyecto(id);
      setProyecto(p);
      const list = await listarTableros(id);
      setTableros(list);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!modalNuevoTablero && !tableroEnEdicion) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") solicitarCierreModales();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modalNuevoTablero, tableroEnEdicion]);

  function handleSeleccionarTablero(tableroId: string) {
    setSearchParams({ tablero: tableroId });
  }

  function cerrarModales() {
    setModalNuevoTablero(false);
    modalNuevoTableroRef.current = false;
    setPickerAbierto(false);
    setTableroEnEdicion(null);
    tableroEnEdicionIdRef.current = null;
    setTableroABorrar(null);
    setNombre("");
    setNivelFallaKa(NIVEL_FALLA_KA_POR_DEFECTO);
    setInterruptorPrincipal(null);
    setError(null);
    triggerRef.current?.focus();
  }

  function solicitarCierreModales() {
    cerrarModales();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const tablero = await crearTablero(id, nombre, nivelFallaKa, interruptorPrincipal?.id ?? null);
      if (!modalNuevoTableroRef.current) return; // cancelado mientras el pedido estaba en curso
      setTableros((actuales) => [...(actuales ?? []), tablero]);
      cerrarModales();
      setSearchParams({ tablero: tablero.id });
    } catch (err) {
      if (!modalNuevoTableroRef.current) return;
      setError(err instanceof Error ? err.message : "No se pudo crear el tablero");
    }
  }

  async function handleRenombrarTablero(event: FormEvent) {
    event.preventDefault();
    if (!tableroEnEdicion) return;
    const idEditado = tableroEnEdicion.id;
    setError(null);
    try {
      const actualizado = await actualizarTablero(idEditado, { nombre: nombreTableroEdit });
      if (tableroEnEdicionIdRef.current !== idEditado) return; // cancelado o se inició otra edición
      setTableros((actuales) => (actuales ?? []).map((t) => (t.id === actualizado.id ? actualizado : t)));
      cerrarModales();
    } catch (err) {
      if (tableroEnEdicionIdRef.current !== idEditado) return;
      setError(err instanceof Error ? err.message : "No se pudo renombrar el tablero");
    }
  }

  async function handleConfirmarBorrarTablero() {
    if (!tableroABorrar) return;
    setBorrandoTablero(true);
    try {
      await eliminarTablero(tableroABorrar.id);
      const restantes = (tableros ?? []).filter((t) => t.id !== tableroABorrar.id);
      setTableros(restantes);
      if (tableroActivoId === tableroABorrar.id) {
        setSearchParams(restantes[0] ? { tablero: restantes[0].id } : {});
      }
      cerrarModales();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el tablero");
    } finally {
      setBorrandoTablero(false);
    }
  }

  if (!proyecto || tableros === null) return <p>Cargando...</p>;

  const tableroParamId = searchParams.get("tablero");
  const tableroActivoId = tableros.find((t) => t.id === tableroParamId)
    ? tableroParamId
    : (tableros[0]?.id ?? null);
  const tableroActivo = tableros.find((t) => t.id === tableroActivoId) ?? null;

  function obtenerVistaModo(tableroId: string, modo: ModoVisual): ModoVisualState {
    return obtenerEstadoModo(estadosModos, tableroId, modo);
  }

  function handleTableroActualizado(actualizado: Tablero) {
    setTableros((actuales) => (actuales ?? []).map((t) => (t.id === actualizado.id ? actualizado : t)));
  }

  function handleModoStateChange(
    tableroId: string,
    modo: ModoVisual,
    cambios: Partial<ModoVisualState>
  ) {
    setEstadosModos((actuales) => {
      const deTablero = actuales[tableroId] ?? {
        bloques: { ...DEFAULTS_POR_MODO.bloques },
        unifilar: { ...DEFAULTS_POR_MODO.unifilar },
        topografico: { ...DEFAULTS_POR_MODO.topografico },
      };
      const actualModo = deTablero[modo] ?? { ...DEFAULTS_POR_MODO[modo] };
      const nuevoModoState = { ...actualModo, ...cambios };

      const nuevosEstados = {
        ...actuales,
        [tableroId]: {
          ...deTablero,
          [modo]: nuevoModoState,
        },
      };

      guardarEstadosVistaUsuario(currentUser?.id, nuevosEstados);
      return nuevosEstados;
    });
  }

  return (
    <div className="space-y-2.5">
      {/* Header profesional: Botón volver + Título a la izquierda | Breadcrumb sobrio a la derecha */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line pb-2.5 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to="/proyectos"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink-muted shadow-control transition-colors hover:border-line-strong hover:bg-surface-sunken hover:text-ink"
            title="Volver a la lista de proyectos"
            aria-label="Volver a proyectos"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <h1 className="truncate text-lg font-bold tracking-tight text-ink">{proyecto.nombre}</h1>
        </div>

        {/* Breadcrumb a la derecha, pequeño y sobrio */}
        <nav aria-label="Ubicación actual" className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-muted">
          <Link to="/proyectos" className="transition-colors hover:text-brand hover:underline">
            Proyectos
          </Link>
          <span className="opacity-40">/</span>
          <span className="truncate max-w-[140px] font-medium text-ink-subtle">{proyecto.nombre}</span>
          {tableroActivo && (
            <>
              <span className="opacity-40">/</span>
              <span className="dato-tecnico font-bold text-brand">{tableroActivo.nombre}</span>
            </>
          )}
        </nav>
      </div>

      {/* Tabs list of tableros */}
      <div className="flex flex-wrap items-center justify-between border-b border-line pb-1.5 gap-2">
        <div role="tablist" aria-label="Tableros del proyecto" className="flex flex-wrap items-center gap-2">
          {tableros.map((t) => {
            const isActivo = t.id === tableroActivoId;
            return (
              <div key={t.id} className="group relative flex items-center">
                <button
                  role="tab"
                  aria-selected={isActivo}
                  onClick={() => handleSeleccionarTablero(t.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition flex items-center gap-2 border-t border-x ${
                    isActivo
                      ? "bg-white text-abb-red shadow-sm border-surface-stroke font-bold"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-transparent"
                  }`}
                >
                  {t.nombre}
                </button>
                <button
                  type="button"
                  title="Editar nombre"
                  aria-label={isActivo ? "Renombrar tablero activo" : `Editar ${t.nombre}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTableroEnEdicion(t);
                    setNombreTableroEdit(t.nombre);
                  }}
                  className="hidden group-hover:block p-1 text-gray-400 hover:text-gray-700 absolute right-6 top-2 z-10"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Eliminar tablero"
                  aria-label={isActivo ? "Borrar tablero activo" : `Eliminar ${t.nombre}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTableroABorrar(t);
                  }}
                  className="hidden group-hover:block p-1 text-gray-400 hover:text-red-600 absolute right-1 top-2 z-10"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            aria-label="Nuevo tablero"
            onClick={() => {
              setModalNuevoTablero(true);
            }}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-abb-red hover:bg-gray-100 rounded-t-lg transition flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Nuevo Tablero</span>
          </button>
        </div>
      </div>

      {tableros.length === 0 || !tableroActivo ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Este proyecto aún no tiene tableros</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
              Comenzá agregando el primer tablero eléctrico (ej. Tablero General TG1) para cargar sus secciones, salidas y componentes.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              setModalNuevoTablero(true);
            }}
            className="inline-flex items-center gap-2 bg-abb-red hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg shadow-md transition transform hover:-translate-y-0.5"
          >
            <PlusIcon className="w-5 h-5" />
            Crear mi primer tablero
          </button>
        </div>
      ) : (
        <DetalleTablero
          key={tableroActivo.id}
          tablero={tableroActivo}
          onTableroActualizado={handleTableroActualizado}
          obtenerVistaModo={(modo) => obtenerVistaModo(tableroActivo.id, modo)}
          onModoStateChange={(modo, cambios) => handleModoStateChange(tableroActivo.id, modo, cambios)}
        />
      )}

      {modalNuevoTablero && !pickerAbierto && (
        <Modal
          titulo="Nuevo tablero"
          subtitulo="Configuración de parámetros y cabecera eléctrica"
          icon={<CpuChipIcon className="w-5 h-5 text-abb-red" />}
          onClose={cerrarModales}
          error={error}
          size="md"
          footer={
            <>
              <button
                type="submit"
                form="form-nuevo-tablero"
                className="bg-abb-red hover:bg-red-700 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg transition cursor-pointer"
              >
                Crear tablero
              </button>
              <button
                type="button"
                onClick={cerrarModales}
                className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold px-4 py-2 text-xs rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
            </>
          }
        >
          <form id="form-nuevo-tablero" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="nombre-tablero" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Nombre del tablero *
              </label>
              <input
                id="nombre-tablero"
                autoFocus
                placeholder="Ej. Tablero General de Baja Tensión"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full text-sm border border-slate-300 rounded-lg px-3.5 py-2 focus:ring-1 focus:ring-abb-red focus:border-abb-red focus:outline-none shadow-sm"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="nivel-falla" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Nivel de falla / Cortocircuito (kA) *
              </label>
              <input
                id="nivel-falla"
                value={nivelFallaKa}
                onChange={(e) => setNivelFallaKa(e.target.value)}
                required
                className="w-full text-sm font-mono font-bold border border-slate-300 rounded-lg px-3.5 py-2 focus:ring-1 focus:ring-abb-red focus:border-abb-red focus:outline-none shadow-sm"
              />
            </div>

            <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-700 block">Interruptor Principal (Q1):</span>
                <span className={interruptorPrincipal ? "font-mono font-bold text-abb-red block mt-0.5 text-sm" : "text-slate-500 italic block mt-0.5"}>
                  {interruptorPrincipal ? `${interruptorPrincipal.codigo} (${interruptorPrincipal.descripcion || ""})` : "Sin interruptor asignado (Opcional)"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPickerAbierto(true)}
                className="border border-slate-300 bg-white hover:border-abb-red hover:text-abb-red px-3 py-1.5 text-xs font-bold rounded-lg uppercase tracking-wider transition shadow-xs shrink-0 cursor-pointer"
              >
                Elegir
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalNuevoTablero && pickerAbierto && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="interruptor-principal"
          titulo="Interruptor principal"
          onSelect={(componente) => {
            setInterruptorPrincipal(componente);
            setPickerAbierto(false);
          }}
          onCancel={() => setPickerAbierto(false)}
        />
      )}

      {tableroEnEdicion && (
        <Modal
          titulo="Renombrar tablero"
          subtitulo="Modificación del identificador de tablero"
          icon={<PencilIcon className="w-5 h-5 text-abb-red" />}
          onClose={solicitarCierreModales}
          error={error}
          size="sm"
          footer={
            <>
              <button
                type="submit"
                form="form-renombrar-tablero"
                className="bg-abb-red hover:bg-red-700 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg transition cursor-pointer"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={solicitarCierreModales}
                className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold px-4 py-2 text-xs rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
            </>
          }
        >
          <form id="form-renombrar-tablero" onSubmit={handleRenombrarTablero} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="nombre-tablero-edit" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Nombre del tablero
              </label>
              <input
                id="nombre-tablero-edit"
                autoFocus
                value={nombreTableroEdit}
                onChange={(e) => setNombreTableroEdit(e.target.value)}
                required
                className="w-full text-sm border border-slate-300 rounded-lg px-3.5 py-2 focus:ring-1 focus:ring-abb-red focus:border-abb-red focus:outline-none shadow-sm"
              />
            </div>
          </form>
        </Modal>
      )}


      {tableroABorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={`Esto va a borrar el tablero "${tableroABorrar.nombre}" y todas sus filas y elementos.`}
          confirmando={borrandoTablero}
          error={error}
          onConfirm={handleConfirmarBorrarTablero}
          onCancel={cerrarModales}
        />
      )}
    </div>
  );
}
