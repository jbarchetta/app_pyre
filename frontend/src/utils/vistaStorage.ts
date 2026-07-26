import type { Capas } from "../components/EsquemaVisual";

export type ModoVisual = "bloques" | "unifilar" | "topografico";

export interface ModoVisualState {
  zoom: number;
  panX?: number;
  panY?: number;
  capas: Capas;
  herramientaMedir?: boolean;
  theme?: "dark" | "light";
  showGrid?: boolean;
  snapGrid?: boolean;
  panelCapasAbierto?: boolean;
  isSaved?: boolean;
}

export const DEFAULTS_POR_MODO: Record<ModoVisual, ModoVisualState> = {
  bloques: {
    zoom: 1,
    capas: { codigos: true, embarrado: true },
  },
  unifilar: {
    zoom: 1,
    capas: { codigos: true, embarrado: true },
    herramientaMedir: false,
    theme: "dark",
    showGrid: true,
    snapGrid: false,
    panelCapasAbierto: false,
  },
  topografico: {
    zoom: 1,
    capas: { codigos: true, embarrado: true },
    herramientaMedir: false,
    theme: "dark",
    showGrid: true,
    snapGrid: false,
    panelCapasAbierto: false,
  },
};

const STORAGE_PREFIX = "pyre_cad_vista_v2";

function getStorageKey(userId?: string | null): string {
  const user = userId && userId.trim() ? userId.trim() : "anonymous";
  return `${STORAGE_PREFIX}_${user}`;
}

export function cargarEstadosVistaUsuario(userId?: string | null): Record<string, Record<ModoVisual, ModoVisualState>> {
  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.warn("Error cargando vistaStorage:", e);
    return {};
  }
}

export function guardarEstadosVistaUsuario(
  userId: string | null | undefined,
  estados: Record<string, Record<ModoVisual, ModoVisualState>>
) {
  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(estados));
  } catch (e) {
    console.warn("Error guardando vistaStorage:", e);
  }
}

export function obtenerEstadoModo(
  todosEstados: Record<string, Record<ModoVisual, ModoVisualState>>,
  tableroId: string,
  modo: ModoVisual
): ModoVisualState {
  const tableroModos = todosEstados[tableroId];
  if (tableroModos && tableroModos[modo]) {
    return { ...DEFAULTS_POR_MODO[modo], ...tableroModos[modo], isSaved: true };
  }
  return { ...DEFAULTS_POR_MODO[modo], isSaved: false };
}
