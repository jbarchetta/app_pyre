import { NavLink, Outlet } from "react-router-dom";

interface NavItem {
  label: string;
  to: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Proyectos", to: "/proyectos" },
  { label: "Catálogo", to: "/catalogo" },
  { label: "Parámetros de cálculo", to: "/parametros-calculo" },
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
              <span
                key={item.label}
                aria-disabled="true"
                className="flex items-center justify-between px-3 py-3 text-sm uppercase tracking-widest text-secondary opacity-50"
              >
                {item.label}
                <span className="font-mono text-[10px]">Próximo módulo</span>
              </span>
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
          <span className="material-symbols-outlined mr-2 text-abb-red">settings_input_component</span>
          <span className="text-lg font-bold text-abb-red">CONFIGURADOR PYRE</span>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
