import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { useQuery } from '@tanstack/react-query';
import { searchProducts, type ProductDto } from '../../api/pcSchedule';
import { queryKeys } from '../../queryClient';

interface ProductPickerProps {
  value: ProductDto | null;
  onChange: (product: ProductDto | null) => void;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

const useDebounced = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

const ProductPicker = ({
  value,
  onChange,
  disabled = false,
  required = false,
  error = false,
  helperText,
}: ProductPickerProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  const debouncedInput = useDebounced(input, 300);

  const {
    data: options = [],
    isFetching: loading,
    error: fetchErrorRaw,
  } = useQuery({
    queryKey: queryKeys.products.search(debouncedInput),
    queryFn: () => searchProducts(debouncedInput, 50),
    enabled: open && !disabled,
    staleTime: 60_000,
  });

  const fetchError = fetchErrorRaw
    ? (fetchErrorRaw as { response?: { data?: { message?: string } }; message?: string })
        .response?.data?.message ??
      (fetchErrorRaw as { message?: string }).message ??
      'Failed to load products'
    : null;

  const resolvedHelper = useMemo(() => {
    if (fetchError) return fetchError;
    return helperText;
  }, [fetchError, helperText]);

  return (
    <Autocomplete<ProductDto, false, false, false>
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      inputValue={input}
      onInputChange={(_, newInput) => setInput(newInput)}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      disabled={disabled}
      loading={loading}
      filterOptions={(x) => x}
      isOptionEqualToValue={(a, b) => a.gid === b.gid}
      getOptionLabel={(option) => option.name ?? ''}
      noOptionsText={
        input ? `No products match “${input}”` : 'Type to search products'
      }
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.gid}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {option.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {option.gid}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => {
        const inputSlot = (params.slotProps?.input ?? {}) as {
          startAdornment?: React.ReactNode;
          endAdornment?: React.ReactNode;
        };
        return (
          <TextField
            {...params}
            label="Product (Project)"
            required={required}
            error={error || !!fetchError}
            helperText={resolvedHelper ?? ' '}
            placeholder={
              disabled
                ? 'Not applicable for VESTED schedules'
                : 'Search products by name…'
            }
            slotProps={{
              ...params.slotProps,
              inputLabel: { shrink: true },
              input: {
                ...inputSlot,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <Inventory2RoundedIcon color="action" fontSize="small" />
                    </InputAdornment>
                    {inputSlot.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={18} /> : null}
                    {inputSlot.endAdornment}
                  </>
                ),
              },
            }}
          />
        );
      }}
    />
  );
};

export default ProductPicker;
