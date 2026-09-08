import { useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  InputAdornment,
  MenuItem,
  Typography,
} from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';

import CommonTextInput from '../../components/common/CommonTextInput';
import ProductPicker from '../../components/common/ProductPicker';
import {
  createPcSchedule,
  type CreatePcScheduleRequest,
  type CreatedSchedule,
  type ProductDto,
  type ScheduleType,
} from '../../api/pcSchedule';

export interface DetailsFormState {
  scheduleType: ScheduleType | '';
  description: string;
  startDate: string;
  endDate: string;
  product: ProductDto | null;
}

export const emptyDetails: DetailsFormState = {
  scheduleType: '',
  description: '',
  startDate: '',
  endDate: '',
  product: null,
};

interface DetailsStepProps {
  value: DetailsFormState;
  onChange: (next: DetailsFormState) => void;
  submitting: boolean;
  locked: boolean;
}

const DetailsStep = ({
  value,
  onChange,
  submitting,
  locked,
}: DetailsStepProps) => {
  const [errors, setErrors] = useState<
    Partial<Record<keyof DetailsFormState, string>>
  >({});

  const isPce = value.scheduleType === 'PCE';
  const isVested = value.scheduleType === 'VestedComp';

  const update = <K extends keyof DetailsFormState>(
    key: K,
    v: DetailsFormState[K],
  ) => {
    onChange({ ...value, [key]: v });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter the schedule identity. Clicking <strong>Create &amp; Next</strong>
        &nbsp;creates the schedule via REST and unlocks the rate-table step.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <CommonTextInput
            select
            required
            label="Schedule Type"
            value={value.scheduleType}
            onChange={(e) =>
              update('scheduleType', e.target.value as ScheduleType)
            }
            disabled={locked}
            error={!!errors.scheduleType}
            helperText={
              errors.scheduleType ??
              (isPce
                ? 'A project (Product) must be mapped for PCE'
                : isVested
                  ? 'Product is not applicable for VESTED'
                  : ' ')
            }
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CategoryRoundedIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          >
            <MenuItem value="PCE">PCE — Product Compensation</MenuItem>
            <MenuItem value="VestedComp">
              VESTED — Vested Compensation
            </MenuItem>
          </CommonTextInput>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CommonTextInput
            label="Description"
            placeholder="Optional summary shown on schedule list"
            value={value.description}
            disabled={locked}
            onChange={(e) => update('description', e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <DescriptionRoundedIcon
                      color="action"
                      fontSize="small"
                    />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CommonTextInput
            required
            type="date"
            label="Start Date"
            value={value.startDate}
            disabled={locked}
            onChange={(e) => update('startDate', e.target.value)}
            error={!!errors.startDate}
            helperText={errors.startDate ?? ' '}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthRoundedIcon
                      color="action"
                      fontSize="small"
                    />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CommonTextInput
            required
            type="date"
            label="End Date"
            value={value.endDate}
            disabled={locked}
            onChange={(e) => update('endDate', e.target.value)}
            error={!!errors.endDate}
            helperText={errors.endDate ?? ' '}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthRoundedIcon
                      color="action"
                      fontSize="small"
                    />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        {isPce && (
          <>
            <Grid size={{ xs: 12 }}>
              <Divider textAlign="left" sx={{ my: 1 }}>
                <Chip
                  size="small"
                  label="Project Mapping (Required)"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
              </Divider>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ProductPicker
                value={value.product}
                onChange={(product) => update('product', product)}
                required
                error={!!errors.product}
                helperText={
                  errors.product ??
                  'Search and select the project to map — required for PCE schedules'
                }
              />
            </Grid>
          </>
        )}
      </Grid>

      {submitting && (
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            color: 'text.secondary',
          }}
        >
          <CircularProgress size={18} />
          <Typography variant="body2">Creating schedule…</Typography>
        </Box>
      )}
    </Box>
  );
};

/* ----- helpers exposed to the parent wizard ------------------------- */

// eslint-disable-next-line react-refresh/only-export-components
export const validateDetails = (
  value: DetailsFormState,
): Partial<Record<keyof DetailsFormState, string>> => {
  const next: Partial<Record<keyof DetailsFormState, string>> = {};
  if (!value.scheduleType) next.scheduleType = 'Schedule type is required';
  if (!value.startDate) next.startDate = 'Start date is required';
  if (!value.endDate) next.endDate = 'End date is required';
  if (
    value.startDate &&
    value.endDate &&
    new Date(value.startDate) > new Date(value.endDate)
  ) {
    next.endDate = 'End date must be after start date';
  }
  if (value.scheduleType === 'PCE' && !value.product) {
    next.product = 'A project must be mapped for PCE schedules';
  }
  return next;
};

// eslint-disable-next-line react-refresh/only-export-components
export const submitDetails = async (
  value: DetailsFormState,
): Promise<CreatedSchedule> => {
  const payload: CreatePcScheduleRequest = {
    scheduleType: value.scheduleType as ScheduleType,
    startDate: value.startDate,
    endDate: value.endDate,
    description: value.description || undefined,
    productGid:
      value.scheduleType === 'PCE' && value.product
        ? value.product.gid
        : undefined,
  };
  return createPcSchedule(payload);
};

export default DetailsStep;
