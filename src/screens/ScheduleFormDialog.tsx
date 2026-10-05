import { useEffect, useState } from 'react';
import { CalendarRange, Tag, FileText, CalendarDays, RotateCcw, Rocket } from 'lucide-react';
import CommonTextInput from '../components/common/CommonTextInput';
import ProductPicker from '../components/common/ProductPicker';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
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
    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      next.endDate = 'End date must be after start date';
    }
    if (isPce && !form.product) next.product = 'A project must be mapped for PCE schedules';
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
          .response?.data?.message ?? (err as { message?: string }).message ?? 'Failed to create schedule';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? () => {} : onClose} maxWidth="md">
      <DialogHeader
        title="Create PC Schedule"
        subtitle="Auto-generates the Calculation Base and Integration Map"
        onClose={submitting ? undefined : onClose}
      />
      <DialogBody>
        {serverError && <Alert severity="error" className="mb-4">{serverError}</Alert>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CommonTextInput
            select
            required
            label="Schedule Type"
            value={form.scheduleType}
            onChange={(e) => update('scheduleType', e.target.value as ScheduleType)}
            error={!!errors.scheduleType}
            helperText={errors.scheduleType ?? (isPce ? 'A project (Product) must be mapped for PCE' : form.scheduleType === 'VestedComp' ? 'Product is not applicable for VESTED' : ' ')}
            slotProps={{ input: { startAdornment: <Tag className="w-4 h-4" /> } }}
          >
            <option value="">Select type…</option>
            <option value="PCE">PCE — Product Compensation</option>
            <option value="VestedComp">VESTED — Vested Compensation</option>
          </CommonTextInput>

          <CommonTextInput
            label="Description"
            placeholder="Optional summary shown on schedule list"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            slotProps={{ input: { startAdornment: <FileText className="w-4 h-4" /> } }}
          />

          <CommonTextInput
            required
            type="date"
            label="Start Date"
            value={form.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            error={!!errors.startDate}
            helperText={errors.startDate ?? ' '}
            slotProps={{ input: { startAdornment: <CalendarDays className="w-4 h-4" /> } }}
          />

          <CommonTextInput
            required
            type="date"
            label="End Date"
            value={form.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            error={!!errors.endDate}
            helperText={errors.endDate ?? ' '}
            slotProps={{ input: { startAdornment: <CalendarRange className="w-4 h-4" /> } }}
          />

          {isPce && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 my-2">
                <hr className="flex-1 border-slate-200" />
                <Badge label="Project Mapping (Required)" tone="primary" />
                <hr className="flex-1 border-slate-200" />
              </div>
              <ProductPicker
                value={form.product}
                onChange={(product) => update('product', product)}
                required
                error={!!errors.product}
                helperText={errors.product ?? 'Search and select the project to map — required for PCE schedules'}
              />
            </div>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="text" color="inherit" startIcon={<RotateCcw className="w-4 h-4" />} onClick={() => { setForm(emptyForm); setErrors({}); setServerError(null); }} disabled={submitting}>
          Reset
        </Button>
        <Button variant="text" color="inherit" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={submitting ? <Spinner size={16} color="white" /> : <Rocket className="w-4 h-4" />}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Creating…' : 'Create Schedule'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default ScheduleFormDialog;
