import { useEffect, useMemo } from 'react';
import { Hourglass } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import VariablesTab, { type VariableItem } from '../detail/VariablesTab';
import { queryKeys } from '../../queryClient';
import {
  getLatestClassification,
  parseClassificationResult,
  type ClassificationStatus,
} from '../../api/aiClassification';
import {
  flattenClassifiedResponse,
  type ClassifiedVariable,
  type ClassifyVariablesResponse,
} from '../../api/aiVariables';
import { getScheduleVariables } from '../../api/pcSchedule';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';

interface VariablesStepProps {
  scheduleId: number | null;
  scheduleGid?: string | null;
  classificationEnabled?: boolean;
  onVariablesChange?: (items: VariableItem[]) => void;
  onClassifyingChange?: (inProgress: boolean) => void;
}

const IN_FLIGHT: ClassificationStatus[] = ['PENDING', 'IN_PROGRESS'];

const VariablesStep = ({
  scheduleId,
  scheduleGid,
  classificationEnabled = false,
  onVariablesChange,
  onClassifyingChange,
}: VariablesStepProps) => {
  const enabled = scheduleId != null;
  const classificationActive = enabled && classificationEnabled;

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: enabled ? queryKeys.classification.latest(scheduleId!) : ['classification', 'noop'],
    queryFn: () => getLatestClassification(scheduleId!),
    enabled: classificationActive,
    refetchInterval: (q) => IN_FLIGHT.includes(q.state.data?.status as ClassificationStatus) ? 2000 : false,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status ?? 0;
      if (status === 404) return false;
      return failureCount < 1;
    },
  });

  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: scheduleGid ? queryKeys.scheduleSetup.variables(scheduleGid) : ['schedule-setup', 'variables', 'noop'],
    queryFn: () => getScheduleVariables(scheduleGid!),
    enabled: !!scheduleGid,
    refetchOnMount: 'always',
  });

  const aiClassified = useMemo(() => {
    if (data?.status !== 'COMPLETED') return undefined;
    const buckets = parseClassificationResult(data.responsePayload);
    if (!buckets) return [];
    return flattenClassifiedResponse(buckets as ClassifyVariablesResponse);
  }, [data?.status, data?.responsePayload]);

  const savedClassified = useMemo<ClassifiedVariable[] | undefined>(() => {
    if (!savedData) return undefined;
    const out: ClassifiedVariable[] = [];
    savedData.discrete.forEach((d) => out.push({ name: d.name, type: 'Discrete', values: d.children.map((c) => c.name) }));
    savedData.continuous.forEach((v) => out.push({ name: v.name, type: 'Continuous', values: [] }));
    savedData.date.forEach((v) => out.push({ name: v.name, type: 'Date', values: [] }));
    savedData.string.forEach((v) => out.push({ name: v.name, type: 'String', values: [] }));
    return out;
  }, [savedData]);

  const boardData = useMemo<ClassifiedVariable[]>(() => {
    const saved = savedClassified ?? [];
    const ai = aiClassified ?? [];
    const merged = [...saved];
    const seen = new Set(saved.map((v) => v.name.toLowerCase()));
    for (const v of ai) {
      if (!seen.has(v.name.toLowerCase())) {
        merged.push(v);
        seen.add(v.name.toLowerCase());
      }
    }
    return merged;
  }, [savedClassified, aiClassified]);

  const aiInFlight = !!data && IN_FLIGHT.includes(data.status);

  useEffect(() => {
    if (!aiInFlight) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "AI Variable Classification is still processing. Please don't close the tab.";
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [aiInFlight]);

  useEffect(() => {
    onClassifyingChange?.(aiInFlight);
    return () => onClassifyingChange?.(false);
  }, [aiInFlight, onClassifyingChange]);

  if (!enabled) {
    return <Alert severity="info" variant="outlined">Complete the schedule step first to enable AI classification.</Alert>;
  }

  if (boardData.length > 0) {
    const hasAi = !!aiClassified && aiClassified.length > 0;
    return (
      <div>
        <div className="mb-3 flex gap-2 items-center flex-wrap">
          <Badge label="Saved variables" tone="primary" />
          {hasAi && data && <Badge label={`AI · Job #${data.jobId}`} tone="secondary" />}
          {aiInFlight && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-slate-200 text-slate-600">
              <Spinner size={10} /> Classifying…
            </div>
          )}
          {isFetching && !aiInFlight && <Spinner size={14} />}
        </div>
        <VariablesTab classified={boardData} loading={false} error={null} onVariablesChange={onVariablesChange} />
      </div>
    );
  }

  if (aiInFlight) {
    return (
      <LoadingCard
        label={`Classifying "${data!.rateTableName}" with AI…`}
        detail="AI is analysing. Please don't close or reload this tab until it finishes."
      />
    );
  }

  if (savedLoading || (classificationActive && isLoading)) {
    return <LoadingCard label="Loading variables…" />;
  }

  if (data?.status === 'FAILED') {
    return (
      <Alert severity="error" variant="outlined" title="Classification failed">
        {data.errorMessage ?? 'The AI service could not classify this rate table.'}
      </Alert>
    );
  }

  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status ?? 0;
    if (status !== 404) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ?? (error as { message?: string })?.message ?? 'Failed to load classification';
      return <Alert severity="error" variant="outlined">{message}</Alert>;
    }
  }

  return (
    <Alert severity="info" variant="outlined">
      Upload a rate table on the previous step and click <strong>Save &amp; Next</strong> to submit for AI classification.
    </Alert>
  );
};

interface LoadingCardProps {
  label: string;
  detail?: string;
}

const LoadingCard = ({ label, detail }: LoadingCardProps) => (
  <Alert severity="info" icon={<Hourglass className="w-4 h-4 text-blue-600 shrink-0" />} variant="outlined">
    <div className="flex items-center gap-3">
      <Spinner size={20} />
      <div>
        <p className="text-sm font-bold">{label}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  </Alert>
);

export default VariablesStep;
