import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <div>
      <h1>Panel</h1>
      <Link to="/proyectos">Proyectos</Link>
      <Link to="/catalogo">Importar catálogo</Link>
      <Link to="/parametros-calculo">Parámetros de cálculo</Link>
    </div>
  );
}
