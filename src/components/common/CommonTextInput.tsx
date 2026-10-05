import type { ReactNode, InputHTMLAttributes } from 'react';
import { FieldWrapper } from '../ui/Input';
import { cn } from '../../lib/cn';

interface CommonTextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement | HTMLSelectElement>, 'size'> {
  label: string;
  error?: boolean;
  helperText?: string;
  select?: boolean;
  fullWidth?: boolean;
  multiline?: boolean;
  rows?: number;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  slotProps?: {
    input?: { startAdornment?: ReactNode; endAdornment?: ReactNode };
    inputLabel?: unknown;
  };
  children?: ReactNode;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
}

const inputBase = 'w-full rounded-md border text-sm text-slate-900 bg-white px-3 py-2 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

const CommonTextInput = ({
  label,
  error,
  helperText,
  select,
  multiline,
  rows,
  slotProps,
  children,
  className,
  required,
  disabled,
  value,
  onChange,
  type,
  placeholder,
  ...rest
}: CommonTextInputProps) => {
  const startAdornment = slotProps?.input?.startAdornment;
  const endAdornment = slotProps?.input?.endAdornment;

  const fieldClass = cn(
    inputBase,
    error ? 'border-error-500 focus:ring-error-500' : 'border-slate-300',
    startAdornment && 'pl-9',
    endAdornment && 'pr-9',
    select && 'appearance-none cursor-pointer',
    className
  );

  const wrapClass = 'relative flex items-center w-full';

  return (
    <FieldWrapper label={label} required={required} error={error} helperText={helperText}>
      {select ? (
        <div className={wrapClass}>
          {startAdornment && <span className="absolute left-3 flex items-center text-slate-400 [&>svg]:w-4 [&>svg]:h-4 pointer-events-none z-10">{startAdornment}</span>}
          <select
            className={fieldClass}
            required={required}
            disabled={disabled}
            value={value}
            onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
          >
            {children}
          </select>
          <span className="absolute right-3 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
          </span>
        </div>
      ) : multiline ? (
        <textarea
          className={cn(fieldClass, 'resize-y')}
          rows={rows ?? 4}
          required={required}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={onChange as React.ChangeEventHandler<HTMLTextAreaElement>}
        />
      ) : (
        <div className={wrapClass}>
          {startAdornment && <span className="absolute left-3 flex items-center text-slate-400 [&>svg]:w-4 [&>svg]:h-4 pointer-events-none">{startAdornment}</span>}
          <input
            type={type}
            className={fieldClass}
            required={required}
            disabled={disabled}
            value={value}
            placeholder={placeholder}
            onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          />
          {endAdornment && <span className="absolute right-3 flex items-center text-slate-400 [&>svg]:w-4 [&>svg]:h-4">{endAdornment}</span>}
        </div>
      )}
    </FieldWrapper>
  );
};

export default CommonTextInput;
