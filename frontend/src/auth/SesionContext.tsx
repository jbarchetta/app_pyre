import { createContext, useContext } from "react";
import type { Usuario } from "../api/client";

/**
 * Usuario autenticado de la sesión actual.
 *
 * `RequireAuth` ya pedía `/auth/me` para decidir si dejar pasar, pero
 * descartaba el usuario -- por eso el header mostraba un "Analista PYRE"
 * hardcodeado. Este contexto expone ese dato que ya estaba disponible.
 *
 * El valor por defecto es `null` a propósito: los tests renderizan `Layout`
 * sin proveedor, y en ese caso debe degradar sin romper.
 */
const SesionContext = createContext<Usuario | null>(null);

export const SesionProvider = SesionContext.Provider;

export function useSesion(): Usuario | null {
  return useContext(SesionContext);
}

/** Iniciales para el avatar: "Ana Torres" -> "AT", "Ana" -> "AN". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "??";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
