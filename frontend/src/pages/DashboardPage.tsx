import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarProyectos, type Proyecto } from "../api/client";

export function DashboardPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarProyectos()
      .then((data) => {
        setProyectos(data);
        setCargando(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  const totalProyectos = proyectos.length;
  const activos = proyectos.filter((p) => p.estado === "en_curso").length;
  const finalizados = proyectos.filter((p) => p.estado === "finalizado").length;
  const recientes = proyectos.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-stroke pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Principal</h1>
          <p className="text-sm text-gray-600">Bienvenido al sistema de cálculo y dimensionamiento de tableros PYRE</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/proyectos"
            className="inline-flex items-center gap-2 bg-abb-red hover:bg-red-700 text-white font-medium px-4 py-2 rounded shadow transition"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nuevo Proyecto
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-surface-stroke p-5 rounded-lg shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-abb-red flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined">folder</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{cargando ? "-" : totalProyectos}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Proyectos</div>
          </div>
        </div>

        <div className="bg-white border border-surface-stroke p-5 rounded-lg shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined">design_services</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{cargando ? "-" : activos}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">En Curso</div>
          </div>
        </div>

        <div className="bg-white border border-surface-stroke p-5 rounded-lg shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{cargando ? "-" : finalizados}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Finalizados</div>
          </div>
        </div>

        <div className="bg-white border border-surface-stroke p-5 rounded-lg shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined">inventory_2</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">ABB</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Catálogo Activo</div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects List */}
        <div className="lg:col-span-2 bg-white border border-surface-stroke rounded-lg shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-abb-red">history</span>
              Proyectos Recientes
            </h2>
            <Link to="/proyectos" className="text-xs font-medium text-abb-red hover:underline">
              Ver todos ({totalProyectos})
            </Link>
          </div>

          {cargando ? (
            <div className="text-center py-8 text-gray-400 text-sm">Cargando proyectos recientes...</div>
          ) : error ? (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
          ) : recientes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No hay proyectos creados aún.{" "}
              <Link to="/proyectos" className="text-abb-red font-medium hover:underline">
                Creá tu primer proyecto
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recientes.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Link to={`/proyectos/${p.id}`} className="font-medium text-gray-900 hover:text-abb-red">
                        {p.nombre}
                      </Link>
                      {p.codigo_obra && (
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {p.codigo_obra}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Cliente: <span className="text-gray-700">{p.cliente}</span>
                      {p.analista_nombre && <span> · Autor: {p.analista_nombre}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.estado === "finalizado"
                          ? "bg-green-100 text-green-800"
                          : p.estado === "en_curso"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {p.estado === "en_curso" ? "En curso" : p.estado === "finalizado" ? "Finalizado" : p.estado}
                    </span>
                    <Link
                      to={`/proyectos/${p.id}`}
                      className="text-gray-400 hover:text-abb-red p-1 rounded hover:bg-white"
                      title="Abrir Workspace"
                    >
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Access Card */}
        <div className="space-y-4">
          <div className="bg-white border border-surface-stroke rounded-lg shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="material-symbols-outlined text-gray-600">tune</span>
              Acceso Rápido
            </h2>
            <div className="space-y-2">
              <Link
                to="/proyectos"
                className="flex items-center gap-3 p-3 rounded border border-gray-200 hover:border-abb-red hover:bg-red-50/30 transition text-sm font-medium text-gray-800"
              >
                <span className="material-symbols-outlined text-abb-red">folder_open</span>
                Lista de Proyectos y Tableros
              </Link>
              <Link
                to="/catalogo"
                className="flex items-center gap-3 p-3 rounded border border-gray-200 hover:border-abb-red hover:bg-red-50/30 transition text-sm font-medium text-gray-800"
              >
                <span className="material-symbols-outlined text-gray-700">upload_file</span>
                Importar / Actualizar Catálogo
              </Link>
              <Link
                to="/parametros-calculo"
                className="flex items-center gap-3 p-3 rounded border border-gray-200 hover:border-abb-red hover:bg-red-50/30 transition text-sm font-medium text-gray-800"
              >
                <span className="material-symbols-outlined text-gray-700">settings</span>
                Parámetros de Cálculo Electrotécnico
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
