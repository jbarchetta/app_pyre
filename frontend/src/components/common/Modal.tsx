import React, { useEffect, useRef } from "react";
import { useCerrarAlClickFuera } from "../../hooks/useCerrarAlClickFuera";

/**
 * Shell de diálogo. Hoy este bloque (fondo negro translúcido + panel centrado
 * + `useCerrarAlClickFuera` + handler de Escape + `role="dialog"`) está
 * duplicado a mano en ~8 lugares, cada uno con su propio radio, ancho y
 * z-index. Centralizarlo también centraliza la accesibilidad.
 *
 * `onClose` recibe el pedido de cierre (backdrop o Escape). Quien lo use puede
 * interponer ahí la confirmación de "descartar cambios" ya existente, en vez
 * de cerrar directo.
 */
export interface ModalProps {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Acciones del pie, alineadas a la izquierda (primaria primero). */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Mensaje de error a nivel diálogo, sobre el pie. */
  error?: string | null;
}

const sizeStyles: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "w-96",
  md: "w-[32rem]",
  lg: "w-[42rem]",
  xl: "w-[56rem]",
};

export function Modal({ titulo, onClose, children, footer, size = "sm", error = null }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { onMouseDown, onClick } = useCerrarAlClickFuera(onClose);

  useEffect(() => {
    panelRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[1px]"
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[90vh] ${sizeStyles[size]} max-w-full flex-col overflow-hidden rounded-modal border border-line bg-surface shadow-modal`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="truncate text-sm font-semibold text-ink">{titulo}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {(footer || error) && (
          <div className="border-t border-line px-5 py-3.5">
            {error && (
              <p role="alert" className="mb-3 text-xs font-medium text-danger">
                {error}
              </p>
            )}
            {footer && <div className="flex flex-wrap items-center gap-2">{footer}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
