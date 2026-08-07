import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  CheckCircleIcon,
  CubeIcon,
  ArrowsPointingInIcon,
  SparklesIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import {
  actualizarSeccion,
  actualizarTablero,
  crearSalida,
  actualizarSalida,
  duplicarSalida,
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
import { Button, Field, Input, Modal } from "./common";
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
const TAB_BOM = "bom";

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
  const [canaletaCategoria, setCanaletaCategoria] = useState<"todas" | "periferia" | "interiores">("todas");
  const [flashAnimacion, setFlashAnimacion] = useState(false);
  const [errorIncompatibleMsg, setErrorIncompatibleMsg] = useState<string | null>(null);

  const [configFisicaLocal, setConfigFisicaLocal] = useState<{
    gabinete_manual_ancho_mm?: number | null;
    gabinete_manual_alto_mm?: number | null;
    paso_manual?: number | null;
    cablecanal_sugerido?: string | null;
    cablecanal_periferia?: string | null;
    cablecanal_interiores?: string | null;
  }>({});

  useEffect(() => {
    setConfigFisicaLocal({
      gabinete_manual_ancho_mm: tablero.gabinete_manual_ancho_mm ?? null,
      gabinete_manual_alto_mm: tablero.gabinete_manual_alto_mm ?? null,
      paso_manual: tablero.paso_manual ?? null,
      cablecanal_sugerido: tablero.cablecanal_sugerido ?? null,
      cablecanal_periferia: tablero.cablecanal_periferia ?? null,
      cablecanal_interiores: tablero.cablecanal_interiores ?? null,
    });
  }, [
    tablero.gabinete_manual_ancho_mm,
    tablero.gabinete_manual_alto_mm,
    tablero.paso_manual,
    tablero.cablecanal_sugerido,
    tablero.cablecanal_periferia,
    tablero.cablecanal_interiores,
  ]);

  const gabineteAnchoEfectivo =
    configFisicaLocal.gabinete_manual_ancho_mm !== undefined
      ? (configFisicaLocal.gabinete_manual_ancho_mm || tablero.gabinete_sugerido_ancho_mm)
      : (tablero.gabinete_manual_ancho_mm || tablero.gabinete_sugerido_ancho_mm);

  const gabineteAltoEfectivo =
    configFisicaLocal.gabinete_manual_alto_mm !== undefined
      ? (configFisicaLocal.gabinete_manual_alto_mm || tablero.gabinete_sugerido_alto_mm)
      : (tablero.gabinete_manual_alto_mm || tablero.gabinete_sugerido_alto_mm);

  const pasoManualEfectivo =
    configFisicaLocal.paso_manual !== undefined
      ? configFisicaLocal.paso_manual
      : tablero.paso_manual;

  const pasoMmEfectivo = pasoManualEfectivo || tablero.paso_mm || 150;

  const cablecanalEfectivo =
    configFisicaLocal.cablecanal_sugerido !== undefined
      ? configFisicaLocal.cablecanal_sugerido
      : tablero.cablecanal_sugerido;

  const cablecanalPeriferiaEfectivo =
    configFisicaLocal.cablecanal_periferia !== undefined
      ? configFisicaLocal.cablecanal_periferia
      : tablero.cablecanal_periferia;

  const cablecanalInterioresEfectivo =
    configFisicaLocal.cablecanal_interiores !== undefined
      ? configFisicaLocal.cablecanal_interiores
      : tablero.cablecanal_interiores;

  const esManualFisico = Boolean(
    (configFisicaLocal.gabinete_manual_ancho_mm && configFisicaLocal.gabinete_manual_alto_mm) ||
    configFisicaLocal.paso_manual !== null ||
    configFisicaLocal.cablecanal_periferia ||
    configFisicaLocal.cablecanal_interiores
  );

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
    (tabSeleccionadoRaw === TAB_PRINCIPAL || tabSeleccionadoRaw === TAB_BOM || (secciones ?? []).some((s) => s.seccion.id === tabSeleccionadoRaw))
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

  const dispararFlash = useCallback(() => {
    setFlashAnimacion(true);
    const timer = setTimeout(() => setFlashAnimacion(false), 600);
    return () => clearTimeout(timer);
  }, []);

  async function handleCambiarConfigFisica(cambios: any) {
    setConfigFisicaLocal((prev) => ({ ...prev, ...cambios }));
    dispararFlash();
    try {
      const actualizado = await actualizarTablero(tablero.id, cambios);
      onTableroActualizado(actualizado);
      await cargar();
    } catch (err) {
      console.error("Error al actualizar config física:", err);
      // Revertir estado local si falló por incompatibilidad
      setConfigFisicaLocal({
        gabinete_manual_ancho_mm: tablero.gabinete_manual_ancho_mm ?? null,
        gabinete_manual_alto_mm: tablero.gabinete_manual_alto_mm ?? null,
        paso_manual: tablero.paso_manual ?? null,
        cablecanal_sugerido: tablero.cablecanal_sugerido ?? null,
        cablecanal_periferia: tablero.cablecanal_periferia ?? null,
        cablecanal_interiores: tablero.cablecanal_interiores ?? null,
      });
      const msg = err instanceof Error ? err.message : "El gabinete seleccionado es demasiado pequeño para alojar las filas/polos del tablero.";
      setErrorIncompatibleMsg(msg);
    }
  }

  async function handleRestaurarAuto() {
    const resetValues = {
      gabinete_manual_ancho_mm: null,
      gabinete_manual_alto_mm: null,
      paso_manual: null,
      cablecanal_sugerido: null,
      cablecanal_periferia: null,
      cablecanal_interiores: null,
    };
    setConfigFisicaLocal(resetValues);
    dispararFlash();
    try {
      const actualizado = await actualizarTablero(tablero.id, resetValues);
      onTableroActualizado(actualizado);
      setConfigFisicaLocal({
        gabinete_manual_ancho_mm: actualizado.gabinete_manual_ancho_mm ?? null,
        gabinete_manual_alto_mm: actualizado.gabinete_manual_alto_mm ?? null,
        paso_manual: actualizado.paso_manual ?? null,
        cablecanal_sugerido: actualizado.cablecanal_sugerido ?? null,
        cablecanal_periferia: actualizado.cablecanal_periferia ?? null,
        cablecanal_interiores: actualizado.cablecanal_interiores ?? null,
      });
      await cargar();
    } catch (err) {
      console.error("Error al restaurar auto:", err);
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
    const targetSecId = salida.seccion_id || seccionId;
    setSecciones((actuales) =>
      (actuales ?? []).map((s) =>
        s.seccion.id === targetSecId
          ? { ...s, salidas: [...s.salidas.filter((x) => x.id !== salida.id), salida] }
          : { ...s, salidas: s.salidas.filter((x) => x.id !== salida.id) }
      )
    );
    try {
      const tabActualizado = await obtenerTablero(tablero.id);
      onTableroActualizado(tabActualizado);
    } catch (err) {
      console.error("Error refreshing board:", err);
    }
  }

  async function handleSalidaActualizada(seccionId: string, salida: Salida) {
    const targetSecId = salida.seccion_id || seccionId;
    setSecciones((actuales) =>
      (actuales ?? []).map((s) =>
        s.seccion.id === targetSecId
          ? {
              ...s,
              salidas: s.salidas.some((x) => x.id === salida.id)
                ? s.salidas.map((x) => (x.id === salida.id ? salida : x))
                : [...s.salidas, salida],
            }
          : { ...s, salidas: s.salidas.filter((x) => x.id !== salida.id) }
      )
    );
    try {
      const tabActualizado = await obtenerTablero(tablero.id);
      onTableroActualizado(tabActualizado);
    } catch (err) {
      console.error("Error refreshing board:", err);
    }
  }

  async function handleSaltoAutomaticoGabineteNIS(seccionOrigenId: string, accionPendiente?: any) {
    try {
      const numSecciones = (secciones ?? []).length;
      const nuevaSec = await crearSeccion(tablero.id, `Fila ${numSecciones + 1}`, numSecciones);
      const targetSecId = nuevaSec.id;

      setSecciones((actuales) => [...(actuales ?? []), { seccion: nuevaSec, salidas: [] }]);
      setTabSeleccionadoRaw(nuevaSec.id);

      if (accionPendiente) {
        if (accionPendiente.tipo === "crear") {
          const salida = await crearSalida(targetSecId, accionPendiente.datos);
          await handleSalidaCreada(targetSecId, salida);
        } else if (accionPendiente.tipo === "editar") {
          const actualizada = await actualizarSalida(accionPendiente.salidaId, {
            ...accionPendiente.cambios,
            seccion_id: targetSecId,
          });
          await handleSalidaActualizada(seccionOrigenId, actualizada);
        } else if (accionPendiente.tipo === "duplicar") {
          const duplicada = await duplicarSalida(accionPendiente.salidaId);
          if (duplicada.seccion_id !== targetSecId) {
            const reubicada = await actualizarSalida(duplicada.id, { seccion_id: targetSecId });
            await handleSalidaCreada(targetSecId, reubicada);
          } else {
            await handleSalidaCreada(targetSecId, duplicada);
          }
        }
      }

      const tabFinal = await obtenerTablero(tablero.id);
      onTableroActualizado(tabFinal);
    } catch (err) {
      console.error("Error al ejecutar salto automático de gabinete NIS:", err);
      setError(err instanceof Error ? err.message : "No se pudo crear la nueva fila de gabinete");
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
      {/* BANNER DIAGNÓSTICO INTERACTIVO: CAPACIDAD DE RIEL vs OCUPACIÓN TOTAL */}
      {tablero.excede_largo_riel && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 p-4 rounded-xl shadow-md space-y-3 font-sans">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-amber-950 uppercase tracking-wide">
                Aviso de Capacidad de Riel en Gabinete ({tablero.gabinete_sugerido_ancho_mm || 450} mm)
              </h4>
              <p className="text-xs leading-relaxed text-amber-800">
                La Fila actual contiene <strong>{tablero.max_polos_por_fila} polos</strong>, sobrepasando la capacidad del riel DIN del gabinete sugerido (<strong>{tablero.capacidad_polos_linea} polos/riel</strong>). El gabinete posee actualmente un <strong>{tablero.porcentaje_ocupacion}% de ocupación total de polos</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {tablero.siguiente_gabinete_ancho_mm && tablero.siguiente_gabinete_ancho_mm > (tablero.gabinete_sugerido_ancho_mm || 0) && (
              <button
                type="button"
                onClick={async () => {
                  if (tablero.siguiente_gabinete_ancho_mm) {
                    const act = await actualizarTablero(tablero.id, { paso_manual: tablero.siguiente_gabinete_ancho_mm });
                    onTableroActualizado(act);
                  }
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow transition"
              >
                Ampliar a {tablero.siguiente_gabinete_ancho_mm} mm de Ancho
              </button>
            )}
            <span className="px-3 py-1.5 bg-white text-amber-900 border border-amber-300 font-medium text-xs rounded-lg shadow-sm">
              Sugerencia: Redistribuir elementos a filas libres del mismo gabinete
            </span>
          </div>
        </div>
      )}

      {/* ZONA SUPERIOR: TABS DE FILAS Y CONFIGURACIÓN A ANCHO COMPLETO */}
      <div className="w-full mt-1 bg-surface border border-line rounded-card shadow-card flex flex-col min-h-[340px]">
        {/* Header con Pestañas de Selección de Sección y Toolbar de Acciones */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-line bg-surface-sunken/60 p-1.5 gap-2 shrink-0 rounded-t-card">
          {/* Listado de Pestañas (Scroll horizontal si es necesario) */}
          <nav className="flex gap-1 p-0.5 bg-surface-sunken rounded-control border border-line max-w-full overflow-x-auto scrollbar-none" role="tablist" aria-label="Filas del tablero">
            <button
              role="tab"
              aria-selected={tabActivo === TAB_PRINCIPAL}
              aria-label="Principal"
              type="button"
              onClick={() => setTabSeleccionadoRaw(TAB_PRINCIPAL)}
              className={`px-2.5 py-1 text-xs font-sans rounded-control transition-all duration-150 flex items-center gap-1.5 ${
                tabActivo === TAB_PRINCIPAL
                  ? "bg-surface text-brand shadow-control font-bold border border-line"
                  : "text-ink-muted hover:text-ink hover:bg-surface-sunken font-medium"
              }`}
            >
              <span aria-hidden="true" className="opacity-60 font-mono text-[11px] font-bold">00</span>
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
                  className={`px-2.5 py-1 text-xs font-sans rounded-control transition-all duration-150 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-surface text-ink shadow-control font-bold border border-line"
                      : "text-ink-muted hover:text-ink hover:bg-surface-sunken font-medium"
                  }`}
                >
                  <span aria-hidden="true" className={`font-mono text-[11px] font-bold ${isSelected ? "text-brand" : "opacity-50"}`}>{sNum}</span>
                  <span className="truncate max-w-[120px]">{seccion.nombre}</span>
                  <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono transition-colors ${
                    isSelected ? "bg-brand-tint text-brand border border-brand-line" : "bg-surface-sunken text-ink-muted"
                  }`} aria-hidden="true">
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
                      <th scope="col" className="py-1.5 px-3">Accesorio</th>
                      <th scope="col" className="py-1.5 px-3">Código ABB</th>
                      <th scope="col" className="py-1.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accesorios.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-xs text-gray-400 italic">
                          No hay accesorios asociados al interruptor principal.
                        </td>
                      </tr>
                    ) : (
                      accesorios.map((acc) => (
                        <tr key={acc.id} className="border-b border-surface-stroke hover:bg-gray-50 text-xs">
                          <td className="p-3 font-semibold text-gray-900">{acc.descripcion}</td>
                          <td className="p-3 font-mono font-medium text-gray-700">{acc.codigo}</td>
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
                todasLasSeccionesConSalidas={secciones ?? []}
                gabineteAnchoMm={tablero.gabinete_sugerido_ancho_mm}
                gabineteActualAncho={gabineteAnchoEfectivo}
                gabineteActualAlto={gabineteAltoEfectivo}
                gabineteSugerido={
                  tablero.gabinete_sugerido_ancho_mm && tablero.gabinete_sugerido_alto_mm
                    ? { codigo: tablero.gabinete_sugerido_codigo || undefined, ancho: tablero.gabinete_sugerido_ancho_mm, alto: tablero.gabinete_sugerido_alto_mm }
                    : null
                }
                gabineteAlternativo={
                  tablero.gabinete_alternativo_ancho_mm && tablero.gabinete_alternativo_alto_mm
                    ? { codigo: tablero.gabinete_alternativo_codigo || undefined, ancho: tablero.gabinete_alternativo_ancho_mm, alto: tablero.gabinete_alternativo_alto_mm }
                    : null
                }
                onCambiarConfigFisica={handleCambiarConfigFisica}
                onAbrirConfiguracionTablero={() => {
                  setPanelLateralColapsado(false);
                  dispararFlash();
                }}
                onSaltoAutomaticoGabineteNIS={(accion) => handleSaltoAutomaticoGabineteNIS(seccionSeleccionada.seccion.id, accion)}
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

      {/* ZONA DE VISOR CAD Y PANEL LATERAL DERECHO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Columna Izquierda: Visor del Unifilar / Bloques LIVE_SCHEMATIC_VIEWER */}
        <div className={`${panelLateralColapsado ? "lg:col-span-12" : "lg:col-span-8"} w-full flex flex-col justify-start h-full transition-all duration-300 rounded-xl ${flashAnimacion ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20" : ""}`}>
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
            cablecanalSugerido={cablecanalEfectivo}
            cablecanalPeriferia={cablecanalPeriferiaEfectivo}
            cablecanalInteriores={cablecanalInterioresEfectivo}
            gabineteSugeridoAncho={gabineteAnchoEfectivo}
            gabineteSugeridoAlto={gabineteAltoEfectivo}
            pasoMm={pasoMmEfectivo}
            tableroId={tablero.id}
            panelLateralColapsado={panelLateralColapsado}
            onTogglePanelLateral={() => setPanelLateralColapsado(false)}
          />
        </div>

        {/* Columna Derecha: Tarjetas de Control y Parámetros (~32%, ocultas si panelLateralColapsado === true) */}
        {!panelLateralColapsado && (
          <div className="lg:col-span-4 w-full flex flex-col gap-4">
            {/* Cabecera Identica sobre las Tarjetas Laterales */}
            <div className="flex items-center justify-between bg-industrial-gray border border-surface-stroke rounded-xl px-4 py-2 shadow-sm min-h-[46px] shrink-0">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5 truncate">
                <BoltIcon className="w-4 h-4 text-abb-red shrink-0" />
                <span className="truncate">PANEL LATERAL</span>
              </span>
              <button
                type="button"
                onClick={() => setPanelLateralColapsado(true)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-sans font-normal rounded-lg border border-gray-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors shrink-0"
                title="Comprimir tarjetas laterales"
              >
                <ArrowsPointingInIcon className="w-3.5 h-3.5 text-abb-red shrink-0" />
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

              {/* Card: GABINETE Y ESTRUCTURA REUNIFICADO */}
              <div className={`bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden shrink-0 transition-all duration-300 ${flashAnimacion ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20" : ""}`}>
                <div className="border-b border-surface-stroke bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <CubeIcon className="w-4 h-4 text-abb-red" /> GABINETE Y ESTRUCTURA
                  </h4>
                  <div className="flex items-center gap-1.5">
                    {esManualFisico ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <PencilSquareIcon className="w-3 h-3 text-amber-600" />
                          MANUAL
                        </span>
                        <button
                          type="button"
                          onClick={handleRestaurarAuto}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition cursor-pointer"
                          title="Restaurar cálculo automático Nollmann / Zoloda"
                        >
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          Restaurar Auto
                        </button>
                      </>
                    ) : configFisicaLocal.gabinete_manual_ancho_mm ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                          <SparklesIcon className="w-3 h-3 text-sky-600" />
                          AUTO ({configFisicaLocal.gabinete_manual_ancho_mm}mm)
                        </span>
                        <button
                          type="button"
                          onClick={handleRestaurarAuto}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition cursor-pointer"
                          title="Restaurar cálculo automático Nollmann"
                        >
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          Restaurar Auto
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <SparklesIcon className="w-3 h-3 text-emerald-600" />
                        AUTO
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-500 font-medium">CÓDIGO GABINETE:</span>
                    <span className="font-bold text-gray-900">
                      {tablero.gabinete_sugerido_codigo || "NIS 450.600.XX"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-500 font-medium">MEDIDAS REALES:</span>
                    <span className="font-bold text-gray-900">
                      {gabineteAnchoEfectivo && gabineteAltoEfectivo
                        ? `${gabineteAnchoEfectivo} x ${gabineteAltoEfectivo} x 225 mm`
                        : "—"}
                    </span>
                  </div>

                  {/* 1. TAMAÑO GABINETE */}
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <label htmlFor="dim-gabinete" className="text-gray-500 font-medium">TAMAÑO GABINETE:</label>
                    <select
                      id="dim-gabinete"
                      value={configFisicaLocal.gabinete_manual_ancho_mm && configFisicaLocal.gabinete_manual_alto_mm ? `${configFisicaLocal.gabinete_manual_ancho_mm}x${configFisicaLocal.gabinete_manual_alto_mm}` : "auto"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "auto") {
                          handleCambiarConfigFisica({
                            gabinete_manual_ancho_mm: null,
                            gabinete_manual_alto_mm: null,
                          });
                        } else {
                          const [w, h] = val.split("x").map((n) => parseInt(n));
                          handleCambiarConfigFisica({
                            gabinete_manual_ancho_mm: w,
                            gabinete_manual_alto_mm: h,
                          });
                        }
                      }}
                      className="border border-surface-stroke bg-white px-2 py-0.5 text-xs font-bold text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-abb-red cursor-pointer"
                    >
                      <option value="auto">Auto ({tablero.gabinete_sugerido_codigo || "NIS 450.600.XX"})</option>
                      <option value="450x600">NIS 450.600.XX (450 x 600 mm)</option>
                      <option value="600x600">NIS 600.600.XX (600 x 600 mm)</option>
                      <option value="450x750">NIS 450.750.XX (450 x 750 mm)</option>
                      <option value="600x750">NIS 600.750.XX (600 x 750 mm)</option>
                      <option value="750x750">NIS 750.750.XX (750 x 750 mm)</option>
                      <option value="600x1050">NIS 600.1050.XX (600 x 1050 mm)</option>
                      <option value="750x1050">NIS 750.1050.XX (750 x 1050 mm)</option>
                      <option value="600x1200">NIS 600.1200.XX (600 x 1200 mm)</option>
                      <option value="750x1200">NIS 750.1200.XX (750 x 1200 mm)</option>
                      <option value="1000x1350">NIS 1000.1350.XX (1000 x 1350 mm)</option>
                    </select>
                  </div>



                  {/* 2. PASO INTER-FILAS */}
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <label htmlFor="dim-paso" className="text-gray-500 font-medium">PASO INTER-FILAS:</label>
                    <select
                      id="dim-paso"
                      value={configFisicaLocal.paso_manual === null || configFisicaLocal.paso_manual === undefined ? "auto" : configFisicaLocal.paso_manual.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleCambiarConfigFisica({
                          paso_manual: val === "auto" ? null : parseInt(val),
                        });
                      }}
                      className="border border-surface-stroke bg-white px-2 py-0.5 text-xs font-bold text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-abb-red cursor-pointer"
                    >
                      <option value="auto">Auto ({tablero.paso_mm || 150} mm)</option>
                      <option value="150">150 mm (Estándar ABB)</option>
                      <option value="200">200 mm (Paso Ampliado)</option>
                    </select>
                  </div>

                  {/* 3. CATEGORÍA APLICA CANALETA */}
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <label htmlFor="dim-categoria" className="text-gray-500 font-medium">CATEGORÍA APLICA:</label>
                    <select
                      id="dim-categoria"
                      value={canaletaCategoria}
                      onChange={(e) => setCanaletaCategoria(e.target.value as "todas" | "periferia" | "interiores")}
                      className="border border-surface-stroke bg-white px-2 py-0.5 text-xs font-bold text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer"
                    >
                      <option value="todas">Todas (Periferia + Interiores)</option>
                      <option value="periferia">Periferia (Costados + Fondo)</option>
                      <option value="interiores">Interiores (Entre Filas)</option>
                    </select>
                  </div>

                  {/* 4. SECCIÓN CABLE CANAL */}
                  <div className="flex justify-between items-center py-1">
                    <label htmlFor="dim-cablecanal" className="text-gray-500 font-medium">CABLE CANAL:</label>
                    <select
                      id="dim-cablecanal"
                      value={
                        canaletaCategoria === "periferia"
                          ? (configFisicaLocal.cablecanal_periferia || configFisicaLocal.cablecanal_sugerido || "auto")
                          : canaletaCategoria === "interiores"
                          ? (configFisicaLocal.cablecanal_interiores || configFisicaLocal.cablecanal_sugerido || "auto")
                          : (configFisicaLocal.cablecanal_sugerido || "auto")
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        const targetVal = val === "auto" ? null : val;
                        if (canaletaCategoria === "periferia") {
                          handleCambiarConfigFisica({ cablecanal_periferia: targetVal });
                        } else if (canaletaCategoria === "interiores") {
                          handleCambiarConfigFisica({ cablecanal_interiores: targetVal });
                        } else {
                          handleCambiarConfigFisica({
                            cablecanal_sugerido: targetVal,
                            cablecanal_periferia: targetVal,
                            cablecanal_interiores: targetVal,
                          });
                        }
                      }}
                      className="border border-surface-stroke bg-white px-2 py-0.5 text-xs font-bold text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer"
                    >
                      <option value="auto">Auto ({tablero.cablecanal_sugerido || "25x40"} mm)</option>
                      <option value="25x40">25 x 40 mm</option>
                      <option value="40x40">40 x 40 mm</option>
                      <option value="40x60">40 x 60 mm</option>
                      <option value="60x60">60 x 60 mm</option>
                      <option value="60x80">60 x 80 mm</option>
                      <option value="80x80">80 x 80 mm</option>
                    </select>
                  </div>
                </div>
              </div>

          </div>
        )}
      </div>
      {modalNuevaFila && (
        <Modal
          titulo="Nueva fila"
          subtitulo="Creación de sección DIN para distribución de circuitos"
          icon={<PlusIcon className="w-5 h-5 text-abb-red" />}
          onClose={solicitarCierreModales}
          error={error}
          footer={
            <>
              <Button type="submit" variant="primary" form="form-nueva-fila">
                Agregar fila
              </Button>
              <Button type="button" variant="secondary" onClick={cerrarModales}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-nueva-fila" onSubmit={handleCrearFila} className="space-y-4">
            <Field label="Nombre">
              {(props) => (
                <Input
                  {...props}
                  ref={nombreFilaInputRef}
                  value={nombreNuevaFila}
                  onChange={(e) => setNombreNuevaFila(e.target.value)}
                  required
                />
              )}
            </Field>
          </form>
        </Modal>
      )}

      {filaEnEdicion && (
        <Modal
          titulo="Renombrar fila"
          subtitulo="Modificación del identificador de sección DIN"
          icon={<PencilIcon className="w-5 h-5 text-abb-red" />}
          onClose={solicitarCierreModales}
          error={error}
          footer={
            <>
              <Button type="submit" variant="primary" form="form-renombrar-fila">
                Guardar
              </Button>
              <Button type="button" variant="secondary" onClick={solicitarCierreModales}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-renombrar-fila" onSubmit={handleRenombrarFila} className="space-y-4">
            <Field label="Nombre">
              {(props) => (
                <Input
                  {...props}
                  ref={nombreFilaInputRef}
                  value={nombreFilaEdit}
                  onChange={(e) => setNombreFilaEdit(e.target.value)}
                  required
                />
              )}
            </Field>
          </form>
        </Modal>
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
        <Modal
          titulo="Intensidad de Cortocircuito (Icc)"
          subtitulo="Configuración del nivel de falla del sistema en kA"
          icon={<Cog6ToothIcon className="w-5 h-5 text-abb-red" />}
          onClose={solicitarCierreModales}
          error={error}
          footer={
            <>
              <Button type="submit" variant="primary" form="form-modal-icc">
                Guardar
              </Button>
              <Button type="button" variant="secondary" onClick={solicitarCierreModales}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-modal-icc" onSubmit={handleGuardarNivelFalla} className="space-y-4">
            <Field label="Nuevo nivel de falla (kA)">
              {(props) => (
                <Input
                  {...props}
                  ref={nivelFallaInputRef}
                  value={nivelFallaKaEdit}
                  onChange={(e) => setNivelFallaKaEdit(e.target.value)}
                  mono
                />
              )}
            </Field>
          </form>
        </Modal>
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
        <Modal
          titulo="Renombrar Tablero"
          subtitulo="Actualización de denominación técnica del tablero"
          icon={<PencilIcon className="w-5 h-5 text-abb-red" />}
          onClose={solicitarCierreModales}
          error={error}
          footer={
            <>
              <Button
                type="submit"
                variant="primary"
                form="form-renombrar-tablero"
                disabled={guardandoTablero || !nombreTableroEdit.trim()}
              >
                {guardandoTablero ? "Guardando..." : "Guardar Nombre"}
              </Button>
              <Button type="button" variant="secondary" onClick={solicitarCierreModales}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-renombrar-tablero" onSubmit={handleGuardarNombreTablero} className="space-y-4">
            <Field label="Nombre del Tablero">
              {(props) => (
                <Input
                  {...props}
                  id="nombre-tablero-input"
                  ref={nombreTableroInputRef}
                  type="text"
                  value={nombreTableroEdit}
                  onChange={(e) => setNombreTableroEdit(e.target.value)}
                  placeholder="ej. Tablero General T-01"
                  required
                />
              )}
            </Field>
          </form>
        </Modal>
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

      {/* Modal de Advertencia por Límite / Incompatibilidad Estricta de Gabinete Nollmann NIS */}
      {errorIncompatibleMsg && (() => {
        const currW = gabineteAnchoEfectivo || 450;
        const currH = gabineteAltoEfectivo || 600;

        let optEstandarAncho = tablero.gabinete_sugerido_ancho_mm || currW;
        let optEstandarAlto = tablero.gabinete_sugerido_alto_mm || (currH + 150);

        if (optEstandarAncho === currW && optEstandarAlto === currH) {
          const listH = [600, 750, 1050, 1200, 1350, 1500, 1650, 1800, 2000];
          optEstandarAlto = listH.find((h) => h > currH) || (currH + 150);
        }

        let optAltAncho = tablero.gabinete_alternativo_ancho_mm || (currW === 450 ? 600 : 750);
        let optAltAlto = tablero.gabinete_alternativo_alto_mm || currH;

        if (optAltAncho === optEstandarAncho && optAltAlto === optEstandarAlto) {
          optAltAncho = currW === 450 ? 600 : 750;
        }

        return (
          <Modal
            titulo="Límite de Capacidad - Selección de Gabinete"
            subtitulo="Capacidad física superada en la envolvente actual"
            icon={<ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />}
            onClose={() => setErrorIncompatibleMsg(null)}
            footer={
              <Button type="button" variant="secondary" onClick={() => setErrorIncompatibleMsg(null)}>
                Cerrar
              </Button>
            }
          >
            <div className="flex items-start gap-3 p-2 border-b border-gray-100 pb-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-full shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1 text-xs font-sans">
                <p className="font-bold text-gray-900 text-sm">
                  Capacidad del Gabinete Actual Superada
                </p>
                <p className="text-gray-700 leading-relaxed">
                  {errorIncompatibleMsg}
                </p>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-xs font-bold text-gray-800">
                Seleccione una opción para ampliar el gabinete y resolver el límite:
              </p>

              <div className="space-y-2">
                {/* Opción 1: Gabinete Sugerido Estándar */}
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-emerald-900">
                      Opción Recomendada (Por Menor Costo):
                    </div>
                    <div className="text-xs font-mono font-semibold text-emerald-700">
                      NIS {optEstandarAncho}.{optEstandarAlto}.XX ({optEstandarAncho} x {optEstandarAlto} mm)
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setErrorIncompatibleMsg(null);
                      handleCambiarConfigFisica({
                        gabinete_manual_ancho_mm: optEstandarAncho,
                        gabinete_manual_alto_mm: optEstandarAlto,
                      });
                    }}
                  >
                    Aplicar {optEstandarAncho}x{optEstandarAlto}
                  </Button>
                </div>

                {/* Opción 2: Formato Alternativo (Más Ancho) */}
                <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-sky-900">
                      Opción Formato Alternativo (Más Ancho):
                    </div>
                    <div className="text-xs font-mono font-semibold text-sky-700">
                      NIS {optAltAncho}.{optAltAlto}.XX ({optAltAncho} x {optAltAlto} mm)
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setErrorIncompatibleMsg(null);
                      handleCambiarConfigFisica({
                        gabinete_manual_ancho_mm: optAltAncho,
                        gabinete_manual_alto_mm: optAltAlto,
                      });
                    }}
                  >
                    Aplicar {optAltAncho}x{optAltAlto}
                  </Button>
                </div>

                {/* Opción 3: Restaurar Modo Auto */}
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-gray-800">
                      Restaurar Selección Automática
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Permite que el sistema adapte el gabinete automáticamente
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setErrorIncompatibleMsg(null);
                      handleRestaurarAuto();
                    }}
                  >
                    Restaurar Auto
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
