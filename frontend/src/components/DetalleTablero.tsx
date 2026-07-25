import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  BoltIcon,
  CheckCircleIcon,
  CubeIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import {
  actualizarSeccion,
  actualizarTablero,
  crearSeccion,
  eliminarSeccion,
  obtenerTablero,
  listarSalidas,
  listarSecciones,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type Salida,
  type Seccion,
  type Tablero,
  formatearCorriente,
  obtenerAccesoriosSugeridos,
  listarAccesoriosPrincipal,
  asociarAccesorioPrincipal,
  desasociarAccesorioPrincipal,
  type AccesoriosSugeridos,
} from "../api/client";
import type { Capas } from "./EsquemaVisual";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";
import { ComponentePicker } from "./ComponentePicker";
import { SeccionBlock } from "./SeccionBlock";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button } from "./common/Button";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";
import type { ModoVisual, ModoVisualState } from "../utils/vistaStorage";

interface SeccionConSalidas {
  seccion: Seccion;
  salidas: Salida[];
}

interface DetalleTableroProps {
  tablero: Tablero;
  onTableroActualizado: (tablero: Tablero) => void;
  obtenerVistaModo?: (modo: ModoVisual) => ModoVisualState;
  onModoStateChange?: (modo: ModoVisual, cambios: Partial<ModoVisualState>) => void;
  vista?: { zoom: number; capas: Capas };
  onZoomChange?: (zoom: number) => void;
  onCapasChange?: (capas: Capas) => void;
}

const TAB_PRINCIPAL = "principal";

const CATEGORIAS_ACCESORIOS = [
  "Interruptores automáticos en caja moldeada",
  "Accesorios Tableros",
  "Señalizaciones eléctricas",
  "Medidores de Energía",
  "Relés de Interfase",
  "Bobinas",
  "Relés Diferenciales",
  "Canalizaciones",
  "Terminales",
];

export function DetalleTablero({
  tablero,
  onTableroActualizado,
  obtenerVistaModo,
  onModoStateChange,
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
  const [hoveredSalidaId, setHoveredSalidaId] = useState<string | null>(null);
  const [panelLateralColapsado, setPanelLateralColapsado] = useState(false);
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

  const [accesorios, setAccesorios] = useState<ComponenteBusqueda[]>([]);
  const [sugerencias, setSugerencias] = useState<AccesoriosSugeridos | null>(null);
  const [modalAccesorioManual, setModalAccesorioManual] = useState(false);
  const modalAccesorioManualRef = useRef(false);

  useEffect(() => {
    modalAccesorioManualRef.current = modalAccesorioManual;
  }, [modalAccesorioManual]);

  const cargarAccesorios = useCallback(async () => {
    try {
      const list = await listarAccesoriosPrincipal(tablero.id);
      setAccesorios(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Error al cargar accesorios:", err);
    }
  }, [tablero.id]);

  const cargarSugerencias = useCallback(async () => {
    if (!tablero.interruptor_principal_id) {
      setSugerencias(null);
      return;
    }
    try {
      const sug = await obtenerAccesoriosSugeridos(tablero.id);
      setSugerencias(sug);
    } catch (err) {
      console.error("Error al cargar sugerencias:", err);
    }
  }, [tablero.id, tablero.interruptor_principal_id]);

  useEffect(() => {
    if (tabSeleccionadoRaw === TAB_PRINCIPAL || !tabSeleccionadoRaw) {
      cargarAccesorios();
      cargarSugerencias();
    }
  }, [tabSeleccionadoRaw, tablero.interruptor_principal_id, cargarAccesorios, cargarSugerencias]);

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
    setModalAccesorioManual(false);
    modalAccesorioManualRef.current = false;
    setError(null);
    ultimoTriggerRef.current?.focus();
  }

  function solicitarCierreModales() {
    cerrarModales();
  }

  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(solicitarCierreModales);

  useEffect(() => {
    const hayModalAbierto = modalIcc || modalInterruptor || modalNuevaFila || filaEnEdicion !== null || modalRenombrarTablero || modalAccesorioManual;
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
  }, [modalIcc, modalInterruptor, modalNuevaFila, filaEnEdicion, modalRenombrarTablero, modalAccesorioManual]);

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

  async function handleCambiarConfigFisica(cambios: any) {
    try {
      const actualizado = await actualizarTablero(tablero.id, cambios);
      onTableroActualizado(actualizado);
    } catch (err) {
      console.error("Error al actualizar config física:", err);
    }
  }

  async function handleAsociarAccesorio(componenteId: string) {
    try {
      await asociarAccesorioPrincipal(tablero.id, componenteId);
      await cargarAccesorios();
    } catch (err) {
      console.error("Error al asociar accesorio:", err);
    }
  }

  async function handleDesasociarAccesorio(componenteId: string) {
    try {
      await desasociarAccesorioPrincipal(tablero.id, componenteId);
      await cargarAccesorios();
    } catch (err) {
      console.error("Error al desasociar accesorio:", err);
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

      const tabActualizado = await obtenerTablero(tablero.id);
      onTableroActualizado(tabActualizado);
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
      const actualizada = await actualizarSeccion(idEditada, { nombre: nombreFilaEdit });
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

      const tabActualizado = await obtenerTablero(tablero.id);
      onTableroActualizado(tabActualizado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la fila");
    } finally {
      setBorrandoFila(false);
    }
  }

  async function handleSalidaCreada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      (actuales ?? []).map((s) => (s.seccion.id === seccionId ? { ...s, salidas: [...s.salidas, salida] } : s)),
    );
    try {
      const tabActualizado = await obtenerTablero(tablero.id);
      onTableroActualizado(tabActualizado);
    } catch (err) {
      console.error("Error refreshing board:", err);
    }
  }

  async function handleSalidaActualizada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      (actuales ?? []).map((s) =>
        s.seccion.id === seccionId
          ? { ...s, salidas: s.salidas.map((sal) => (sal.id === salida.id ? salida : sal)) }
          : s,
      ),
    );
    try {
      const tabActualizado = await obtenerTablero(tablero.id);
      onTableroActualizado(tabActualizado);
    } catch (err) {
      console.error("Error refreshing board:", err);
    }
  }

  async function handleSalidaBorrada(seccionId: string, salidaId: string) {
    setSecciones((actuales) =>
      (actuales ?? []).map((s) =>
        s.seccion.id === seccionId ? { ...s, salidas: s.salidas.filter((sal) => sal.id !== salidaId) } : s,
      ),
    );
    try {
      const tabActualizado = await obtenerTablero(tablero.id);
      onTableroActualizado(tabActualizado);
    } catch (err) {
      console.error("Error refreshing board:", err);
    }
  }

  const filaABorrarCantidadElementos = filaABorrar
    ? ((secciones ?? []).find((s) => s.seccion.id === filaABorrar.id)?.salidas.length ?? 0)
    : 0;

  if (secciones === null) return <p className="text-gray-500 italic p-6 text-center">Cargando tablero...</p>;

  const totalSalidasCount = (secciones ?? []).reduce((acc, s) => acc + s.salidas.length, 0);
  const matchSalidasCount =
    (secciones ?? []).reduce(
      (acc, s) => acc + s.salidas.filter((sal) => sal.componente_id).length,
      0,
    ) + (tablero.interruptor_principal_id ? 1 : 0);
  const totalItemsCount = totalSalidasCount + 1;
  const matchPercentage = totalItemsCount > 0 ? Math.round((matchSalidasCount / totalItemsCount) * 100) : 100;

  const totalCargaAmperios = (secciones ?? []).reduce((acc, s) => {
    return (
      acc +
      s.salidas.reduce((sAcc, sal) => {
        if (sal.carga_unidad === "A") {
          const val = parseFloat(sal.carga_valor);
          return sAcc + (isNaN(val) ? 0 : val);
        }
        return sAcc;
      }, 0)
    );
  }, 0);

  return (
    <div className="mt-4 space-y-6">
      {/* ZONA SUPERIOR: Visor de Blueprint (68% o 100%) + Panel Lateral Derecha (32% u oculto) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch transition-all duration-300">
        {/* Columna Izquierda: Visor del Unifilar / Bloques LIVE_SCHEMATIC_VIEWER */}
        <div className={`${panelLateralColapsado ? "lg:col-span-12" : "lg:col-span-8"} w-full flex flex-col justify-start h-full transition-all duration-300`}>
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
            obtenerVistaModo={obtenerVistaModo}
            onModoStateChange={onModoStateChange}
            zoom={vista?.zoom}
            onZoomChange={onZoomChange}
            capas={vista?.capas}
            onCapasChange={onCapasChange}
            hoveredSalidaId={hoveredSalidaId}
            onSalidaHover={setHoveredSalidaId}
            onSalidaClick={handleSalidaClickInBlueprint}
            tabActivo={tabActivo}
            accesorios={accesorios}
            sugerencias={sugerencias}
            onAsociarAccesorio={handleAsociarAccesorio}
            onDesasociarAccesorio={handleDesasociarAccesorio}
            onAbrirAccesorioManual={() => setModalAccesorioManual(true)}
            metodoEntrada={tablero.principal_metodo_entrada}
            metodoSalida={tablero.principal_metodo_salida}
            bornerasTipo={tablero.borneras_tipo}
            cablecanalSugerido={tablero.cablecanal_sugerido}
            gabineteSugeridoAncho={tablero.gabinete_sugerido_ancho_mm}
            gabineteSugeridoAlto={tablero.gabinete_sugerido_alto_mm}
            tableroId={tablero.id}
            panelLateralColapsado={panelLateralColapsado}
            onTogglePanelLateral={() => setPanelLateralColapsado(false)}
          />
        </div>

        {/* Columna Derecha: Tarjetas de Control y Parámetros (~32%, ocultas si panelLateralColapsado === true) */}
        {!panelLateralColapsado && (
          <div className="lg:col-span-4 w-full flex flex-col gap-4 transition-all duration-300">
            {/* Cabecera Identica sobre las Tarjetas Laterales */}
            <div className="flex items-center justify-between bg-industrial-gray border border-surface-stroke rounded-xl px-4 py-2 shadow-sm min-h-[46px] shrink-0">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5 truncate">
                <BoltIcon className="w-4 h-4 text-abb-red shrink-0" />
                <span className="truncate">PANEL LATERAL</span>
              </span>
              <button
                type="button"
                onClick={() => setPanelLateralColapsado(true)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-sm transition shrink-0"
                title="Comprimir tarjetas laterales"
              >
                <ArrowsPointingInIcon className="w-4 h-4 text-abb-red" />
                <span>Comprimir tarjetas laterales</span>
              </button>
            </div>
            {/* Card 1: TECHNICAL PARAMETERS (Normalizado con estilo claro de la app) */}
            <div className="bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden shrink-0">
              <div className="border-b border-surface-stroke bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <BoltIcon className="w-4 h-4 text-abb-red" /> PARÁMETROS TÉCNICOS
                </h4>
                <span className="text-[10px] font-mono font-bold text-abb-red bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                  ABB APPROVED
                </span>
              </div>

              <div className="p-3 space-y-2 text-xs font-mono">
                <p className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">
                    {`Intensidad de Cortocircuito (Icc): ${tablero.nivel_falla_ka} kA`}
                  </span>
                  <button
                    type="button"
                    aria-label="Editar intensidad de cortocircuito"
                    onClick={(e) => {
                      ultimoTriggerRef.current = e.currentTarget;
                      setNivelFallaKaEdit(tablero.nivel_falla_ka);
                      setModalIcc(true);
                    }}
                    className="text-gray-400 hover:text-abb-red p-1 rounded hover:bg-gray-100 transition shrink-0 ml-1"
                    title="Editar Nivel de Cortocircuito (Icc)"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                </p>

                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">TENSIÓN / FREC:</span>
                  <span className="font-bold text-gray-900">380V / 50Hz (3P+N)</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">CARGA ESTIMADA:</span>
                  <span className="font-bold text-emerald-600">{formatearCorriente(totalCargaAmperios)} A</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500 font-medium">NORMA CUMPLIDA:</span>
                  <span className="font-bold text-abb-red">IEC 61439-1</span>
                </div>
              </div>
            </div>

            {/* Card 2: INTEGRITY CHECK */}
            <div className="bg-white border border-surface-stroke rounded-xl p-4 shadow-sm space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-gray-700 flex items-center gap-1.5">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" /> INTEGRITY CHECK
                </span>
                <span className="text-xs font-mono font-bold text-gray-900">{matchPercentage}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    matchPercentage === 100 ? "bg-green-600" : matchPercentage > 50 ? "bg-amber-500" : "bg-abb-red"
                  }`}
                  style={{ width: `${matchPercentage}%` }}
                />
              </div>
              <div className="text-[11px] text-gray-500 flex justify-between">
                <span>Match de catálogo ABB</span>
                <span>{matchSalidasCount} de {totalItemsCount} definidos</span>
              </div>
            </div>

            {/* Card: GABINETE SUGERIDO */}
            <div className="bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden shrink-0">
              <div className="border-b border-surface-stroke bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <CubeIcon className="w-4 h-4 text-abb-red" /> GABINETE SUGERIDO
                </h4>
                <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  NOLLMANN NIS
                </span>
              </div>

              <div className="p-3 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">CÓDIGO:</span>
                  <span className="font-bold text-gray-900">
                    {tablero.gabinete_sugerido_codigo || "Sin gabinete asignado"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">MEDIDAS (Ancho x Alto x Prof):</span>
                  <span className="font-bold text-gray-900">
                    {tablero.gabinete_sugerido_ancho_mm && tablero.gabinete_sugerido_alto_mm
                      ? `${tablero.gabinete_sugerido_ancho_mm} x ${tablero.gabinete_sugerido_alto_mm} x 225 mm`
                      : "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <label htmlFor="paso-global" className="text-gray-500 font-medium">PASO GLOBAL:</label>
                  <select
                    id="paso-global"
                    value={tablero.paso_manual === null || tablero.paso_manual === undefined ? "auto" : tablero.paso_manual.toString()}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleCambiarConfigFisica({
                        paso_manual: val === "auto" ? null : parseInt(val)
                      });
                    }}
                    className="border border-surface-stroke bg-white px-2 py-0.5 text-xs font-bold text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-abb-red"
                  >
                    <option value="auto">Auto ({tablero.paso_mm || 150} mm)</option>
                    <option value="150">Paso 150 mm</option>
                    <option value="200">Paso 200 mm</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ZONA INFERIOR: TABS DE FILAS Y CONFIGURACIÓN A ANCHO COMPLETO */}
      <div className="w-full mt-6 bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Header con Pestañas de Selección de Sección y Toolbar de Acciones */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-stroke bg-slate-50/60 p-2 gap-3 shrink-0">
          {/* Listado de Pestañas (Scroll horizontal si es necesario) */}
          <nav className="flex gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 max-w-full overflow-x-auto scrollbar-none" role="tablist" aria-label="Filas del tablero">
            <button
              role="tab"
              aria-selected={tabActivo === TAB_PRINCIPAL}
              aria-label="Principal"
              type="button"
              onClick={() => setTabSeleccionadoRaw(TAB_PRINCIPAL)}
              className={`px-3 py-1.5 text-xs font-sans rounded-lg transition-all duration-150 ${
                tabActivo === TAB_PRINCIPAL
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-semibold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/50 font-medium"
              }`}
            >
              <span aria-hidden="true" className="opacity-50 font-mono text-[11px] mr-1.5">00</span>
              <span>Principal</span>
            </button>
            {(secciones ?? []).map(({ seccion, salidas }, idx) => {
              const sNum = (idx + 1).toString().padStart(2, "0");
              const isSelected = seccion.id === tabActivo;
              return (
                <button
                  key={seccion.id}
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={seccion.nombre}
                  type="button"
                  onClick={() => setTabSeleccionadoRaw(seccion.id)}
                  className={`px-3 py-1.5 text-xs font-sans rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-semibold"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50 font-medium"
                  }`}
                >
                  <span aria-hidden="true" className="opacity-50 font-mono text-[11px]">{sNum}</span>
                  <span className="truncate max-w-[120px]">{seccion.nombre}</span>
                  <span className="ml-1 text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full font-semibold font-mono" aria-hidden="true">
                    {salidas.length}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Acciones para la Fila Activa y Agregar Sub-sección */}
          <div className="flex items-center gap-1.5 shrink-0 px-1 sm:ml-auto">
            {tabActivo !== TAB_PRINCIPAL && seccionSeleccionada && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Renombrar fila activa"
                  onClick={(e) => {
                    ultimoTriggerRef.current = e.currentTarget;
                    setNombreFilaEdit(seccionSeleccionada.seccion.nombre);
                    setFilaEnEdicion(seccionSeleccionada.seccion);
                  }}
                  title="Renombrar sub-sección activa"
                  icon={<PencilIcon className="w-4 h-4 text-slate-600" />}
                />
                <Button
                  size="icon"
                  variant="danger"
                  aria-label="Borrar fila activa"
                  onClick={(e) => {
                    ultimoTriggerRef.current = e.currentTarget;
                    setFilaABorrar(seccionSeleccionada.seccion);
                  }}
                  title="Eliminar sub-sección activa"
                  icon={<TrashIcon className="w-4 h-4 text-red-600" />}
                />
              </>
            )}
            <Button
              size="icon"
              variant="primary"
              aria-label="Nueva fila"
              onClick={(e) => {
                ultimoTriggerRef.current = e.currentTarget;
                setNombreNuevaFila("");
                setModalNuevaFila(true);
              }}
              title="Nueva sub-sección"
              icon={<PlusIcon className="w-4 h-4 text-white" />}
            />
          </div>
        </div>

        {/* Contenido de la Sección Activa */}
        {tabActivo === TAB_PRINCIPAL ? (
          <div className="p-4 space-y-6">
            {/* Formulario de Configuración Física */}
            <div className="bg-slate-50 border border-surface-stroke rounded-xl p-4 shadow-sm">
              <h4 className="text-xs font-mono font-bold uppercase text-gray-700 tracking-wider mb-3">
                Configuración del Armado Físico y Distribución
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label htmlFor="metodo-entrada" className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                    Acometida / Entrada
                  </label>
                  <select
                    id="metodo-entrada"
                    value={tablero.principal_metodo_entrada || "cable"}
                    onChange={(e) => handleCambiarConfigFisica({ principal_metodo_entrada: e.target.value })}
                    className="w-full border border-surface-stroke bg-white p-2 text-sm rounded-lg"
                  >
                    <option value="cable">Cable</option>
                    <option value="barral">Barral de Cobre</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="metodo-salida" className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                    Método de Distribución / Salida
                  </label>
                  <select
                    id="metodo-salida"
                    value={tablero.principal_metodo_salida || "barra_distribucion"}
                    onChange={(e) => handleCambiarConfigFisica({ principal_metodo_salida: e.target.value })}
                    className="w-full border border-surface-stroke bg-white p-2 text-sm rounded-lg"
                  >
                    <option value="barra_distribucion">Barra de Distribución / Distribuidor</option>
                    <option value="barra_cobre">Barras de Cobre</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="borneras-tipo" className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                    Configuración de Borneras
                  </label>
                  <select
                    id="borneras-tipo"
                    value={tablero.borneras_tipo || "ninguno"}
                    onChange={(e) => handleCambiarConfigFisica({ borneras_tipo: e.target.value })}
                    className="w-full border border-surface-stroke bg-white p-2 text-sm rounded-lg"
                  >
                    <option value="ninguno">Ninguno</option>
                    <option value="lateral_izq">Lateral Izquierda</option>
                    <option value="lateral_der">Lateral Derecha</option>
                    <option value="inferior">Inferior</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="porcentaje-reserva" className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                    Reserva (%)
                  </label>
                  <input
                    id="porcentaje-reserva"
                    type="number"
                    min="0"
                    max="100"
                    value={tablero.porcentaje_reserva ?? 0}
                    onChange={(e) => handleCambiarConfigFisica({ porcentaje_reserva: parseInt(e.target.value) || 0 })}
                    className="w-full border border-surface-stroke bg-white p-2 text-sm rounded-lg"
                  />
                </div>

                <div className="flex items-center h-10">
                  <label htmlFor="lleva-banquitos" className="inline-flex items-center cursor-pointer gap-2 select-none">
                    <input
                      id="lleva-banquitos"
                      type="checkbox"
                      checked={tablero.lleva_banquitos || false}
                      onChange={(e) => handleCambiarConfigFisica({ lleva_banquitos: e.target.checked })}
                      className="rounded border-gray-300 text-abb-red focus:ring-abb-red w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-gray-700">¿Lleva banquitos elevadores?</span>
                  </label>
                </div>
              </div>

              {/* Sugerencias del Sistema (Dimensionamiento Físico) */}
              <div className="border-t border-surface-stroke mt-4 pt-4">
                <h5 className="text-[10px] uppercase font-mono font-bold text-gray-500 tracking-wider mb-2">
                  Propuesta de Dimensionamiento Físico (Automatizada)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white border border-surface-stroke rounded-lg p-3 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-secondary">Gabinete NIS Sugerido</span>
                      <p className="text-sm font-bold text-gray-800 mt-1">{tablero.gabinete_sugerido_codigo || "NIS 300.300.XX (Mínimo)"}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Nollmann (NIS Estanco Prof 225mm)</p>
                    </div>
                  </div>
                  <div className="bg-white border border-surface-stroke rounded-lg p-3 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-secondary">Distribuidor Sugerido</span>
                      <p className="text-sm font-bold text-gray-800 mt-1">{tablero.distribuidor_sugerido_codigo || "NRT125BB (Mínimo)"}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Nöllmed (Montaje en Riel o Bandeja)</p>
                    </div>
                  </div>
                  <div className="bg-white border border-surface-stroke rounded-lg p-3 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-secondary">Cablecanal Zoloda</span>
                      <p className="text-sm font-bold text-gray-800 mt-1">{tablero.cablecanal_sugerido || "40x40 (Mínimo)"}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Ocupación de cables &le; 65%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interruptor Principal Q1 */}
            <div className="border border-surface-stroke bg-white rounded-lg overflow-hidden shadow-sm">
              <div className="border-b border-surface-stroke bg-slate-50 px-4 py-2.5 flex items-center justify-between min-h-[42px]">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4 text-abb-red" />
                  Interruptor Principal — {tablero.nombre}
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-700 bg-slate-100/90">
                      <th scope="col" className="py-1.5 px-2 w-8 text-center">#</th>
                      <th scope="col" className="py-1.5 px-3">Circuito</th>
                      <th scope="col" className="py-1.5 px-3">Carga</th>
                      <th scope="col" className="py-1.5 px-3">Formato / Protec</th>
                      <th scope="col" className="py-1.5 px-3">Componente ABB</th>
                      <th scope="col" className="py-1.5 px-3 text-right">Acciones</th>
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
                              <span className="text-amber-600 font-normal italic text-xs">Interruptor principal sin definir</span>
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

            {/* Accesorios Sugeridos */}
            {sugerencias && (sugerencias.motorizacion || sugerencias.bobina_apertura || sugerencias.bobina_cero_tension || sugerencias.contactos_auxiliares) && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-2.5">
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />
                  Accesorios Recomendados para el Interruptor Principal
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(sugerencias).map(([key, comp]) => {
                    if (!comp) return null;
                    const yaAsociado = accesorios.some((a) => a.id === comp.id || a.codigo === comp.codigo);
                    if (yaAsociado) return null;

                    const labelMap: Record<string, string> = {
                      motorizacion: "Mando a Motor",
                      bobina_apertura: "Bobina de Apertura (Shunt Trip)",
                      bobina_cero_tension: "Bobina de Cero Tensión",
                      contactos_auxiliares: "Contactos Auxiliares",
                    };

                    return (
                      <div key={key} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg p-2.5 text-xs shadow-sm">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-amber-800 uppercase tracking-tight block text-[10px]">
                            {labelMap[key]}
                          </span>
                          <span className="font-semibold text-gray-900 truncate block">
                            {comp.codigo}
                          </span>
                          <span className="text-gray-500 text-[11px] truncate block max-w-[320px]">
                            {comp.descripcion}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAsociarAccesorio(comp.id)}
                          className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded transition shrink-0 ml-2"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          Vincular
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Listado de Accesorios Asociados */}
            <div className="border border-surface-stroke bg-white rounded-lg overflow-hidden shadow-sm">
              <div className="border-b border-surface-stroke bg-slate-50 px-4 py-2.5 flex items-center justify-between min-h-[42px]">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4 text-abb-red" />
                  Accesorios Instalados en Interruptor Principal
                </h3>
                <button
                  type="button"
                  onClick={() => setModalAccesorioManual(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-abb-red hover:text-red-700 transition"
                >
                  <PlusIcon className="w-4 h-4" />
                  AGREGAR ACCESORIO MANUAL
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-700 bg-slate-100/90">
                      <th scope="col" className="py-1.5 px-3">Código</th>
                      <th scope="col" className="py-1.5 px-3">Código Comercial</th>
                      <th scope="col" className="py-1.5 px-3">Descripción</th>
                      <th scope="col" className="py-1.5 px-3">Precio</th>
                      <th scope="col" className="py-1.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accesorios.length > 0 ? (
                      accesorios.map((acc) => (
                        <tr key={acc.id} className="border-b border-surface-stroke hover:bg-gray-50/80 transition-colors">
                          <td className="p-3 font-mono text-xs font-semibold text-gray-900">{acc.codigo}</td>
                          <td className="p-3 font-mono text-xs text-gray-600">{acc.codigo_comercial || "—"}</td>
                          <td className="p-3 text-xs text-gray-700">{acc.descripcion}</td>
                          <td className="p-3 font-mono text-xs text-gray-900">
                            {acc.precio_neto ? `$ ${Number(acc.precio_neto).toLocaleString()}` : "Consultar"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDesasociarAccesorio(acc.id)}
                              className="text-gray-400 hover:text-abb-red p-1 rounded hover:bg-gray-100"
                              title="Desvincular accesorio"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400 italic text-xs">
                          No hay accesorios asociados al interruptor principal.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                    tipo_proteccion: sal.tipo_proteccion,
                    formato: sal.formato,
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
      
      {/* Modales */}
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

      {filaEnEdicion && (
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

      {modalIcc && (
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


      {modalInterruptor && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="interruptor-principal"
          titulo="Interruptor principal"
          onSelect={handleSeleccionarInterruptorPrincipal}
          onCancel={cerrarModales}
        />
      )}

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

      {modalAccesorioManual && (
        <ComponentePicker
          categorias={CATEGORIAS_ACCESORIOS}
          contextKey="accesorio-principal"
          titulo="Buscar Accesorio Manual"
          onSelect={async (componente) => {
            try {
              await asociarAccesorioPrincipal(tablero.id, componente.id);
              await cargarAccesorios();
              cerrarModales();
            } catch (err) {
              console.error("Error al asociar accesorio:", err);
            }
          }}
          onCancel={cerrarModales}
        />
      )}
    </div>
  );
}
