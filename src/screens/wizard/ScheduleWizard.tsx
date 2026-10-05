import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import DetailsStep, {
  emptyDetails,
  submitDetails,
  validateDetails,
  type DetailsFormState,
} from './DetailsStep';
import RateTableStep, {
  summariseTableNames,
  toRateTableGrids,
  type ParsedTable,
} from './RateTableStep';
import VariablesStep from './VariablesStep';
import MethodologiesStep from './MethodologiesStep';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  submitClassification,
  type ClassificationJobDto,
} from '../../api/aiClassification';
import {
  getPcSchedule,
  scheduleSetup,
  updateSchedulePercentage,
  type CreatedSchedule,
  type PcScheduleDto,
  type ScheduleType,
  type CreatePcScheduleSetupRequest,
  type StepDto,
  type AddFactorTablePayload,
  type AddAxisPayload,
  type SetCellValuesPayload,
} from '../../api/pcSchedule';
import type { VariableItem } from '../detail/VariablesTab';
import { queryKeys } from '../../queryClient';
import {
  STEP_ORDER,
  STEP_PROGRESS,
  setScheduleStep,
  type WizardStep,
} from '../../utils/scheduleProgress';
import { Button } from '../../components/ui/Button';
import { LinearProgress } from '../../components/ui/Progress';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Stepper } from '../../components/ui/Stepper';
import { Snackbar } from '../../components/ui/Snackbar';

const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Schedule Creation',
  rateTable: 'Rate Table',
  variables: 'Variables',
  methodologies: 'Methodologies',
};

const VARIABLES_SAVED_PERCENTAGE = 80;

const extractApiMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } }; message?: string })
    ?.response?.data?.message ??
  (err as { message?: string })?.message ??
  fallback;

const extractColumnValues = (varName: string, parsedTables: ParsedTable[]): string[] => {
  const seen = new Set<string>();
  for (const table of parsedTables) {
    const colIdx = table.headers.indexOf(varName);
    if (colIdx < 0) continue;
    for (const row of table.rows) {
      const val = row[colIdx];
      if (val != null && String(val).trim() !== '') seen.add(String(val).trim());
    }
  }
  return [...seen];
};

const resolveDiscreteValues = (v: VariableItem, parsedTables: ParsedTable[]): string[] =>
  v.values.length > 0 ? v.values : extractColumnValues(v.name, parsedTables);

const normalizeRangeLabel = (label: string): string => {
  const match = label.match(/^[\[(]([^,]+),([^,\]\)]+)[\]\)]$/);
  if (match) return `${match[1].trim()}-${match[2].trim()}`;
  return label;
};

const toAxisAlias = (varName: string): string => {
  const camel = varName
    .replace(/\s+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toLowerCase());
  return `${camel}Axis`;
};

type AxisKind = 'CONTINUOUS' | 'DATE' | 'STRING' | 'DISCRETE';
const axisKindOf = (v: VariableItem): AxisKind =>
  v.type === 'Continuous' ? 'CONTINUOUS' : v.type === 'Date' ? 'DATE' : v.type === 'String' ? 'STRING' : 'DISCRETE';

const fillForwardValues = (row: unknown[]): string[] => {
  const out: string[] = [];
  let last = '';
  for (let i = 1; i < row.length; i++) {
    const cur = String(row[i] ?? '').trim();
    if (cur !== '') last = cur;
    out[i] = last;
  }
  return out;
};

interface MatrixAxis {
  v: VariableItem;
  valueRow?: unknown[];
}
interface MatrixPlan {
  columnAxes: MatrixAxis[];
  rowAxes: MatrixAxis[];
  dataStartRow: number;
}

const detectMatrixLayout = (table: ParsedTable, variables: VariableItem[]): MatrixPlan | null => {
  const varByName = new Map(variables.map((v) => [v.name, v]));
  const col0Header = String(table.headers[0] ?? '').trim();
  if (!varByName.has(col0Header)) return null;
  const stack: { v: VariableItem; valueRow: unknown[] }[] = [
    { v: varByName.get(col0Header)!, valueRow: table.headers },
  ];
  let k = 0;
  while (k < table.rows.length) {
    const label = String(table.rows[k][0] ?? '').trim();
    if (!varByName.has(label)) break;
    stack.push({ v: varByName.get(label)!, valueRow: table.rows[k] });
    k++;
  }
  if (stack.length < 2) return null;
  const dataStartRow = k;
  if (dataStartRow >= table.rows.length) return null;
  const hasColumnValues = (row: unknown[]) => row.slice(1).some((c) => String(c ?? '').trim() !== '');
  const columnAxes: MatrixAxis[] = [];
  const rowAxes: MatrixAxis[] = [];
  for (const entry of stack) {
    if (hasColumnValues(entry.valueRow)) columnAxes.push({ v: entry.v, valueRow: entry.valueRow });
    else rowAxes.push({ v: entry.v });
  }
  if (columnAxes.length === 0 || rowAxes.length === 0) return null;
  return { columnAxes, rowAxes, dataStartRow };
};

const buildScheduleSetupRequest = (
  variables: VariableItem[],
  parsedTables: ParsedTable[],
  rateTableName: string,
  startDate: string,
  endDate: string,
): CreatePcScheduleSetupRequest => {
  const discreteVars = variables.filter((v) => v.type === 'Discrete');
  const continuousVars = variables.filter((v) => v.type === 'Continuous');
  const dateVars = variables.filter((v) => v.type === 'Date');
  const stringVars = variables.filter((v) => v.type === 'String');
  const varNameSet = new Set(variables.map((v) => v.name));
  const resolvedDiscreteValues: Record<string, string[]> = {};
  discreteVars.forEach((v) => { resolvedDiscreteValues[v.name] = resolveDiscreteValues(v, parsedTables); });
  const variablesSection = {
    ...(discreteVars.length > 0 && { discrete: discreteVars.map((v) => ({ name: v.name, children: resolvedDiscreteValues[v.name].map((val) => ({ name: val })) })) }),
    ...(continuousVars.length > 0 && { continuous: continuousVars.map((v) => ({ name: v.name })) }),
    ...(dateVars.length > 0 && { date: dateVars.map((v) => ({ name: v.name })) }),
    ...(stringVars.length > 0 && { string: stringVars.map((v) => ({ name: v.name })) }),
  };
  type AxisEntry = { v: VariableItem; kind: AxisKind; isTopAxis: boolean };
  const steps: StepDto[] = [];
  const usedAliases = new Set<string>();
  const uniqueAlias = (base: string): string => {
    let alias = base; let n = 2;
    while (usedAliases.has(alias)) alias = `${base}_${n++}`;
    usedAliases.add(alias);
    return alias;
  };
  parsedTables.forEach((table, tIdx) => {
    const tableAlias = tIdx === 0 ? 'table' : `table${tIdx}`;
    steps.push({ command: 'AddFactorTable', as: tableAlias, payload: { name: table.name || rateTableName, cellType: 'NUMERIC', startDate, endDate } as AddFactorTablePayload });
    const matrix = detectMatrixLayout(table, variables);
    if (matrix) {
      const aliases: Record<string, string> = {};
      let axisOrder = 0;
      matrix.columnAxes.forEach(({ v }) => {
        const alias = uniqueAlias(toAxisAlias(v.name));
        aliases[v.name] = alias;
        steps.push({ command: 'AddAxis', as: alias, tableRef: `$${tableAlias}`, payload: { kind: axisKindOf(v), variableRef: { byName: v.name }, isTopAxis: true, axisOrder: axisOrder++ } as AddAxisPayload });
      });
      matrix.rowAxes.forEach(({ v }) => {
        const alias = uniqueAlias(toAxisAlias(v.name));
        aliases[v.name] = alias;
        steps.push({ command: 'AddAxis', as: alias, tableRef: `$${tableAlias}`, payload: { kind: axisKindOf(v), variableRef: { byName: v.name }, isTopAxis: false, axisOrder: axisOrder++ } as AddAxisPayload });
      });
      const filledColumnAxes = matrix.columnAxes.map(({ v, valueRow }) => ({ v, vals: fillForwardValues(valueRow ?? []) }));
      type MatrixCell = { coords: { childOfVariable: string; byName: string }[]; value: number };
      const cells: MatrixCell[] = [];
      const numCols = table.headers.length;
      for (let r = matrix.dataStartRow; r < table.rows.length; r++) {
        const row = table.rows[r];
        const rowLabel = String(row[0] ?? '').trim();
        if (!rowLabel) continue;
        for (let c = 1; c < numCols; c++) {
          const rawVal = row[c];
          if (rawVal == null || String(rawVal).trim() === '') continue;
          const value = parseFloat(String(rawVal));
          if (isNaN(value)) continue;
          const coords: { childOfVariable: string; byName: string }[] = [];
          let complete = true;
          for (const { v, vals } of filledColumnAxes) {
            const bn = normalizeRangeLabel(String(vals[c] ?? '').trim());
            if (!bn) { complete = false; break; }
            coords.push({ childOfVariable: `$${aliases[v.name]}`, byName: bn });
          }
          if (!complete) continue;
          for (const { v } of matrix.rowAxes) {
            coords.push({ childOfVariable: `$${aliases[v.name]}`, byName: normalizeRangeLabel(rowLabel) });
          }
          cells.push({ coords, value });
        }
      }
      if (cells.length > 0) steps.push({ command: 'SetCellValues', tableRef: `$${tableAlias}`, payload: { cells } as SetCellValuesPayload });
    } else {
      const allAxes: AxisEntry[] = [
        ...continuousVars.map((v) => ({ v, kind: 'CONTINUOUS' as const, isTopAxis: true })),
        ...dateVars.map((v) => ({ v, kind: 'DATE' as const, isTopAxis: true })),
        ...stringVars.map((v) => ({ v, kind: 'STRING' as const, isTopAxis: true })),
        ...discreteVars.map((v) => ({ v, kind: 'DISCRETE' as const, isTopAxis: false })),
      ];
      const columnForVar = (v: VariableItem): number => {
        const direct = table.headers.indexOf(v.name);
        if (direct >= 0) return direct;
        return table.headers.findIndex((_, ci) => table.rows.some((r) => String(r[ci] ?? '').trim() === v.name));
      };
      const axisColIdx: Record<string, number> = {};
      const orderedAxes = allAxes.filter(({ v }) => {
        const idx = columnForVar(v);
        if (idx >= 0) axisColIdx[v.name] = idx;
        return idx >= 0;
      });
      if (orderedAxes.length === 0) return;
      const axisAliases: Record<string, string> = {};
      orderedAxes.forEach(({ v, kind, isTopAxis }, axisIdx) => {
        const alias = uniqueAlias(toAxisAlias(v.name));
        axisAliases[v.name] = alias;
        steps.push({ command: 'AddAxis', as: alias, tableRef: `$${tableAlias}`, payload: { kind, variableRef: { byName: v.name }, isTopAxis, axisOrder: axisIdx } as AddAxisPayload });
      });
      const valueColIdx = table.headers.findIndex((h) => !varNameSet.has(h));
      const cells = table.rows.map((row) => {
        const coords = orderedAxes.map(({ v }) => {
          const colIdx = axisColIdx[v.name];
          const raw = colIdx >= 0 ? String(row[colIdx] ?? '').trim() : '';
          const byName = raw === v.name ? '' : normalizeRangeLabel(raw);
          return { childOfVariable: `$${axisAliases[v.name]}`, byName };
        });
        const rawVal = valueColIdx >= 0 ? row[valueColIdx] : undefined;
        const value = rawVal != null ? parseFloat(String(rawVal)) : 0;
        return { coords, value: isNaN(value) ? 0 : value };
      }).filter((c) => c.coords.every((coord) => coord.byName !== ''));
      if (cells.length > 0) steps.push({ command: 'SetCellValues', tableRef: `$${tableAlias}`, payload: { cells } as SetCellValuesPayload });
    }
  });
  return { variables: variablesSection, factorTables: { steps } };
};

const stepIndexFromPercentage = (pct: number | null | undefined): number => {
  if (pct == null) return 0;
  if (pct >= STEP_PROGRESS.methodologies) return STEP_ORDER.indexOf('methodologies');
  if (pct >= STEP_PROGRESS.variables) return STEP_ORDER.indexOf('variables');
  if (pct >= STEP_PROGRESS.rateTable) return STEP_ORDER.indexOf('rateTable');
  if (pct >= STEP_PROGRESS.details) return STEP_ORDER.indexOf('rateTable');
  return 0;
};

const detailsFromDto = (dto: PcScheduleDto): DetailsFormState => ({
  scheduleType: (dto.scheduleType as ScheduleType) || '',
  description: dto.description ?? '',
  startDate: dto.startDate ?? '',
  endDate: dto.endDate ?? '',
  product: null,
});

const createdFromDto = (dto: PcScheduleDto): CreatedSchedule => ({
  scheduleGid: dto.scheduleGid,
  scheduleId: dto.scheduleId,
  calculationBaseGid: dto.calculationBaseGid,
  integrationMapGid: dto.integrationMapGid,
  percentage: dto.percentage ?? 0,
});

interface ScheduleWizardProps {
  onCancel: () => void;
  onFinish: () => void;
  existingSchedule?: PcScheduleDto;
  onClassifyingChange?: (inProgress: boolean) => void;
}

const CLASSIFY_LEAVE_MESSAGE =
  'AI Variable Classification is in progress. If you leave now the process may be interrupted. Leave anyway?';

const ScheduleWizard = ({ onCancel, onFinish, existingSchedule, onClassifyingChange }: ScheduleWizardProps) => {
  const isResume = !!existingSchedule;
  const [activeIndex, setActiveIndex] = useState(() => isResume ? stepIndexFromPercentage(existingSchedule!.percentage) : 0);
  const [details, setDetails] = useState<DetailsFormState>(() => isResume ? detailsFromDto(existingSchedule!) : emptyDetails);
  const [created, setCreated] = useState<CreatedSchedule | null>(() => isResume ? createdFromDto(existingSchedule!) : null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [parsedTables, setParsedTables] = useState<ParsedTable[]>([]);
  const [currentVariables, setCurrentVariables] = useState<VariableItem[]>([]);
  const [hasNewUpload, setHasNewUpload] = useState(false);
  const [rateTablesAvailable, setRateTablesAvailable] = useState(false);
  const [classificationSubmitted, setClassificationSubmitted] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleClassifyingChange = useCallback((inProgress: boolean) => {
    setClassifying(inProgress);
    onClassifyingChange?.(inProgress);
  }, [onClassifyingChange]);

  const guardNav = (action: () => void) => {
    if (classifying) setPendingNav(() => action);
    else action();
  };

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: submitDetails,
    onSuccess: (result, submitted) => {
      setCreated(result);
      setScheduleStep(result.scheduleGid, 'details');
      setActiveIndex(1);
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
      qc.setQueryData<PcScheduleDto>(queryKeys.schedules.detail(result.scheduleId), {
        scheduleGid: result.scheduleGid,
        scheduleId: result.scheduleId,
        scheduleType: submitted.scheduleType || '',
        description: submitted.description || null,
        startDate: submitted.startDate || '',
        endDate: submitted.endDate || '',
        calculationBaseGid: result.calculationBaseGid,
        integrationMapGid: result.integrationMapGid,
        percentage: result.percentage,
      });
    },
    onError: (err) => setError(extractApiMessage(err, 'Failed to create schedule')),
  });

  const classifyMutation = useMutation({
    mutationFn: async ({ scheduleId, tables }: { scheduleId: number; tables: ParsedTable[] }) =>
      submitClassification(scheduleId, { rateTableName: summariseTableNames(tables), rateTables: toRateTableGrids(tables) }),
    onSuccess: (job: ClassificationJobDto) => {
      qc.setQueryData(queryKeys.classification.latest(job.scheduleId), job);
      setHasNewUpload(false);
      setClassificationSubmitted(true);
      setToast(`Classification submitted (job #${job.jobId})`);
      setActiveIndex(2);
    },
    onError: (err) => setError(extractApiMessage(err, 'Failed to submit classification')),
  });

  const scheduleSetupMutation = useMutation({
    mutationFn: async ({ scheduleGid, scheduleId, body }: { scheduleGid: string; scheduleId: number; body: CreatePcScheduleSetupRequest }) => {
      await scheduleSetup(scheduleGid, body);
      await updateSchedulePercentage(scheduleId, VARIABLES_SAVED_PERCENTAGE);
    },
    onSuccess: () => {
      if (created) {
        setScheduleStep(created.scheduleGid, 'variables');
        setParsedTables([]);
        setUploadedFile(null);
        setCurrentVariables([]);
        setClassificationSubmitted(false);
        qc.setQueryData<PcScheduleDto>(queryKeys.schedules.detail(created.scheduleId), (prev) => (prev ? { ...prev, percentage: VARIABLES_SAVED_PERCENTAGE } : prev));
        qc.invalidateQueries({ queryKey: queryKeys.scheduleSetup.rateTables(created.scheduleGid) });
        qc.invalidateQueries({ queryKey: queryKeys.scheduleSetup.variables(created.scheduleGid) });
      }
      setToast('Schedule setup saved');
      setActiveIndex(3);
    },
    onError: (err) => setError(extractApiMessage(err, 'Failed to save schedule setup')),
  });

  const scheduleDetailQuery = useQuery({
    queryKey: created ? queryKeys.schedules.detail(created.scheduleId) : ['noop'],
    queryFn: () => getPcSchedule(created!.scheduleId),
    enabled: !!created,
    staleTime: 15_000,
  });

  useEffect(() => {
    const dto = scheduleDetailQuery.data;
    if (!created || !dto || !dto.scheduleType) return;
    setDetails((prev) => ({
      scheduleType: (dto.scheduleType as ScheduleType) || prev.scheduleType,
      description: dto.description ?? '',
      startDate: dto.startDate ?? prev.startDate,
      endDate: dto.endDate ?? prev.endDate,
      product: prev.product,
    }));
  }, [created, scheduleDetailQuery.data]);

  const submitting = createMutation.isPending || classifyMutation.isPending || scheduleSetupMutation.isPending;
  const activeStep = STEP_ORDER[activeIndex];
  const serverPct = scheduleDetailQuery.data?.percentage;
  const progressPct = created ? (serverPct ?? STEP_PROGRESS[activeStep]) : 0;

  const canNext = (() => {
    if (activeStep === 'details') return !submitting;
    if (activeStep === 'rateTable' && !isResume) return !!uploadedFile || rateTablesAvailable;
    return true;
  })();

  const heading = useMemo(() => isResume ? `Schedule ${existingSchedule!.scheduleId}` : 'New PC Schedule', [isResume, existingSchedule]);
  const subheading = isResume
    ? existingSchedule!.description || 'Review or continue configuring this schedule.'
    : 'Follow the 4 steps to create, load the rate table and generate methodologies.';

  const handleNext = () => {
    setError(null);
    switch (activeStep) {
      case 'details': {
        if (created) { setActiveIndex(1); return; }
        const errs = validateDetails(details);
        if (Object.keys(errs).length > 0) { setError(Object.values(errs)[0] ?? 'Please fix the highlighted fields.'); return; }
        createMutation.mutate(details);
        return;
      }
      case 'rateTable': {
        if (!created) return;
        setScheduleStep(created.scheduleGid, 'rateTable');
        if (!hasNewUpload || parsedTables.length === 0) { setActiveIndex(2); return; }
        classifyMutation.mutate({ scheduleId: created.scheduleId, tables: parsedTables });
        return;
      }
      case 'variables': {
        if (!created) return;
        if (!classificationSubmitted || currentVariables.length === 0) { setScheduleStep(created.scheduleGid, 'variables'); setActiveIndex(3); return; }
        const classificationData = qc.getQueryData<ClassificationJobDto>(queryKeys.classification.latest(created.scheduleId));
        const rateTableName = classificationData?.rateTableName ?? summariseTableNames(parsedTables);
        const body = buildScheduleSetupRequest(currentVariables, parsedTables, rateTableName, details.startDate, details.endDate);
        scheduleSetupMutation.mutate({ scheduleGid: created.scheduleGid, scheduleId: created.scheduleId, body });
        return;
      }
      case 'methodologies':
        if (created) setScheduleStep(created.scheduleGid, 'methodologies');
        setToast('Schedule fully configured');
        onFinish();
    }
  };

  const handleBack = () => guardNav(() => { if (activeIndex > 0) setActiveIndex(activeIndex - 1); });
  const handleCancel = () => guardNav(onCancel);
  const isLastStep = activeIndex === STEP_ORDER.length - 1;

  const nextLabel = (() => {
    if (activeStep === 'details') return created ? 'Next' : 'Create & Next';
    if (activeStep === 'rateTable') return !hasNewUpload ? 'Next' : 'Save & Next';
    if (activeStep === 'variables') return classificationSubmitted ? 'Save & Next' : 'Next';
    if (activeStep === 'methodologies') return isLastStep ? 'Finish' : 'Save & Next';
    return 'Save & Next';
  })();

  return (
    <div className="p-6 md:p-8 flex flex-col gap-4">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col gap-4">

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 flex items-center gap-4">
          <button onClick={handleCancel} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{heading}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{subheading}</p>
          </div>
          {created && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-100 text-success-700 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" />
              {created.scheduleId}
            </div>
          )}
        </div>

        {/* Overall progress */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">
              Overall progress
              {scheduleDetailQuery.isFetching && created && (
                <span className="ml-2 text-slate-400 font-normal">· syncing…</span>
              )}
            </span>
            <span className="text-xs text-slate-500">{progressPct}%</span>
          </div>
          <LinearProgress value={progressPct} barHeight={8} tone={progressPct >= 100 ? 'success' : 'primary'} />
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4 flex justify-center overflow-x-auto">
          <Stepper steps={STEP_ORDER.map((s) => STEP_LABELS[s])} activeStep={activeIndex} />
        </div>

        {/* Step content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {error && <Alert severity="error" variant="outlined" className="mb-4">{error}</Alert>}

          {activeStep === 'details' && (
            <DetailsStep value={details} onChange={setDetails} submitting={submitting} locked={!!created} />
          )}
          {activeStep === 'rateTable' && (
            <RateTableStep
              scheduleId={created?.scheduleId ?? null}
              scheduleGid={created?.scheduleGid ?? null}
              uploadedFileName={uploadedFile}
              onFileSelected={setUploadedFile}
              onTablesChange={setParsedTables}
              onUpload={() => setHasNewUpload(true)}
              onTablesAvailableChange={setRateTablesAvailable}
              initialTables={parsedTables}
            />
          )}
          {activeStep === 'variables' && (
            <VariablesStep
              scheduleId={created?.scheduleId ?? null}
              scheduleGid={created?.scheduleGid ?? null}
              classificationEnabled={classificationSubmitted}
              onVariablesChange={setCurrentVariables}
              onClassifyingChange={handleClassifyingChange}
            />
          )}
          {activeStep === 'methodologies' && <MethodologiesStep />}
        </div>

        {/* Footer */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between gap-3">
          <Button
            variant="text"
            color="inherit"
            startIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={handleBack}
            disabled={activeIndex === 0 || submitting}
          >
            Back
          </Button>

          <Button
            variant="contained"
            color="primary"
            size="large"
            endIcon={submitting ? <Spinner size={16} color="white" /> : <ArrowRight className="w-4 h-4" />}
            disabled={!canNext || submitting}
            onClick={handleNext}
          >
            {nextLabel}
          </Button>
        </div>
      </div>

      <Snackbar open={!!toast} onClose={() => setToast(null)} autoHideDuration={3000} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>

      <ConfirmDialog
        open={pendingNav !== null}
        title="Classification in progress"
        message={CLASSIFY_LEAVE_MESSAGE}
        onConfirm={() => { pendingNav?.(); setPendingNav(null); }}
        onCancel={() => setPendingNav(null)}
      />
    </div>
  );
};

export default ScheduleWizard;
