import { useEffect, useState, type FormEvent } from "react";
import {
  listarReglasCablecanal,
  crearReglaCablecanal,
  eliminarReglaCablecanal,
  buscarCatalogo,
  type ReglaCablecanal,
  type ComponenteBusqueda,
} from "../api/client";
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, BoltIcon, ListBulletIcon } from "@heroicons/react/24/outline";

export function AdminConfigPage() {
  const [reglas, setReglas] = useState<ReglaCablecanal[]>([]);
  const [bornes, setBornes] = useState<ComponenteBusqueda[]>([]);
  const [tabActivo, setTabActivo] = useState<"cablecanales" | "borneras">("cablecanales");

  // Form states
  const [corrienteMin, setCorrienteMin] = useState("");
  const [corrienteMax, setCorrienteMax] = useState("");
  const [medida, setMedida] = useState("");

  const [cargandoReglas, setCargandoReglas] = useState(false);
  const [cargandoBornes, setCargandoBornes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cargarReglas = async () => {
    setCargandoReglas(true);
    try {
      const list = await listarReglasCablecanal();
      setReglas(list);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las reglas de cablecanales");
    } finally {
      setCargandoReglas(false);
    }
  };

  const cargarBornes = async () => {
    setCargandoBornes(true);
    try {
      const res = await buscarCatalogo("", { categorias: ["Terminales"], limit: 100 });
      setBornes(res.resultados);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las borneras del catálogo");
    } finally {
      setCargandoBornes(false);
    }
  };

  useEffect(() => {
    cargarReglas();
    cargarBornes();
  }, []);

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
      setSuccess("Regla de cablecanal eliminada.");
      await cargarReglas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar la regla");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Panel de Administración</h1>
          <p className="text-xs text-gray-500">Mantenimiento de reglas de dimensionamiento físico y catálogo PYRE</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTabActivo("cablecanales")}
          className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            tabActivo === "cablecanales"
              ? "border-abb-red text-abb-red"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Reglas de Cablecanales
        </button>
        <button
          type="button"
          onClick={() => setTabActivo("borneras")}
          className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            tabActivo === "borneras"
              ? "border-abb-red text-abb-red"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Borneras / Bornes no-ABB
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-700 text-xs rounded border border-green-200">
          {success}
        </div>
      )}

      {tabActivo === "cablecanales" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Formulario */}
          <div className="lg:col-span-4 bg-white border border-surface-stroke rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4 text-abb-red" />
              Nueva Regla de Cablecanal
            </h3>
            <form onSubmit={handleCrearRegla} className="space-y-3.5">
              <div>
                <label htmlFor="corriente-min" className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                  Corriente Mínima (A)
                </label>
                <input
                  id="corriente-min"
                  type="number"
                  step="0.01"
                  value={corrienteMin}
                  onChange={(e) => setCorrienteMin(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
                  placeholder="ej. 0"
                  required
                />
              </div>

              <div>
                <label htmlFor="corriente-max" className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                  Corriente Máxima (A)
                </label>
                <input
                  id="corriente-max"
                  type="number"
                  step="0.01"
                  value={corrienteMax}
                  onChange={(e) => setCorrienteMax(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
                  placeholder="ej. 63"
                  required
                />
              </div>

              <div>
                <label htmlFor="medida-cablecanal" className="block text-[10px] uppercase font-bold tracking-wider text-secondary mb-1">
                  Medida del Cablecanal
                </label>
                <input
                  id="medida-cablecanal"
                  type="text"
                  value={medida}
                  onChange={(e) => setMedida(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
                  placeholder="ej. 40x40 mm o 60x40 mm"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-abb-red hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider py-2 rounded-lg transition"
              >
                Crear Regla
              </button>
            </form>
          </div>

          {/* Tabla de Reglas */}
          <div className="lg:col-span-8 bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-surface-stroke bg-slate-50 px-4 py-2.5 flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <BoltIcon className="w-4 h-4 text-abb-red" />
                Reglas de Cablecanal Configuradas
              </h3>
              <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                {reglas.length} REGLAS
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-b-xl bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#2C3645] text-slate-100 font-mono text-[11px] uppercase tracking-wider border-b border-slate-700">
                    <th className="py-2.5 px-4 font-bold">Corriente Mínima</th>
                    <th className="py-2.5 px-4 font-bold">Corriente Máxima</th>
                    <th className="py-2.5 px-4 font-bold">Medida Cablecanal</th>
                    <th className="py-2.5 px-4 text-right font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargandoReglas ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-400 italic text-xs">
                        Cargando reglas...
                      </td>
                    </tr>
                  ) : reglas.length > 0 ? (
                    reglas.map((r) => (
                      <tr key={r.id} className="border-b border-surface-stroke hover:bg-gray-50/80 transition-colors">
                        <td className="p-3 font-mono text-xs text-gray-900">{Number(r.corriente_minima).toLocaleString()} A</td>
                        <td className="p-3 font-mono text-xs text-gray-900">{Number(r.corriente_maxima).toLocaleString()} A</td>
                        <td className="p-3 font-mono text-xs text-gray-700 font-semibold">{r.medida_cablecanal}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleEliminarRegla(r.id)}
                            className="text-gray-400 hover:text-abb-red p-1 rounded hover:bg-gray-100"
                            title="Eliminar regla"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-400 italic text-xs">
                        No hay reglas de cablecanal configuradas. El cálculo usará valores por defecto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-surface-stroke bg-slate-50 px-4 py-2.5 flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <ListBulletIcon className="w-4 h-4 text-abb-red" />
              Borneras no-ABB Cargadas en Catálogo (PYRE)
            </h3>
            <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
              {bornes.length} ÍTEMS
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded-b-xl bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#2C3645] text-slate-100 font-mono text-[11px] uppercase tracking-wider border-b border-slate-700">
                  <th className="py-2.5 px-4 font-bold">Código</th>
                  <th className="py-2.5 px-4 font-bold">Código Comercial</th>
                  <th className="py-2.5 px-4 font-bold">Descripción</th>
                  <th className="py-2.5 px-4 font-bold">Precio Neto</th>
                </tr>
              </thead>
              <tbody>
                {cargandoBornes ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400 italic text-xs">
                      Cargando borneras...
                    </td>
                  </tr>
                ) : bornes.length > 0 ? (
                  bornes.map((b) => (
                    <tr key={b.id} className="border-b border-surface-stroke hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 font-mono text-xs font-semibold text-gray-900">{b.codigo}</td>
                      <td className="p-3 font-mono text-xs text-gray-600">{b.codigo_comercial || "—"}</td>
                      <td className="p-3 text-xs text-gray-700">{b.descripcion}</td>
                      <td className="p-3 font-mono text-xs text-gray-900">
                        {b.precio_neto ? `$ ${Number(b.precio_neto).toLocaleString()}` : "Consultar"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400 italic text-xs">
                      No se encontraron borneras en el catálogo. Verifique la importación del Excel PYRE.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
