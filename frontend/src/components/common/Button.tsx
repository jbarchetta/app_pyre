import React from "react";

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
    "bg-abb-red text-white hover:bg-red-700 active:bg-red-800 border border-red-600 shadow-2xs focus:ring-2 focus:ring-red-400 font-semibold",
  secondary:
    "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-2xs font-medium",
  outline:
    "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium shadow-2xs",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium",
  danger:
    "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 font-medium shadow-2xs",
  "cad-tool":
    "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 font-sans text-xs font-medium",
  "cad-tool-active":
    "bg-abb-red text-white border border-red-600 font-sans text-xs font-semibold shadow-inner",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs gap-1.5 rounded-md",
  sm: "px-2.5 py-1.5 text-xs gap-1.5 rounded-md",
  md: "px-3.5 py-2 text-sm gap-2 rounded-md",
  lg: "px-4 py-2.5 text-base gap-2 rounded-lg",
  icon: "p-1.5 rounded-md",
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
    const baseClasses =
      "inline-flex items-center justify-center font-sans tracking-wide transition-all duration-150 ease-in-out select-none disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none";

    const computedClass = `${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    return (
      <button ref={ref} className={computedClass} disabled={disabled || isLoading} {...props}>
        {isLoading ? (
          <svg className="animate-spin w-4 h-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
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
