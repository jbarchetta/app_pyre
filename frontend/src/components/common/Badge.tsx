import React from "react";

/**
 * Pill de estado. Unifica los badges de origen de componente
 * (auto / manual / sin match), estado de proyecto y contadores.
 *
 * `tone` es semántico a propósito -- quien la usa no elige un color, elige un
 * significado, y así el mapeo queda centralizado acá.
 */
export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  /** Datos eléctricos (A, kA, mm², códigos SAP) van en monoespaciado tabular. */
  mono?: boolean;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-muted border-line",
  brand: "bg-brand-tint text-brand border-brand-line",
  success: "bg-success-tint text-success border-success-line",
  warning: "bg-warning-tint text-warning border-warning-line",
  danger: "bg-danger-tint text-danger border-danger-line",
  info: "bg-info-tint text-info border-info-line",
};

export function Badge({
  tone = "neutral",
  icon,
  mono = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-xs font-medium ${
        toneStyles[tone]
      } ${mono ? "dato-tecnico" : ""} ${className}`}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {children}
    </span>
  );
}
