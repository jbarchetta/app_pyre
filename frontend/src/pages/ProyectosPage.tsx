import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  TableCellsIcon,
  FolderOpenIcon,
  CalendarDaysIcon,
  PencilIcon,
  TrashIcon,
  HashtagIcon,
  UserIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
  actualizarProyecto,
  crearProyecto,
  eliminarProyecto,
  listarProyectos,
  listarTableros,
  type Proyecto,
} from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EstadoProyectoBadge } from "../components/EstadoProyectoBadge";
import { Badge, Button, Card, Field, Input, Select, Modal } from "../components/common";

type Modal = { tipo: "crear" } | { tipo: "editar"; proyecto: Proyecto } | null;
type ModoVista = "tarjetas" | "tabla";

const MODOS: { modo: ModoVista; label: string; icono: React.ComponentType<{ className?: string }> }[] = [
  { modo: "tarjetas", label: "Tarjetas", icono: Squares2X2Icon },
  { modo: "tabla", label: "Tabla", icono: TableCellsIcon },
];

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
  const [guardando, setGuardando] = useState(false);
  const clienteInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los proyectos")
      );
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

  useEffect(() => {
    if (!modal) return;
    clienteInputRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modal, cerrarModal]);

  function abrirCrear(trigger: HTMLElement) {
    triggerRef.current = trigger;
    setCliente("");
    setNombre("");
    setCodigoObra("");
    setFechaInicio("");
    setEstadoProyecto("en_curso");
    setModal({ tipo: "crear" });
  }

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
    setGuardando(true);
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
      const mensajePorDefecto =
        modal?.tipo === "editar" ? "No se pudo actualizar el proyecto" : "No se pudo crear el proyecto";
      setError(err instanceof Error ? err.message : mensajePorDefecto);
    } finally {
      setGuardando(false);
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

  if (proyectos === null) return <p className="p-4 text-ink-subtle">Cargando proyectos…</p>;

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
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Gestión de Proyectos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Listado y administración de proyectos de tableros eléctricos
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={(e) => abrirCrear(e.currentTarget)}
          icon={<PlusIcon className="h-4 w-4" />}
        >
          Nuevo proyecto
        </Button>
      </div>

      <Card className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Buscar proyectos"
              placeholder="Buscar por nombre, cliente, código de obra o autor…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            aria-label="Filtrar por estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="sm:w-52"
          >
            <option value="todos">Todos los estados</option>
            <option value="en_curso">En curso</option>
            <option value="finalizado">Finalizados</option>
            <option value="cancelado">Cancelados</option>
          </Select>
        </div>

        <div
          role="group"
          aria-label="Modo de vista"
          className="flex items-center gap-1 self-end rounded-control border border-line bg-surface-sunken p-1 sm:self-auto"
        >
          {MODOS.map(({ modo, label, icono: Icono }) => {
            const activo = modoVista === modo;
            return (
              <button
                key={modo}
                type="button"
                aria-pressed={activo}
                onClick={() => setModoVista(modo)}
                className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-colors ${
                  activo
                    ? "bg-surface text-brand shadow-control"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icono className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </Card>

      {proyectosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface-sunken py-12 text-center">
          <FolderOpenIcon className="h-9 w-9 text-ink-subtle" aria-hidden="true" />
          <p className="mt-3 font-medium text-ink-muted">No se encontraron proyectos</p>
          <p className="mt-0.5 text-xs text-ink-subtle">Probá ajustando el buscador o los filtros</p>
        </div>
      ) : (
        Object.entries(agrupadosPorMes).map(([mes, lista]) => (
          <section key={mes} className="space-y-3">
            <h2 className="etiqueta flex items-center gap-1.5 border-b border-line pb-1.5">
              <CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />
              {mes}
              <span className="font-normal normal-case tracking-normal">({lista.length})</span>
            </h2>

            {modoVista === "tarjetas" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((proyecto) => (
                  <Card
                    key={proyecto.id}
                    className="flex flex-col justify-between transition-colors hover:border-brand-line"
                  >
                    <div>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <Link
                          to={`/proyectos/${proyecto.id}`}
                          className="line-clamp-1 text-base font-bold text-ink hover:text-brand"
                        >
                          {proyecto.nombre}
                        </Link>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${proyecto.nombre}`}
                            onClick={(e) => abrirEditar(proyecto, e.currentTarget)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Borrar ${proyecto.nombre}`}
                            onClick={(e) => handlePedirBorrado(proyecto, e.currentTarget)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="mb-3 text-sm text-ink-muted">
                        Cliente: <span className="font-medium text-ink">{proyecto.cliente}</span>
                      </p>

                      <dl className="mb-4 space-y-1.5 border-t border-line pt-3 text-xs text-ink-subtle">
                        {proyecto.codigo_obra && (
                          <div className="flex items-center gap-1.5">
                            <HashtagIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <dt>Obra:</dt>
                            <dd>
                              <Badge mono tone="neutral">
                                {proyecto.codigo_obra}
                              </Badge>
                            </dd>
                          </div>
                        )}
                        {proyecto.analista_nombre && (
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <dt>Diseñador:</dt>
                            <dd className="truncate text-ink-muted">{proyecto.analista_nombre}</dd>
                          </div>
                        )}
                        {proyecto.fecha_inicio && (
                          <div className="flex items-center gap-1.5">
                            <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <dt>Inicio:</dt>
                            <dd className="dato-tecnico text-ink-muted">
                              {new Date(proyecto.fecha_inicio).toLocaleDateString()}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div className="flex items-center justify-between border-t border-line pt-3">
                      <EstadoProyectoBadge estado={proyecto.estado} />
                      <Link
                        to={`/proyectos/${proyecto.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        Abrir
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken">
                    <tr>
                      {["Proyecto", "Cliente", "Código obra", "Diseñador", "Estado"].map((h) => (
                        <th key={h} scope="col" className="etiqueta px-3 py-2.5">
                          {h}
                        </th>
                      ))}
                      <th scope="col" className="etiqueta px-3 py-2.5 text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lista.map((proyecto) => (
                      <tr key={proyecto.id} className="transition-colors hover:bg-surface-sunken">
                        <td className="px-3 py-2.5 font-semibold text-ink">
                          <Link to={`/proyectos/${proyecto.id}`} className="hover:text-brand">
                            {proyecto.nombre}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-ink-muted">{proyecto.cliente}</td>
                        <td className="dato-tecnico px-3 py-2.5 text-xs text-ink-muted">
                          {proyecto.codigo_obra ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-ink-muted">{proyecto.analista_nombre ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <EstadoProyectoBadge estado={proyecto.estado} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar ${proyecto.nombre}`}
                              onClick={(e) => abrirEditar(proyecto, e.currentTarget)}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Borrar ${proyecto.nombre}`}
                              onClick={(e) => handlePedirBorrado(proyecto, e.currentTarget)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}

      {/* El <form> es a la vez el diálogo: mantenerlo así deja el botón de
          submit dentro del formulario. */}
      {modal && (
        <Modal
          titulo={modal.tipo === "editar" ? "Editar proyecto" : "Nuevo proyecto"}
          subtitulo="Gestión de obras e ingeniería de tableros"
          icon={<FolderOpenIcon className="w-5 h-5 text-abb-red" />}
          onClose={cerrarModal}
          error={error}
          size="md"
          footer={
            <>
              <Button type="submit" form="form-proyecto" variant="primary" size="md" isLoading={guardando}>
                {modal.tipo === "editar" ? "Guardar cambios" : "Crear proyecto"}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={cerrarModal}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-proyecto" onSubmit={handleSubmit} className="space-y-4">
            <Field label="Cliente" required>
              {(p) => (
                <Input {...p} ref={clienteInputRef} value={cliente} onChange={(e) => setCliente(e.target.value)} />
              )}
            </Field>

            <Field label="Nombre del proyecto" required>
              {(p) => <Input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Código obra">
                {(p) => (
                  <Input
                    {...p}
                    mono
                    placeholder="OB-2026-44"
                    value={codigoObra}
                    onChange={(e) => setCodigoObra(e.target.value)}
                  />
                )}
              </Field>

              <Field label="Fecha inicio">
                {(p) => (
                  <Input {...p} type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                )}
              </Field>
            </div>

            {modal.tipo === "editar" && (
              <Field label="Estado del proyecto">
                {(p) => (
                  <Select {...p} value={estadoProyecto} onChange={(e) => setEstadoProyecto(e.target.value)}>
                    <option value="en_curso">En curso</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="cancelado">Cancelado</option>
                  </Select>
                )}
              </Field>
            )}
          </form>
        </Modal>
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
