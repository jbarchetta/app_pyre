import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { CatalogoPage } from "./pages/CatalogoPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
