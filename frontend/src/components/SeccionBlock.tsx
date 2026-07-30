import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  actualizarSalida,
  crearSalida,
  duplicarSalida,
  eliminarSalida,
  reordenarSalidas,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type FormatoPolos,
  type Salida,
  type Seccion,
  type TipoProteccion,
  formatearCorriente,
  simularPropuesta,
  existeIncompatibilidadLink,
} from "../api/client";
import {
  Bars3Icon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PlusCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  QueueListIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { ComponentePicker } from "./ComponentePicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";
import { Badge } from "./common";

import { ModalLimiteFilaOpciones } from "./ModalLimiteFilaOpciones";
import { calcularCapacidadPolosFila, obtenerPolosSalida } from "../cad/generators/boardCadGenerator";

export interface ElementoAlimentadorCandidato {
  id: string;
  codigo: string;
  etiqueta?: string | null;
  tipo_proteccion: TipoProteccion;
  formato: FormatoPolos;
  carga: string;
}

export const FORMATO_LABEL: Record<FormatoPolos, string> = {
  unipolar: "1P",
  bipolar: "2P",
  tripolar: "3P",
  tetrapolar: "4P",
};

export const PROTECCION_LABEL: Record<TipoProteccion, string> = {
  seccional_termomagnetico: "Termomagnético",
  seccional_diferencial: "Diferencial",
};

interface SeccionBlockProps {
  seccion: Seccion;
  salidas: Salida[];
  todasLasSeccionesConSalidas?: { seccion: Seccion; salidas: Salida[] }[];
  gabineteAnchoMm?: number | null;
  onAbrirConfiguracionTablero?: () => void;
  onSaltoAutomaticoGabineteNIS?: (accionPendiente?: any) => Promise<void>;
  elementosCandidatos?: ElementoAlimentadorCandidato[];
  onSalidaCreada: (salida: Salida) => void;
  onSalidaActualizada: (salida: Salida) => void;
  onSalidaBorrada: (salidaId: string) => void;
  onSalidasReordenadas?: (salidasReordenadas: Salida[]) => void;
  hoveredSalidaId?: string | null;
  onSalidaHover?: (salidaId: string | null) => void;
}

interface FilaSalidaProps {
  salida: Salida;
  index: number;
  seccionOrden?: number;
  isHovered?: boolean;
  hoveredSalidaId?: string | null;
  elementosCandidatos?: ElementoAlimentadorCandidato[];
  onAbrirEdicion: (salida: Salida, trigger: HTMLElement) => void;
  onAbrirLink: (salida: Salida, trigger: HTMLElement) => void;
  onDuplicar: (salida: Salida) => void;
  onConfirmarBorrado: (salida: Salida, trigger: HTMLElement) => void;
  onDragStart: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  onDragOver: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  onDrop: (e: React.DragEvent<HTMLTableRowElement>, index: number) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function FilaSalida({
  salida,
  index,
  seccionOrden = 0,
  isHovered,
  hoveredSalidaId,
  elementosCandidatos = [],
  onAbrirEdicion,
  onAbrirLink,
  onDuplicar,
  onConfirmarBorrado,
  onDragStart,
  onDragOver,
  onDrop,
  onMouseEnter,
  onMouseLeave,
}: FilaSalidaProps) {
  const prevComponenteIdRef = useRef<string | null>(salida.componente_id);
  const [animar, setAnimar] = useState(false);

  useEffect(() => {
    if (prevComponenteIdRef.current !== salida.componente_id) {
      setAnimar(true);
      prevComponenteIdRef.current = salida.componente_id;
      const timer = setTimeout(() => setAnimar(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [salida.componente_id]);

  const formatoLabel: Record<FormatoPolos, string> = {
    unipolar: "1P",
    bipolar: "2P",
    tripolar: "3P",
    tetrapolar: "4P",
  };

  const codigoAuto = `F${seccionOrden + 1}.${index + 1}`;
  const parent = salida.alimentado_por_salida_id
    ? elementosCandidatos.find((c) => c.id === salida.alimentado_por_salida_id)
    : null;
  const hasLinkError = !!(
    parent &&
    existeIncompatibilidadLink(
      salida.formato,
      salida.tipo_proteccion,
      parent.formato,
      parent.tipo_proteccion
    )
  );
  const isDirectHover = isHovered;
  const isAlimentadaPorHovered = !!(
    hoveredSalidaId && salida.alimentado_por_salida_id === hoveredSalidaId
  );

  return (
    <tr
      id={`salida-fila-${salida.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`border-b border-line border-l-4 transition-colors duration-150 cursor-grab active:cursor-grabbing ${
        isDirectHover
          ? "bg-brand-tint text-ink border-l-brand font-medium"
          : isAlimentadaPorHovered
          ? "bg-info-tint text-ink border-l-info font-medium"
          : "border-l-transparent odd:bg-surface-sunken/40 hover:bg-surface-sunken"
      }`}
    >
      {/* Drag Handle & Auto-Code F1.1 */}
      <td className="p-2 text-center text-ink-muted w-16">
        <div className="flex items-center justify-center gap-1 dato-tecnico text-xs font-bold text-ink">
          <Bars3Icon className="w-3.5 h-3.5 text-ink-subtle select-none cursor-grab" title="Arrastrar para reordenar" />
          <span>{codigoAuto}</span>
        </div>
      </td>

      {/* Etiqueta / Circuito (Limitado para no expandir la tabla) */}
      <td className="p-3 font-semibold text-ink text-sm max-w-[280px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {salida.etiqueta ? (
            <span
              className="text-ink dato-tecnico text-xs font-semibold truncate inline-block max-w-[240px] align-middle"
              title={salida.etiqueta}
            >
              {salida.etiqueta}
            </span>
          ) : (
            <span className="text-ink-subtle italic text-xs">Sin tag</span>
          )}

          {salida.alimentado_por_codigo && (
            <Badge
              tone={hasLinkError ? "warning" : "brand"}
              className="inline-flex items-center gap-0.5 dato-tecnico text-[11px]"
              title={
                hasLinkError
                  ? `Advertencia: Polos incompatibles con alimentación ${salida.alimentado_por_codigo}`
                  : `Alimentado por ${salida.alimentado_por_codigo}`
              }
            >
              <LinkIcon className="w-3 h-3" />
              {salida.alimentado_por_codigo}
              {hasLinkError && <ExclamationTriangleIcon className="w-3.5 h-3.5 text-warning shrink-0 ml-1 animate-pulse" />}
            </Badge>
          )}
        </div>
      </td>

      {/* Carga */}
      <td className="p-3 dato-tecnico font-medium text-ink">
        {salida.carga_unidad === "A" ? `${formatearCorriente(salida.carga_valor)} A` : `${salida.carga_valor} ${salida.carga_unidad}`}
      </td>

      {/* Formato & Protección (Compacto) */}
      <td className="p-3 text-xs text-ink-muted whitespace-nowrap w-24">
        <span className="inline-flex items-center gap-1 bg-surface-sunken px-2 py-0.5 rounded-control text-[11px] font-medium text-ink border border-line">
          <span className="font-bold dato-tecnico text-ink">{formatoLabel[salida.formato]}</span>
          <span className="text-ink-subtle">({salida.tipo_proteccion === "seccional_diferencial" ? "Diff" : "TM"})</span>
        </span>
      </td>

      {/* Celda 1: Código ABB / SAP */}
      <td
        className={`p-3 dato-tecnico text-xs ${animar ? "animate-flash" : ""}`}
        title={salida.componente_codigo_comercial ?? undefined}
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {salida.componente_id ? (
            salida.asignado_manualmente ? (
              <PencilSquareIcon
                className="w-3.5 h-3.5 text-brand shrink-0"
                title="Asignado manualmente por el analista"
              />
            ) : (
              <Cog6ToothIcon
                className="w-3.5 h-3.5 text-info shrink-0"
                title="Propuesta automática calculada"
              />
            )
          ) : (
            <ExclamationTriangleIcon
              className="w-3.5 h-3.5 text-warning shrink-0 cursor-help"
              title={salida.motivo_sin_match ?? "Sin propuesta automática para esta carga"}
            />
          )}
          <span className={salida.componente_id ? "font-bold text-ink" : "text-warning-line font-normal italic text-xs"}>
            {salida.componente_id ? (salida.componente_codigo ?? salida.componente_id) : "Sin match"}
          </span>
        </div>
      </td>

      {/* Celda 2: Descripción del Componente */}
      <td className="p-3 text-xs text-gray-700 min-w-[200px] max-w-[320px]">
        {salida.componente_descripcion ? (
          <span className="truncate block font-sans" title={salida.componente_descripcion}>
            {salida.componente_descripcion}
          </span>
        ) : salida.componente_codigo_comercial ? (
          <span className="truncate block font-sans text-gray-800" title={salida.componente_codigo_comercial}>
            {salida.componente_codigo_comercial}
          </span>
        ) : (
          <span className="text-gray-400 italic text-[11px]">
            {salida.motivo_sin_match ? `Sin match (${salida.motivo_sin_match})` : "—"}
          </span>
        )}
      </td>

      {/* Acciones */}
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1.5 text-gray-500">
          <button
            type="button"
            aria-label={`Vincular alimentación de ${codigoAuto}`}
            onClick={(e) => {
              e.stopPropagation();
              onAbrirLink(salida, e.currentTarget);
            }}
            className={`p-1 rounded transition ${
              salida.alimentado_por_salida_id
                ? "text-abb-red bg-red-50 hover:bg-red-100"
                : "hover:text-abb-red hover:bg-gray-100"
            }`}
            title={salida.alimentado_por_codigo ? `Alimentado por ${salida.alimentado_por_codigo}` : "Linkear alimentación a otro elemento"}
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={`Duplicar salida ${salida.carga_valor} ${salida.carga_unidad}`}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicar(salida);
            }}
            className="hover:text-abb-red p-1 rounded hover:bg-gray-100"
            title="Duplicar salida"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={`Editar salida ${salida.carga_valor} ${salida.carga_unidad}`}
            onClick={(e) => {
              e.stopPropagation();
              onAbrirEdicion(salida, e.currentTarget);
            }}
            className="hover:text-abb-red p-1 rounded hover:bg-gray-100"
            title="Editar salida"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={`Borrar salida ${salida.carga_valor} ${salida.carga_unidad}`}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmarBorrado(salida, e.currentTarget);
            }}
            className="hover:text-abb-red p-1 rounded hover:bg-gray-100"
            title="Borrar salida"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function SeccionBlock({
  seccion,
  salidas,
  todasLasSeccionesConSalidas = [],
  gabineteAnchoMm,
  onAbrirConfiguracionTablero,
  onSaltoAutomaticoGabineteNIS,
  elementosCandidatos = [],
  onSalidaCreada,
  onSalidaActualizada,
  onSalidaBorrada,
  onSalidasReordenadas,
  hoveredSalidaId,
  onSalidaHover,
}: SeccionBlockProps) {
  const [etiqueta, setEtiqueta] = useState("");
  const [cargaValor, setCargaValor] = useState("");
  const cargaUnidad = "A";
  const [formato, setFormato] = useState<FormatoPolos>("unipolar");
  const [tipoProteccion, setTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [sensibilidadMa, setSensibilidadMa] = useState<number>(30);
  const [admiteAccesorios, setAdmiteAccesorios] = useState<boolean>(false);
  const cargaInvalidaEntero = cargaValor.trim() !== "" && Number(cargaValor) % 1 !== 0;

  const [error, setError] = useState<string | null>(null);
  const [salidaEnEdicion, setSalidaEnEdicion] = useState<Salida | null>(null);
  const [editEtiqueta, setEditEtiqueta] = useState("");
  const [editCargaValor, setEditCargaValor] = useState("");
  const editCargaUnidad = "A";
  const [editFormato, setEditFormato] = useState<FormatoPolos>("unipolar");
  const [editTipoProteccion, setEditTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [editSensibilidadMa, setEditSensibilidadMa] = useState<number>(30);
  const [editAdmiteAccesorios, setEditAdmiteAccesorios] = useState<boolean>(false);
  
  // Local edit states for component selection
  const [editComponenteId, setEditComponenteId] = useState<string | null>(null);
  const [editComponenteCodigo, setEditComponenteCodigo] = useState<string | null>(null);
  const [editComponenteDescripcion, setEditComponenteDescripcion] = useState<string | null>(null);
  const [editAsignadoManualmente, setEditAsignadoManualmente] = useState<boolean>(false);

  // States for real-time validation / proposal simulation
  const [simulacionMotivo, setSimulacionMotivo] = useState<string | null>(null);
  const [simulacionCargando, setSimulacionCargando] = useState<boolean>(false);

  const editCargaInvalidaEntero =
    editCargaUnidad === "A" && editCargaValor.trim() !== "" && Number(editCargaValor) % 1 !== 0;

  useEffect(() => {
    if (!salidaEnEdicion) {
      setSimulacionMotivo(null);
      setSimulacionCargando(false);
      return;
    }

    if (editAsignadoManualmente) {
      setSimulacionMotivo(null);
      setSimulacionCargando(false);
      return;
    }

    if (!editCargaValor.trim() || editCargaInvalidaEntero) {
      setSimulacionMotivo(null);
      setSimulacionCargando(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSimulacionCargando(true);
      try {
        const res = await simularPropuesta(seccion.id, {
          formato: editFormato,
          tipo_proteccion: editTipoProteccion,
          carga_valor: editCargaValor,
          carga_unidad: editCargaUnidad,
          sensibilidad_ma: editTipoProteccion === "seccional_diferencial" ? editSensibilidadMa : null,
          admite_accesorios: editTipoProteccion === "seccional_diferencial" ? editAdmiteAccesorios : null,
        });

        if (idSalidaEnEdicionRef.current !== salidaEnEdicion.id) return;

        if (!res.compatible) {
          setSimulacionMotivo(res.motivo);
        } else {
          setSimulacionMotivo(null);
        }
      } catch (err) {
        console.error("Error simulating proposal", err);
      } finally {
        setSimulacionCargando(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [
    salidaEnEdicion,
    editAsignadoManualmente,
    editCargaValor,
    editCargaUnidad,
    editFormato,
    editTipoProteccion,
    editSensibilidadMa,
    editAdmiteAccesorios,
    editCargaInvalidaEntero,
    seccion.id,
  ]);

  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [salidaABorrar, setSalidaABorrar] = useState<Salida | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Estado Modal Linkeo 🔗
  const [salidaEnLink, setSalidaEnLink] = useState<Salida | null>(null);
  const [padreSeleccionadoId, setPadreSeleccionadoId] = useState<string | null>(null);
  const [guardandoLink, setGuardandoLink] = useState(false);

  const ultimoTriggerRef = useRef<HTMLElement | null>(null);
  const editCargaInputRef = useRef<HTMLInputElement>(null);
  const idSalidaEnEdicionRef = useRef<string | null>(null);

  function abrirLink(salida: Salida, trigger: HTMLElement) {
    ultimoTriggerRef.current = trigger;
    setSalidaEnLink(salida);
    setPadreSeleccionadoId(salida.alimentado_por_salida_id ?? null);
  }

  async function handleGuardarLink(event: FormEvent) {
    event.preventDefault();
    if (!salidaEnLink) return;
    setGuardandoLink(true);
    setError(null);
    try {
      const actualizada = await actualizarSalida(salidaEnLink.id, {
        alimentado_por_salida_id: padreSeleccionadoId,
      });
      onSalidaActualizada(actualizada);
      setSalidaEnLink(null);
      ultimoTriggerRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el enlace de alimentación");
    } finally {
      setGuardandoLink(false);
    }
  }

  const candidatosElegibles = elementosCandidatos.filter(
    (c) => c.id !== salidaEnLink?.id
  );

  const [modalLimiteState, setModalLimiteState] = useState<{
    isOpen: boolean;
    filaOrigenNombre: string;
    polosSolicitados: number;
    polosDisponiblesOrigen: number;
    filaDisponible?: { id: string; nombre: string } | null;
    accion:
      | { tipo: "crear"; datos: any }
      | { tipo: "editar"; salidaId: string; cambios: any }
      | { tipo: "duplicar"; salidaId: string };
  } | null>(null);

  const capacidadFila = calcularCapacidadPolosFila(gabineteAnchoMm);

  function verificarLimiteFila(
    polosAdicionales: number,
    salidaIgnoradaId?: string
  ): {
    excedido: boolean;
    polosDisponiblesOrigen: number;
    filaDisponible: { id: string; nombre: string } | null;
  } {
    const polosActualesOrigen = salidas
      .filter((s: Salida) => s.id !== salidaIgnoradaId)
      .reduce((sum: number, s: Salida) => sum + obtenerPolosSalida(s), 0);

    const excedido = polosActualesOrigen + polosAdicionales > capacidadFila;
    const polosDisponiblesOrigen = Math.max(0, capacidadFila - polosActualesOrigen);

    if (!excedido) {
      return { excedido: false, polosDisponiblesOrigen, filaDisponible: null };
    }

    let filaDisponible: { id: string; nombre: string } | null = null;
    if (todasLasSeccionesConSalidas) {
      for (const item of todasLasSeccionesConSalidas) {
        if (item.seccion.id === seccion.id) continue;
        const polosItem = item.salidas
          .filter((s: Salida) => s.id !== salidaIgnoradaId)
          .reduce((sum: number, s: Salida) => sum + obtenerPolosSalida(s), 0);

        if (polosItem + polosAdicionales <= capacidadFila) {
          filaDisponible = { id: item.seccion.id, nombre: item.seccion.nombre };
          break;
        }
      }
    }

    return { excedido: true, polosDisponiblesOrigen, filaDisponible };
  }

  async function ejecutarAccionModalMover(targetFilaId: string) {
    if (!modalLimiteState) return;
    const { accion } = modalLimiteState;
    setModalLimiteState(null);
    setError(null);
    try {
      if (accion.tipo === "crear") {
        const salida = await crearSalida(targetFilaId, accion.datos);
        onSalidaCreada(salida);
        setCargaValor("");
        setEtiqueta("");
      } else if (accion.tipo === "editar") {
        const actualizada = await actualizarSalida(accion.salidaId, {
          ...accion.cambios,
          seccion_id: targetFilaId,
        });
        onSalidaActualizada(actualizada);
        cerrarEdicion();
      } else if (accion.tipo === "duplicar") {
        const duplicada = await duplicarSalida(accion.salidaId);
        if (duplicada.seccion_id !== targetFilaId) {
          const reubicada = await actualizarSalida(duplicada.id, { seccion_id: targetFilaId });
          onSalidaCreada(reubicada);
        } else {
          onSalidaCreada(duplicada);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la acción en la nueva fila");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const datos = {
      etiqueta: etiqueta.trim() || undefined,
      carga_valor: cargaValor,
      carga_unidad: cargaUnidad,
      formato,
      tipo_proteccion: tipoProteccion,
      sensibilidad_ma: tipoProteccion === "seccional_diferencial" ? sensibilidadMa : undefined,
      admite_accesorios: tipoProteccion === "seccional_diferencial" ? admiteAccesorios : undefined,
    };

    const polosNuevos = obtenerPolosSalida({ formato, tipo_proteccion: tipoProteccion } as any);
    const check = verificarLimiteFila(polosNuevos);

    if (check.excedido) {
      setModalLimiteState({
        isOpen: true,
        filaOrigenNombre: seccion.nombre,
        polosSolicitados: polosNuevos,
        polosDisponiblesOrigen: check.polosDisponiblesOrigen,
        filaDisponible: check.filaDisponible,
        accion: { tipo: "crear", datos },
      });
      return; // STOP! No API call or CAD installation!
    }

    try {
      const salida = await crearSalida(seccion.id, datos);
      onSalidaCreada(salida);
      setCargaValor("");
      setEtiqueta("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la salida");
    }
  }

  async function handleDuplicar(salida: Salida) {
    setError(null);

    const polosNuevos = obtenerPolosSalida(salida);
    const check = verificarLimiteFila(polosNuevos);

    if (check.excedido) {
      setModalLimiteState({
        isOpen: true,
        filaOrigenNombre: seccion.nombre,
        polosSolicitados: polosNuevos,
        polosDisponiblesOrigen: check.polosDisponiblesOrigen,
        filaDisponible: check.filaDisponible,
        accion: { tipo: "duplicar", salidaId: salida.id },
      });
      return; // STOP! No API call or CAD installation!
    }

    try {
      const duplicada = await duplicarSalida(salida.id);
      onSalidaCreada(duplicada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo duplicar la salida");
    }
  }

  // Drag & Drop handlers
  function handleDragStart(_e: React.DragEvent<HTMLTableRowElement>, index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent<HTMLTableRowElement>, _index: number) {
    e.preventDefault();
  }

  async function handleDrop(_e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) {
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const copia = [...salidas];
    const [removido] = copia.splice(draggedIndex, 1);
    copia.splice(dropIndex, 0, removido);
    setDraggedIndex(null);

    const idsReordenados = copia.map((s) => s.id);
    if (onSalidasReordenadas) {
      onSalidasReordenadas(copia);
    }
    try {
      await reordenarSalidas(seccion.id, idsReordenados);
    } catch {
      setError("No se pudo guardar el orden de las salidas");
    }
  }

  const handleEditSpecChange = () => {
    setEditComponenteId(null);
    setEditComponenteCodigo(null);
    setEditComponenteDescripcion(null);
    setEditAsignadoManualmente(false);
  };

  function abrirEdicion(salida: Salida, trigger: HTMLElement) {
    ultimoTriggerRef.current = trigger;
    idSalidaEnEdicionRef.current = salida.id;
    setSalidaEnEdicion(salida);
    setEditEtiqueta(salida.etiqueta ?? "");
    setEditCargaValor(salida.carga_valor);
    const formatoValido =
      salida.tipo_proteccion === "seccional_diferencial" && (salida.formato === "unipolar" || salida.formato === "tripolar")
        ? salida.formato === "unipolar"
          ? "bipolar"
          : "tetrapolar"
        : salida.formato;
    setEditFormato(formatoValido);
    setEditTipoProteccion(salida.tipo_proteccion);
    setEditSensibilidadMa(salida.sensibilidad_ma ?? 30);
    setEditAdmiteAccesorios(salida.admite_accesorios ?? false);
    
    // Set local states for component
    setEditComponenteId(salida.componente_id ?? null);
    setEditComponenteCodigo(salida.componente_codigo ?? null);
    setEditComponenteDescripcion(salida.componente_descripcion ?? salida.componente_codigo_comercial ?? null);
    setEditAsignadoManualmente(salida.asignado_manualmente);
    setError(null);
  }

  function cerrarEdicion() {
    idSalidaEnEdicionRef.current = null;
    setSalidaEnEdicion(null);
    setPickerAbierto(false);
    
    // Reset local component states
    setEditComponenteId(null);
    setEditComponenteCodigo(null);
    setEditComponenteDescripcion(null);
    setEditAsignadoManualmente(false);
    
    setError(null);
    ultimoTriggerRef.current?.focus();
  }

  function solicitarCierreEdicion() {
    cerrarEdicion();
  }

  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(solicitarCierreEdicion);

  useEffect(() => {
    if (!salidaEnEdicion || pickerAbierto) return;
    editCargaInputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") solicitarCierreEdicion();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [salidaEnEdicion, pickerAbierto]);

  async function handleGuardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!salidaEnEdicion) return;
    const idEditada = salidaEnEdicion.id;
    setError(null);

    const payload: any = {
      etiqueta: editEtiqueta.trim() || undefined,
      carga_valor: editCargaValor,
      carga_unidad: editCargaUnidad,
      formato: editFormato,
      tipo_proteccion: editTipoProteccion,
      sensibilidad_ma: editTipoProteccion === "seccional_diferencial" ? editSensibilidadMa : undefined,
      admite_accesorios: editTipoProteccion === "seccional_diferencial" ? editAdmiteAccesorios : undefined,
    };

    if (editAsignadoManualmente) {
      payload.componente_id = editComponenteId;
      payload.asignado_manualmente = true;
    }

    const polosNuevos = obtenerPolosSalida({
      formato: editFormato,
      tipo_proteccion: editTipoProteccion,
      componente_codigo: editComponenteCodigo,
      componente_descripcion: editComponenteDescripcion,
    } as any);

    const check = verificarLimiteFila(polosNuevos, salidaEnEdicion.id);

    if (check.excedido) {
      setModalLimiteState({
        isOpen: true,
        filaOrigenNombre: seccion.nombre,
        polosSolicitados: polosNuevos,
        polosDisponiblesOrigen: check.polosDisponiblesOrigen,
        filaDisponible: check.filaDisponible,
        accion: { tipo: "editar", salidaId: idEditada, cambios: payload },
      });
      return; // STOP! No API call or CAD update!
    }

    try {
      const actualizada = await actualizarSalida(idEditada, payload);
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      onSalidaActualizada(actualizada);
      cerrarEdicion();
    } catch (err) {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError(err instanceof Error ? err.message : "No se pudo actualizar la salida");
    }
  }

  function handleReasignarComponente(componente: ComponenteBusqueda) {
    setEditComponenteId(componente.id);
    setEditComponenteCodigo(componente.codigo);
    setEditComponenteDescripcion(componente.descripcion ?? componente.codigo_comercial ?? null);
    setEditAsignadoManualmente(true);
    setPickerAbierto(false);
  }

  async function handleConfirmarBorrado() {
    if (!salidaABorrar) return;
    setBorrando(true);
    try {
      await eliminarSalida(salidaABorrar.id);
      onSalidaBorrada(salidaABorrar.id);
      setSalidaABorrar(null);
      ultimoTriggerRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la salida");
    } finally {
      setBorrando(false);
    }
  }

  function cancelarBorrado() {
    setSalidaABorrar(null);
    setError(null);
    ultimoTriggerRef.current?.focus();
  }

  const [modoVista, setModoVista] = useState<"tabla" | "tarjetas">("tabla");

  return (
    <div className="mt-4 border border-surface-stroke bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="border-b border-surface-stroke bg-industrial-gray px-4 py-2 flex items-center justify-between min-h-[42px] gap-2">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <QueueListIcon className="w-4 h-4 text-abb-red" />
          <span className="sr-only">{seccion.nombre} - </span>
          <span>Circuitos Registrados</span>
          <span className="text-[10px] text-slate-500 font-normal lowercase font-sans">({salidas.length} salidas)</span>
        </h3>

        <div className="flex items-center gap-4">
          {/* Selector de Modo de Vista: Tabla vs Tarjetas */}
          <div className="flex items-center gap-1 border border-gray-300 rounded p-0.5 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setModoVista("tabla")}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded transition ${
              modoVista === "tabla" ? "bg-abb-red text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
            title="Vista en tabla de alta densidad (Ingeniería)"
          >
            <QueueListIcon className="w-3.5 h-3.5" />
            Tabla
          </button>
          <button
            type="button"
            onClick={() => setModoVista("tarjetas")}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded transition ${
              modoVista === "tarjetas" ? "bg-abb-red text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
            title="Vista en tarjetas ejecutivas"
          >
            <Squares2X2Icon className="w-3.5 h-3.5" />
            Tarjetas
          </button>
        </div>
      </div>
    </div>

      {modoVista === "tabla" ? (
        <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#2C3645] text-slate-100 font-mono text-[11px] uppercase tracking-wider border-b border-slate-700">
                <th scope="col" className="py-2.5 px-2 w-8 text-center font-bold">#</th>
                <th scope="col" className="py-2.5 px-3 font-bold">Circuito</th>
                <th scope="col" className="py-2.5 px-3 font-bold">Carga</th>
                <th scope="col" className="py-2.5 px-3 font-bold">Formato / Protec</th>
                <th scope="col" className="py-2.5 px-3 font-bold">Código ABB</th>
                <th scope="col" className="py-2.5 px-3 font-bold">Descripción</th>
                <th scope="col" className="py-2.5 px-3 text-right font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {salidas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500 text-xs italic">
                    Sin salidas en esta sección. Utilizá el botón inferior para agregar la primera.
                  </td>
                </tr>
              ) : (
                salidas.map((salida, idx) => (
                  <FilaSalida
                    key={salida.id}
                    salida={salida}
                    index={idx}
                    seccionOrden={seccion.orden != null ? seccion.orden : 0}
                    isHovered={hoveredSalidaId === salida.id}
                    hoveredSalidaId={hoveredSalidaId}
                    elementosCandidatos={elementosCandidatos}
                    onAbrirEdicion={abrirEdicion}
                    onAbrirLink={abrirLink}
                    onDuplicar={handleDuplicar}
                    onConfirmarBorrado={(sal, trigger) => {
                      ultimoTriggerRef.current = trigger;
                      setSalidaABorrar(sal);
                    }}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onMouseEnter={() => onSalidaHover?.(salida.id)}
                    onMouseLeave={() => onSalidaHover?.(null)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Modo Vista Tarjetas */
        <div className="p-4 bg-gray-50/50">
          {salidas.length === 0 ? (
            <p className="p-6 text-center text-gray-500 text-xs italic">
              Sin salidas en esta sección. Utilizá el botón inferior para agregar la primera.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {salidas.map((salida, idx) => {
                const sNum = (seccion.orden != null ? seccion.orden : 0) + 1;
                const codigoAuto = `F${sNum}.${idx + 1}`;
                const isHovered = hoveredSalidaId === salida.id;
                return (
                  <div
                    key={salida.id}
                    onMouseEnter={() => onSalidaHover?.(salida.id)}
                    onMouseLeave={() => onSalidaHover?.(null)}
                    className={`p-4 rounded-xl border bg-white shadow-sm transition flex flex-col justify-between space-y-3 ${
                      isHovered ? "border-abb-red ring-2 ring-abb-red/20 shadow-md" : "border-surface-stroke hover:border-gray-400"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-abb-red bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          {codigoAuto}
                        </span>
                        {salida.etiqueta && (
                          <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {salida.etiqueta}
                          </span>
                        )}
                      </div>

                      {salida.alimentado_por_codigo && (
                        <div className="text-[11px] font-mono text-abb-red flex items-center gap-1 font-semibold">
                          <LinkIcon className="w-3 h-3" /> Alimentado por: {salida.alimentado_por_codigo}
                        </div>
                      )}

                      <div className="text-sm font-bold text-gray-900 font-mono">
                        Carga: {salida.carga_unidad === "A" ? `${formatearCorriente(salida.carga_valor)} A` : `${salida.carga_valor} ${salida.carga_unidad}`}
                      </div>

                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="font-bold bg-gray-100 px-1.5 py-0.5 rounded border text-gray-800">{FORMATO_LABEL[salida.formato]}</span>
                        <span>•</span>
                        <span>{PROTECCION_LABEL[salida.tipo_proteccion]}</span>
                      </div>

                      <div className="text-xs border-t border-gray-100 pt-2 font-mono">
                        {salida.componente_id ? (
                          <span className="text-gray-900 font-semibold truncate block" title={salida.componente_descripcion ?? salida.componente_codigo ?? undefined}>
                            {salida.componente_codigo ?? salida.componente_id}
                          </span>
                        ) : (
                          <span className="text-amber-600 italic">Sin componente ABB asignado</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 border-t border-gray-100 pt-2">
                      <button
                        type="button"
                        onClick={(e) => abrirLink(salida, e.currentTarget)}
                        className="p-1.5 text-gray-500 hover:text-abb-red hover:bg-gray-100 rounded"
                        title="Linkear alimentación"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => abrirEdicion(salida, e.currentTarget)}
                        className="p-1.5 text-gray-500 hover:text-abb-red hover:bg-gray-100 rounded"
                        title="Editar salida"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicar(salida)}
                        className="p-1.5 text-gray-500 hover:text-abb-red hover:bg-gray-100 rounded"
                        title="Duplicar salida"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          ultimoTriggerRef.current = e.currentTarget;
                          setSalidaABorrar(salida);
                        }}
                        className="p-1.5 text-gray-500 hover:text-abb-red hover:bg-gray-100 rounded"
                        title="Borrar salida"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mostrarFormulario ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3.5 p-4 border-t border-surface-stroke bg-gray-50/90 shadow-inner rounded-b-lg">
          <div>
            <label htmlFor={`tag-${seccion.id}`} className="block text-xs font-semibold text-gray-700 mb-1">
              Circuito / Tag
            </label>
            <input
              id={`tag-${seccion.id}`}
              placeholder="Ej. PG01"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              className="w-32 text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
            />
          </div>

          <div>
            <label htmlFor={`carga-${seccion.id}`} className="block text-xs font-semibold text-gray-700 mb-1">
              Calibre / Carga (A) *
            </label>
            <select
              id={`carga-${seccion.id}`}
              value={Math.round(Number(cargaValor) || 0) > 0 ? String(Math.round(Number(cargaValor))) : cargaValor}
              onChange={(e) => setCargaValor(e.target.value)}
              className="min-w-[150px] text-sm font-mono font-bold border border-gray-300 rounded-md px-3 pr-8 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
            >
              <option value="">Seleccionar calibre...</option>
              {["6", "10", "16", "20", "25", "30", "32", "40", "50", "63", "80", "100", "125"].map((cal) => (
                <option key={cal} value={cal}>
                  {cal} A
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`formato-${seccion.id}`} className="block text-xs font-semibold text-gray-700 mb-1">
              Formato
            </label>
            <select
              id={`formato-${seccion.id}`}
              value={formato}
              onChange={(e) => setFormato(e.target.value as FormatoPolos)}
              className="min-w-[150px] text-sm border border-gray-300 rounded-md px-3 pr-8 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
            >
              {tipoProteccion !== "seccional_diferencial" && <option value="unipolar">Unipolar (1P)</option>}
              <option value="bipolar">Bipolar (2P)</option>
              {tipoProteccion !== "seccional_diferencial" && <option value="tripolar">Tripolar (3P)</option>}
              <option value="tetrapolar">Tetrapolar (4P)</option>
            </select>
          </div>

          <div>
            <label htmlFor={`proteccion-${seccion.id}`} className="block text-xs font-semibold text-gray-700 mb-1">
              Protección
            </label>
            <select
              id={`proteccion-${seccion.id}`}
              value={tipoProteccion}
              onChange={(e) => {
                const nuevoTipo = e.target.value as TipoProteccion;
                setTipoProteccion(nuevoTipo);
                if (nuevoTipo === "seccional_diferencial" && (formato === "unipolar" || formato === "tripolar")) {
                  setFormato(formato === "unipolar" ? "bipolar" : "tetrapolar");
                }
              }}
              className="min-w-[165px] text-sm border border-gray-300 rounded-md px-3 pr-8 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
            >
              <option value="seccional_termomagnetico">Termomagnético</option>
              <option value="seccional_diferencial">Diferencial</option>
            </select>
          </div>

          {tipoProteccion === "seccional_diferencial" && (
            <>
              <div>
                <label htmlFor={`sensibilidad-${seccion.id}`} className="block text-xs font-semibold text-gray-700 mb-1">
                  Sensibilidad
                </label>
                <select
                  id={`sensibilidad-${seccion.id}`}
                  value={sensibilidadMa}
                  onChange={(e) => setSensibilidadMa(Number(e.target.value))}
                  className="min-w-[130px] text-sm border border-gray-300 rounded-md px-3 pr-8 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
                >
                  <option value={30}>30 mA</option>
                  <option value={10}>10 mA</option>
                  <option value={100}>100 mA</option>
                  <option value={300}>300 mA</option>
                  <option value={500}>500 mA</option>
                </select>
              </div>

              <div>
                <label htmlFor={`accesorios-${seccion.id}`} className="block text-xs font-semibold text-gray-700 mb-1">
                  Accesorios
                </label>
                <select
                  id={`accesorios-${seccion.id}`}
                  value={admiteAccesorios ? "true" : "false"}
                  onChange={(e) => setAdmiteAccesorios(e.target.value === "true")}
                  className="min-w-[150px] text-sm border border-gray-300 rounded-md px-3 pr-8 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
                >
                  <option value="false">Sin accesorios</option>
                  <option value="true">Con accesorios</option>
                </select>
              </div>
            </>
          )}

          {error && !salidaEnEdicion && !salidaABorrar && (
            <p role="alert" className="text-xs text-red-600 w-full">
              {error}
            </p>
          )}

          <div className="flex gap-2 ml-auto">
            <button
              type="submit"
              disabled={cargaInvalidaEntero || !cargaValor.trim()}
              className="bg-abb-red hover:bg-red-700 text-white font-medium px-4 py-1.5 text-xs uppercase tracking-wider rounded shadow disabled:opacity-50 transition"
            >
              + Agregar Salida (Enter)
            </button>
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              className="border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 py-1.5 text-xs font-medium rounded transition"
            >
              Cerrar
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3 border-t border-surface-stroke bg-gray-50/40">
          <button
            type="button"
            onClick={() => setMostrarFormulario(true)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-abb-red hover:underline"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Nueva salida
          </button>
        </div>
      )}

      {/* Modal Editar Salida */}
      {salidaEnEdicion && !pickerAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onMouseDown={onMouseDownModal}
          onClick={onClickModal}
        >
          <form
            onSubmit={handleGuardarEdicion}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-salida-titulo"
            className="flex w-full max-w-sm flex-col gap-3 border border-surface-stroke bg-white p-6 rounded-lg shadow-xl"
          >
            <h2 id="editar-salida-titulo" className="text-lg font-bold text-gray-900 border-b pb-2">
              Editar salida
            </h2>

            <div className="space-y-1">
              <label htmlFor="edit-tag" className="text-xs font-semibold text-gray-700">Tag / Identificador de Circuito</label>
              <input
                id="edit-tag"
                placeholder="Ej. PG01"
                value={editEtiqueta}
                onChange={(e) => setEditEtiqueta(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:border-abb-red focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-carga-valor" className="text-xs font-semibold text-gray-700">
                Calibre / Carga Nominal (A) *
              </label>
              <select
                id="edit-carga-valor"
                value={Math.round(Number(editCargaValor) || 0) > 0 ? String(Math.round(Number(editCargaValor))) : editCargaValor}
                onChange={(e) => {
                  setEditCargaValor(e.target.value);
                  handleEditSpecChange();
                }}
                className="w-full text-sm font-mono font-bold border border-gray-300 rounded px-3 py-2 bg-white focus:border-abb-red focus:outline-none"
              >
                {["6", "10", "16", "20", "25", "30", "32", "40", "50", "63", "80", "100", "125"].map((cal) => (
                  <option key={cal} value={cal}>
                    {cal} A (Estándar ABB)
                  </option>
                ))}
              </select>
            </div>

            {editCargaInvalidaEntero && (
              <p className="text-red-600 text-xs bg-red-50 p-1.5 rounded">Los amperios deben ser un valor entero</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="edit-formato" className="text-xs font-semibold text-gray-700">Formato</label>
                <select
                  id="edit-formato"
                  value={editFormato}
                  onChange={(e) => {
                    setEditFormato(e.target.value as FormatoPolos);
                    handleEditSpecChange();
                  }}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:border-abb-red focus:outline-none"
                >
                  {editTipoProteccion !== "seccional_diferencial" && <option value="unipolar">Unipolar (1P)</option>}
                  <option value="bipolar">Bipolar (2P)</option>
                  {editTipoProteccion !== "seccional_diferencial" && <option value="tripolar">Tripolar (3P)</option>}
                  <option value="tetrapolar">Tetrapolar (4P)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-proteccion" className="text-xs font-semibold text-gray-700">Protección</label>
                <select
                  id="edit-proteccion"
                  value={editTipoProteccion}
                  onChange={(e) => {
                    const nuevoTipo = e.target.value as TipoProteccion;
                    setEditTipoProteccion(nuevoTipo);
                    if (nuevoTipo === "seccional_diferencial" && (editFormato === "unipolar" || editFormato === "tripolar")) {
                      setEditFormato(editFormato === "unipolar" ? "bipolar" : "tetrapolar");
                    }
                    handleEditSpecChange();
                  }}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:border-abb-red focus:outline-none"
                >
                  <option value="seccional_termomagnetico">Termomagnético</option>
                  <option value="seccional_diferencial">Diferencial</option>
                </select>
              </div>
            </div>

            {editTipoProteccion === "seccional_diferencial" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="edit-sensibilidad" className="text-xs font-semibold text-gray-700">Sensibilidad</label>
                  <select
                    id="edit-sensibilidad"
                    value={editSensibilidadMa}
                    onChange={(e) => {
                      setEditSensibilidadMa(Number(e.target.value));
                      handleEditSpecChange();
                    }}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:border-abb-red focus:outline-none"
                  >
                    <option value={30}>30 mA</option>
                    <option value={10}>10 mA</option>
                    <option value={100}>100 mA</option>
                    <option value={300}>300 mA</option>
                    <option value={500}>500 mA</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="edit-accesorios" className="text-xs font-semibold text-gray-700">Accesorios</label>
                  <select
                    id="edit-accesorios"
                    value={editAdmiteAccesorios ? "true" : "false"}
                    onChange={(e) => {
                      setEditAdmiteAccesorios(e.target.value === "true");
                      handleEditSpecChange();
                    }}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:border-abb-red focus:outline-none"
                  >
                    <option value="false">Sin accesorios</option>
                    <option value="true">Con accesorios</option>
                  </select>
                </div>
              </div>
            )}

            {simulacionMotivo && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded text-xs flex gap-2 items-start" role="alert">
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Parámetros incompatibles:</span>
                  <span className="text-[11px] leading-relaxed block text-amber-700">{simulacionMotivo}</span>
                </div>
              </div>
            )}

            <div className="border-t border-b py-2 text-xs text-gray-600 flex items-center justify-between">
              <span>Componente actual:</span>
              <div className="text-right min-w-0">
                {simulacionCargando ? (
                  <span className="text-[10px] text-gray-400 italic animate-pulse">
                    Verificando...
                  </span>
                ) : (
                  <>
                    <span className={editComponenteId ? "font-mono font-semibold block text-sm text-gray-900" : "font-mono font-normal block text-xs text-amber-600 italic"}>
                      {editComponenteId
                        ? (editComponenteCodigo ?? editComponenteId)
                        : "Se recalculará automáticamente"}
                    </span>
                    {editComponenteId && editComponenteDescripcion && (
                      <span className="text-gray-500 text-[10px] truncate max-w-[240px] block" title={editComponenteDescripcion}>
                        {editComponenteDescripcion}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              className="w-full border border-gray-300 text-gray-800 hover:border-abb-red hover:text-abb-red px-3 py-2 text-xs font-semibold rounded uppercase tracking-wider transition"
            >
              Cambiar componente en catálogo
            </button>

            {error && <p role="alert" className="text-xs text-red-600 font-semibold">{error}</p>}

            <div className="flex gap-2 justify-end pt-2 border-t mt-1">
              <button
                type="button"
                onClick={solicitarCierreEdicion}
                className="border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-1.5 text-xs font-medium rounded transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editCargaInvalidaEntero || !editCargaValor.trim()}
                className="bg-abb-red hover:bg-red-700 text-white font-medium px-4 py-1.5 text-xs uppercase tracking-wider rounded shadow disabled:opacity-50 transition"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {salidaEnEdicion && pickerAbierto && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="salida-componente"
          titulo="Cambiar componente"
          tipoProteccion={editTipoProteccion}
          sensibilidadMa={editTipoProteccion === "seccional_diferencial" ? editSensibilidadMa : undefined}
          admiteAccesorios={editTipoProteccion === "seccional_diferencial" ? editAdmiteAccesorios : undefined}
          onSelect={handleReasignarComponente}
          onCancel={() => setPickerAbierto(false)}
        />
      )}

      {/* Modal de Linkeo de Alimentación 🔗 */}
      {salidaEnLink && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-abb-red" />
                Linkear Fuente de Alimentación
              </h2>
              <button
                type="button"
                onClick={() => setSalidaEnLink(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarLink} className="space-y-4">
              <p className="text-xs text-gray-600">
                Seleccioná el elemento desde el cual recibe energía el circuito:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {/* Opción 1: Alimentación estándar desde barral / Q1 */}
                <label
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                    padreSeleccionadoId === null
                      ? "border-abb-red bg-red-50/60 text-gray-900 font-semibold"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="alimentador"
                      checked={padreSeleccionadoId === null}
                      onChange={() => setPadreSeleccionadoId(null)}
                      className="accent-abb-red"
                    />
                    <span>⚡ Alimentación estándar (Embarrado / Q1)</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-mono">Por defecto</span>
                </label>

                {/* Lista de candidatos elegibles del tablero */}
                {candidatosElegibles.map((candidato) => (
                  <label
                    key={candidato.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                      padreSeleccionadoId === candidato.id
                        ? "border-abb-red bg-red-50/60 text-gray-900 font-semibold"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="alimentador"
                        checked={padreSeleccionadoId === candidato.id}
                        onChange={() => setPadreSeleccionadoId(candidato.id)}
                        className="accent-abb-red"
                      />
                      <span className="font-mono font-bold text-abb-red">{candidato.codigo}</span>
                      <span>{candidato.etiqueta ? `(${candidato.etiqueta})` : (PROTECCION_LABEL[candidato.tipo_proteccion] ?? candidato.tipo_proteccion)}</span>
                    </div>
                    <span className="text-[11px] text-gray-500 font-mono">{candidato.carga}</span>
                  </label>
                ))}
              </div>

              {(() => {
                if (!padreSeleccionadoId || !salidaEnLink) return null;
                const parent = candidatosElegibles.find((c) => c.id === padreSeleccionadoId);
                if (!parent) return null;
                const tieneMismatch = existeIncompatibilidadLink(
                  salidaEnLink.formato,
                  salidaEnLink.tipo_proteccion,
                  parent.formato,
                  parent.tipo_proteccion
                );
                if (tieneMismatch) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded text-xs flex gap-2 items-start my-3" role="alert">
                      <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block mb-0.5">Advertencia de Enlace:</span>
                        <span className="text-[11px] leading-relaxed block text-amber-700">
                          Estás vinculando un {salidaEnLink.tipo_proteccion === "seccional_diferencial" ? "Diferencial" : "Termomagnético"} {FORMATO_LABEL[salidaEnLink.formato]} con un {parent.tipo_proteccion === "seccional_diferencial" ? "Diferencial" : "Termomagnético"} {FORMATO_LABEL[parent.formato]}.
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSalidaEnLink(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoLink}
                  className="px-4 py-2 text-xs font-semibold bg-abb-red hover:bg-red-700 text-white rounded transition disabled:opacity-50"
                >
                  {guardandoLink ? "Guardando..." : "Guardar Enlace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {salidaABorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={`Esto va a borrar la salida de ${salidaABorrar.carga_valor} ${salidaABorrar.carga_unidad}.`}
          confirmando={borrando}
          error={error}
          onConfirm={handleConfirmarBorrado}
          onCancel={cancelarBorrado}
        />
      )}

      {modalLimiteState && (
        <ModalLimiteFilaOpciones
          isOpen={modalLimiteState.isOpen}
          filaOrigenNombre={modalLimiteState.filaOrigenNombre}
          polosSolicitados={modalLimiteState.polosSolicitados}
          polosDisponiblesOrigen={modalLimiteState.polosDisponiblesOrigen}
          filaDisponible={modalLimiteState.filaDisponible}
          onMoverAFila={(targetFilaId) => ejecutarAccionModalMover(targetFilaId)}
          onConfigurarNuevoTablero={async () => {
            const accion = modalLimiteState.accion;
            setModalLimiteState(null);
            if (onSaltoAutomaticoGabineteNIS) {
              await onSaltoAutomaticoGabineteNIS(accion);
            } else {
              onAbrirConfiguracionTablero?.();
            }
          }}
          onCancelar={() => setModalLimiteState(null)}
        />
      )}
    </div>
  );
}
