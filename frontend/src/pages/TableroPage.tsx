import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  crearSeccion,
  listarSalidas,
  listarSecciones,
  obtenerTablero,
  type Salida,
  type Seccion,
  type Tablero,
} from "../api/client";
import { EsquemaVisual } from "../components/EsquemaVisual";
import { SeccionBlock } from "../components/SeccionBlock";

interface SeccionConSalidas {
  seccion: Seccion;
  salidas: Salida[];
}

export function TableroPage() {
  const { id } = useParams<{ id: string }>();
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
  const [nombreSeccion, setNombreSeccion] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    cargar(id);
  }, [id]);

  async function cargar(tableroId: string) {
    const [tableroCargado, seccionesCargadas] = await Promise.all([
      obtenerTablero(tableroId),
      listarSecciones(tableroId),
    ]);
    setTablero(tableroCargado);
    const conSalidas = await Promise.all(
      seccionesCargadas.map(async (seccion) => ({ seccion, salidas: await listarSalidas(seccion.id) })),
    );
    setSecciones(conSalidas);
  }

  async function handleAgregarSeccion(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const seccion = await crearSeccion(id, nombreSeccion, secciones.length);
      setSecciones((actuales) => [...actuales, { seccion, salidas: [] }]);
      setNombreSeccion("");
    } catch {
      setError("No se pudo crear la sección");
    }
  }

  function handleSalidaCreada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      actuales.map((s) => (s.seccion.id === seccionId ? { ...s, salidas: [...s.salidas, salida] } : s)),
    );
  }

  function handleSalidaActualizada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      actuales.map((s) =>
        s.seccion.id === seccionId
          ? { ...s, salidas: s.salidas.map((sal) => (sal.id === salida.id ? salida : sal)) }
          : s,
      ),
    );
  }

  if (!tablero) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{tablero.nombre}</h1>
      <p>Nivel de falla: {tablero.nivel_falla_ka} kA</p>
      <p>
        Interruptor principal: {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}
      </p>
      <EsquemaVisual tieneInterruptorPrincipal={!!tablero.interruptor_principal_id} secciones={secciones} />
      {secciones.map(({ seccion, salidas }) => (
        <SeccionBlock
          key={seccion.id}
          seccion={seccion}
          salidas={salidas}
          onSalidaCreada={(salida) => handleSalidaCreada(seccion.id, salida)}
          onSalidaActualizada={(salida) => handleSalidaActualizada(seccion.id, salida)}
        />
      ))}
      <form onSubmit={handleAgregarSeccion}>
        <label htmlFor="nombre-seccion">Nueva sección</label>
        <input id="nombre-seccion" value={nombreSeccion} onChange={(e) => setNombreSeccion(e.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Agregar sección</button>
      </form>
    </div>
  );
}
