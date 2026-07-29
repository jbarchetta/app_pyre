import React from "react";

/**
 * Botón canónico de la app. Usa exclusivamente tokens del design system
 * (ver `src/index.css`) -- nada de paleta cruda de Tailwind acá, porque este
 * componente es la referencia que se copia al escribir pantallas nuevas.
 *
 * Elección de variantes:
 * - `primary`   rojo ABB sólido. Una sola por vista: la acción principal.
 * - `secondary` superficie blanca con borde. El caballito de batalla.
 * - `outline`   igual que secondary pero con borde más marcado (sobre gris).
 * - `ghost`     sin fondo ni borde. Para acciones densas en tablas/toolbars.
 * - `danger`    rojo tintado (NO sólido) -- distingue "cuidado" de "avanzar",
 *               que es lo que evita que marca y destructivo se confundan.
 * - `cad-tool` / `cad-tool-active` para toolbars sobre superficie oscura.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "cad-tool"
  | "cad-tool-active";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white border border-brand hover:bg-brand-hover hover:border-brand-hover active:bg-brand-active shadow-control font-semibold",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-sunken hover:border-line-strong shadow-control font-medium",
  outline:
    "bg-surface text-ink border border-line-strong hover:bg-surface-sunken hover:border-ink-subtle shadow-control font-medium",
  ghost:
    "bg-transparent text-ink-muted border border-transparent hover:bg-surface-sunken hover:text-ink font-medium",
  danger:
    "bg-danger-tint text-danger border border-danger-line hover:bg-brand-tint hover:border-danger font-medium shadow-control",
  "cad-tool":
    "bg-surface-inverse/90 text-ink-inverse/70 border border-white/10 hover:bg-surface-inverse hover:text-ink-inverse text-xs font-medium",
  "cad-tool-active":
    "bg-brand text-white border border-brand text-xs font-semibold shadow-control",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs gap-1.5 rounded-control",
  sm: "px-2.5 py-1.5 text-xs gap-1.5 rounded-control",
  md: "px-3.5 py-2 text-sm gap-2 rounded-control",
  lg: "px-5 py-2.5 text-base gap-2 rounded-card",
  icon: "p-1.5 rounded-control",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "sm",
      icon,
      iconPosition = "left",
      isLoading = false,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    // El anillo de foco lo aplica `:focus-visible` global (index.css), así que
    // acá no se pisa el outline -- mantiene la navegación por teclado usable.
    const baseClasses =
      "inline-flex items-center justify-center font-sans whitespace-nowrap transition-colors duration-150 ease-out select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none";

    const computedClass = `${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    return (
      <button
        ref={ref}
        className={computedClass}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="h-4 w-4 shrink-0 animate-spin text-current"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children && <span>{children}</span>}
          </>
        ) : (
          <>
            {icon && iconPosition === "left" && <span className="inline-flex shrink-0">{icon}</span>}
            {children && <span>{children}</span>}
            {icon && iconPosition === "right" && <span className="inline-flex shrink-0">{icon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
