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
import { Badge, Button } from "./common";

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
    <div className="flex min-h-screen bg-canvas font-sans text-ink selection:bg-brand selection:text-white">
      {/* Sidebar oscuro: única franja oscura del shell, para que el área de
          trabajo quede clara y el contraste guíe la atención al contenido. */}
      <aside className="z-20 flex w-60 shrink-0 flex-col justify-between border-r border-line-inverse bg-surface-inverse py-5">
        <div>
          <div className="mb-7 flex items-center gap-3 px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand text-white">
              <CpuChipIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-wide text-ink-inverse">
                PYRE <span className="text-brand">CAD</span>
              </span>
              <span className="block truncate text-[10px] uppercase tracking-widest text-ink-inverse-muted">
                Configurador ABB
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-0.5 px-2.5" aria-label="Navegación principal">
            {NAV_ITEMS.map(({ label, to, icon: Icono }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-surface-inverse-raised font-semibold text-ink-inverse"
                      : "font-medium text-ink-inverse-muted hover:bg-surface-inverse-raised/60 hover:text-ink-inverse"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Marca de item activo: barra de marca a la izquierda, en
                        lugar del borde que desplazaba el contenido. */}
                    <span
                      aria-hidden="true"
                      className={`h-5 w-0.5 shrink-0 rounded-full transition-colors ${
                        isActive ? "bg-brand" : "bg-transparent"
                      }`}
                    />
                    <Icono
                      className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        isActive ? "text-brand" : "text-ink-inverse-muted group-hover:text-ink-inverse"
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-line-inverse px-3 pt-4">
          {usuario && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-control bg-surface-inverse-raised p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="dato-tecnico flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-brand text-xs font-bold text-white shadow-xs">
                  {iniciales(usuario.nombre)}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-xs font-semibold leading-tight text-ink-inverse">
                    {usuario.nombre}
                  </p>
                  <p className="truncate text-[10px] leading-tight text-ink-inverse-muted">
                    {ROL_LABEL[usuario.rol] ?? usuario.rol}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                isLoading={cerrandoSesion}
                icon={<ArrowRightStartOnRectangleIcon className="h-4 w-4 text-ink-inverse-muted hover:text-brand" />}
                title="Cerrar sesión"
              />
            </div>
          )}
          <div className="flex items-center justify-between px-1 text-[11px] text-ink-inverse-muted">
            <span className="dato-tecnico">{APP_VERSION}</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              En línea
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 flex-col justify-between overflow-y-auto">
          <div className="flex-1 p-4 md:p-5">
            <Outlet />
          </div>

          <footer className="flex shrink-0 flex-col items-center justify-between gap-2 border-t border-line px-5 py-2 text-[11px] text-ink-subtle md:flex-row">
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
