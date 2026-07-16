import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { fetchCurrentUser } from "../api/client";

type Status = "loading" | "authenticated" | "anonymous";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((user) => {
      if (!active) return;
      setStatus(user ? "authenticated" : "anonymous");
    });
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") return <p>Cargando...</p>;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <>{children}</>;
}
