import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  titulo: string;
  mensaje: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmando?: boolean;
  error?: string | null;
}

export function ConfirmDialog({
  titulo,
  mensaje,
  onConfirm,
  onCancel,
  confirmando = false,
  error = null,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-titulo"
        className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
      >
        <h2 id="confirm-dialog-titulo" className="text-lg font-bold">
          {titulo}
        </h2>
        <p>{mensaje}</p>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmando}
            className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
