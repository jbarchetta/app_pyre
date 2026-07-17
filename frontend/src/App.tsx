import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { CatalogoPage } from "./pages/CatalogoPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ParametrosCalculoPage } from "./pages/ParametrosCalculoPage";
import { ProyectoDetallePage } from "./pages/ProyectoDetallePage";
import { ProyectosPage } from "./pages/ProyectosPage";
import { TableroPage } from "./pages/TableroPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/catalogo"
          element={
            <RequireAuth>
              <CatalogoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/proyectos"
          element={
            <RequireAuth>
              <ProyectosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/proyectos/:id"
          element={
            <RequireAuth>
              <ProyectoDetallePage />
            </RequireAuth>
          }
        />
        <Route
          path="/tableros/:id"
          element={
            <RequireAuth>
              <TableroPage />
            </RequireAuth>
          }
        />
        <Route
          path="/parametros-calculo"
          element={
            <RequireAuth>
              <ParametrosCalculoPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
