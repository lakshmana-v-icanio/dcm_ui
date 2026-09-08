import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  Alert,
  Grid,
  Typography,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  IconButton,
  Box,
} from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';

import CommonTextInput from '../components/common/CommonTextInput';
import ProductPicker from '../components/common/ProductPicker';
import {
  createPcSchedule,
  type CreatePcScheduleRequest,
  type CreatedSchedule,
  type ProductDto,
  type ScheduleType,
} from '../api/pcSchedule';

interface FormState {
  scheduleType: ScheduleType | '';
  description: string;
  startDate: string;
  endDate: string;
  product: ProductDto | null;
}

const emptyForm: FormState = {
  scheduleType: '',
  description: '',
  startDate: '',
  endDate: '',
  product: null,
};

interface ScheduleFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (created: CreatedSchedule) => void;
}

const ScheduleFormDialog = ({ open, onClose, onCreated }: ScheduleFormDialogProps) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isPce = form.scheduleType === 'PCE';
  const isVested = form.scheduleType === 'VestedComp';

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setErrors({});
      setServerError(null);
      setSubmitting(false);
    }
  }, [open]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.scheduleType) next.scheduleType = 'Schedule type is required';
    if (!form.startDate) next.startDate = 'Start date is required';
    if (!form.endDate) next.endDate = 'End date is required';
    if (
      form.startDate &&
      form.endDate &&
      new Date(form.startDate) > new Date(form.endDate)
    ) {
      next.endDate = 'End date must be after start date';
    }
    if (isPce && !form.product) {
      next.product = 'A project must be mapped for PCE schedules';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!validate()) return;

    const payload: CreatePcScheduleRequest = {
      scheduleType: form.scheduleType as ScheduleType,
      startDate: form.startDate,
      endDate: form.endDate,
      description: form.description || undefined,
      productGid: isPce && form.product ? form.product.gid : undefined,
    };

    setSubmitting(true);
    try {
      const result = await createPcSchedule(payload);
      onCreated(result);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })
          .response?.data?.message ??
        (err as { message?: string }).message ??
        'Failed to create schedule';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(emptyForm);
    setErrors({});
    setServerError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle
        sx={{
          background:
            'linear-gradient(135deg, rgba(79, 70, 229, 0.10) 0%, rgba(6, 182, 212, 0.08) 100%)',
          borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          pr: 6,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            color: '#fff',
            boxShadow: '0 8px 20px -8px rgba(79, 70, 229, 0.6)',
          }}
        >
          <EventNoteRoundedIcon />
        </Box>
        <Box>
          <Typography variant="h6">Create PC Schedule</Typography>
          <Typography variant="body2" color="text.secondary">
            Auto-generates the Calculation Base and Integration Map
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          disabled={submitting}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {serverError}
          </Alert>
        )}

        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <CommonTextInput
              select
              required
              label="Schedule Type"
              value={form.scheduleType}
              onChange={(e) => update('scheduleType', e.target.value as ScheduleType)}
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
              <MenuItem value="VestedComp">VESTED — Vested Compensation</MenuItem>
            </CommonTextInput>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <CommonTextInput
              label="Description"
              placeholder="Optional summary shown on schedule list"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <DescriptionRoundedIcon color="action" fontSize="small" />
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
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
              error={!!errors.startDate}
              helperText={errors.startDate ?? ' '}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarMonthRoundedIcon color="action" fontSize="small" />
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
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
              error={!!errors.endDate}
              helperText={errors.endDate ?? ' '}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarMonthRoundedIcon color="action" fontSize="small" />
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
                  value={form.product}
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
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<RestartAltRoundedIcon />}
          onClick={handleReset}
          disabled={submitting}
        >
          Reset
        </Button>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          size="large"
          startIcon={
            submitting ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <RocketLaunchRoundedIcon />
            )
          }
          onClick={handleSubmit}
          disabled={submitting}
          sx={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            minWidth: 180,
          }}
        >
          {submitting ? 'Creating…' : 'Create Schedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleFormDialog;
