import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  LockClosedIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { login, restablecerPassword } from "../api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal de Restablecer Contraseña
  const [modalReset, setModalReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [mostrarResetPassword, setMostrarResetPassword] = useState(false);
  const [resetCargando, setResetCargando] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetExito, setResetExito] = useState<string | null>(null);

  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Credenciales inválidas");
    } finally {
      setCargando(false);
    }
  }

  function handleRellenarDemo() {
    setEmail("analista@pyre.com");
    setPassword("clave-demo-123");
    setError(null);
  }

  async function handleResetSubmit(event: FormEvent) {
    event.preventDefault();
    setResetError(null);
    setResetExito(null);
    setResetCargando(true);
    try {
      const res = await restablecerPassword(resetEmail, resetPassword);
      setResetExito(res.message || "Contraseña restablecida exitosamente");
      setTimeout(() => {
        setEmail(resetEmail);
        setPassword(resetPassword);
        setModalReset(false);
        setResetExito(null);
      }, 1500);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña");
    } finally {
      setResetCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 relative overflow-hidden select-none">
      {/* Fondo Industrial Decorativo */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#b91c1c_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-10">
        {/* Cabecera de Marca PYRE / ABB */}
        <div className="bg-slate-950 p-6 text-white border-b-4 border-abb-red text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-abb-red/10 rounded-full border border-abb-red/30 mb-1">
            <span className="font-mono text-xl font-extrabold text-abb-red tracking-wider">PYRE</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
            Configurador de Tableros
          </h1>
          <p className="text-xs text-gray-400">Portal de Ingeniería y Selección de Componentes ABB</p>
        </div>

        {/* Formulario de Login */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {/* Mensaje de Error en Login */}
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 font-medium animate-fadeIn">
              <ExclamationTriangleIcon className="w-4 h-4 text-abb-red shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700">
              Email corporativo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <EnvelopeIcon className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@pyre.com"
                required
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red text-gray-900 font-mono transition outline-none"
              />
            </div>
            <p className="text-[11px] text-gray-500">Ingrese su correo registrado en la plataforma.</p>
          </div>

          {/* Campo Contraseña con Toggle Ojo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email || "analista@pyre.com");
                  setModalReset(true);
                }}
                className="text-[11px] font-semibold text-abb-red hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <LockClosedIcon className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red text-gray-900 font-mono transition outline-none"
              />
              <button
                type="button"
                aria-label={mostrarPassword ? "Ocultar clave" : "Ver clave"}
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                title={mostrarPassword ? "Ocultar clave" : "Ver clave"}
              >
                {mostrarPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 bg-abb-red hover:bg-red-700 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {cargando ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Validando...
              </>
            ) : (
              "Ingresar"
            )}
          </button>

          {/* Chip de Acceso Rápido Demo */}
          <div className="pt-2 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={handleRellenarDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-abb-red border border-red-200 rounded-full text-xs font-semibold font-mono transition"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              Auto-completar credenciales demo (Analista)
            </button>
          </div>
        </form>

        {/* Footer Informativo */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-center text-[11px] text-gray-500 font-mono">
          PYRE v1.0 • Sistema Integrado de Ingeniería ABB
        </div>
      </div>

      {/* MODAL DE RESTABLECER CONTRASEÑA */}
      {modalReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden space-y-4 p-6 relative">
            <button
              type="button"
              onClick={() => setModalReset(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-abb-red">
              <KeyIcon className="w-6 h-6" />
              <h2 className="text-base font-bold uppercase font-mono text-gray-900">Restablecer Contraseña</h2>
            </div>
            <p className="text-xs text-gray-600">
              Ingrese su correo corporativo y defina una nueva contraseña para actualizar el acceso.
            </p>

            {resetError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                <ExclamationTriangleIcon className="w-4 h-4 text-abb-red shrink-0 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}

            {resetExito && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-xs text-green-700 font-semibold">
                <CheckCircleIcon className="w-4 h-4 text-green-600 shrink-0" />
                <span>{resetExito}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="reset-email" className="block text-xs font-mono font-bold uppercase text-gray-700">
                  Email registrado
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="analista@pyre.com"
                  required
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="reset-pass" className="block text-xs font-mono font-bold uppercase text-gray-700">
                  Nueva clave (mínimo 8 caracteres)
                </label>
                <div className="relative">
                  <input
                    id="reset-pass"
                    type={mostrarResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    required
                    className="w-full px-3 py-2 pr-10 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarResetPassword(!mostrarResetPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {mostrarResetPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalReset(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetCargando}
                  className="px-4 py-2 bg-abb-red hover:bg-red-700 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {resetCargando ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : "Actualizar Contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
