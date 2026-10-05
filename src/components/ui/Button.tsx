import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'error' | 'inherit' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  loading?: boolean;
}

export const Button = ({
  variant = 'text',
  color = 'primary',
  size = 'medium',
  startIcon,
  endIcon,
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) => {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

  const sizes: Record<string, string> = {
    small: 'px-2.5 py-1 text-xs',
    medium: 'px-3.5 py-1.5 text-sm',
    large: 'px-5 py-2.5 text-sm',
  };

  const variants: Record<string, string> = {
    contained_primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
    contained_error: 'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 shadow-sm',
    contained_inherit: 'bg-slate-700 text-white hover:bg-slate-800 shadow-sm',
    contained_secondary: 'bg-slate-500 text-white hover:bg-slate-600 shadow-sm',
    outlined_primary: 'border border-primary-600 text-primary-600 hover:bg-primary-50',
    outlined_error: 'border border-error-600 text-error-600 hover:bg-error-50',
    outlined_inherit: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    outlined_secondary: 'border border-slate-400 text-slate-600 hover:bg-slate-50',
    text_primary: 'text-primary-600 hover:bg-primary-50',
    text_error: 'text-error-600 hover:bg-error-50',
    text_inherit: 'text-slate-600 hover:bg-slate-100',
    text_secondary: 'text-slate-500 hover:bg-slate-100',
  };

  const key = `${variant}_${color}`;
  return (
    <button
      className={cn(base, sizes[size], variants[key] ?? variants['text_primary'], className)}
      disabled={disabled || loading}
      {...props}
    >
      {startIcon && <span className="shrink-0 flex items-center [&>svg]:w-4 [&>svg]:h-4">{startIcon}</span>}
      {children}
      {endIcon && <span className="shrink-0 flex items-center [&>svg]:w-4 [&>svg]:h-4">{endIcon}</span>}
    </button>
  );
};

export default Button;
