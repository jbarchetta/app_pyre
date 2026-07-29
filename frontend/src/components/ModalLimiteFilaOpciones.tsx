import { ExclamationTriangleIcon, ArrowRightIcon, Cog6ToothIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "./common/Button";

export interface ModalLimiteFilaOpcionesProps {
  isOpen: boolean;
  filaOrigenNombre: string;
  polosSolicitados: number;
  polosDisponiblesOrigen: number;
  filaDisponible?: { id: string; nombre: string } | null;
  onMoverAFila: (filaId: string) => void;
  onConfigurarNuevoTablero: () => void;
  onCancelar: () => void;
}

export function ModalLimiteFilaOpciones({
  isOpen,
  filaOrigenNombre,
  polosSolicitados,
  polosDisponiblesOrigen,
  filaDisponible,
  onMoverAFila,
  onConfigurarNuevoTablero,
  onCancelar,
}: ModalLimiteFilaOpcionesProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl border border-surface-stroke overflow-hidden text-gray-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del Modal (Tema App Oficial) */}
        <div className="flex items-center justify-between border-b border-surface-stroke pb-3 mb-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0" />
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-gray-800">
              Límite de Fila Alcanzado
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            title="Cerrar (Esc)"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Mensaje Explicativo */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-3 text-xs text-gray-700 mb-4">
          La <span className="font-bold text-gray-900">{filaOrigenNombre}</span> posee {polosDisponiblesOrigen} polos libres y no puede alojar este elemento de{" "}
          <span className="font-bold text-amber-700">{polosSolicitados} polo(s)</span>.
        </div>

        {/* Opciones de Acción */}
        <div className="space-y-2.5">
          {/* Opción 1: Mover a Fila Disponible */}
          {filaDisponible ? (
            <button
              type="button"
              onClick={() => onMoverAFila(filaDisponible.id)}
              className="w-full flex items-center justify-between rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 p-3 text-left transition group"
            >
              <div>
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <span>1. Reubicar en {filaDisponible.nombre}</span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">Espacio libre disponible en esta fila</div>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-emerald-700 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
            </button>
          ) : (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5 text-[11px] text-gray-500 text-center">
              No hay otras filas con espacio en el tablero actual.
            </div>
          )}

          {/* Opción 2: Configurar Nuevo Tablero / Gabinete */}
          <button
            type="button"
            onClick={onConfigurarNuevoTablero}
            className="w-full flex items-center justify-between rounded-lg bg-blue-50 hover:bg-blue-100/80 border border-blue-300 p-3 text-left transition group"
          >
            <div>
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span>2. Configurar Tablero / Gabinete</span>
              </div>
              <div className="text-[11px] text-blue-700 mt-0.5">Cambiar calibre de gabinete NIS o parámetros</div>
            </div>
            <Cog6ToothIcon className="h-4 w-4 text-blue-700 group-hover:rotate-45 transition-transform shrink-0 ml-2" />
          </button>
        </div>

        {/* Opción 3: Cancelar */}
        <div className="mt-4 pt-3 border-t border-surface-stroke flex justify-end">
          <Button variant="secondary" size="xs" onClick={onCancelar}>
            3. Cancelar (No agregar)
          </Button>
        </div>
      </div>
    </div>
  );
}
