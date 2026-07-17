import { useState, type FormEvent } from "react";
import {
  actualizarSalida,
  crearSalida,
  type ComponenteBusqueda,
  type FormatoPolos,
  type Salida,
  type Seccion,
  type TipoProteccion,
} from "../api/client";
import { ComponentePicker } from "./ComponentePicker";

interface SeccionBlockProps {
  seccion: Seccion;
  salidas: Salida[];
  onSalidaCreada: (salida: Salida) => void;
  onSalidaActualizada: (salida: Salida) => void;
}

export function SeccionBlock({ seccion, salidas, onSalidaCreada, onSalidaActualizada }: SeccionBlockProps) {
  const [cargaValor, setCargaValor] = useState("");
  const [cargaUnidad, setCargaUnidad] = useState("A");
  const [formato, setFormato] = useState<FormatoPolos>("unipolar");
  const [tipoProteccion, setTipoProteccion] = useState<TipoProteccion>("seccional_termomagnetico");
  const [error, setError] = useState<string | null>(null);

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

  async function handleOverride(salidaId: string, componente: ComponenteBusqueda) {
    const actualizada = await actualizarSalida(salidaId, componente.id);
    onSalidaActualizada(actualizada);
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
                    <span className="h-2 w-2 bg-abb-red" /> propuesto: {salida.componente_id}
                  </span>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 border border-secondary" /> sin match
                    </span>
                    <ComponentePicker onSelect={(componente) => handleOverride(salida.id, componente)} />
                  </div>
                )}
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
        {error && <p role="alert" className="text-error">{error}</p>}
        <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Agregar salida
        </button>
      </form>
    </div>
  );
}
