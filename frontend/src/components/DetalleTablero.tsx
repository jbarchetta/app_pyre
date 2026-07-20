import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  actualizarSeccion,
  actualizarTablero,
  crearSeccion,
  eliminarSeccion,
  listarSalidas,
  listarSecciones,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type Salida,
  type Seccion,
  type Tablero,
  formatearCorriente,
} from "../api/client";
import type { Capas } from "./EsquemaVisual";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";
import { ComponentePicker } from "./ComponentePicker";
import { SeccionBlock } from "./SeccionBlock";
import { ConfirmDialog } from "./ConfirmDialog";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";

interface SeccionConSalidas {
  seccion: Seccion;
  salidas: Salida[];
}

interface Vista {
  zoom: number;
  capas: Capas;
}

interface DetalleTableroProps {
  tablero: Tablero;
  onTableroActualizado: (tablero: Tablero) => void;
  vista: Vista;
  onZoomChange: (zoom: number) => void;
  onCapasChange: (capas: Capas) => void;
}

const TAB_PRINCIPAL = "principal";

export function DetalleTablero({
  tablero,
  onTableroActualizado,
  vista,
  onZoomChange,
  onCapasChange,
}: DetalleTableroProps) {
  const [secciones, setSecciones] = useState<SeccionConSalidas[] | null>(null);
  const [tabSeleccionadoRaw, setTabSeleccionadoRaw] = useState<string | null>(null);
  const [modalIcc, setModalIcc] = useState(false);
  const [modalInterruptor, setModalInterruptor] = useState(false);
  const [modalNuevaFila, setModalNuevaFila] = useState(false);
  const [nombreNuevaFila, setNombreNuevaFila] = useState("");
  const [filaEnEdicion, setFilaEnEdicion] = useState<Seccion | null>(null);
  const [nombreFilaEdit, setNombreFilaEdit] = useState("");
  const [filaABorrar, setFilaABorrar] = useState<Seccion | null>(null);
  const [borrandoFila, setBorrandoFila] = useState(false);
  const [nivelFallaKaEdit, setNivelFallaKaEdit] = useState("");
  const [modalRenombrarTablero, setModalRenombrarTablero] = useState(false);
  const [nombreTableroEdit, setNombreTableroEdit] = useState("");
  const [guardandoTablero, setGuardandoTablero] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoDescarteEdicion, setConfirmandoDescarteEdicion] = useState(false);
  const [hoveredSalidaId, setHoveredSalidaId] = useState<string | null>(null);
  const ultimoTriggerRef = useRef<HTMLElement | null>(null);
  const nivelFallaInputRef = useRef<HTMLInputElement>(null);
  const nombreFilaInputRef = useRef<HTMLInputElement>(null);
  const nombreTableroInputRef = useRef<HTMLInputElement>(null);
  const modalIccRef = useRef(false);
  const modalInterruptorRef = useRef(false);
  const modalNuevaFilaRef = useRef(false);
  const modalRenombrarTableroRef = useRef(false);
  const filaEnEdicionIdRef = useRef<string | null>(null);

  function handleSalidaClickInBlueprint(salida: Salida) {
    setTabSeleccionadoRaw(salida.seccion_id);
    setTimeout(() => {
      const el = document.getElementById(`salida-fila-${salida.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }

  function handleSalidasReordenadas(seccionId: string, salidasReordenadas: Salida[]) {
    setSecciones((actuales) =>
      (actuales ?? []).map((s) => (s.seccion.id === seccionId ? { ...s, salidas: salidasReordenadas } : s))
    );
  }

  useEffect(() => {
    modalIccRef.current = modalIcc;
  }, [modalIcc]);

  useEffect(() => {
    modalInterruptorRef.current = modalInterruptor;
  }, [modalInterruptor]);

  useEffect(() => {
    modalNuevaFilaRef.current = modalNuevaFila;
  }, [modalNuevaFila]);

  useEffect(() => {
    filaEnEdicionIdRef.current = filaEnEdicion ? filaEnEdicion.id : null;
  }, [filaEnEdicion]);

  const cargar = useCallback(async () => {
    const seccionesCargadas = await listarSecciones(tablero.id);
    const conSalidas = await Promise.all(
      seccionesCargadas.map(async (seccion) => ({ seccion, salidas: await listarSalidas(seccion.id) })),
    );
    setSecciones(conSalidas);
  }, [tablero.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Por defecto se activa la primera fila real (comportamiento preexistente);
  // "Principal" solo es la pestaña activa por defecto cuando todavía no hay
  // ninguna fila real. "Principal" siempre puede elegirse a mano.
  const tabActivo =
    tabSeleccionadoRaw &&
    (tabSeleccionadoRaw === TAB_PRINCIPAL || (secciones ?? []).some((s) => s.seccion.id === tabSeleccionadoRaw))
      ? tabSeleccionadoRaw
      : ((secciones ?? [])[0]?.seccion.id ?? TAB_PRINCIPAL);
  const seccionSeleccionada = (secciones ?? []).find((s) => s.seccion.id === tabActivo) ?? null;

  function cerrarModales() {
    setModalIcc(false);
    modalIccRef.current = false;
    setModalInterruptor(false);
    modalInterruptorRef.current = false;
    setModalNuevaFila(false);
    modalNuevaFilaRef.current = false;
    setNombreNuevaFila("");
    setFilaEnEdicion(null);
    filaEnEdicionIdRef.current = null;
    setModalRenombrarTablero(false);
    modalRenombrarTableroRef.current = false;
    setNombreTableroEdit("");
    setFilaABorrar(null);
    setError(null);
    ultimoTriggerRef.current?.focus();
  }

  function esEdicionEnCurso() {
    return modalIcc || filaEnEdicion !== null || modalRenombrarTablero;
  }

  function solicitarCierreModales() {
    if (esEdicionEnCurso()) {
      setConfirmandoDescarteEdicion(true);
    } else {
      cerrarModales();
    }
  }

  function confirmarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
    cerrarModales();
  }

  function cancelarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
  }

  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(solicitarCierreModales);

  useEffect(() => {
    const hayModalAbierto = modalIcc || modalInterruptor || modalNuevaFila || filaEnEdicion !== null || modalRenombrarTablero;
    if (!hayModalAbierto) return;
    if (modalIcc) nivelFallaInputRef.current?.focus();
    if (modalNuevaFila || filaEnEdicion) nombreFilaInputRef.current?.focus();
    if (modalRenombrarTablero) nombreTableroInputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") solicitarCierreModales();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalIcc, modalInterruptor, modalNuevaFila, filaEnEdicion, modalRenombrarTablero]);

  async function handleGuardarNombreTablero(event: FormEvent) {
    event.preventDefault();
    if (!nombreTableroEdit.trim()) return;
    setGuardandoTablero(true);
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { nombre: nombreTableroEdit.trim() });
      onTableroActualizado(actualizado);
      setModalRenombrarTablero(false);
      setNombreTableroEdit("");
      ultimoTriggerRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar el tablero");
    } finally {
      setGuardandoTablero(false);
    }
  }

  async function handleGuardarNivelFalla(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { nivel_falla_ka: nivelFallaKaEdit });
      if (!modalIccRef.current) return; // cancelled while the request was in flight
      onTableroActualizado(actualizado);
      cerrarModales();
    } catch (err) {
      if (!modalIccRef.current) return;
      setError(err instanceof Error ? err.message : "No se pudo actualizar la intensidad de cortocircuito");
    }
  }

  async function handleSeleccionarInterruptorPrincipal(componente: ComponenteBusqueda) {
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { interruptor_principal_id: componente.id });
      if (!modalInterruptorRef.current) return;
      onTableroActualizado(actualizado);
      cerrarModales();
    } catch (err) {
      if (!modalInterruptorRef.current) return;
      setError(err instanceof Error ? err.message : "No se pudo actualizar el interruptor principal");
    }
  }

  async function handleCrearFila(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const seccion = await crearSeccion(tablero.id, nombreNuevaFila, (secciones ?? []).length);
      if (!modalNuevaFilaRef.current) return;
      setSecciones((actuales) => [...(actuales ?? []), { seccion, salidas: [] }]);
      setTabSeleccionadoRaw(seccion.id);
      cerrarModales();
    } catch (err) {
      if (!modalNuevaFilaRef.current) return;
      setError(err instanceof Error ? err.message : "No se pudo crear la fila");
    }
  }

  async function handleRenombrarFila(event: FormEvent) {
    event.preventDefault();
    if (!filaEnEdicion) return;
    const idEditada = filaEnEdicion.id;
    setError(null);
    try {
      const actualizada = await actualizarSeccion(idEditada, nombreFilaEdit);
      if (filaEnEdicionIdRef.current !== idEditada) return; // cancelled or a different rename started
      setSecciones((actuales) =>
        (actuales ?? []).map((s) => (s.seccion.id === actualizada.id ? { ...s, seccion: actualizada } : s)),
      );
      cerrarModales();
    } catch (err) {
      if (filaEnEdicionIdRef.current !== idEditada) return;
      setError(err instanceof Error ? err.message : "No se pudo renombrar la fila");
    }
  }

  async function handleConfirmarBorrarFila() {
    if (!filaABorrar) return;
    setBorrandoFila(true);
    try {
      await eliminarSeccion(filaABorrar.id);
      setSecciones((actuales) => (actuales ?? []).filter((s) => s.seccion.id !== filaABorrar.id));
      if (tabActivo === filaABorrar.id) setTabSeleccionadoRaw(TAB_PRINCIPAL);
      cerrarModales();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la fila");
    } finally {
      setBorrandoFila(false);
    }
  }

  function handleSalidaCreada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      (actuales ?? []).map((s) => (s.seccion.id === seccionId ? { ...s, salidas: [...s.salidas, salida] } : s)),
    );
  }

  function handleSalidaActualizada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      (actuales ?? []).map((s) =>
        s.seccion.id === seccionId
          ? { ...s, salidas: s.salidas.map((sal) => (sal.id === salida.id ? salida : sal)) }
          : s,
      ),
    );
  }

  function handleSalidaBorrada(seccionId: string, salidaId: string) {
    setSecciones((actuales) =>
      (actuales ?? []).map((s) =>
        s.seccion.id === seccionId ? { ...s, salidas: s.salidas.filter((sal) => sal.id !== salidaId) } : s,
      ),
    );
  }

  const filaABorrarCantidadElementos = filaABorrar
    ? ((secciones ?? []).find((s) => s.seccion.id === filaABorrar.id)?.salidas.length ?? 0)
    : 0;

  if (secciones === null) return <p>Cargando...</p>;

  return (
    <div className="mt-8">
      <p className="flex flex-wrap items-center gap-2">
        Intensidad de Cortocircuito (Icc): {tablero.nivel_falla_ka} kA
        <button
          type="button"
          aria-label="Editar intensidad de cortocircuito"
          onClick={(e) => {
            ultimoTriggerRef.current = e.currentTarget;
            setNivelFallaKaEdit(tablero.nivel_falla_ka);
            setModalIcc(true);
          }}
          className="text-on-background hover:text-abb-red"
        >
          <PencilIcon className="w-3.5 h-3.5 inline" />
        </button>
      </p>

      {modalIcc && !confirmandoDescarteEdicion && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40"
          onMouseDown={onMouseDownModal}
          onClick={onClickModal}
        >
          <form
            onSubmit={handleGuardarNivelFalla}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="icc-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="icc-modal-titulo" className="text-lg font-bold">
              Intensidad de Cortocircuito (Icc)
            </h2>
            <label htmlFor="nivel-falla-edit">Nuevo nivel de falla (kA)</label>
            <input
              id="nivel-falla-edit"
              ref={nivelFallaInputRef}
              value={nivelFallaKaEdit}
              onChange={(e) => setNivelFallaKaEdit(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button
                type="button"
                onClick={solicitarCierreModales}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {(modalIcc || filaEnEdicion) && confirmandoDescarteEdicion && (
        <ConfirmDialog
          titulo="¿Descartar cambios?"
          mensaje="Vas a perder los cambios que hiciste."
          textoConfirmar="Descartar"
          onConfirm={confirmarDescarteEdicion}
          onCancel={cancelarDescarteEdicion}
        />
      )}

      {modalInterruptor && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="interruptor-principal"
          titulo="Interruptor principal"
          onSelect={handleSeleccionarInterruptorPrincipal}
          onCancel={cerrarModales}
        />
      )}

      {modalNuevaFila && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40"
          onMouseDown={onMouseDownModal}
          onClick={onClickModal}
        >
          <form
            onSubmit={handleCrearFila}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nueva-fila-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="nueva-fila-titulo" className="text-lg font-bold">
              Nueva fila
            </h2>
            <label htmlFor="nombre-nueva-fila">Nombre</label>
            <input
              id="nombre-nueva-fila"
              ref={nombreFilaInputRef}
              value={nombreNuevaFila}
              onChange={(e) => setNombreNuevaFila(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Agregar fila
              </button>
              <button
                type="button"
                onClick={cerrarModales}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {filaEnEdicion && !confirmandoDescarteEdicion && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40"
          onMouseDown={onMouseDownModal}
          onClick={onClickModal}
        >
          <form
            onSubmit={handleRenombrarFila}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-fila-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="editar-fila-titulo" className="text-lg font-bold">
              Renombrar fila
            </h2>
            <label htmlFor="nombre-fila-edit">Nombre</label>
            <input
              id="nombre-fila-edit"
              ref={nombreFilaInputRef}
              value={nombreFilaEdit}
              onChange={(e) => setNombreFilaEdit(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button
                type="button"
                onClick={solicitarCierreModales}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {filaABorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={
            filaABorrarCantidadElementos > 0
              ? `Esto va a borrar la fila "${filaABorrar.nombre}" y sus ${filaABorrarCantidadElementos} elemento(s).`
              : `Esto va a borrar la fila "${filaABorrar.nombre}".`
          }
          confirmando={borrandoFila}
          error={error}
          onConfirm={handleConfirmarBorrarFila}
          onCancel={cerrarModales}
        />
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="w-full">
          <EsquemaVisualCanvas
            tieneInterruptorPrincipal={!!tablero.interruptor_principal_id}
            interruptorPrincipal={{
              id: tablero.interruptor_principal_id,
              codigo: tablero.interruptor_principal_codigo,
              codigo_comercial: tablero.interruptor_principal_codigo_comercial,
              descripcion: tablero.interruptor_principal_descripcion,
              corriente_nominal_a: tablero.interruptor_principal_corriente_nominal_a,
              polos: tablero.interruptor_principal_polos,
            }}
            secciones={secciones}
            zoom={vista.zoom}
            onZoomChange={onZoomChange}
            capas={vista.capas}
            onCapasChange={onCapasChange}
            hoveredSalidaId={hoveredSalidaId}
            onSalidaHover={setHoveredSalidaId}
            onSalidaClick={handleSalidaClickInBlueprint}
          />
        </div>
        <div className="w-full min-w-0">
          <div className="border border-surface-stroke bg-white rounded-t-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between border-b border-surface-stroke bg-industrial-gray px-4 py-2 gap-2">
              <div role="tablist" aria-label="Filas del tablero" className="flex flex-wrap items-center gap-1">
                <button
                  role="tab"
                  type="button"
                  aria-selected={tabActivo === TAB_PRINCIPAL}
                  onClick={() => setTabSeleccionadoRaw(TAB_PRINCIPAL)}
                  className={`px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider rounded transition ${
                    tabActivo === TAB_PRINCIPAL
                      ? "bg-white text-abb-red shadow-sm border border-gray-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                  }`}
                >
                  Principal
                </button>
                {secciones.map(({ seccion }) => (
                  <button
                    key={seccion.id}
                    role="tab"
                    type="button"
                    aria-selected={seccion.id === tabActivo}
                    onClick={() => setTabSeleccionadoRaw(seccion.id)}
                    className={`px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider rounded transition ${
                      seccion.id === tabActivo
                        ? "bg-white text-abb-red shadow-sm border border-gray-200"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                    }`}
                  >
                    {seccion.nombre}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1 text-gray-600">
                {tabActivo !== TAB_PRINCIPAL && seccionSeleccionada && (
                  <>
                    <button
                      type="button"
                      aria-label="Renombrar fila activa"
                      onClick={(e) => {
                        ultimoTriggerRef.current = e.currentTarget;
                        setNombreFilaEdit(seccionSeleccionada.seccion.nombre);
                        setFilaEnEdicion(seccionSeleccionada.seccion);
                      }}
                      className="p-1.5 hover:text-abb-red hover:bg-gray-200 rounded transition"
                      title="Renombrar fila"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Borrar fila activa"
                      onClick={(e) => {
                        ultimoTriggerRef.current = e.currentTarget;
                        setFilaABorrar(seccionSeleccionada.seccion);
                      }}
                      className="p-1.5 hover:text-abb-red hover:bg-gray-200 rounded transition"
                      title="Eliminar fila"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label="Nueva fila"
                  onClick={(e) => {
                    ultimoTriggerRef.current = e.currentTarget;
                    setNombreNuevaFila("");
                    setModalNuevaFila(true);
                  }}
                  className="p-1.5 hover:text-abb-red hover:bg-gray-200 rounded transition flex items-center gap-1 text-xs font-bold font-mono uppercase"
                  title="Agregar nueva fila"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {tabActivo === TAB_PRINCIPAL ? (
            <div className="mt-4 border border-surface-stroke bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="border-b border-surface-stroke bg-industrial-gray px-4 py-2.5 flex items-center justify-between min-h-[42px]">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4 text-abb-red" />
                  Interruptor Principal — {tablero.nombre}
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-surface-stroke text-xs uppercase tracking-widest text-secondary bg-gray-50">
                      <th scope="col" className="p-2 w-8 text-center">#</th>
                      <th scope="col" className="p-3">Circuito</th>
                      <th scope="col" className="p-3">Carga</th>
                      <th scope="col" className="p-3">Formato / Protec</th>
                      <th scope="col" className="p-3">Componente ABB</th>
                      <th scope="col" className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-surface-stroke border-l-4 border-l-transparent transition-colors duration-150 hover:bg-gray-50/80 hover:border-l-abb-red">
                      <td className="p-2 text-center text-gray-400 font-mono text-xs font-bold w-8">P</td>

                      <td className="p-3 font-semibold text-gray-900 text-sm">
                        <span className="bg-red-100 text-abb-red px-2 py-0.5 rounded font-mono text-xs font-bold border border-red-200">
                          PRINCIPAL
                        </span>
                      </td>

                      <td className="p-3 font-mono font-medium text-gray-900">
                        {tablero.interruptor_principal_corriente_nominal_a
                          ? `${formatearCorriente(tablero.interruptor_principal_corriente_nominal_a)} A`
                          : "Calculado"}
                      </td>

                      <td className="p-3 text-xs text-gray-700 whitespace-nowrap w-24">
                        <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[11px] font-medium text-gray-800 border border-gray-200">
                          <span className="font-bold text-gray-900">
                            {tablero.interruptor_principal_polos != null
                              ? `${tablero.interruptor_principal_polos}P`
                              : "3P"}
                          </span>
                          <span className="text-gray-500">(TM)</span>
                        </span>
                      </td>

                      <td
                        className="p-3 font-mono text-xs"
                        title={
                          tablero.interruptor_principal_descripcion
                            ? `${tablero.interruptor_principal_codigo ?? ""} - ${tablero.interruptor_principal_descripcion}`
                            : tablero.interruptor_principal_codigo_comercial
                            ? `${tablero.interruptor_principal_codigo ?? ""} (${tablero.interruptor_principal_codigo_comercial})`
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-2">
                          {tablero.interruptor_principal_id ? (
                            <>
                              <PencilSquareIcon
                                className="w-4 h-4 text-abb-red shrink-0"
                                title="Asignado manualmente por el analista"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-gray-900">
                                  {tablero.interruptor_principal_codigo ?? tablero.interruptor_principal_id}
                                </span>
                                {tablero.interruptor_principal_descripcion ? (
                                  <span className="text-gray-500 text-[11px] truncate max-w-[240px]">
                                    {tablero.interruptor_principal_descripcion}
                                  </span>
                                ) : tablero.interruptor_principal_codigo_comercial ? (
                                  <span className="text-gray-500 text-[11px] truncate max-w-[240px]">
                                    {tablero.interruptor_principal_codigo_comercial}
                                  </span>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <>
                              <ExclamationTriangleIcon
                                className="w-4 h-4 text-amber-500 shrink-0 cursor-help"
                                title="Interruptor principal aún sin definir"
                              />
                              <span className="text-amber-700 italic">Interruptor principal sin definir</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <button
                          type="button"
                          aria-label="Editar interruptor principal"
                          onClick={(e) => {
                            ultimoTriggerRef.current = e.currentTarget;
                            setModalInterruptor(true);
                          }}
                          className="hover:text-abb-red p-1 rounded hover:bg-gray-100"
                          title="Elegir o cambiar interruptor principal"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            seccionSeleccionada && (
              <SeccionBlock
                key={seccionSeleccionada.seccion.id}
                seccion={seccionSeleccionada.seccion}
                salidas={seccionSeleccionada.salidas}
                elementosCandidatos={(secciones ?? []).flatMap((s, sIdx) => {
                  const sNum = s.seccion.orden != null ? s.seccion.orden + 1 : sIdx + 1;
                  return s.salidas.map((sal, salIdx) => ({
                    id: sal.id,
                    codigo: `F${sNum}.${salIdx + 1}`,
                    etiqueta: sal.etiqueta,
                    tipo_proteccion: sal.tipo_proteccion === "seccional_diferencial" ? "Diferencial" : "Termomagnético",
                    carga: `${sal.carga_valor} ${sal.carga_unidad}`,
                  }));
                })}
                onSalidaCreada={(salida) => handleSalidaCreada(seccionSeleccionada.seccion.id, salida)}
                onSalidaActualizada={(salida) => handleSalidaActualizada(seccionSeleccionada.seccion.id, salida)}
                onSalidaBorrada={(salidaId) => handleSalidaBorrada(seccionSeleccionada.seccion.id, salidaId)}
                onSalidasReordenadas={(salidas) => handleSalidasReordenadas(seccionSeleccionada.seccion.id, salidas)}
                hoveredSalidaId={hoveredSalidaId}
                onSalidaHover={setHoveredSalidaId}
              />
            )
          )}
        </div>
      </div>

      {/* Modal para renombrar el tablero */}
      {modalRenombrarTablero && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div
            onMouseDown={onMouseDownModal}
            onClick={onClickModal}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <PencilIcon className="w-5 h-5 text-abb-red" />
                Renombrar Tablero
              </h2>
              <button
                type="button"
                onClick={solicitarCierreModales}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleGuardarNombreTablero} className="space-y-4">
              <div>
                <label htmlFor="nombre-tablero-input" className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre del Tablero
                </label>
                <input
                  id="nombre-tablero-input"
                  ref={nombreTableroInputRef}
                  type="text"
                  value={nombreTableroEdit}
                  onChange={(e) => setNombreTableroEdit(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-abb-red"
                  placeholder="ej. Tablero General T-01"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={solicitarCierreModales}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoTablero || !nombreTableroEdit.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-abb-red hover:bg-red-700 text-white rounded transition disabled:opacity-50"
                >
                  {guardandoTablero ? "Guardando..." : "Guardar Nombre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
