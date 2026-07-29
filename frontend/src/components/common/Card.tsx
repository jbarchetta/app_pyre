import React from "react";

/**
 * Panel de superficie. Reemplaza el patrón repetido
 * `border border-surface-stroke bg-white rounded-xl shadow-2xs` que hoy está
 * copiado a mano en decenas de lugares con radios y sombras distintas.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `sunken` para paneles anidados que deben leerse por debajo del contenedor. */
  tone?: "surface" | "sunken";
  /** Sin padding interno: útil cuando el hijo es una tabla a sangre completa. */
  flush?: boolean;
}

export function Card({ tone = "surface", flush = false, className = "", children, ...props }: CardProps) {
  const toneClass = tone === "sunken" ? "bg-surface-sunken" : "bg-surface";
  const padding = flush ? "" : "p-5";

  return (
    <div
      className={`rounded-card border border-line shadow-card ${toneClass} ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Acciones alineadas a la derecha del título. */
  actions?: React.ReactNode;
}

export function CardHeader({ actions, className = "", children, ...props }: CardHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 ${className}`}
      {...props}
    >
      <div className="min-w-0">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`truncate text-sm font-semibold text-ink ${className}`} {...props}>
      {children}
    </h2>
  );
}

export function CardBody({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
