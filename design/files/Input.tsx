import * as React from 'react';

/**
 * Input (Admin)
 * =============
 * Used in the Next.js + Tailwind admin. Mirrors the mobile Input visually but
 * uses Tailwind utility classes rather than RN StyleSheet.
 *
 * Tailwind config (admin/tailwind.config.ts) maps the design tokens:
 *   colors.brand.primary  -> #E63911
 *   colors.sand[*]        -> sand-{shade}
 *   etc.
 *
 * RTL is handled by the browser when <html dir="rtl">. We use logical
 * properties via Tailwind 3.3+'s `ps-*`, `pe-*`, `ms-*`, `me-*` utilities,
 * NOT `pl-*` / `pr-*`. This is the single biggest mistake to avoid.
 */

type Variant = 'default' | 'error' | 'success';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  /** Helper text below the input. Replaced by errorMessage if variant === 'error'. */
  helperText?: string;
  errorMessage?: string;
  variant?: Variant;
  /** Icon node rendered at the START of the input (auto-positions for RTL). */
  leadingIcon?: React.ReactNode;
  /** Icon node at the END. */
  trailingIcon?: React.ReactNode;
  /** Required indicator next to label. */
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, errorMessage, variant = 'default', leadingIcon, trailingIcon, required, id, className = '', ...rest }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const helperId = `${inputId}-helper`;

    const effectiveVariant: Variant = errorMessage ? 'error' : variant;

    const borderClasses = {
      default: 'border-sand-200 focus-within:border-sand-400 focus-within:ring-2 focus-within:ring-brand-primary/30',
      error:   'border-crimson-400 focus-within:border-crimson-500 focus-within:ring-2 focus-within:ring-crimson-400/30',
      success: 'border-olive-400 focus-within:border-olive-500 focus-within:ring-2 focus-within:ring-olive-400/30',
    }[effectiveVariant];

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-sand-900 select-none"
        >
          {label}
          {required && <span className="text-brand-primary ms-1" aria-hidden="true">*</span>}
        </label>

        {/* Wrapper handles leading/trailing icons. Using flex + ps/pe so the
            icons sit on the start/end logically — auto-mirrors in RTL. */}
        <div
          className={`
            flex items-center gap-2
            min-h-[44px] px-3
            bg-white rounded-md border ${borderClasses}
            transition-shadow duration-150
          `}
        >
          {leadingIcon && (
            <span className="flex-shrink-0 text-sand-500" aria-hidden="true">
              {leadingIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={effectiveVariant === 'error'}
            aria-describedby={(helperText || errorMessage) ? helperId : undefined}
            className="
              flex-1 min-w-0 bg-transparent outline-none
              text-base text-sand-900 placeholder:text-sand-400
              py-2.5
            "
            {...rest}
          />

          {trailingIcon && (
            <span className="flex-shrink-0 text-sand-500" aria-hidden="true">
              {trailingIcon}
            </span>
          )}
        </div>

        {(errorMessage || helperText) && (
          <p
            id={helperId}
            className={`text-xs ${
              effectiveVariant === 'error' ? 'text-crimson-500' : 'text-sand-500'
            }`}
          >
            {errorMessage ?? helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
