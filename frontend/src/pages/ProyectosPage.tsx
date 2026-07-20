import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  actualizarProyecto,
  crearProyecto,
  eliminarProyecto,
  listarProyectos,
  listarTableros,
  type Proyecto,
} from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useCerrarAlClickFuera } from "../hooks/useCerrarAlClickFuera";

type Modal = { tipo: "crear" } | { tipo: "editar"; proyecto: Proyecto } | null;
type ModoVista = "tarjetas" | "tabla";

export function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [modoVista, setModoVista] = useState<ModoVista>("tarjetas");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Campos de formulario modal
  const [cliente, setCliente] = useState("");
  const [nombre, setNombre] = useState("");
  const [codigoObra, setCodigoObra] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [estadoProyecto, setEstadoProyecto] = useState("en_curso");

  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<{
    proyecto: Proyecto;
    cantidadTableros: number;
    cantidadDesconocida: boolean;
  } | null>(null);
  const [borrando, setBorrando] = useState(false);
  const clienteInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch(() => setError("No se pudieron cargar los proyectos"));
  }, []);

  const cerrarModal = useCallback(() => {
    setModal(null);
    setABorrar(null);
    setCliente("");
    setNombre("");
    setCodigoObra("");
    setFechaInicio("");
    setEstadoProyecto("en_curso");
    setError(null);
    triggerRef.current?.focus();
  }, []);

  const { onMouseDown: onMouseDownModal, onClick: onClickModal } = useCerrarAlClickFuera(cerrarModal);

  useEffect(() => {
    if (!modal) return;
    clienteInputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modal, cerrarModal]);

  function abrirEditar(proyecto: Proyecto, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setCliente(proyecto.cliente);
    setNombre(proyecto.nombre);
    setCodigoObra(proyecto.codigo_obra ?? "");
    setFechaInicio(proyecto.fecha_inicio ? proyecto.fecha_inicio.substring(0, 10) : "");
    setEstadoProyecto(proyecto.estado);
    setModal({ tipo: "editar", proyecto });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (modal?.tipo === "editar") {
        const actualizado = await actualizarProyecto(modal.proyecto.id, {
          cliente,
          nombre,
          codigo_obra: codigoObra || undefined,
          fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : undefined,
          estado: estadoProyecto,
        });
        setProyectos((actuales) => (actuales ?? []).map((p) => (p.id === actualizado.id ? actualizado : p)));
      } else {
        const proyecto = await crearProyecto({
          cliente,
          nombre,
          codigo_obra: codigoObra || undefined,
          fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : undefined,
        });
        setProyectos((actuales) => [...(actuales ?? []), proyecto]);
      }
      cerrarModal();
    } catch (err) {
      const mensajePorDefecto = modal?.tipo === "editar" ? "No se pudo actualizar el proyecto" : "No se pudo crear el proyecto";
      setError(err instanceof Error ? err.message : mensajePorDefecto);
    }
  }

  async function handlePedirBorrado(proyecto: Proyecto, trigger: HTMLElement) {
    triggerRef.current = trigger;
    try {
      const tableros = await listarTableros(proyecto.id);
      setABorrar({ proyecto, cantidadTableros: tableros.length, cantidadDesconocida: false });
    } catch {
      setABorrar({ proyecto, cantidadTableros: 0, cantidadDesconocida: true });
    }
  }

  async function handleConfirmarBorrado() {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await eliminarProyecto(aBorrar.proyecto.id);
      setProyectos((actuales) => (actuales ?? []).filter((p) => p.id !== aBorrar.proyecto.id));
      cerrarModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el proyecto");
    } finally {
      setBorrando(false);
    }
  }

  if (proyectos === null) return <p className="p-4 text-gray-500">Cargando proyectos...</p>;

  // Filtrado de proyectos por búsqueda y por estado
  const proyectosFiltrados = proyectos.filter((p) => {
    const q = busqueda.toLowerCase().trim();
    const coincideTexto =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      p.cliente.toLowerCase().includes(q) ||
      (p.codigo_obra && p.codigo_obra.toLowerCase().includes(q)) ||
      (p.analista_nombre && p.analista_nombre.toLowerCase().includes(q));

    const coincideEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    return coincideTexto && coincideEstado;
  });

  // Agrupación por mes de creación
  const agrupadosPorMes: { [key: string]: Proyecto[] } = {};
  for (const p of proyectosFiltrados) {
    let claveMes = "Sin fecha";
    if (p.creado_en) {
      const d = new Date(p.creado_en);
      claveMes = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      claveMes = claveMes.charAt(0).toUpperCase() + claveMes.slice(1);
    }
    if (!agrupadosPorMes[claveMes]) agrupadosPorMes[claveMes] = [];
    agrupadosPorMes[claveMes].push(p);
  }

  return (
    <div className="space-y-6">
      {/* Header y Acción Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-stroke pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Proyectos</h1>
          <p className="text-sm text-gray-600">Listado y administración de proyectos de tableros eléctricos</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            triggerRef.current = e.currentTarget;
            setCliente("");
            setNombre("");
            setCodigoObra("");
            setFechaInicio("");
            setEstadoProyecto("en_curso");
            setModal({ tipo: "crear" });
          }}
          className="bg-abb-red hover:bg-red-700 text-white font-medium px-5 py-2.5 rounded shadow inline-flex items-center gap-2 transition"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nuevo proyecto
        </button>
      </div>

      {/* Controles de Filtros y Modo de Vista */}
      <div className="bg-white border border-surface-stroke p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Buscador */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Buscar por nombre, cliente, código de obra o autor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:border-abb-red focus:outline-none"
            />
          </div>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="text-sm border border-gray-300 rounded px-3 py-2 bg-white focus:border-abb-red focus:outline-none"
          >
            <option value="todos">Todos los Estados</option>
            <option value="en_curso">En Curso</option>
            <option value="finalizado">Finalizados</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>

        {/* Selector de Modo Vista: Tarjetas vs Tabla */}
        <div className="flex items-center gap-1 border border-gray-300 rounded p-1 bg-gray-50 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setModoVista("tarjetas")}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded transition ${
              modoVista === "tarjetas" ? "bg-white text-abb-red shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            Tarjetas
          </button>
          <button
            type="button"
            onClick={() => setModoVista("tabla")}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded transition ${
              modoVista === "tabla" ? "bg-white text-abb-red shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="material-symbols-outlined text-base">table_rows</span>
            Tabla
          </button>
        </div>
      </div>

      {proyectosFiltrados.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg bg-gray-50">
          <span className="material-symbols-outlined text-4xl text-gray-400">folder_open</span>
          <p className="mt-2 text-gray-600 font-medium">No se encontraron proyectos</p>
          <p className="text-xs text-gray-500">Pruebe ajustando el buscador o los filtros</p>
        </div>
      ) : (
        Object.entries(agrupadosPorMes).map(([mes, lista]) => (
          <div key={mes} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              {mes} <span className="text-gray-400 font-normal">({lista.length})</span>
            </h2>

            {modoVista === "tarjetas" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((proyecto) => (
                  <div
                    key={proyecto.id}
                    className="relative border border-surface-stroke bg-white p-5 rounded-lg shadow-sm hover:border-abb-red hover:shadow transition group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link to={`/proyectos/${proyecto.id}`} className="font-bold text-gray-900 text-lg hover:text-abb-red line-clamp-1">
                          {proyecto.nombre}
                        </Link>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label={`Editar ${proyecto.nombre}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              abrirEditar(proyecto, e.currentTarget);
                            }}
                            className="text-gray-400 hover:text-abb-red p-1 rounded hover:bg-gray-100"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Borrar ${proyecto.nombre}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePedirBorrado(proyecto, e.currentTarget);
                            }}
                            className="text-gray-400 hover:text-abb-red p-1 rounded hover:bg-gray-100"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-3">
                        Cliente: <span className="font-medium text-gray-800">{proyecto.cliente}</span>
                      </div>

                      <div className="space-y-1 text-xs text-gray-500 border-t border-gray-100 pt-2 mb-4">
                        {proyecto.codigo_obra && (
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs">tag</span>
                            Obra: <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{proyecto.codigo_obra}</span>
                          </div>
                        )}
                        {proyecto.analista_nombre && (
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs">person</span>
                            Diseñador: <span className="text-gray-700">{proyecto.analista_nombre}</span>
                          </div>
                        )}
                        {proyecto.fecha_inicio && (
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs">event</span>
                            Inicio: <span className="text-gray-700">{new Date(proyecto.fecha_inicio).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          proyecto.estado === "finalizado"
                            ? "bg-green-100 text-green-800"
                            : proyecto.estado === "en_curso"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {proyecto.estado === "en_curso" ? "En curso" : proyecto.estado === "finalizado" ? "Finalizado" : proyecto.estado}
                      </span>
                      <Link
                        to={`/proyectos/${proyecto.id}`}
                        className="text-xs font-semibold text-abb-red hover:underline flex items-center gap-1"
                      >
                        Abrir
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-surface-stroke rounded-lg shadow-sm overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="p-3">Proyecto</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Código Obra</th>
                      <th className="p-3">Diseñador</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lista.map((proyecto) => (
                      <tr key={proyecto.id} className="hover:bg-gray-50 transition">
                        <td className="p-3 font-medium text-gray-900">
                          <Link to={`/proyectos/${proyecto.id}`} className="hover:text-abb-red">
                            {proyecto.nombre}
                          </Link>
                        </td>
                        <td className="p-3 text-gray-600">{proyecto.cliente}</td>
                        <td className="p-3 text-gray-600 font-mono text-xs">{proyecto.codigo_obra ?? "-"}</td>
                        <td className="p-3 text-gray-600">{proyecto.analista_nombre ?? "-"}</td>
                        <td className="p-3">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                              proyecto.estado === "finalizado"
                                ? "bg-green-100 text-green-800"
                                : proyecto.estado === "en_curso"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {proyecto.estado === "en_curso" ? "En curso" : proyecto.estado === "finalizado" ? "Finalizado" : proyecto.estado}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={(e) => abrirEditar(proyecto, e.currentTarget)}
                            className="text-gray-500 hover:text-abb-red"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handlePedirBorrado(proyecto, e.currentTarget)}
                            className="text-gray-500 hover:text-abb-red"
                            title="Borrar"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}

      {/* Modal Crear / Editar Proyecto */}
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" onMouseDown={onMouseDownModal} onClick={onClickModal}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="proyecto-modal-titulo"
            className="flex w-full max-w-md flex-col gap-3 border border-surface-stroke bg-white p-6 rounded-lg shadow-xl"
          >
            <h2 id="proyecto-modal-titulo" className="text-lg font-bold text-gray-900 border-b pb-2">
              {modal.tipo === "editar" ? "Editar proyecto" : "Nuevo proyecto"}
            </h2>

            <div className="space-y-1">
              <label htmlFor="cliente" className="text-xs font-semibold text-gray-700">Cliente *</label>
              <input
                id="cliente"
                ref={clienteInputRef}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-abb-red focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="nombre" className="text-xs font-semibold text-gray-700">Nombre del Proyecto *</label>
              <input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-abb-red focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="codigoObra" className="text-xs font-semibold text-gray-700">Código Obra</label>
                <input
                  id="codigoObra"
                  placeholder="Ej. OB-2026-44"
                  value={codigoObra}
                  onChange={(e) => setCodigoObra(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-abb-red focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="fechaInicio" className="text-xs font-semibold text-gray-700">Fecha Inicio</label>
                <input
                  id="fechaInicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-abb-red focus:outline-none"
                />
              </div>
            </div>

            {modal.tipo === "editar" && (
              <div className="space-y-1">
                <label htmlFor="estadoProyecto" className="text-xs font-semibold text-gray-700">Estado del Proyecto</label>
                <select
                  id="estadoProyecto"
                  value={estadoProyecto}
                  onChange={(e) => setEstadoProyecto(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:border-abb-red focus:outline-none bg-white"
                >
                  <option value="en_curso">En curso</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

            <div className="mt-4 flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={cerrarModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-abb-red hover:bg-red-700 px-5 py-2 text-sm font-medium text-white rounded shadow"
              >
                {modal.tipo === "editar" ? "Guardar Cambios" : "Crear Proyecto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {aBorrar && (
        <ConfirmDialog
          titulo="Confirmar borrado"
          mensaje={
            aBorrar.cantidadDesconocida
              ? `No pudimos confirmar cuántos tableros tiene el proyecto "${aBorrar.proyecto.nombre}". Se va a borrar igual si confirmás.`
              : aBorrar.cantidadTableros > 0
                ? `Esto va a borrar el proyecto "${aBorrar.proyecto.nombre}" y sus ${aBorrar.cantidadTableros} tablero(s).`
                : `Esto va a borrar el proyecto "${aBorrar.proyecto.nombre}".`
          }
          confirmando={borrando}
          error={error}
          onConfirm={handleConfirmarBorrado}
          onCancel={cerrarModal}
        />
      )}
    </div>
  );
}
