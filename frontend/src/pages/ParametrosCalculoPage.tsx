import { useEffect, useState, type FormEvent } from "react";
import { actualizarParametrosCalculo, obtenerParametrosCalculo, type ParametroCalculo } from "../api/client";

export function ParametrosCalculoPage() {
  const [parametros, setParametros] = useState<ParametroCalculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    obtenerParametrosCalculo()
      .then(setParametros)
      .catch(() => setError("No se pudieron cargar los parámetros"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!parametros) return;
    setError(null);
    setGuardado(false);
    try {
      const actualizados = await actualizarParametrosCalculo(parametros);
      setParametros(actualizados);
      setGuardado(true);
    } catch {
      setError("No se pudieron guardar los parámetros");
    }
  }

  if (!parametros) return <p>Cargando...</p>;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3 border border-surface-stroke bg-white p-8">
      <h1 className="text-xl font-bold">Parámetros de cálculo</h1>
      <label htmlFor="tension-mono">Tensión monofásica (V)</label>
      <input
        id="tension-mono"
        value={parametros.tension_mono_v}
        onChange={(e) => setParametros({ ...parametros, tension_mono_v: e.target.value })}
      />
      <label htmlFor="tension-tri">Tensión trifásica (V)</label>
      <input
        id="tension-tri"
        value={parametros.tension_tri_v}
        onChange={(e) => setParametros({ ...parametros, tension_tri_v: e.target.value })}
      />
      <label htmlFor="cos-phi">Cos φ</label>
      <input
        id="cos-phi"
        value={parametros.cos_phi}
        onChange={(e) => setParametros({ ...parametros, cos_phi: e.target.value })}
      />
      <label htmlFor="ratio-selectividad">Ratio de selectividad</label>
      <input
        id="ratio-selectividad"
        value={parametros.ratio_selectividad}
        onChange={(e) => setParametros({ ...parametros, ratio_selectividad: e.target.value })}
      />
      {error && <p role="alert" className="text-error">{error}</p>}
      {guardado && <p>Guardado</p>}
      <button type="submit" className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
        Guardar
      </button>
    </form>
  );
}
