// Memoria en RAM (no localStorage) de la última búsqueda/filtros de
// ComponentePicker, por contexto -- se resetea al recargar la página, que es
// el comportamiento esperado: "recordar durante la sesión de carga", no
// persistir indefinidamente. Cada caller de ComponentePicker pasa su propio
// contextKey (ej. "interruptor-principal", "salida-componente") para que
// buscar un interruptor principal y buscar el componente de una salida no se
// pisen entre sí.
export interface MemoriaBusqueda {
  query: string;
  filtroTipo?: string | null;
  filtroPolos: number | null;
  filtroCorriente: string | null;
  filtroCapacidad: string | null;
  filtroSensibilidad?: number | null;
  filtroAccesorios?: boolean | null;
}

const memoria = new Map<string, MemoriaBusqueda>();

export function obtenerMemoria(contextKey: string): MemoriaBusqueda | undefined {
  return memoria.get(contextKey);
}

export function guardarMemoria(contextKey: string, valor: MemoriaBusqueda): void {
  memoria.set(contextKey, valor);
}

// Solo para tests -- limpia el estado del módulo entre tests ya que el Map
// vive a nivel de módulo y persistiría entre archivos/tests sin esto.
export function limpiarMemoriaParaTests(): void {
  memoria.clear();
}
