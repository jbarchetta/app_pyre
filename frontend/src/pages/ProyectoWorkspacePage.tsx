import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
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
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";
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

  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(solicitarCierreModales);

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
    <div className="space-y-4">
      {/* Header and Return Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-surface-stroke pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link to="/proyectos" className="hover:text-abb-red hover:underline">
              Proyectos
            </Link>
            <span>/</span>
            <span className="font-medium text-gray-800">{proyecto.nombre}</span>
            {tableroActivo && (
              <>
                <span>/</span>
                <span className="font-mono font-bold text-abb-red">{tableroActivo.nombre}</span>
              </>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{proyecto.nombre}</h1>
        </div>

        <Link
          to="/proyectos"
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Volver a Proyectos
        </Link>
      </div>

      {/* Tabs list of tableros */}
      <div className="flex flex-wrap items-center justify-between border-b border-surface-stroke pb-2 gap-2">
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
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onMouseDown={onMouseDownModal} onClick={onClickModal}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuevo-tablero-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="nuevo-tablero-titulo" className="text-lg font-bold">Nuevo tablero</h2>
            <label htmlFor="nombre-tablero">Nombre</label>
            <input id="nombre-tablero" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label htmlFor="nivel-falla">Nivel de falla (kA)</label>
            <input id="nivel-falla" value={nivelFallaKa} onChange={(e) => setNivelFallaKa(e.target.value)} />
            <p>Interruptor principal{interruptorPrincipal ? `: ${interruptorPrincipal.codigo}` : " (opcional)"}</p>
            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              className="self-start border border-surface-stroke px-4 py-2 text-sm uppercase tracking-widest hover:border-abb-red hover:text-abb-red"
            >
              Elegir interruptor principal
            </button>
            {error && <p role="alert" className="text-error">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Crear tablero
              </button>
              <button type="button" onClick={cerrarModales} className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
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
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onMouseDown={onMouseDownModal} onClick={onClickModal}>
          <form
            onSubmit={handleRenombrarTablero}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-tablero-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="editar-tablero-titulo" className="text-lg font-bold">Renombrar tablero</h2>
            <label htmlFor="nombre-tablero-edit">Nombre</label>
            <input
              id="nombre-tablero-edit"
              autoFocus
              value={nombreTableroEdit}
              onChange={(e) => setNombreTableroEdit(e.target.value)}
            />
            {error && <p role="alert" className="text-error">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button type="button" onClick={solicitarCierreModales} className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
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
