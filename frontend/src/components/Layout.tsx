import { NavLink, Outlet } from "react-router-dom";
import {
  FolderIcon,
  BookOpenIcon,
  CalculatorIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  BellIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Proyectos", to: "/proyectos", icon: FolderIcon },
  { label: "Catálogo", to: "/catalogo", icon: BookOpenIcon },
  { label: "Parámetros", to: "/parametros-calculo", icon: CalculatorIcon },
  { label: "Cotización (BOM)", to: "/cotizacion-bom", icon: DocumentTextIcon, badge: 1 },
  { label: "Administración", to: "/admin-config", icon: WrenchScrewdriverIcon },
];

export function Layout() {
  return (
    <div className="flex min-h-screen bg-[#F1F3F6] text-slate-800 font-sans selection:bg-abb-red selection:text-white">
      {/* Sidebar Oscuro Slate/Navy `#2C3645` */}
      <aside className="w-60 bg-[#2C3645] flex flex-col justify-between shrink-0 py-6 border-r border-slate-700/50 shadow-xl relative z-20">
        <div>
          {/* App Brand Header */}
          <div className="px-5 mb-8 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-abb-red flex items-center justify-center text-white shadow-md">
              <CpuChipIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="block font-black text-sm text-white tracking-wide font-mono uppercase">
                PYRE <span className="text-abb-red font-extrabold">CAD</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                Configurador ABB
              </span>
            </div>
          </div>

          {/* Navigation Links with Active Extended Tab shape */}
          <nav className="flex flex-col gap-1.5 pr-0" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const IconComp = item.icon;
              if (item.disabled) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="flex items-center justify-between px-5 py-3 text-xs uppercase font-semibold text-slate-500 opacity-40 disabled:cursor-not-allowed mx-2"
                  >
                    <div className="flex items-center gap-3">
                      <IconComp className="w-4 h-4 text-slate-500" />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              }

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between transition-all duration-200 text-xs uppercase font-bold tracking-wider py-3.5 px-5 ${
                      isActive
                        ? "bg-[#F1F3F6] text-slate-900 rounded-r-2xl border-y border-r border-slate-300/80 shadow-md font-extrabold relative z-30 translate-x-1"
                        : "text-slate-300 hover:text-white hover:bg-slate-700/40 rounded-l-lg mx-2"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <IconComp
                          className={`w-4 h-4 transition-colors ${
                            isActive ? "text-abb-red" : "text-slate-400"
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full transition-colors ${
                            isActive
                              ? "bg-abb-red text-white"
                              : "bg-red-500/80 text-white"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Brand Info */}
        <div className="px-5 pt-4 border-t border-slate-700/50 text-[11px] text-slate-400 font-mono flex items-center justify-between">
          <span>v2.5 Professional</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Sistema online" />
        </div>
      </aside>

      {/* Main Content Area with Header */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Dark Slate Top Header Bar */}
        <header className="h-16 bg-[#2C3645] border-b border-slate-700/50 px-8 flex items-center justify-between shadow-md text-white shrink-0">
          {/* Search Box / Top Bar Filter Tags */}
          <div className="flex items-center gap-3">
            <div className="relative w-64 hidden sm:block">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar tableros, sap..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-abb-red focus:ring-1 focus:ring-abb-red"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                PROYECTOS
              </span>
              <span className="px-2.5 py-1 rounded-md bg-abb-red/20 text-red-300 border border-red-500/30 font-bold">
                ABB NORMALIZADO
              </span>
            </div>
          </div>

          {/* User Controls and Notifications */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Notificaciones de cálculo"
            >
              <BellIcon className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-abb-red text-white text-[9px] font-bold font-mono rounded-full flex items-center justify-center border border-slate-900">
                2
              </span>
            </button>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs font-mono text-white">
                PY
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-100 leading-tight">Analista PYRE</p>
                <p className="text-[10px] text-slate-400 font-mono">Ingeniería ABB</p>
              </div>
              <Cog6ToothIcon className="w-4 h-4 text-slate-400 hover:text-white cursor-pointer ml-1" />
            </div>
          </div>
        </header>

        {/* Main View Container */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
