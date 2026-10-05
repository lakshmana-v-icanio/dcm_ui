import { useEffect, useRef, useState } from 'react';
import { Package, ChevronDown, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchProducts, type ProductDto } from '../../api/pcSchedule';
import { queryKeys } from '../../queryClient';
import { FieldWrapper } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/cn';

const useDebounced = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

interface ProductPickerProps {
  value: ProductDto | null;
  onChange: (product: ProductDto | null) => void;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

const ProductPicker = ({ value, onChange, disabled = false, required = false, error = false, helperText }: ProductPickerProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedInput = useDebounced(input, 300);

  const { data: options = [], isFetching: loading, error: fetchErrorRaw } = useQuery({
    queryKey: queryKeys.products.search(debouncedInput),
    queryFn: () => searchProducts(debouncedInput, 50),
    enabled: open && !disabled,
    staleTime: 60_000,
  });

  const fetchError = fetchErrorRaw
    ? (fetchErrorRaw as { response?: { data?: { message?: string } }; message?: string })
        .response?.data?.message ?? (fetchErrorRaw as { message?: string }).message ?? 'Failed to load products'
    : null;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (product: ProductDto) => {
    onChange(product);
    setInput(product.name ?? '');
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setInput('');
    setOpen(false);
  };

  const displayValue = value ? (value.name ?? '') : input;

  return (
    <FieldWrapper label="Product (Project)" required={required} error={error || !!fetchError} helperText={fetchError ?? helperText}>
      <div className="relative w-full" ref={containerRef}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400 pointer-events-none z-10">
          <Package className="w-4 h-4" />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          disabled={disabled}
          required={required}
          placeholder={disabled ? 'Not applicable for VESTED schedules' : 'Search products by name…'}
          onClick={() => !disabled && setOpen(true)}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setInput(e.target.value);
            if (value) onChange(null);
            setOpen(true);
          }}
          className={cn(
            'w-full rounded-md border text-sm text-slate-900 bg-white pl-9 pr-16 py-2 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
            (error || !!fetchError) ? 'border-error-500 focus:ring-error-500' : 'border-slate-300'
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Spinner size={14} />}
          {value && !disabled && (
            <button type="button" onClick={handleClear} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </span>

        {open && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                <Spinner size={12} /> Searching…
              </div>
            )}
            {!loading && options.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500">
                {input ? `No products match "${input}"` : 'Type to search products'}
              </p>
            )}
            {options.map((opt) => (
              <button
                key={opt.gid}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-primary-50 hover:text-primary-700 transition-colors"
              >
                <span className="font-semibold">{opt.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};

export default ProductPicker;
