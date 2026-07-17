import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { crearProyecto, listarProyectos, type Proyecto } from "../api/client";

export function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
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
      setModalAbierto(false);
    } catch {
      setError("No se pudo crear el proyecto");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proyectos</h1>
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white"
        >
          Nuevo proyecto
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proyectos.map((proyecto) => (
          <Link
            key={proyecto.id}
            to={`/proyectos/${proyecto.id}`}
            className="border border-surface-stroke bg-white p-6 hover:border-abb-red"
          >
            <p className="font-bold">{proyecto.nombre}</p>
            <p className="text-secondary">{proyecto.cliente}</p>
          </Link>
        ))}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleSubmit}
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 className="text-lg font-bold">Nuevo proyecto</h2>
            <label htmlFor="cliente">Cliente</label>
            <input id="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {error && <p role="alert">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Crear proyecto
              </button>
              <button type="button" onClick={() => setModalAbierto(false)} className="px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
