import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { fetchCurrentUser, type Usuario } from "../api/client";
import { SesionProvider } from "./SesionContext";

type Status = "loading" | "authenticated" | "anonymous";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((user) => {
      if (!active) return;
      setUsuario(user);
      setStatus(user ? "authenticated" : "anonymous");
    });
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") return <p>Cargando...</p>;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  // El usuario ya está en memoria por el chequeo de arriba -- se comparte para
  // que el shell no tenga que volver a pedirlo ni inventar datos.
  return <SesionProvider value={usuario}>{children}</SesionProvider>;
}
