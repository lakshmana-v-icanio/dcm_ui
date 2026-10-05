import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface FieldWrapperProps {
  label?: string;
  required?: boolean;
  error?: string | boolean;
  helperText?: string;
  children: ReactNode;
}

export const FieldWrapper = ({ label, required, error, helperText, children }: FieldWrapperProps) => (
  <div className="flex flex-col gap-0.5">
    {label && (
      <label className="text-xs font-medium text-slate-700 mb-0.5">
        {label}{required && <span className="text-error-600 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {helperText && helperText.trim() && (
      <p className={cn('text-xs mt-0.5', error ? 'text-error-600' : 'text-slate-500')}>{helperText}</p>
    )}
  </div>
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  fullWidth?: boolean;
}

const inputBase = 'w-full rounded-md border text-sm text-slate-900 bg-white px-3 py-2 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 focus:border-primary-600 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

export const Input = ({ label, error, helperText, startAdornment, endAdornment, fullWidth = true, className, required, ...props }: InputProps) => (
  <FieldWrapper label={label} required={required} error={error} helperText={helperText}>
    <div className={cn('relative flex items-center', fullWidth && 'w-full')}>
      {startAdornment && <span className="absolute left-3 flex items-center text-slate-400 [&>svg]:w-4 [&>svg]:h-4 pointer-events-none">{startAdornment}</span>}
      <input
        className={cn(
          inputBase,
          error ? 'border-error-500 focus:ring-error-500 focus:border-error-500' : 'border-slate-300',
          startAdornment && 'pl-9',
          endAdornment && 'pr-9',
          className
        )}
        required={required}
        {...props}
      />
      {endAdornment && <span className="absolute right-3 flex items-center text-slate-400 [&>svg]:w-4 [&>svg]:h-4">{endAdornment}</span>}
    </div>
  </FieldWrapper>
);

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = ({ label, error, helperText, fullWidth = true, className, required, ...props }: TextareaProps) => (
  <FieldWrapper label={label} required={required} error={error} helperText={helperText}>
    <textarea
      className={cn(
        inputBase,
        'resize-y min-h-[80px]',
        error ? 'border-error-500 focus:ring-error-500' : 'border-slate-300',
        className
      )}
      required={required}
      {...props}
    />
  </FieldWrapper>
);

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  startAdornment?: ReactNode;
  fullWidth?: boolean;
}

export const Select = ({ label, error, helperText, startAdornment, fullWidth = true, className, required, children, ...props }: SelectProps) => (
  <FieldWrapper label={label} required={required} error={error} helperText={helperText}>
    <div className={cn('relative flex items-center', fullWidth && 'w-full')}>
      {startAdornment && <span className="absolute left-3 flex items-center text-slate-400 [&>svg]:w-4 [&>svg]:h-4 pointer-events-none z-10">{startAdornment}</span>}
      <select
        className={cn(
          inputBase,
          'appearance-none cursor-pointer',
          error ? 'border-error-500 focus:ring-error-500' : 'border-slate-300',
          startAdornment && 'pl-9',
          className
        )}
        required={required}
        {...props}
      >
        {children}
      </select>
      <span className="absolute right-3 pointer-events-none text-slate-400">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
      </span>
    </div>
  </FieldWrapper>
);

export default Input;
