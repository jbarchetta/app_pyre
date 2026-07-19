import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  actualizarSalida,
  crearSalida,
  eliminarSalida,
  CATEGORIAS_INTERRUPTORES,
  type ComponenteBusqueda,
  type FormatoPolos,
  type Salida,
  type Seccion,
  type TipoProteccion,
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
}

export function SeccionBlock({
  seccion,
  salidas,
  onSalidaCreada,
  onSalidaActualizada,
  onSalidaBorrada,
}: SeccionBlockProps) {
  const [cargaValor, setCargaValor] = useState("");
  const [cargaUnidad, setCargaUnidad] = useState("A");
  const [formato, setFormato] = useState<FormatoPolos>("unipolar");
  const [tipoProteccion, setTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [error, setError] = useState<string | null>(null);
  const [salidaEnEdicion, setSalidaEnEdicion] = useState<Salida | null>(null);
  const [editCargaValor, setEditCargaValor] = useState("");
  const [editCargaUnidad, setEditCargaUnidad] = useState("A");
  const [editFormato, setEditFormato] = useState<FormatoPolos>("unipolar");
  const [editTipoProteccion, setEditTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [salidaABorrar, setSalidaABorrar] = useState<Salida | null>(null);
  const [borrando, setBorrando] = useState(false);
  const ultimoTriggerRef = useRef<HTMLElement | null>(null);
  const editCargaInputRef = useRef<HTMLInputElement>(null);
  const idSalidaEnEdicionRef = useRef<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const salida = await crearSalida(seccion.id, {
        carga_valor: cargaValor,
        carga_unidad: cargaUnidad,
        formato,
        tipo_proteccion: tipoProteccion,
      });
      onSalidaCreada(salida);
      setCargaValor("");
    } catch {
      setError("No se pudo crear la salida");
    }
  }

  function abrirEdicion(salida: Salida, trigger: HTMLElement) {
    ultimoTriggerRef.current = trigger;
    idSalidaEnEdicionRef.current = salida.id;
    setSalidaEnEdicion(salida);
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

  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarEdicion);

  useEffect(() => {
    if (!salidaEnEdicion || pickerAbierto) return;
    editCargaInputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarEdicion();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salidaEnEdicion, pickerAbierto]);

  async function handleGuardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!salidaEnEdicion) return;
    const idEditada = salidaEnEdicion.id;
    setError(null);
    try {
      const actualizada = await actualizarSalida(idEditada, {
        carga_valor: editCargaValor,
        carga_unidad: editCargaUnidad,
        formato: editFormato,
        tipo_proteccion: editTipoProteccion,
      });
      if (idSalidaEnEdicionRef.current !== idEditada) return; // ref reflects live state, unlike the closed-over salidaEnEdicion
      onSalidaActualizada(actualizada);
      cerrarEdicion();
    } catch {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError("No se pudo actualizar la salida");
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
    } catch {
      if (idSalidaEnEdicionRef.current !== idEditada) return;
      setError("No se pudo reasignar el componente");
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
    } catch {
      setError("No se pudo borrar la salida");
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
    <div className="mt-4 border border-surface-stroke bg-white">
      <h3 className="border-b border-surface-stroke bg-industrial-gray p-4 font-bold uppercase tracking-widest">
        {seccion.nombre}
      </h3>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-surface-stroke text-xs uppercase tracking-widest text-secondary">
            <th scope="col" className="p-3">Carga</th>
            <th scope="col" className="p-3">Formato</th>
            <th scope="col" className="p-3">Estado</th>
            <th scope="col" className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {salidas.map((salida) => (
            <tr key={salida.id} className="border-b border-surface-stroke">
              <td className="p-3 font-mono">
                {salida.carga_valor} {salida.carga_unidad}
              </td>
              <td className="p-3">{salida.formato}</td>
              <td className="p-3">
                {salida.componente_id ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 bg-abb-red" /> propuesto: {salida.componente_codigo ?? salida.componente_id}
                    {salida.componente_codigo_comercial && (
                      <span className="text-secondary"> — {salida.componente_codigo_comercial}</span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 border border-secondary" /> sin match
                  </span>
                )}
              </td>
              <td className="p-3">
                <div className="flex gap-3 text-on-background">
                  <button
                    type="button"
                    aria-label={`Editar salida ${salida.carga_valor} ${salida.carga_unidad}`}
                    onClick={(e) => abrirEdicion(salida, e.currentTarget)}
                    className="hover:text-abb-red"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar salida ${salida.carga_valor} ${salida.carga_unidad}`}
                    onClick={(e) => {
                      ultimoTriggerRef.current = e.currentTarget;
                      setSalidaABorrar(salida);
                    }}
                    className="hover:text-abb-red"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 p-4">
        <div>
          <label htmlFor={`carga-${seccion.id}`}>Carga</label>
          <input id={`carga-${seccion.id}`} value={cargaValor} onChange={(e) => setCargaValor(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`unidad-${seccion.id}`}>Unidad</label>
          <select id={`unidad-${seccion.id}`} value={cargaUnidad} onChange={(e) => setCargaUnidad(e.target.value)}>
            <option value="A">A</option>
            <option value="kW">kW</option>
          </select>
        </div>
        <div>
          <label htmlFor={`formato-${seccion.id}`}>Formato</label>
          <select
            id={`formato-${seccion.id}`}
            value={formato}
            onChange={(e) => setFormato(e.target.value as FormatoPolos)}
          >
            <option value="unipolar">Unipolar</option>
            <option value="bipolar">Bipolar</option>
            <option value="tripolar">Tripolar</option>
            <option value="tetrapolar">Tetrapolar</option>
          </select>
        </div>
        <div>
          <label htmlFor={`proteccion-${seccion.id}`}>Protección</label>
          <select
            id={`proteccion-${seccion.id}`}
            value={tipoProteccion}
            onChange={(e) => setTipoProteccion(e.target.value as TipoProteccion)}
          >
            <option value="seccional_termomagnetico">Termomagnético</option>
            <option value="seccional_diferencial">Diferencial</option>
          </select>
        </div>
        {error && !salidaEnEdicion && !salidaABorrar && <p role="alert" className="text-error">{error}</p>}
        <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Agregar salida
        </button>
      </form>

      {salidaEnEdicion && !pickerAbierto && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40"
          onMouseDown={onMouseDownModal}
          onClick={onClickModal}
        >
          <form
            onSubmit={handleGuardarEdicion}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-salida-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="editar-salida-titulo" className="text-lg font-bold">
              Editar salida
            </h2>
            <label htmlFor="edit-carga-valor">Carga</label>
            <input
              id="edit-carga-valor"
              ref={editCargaInputRef}
              value={editCargaValor}
              onChange={(e) => setEditCargaValor(e.target.value)}
            />
            <label htmlFor="edit-carga-unidad">Unidad</label>
            <select id="edit-carga-unidad" value={editCargaUnidad} onChange={(e) => setEditCargaUnidad(e.target.value)}>
              <option value="A">A</option>
              <option value="kW">kW</option>
            </select>
            <label htmlFor="edit-formato">Formato</label>
            <select
              id="edit-formato"
              value={editFormato}
              onChange={(e) => setEditFormato(e.target.value as FormatoPolos)}
            >
              <option value="unipolar">Unipolar</option>
              <option value="bipolar">Bipolar</option>
              <option value="tripolar">Tripolar</option>
              <option value="tetrapolar">Tetrapolar</option>
            </select>
            <label htmlFor="edit-proteccion">Protección</label>
            <select
              id="edit-proteccion"
              value={editTipoProteccion}
              onChange={(e) => setEditTipoProteccion(e.target.value as TipoProteccion)}
            >
              <option value="seccional_termomagnetico">Termomagnético</option>
              <option value="seccional_diferencial">Diferencial</option>
            </select>
            <p className="text-secondary">
              Componente:{" "}
              {salidaEnEdicion.componente_id
                ? (salidaEnEdicion.componente_codigo ?? salidaEnEdicion.componente_id)
                : "sin definir"}
            </p>
            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              className="self-start border border-surface-stroke px-4 py-2 text-sm uppercase tracking-widest hover:border-abb-red hover:text-abb-red"
            >
              Cambiar componente
            </button>
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
                onClick={cerrarEdicion}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {salidaEnEdicion && pickerAbierto && (
        <ComponentePicker
          categorias={CATEGORIAS_INTERRUPTORES}
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
