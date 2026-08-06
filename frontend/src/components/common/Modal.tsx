import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useCerrarAlClickFuera } from "../../hooks/useCerrarAlClickFuera";

export interface ModalProps {
  titulo: string;
  subtitulo?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Acciones del pie, alineadas a la derecha (primaria primero). */
  footer?: React.ReactNode;
  footerNote?: string;
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

export function Modal({
  titulo,
  subtitulo,
  icon,
  onClose,
  children,
  footer,
  footerNote,
  size = "sm",
  error = null,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { onMouseDown, onClick } = useCerrarAlClickFuera(onClose);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const modalMarkup = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-modal-backdrop"
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
        className={`flex max-h-[90vh] ${sizeStyles[size]} max-w-full flex-col overflow-hidden rounded-xl border border-slate-700 bg-white shadow-2xl animate-modal-card`}
      >
        {/* Cabecera Oscura Unificada estilo PYRE / ABB */}
        <div className="relative bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/80 shadow-inner text-abb-red font-black text-xs">
                {icon || <span className="tracking-tighter">PYRE</span>}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold text-white tracking-tight leading-tight">
                  {titulo}
                </h2>
                {subtitulo && (
                  <p className="truncate text-xs font-normal text-slate-300 mt-0.5">
                    {subtitulo}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Cerrar modal"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-abb-red" />
        </div>

        {/* Cuerpo del Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-slate-800 bg-white">{children}</div>

        {/* Pie del Modal */}
        {(footer || error || footerNote) && (
          <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-4">
            {error && (
              <p role="alert" className="mb-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-2">
                <ExclamationCircleIcon className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                {footerNote || "PYRE v1.0 · Sistema de ingeniería ABB"}
              </span>
              {footer && <div className="flex flex-wrap items-center gap-2.5 justify-end ml-auto">{footer}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
