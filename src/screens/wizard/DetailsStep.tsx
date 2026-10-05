import { useState } from 'react';
import { CalendarRange, Tag, FileText, CalendarDays } from 'lucide-react';
import CommonTextInput from '../../components/common/CommonTextInput';
import ProductPicker from '../../components/common/ProductPicker';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
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

const DetailsStep = ({ value, onChange, submitting, locked }: DetailsStepProps) => {
  const [errors, setErrors] = useState<Partial<Record<keyof DetailsFormState, string>>>({});

  const isPce = value.scheduleType === 'PCE';
  const isVested = value.scheduleType === 'VestedComp';

  const update = <K extends keyof DetailsFormState>(key: K, v: DetailsFormState[K]) => {
    onChange({ ...value, [key]: v });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Enter the schedule identity. Clicking <strong>Create &amp; Next</strong>&nbsp;creates the schedule via REST and unlocks the rate-table step.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CommonTextInput
          select
          required
          label="Schedule Type"
          value={value.scheduleType}
          onChange={(e) => update('scheduleType', e.target.value as ScheduleType)}
          disabled={locked}
          error={!!errors.scheduleType}
          helperText={errors.scheduleType ?? (isPce ? 'A project (Product) must be mapped for PCE' : isVested ? 'Product is not applicable for VESTED' : ' ')}
          slotProps={{ input: { startAdornment: <Tag className="w-4 h-4" /> } }}
        >
          <option value="">Select type…</option>
          <option value="PCE">PCE — Product Compensation</option>
          <option value="VestedComp">VESTED — Vested Compensation</option>
        </CommonTextInput>

        <CommonTextInput
          label="Description"
          placeholder="Optional summary shown on schedule list"
          value={value.description}
          disabled={locked}
          onChange={(e) => update('description', e.target.value)}
          slotProps={{ input: { startAdornment: <FileText className="w-4 h-4" /> } }}
        />

        <CommonTextInput
          required
          type="date"
          label="Start Date"
          value={value.startDate}
          disabled={locked}
          onChange={(e) => update('startDate', e.target.value)}
          error={!!errors.startDate}
          helperText={errors.startDate ?? ' '}
          slotProps={{ input: { startAdornment: <CalendarDays className="w-4 h-4" /> } }}
        />

        <CommonTextInput
          required
          type="date"
          label="End Date"
          value={value.endDate}
          disabled={locked}
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
              value={value.product}
              onChange={(product) => update('product', product)}
              required
              error={!!errors.product}
              helperText={errors.product ?? 'Search and select the project to map — required for PCE schedules'}
            />
          </div>
        )}
      </div>

      {submitting && (
        <div className="mt-4 flex items-center gap-2 text-slate-500">
          <Spinner size={16} />
          <span className="text-sm">Creating schedule…</span>
        </div>
      )}
    </div>
  );
};

/* ----- helpers exposed to the parent wizard ------------------------- */

// eslint-disable-next-line react-refresh/only-export-components
export const validateDetails = (value: DetailsFormState): Partial<Record<keyof DetailsFormState, string>> => {
  const next: Partial<Record<keyof DetailsFormState, string>> = {};
  if (!value.scheduleType) next.scheduleType = 'Schedule type is required';
  if (!value.startDate) next.startDate = 'Start date is required';
  if (!value.endDate) next.endDate = 'End date is required';
  if (value.startDate && value.endDate && new Date(value.startDate) > new Date(value.endDate)) {
    next.endDate = 'End date must be after start date';
  }
  if (value.scheduleType === 'PCE' && !value.product) {
    next.product = 'A project must be mapped for PCE schedules';
  }
  return next;
};

// eslint-disable-next-line react-refresh/only-export-components
export const submitDetails = async (value: DetailsFormState): Promise<CreatedSchedule> => {
  const payload: CreatePcScheduleRequest = {
    scheduleType: value.scheduleType as ScheduleType,
    startDate: value.startDate,
    endDate: value.endDate,
    description: value.description || undefined,
    productGid: value.scheduleType === 'PCE' && value.product ? value.product.gid : undefined,
  };
  return createPcSchedule(payload);
};

export default DetailsStep;
