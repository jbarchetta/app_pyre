import { NavLink, Outlet } from "react-router-dom";
import { CpuChipIcon } from "@heroicons/react/24/outline";

interface NavItem {
  label: string;
  to: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Proyectos", to: "/proyectos" },
  { label: "Catálogo", to: "/catalogo" },
  { label: "Parámetros de cálculo", to: "/parametros-calculo" },
  { label: "Cotización (BOM)", to: "/cotizacion-bom" },
  { label: "Administración", to: "/admin-config" },
  { label: "Cotizador", to: "/cotizador", disabled: true },
];

export function Layout() {
  return (
    <div className="flex min-h-screen bg-surface text-on-background">
      <aside className="flex w-64 flex-col gap-2 border-r border-surface-stroke bg-industrial-gray px-4 py-8">
        <p className="mb-8 px-2 text-lg font-bold text-abb-red">CONFIGURADOR PYRE</p>
        <nav className="flex flex-col gap-1" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) =>
            item.disabled ? (
              <button
                key={item.label}
                type="button"
                disabled
                aria-disabled="true"
                className="flex items-center justify-between px-3 py-3 text-sm uppercase tracking-widest text-secondary opacity-50 disabled:cursor-not-allowed"
              >
                {item.label}
                <span className="font-mono text-[10px]">Próximo módulo</span>
              </button>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-3 text-sm uppercase tracking-widest ${
                    isActive ? "bg-abb-red text-white" : "text-secondary hover:bg-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-16 items-center border-b border-surface-stroke bg-white px-8">
          <CpuChipIcon className="w-6 h-6 mr-2 text-abb-red" />
          <span className="text-lg font-bold text-abb-red">CONFIGURADOR PYRE</span>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
