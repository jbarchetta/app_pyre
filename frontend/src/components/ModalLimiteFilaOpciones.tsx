import { ExclamationTriangleIcon, ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Modal } from "./common/Modal";
import { Button } from "./common/Button";

export interface ModalLimiteFilaOpcionesProps {
  isOpen: boolean;
  filaOrigenNombre: string;
  polosSolicitados: number;
  polosDisponiblesOrigen: number;
  filaDisponible?: { id: string; nombre: string } | null;
  gabineteActualAncho?: number;
  gabineteActualAlto?: number;
  gabineteSugerido?: { codigo?: string; ancho: number; alto: number } | null;
  gabineteAlternativo?: { codigo?: string; ancho: number; alto: number } | null;
  onSeleccionarGabinete?: (ancho: number, alto: number, esAlternativo?: boolean) => void;
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
  gabineteActualAncho,
  gabineteActualAlto,
  gabineteSugerido,
  gabineteAlternativo,
  onSeleccionarGabinete,
  onMoverAFila,
  onConfigurarNuevoTablero,
  onCancelar,
}: ModalLimiteFilaOpcionesProps) {
  if (!isOpen) return null;

  const currW = gabineteActualAncho || 450;
  const currH = gabineteActualAlto || 600;

  const optEstandar =
    gabineteSugerido && (gabineteSugerido.ancho !== currW || gabineteSugerido.alto !== currH)
      ? gabineteSugerido
      : { codigo: `NIS ${currW}.${currH + 150}.XX`, ancho: currW, alto: currH + 150 };

  const altW = currW === 450 ? 600 : 750;
  const optAlternativo =
    gabineteAlternativo && (gabineteAlternativo.ancho !== currW || gabineteAlternativo.alto !== currH)
      ? gabineteAlternativo
      : { codigo: `NIS ${altW}.${currH}.XX`, ancho: altW, alto: currH };

  return (
    <Modal
      titulo="Límite de Fila Alcanzado"
      subtitulo="Capacidad máxima de chasis superada en la fila actual"
      icon={<ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />}
      onClose={onCancelar}
      size="md"
      footer={
        <div className="flex justify-between items-center w-full">
          <button
            type="button"
            onClick={onConfigurarNuevoTablero}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            Abrir Configuración Manual
          </button>
          <Button variant="secondary" size="xs" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      }
    >
      {/* Mensaje Explicativo */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-slate-700">
        La <span className="font-bold text-slate-900">{filaOrigenNombre}</span> posee {polosDisponiblesOrigen} polos libres y no puede alojar este elemento de{" "}
        <span className="font-bold text-amber-700">{polosSolicitados} polo(s)</span>.
      </div>

      {/* Opciones de Acción */}
      <div className="space-y-3 pt-1">
        {/* Opción 1: Mover a Fila Disponible */}
        {filaDisponible ? (
          <button
            type="button"
            onClick={() => onMoverAFila(filaDisponible.id)}
            className="w-full flex items-center justify-between rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-300 p-3.5 text-left transition group cursor-pointer shadow-xs"
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
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-500 text-center">
            No hay otras filas con espacio suficiente en el tablero actual.
          </div>
        )}

        {/* Opción 2: Opciones Directas de Ampliación de Gabinete */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
            2. Ampliar Envolvente del Tablero:
          </div>

          {/* Opción A: Recomendada (Más Alto / Menor Costo) */}
          <div className="flex items-center justify-between p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl gap-3">
            <div>
              <div className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                <SparklesIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Opción Recomendada (Por Menor Costo):</span>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                {optEstandar.codigo || `NIS ${optEstandar.ancho}.${optEstandar.alto}`} ({optEstandar.ancho} x {optEstandar.alto} mm)
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="xs"
              onClick={() => {
                if (onSeleccionarGabinete) {
                  onSeleccionarGabinete(optEstandar.ancho, optEstandar.alto, false);
                } else {
                  onConfigurarNuevoTablero();
                }
              }}
            >
              Ampliar a {optEstandar.ancho}x{optEstandar.alto}
            </Button>
          </div>

          {/* Opción B: Formato Alternativo (Más Ancho) */}
          <div className="flex items-center justify-between p-3 bg-sky-50/80 border border-sky-200 rounded-xl gap-3">
            <div>
              <div className="text-xs font-bold text-sky-900 flex items-center gap-1">
                <SparklesIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Opción Formato Alternativo (Más Ancho):</span>
              </div>
              <div className="text-xs font-mono font-bold text-sky-700 mt-0.5">
                {optAlternativo.codigo || `NIS ${optAlternativo.ancho}.${optAlternativo.alto}`} ({optAlternativo.ancho} x {optAlternativo.alto} mm)
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => {
                if (onSeleccionarGabinete) {
                  onSeleccionarGabinete(optAlternativo.ancho, optAlternativo.alto, true);
                } else {
                  onConfigurarNuevoTablero();
                }
              }}
            >
              Ampliar a {optAlternativo.ancho}x{optAlternativo.alto}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
