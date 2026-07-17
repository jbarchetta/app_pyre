import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  crearTablero,
  listarTableros,
  obtenerProyecto,
  type ComponenteBusqueda,
  type Proyecto,
  type Tablero,
} from "../api/client";
import { ComponentePicker } from "../components/ComponentePicker";

export function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tableros, setTableros] = useState<Tablero[]>([]);
  const [nombre, setNombre] = useState("");
  const [nivelFallaKa, setNivelFallaKa] = useState("");
  const [interruptorPrincipal, setInterruptorPrincipal] = useState<ComponenteBusqueda | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    obtenerProyecto(id)
      .then(setProyecto)
      .catch(() => setError("No se pudo cargar el proyecto"));
    listarTableros(id)
      .then(setTableros)
      .catch(() => setError("No se pudieron cargar los tableros"));
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const tablero = await crearTablero(id, nombre, nivelFallaKa, interruptorPrincipal?.id ?? null);
      setTableros((actuales) => [...actuales, tablero]);
      setNombre("");
      setNivelFallaKa("");
      setInterruptorPrincipal(null);
    } catch {
      setError("No se pudo crear el tablero");
    }
  }

  if (!proyecto) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{proyecto.nombre}</h1>
      <p>{proyecto.cliente}</p>
      <ul>
        {tableros.map((tablero) => (
          <li key={tablero.id}>
            <Link to={`/tableros/${tablero.id}`}>{tablero.nombre}</Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>Nuevo tablero</h2>
        <label htmlFor="nombre-tablero">Nombre</label>
        <input id="nombre-tablero" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label htmlFor="nivel-falla">Nivel de falla (kA)</label>
        <input id="nivel-falla" value={nivelFallaKa} onChange={(e) => setNivelFallaKa(e.target.value)} />
        <p>Interruptor principal{interruptorPrincipal ? `: ${interruptorPrincipal.codigo}` : " (opcional)"}</p>
        <ComponentePicker onSelect={setInterruptorPrincipal} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear tablero</button>
      </form>
    </div>
  );
}
