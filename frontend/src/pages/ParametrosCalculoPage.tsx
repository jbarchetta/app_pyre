import { useEffect, useState, type FormEvent } from "react";
import {
  actualizarParametrosCalculo,
  obtenerParametrosCalculo,
  listarReglasCablecanal,
  crearReglaCablecanal,
  eliminarReglaCablecanal,
  buscarCatalogo,
  type ParametroCalculo,
  type ReglaCablecanal,
  type ComponenteBusqueda,
} from "../api/client";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input } from "../components/common";
import { PlusIcon, TrashIcon, CalculatorIcon, AdjustmentsHorizontalIcon, ListBulletIcon } from "@heroicons/react/24/outline";

type TabParametros = "electricos" | "cablecanales" | "borneras";

export function ParametrosCalculoPage() {
  const [tabActivo, setTabActivo] = useState<TabParametros>("electricos");
  const [parametros, setParametros] = useState<ParametroCalculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  // Cablecanales & Borneras State
  const [reglas, setReglas] = useState<ReglaCablecanal[]>([]);
  const [bornes, setBornes] = useState<ComponenteBusqueda[]>([]);
  const [corrienteMin, setCorrienteMin] = useState("");
  const [corrienteMax, setCorrienteMax] = useState("");
  const [medida, setMedida] = useState("");

  const cargarReglas = async () => {
    try {
      const list = await listarReglasCablecanal();
      setReglas(list);
    } catch (err) {
      console.error(err);
    }
  };

  const cargarBornes = async () => {
    try {
      const res = await buscarCatalogo("", { categorias: ["Terminales"], limit: 100 });
      setBornes(res.resultados);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    obtenerParametrosCalculo()
      .then(setParametros)
      .catch(() => setError("No se pudieron cargar los parámetros"));
    cargarReglas();
    cargarBornes();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!parametros) return;
    setError(null);
    setSuccess(null);
    setGuardado(false);
    try {
      const actualizados = await actualizarParametrosCalculo(parametros);
      setParametros(actualizados);
      setGuardado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los parámetros");
    }
  }

  const handleCrearRegla = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!corrienteMin || !corrienteMax || !medida.trim()) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    try {
      await crearReglaCablecanal({
        corriente_minima: corrienteMin,
        corriente_maxima: corrienteMax,
        medida_cablecanal: medida.trim(),
      });
      setSuccess("Regla de cablecanal creada con éxito.");
      setCorrienteMin("");
      setCorrienteMax("");
      setMedida("");
      await cargarReglas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la regla");
    }
  };

  const handleEliminarRegla = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      await eliminarReglaCablecanal(id);
      setSuccess("Regla de cablecanal eliminada con éxito.");
      await cargarReglas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar la regla");
    }
  };

  if (!parametros) {
    return (
      <div className="p-8 text-center text-xs dato-tecnico text-ink-muted">
        {error ? (
          <div className="p-4 bg-red-50 text-red-700 font-bold rounded-lg border border-red-200 inline-block max-w-md">
            {error}
          </div>
        ) : (
          "Cargando parámetros de cálculo..."
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Parámetros de Cálculo y Reglas Físicas</h1>
          <p className="text-xs text-gray-500">Configuración técnica de dimensiones, corrientes, cablecanales y borneras</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTabActivo("electricos")}
          className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            tabActivo === "electricos"
              ? "border-abb-red text-abb-red"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <CalculatorIcon className="w-4 h-4" />
          Parámetros Eléctricos
        </button>
        <button
          type="button"
          onClick={() => setTabActivo("cablecanales")}
          className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            tabActivo === "cablecanales"
              ? "border-abb-red text-abb-red"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          Reglas de Cablecanales
        </button>
        <button
          type="button"
          onClick={() => setTabActivo("borneras")}
          className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            tabActivo === "borneras"
              ? "border-abb-red text-abb-red"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <ListBulletIcon className="w-4 h-4" />
          Borneras / Bornes no-ABB
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200">
          {success}
        </div>
      )}

      {/* TAB ELÉCTRICOS */}
      {tabActivo === "electricos" && (
        <div className="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Valores Nominales de Proyecto</CardTitle>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Tensión monofásica (V)">
                  {(props) => (
                    <Input
                      {...props}
                      value={parametros.tension_mono_v}
                      onChange={(e) => setParametros({ ...parametros, tension_mono_v: e.target.value })}
                      mono
                    />
                  )}
                </Field>

                <Field label="Tensión trifásica (V)">
                  {(props) => (
                    <Input
                      {...props}
                      value={parametros.tension_tri_v}
                      onChange={(e) => setParametros({ ...parametros, tension_tri_v: e.target.value })}
                      mono
                    />
                  )}
                </Field>

                <Field label="Cos φ">
                  {(props) => (
                    <Input
                      {...props}
                      value={parametros.cos_phi}
                      onChange={(e) => setParametros({ ...parametros, cos_phi: e.target.value })}
                      mono
                    />
                  )}
                </Field>

                <Field label="Ratio de selectividad">
                  {(props) => (
                    <Input
                      {...props}
                      value={parametros.ratio_selectividad}
                      onChange={(e) => setParametros({ ...parametros, ratio_selectividad: e.target.value })}
                      mono
                    />
                  )}
                </Field>

                {guardado && (
                  <p className="text-xs font-medium text-success">
                    Parámetros guardados con éxito.
                  </p>
                )}

                <div className="pt-2">
                  <Button type="submit" variant="primary">
                    Guardar Parámetros
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB CABLECANALES */}
      {tabActivo === "cablecanales" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-white border border-surface-stroke rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4 text-abb-red" />
              Nueva Regla de Cablecanal
            </h3>
            <form onSubmit={handleCrearRegla} className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                  Corriente Mínima (A)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={corrienteMin}
                  onChange={(e) => setCorrienteMin(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                  Corriente Máxima (A)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={corrienteMax}
                  onChange={(e) => setCorrienteMax(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                  Medida del Cablecanal
                </label>
                <input
                  type="text"
                  value={medida}
                  onChange={(e) => setMedida(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
                  placeholder="ej. 40x40 mm"
                  required
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                Guardar Regla
              </Button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Rango de Corriente (A)</th>
                  <th className="px-4 py-3">Medida de Cablecanal</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reglas.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">
                      {r.corriente_minima} A — {r.corriente_maxima} A
                    </td>
                    <td className="px-4 py-3 font-mono text-abb-red font-bold">{r.medida_cablecanal}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleEliminarRegla(r.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Eliminar regla"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB BORNERAS */}
      {tabActivo === "borneras" && (
        <div className="bg-white border border-surface-stroke rounded-xl shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Borneras / Bornes Disponibles en el Catálogo</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-right">Precio Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bornes.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono font-bold text-abb-red">{b.codigo}</td>
                    <td className="px-4 py-3 text-gray-900">{b.descripcion}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{b.codigo_comercial ?? "ABB"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-gray-900">
                      ${b.precio_neto ?? "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
