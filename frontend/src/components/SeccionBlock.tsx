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
} from "../api/client";
import { ComponentePicker } from "./ComponentePicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";

interface SeccionBlockProps {
  seccion: Seccion;
  salidas: Salida[];
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
  isHovered?: boolean;
  onAbrirEdicion: (salida: Salida, trigger: HTMLElement) => void;
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
  isHovered,
  onAbrirEdicion,
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

  return (
    <tr
      id={`salida-fila-${salida.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`border-b border-surface-stroke transition-all duration-150 cursor-grab active:cursor-grabbing ${
        isHovered
          ? "bg-red-50 text-gray-900 border-l-4 border-l-abb-red font-medium"
          : "odd:bg-gray-50/60 hover:bg-gray-100/80"
      }`}
    >
      {/* Drag Handle */}
      <td className="p-2 text-center text-gray-400 w-8">
        <span className="material-symbols-outlined text-base select-none">drag_indicator</span>
      </td>

      {/* Etiqueta / Circuito */}
      <td className="p-3 font-semibold text-gray-900 text-sm">
        {salida.etiqueta ? (
          <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-mono text-xs border border-gray-200">
            {salida.etiqueta}
          </span>
        ) : (
          <span className="text-gray-400 italic text-xs">Sin tag</span>
        )}
      </td>

      {/* Carga */}
      <td className="p-3 font-mono font-medium text-gray-900">
        {salida.carga_unidad === "A" ? `${formatearCorriente(salida.carga_valor)} A` : `${salida.carga_valor} ${salida.carga_unidad}`}
      </td>

      {/* Formato & Protección */}
      <td className="p-3 text-xs text-gray-700">
        <span className="font-semibold text-gray-900 mr-1.5">{formatoLabel[salida.formato]}</span>
        <span className="text-gray-500">
          ({salida.tipo_proteccion === "seccional_termomagnetico" ? "TM" : "Diff"})
        </span>
      </td>

      {/* Código SAP / Comercial + Ícono de Estado Integrado */}
      <td className={`p-3 font-mono text-xs ${animar ? "animate-flash" : ""}`}>
        <div className="flex items-center gap-2">
          {salida.componente_id ? (
            salida.asignado_manualmente ? (
              <span
                className="material-symbols-outlined text-abb-red text-base shrink-0"
                title="Asignado manualmente por el analista"
              >
                edit_note
              </span>
            ) : (
              <span
                className="material-symbols-outlined text-blue-600 text-base shrink-0"
                title="Propuesta automática calculada"
              >
                settings_suggest
              </span>
            )
          ) : (
            <span
              className="material-symbols-outlined text-amber-500 text-base shrink-0 cursor-help"
              title={salida.motivo_sin_match ?? "Sin propuesta automática para esta carga"}
            >
              warning
            </span>
          )}

          <div className="flex flex-col">
            <span
              className={`font-semibold ${salida.componente_id ? "text-gray-900" : "text-amber-700 italic"}`}
              title={salida.componente_descripcion ?? salida.motivo_sin_match ?? undefined}
            >
              {salida.componente_id ? (salida.componente_codigo ?? salida.componente_id) : "Sin match"}
            </span>
            {salida.componente_codigo_comercial && (
              <span className="text-gray-500 text-[11px]">{salida.componente_codigo_comercial}</span>
            )}
          </div>
        </div>
      </td>

      {/* Acciones */}
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-2 text-gray-500">
          <button
            type="button"
            aria-label={`Duplicar salida ${salida.carga_valor} ${salida.carga_unidad}`}
            onClick={() => onDuplicar(salida)}
            className="hover:text-abb-red p-1 rounded hover:bg-gray-100"
            title="Duplicar salida"
          >
            <span className="material-symbols-outlined text-base">content_copy</span>
          </button>
          <button
            type="button"
            aria-label={`Editar salida ${salida.carga_valor} ${salida.carga_unidad}`}
            onClick={(e) => onAbrirEdicion(salida, e.currentTarget)}
            className="hover:text-abb-red p-1 rounded hover:bg-gray-100"
            title="Editar salida"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button
            type="button"
            aria-label={`Borrar salida ${salida.carga_valor} ${salida.carga_unidad}`}
            onClick={(e) => onConfirmarBorrado(salida, e.currentTarget)}
            className="hover:text-abb-red p-1 rounded hover:bg-gray-100"
            title="Borrar salida"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

export function SeccionBlock({
  seccion,
  salidas,
  onSalidaCreada,
  onSalidaActualizada,
  onSalidaBorrada,
  onSalidasReordenadas,
  hoveredSalidaId,
  onSalidaHover,
}: SeccionBlockProps) {
  const [etiqueta, setEtiqueta] = useState("");
  const [cargaValor, setCargaValor] = useState("");
  const [cargaUnidad, setCargaUnidad] = useState("A");
  const [formato, setFormato] = useState<FormatoPolos>("unipolar");
  const [tipoProteccion, setTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const cargaInvalidaEntero = cargaUnidad === "A" && cargaValor.trim() !== "" && Number(cargaValor) % 1 !== 0;

  const [error, setError] = useState<string | null>(null);
  const [salidaEnEdicion, setSalidaEnEdicion] = useState<Salida | null>(null);
  const [confirmandoDescarteEdicion, setConfirmandoDescarteEdicion] = useState(false);
  const [editEtiqueta, setEditEtiqueta] = useState("");
  const [editCargaValor, setEditCargaValor] = useState("");
  const [editCargaUnidad, setEditCargaUnidad] = useState("A");
  const [editFormato, setEditFormato] = useState<FormatoPolos>("unipolar");
  const [editTipoProteccion, setEditTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const editCargaInvalidaEntero =
    editCargaUnidad === "A" && editCargaValor.trim() !== "" && Number(editCargaValor) % 1 !== 0;

  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [salidaABorrar, setSalidaABorrar] = useState<Salida | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const ultimoTriggerRef = useRef<HTMLElement | null>(null);
  const editCargaInputRef = useRef<HTMLInputElement>(null);
  const idSalidaEnEdicionRef = useRef<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const salida = await crearSalida(seccion.id, {
        etiqueta: etiqueta.trim() || undefined,
        carga_valor: cargaValor,
        carga_unidad: cargaUnidad,
        formato,
        tipo_proteccion: tipoProteccion,
      });
      onSalidaCreada(salida);
      setCargaValor("");
      setEtiqueta("");
      // Mantiene la sección y formato abiertos para flujo continuo de carga
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la salida");
    }
  }

  async function handleDuplicar(salida: Salida) {
    setError(null);
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

  function abrirEdicion(salida: Salida, trigger: HTMLElement) {
    ultimoTriggerRef.current = trigger;
    idSalidaEnEdicionRef.current = salida.id;
    setSalidaEnEdicion(salida);
    setEditEtiqueta(salida.etiqueta ?? "");
    setEditCargaValor(salida.carga_valor);
    setEditCargaUnidad(salida.carga_unidad);
    setEditFormato(salida.formato);
    setEditTipoProteccion(salida.tipo_proteccion);
    setError(null);
  }

  function cerrarEdicion() {
    idSalidaEnEdicionRef.current = null;
    setSalidaEnEdicion(null);
    setPickerAbierto(false);
    setError(null);
    ultimoTriggerRef.current?.focus();
  }

  function solicitarCierreEdicion() {
    setConfirmandoDescarteEdicion(true);
  }

  function confirmarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
    cerrarEdicion();
  }

  function cancelarDescarteEdicion() {
    setConfirmandoDescarteEdicion(false);
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
    try {
      const actualizada = await actualizarSalida(idEditada, {
        etiqueta: editEtiqueta.trim() || undefined,
        carga_valor: editCargaValor,
        carga_unidad: editCargaUnidad,
        formato: editFormato,
        tipo_proteccion: editTipoProteccion,
      });
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      onSalidaActualizada(actualizada);
      cerrarEdicion();
    } catch (err) {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError(err instanceof Error ? err.message : "No se pudo actualizar la salida");
    }
  }

  async function handleReasignarComponente(componente: ComponenteBusqueda) {
    if (!salidaEnEdicion) return;
    const idEditada = salidaEnEdicion.id;
    try {
      const actualizada = await actualizarSalida(idEditada, { componente_id: componente.id });
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      onSalidaActualizada(actualizada);
      setSalidaEnEdicion(actualizada);
      setPickerAbierto(false);
    } catch (err) {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError(err instanceof Error ? err.message : "No se pudo reasignar el componente");
    }
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

  return (
    <div className="mt-4 border border-surface-stroke bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="border-b border-surface-stroke bg-industrial-gray/60 px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 uppercase tracking-widest text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-abb-red text-lg">segment</span>
          {seccion.nombre}
          <span className="text-xs text-gray-500 font-normal">({salidas.length} salidas)</span>
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
            {salidas.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500 text-xs italic">
                  Sin salidas en esta sección. Utilizá el botón inferior para agregar la primera.
                </td>
              </tr>
            ) : (
              salidas.map((salida, idx) => (
                <FilaSalida
                  key={salida.id}
                  salida={salida}
                  index={idx}
                  isHovered={hoveredSalidaId === salida.id}
                  onAbrirEdicion={abrirEdicion}
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
              Carga *
            </label>
            <input
              id={`carga-${seccion.id}`}
              autoFocus
              placeholder="16"
              value={cargaValor}
              onChange={(e) => setCargaValor(e.target.value)}
              required
              className="w-28 text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
            />
            {cargaInvalidaEntero && (
              <p className="text-error text-[11px] mt-0.5">Entero requerido para Amperios</p>
            )}
          </div>

          <div>
            <label htmlFor={`unidad-${seccion.id}`} className="block text-xs font-semibold text-gray-700 mb-1">
              Unidad
            </label>
            <select
              id={`unidad-${seccion.id}`}
              value={cargaUnidad}
              onChange={(e) => setCargaUnidad(e.target.value)}
              className="min-w-[80px] text-sm border border-gray-300 rounded-md px-3 pr-8 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
            >
              <option value="A">A</option>
              <option value="kW">kW</option>
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
              <option value="unipolar">Unipolar (1P)</option>
              <option value="bipolar">Bipolar (2P)</option>
              <option value="tripolar">Tripolar (3P)</option>
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
              onChange={(e) => setTipoProteccion(e.target.value as TipoProteccion)}
              className="min-w-[165px] text-sm border border-gray-300 rounded-md px-3 pr-8 py-2 bg-white focus:border-abb-red focus:outline-none focus:ring-1 focus:ring-abb-red"
            >
              <option value="seccional_termomagnetico">Termomagnético</option>
              <option value="seccional_diferencial">Diferencial</option>
            </select>
          </div>

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
            <span className="material-symbols-outlined text-base">add_circle</span>
            Nueva salida
          </button>
        </div>
      )}

      {/* Modal Editar Salida */}
      {salidaEnEdicion && !pickerAbierto && !confirmandoDescarteEdicion && (
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="edit-carga-valor" className="text-xs font-semibold text-gray-700">Carga</label>
                <input
                  id="edit-carga-valor"
                  ref={editCargaInputRef}
                  value={editCargaValor}
                  onChange={(e) => setEditCargaValor(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:border-abb-red focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-carga-unidad" className="text-xs font-semibold text-gray-700">Unidad</label>
                <select
                  id="edit-carga-unidad"
                  value={editCargaUnidad}
                  onChange={(e) => setEditCargaUnidad(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:border-abb-red focus:outline-none"
                >
                  <option value="A">A</option>
                  <option value="kW">kW</option>
                </select>
              </div>
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
                  onChange={(e) => setEditFormato(e.target.value as FormatoPolos)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:border-abb-red focus:outline-none"
                >
                  <option value="unipolar">Unipolar (1P)</option>
                  <option value="bipolar">Bipolar (2P)</option>
                  <option value="tripolar">Tripolar (3P)</option>
                  <option value="tetrapolar">Tetrapolar (4P)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-proteccion" className="text-xs font-semibold text-gray-700">Protección</label>
                <select
                  id="edit-proteccion"
                  value={editTipoProteccion}
                  onChange={(e) => setEditTipoProteccion(e.target.value as TipoProteccion)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:border-abb-red focus:outline-none"
                >
                  <option value="seccional_termomagnetico">Termomagnético</option>
                  <option value="seccional_diferencial">Diferencial</option>
                </select>
              </div>
            </div>

            <div className="border-t border-b py-2 text-xs text-gray-600 flex items-center justify-between">
              <span>Componente actual:</span>
              <span className="font-mono font-semibold text-gray-900">
                {salidaEnEdicion.componente_id
                  ? (salidaEnEdicion.componente_codigo ?? salidaEnEdicion.componente_id)
                  : "Sin match"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              className="w-full border border-gray-300 text-gray-800 hover:border-abb-red hover:text-abb-red px-3 py-2 text-xs font-semibold rounded uppercase tracking-wider transition"
            >
              Cambiar componente en catálogo
            </button>

            {error && <p role="alert" className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}

            <div className="mt-2 flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={solicitarCierreEdicion}
                className="px-4 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editCargaInvalidaEntero}
                className="bg-abb-red hover:bg-red-700 px-5 py-2 text-xs font-medium text-white rounded shadow disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {salidaEnEdicion && confirmandoDescarteEdicion && (
        <ConfirmDialog
          titulo="¿Descartar cambios?"
          mensaje="Vas a perder los cambios que hiciste en esta salida."
          textoConfirmar="Descartar"
          onConfirm={confirmarDescarteEdicion}
          onCancel={cancelarDescarteEdicion}
        />
      )}

      {salidaEnEdicion && pickerAbierto && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
          contextKey="salida-componente"
          titulo="Cambiar componente"
          onSelect={handleReasignarComponente}
          onCancel={() => setPickerAbierto(false)}
        />
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
    </div>
  );
}
