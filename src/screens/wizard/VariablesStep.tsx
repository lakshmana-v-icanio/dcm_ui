import { useMemo } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
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

interface VariablesStepProps {
  scheduleId: number | null;
  /** Schedule GID — used to fetch already-persisted variables for this schedule. */
  scheduleGid?: string | null;
  /**
   * Whether to poll the AI classification job. Only true after a classification
   * was actually submitted this session (a new rate-table upload → Save & Next).
   * When false, navigating to this tab shows saved variables WITHOUT calling the
   * classification-status GET.
   */
  classificationEnabled?: boolean;
  onVariablesChange?: (items: VariableItem[]) => void;
}

const IN_FLIGHT: ClassificationStatus[] = ['PENDING', 'IN_PROGRESS'];

const VariablesStep = ({
  scheduleId,
  scheduleGid,
  classificationEnabled = false,
  onVariablesChange,
}: VariablesStepProps) => {
  const enabled = scheduleId != null;
  const classificationActive = enabled && classificationEnabled;

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: enabled
      ? queryKeys.classification.latest(scheduleId!)
      : ['classification', 'noop'],
    queryFn: () => getLatestClassification(scheduleId!),
    enabled: classificationActive,
    // Poll every 2s while the server-side job is still running.
    refetchInterval: (q) =>
      IN_FLIGHT.includes(q.state.data?.status as ClassificationStatus)
        ? 2000
        : false,
    // Don't refetch a terminal state on window focus.
    refetchOnWindowFocus: false,
    // 404 is a legitimate "no job yet" state, so don't retry it.
    retry: (failureCount, err) => {
      const status =
        (err as { response?: { status?: number } })?.response?.status ?? 0;
      if (status === 404) return false;
      return failureCount < 1;
    },
  });

  // Already-persisted variables for this schedule. Fires on navigation to this
  // step; used to populate the board when there's no fresh AI classification.
  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: scheduleGid
      ? queryKeys.scheduleSetup.variables(scheduleGid)
      : ['schedule-setup', 'variables', 'noop'],
    queryFn: () => getScheduleVariables(scheduleGid!),
    enabled: !!scheduleGid,
    refetchOnMount: 'always',
  });

  // AI classification result (only when a job has COMPLETED).
  const aiClassified = useMemo(() => {
    if (data?.status !== 'COMPLETED') return undefined;
    const buckets = parseClassificationResult(data.responsePayload);
    if (!buckets) return [];
    return flattenClassifiedResponse(buckets as ClassifyVariablesResponse);
  }, [data?.status, data?.responsePayload]);

  // Persisted variables mapped into the board's card model.
  const savedClassified = useMemo<ClassifiedVariable[] | undefined>(() => {
    if (!savedData) return undefined;
    const out: ClassifiedVariable[] = [];
    savedData.discrete.forEach((d) =>
      out.push({ name: d.name, type: 'Discrete', values: d.children.map((c) => c.name) }),
    );
    savedData.continuous.forEach((v) => out.push({ name: v.name, type: 'Continuous', values: [] }));
    savedData.date.forEach((v) => out.push({ name: v.name, type: 'Date', values: [] }));
    savedData.string.forEach((v) => out.push({ name: v.name, type: 'String', values: [] }));
    return out;
  }, [savedData]);

  // Combined view: persisted variables + AI-classified ones, deduped by name so
  // a newly-classified variable that's already saved isn't shown twice. Existing
  // (saved) variables are never removed — AI results are added alongside them.
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

  if (!enabled) {
    return (
      <Alert severity="info" variant="outlined">
        Complete the schedule step first to enable AI classification.
      </Alert>
    );
  }

  // Show the board as soon as there's ANY data (saved or classified). While a
  // new upload is being classified, keep the existing variables visible and
  // surface an inline "Classifying…" indicator rather than blanking the board.
  if (boardData.length > 0) {
    const hasAi = !!aiClassified && aiClassified.length > 0;
    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip label="Saved variables" size="small" color="primary" variant="outlined" />
          {hasAi && data && (
            <Chip label={`AI · Job #${data.jobId}`} size="small" color="secondary" variant="outlined" />
          )}
          {aiInFlight && (
            <Chip
              icon={<CircularProgress size={12} color="inherit" />}
              label="Classifying…"
              size="small"
              variant="outlined"
            />
          )}
          {isFetching && !aiInFlight && <CircularProgress size={14} sx={{ ml: 1 }} />}
        </Box>
        <VariablesTab
          classified={boardData}
          loading={false}
          error={null}
          onVariablesChange={onVariablesChange}
        />
      </Box>
    );
  }

  // Nothing to show yet but a new upload is being classified.
  if (aiInFlight) {
    return (
      <LoadingCard
        label={`Classifying "${data!.rateTableName}" with AI…`}
        detail="Gemini is analysing the rate-table columns and grouping distinct values."
      />
    );
  }

  // Still loading — wait on the classification query only when it's active.
  if (savedLoading || (classificationActive && isLoading)) {
    return <LoadingCard label="Loading variables…" />;
  }

  if (data?.status === 'FAILED') {
    return (
      <Alert severity="error" variant="outlined">
        <AlertTitle>Classification failed</AlertTitle>
        {data.errorMessage ?? 'The AI service could not classify this rate table.'}
      </Alert>
    );
  }

  // Non-404 error with nothing persisted to fall back to.
  if (isError) {
    const status =
      (error as { response?: { status?: number } })?.response?.status ?? 0;
    if (status !== 404) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ??
        (error as { message?: string })?.message ??
        'Failed to load classification';
      return (
        <Alert severity="error" variant="outlined">
          {message}
        </Alert>
      );
    }
  }

  // Nothing classified or saved yet.
  return (
    <Alert severity="info" variant="outlined">
      Upload a rate table on the previous step and click{' '}
      <strong>Save &amp; Next</strong> to submit for AI classification.
    </Alert>
  );
};

interface LoadingCardProps {
  label: string;
  detail?: string;
}
const LoadingCard = ({ label, detail }: LoadingCardProps) => (
  <Alert
    severity="info"
    icon={<HourglassTopRoundedIcon />}
    variant="outlined"
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={22} />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary">
            {detail}
          </Typography>
        )}
      </Box>
    </Box>
  </Alert>
);

export default VariablesStep;
