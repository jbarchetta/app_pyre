import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FolderIcon,
  BookOpenIcon,
  CalculatorIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  ArrowRightStartOnRectangleIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { logout } from "../api/client";
import { APP_VERSION } from "../appInfo";
import { iniciales, useSesion } from "../auth/SesionContext";
import { Button } from "./common";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Proyectos", to: "/proyectos", icon: FolderIcon },
  { label: "Catálogo", to: "/catalogo", icon: BookOpenIcon },
  { label: "Parámetros", to: "/parametros-calculo", icon: CalculatorIcon },
  { label: "Cotización (BOM)", to: "/cotizacion-bom", icon: DocumentTextIcon },
  { label: "Administración", to: "/admin-config", icon: WrenchScrewdriverIcon },
];

const ROL_LABEL: Record<string, string> = {
  analista: "Analista",
  supervisor: "Supervisor",
};

export function Layout() {
  const usuario = useSesion();
  const navigate = useNavigate();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  async function handleLogout() {
    setCerrandoSesion(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setCerrandoSesion(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-canvas font-sans text-ink selection:bg-brand selection:text-white p-3 gap-3">
      {/* Sidebar Flotante Neo-SaaS: Tarjeta blanca flotante sobre el lienzo gris sedoso */}
      <aside className="z-20 flex w-60 shrink-0 flex-col justify-between rounded-card border border-line bg-surface p-4 shadow-card">
        <div>
          <div className="mb-6 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-control">
              <CpuChipIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-wide text-ink">
                PYRE <span className="text-brand">CAD</span>
              </span>
              <span className="block truncate text-[10px] uppercase tracking-widest text-ink-subtle font-mono">
                Configurador ABB
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5" aria-label="Navegación principal">
            {NAV_ITEMS.map(({ label, to, icon: Icono }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-full px-3.5 py-2.5 text-xs transition-all duration-150 ${
                    isActive
                      ? "bg-ink font-bold text-white shadow-control"
                      : "font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icono
                      className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        isActive ? "text-white" : "text-ink-subtle group-hover:text-ink"
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-line pt-3">
          {usuario && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-surface-sunken p-2.5 border border-line/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="dato-tecnico flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white shadow-xs">
                  {iniciales(usuario.nombre)}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-xs font-bold leading-tight text-ink">
                    {usuario.nombre}
                  </p>
                  <p className="truncate text-[10px] leading-tight text-ink-subtle font-medium">
                    {ROL_LABEL[usuario.rol] ?? usuario.rol}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                isLoading={cerrandoSesion}
                icon={<ArrowRightStartOnRectangleIcon className="h-4 w-4 text-ink-subtle hover:text-brand" />}
                title="Cerrar sesión"
              />
            </div>
          )}
          <div className="flex items-center justify-between px-2 text-[11px] text-ink-subtle">
            <span className="dato-tecnico font-semibold">{APP_VERSION}</span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              En línea
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col rounded-card border border-line bg-surface shadow-card overflow-hidden">
        <main className="flex flex-1 flex-col justify-between overflow-y-auto">
          <div className="flex-1 p-5 md:p-6">
            <Outlet />
          </div>

          <footer className="flex shrink-0 flex-col items-center justify-between gap-2 border-t border-line/60 bg-surface-sunken/40 px-6 py-2.5 text-[11px] text-ink-subtle md:flex-row">
            <span>
              PYRE Ingeniería · Configurador de tableros normalizados ABB IEC 61439
            </span>
            <span>© {new Date().getFullYear()} PYRE Ingeniería S.A.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
