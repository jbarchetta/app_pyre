import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { crearProyecto, listarProyectos, type Proyecto } from "../api/client";

export function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [cliente, setCliente] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch(() => setError("No se pudieron cargar los proyectos"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const proyecto = await crearProyecto(cliente, nombre);
      setProyectos((actuales) => [...actuales, proyecto]);
      setCliente("");
      setNombre("");
    } catch {
      setError("No se pudo crear el proyecto");
    }
  }

  return (
    <div>
      <h1>Proyectos</h1>
      <ul>
        {proyectos.map((proyecto) => (
          <li key={proyecto.id}>
            <Link to={`/proyectos/${proyecto.id}`}>
              {proyecto.nombre} — {proyecto.cliente}
            </Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>Nuevo proyecto</h2>
        <label htmlFor="cliente">Cliente</label>
        <input id="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear proyecto</button>
      </form>
    </div>
  );
}
