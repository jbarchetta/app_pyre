import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { CatalogoPage } from "./pages/CatalogoPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ParametrosCalculoPage } from "./pages/ParametrosCalculoPage";
import { ProyectosPage } from "./pages/ProyectosPage";
import { ProyectoWorkspacePage } from "./pages/ProyectoWorkspacePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/proyectos" element={<ProyectosPage />} />
          <Route path="/proyectos/:id" element={<ProyectoWorkspacePage />} />
          <Route path="/parametros-calculo" element={<ParametrosCalculoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
