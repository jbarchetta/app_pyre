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
    <div>
      <h3>{seccion.nombre}</h3>
      <ul>
        {salidas.map((salida) => (
          <li key={salida.id}>
            {salida.carga_valor} {salida.carga_unidad} — {salida.formato} —{" "}
            {salida.componente_id ? `propuesto: ${salida.componente_id}` : "sin match"}
            {!salida.componente_id && (
              <ComponentePicker onSelect={(componente) => handleOverride(salida.id, componente)} />
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label htmlFor={`carga-${seccion.id}`}>Carga</label>
        <input id={`carga-${seccion.id}`} value={cargaValor} onChange={(e) => setCargaValor(e.target.value)} />
        <label htmlFor={`unidad-${seccion.id}`}>Unidad</label>
        <select id={`unidad-${seccion.id}`} value={cargaUnidad} onChange={(e) => setCargaUnidad(e.target.value)}>
          <option value="A">A</option>
          <option value="kW">kW</option>
        </select>
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
        <label htmlFor={`proteccion-${seccion.id}`}>Protección</label>
        <select
          id={`proteccion-${seccion.id}`}
          value={tipoProteccion}
          onChange={(e) => setTipoProteccion(e.target.value as TipoProteccion)}
        >
          <option value="seccional_termomagnetico">Termomagnético</option>
          <option value="seccional_diferencial">Diferencial</option>
        </select>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Agregar salida</button>
      </form>
    </div>
  );
}
