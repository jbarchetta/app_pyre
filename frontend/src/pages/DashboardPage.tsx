import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Panel</h1>
      <div className="mt-6 flex flex-col gap-2">
        <Link to="/proyectos" className="border border-surface-stroke bg-white p-4 hover:border-abb-red">
          Proyectos
        </Link>
        <Link to="/catalogo" className="border border-surface-stroke bg-white p-4 hover:border-abb-red">
          Importar catálogo
        </Link>
        <Link to="/parametros-calculo" className="border border-surface-stroke bg-white p-4 hover:border-abb-red">
          Parámetros de cálculo
        </Link>
      </div>
    </div>
  );
}
