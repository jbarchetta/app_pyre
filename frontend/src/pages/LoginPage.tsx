import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  LockClosedIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { login, restablecerPassword } from "../api/client";
import { APP_VERSION } from "../appInfo";
import { Button, Field, Input, Modal } from "../components/common";

/** Aviso inline reutilizado por login y por el modal de reset. */
function Aviso({ tono, children }: { tono: "danger" | "success"; children: React.ReactNode }) {
  const estilos =
    tono === "danger"
      ? "bg-danger-tint border-danger-line text-danger"
      : "bg-success-tint border-success-line text-success";
  const Icono = tono === "danger" ? ExclamationTriangleIcon : CheckCircleIcon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-control border p-3 text-xs font-medium ${estilos}`}
    >
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Botón de ojo para alternar la visibilidad de una clave. */
function ToggleClave({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const etiqueta = visible ? "Ocultar clave" : "Ver clave";
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onToggle}
      className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-subtle transition-colors hover:text-ink"
    >
      {visible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
    </button>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal de restablecer contraseña
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

  function handleRellenarDemo(rol: "analista" | "supervisor" | "administrador" | "desarrollador" = "analista") {
    setEmail(`${rol}@pyre.com`);
    setPassword("clave-demo-123");
    setError(null);
  }

  function cerrarReset() {
    setModalReset(false);
    setResetError(null);
    setResetExito(null);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-inverse p-4">
      {/* Trama de puntos en rojo de marca: da textura industrial sin competir
          con la tarjeta. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(var(--color-brand)_1px,transparent_1px)] [background-size:16px_16px]"
      />

      <div className="z-10 w-full max-w-md overflow-hidden rounded-modal border border-line bg-surface shadow-modal">
        <div className="space-y-2 border-b-4 border-brand bg-surface-inverse p-6 text-center">
          <div className="mb-1 inline-flex items-center justify-center rounded-full border border-brand/30 bg-brand/10 p-3">
            <span className="dato-tecnico text-xl font-extrabold tracking-wider text-brand">PYRE</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-inverse">Configurador de Tableros</h1>
          <p className="text-xs text-ink-inverse-muted">
            Portal de ingeniería y selección de componentes ABB
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
          {error && <Aviso tono="danger">{error}</Aviso>}

          <Field label="Email corporativo" hint="Ingresá el correo registrado en la plataforma." required>
            {(p) => (
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-subtle">
                  <EnvelopeIcon className="h-4 w-4" />
                </div>
                <Input
                  {...p}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. analista@pyre.com"
                  className="pl-9"
                />
              </div>
            )}
          </Field>

          <Field label="Contraseña" required>
            {(p) => (
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-subtle">
                  <LockClosedIcon className="h-4 w-4" />
                </div>
                <Input
                  {...p}
                  type={mostrarPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="pl-9 pr-10"
                />
                <ToggleClave visible={mostrarPassword} onToggle={() => setMostrarPassword(!mostrarPassword)} />
              </div>
            )}
          </Field>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setModalReset(true);
              }}
              className="text-xs font-semibold text-brand hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={cargando} className="w-full">
            {cargando ? "Validando…" : "Ingresar"}
          </Button>

          <div className="border-t border-line pt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-ink-subtle uppercase font-bold tracking-wider">
              <span>Auto-completar Demo:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleRellenarDemo("analista")}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition flex items-center justify-center gap-1 border border-slate-200"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-slate-600" /> Analista
              </button>
              <button
                type="button"
                onClick={() => handleRellenarDemo("supervisor")}
                className="px-2.5 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg transition flex items-center justify-center gap-1 border border-blue-200"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-blue-600" /> Supervisor
              </button>
              <button
                type="button"
                onClick={() => handleRellenarDemo("administrador")}
                className="px-2.5 py-1.5 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg transition flex items-center justify-center gap-1 border border-purple-200"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-purple-600" /> Admin
              </button>
              <button
                type="button"
                onClick={() => handleRellenarDemo("desarrollador")}
                className="px-2.5 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition flex items-center justify-center gap-1 border border-amber-200"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-amber-600" /> Dev
              </button>
            </div>
          </div>
        </form>

        <div className="border-t border-line bg-surface-sunken px-6 py-3 text-center text-xs text-ink-subtle">
          PYRE {APP_VERSION} · Sistema integrado de ingeniería ABB
        </div>
      </div>

      {modalReset && (
        <Modal
          titulo="Restablecer contraseña"
          subtitulo="Recuperación de acceso al portal de ingeniería ABB"
          icon={<KeyIcon className="w-5 h-5 text-abb-red" />}
          onClose={cerrarReset}
          size="md"
          footer={
            <>
              <Button type="submit" form="form-reset-password" variant="primary" size="md" isLoading={resetCargando}>
                Actualizar contraseña
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={cerrarReset}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {resetError && <Aviso tono="danger">{resetError}</Aviso>}
            {resetExito && <Aviso tono="success">{resetExito}</Aviso>}

            <form id="form-reset-password" onSubmit={handleResetSubmit} className="space-y-4">
              <Field label="Email registrado" required>
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="analista@pyre.com"
                    required
                  />
                )}
              </Field>

              <Field label="Nueva clave" hint="Mínimo 8 caracteres." required>
                {(p) => (
                  <div className="relative">
                    <Input
                      {...p}
                      type={mostrarResetPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      minLength={8}
                      required
                      className="pr-10"
                    />
                    <ToggleClave
                      visible={mostrarResetPassword}
                      onToggle={() => setMostrarResetPassword(!mostrarResetPassword)}
                    />
                  </div>
                )}
              </Field>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
