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

export function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [cliente, setCliente] = useState("");
  const [nombre, setNombre] = useState("");
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
    setModal({ tipo: "editar", proyecto });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (modal?.tipo === "editar") {
        const actualizado = await actualizarProyecto(modal.proyecto.id, { cliente, nombre });
        setProyectos((actuales) => (actuales ?? []).map((p) => (p.id === actualizado.id ? actualizado : p)));
      } else {
        const proyecto = await crearProyecto(cliente, nombre);
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

  if (proyectos === null) return <p>Cargando...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proyectos</h1>
        <button
          type="button"
          onClick={(e) => {
            triggerRef.current = e.currentTarget;
            setCliente("");
            setNombre("");
            setModal({ tipo: "crear" });
          }}
          className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white"
        >
          Nuevo proyecto
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proyectos.map((proyecto) => (
          <div key={proyecto.id} className="relative border border-surface-stroke bg-white p-6 hover:border-abb-red">
            <div className="absolute right-3 top-3 flex gap-2 text-on-background">
              <button
                type="button"
                aria-label={`Editar ${proyecto.nombre}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirEditar(proyecto, e.currentTarget);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button
                type="button"
                aria-label={`Borrar ${proyecto.nombre}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePedirBorrado(proyecto, e.currentTarget);
                }}
                className="hover:text-abb-red"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
            <Link to={`/proyectos/${proyecto.id}`} className="block">
              <p className="pr-16 font-bold">{proyecto.nombre}</p>
              <p className="text-secondary">{proyecto.cliente}</p>
            </Link>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" onMouseDown={onMouseDownModal} onClick={onClickModal}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="proyecto-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="proyecto-modal-titulo" className="text-lg font-bold">
              {modal.tipo === "editar" ? "Editar proyecto" : "Nuevo proyecto"}
            </h2>
            <label htmlFor="cliente">Cliente</label>
            <input id="cliente" ref={clienteInputRef} value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {error && <p role="alert" className="text-error">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                {modal.tipo === "editar" ? "Guardar" : "Crear proyecto"}
              </button>
              <button type="button" onClick={cerrarModal} className="px-6 py-3 text-sm uppercase tracking-widest">
                Cancelar
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
