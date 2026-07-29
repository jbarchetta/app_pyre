import React, { useId } from "react";

/* ============================================================================
   Controles de formulario
   ----------------------------------------------------------------------------
   El plugin @tailwindcss/forms ya normaliza los inputs, así que acá sólo se
   define la capa de marca: borde, radio, foco y estado de error.

   `Field` cablea automáticamente label ↔ control ↔ mensaje de error
   (htmlFor / id / aria-describedby / aria-invalid), que es la parte que hoy
   está hecha a mano y de forma inconsistente en cada pantalla.
   ========================================================================== */

const controlBase =
  "w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle";

const controlNormal = "border-line-strong hover:border-ink-subtle";
const controlError = "border-danger hover:border-danger";

function controlClasses(invalid: boolean, extra: string) {
  return `${controlBase} ${invalid ? controlError : controlNormal} ${extra}`;
}

export interface FieldProps {
  label: string;
  /** Texto de ayuda permanente debajo del control. */
  hint?: string;
  /** Si tiene valor, el control pasa a estado inválido y se anuncia por aria. */
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Recibe las props ya cableadas (id, aria-*) para pasarlas al control. */
  children: (controlProps: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
    invalid: boolean;
  }) => React.ReactNode;
}

export function Field({ label, hint, error, required, className = "", children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({ id, "aria-describedby": describedBy, "aria-invalid": invalid || undefined, invalid })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Datos eléctricos en monoespaciado tabular. */
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, mono = false, className = "", ...props }, ref) => (
    <input ref={ref} className={controlClasses(invalid, `${mono ? "dato-tecnico" : ""} ${className}`)} {...props} />
  )
);
Input.displayName = "Input";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid = false, className = "", children, ...props }, ref) => (
    <select ref={ref} className={controlClasses(invalid, className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";
