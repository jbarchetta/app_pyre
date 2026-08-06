import { Modal } from "./common/Modal";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface ConfirmDialogProps {
  titulo: string;
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmando?: boolean;
  error?: string | null;
  textoConfirmar?: string;
}

export function ConfirmDialog({
  titulo,
  mensaje,
  onConfirm,
  onCancel,
  confirmando = false,
  error = null,
  textoConfirmar = "Confirmar",
}: ConfirmDialogProps) {
  return (
    <Modal
      titulo={titulo}
      subtitulo="Confirmación requerida"
      icon={<ExclamationTriangleIcon className="w-5 h-5 text-abb-red" />}
      onClose={onCancel}
      error={error}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmando}
            className="bg-abb-red hover:bg-red-700 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            {confirmando ? "Procesando..." : textoConfirmar}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold px-4 py-2 text-xs rounded-lg transition cursor-pointer"
          >
            Cancelar
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{mensaje}</p>
    </Modal>
  );
}
