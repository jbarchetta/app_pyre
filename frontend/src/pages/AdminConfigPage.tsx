import { useEffect, useState, type FormEvent } from "react";
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  resetPasswordAdmin,
  desactivarUsuario,
  cambiarPasswordSelf,
  listarAuditoria,
  obtenerOpcionesAuditoria,
  type UsuarioGestion,
  type AuditLogEntry,
  type RolUsuarioType,
} from "../api/client";
import {
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  KeyIcon,
  ClipboardDocumentListIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { Navigate } from "react-router-dom";
import { useSesion } from "../auth/SesionContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, Input, Select, Modal } from "../components/common";

export function AdminConfigPage() {
  const usuarioSesion = useSesion();
  const esAnalista = usuarioSesion?.rol === "analista";
  const esAdminOManager = usuarioSesion?.rol === "administrador" || usuarioSesion?.rol === "desarrollador";

  const [tabActivo, setTabActivo] = useState<"usuarios" | "auditoria" | "micuenta">(
    esAdminOManager ? "usuarios" : "micuenta"
  );

  // Usuarios State
  const [usuarios, setUsuarios] = useState<UsuarioGestion[]>([]);
  const [modalNuevoUsuario, setModalNuevoUsuario] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRol, setNuevoRol] = useState<RolUsuarioType>("analista");
  const [nuevoPassword, setNuevoPassword] = useState("");

  // Editar usuario
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioGestion | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editRol, setEditRol] = useState<RolUsuarioType>("analista");
  const [editActivo, setEditActivo] = useState(true);

  // Reset clave admin
  const [userResetTarget, setUserResetTarget] = useState<UsuarioGestion | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState("");

  // Autogestión cambio de clave (Mi Cuenta)
  const [currentPasswordSelf, setCurrentPasswordSelf] = useState("");
  const [newPasswordSelf, setNewPasswordSelf] = useState("");
  const [confirmPasswordSelf, setConfirmPasswordSelf] = useState("");

  // Auditoría State & Filters
  const [auditorias, setAuditorias] = useState<AuditLogEntry[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditAccion, setAuditAccion] = useState("");
  const [auditEntidad, setAuditEntidad] = useState("");
  const [auditLimit, setAuditLimit] = useState(100);
  const [opcionesAcciones, setOpcionesAcciones] = useState<string[]>([]);
  const [opcionesEntidades, setOpcionesEntidades] = useState<string[]>([]);

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cargarUsuarios = async () => {
    try {
      const list = await listarUsuarios();
      setUsuarios(list);
    } catch (err) {
      console.error(err);
    }
  };

  const cargarAuditoria = async () => {
    try {
      const list = await listarAuditoria({
        q: auditQuery || undefined,
        accion: auditAccion || undefined,
        entidad: auditEntidad || undefined,
        limit: auditLimit,
      });
      setAuditorias(list);
    } catch (err) {
      console.error(err);
    }
  };

  const cargarOpcionesAuditoria = async () => {
    try {
      const ops = await obtenerOpcionesAuditoria();
      setOpcionesAcciones(ops.acciones);
      setOpcionesEntidades(ops.entidades);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (esAdminOManager) {
      cargarUsuarios();
      cargarAuditoria();
      cargarOpcionesAuditoria();
    }
  }, [esAdminOManager]);

  useEffect(() => {
    if (tabActivo === "auditoria") {
      cargarAuditoria();
    }
  }, [auditQuery, auditAccion, auditEntidad, auditLimit, tabActivo]);

  const handleCrearUsuario = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await crearUsuario({
        email: nuevoEmail.trim(),
        nombre: nuevoNombre.trim(),
        rol: nuevoRol,
        password: nuevoPassword,
      });
      setSuccess(`Usuario ${nuevoEmail} creado con éxito.`);
      setModalNuevoUsuario(false);
      setNuevoEmail("");
      setNuevoNombre("");
      setNuevoPassword("");
      await cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el usuario");
    }
  };

  const handleGuardarEdicionUsuario = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuarioEditando) return;
    setError(null);
    setSuccess(null);
    try {
      await actualizarUsuario(usuarioEditando.id, {
        nombre: editNombre.trim(),
        rol: editRol,
        activo: editActivo,
      });
      setSuccess(`Usuario ${usuarioEditando.email} actualizado con éxito.`);
      setUsuarioEditando(null);
      await cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el usuario");
    }
  };

  const handleAdminResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!userResetTarget) return;
    setError(null);
    setSuccess(null);
    try {
      await resetPasswordAdmin(userResetTarget.id, adminNewPassword);
      setSuccess(`Contraseña restablecida para ${userResetTarget.email}.`);
      setUserResetTarget(null);
      setAdminNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restablecer la contraseña");
    }
  };

  // Desactivar usuario confirmation modal state
  const [usuarioADesactivar, setUsuarioADesactivar] = useState<UsuarioGestion | null>(null);
  const [desactivandoUsuario, setDesactivandoUsuario] = useState(false);

  const handleConfirmDesactivarUsuario = async () => {
    if (!usuarioADesactivar) return;
    setError(null);
    setSuccess(null);
    try {
      setDesactivandoUsuario(true);
      await desactivarUsuario(usuarioADesactivar.id);
      setSuccess(`Usuario ${usuarioADesactivar.email} desactivado con éxito.`);
      setUsuarioADesactivar(null);
      await cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al desactivar el usuario");
    } finally {
      setDesactivandoUsuario(false);
    }
  };

  const handleCambiarPasswordSelf = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPasswordSelf !== confirmPasswordSelf) {
      setError("La nueva contraseña y su confirmación no coinciden");
      return;
    }

    try {
      await cambiarPasswordSelf(currentPasswordSelf, newPasswordSelf);
      setSuccess("Tu contraseña ha sido actualizada con éxito.");
      setCurrentPasswordSelf("");
      setNewPasswordSelf("");
      setConfirmPasswordSelf("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar la contraseña");
    }
  };

  const badgeColorRol = (rol: string) => {
    switch (rol) {
      case "administrador":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "desarrollador":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "supervisor":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  if (esAnalista) {
    return <Navigate to="/proyectos" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Panel de Administración de Seguridad</h1>
          <p className="text-xs text-gray-500">Módulo 1: Gestión autónoma de usuarios PYRE, roles, clave y registro de auditoría</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {esAdminOManager && (
          <>
            <button
              type="button"
              onClick={() => setTabActivo("usuarios")}
              className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                tabActivo === "usuarios"
                  ? "border-abb-red text-abb-red"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <UsersIcon className="w-4 h-4" />
              Gestión de Usuarios PYRE
            </button>
            <button
              type="button"
              onClick={() => setTabActivo("auditoria")}
              className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                tabActivo === "auditoria"
                  ? "border-abb-red text-abb-red"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <ClipboardDocumentListIcon className="w-4 h-4" />
              Registro de Auditoría
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setTabActivo("micuenta")}
          className={`py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            tabActivo === "micuenta"
              ? "border-abb-red text-abb-red"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <KeyIcon className="w-4 h-4" />
          Mi Cuenta (Autogestión)
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-green-600 shrink-0" />
          {success}
        </div>
      )}

      {/* TAB USUARIOS */}
      {tabActivo === "usuarios" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Usuarios Registrados en PYRE</h2>
            <button
              type="button"
              onClick={() => setModalNuevoUsuario(true)}
              className="bg-abb-red hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Nuevo Usuario
            </button>
          </div>

          <div className="bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Correo Electrónico</th>
                  <th className="px-4 py-3">Rol Asignado</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-bold text-gray-900">{u.nombre}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${badgeColorRol(u.rol)}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircleIcon className="w-3 h-3 text-emerald-600" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <XCircleIcon className="w-3 h-3 text-rose-600" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUsuarioEditando(u);
                          setEditNombre(u.nombre);
                          setEditRol(u.rol);
                          setEditActivo(u.activo);
                        }}
                        className="p-1.5 text-gray-600 hover:text-abb-red bg-slate-100 hover:bg-red-50 rounded-lg transition"
                        title="Editar rol / nombre / estado"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserResetTarget(u);
                          setAdminNewPassword("");
                        }}
                        className="p-1.5 text-gray-600 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 rounded-lg transition"
                        title="Resetear Contraseña"
                      >
                        <KeyIcon className="w-3.5 h-3.5" />
                      </button>

                      {u.activo && (
                        <button
                          type="button"
                          onClick={() => setUsuarioADesactivar(u)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                          title="Desactivar Usuario"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB AUDITORÍA CON BÚSQUEDA Y FILTROS */}
      {tabActivo === "auditoria" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-gray-900">Historial de Auditoría del Sistema</h2>
            <span className="text-xs font-mono text-gray-500">
              Mostrando <strong className="text-gray-900">{auditorias.length}</strong> eventos
            </span>
          </div>

          {/* Panel de Filtros */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            {/* Buscador general */}
            <div className="lg:col-span-4 relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Buscar por usuario, email, acción..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-abb-red placeholder:text-gray-400"
              />
            </div>

            {/* Filtro por Acción */}
            <div className="lg:col-span-3">
              <select
                value={auditAccion}
                onChange={(e) => setAuditAccion(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-abb-red"
              >
                <option value="">Todas las acciones</option>
                {opcionesAcciones.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Entidad */}
            <div className="lg:col-span-3">
              <select
                value={auditEntidad}
                onChange={(e) => setAuditEntidad(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-abb-red"
              >
                <option value="">Todas las entidades</option>
                {opcionesEntidades.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent}
                  </option>
                ))}
              </select>
            </div>

            {/* Limite y Limpiar */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <select
                value={auditLimit}
                onChange={(e) => setAuditLimit(Number(e.target.value))}
                className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:border-abb-red w-full"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
              {(auditQuery || auditAccion || auditEntidad) && (
                <button
                  type="button"
                  onClick={() => {
                    setAuditQuery("");
                    setAuditAccion("");
                    setAuditEntidad("");
                  }}
                  className="p-1.5 text-xs font-bold text-gray-500 hover:text-abb-red transition"
                  title="Limpiar filtros"
                >
                  <FunnelIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-surface-stroke rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fecha / Hora</th>
                  <th className="px-4 py-3">Usuario / Actor</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Entidad</th>
                  <th className="px-4 py-3">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditorias.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic text-xs">
                      No se encontraron registros de auditoría con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  auditorias.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">
                        {new Date(a.creado_en).toLocaleString("es-AR")}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-gray-900">{a.usuario_nombre}</div>
                        {a.usuario_email && <div className="text-[10px] font-mono text-gray-400">{a.usuario_email}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-abb-red">{a.accion}</td>
                      <td className="px-4 py-2.5 text-gray-600">{a.entidad}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-600 max-w-xs truncate">
                        {a.detalle ? JSON.stringify(a.detalle) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB MI CUENTA */}
      {tabActivo === "micuenta" && (
        <div className="max-w-md bg-white border border-surface-stroke rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
            <KeyIcon className="w-4 h-4 text-abb-red" />
            Autogestión de Contraseña
          </h2>
          <form onSubmit={handleCambiarPasswordSelf} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Contraseña Actual</label>
              <input
                type="password"
                required
                value={currentPasswordSelf}
                onChange={(e) => setCurrentPasswordSelf(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Nueva Contraseña (mínimo 8 caracteres)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPasswordSelf}
                onChange={(e) => setNewPasswordSelf(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPasswordSelf}
                onChange={(e) => setConfirmPasswordSelf(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-abb-red"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-abb-red hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider py-2 rounded-lg transition"
            >
              Cambiar mi contraseña
            </button>
          </form>
        </div>
      )}

      {/* MODAL CREAR USUARIO */}
      {modalNuevoUsuario && (
        <Modal
          titulo="Alta de Usuario Autónomo PYRE"
          subtitulo="Crear una nueva cuenta con acceso al portal de ingeniería"
          icon={<UsersIcon className="w-5 h-5 text-abb-red" />}
          onClose={() => setModalNuevoUsuario(false)}
          size="md"
          footer={
            <>
              <Button
                variant="primary"
                onClick={() => {
                  const form = document.getElementById("form-crear-usuario") as HTMLFormElement;
                  if (form) form.requestSubmit();
                }}
              >
                Crear Usuario
              </Button>
              <Button variant="secondary" onClick={() => setModalNuevoUsuario(false)}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-crear-usuario" onSubmit={handleCrearUsuario} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nombre Completo *</label>
              <Input
                type="text"
                required
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="ej. Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Correo Electrónico *</label>
              <Input
                type="email"
                required
                value={nuevoEmail}
                onChange={(e) => setNuevoEmail(e.target.value)}
                placeholder="ej. j.perez@pyre.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Rol en el Sistema *</label>
              <Select
                value={nuevoRol}
                onChange={(e) => setNuevoRol(e.target.value as RolUsuarioType)}
              >
                <option value="analista">Analista — Tableros, salidas, BOM y planos</option>
                <option value="supervisor">Supervisor — Permisos analista + parámetros, reasignar y autorizar</option>
                <option value="administrador">Administrador — Usuarios, catálogo, precios y parámetros</option>
                <option value="desarrollador">Desarrollador — Acceso técnico total</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Contraseña Inicial *</label>
              <Input
                type="password"
                required
                minLength={8}
                value={nuevoPassword}
                onChange={(e) => setNuevoPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL EDITAR USUARIO */}
      {usuarioEditando && (
        <Modal
          titulo="Editar Usuario"
          subtitulo={`Actualizar perfil para ${usuarioEditando.email}`}
          icon={<PencilIcon className="w-5 h-5 text-abb-red" />}
          onClose={() => setUsuarioEditando(null)}
          size="md"
          footer={
            <>
              <Button
                variant="primary"
                onClick={() => {
                  const form = document.getElementById("form-editar-usuario") as HTMLFormElement;
                  if (form) form.requestSubmit();
                }}
              >
                Guardar Cambios
              </Button>
              <Button variant="secondary" onClick={() => setUsuarioEditando(null)}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-editar-usuario" onSubmit={handleGuardarEdicionUsuario} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nombre Completo *</label>
              <Input
                type="text"
                required
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Rol en el Sistema *</label>
              <Select
                value={editRol}
                onChange={(e) => setEditRol(e.target.value as RolUsuarioType)}
              >
                <option value="analista">Analista — Tableros, salidas, BOM y planos</option>
                <option value="supervisor">Supervisor — Permisos analista + parámetros, reasignar y autorizar</option>
                <option value="administrador">Administrador — Usuarios, catálogo, precios y parámetros</option>
                <option value="desarrollador">Desarrollador — Acceso técnico total</option>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="edit-activo"
                checked={editActivo}
                onChange={(e) => setEditActivo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-abb-red focus:ring-abb-red cursor-pointer"
              />
              <label htmlFor="edit-activo" className="text-xs font-bold text-slate-700 cursor-pointer">
                Cuenta de Usuario Activa
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL RESET PASSWORD ADMIN */}
      {userResetTarget && (
        <Modal
          titulo="Resetear Contraseña"
          subtitulo={`Establecer nueva clave de acceso para ${userResetTarget.email}`}
          icon={<KeyIcon className="w-5 h-5 text-amber-500" />}
          onClose={() => setUserResetTarget(null)}
          size="md"
          footer={
            <>
              <Button
                variant="primary"
                onClick={() => {
                  const form = document.getElementById("form-reset-password") as HTMLFormElement;
                  if (form) form.requestSubmit();
                }}
              >
                Establecer Clave
              </Button>
              <Button variant="secondary" onClick={() => setUserResetTarget(null)}>
                Cancelar
              </Button>
            </>
          }
        >
          <form id="form-reset-password" onSubmit={handleAdminResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nueva Contraseña *</label>
              <Input
                type="password"
                required
                minLength={8}
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* CONFIRM DIALOG DESACTIVAR USUARIO */}
      {usuarioADesactivar && (
        <ConfirmDialog
          titulo="Desactivar Usuario"
          mensaje={`¿Estás seguro de que deseas desactivar al usuario "${usuarioADesactivar.nombre}" (${usuarioADesactivar.email})? El usuario no podrá acceder al sistema.`}
          textoConfirmar="Desactivar Cuenta"
          confirmando={desactivandoUsuario}
          onConfirm={handleConfirmDesactivarUsuario}
          onCancel={() => setUsuarioADesactivar(null)}
        />
      )}
    </div>
  );
}
