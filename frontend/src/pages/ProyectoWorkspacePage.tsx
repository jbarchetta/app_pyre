import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  actualizarTablero,
  crearTablero,
  eliminarTablero,
  listarTableros,
  obtenerProyecto,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type Proyecto,
  type Tablero,
} from "../api/client";
import { ComponentePicker } from "../components/ComponentePicker";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DetalleTablero } from "../components/DetalleTablero";
import type { Capas } from "../components/EsquemaVisual";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";

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

  const VISTA_POR_DEFECTO: { zoom: number; capas: Capas } = { zoom: 1, capas: { codigos: true, embarrado: true } };
  const [vistaEstado, setVistaEstado] = useState<Record<string, { zoom: number; capas: Capas }>>({});

  useEffect(() => {
    if (!id) return;
    obtenerProyecto(id)
      .then(setProyecto)
      .catch(() => setError("No se pudo cargar el proyecto"));
    listarTableros(id)
      .then(setTableros)
      .catch(() => setError("No se pudieron cargar los tableros"));
  }, [id]);

  useEffect(() => {
    if (!modalNuevoTablero && !tableroEnEdicion) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModales();
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

  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarModales);

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

  function obtenerVista(tableroId: string) {
    return vistaEstado[tableroId] ?? VISTA_POR_DEFECTO;
  }

  function handleTableroActualizado(actualizado: Tablero) {
    setTableros((actuales) => (actuales ?? []).map((t) => (t.id === actualizado.id ? actualizado : t)));
  }

  function handleZoomChange(tableroId: string, zoom: number) {
    setVistaEstado((actual) => ({ ...actual, [tableroId]: { ...obtenerVista(tableroId), zoom } }));
  }

  function handleCapasChange(tableroId: string, capas: Capas) {
    setVistaEstado((actual) => ({ ...actual, [tableroId]: { ...obtenerVista(tableroId), capas } }));
  }

  return (
    <div>
      <Link to="/proyectos" className="text-sm text-secondary hover:text-on-background">
        ← Proyectos
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{proyecto.nombre}</h1>
      <p className="text-secondary">{proyecto.cliente}</p>

      <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-surface-stroke">
        {tableros.length > 0 && (
          <div role="tablist" aria-label="Tableros del proyecto" className="flex flex-wrap gap-1">
            {tableros.map((tablero) => (
              <button
                key={tablero.id}
                role="tab"
                type="button"
                aria-selected={tablero.id === tableroActivoId}
                onClick={() => handleSeleccionarTablero(tablero.id)}
                className={`px-4 py-2 text-sm uppercase tracking-widest ${
                  tablero.id === tableroActivoId
                    ? "border-b-2 border-abb-red text-abb-red"
                    : "text-secondary hover:text-on-background"
                }`}
              >
                {tablero.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-3 px-2 text-on-background">
          {tableroActivo && (
            <>
              <button
                type="button"
                aria-label="Renombrar tablero activo"
                onClick={(e) => {
                  triggerRef.current = e.currentTarget;
                  setNombreTableroEdit(tableroActivo.nombre);
                  setTableroEnEdicion(tableroActivo);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button
                type="button"
                aria-label="Borrar tablero activo"
                onClick={(e) => {
                  triggerRef.current = e.currentTarget;
                  setTableroABorrar(tableroActivo);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Nuevo tablero"
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              setModalNuevoTablero(true);
            }}
            className="hover:text-abb-red"
          >
            <span className="material-symbols-outlined text-base">add</span>
          </button>
        </div>
      </div>

      {tableroActivo === null ? (
        <p className="mt-6 text-secondary">Creá tu primer tablero para empezar a configurarlo.</p>
      ) : (
        <DetalleTablero
          key={tableroActivo.id}
          tablero={tableroActivo}
          onTableroActualizado={handleTableroActualizado}
          vista={obtenerVista(tableroActivo.id)}
          onZoomChange={(zoom) => handleZoomChange(tableroActivo.id, zoom)}
          onCapasChange={(capas) => handleCapasChange(tableroActivo.id, capas)}
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
              <button type="button" onClick={cerrarModales} className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest">
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
