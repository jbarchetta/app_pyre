import { useEffect, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  crearTablero,
  listarTableros,
  obtenerProyecto,
  type ComponenteBusqueda,
  type Proyecto,
  type Tablero,
} from "../api/client";
import { ComponentePicker } from "../components/ComponentePicker";

// Icc estándar de arranque para no bloquear la creación del tablero — el
// analista lo puede editar desde el detalle del tablero si el estudio
// eléctrico del sitio da un valor distinto.
const NIVEL_FALLA_KA_POR_DEFECTO = "10";

export function ProyectoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tableros, setTableros] = useState<Tablero[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [nivelFallaKa, setNivelFallaKa] = useState(NIVEL_FALLA_KA_POR_DEFECTO);
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

  function handleSeleccionarTablero(tableroId: string) {
    setSearchParams({ tablero: tableroId });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const tablero = await crearTablero(id, nombre, nivelFallaKa, interruptorPrincipal?.id ?? null);
      setTableros((actuales) => [...(actuales ?? []), tablero]);
      setNombre("");
      setNivelFallaKa(NIVEL_FALLA_KA_POR_DEFECTO);
      setInterruptorPrincipal(null);
      setSearchParams({ tablero: tablero.id });
    } catch {
      setError("No se pudo crear el tablero");
    }
  }

  if (!proyecto || tableros === null) return <p>Cargando...</p>;

  const tableroParamId = searchParams.get("tablero");
  const tableroActivoId = tableros.find((t) => t.id === tableroParamId)
    ? tableroParamId
    : (tableros[0]?.id ?? null);
  const tableroActivo = tableros.find((t) => t.id === tableroActivoId) ?? null;

  return (
    <div>
      <h1 className="text-2xl font-bold">{proyecto.nombre}</h1>
      <p className="text-secondary">{proyecto.cliente}</p>

      {tableros.length > 0 && (
        <div role="tablist" aria-label="Tableros del proyecto" className="mt-6 flex gap-1 border-b border-surface-stroke">
          {tableros.map((tablero) => (
            <button
              key={tablero.id}
              role="tab"
              type="button"
              aria-selected={tablero.id === tableroActivoId}
              onClick={() => handleSeleccionarTablero(tablero.id)}
              className={`px-4 py-2 text-sm uppercase tracking-widest ${
                tablero.id === tableroActivoId
                  ? "border-b-2 border-abb-red text-abb-red"
                  : "text-secondary hover:text-on-background"
              }`}
            >
              {tablero.nombre}
            </button>
          ))}
        </div>
      )}

      {tableroActivo === null && (
        <p className="mt-6 text-secondary">Creá tu primer tablero para empezar a configurarlo.</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
        <h2 className="text-lg font-bold">Nuevo tablero</h2>
        <label htmlFor="nombre-tablero">Nombre</label>
        <input id="nombre-tablero" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label htmlFor="nivel-falla">Nivel de falla (kA)</label>
        <input id="nivel-falla" value={nivelFallaKa} onChange={(e) => setNivelFallaKa(e.target.value)} />
        <p>Interruptor principal{interruptorPrincipal ? `: ${interruptorPrincipal.codigo}` : " (opcional)"}</p>
        <ComponentePicker onSelect={setInterruptorPrincipal} />
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
          Crear tablero
        </button>
      </form>
    </div>
  );
}
