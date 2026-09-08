import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
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
import {
  BrandButton,
  BrandLinearProgress,
  OverallProgressCaption,
  PageContainer,
  StepCard,
  WizardFooter,
  WizardHeader,
  WizardLane,
  WizardPanel,
} from '../../theme/styled';

const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Schedule Creation',
  rateTable: 'Rate Table',
  variables: 'Variables',
  methodologies: 'Methodologies',
};

/** Wizard progress persisted after the rate table + variables are saved. */
const VARIABLES_SAVED_PERCENTAGE = 80;

const extractApiMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } }; message?: string })
    ?.response?.data?.message ??
  (err as { message?: string })?.message ??
  fallback;


/**
 * Extract distinct non-empty values for `varName` from all parsed table columns.
 * Used as fallback when a discrete variable has no pre-classified values —
 * e.g. the user dragged a Continuous/String card into the Discrete column.
 */
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

/**
 * Resolve the children (value labels) for a discrete variable.
 * Prefers pre-classified values; falls back to distinct column values from
 * the parsed tables when the variable was dragged from another type bucket.
 */
const resolveDiscreteValues = (
  v: VariableItem,
  parsedTables: ParsedTable[],
): string[] =>
  v.values.length > 0 ? v.values : extractColumnValues(v.name, parsedTables);

/**
 * Normalise interval-notation range labels to the "a-b" format expected by the
 * factor table backend, while leaving comparison-operator labels unchanged.
 *
 *   [1,2)  →  1-2      [2,3)  →  2-3      [4,11)  →  4-11
 *   >=40   →  >=40     <=30   →  <=30     40>     →  40>
 *   Agent  →  Agent    0-1    →  0-1      (already correct, no-op)
 */
const normalizeRangeLabel = (label: string): string => {
  // Match [a,b) / (a,b] / [a,b] / (a,b)  →  "a-b"
  const match = label.match(/^[\[(]([^,]+),([^,\]\)]+)[\]\)]$/);
  if (match) {
    return `${match[1].trim()}-${match[2].trim()}`;
  }
  return label;
};

/**
 * Derive a camelCase axis alias from a variable name.
 *   "PolicyDuration" → "policyDurationAxis"
 *   "InsuredAge"     → "insuredAgeAxis"
 *   "PositionType"   → "positionTypeAxis"
 */
const toAxisAlias = (varName: string): string => {
  const camel = varName
    .replace(/\s+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toLowerCase());
  return `${camel}Axis`;
};

type AxisKind = 'CONTINUOUS' | 'DATE' | 'STRING' | 'DISCRETE';

const axisKindOf = (v: VariableItem): AxisKind =>
  v.type === 'Continuous' ? 'CONTINUOUS'
  : v.type === 'Date'      ? 'DATE'
  : v.type === 'String'    ? 'STRING'
  :                          'DISCRETE';

/**
 * Fill blank cells forward from the previous non-blank value, starting at
 * column 1 (column 0 is the variable-label column and is never propagated).
 * Handles Excel merged header cells, where a value spanning several columns
 * is written only into the first cell and the rest come back blank.
 *
 *   ["PolicyYear", "[1,2)", "", "", "", "", ">=2", "", "", "", ""]
 *   →              "[1,2)","[1,2)","[1,2)","[1,2)","[1,2)",">=2",">=2",...
 */
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
  /** Row that holds this axis's bucket values across columns (undefined for a row axis). */
  valueRow?: unknown[];
}

interface MatrixPlan {
  columnAxes: MatrixAxis[]; // top axes — values run across columns (header + label rows)
  rowAxes: MatrixAxis[];    // row axes — values run down column 0
  dataStartRow: number;     // first table.rows index that holds real cell data
}

/**
 * Detects the "matrix" layout — a grid with one or more axis labels stacked in
 * column 0 (the header cell plus the first data rows), the top axes' bucket
 * values spread across the header / label rows, and the row axis values running
 * down column 0. Generalises the older pivot layout (1 column axis + 1 row axis).
 *
 *   | PolicyYear         | [1,2) ──── spans 5 ──── | >=2 ──── spans 5 ──── |   ← headers
 *   | SalesBand          | [1,2) | [2,3) | ...      | [1,2) | [2,3) | ...    |   ← rows[0]
 *   | CommissionSchedule |                                                   |   ← rows[1]
 *   | Nova Insurance     | 0     | 0     | ...                               |   ← rows[2] (data)
 *
 * Here PolicyYear + SalesBand are column axes and CommissionSchedule is the row
 * axis; each data cell references all three.
 */
const detectMatrixLayout = (
  table: ParsedTable,
  variables: VariableItem[],
): MatrixPlan | null => {
  const varByName = new Map(variables.map((v) => [v.name, v]));
  const col0Header = String(table.headers[0] ?? '').trim();
  if (!varByName.has(col0Header)) return null;

  // Build the label stack: header cell, then rows[k][0] while they are variable names.
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
  // Need at least two stacked variables to be a matrix (otherwise it is standard layout).
  if (stack.length < 2) return null;

  const dataStartRow = k;
  if (dataStartRow >= table.rows.length) return null;

  // A stack entry whose value row has data past column 0 is a column axis;
  // one whose value row is blank past column 0 is a row axis (values run down col 0).
  const hasColumnValues = (row: unknown[]) =>
    row.slice(1).some((c) => String(c ?? '').trim() !== '');

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
  const discreteVars   = variables.filter((v) => v.type === 'Discrete');
  const continuousVars = variables.filter((v) => v.type === 'Continuous');
  const dateVars       = variables.filter((v) => v.type === 'Date');
  const stringVars     = variables.filter((v) => v.type === 'String');
  const varNameSet     = new Set(variables.map((v) => v.name));

  // Resolve children for discrete variables (pre-classified or extracted from table)
  const resolvedDiscreteValues: Record<string, string[]> = {};
  discreteVars.forEach((v) => {
    resolvedDiscreteValues[v.name] = resolveDiscreteValues(v, parsedTables);
  });

  const variablesSection = {
    ...(discreteVars.length > 0 && {
      discrete: discreteVars.map((v) => ({
        name: v.name,
        children: resolvedDiscreteValues[v.name].map((val) => ({ name: val })),
      })),
    }),
    ...(continuousVars.length > 0 && { continuous: continuousVars.map((v) => ({ name: v.name })) }),
    ...(dateVars.length > 0       && { date:       dateVars.map((v) => ({ name: v.name })) }),
    ...(stringVars.length > 0     && { string:     stringVars.map((v) => ({ name: v.name })) }),
  };

  type AxisEntry = {
    v: VariableItem;
    kind: 'CONTINUOUS' | 'DATE' | 'STRING' | 'DISCRETE';
    isTopAxis: boolean;
  };

  const steps: StepDto[] = [];

  // Axis aliases (`as`) must be unique across the WHOLE request — the backend
  // rejects duplicate step aliases. When the same variable is used as an axis in
  // more than one table, the second use gets a numeric suffix so the aliases stay
  // distinct while the first table keeps the clean name.
  const usedAliases = new Set<string>();
  const uniqueAlias = (base: string): string => {
    let alias = base;
    let n = 2;
    while (usedAliases.has(alias)) alias = `${base}_${n++}`;
    usedAliases.add(alias);
    return alias;
  };

  parsedTables.forEach((table, tIdx) => {
    const tableAlias = tIdx === 0 ? 'table' : `table${tIdx}`;

    steps.push({
      command: 'AddFactorTable',
      as: tableAlias,
      payload: {
        name: table.name || rateTableName,
        cellType: 'NUMERIC',
        startDate,
        endDate,
      } as AddFactorTablePayload,
    });

    // ── Matrix layout detection ───────────────────────────────────────────────
    // Matrix layout: two or more axis labels stacked in column 0 (header cell +
    // first data rows). Top axes' bucket values run across the header/label rows;
    // the row axis's values run down column 0. Each data cell references every axis.
    // Generalises the pivot layout (1 column axis + 1 row axis).
    //
    //   | PolicyYear         | [1,2) ── spans 5 ── | >=2 ── spans 5 ── |
    //   | SalesBand          | [1,2) | [2,3) | ...  | [1,2) | [2,3) | ... |
    //   | CommissionSchedule |
    //   | Nova Insurance     | 0     | 0     | ...
    //
    // Standard layout: each variable has its own column matched by header name.
    const matrix = detectMatrixLayout(table, variables);

    if (matrix) {
      // ── Matrix layout ─────────────────────────────────────────────────────
      const aliases: Record<string, string> = {};
      let axisOrder = 0;

      // Column axes first (isTopAxis: true), then row axes (isTopAxis: false).
      matrix.columnAxes.forEach(({ v }) => {
        const alias = uniqueAlias(toAxisAlias(v.name));
        aliases[v.name] = alias;
        steps.push({
          command: 'AddAxis',
          as: alias,
          tableRef: `$${tableAlias}`,
          payload: {
            kind: axisKindOf(v),
            variableRef: { byName: v.name },
            isTopAxis: true,
            axisOrder: axisOrder++,
          } as AddAxisPayload,
        });
      });
      matrix.rowAxes.forEach(({ v }) => {
        const alias = uniqueAlias(toAxisAlias(v.name));
        aliases[v.name] = alias;
        steps.push({
          command: 'AddAxis',
          as: alias,
          tableRef: `$${tableAlias}`,
          payload: {
            kind: axisKindOf(v),
            variableRef: { byName: v.name },
            isTopAxis: false,
            axisOrder: axisOrder++,
          } as AddAxisPayload,
        });
      });

      // Pre-compute each column axis's per-column bucket values (merged cells filled forward).
      const filledColumnAxes = matrix.columnAxes.map(({ v, valueRow }) => ({
        v,
        vals: fillForwardValues(valueRow ?? []),
      }));

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

          // Column axes → byName from the filled value row at this column.
          for (const { v, vals } of filledColumnAxes) {
            const bn = normalizeRangeLabel(String(vals[c] ?? '').trim());
            if (!bn) { complete = false; break; }
            coords.push({ childOfVariable: `$${aliases[v.name]}`, byName: bn });
          }
          if (!complete) continue;

          // Row axes → byName from column 0 of this data row.
          for (const { v } of matrix.rowAxes) {
            coords.push({ childOfVariable: `$${aliases[v.name]}`, byName: normalizeRangeLabel(rowLabel) });
          }

          cells.push({ coords, value });
        }
      }

      if (cells.length > 0) {
        steps.push({
          command: 'SetCellValues',
          tableRef: `$${tableAlias}`,
          payload: { cells } as SetCellValuesPayload,
        });
      }

    } else {
      // ── Standard layout ───────────────────────────────────────────────────
      // Each variable has its own column matched by header name.
      // Continuous / Date / String → top axes; Discrete → row axes.
      const allAxes: AxisEntry[] = [
        ...continuousVars.map((v) => ({ v, kind: 'CONTINUOUS' as const, isTopAxis: true  })),
        ...dateVars.map((v)        => ({ v, kind: 'DATE'       as const, isTopAxis: true  })),
        ...stringVars.map((v)      => ({ v, kind: 'STRING'     as const, isTopAxis: true  })),
        ...discreteVars.map((v)    => ({ v, kind: 'DISCRETE'   as const, isTopAxis: false })),
      ];

      // Resolve the column each variable maps to (direct header, else sub-header fallback).
      const columnForVar = (v: VariableItem): number => {
        const direct = table.headers.indexOf(v.name);
        if (direct >= 0) return direct;
        return table.headers.findIndex((_, ci) =>
          table.rows.some((r) => String(r[ci] ?? '').trim() === v.name),
        );
      };

      // Only include variables that actually appear in THIS table — so a multi-table
      // upload emits per-table axes (table1 → its columns, table2 → its columns) instead
      // of forcing every variable onto every table.
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
        steps.push({
          command: 'AddAxis',
          as: alias,
          tableRef: `$${tableAlias}`,
          payload: {
            kind,
            variableRef: { byName: v.name },
            isTopAxis,
            axisOrder: axisIdx,
          } as AddAxisPayload,
        });
      });

      // Value column = first header not in varNameSet
      const valueColIdx = table.headers.findIndex((h) => !varNameSet.has(h));

      const cells = table.rows
        .map((row) => {
          const coords = orderedAxes.map(({ v }) => {
            const colIdx = axisColIdx[v.name];
            const raw    = colIdx >= 0 ? String(row[colIdx] ?? '').trim() : '';
            const byName = raw === v.name ? '' : normalizeRangeLabel(raw); // skip sub-header row
            return { childOfVariable: `$${axisAliases[v.name]}`, byName };
          });
          const rawVal = valueColIdx >= 0 ? row[valueColIdx] : undefined;
          const value  = rawVal != null ? parseFloat(String(rawVal)) : 0;
          return { coords, value: isNaN(value) ? 0 : value };
        })
        .filter((c) => c.coords.every((coord) => coord.byName !== ''));

      if (cells.length > 0) {
        steps.push({
          command: 'SetCellValues',
          tableRef: `$${tableAlias}`,
          payload: { cells } as SetCellValuesPayload,
        });
      }
    }
  });

  return {
    variables: variablesSection,
    factorTables: { steps },
  };
};

/** Derives the initial step index from a persisted percentage. */
const stepIndexFromPercentage = (pct: number | null | undefined): number => {
  if (pct == null) return 0;
  if (pct >= STEP_PROGRESS.methodologies) return STEP_ORDER.indexOf('methodologies');
  if (pct >= STEP_PROGRESS.variables) return STEP_ORDER.indexOf('variables');
  if (pct >= STEP_PROGRESS.rateTable) return STEP_ORDER.indexOf('rateTable');
  if (pct >= STEP_PROGRESS.details) return STEP_ORDER.indexOf('rateTable');
  return 0;
};

/** Lifts an existing PcScheduleDto into the shape the wizard uses to hydrate state. */
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
  /**
   * When set, the wizard opens in "resume" mode for an existing schedule:
   * Details fields are pre-populated and locked, and the stepper jumps to the
   * step matching the server-persisted percentage.
   */
  existingSchedule?: PcScheduleDto;
}

const ScheduleWizard = ({
  onCancel,
  onFinish,
  existingSchedule,
}: ScheduleWizardProps) => {
  const isResume = !!existingSchedule;

  const [activeIndex, setActiveIndex] = useState(() =>
    isResume ? stepIndexFromPercentage(existingSchedule!.percentage) : 0,
  );
  const [details, setDetails] = useState<DetailsFormState>(() =>
    isResume ? detailsFromDto(existingSchedule!) : emptyDetails,
  );
  const [created, setCreated] = useState<CreatedSchedule | null>(() =>
    isResume ? createdFromDto(existingSchedule!) : null,
  );
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [parsedTables, setParsedTables] = useState<ParsedTable[]>([]);
  // Tracks the user's current variable assignments from the Variables board
  // (updated via drag-and-drop or when classification completes).
  const [currentVariables, setCurrentVariables] = useState<VariableItem[]>([]);
  // True only after the user uploads a new rate-table file. AI classification
  // fires on "Save & Next" ONLY while this is set; it's cleared once the job is
  // submitted, so navigating the step without a new upload never re-classifies.
  const [hasNewUpload, setHasNewUpload] = useState(false);
  // Whether the Rate Table step has any table to proceed with (saved from the GET
  // or freshly uploaded). Gates the "Next" button for new schedules.
  const [rateTablesAvailable, setRateTablesAvailable] = useState(false);
  // True once a classification job has actually been submitted this session.
  // Gates the classification-status GET in the Variables step, so merely
  // navigating to that tab (without a new upload) never polls the classifier.
  const [classificationSubmitted, setClassificationSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: submitDetails,
    onSuccess: (result, submitted) => {
      setCreated(result);
      setScheduleStep(result.scheduleGid, 'details');
      setActiveIndex(1);
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });

      // Seed the detail cache with the values just submitted so the GET
      // (scheduleDetailQuery below) refreshes it with the same canonical data
      // rather than momentarily blanking the form.
      qc.setQueryData<PcScheduleDto>(
        queryKeys.schedules.detail(result.scheduleId),
        {
          scheduleGid: result.scheduleGid,
          scheduleId: result.scheduleId,
          scheduleType: submitted.scheduleType || '',
          description: submitted.description || null,
          startDate: submitted.startDate || '',
          endDate: submitted.endDate || '',
          calculationBaseGid: result.calculationBaseGid,
          integrationMapGid: result.integrationMapGid,
          percentage: result.percentage,
        },
      );
    },
    onError: (err) => setError(extractApiMessage(err, 'Failed to create schedule')),
  });

  const classifyMutation = useMutation({
    mutationFn: async ({
      scheduleId,
      tables,
    }: {
      scheduleId: number;
      tables: ParsedTable[];
    }) =>
      submitClassification(scheduleId, {
        rateTableName: summariseTableNames(tables),
        rateTables: toRateTableGrids(tables),
      }),
    onSuccess: (job: ClassificationJobDto) => {
      qc.setQueryData(
        queryKeys.classification.latest(job.scheduleId),
        job,
      );
      // Consume the upload flag — further navigation won't re-classify until a new upload.
      setHasNewUpload(false);
      // Allow the Variables step to poll the classification status for this job.
      setClassificationSubmitted(true);
      setToast(`Classification submitted (job #${job.jobId})`);
      setActiveIndex(2);
    },
    onError: (err) =>
      setError(extractApiMessage(err, 'Failed to submit classification')),
  });

  const scheduleSetupMutation = useMutation({
    mutationFn: async ({
      scheduleGid,
      scheduleId,
      body,
    }: {
      scheduleGid: string;
      scheduleId: number;
      body: CreatePcScheduleSetupRequest;
    }) => {
      await scheduleSetup(scheduleGid, body);
      // Rate table + variables are now persisted — advance wizard progress to 80%.
      await updateSchedulePercentage(scheduleId, VARIABLES_SAVED_PERCENTAGE);
    },
    onSuccess: () => {
      if (created) {
        setScheduleStep(created.scheduleGid, 'variables');
        // The uploaded tables/variables are now persisted — drop the in-session
        // upload cache so they aren't shown again as duplicates alongside the
        // GET-loaded (saved) copies, and refetch the saved data.
        setParsedTables([]);
        setUploadedFile(null);
        setCurrentVariables([]);
        // Nothing new to save now — the setup is persisted. Returning to the
        // Variables step shows the saved data (button "Next", no POST).
        setClassificationSubmitted(false);
        // Reflect the new 80% progress locally so the bar updates immediately.
        qc.setQueryData<PcScheduleDto>(
          queryKeys.schedules.detail(created.scheduleId),
          (prev) => (prev ? { ...prev, percentage: VARIABLES_SAVED_PERCENTAGE } : prev),
        );
        qc.invalidateQueries({
          queryKey: queryKeys.scheduleSetup.rateTables(created.scheduleGid),
        });
        qc.invalidateQueries({
          queryKey: queryKeys.scheduleSetup.variables(created.scheduleGid),
        });
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

  // Once the schedule has been created and its GET returns, hydrate the Details
  // form fields from the persisted record so they reflect the saved (canonical)
  // values. The product isn't carried on the DTO, so the current one is kept.
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

  const submitting =
    createMutation.isPending ||
    classifyMutation.isPending ||
    scheduleSetupMutation.isPending;
  const activeStep = STEP_ORDER[activeIndex];
  const serverPct = scheduleDetailQuery.data?.percentage;
  const progressPct = created
    ? (serverPct ?? STEP_PROGRESS[activeStep])
    : 0;

  const canNext = (() => {
    if (activeStep === 'details') return !submitting;
    // Allow Next when a file was uploaded this session OR the schedule already has
    // saved rate tables (loaded via the GET) to proceed with.
    if (activeStep === 'rateTable' && !isResume) {
      return !!uploadedFile || rateTablesAvailable;
    }
    return true;
  })();

  const heading = useMemo(
    () =>
      isResume
        ? `Schedule ${existingSchedule!.scheduleId}`
        : 'New PC Schedule',
    [isResume, existingSchedule],
  );

  const subheading = isResume
    ? existingSchedule!.description ||
      'Review or continue configuring this schedule.'
    : 'Follow the 4 steps to create, load the rate table and generate methodologies.';

  const handleNext = () => {
    setError(null);

    switch (activeStep) {
      case 'details': {
        if (created) {
          setActiveIndex(1);
          return;
        }
        const errs = validateDetails(details);
        if (Object.keys(errs).length > 0) {
          setError(Object.values(errs)[0] ?? 'Please fix the highlighted fields.');
          return;
        }
        createMutation.mutate(details);
        return;
      }
      case 'rateTable': {
        if (!created) return;
        setScheduleStep(created.scheduleGid, 'rateTable');

        // Classify ONLY when the user uploaded a new rate table this visit.
        // No new upload → pure navigation, don't re-fire the AI job.
        if (!hasNewUpload || parsedTables.length === 0) {
          setActiveIndex(2);
          return;
        }

        classifyMutation.mutate({
          scheduleId: created.scheduleId,
          tables: parsedTables,
        });
        return;
      }
      case 'variables': {
        if (!created) return;

        // Save (POST /pc/schedule-setup) ONLY when a new classification was done
        // this session. Merely viewing the saved variables (loaded via GET) is not
        // a change — just advance without calling schedule-setup.
        if (!classificationSubmitted || currentVariables.length === 0) {
          setScheduleStep(created.scheduleGid, 'variables');
          setActiveIndex(3);
          return;
        }

        const classificationData = qc.getQueryData<ClassificationJobDto>(
          queryKeys.classification.latest(created.scheduleId),
        );
        const rateTableName =
          classificationData?.rateTableName ?? summariseTableNames(parsedTables);

        const body = buildScheduleSetupRequest(
          currentVariables,
          parsedTables,
          rateTableName,
          details.startDate,
          details.endDate,
        );

        scheduleSetupMutation.mutate({
          scheduleGid: created.scheduleGid,
          scheduleId: created.scheduleId,
          body,
        });
        return;
      }
      case 'methodologies':
        if (created) setScheduleStep(created.scheduleGid, 'methodologies');
        setToast('Schedule fully configured');
        onFinish();
    }
  };

  const handleBack = () => {
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  const isLastStep = activeIndex === STEP_ORDER.length - 1;

  return (
    <PageContainer>
      <WizardLane>
        <WizardHeader>
          <IconButton onClick={onCancel} color="default">
            <ArrowBackRoundedIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5">{heading}</Typography>
            <Typography variant="body2" color="text.secondary">
              {subheading}
            </Typography>
          </Box>
          {created && (
            <Chip
              icon={<CheckCircleRoundedIcon />}
              label={created.scheduleId}
              color="success"
            />
          )}
        </WizardHeader>

        <WizardPanel elevation={0}>
          <OverallProgressCaption>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Overall progress
              {scheduleDetailQuery.isFetching && created && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1, fontWeight: 400 }}
                >
                  · syncing…
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {progressPct}%
            </Typography>
          </OverallProgressCaption>
          <BrandLinearProgress
            variant="determinate"
            value={progressPct}
            barHeight={8}
            tone={progressPct >= 100 ? 'success' : 'primary'}
          />
        </WizardPanel>

        <WizardPanel elevation={0}>
          <Stepper activeStep={activeIndex} alternativeLabel>
            {STEP_ORDER.map((s) => (
              <Step key={s}>
                <StepLabel>{STEP_LABELS[s]}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </WizardPanel>

        <StepCard elevation={0}>
          {error && (
            <Box sx={{ mb: 3 }}>
              <Alert severity="error" variant="outlined">
                {error}
              </Alert>
            </Box>
          )}

          {activeStep === 'details' && (
            <DetailsStep
              value={details}
              onChange={setDetails}
              submitting={submitting}
              locked={!!created}
            />
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
            />
          )}
          {activeStep === 'methodologies' && <MethodologiesStep />}
        </StepCard>

        <WizardFooter>
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={handleBack}
            disabled={activeIndex === 0 || submitting}
          >
            Back
          </Button>

          <BrandButton
            size="large"
            variant="contained"
            endIcon={
              submitting ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <ArrowForwardRoundedIcon />
              )
            }
            disabled={!canNext || submitting}
            onClick={handleNext}
          >
            <NextButtonLabel
              activeStep={activeStep}
              hasCreated={!!created}
              isLastStep={isLastStep}
              rateTableAlreadyClassified={!hasNewUpload}
              variablesHasChanges={classificationSubmitted}
            />
          </BrandButton>
        </WizardFooter>
      </WizardLane>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity="success"
          variant="filled"
        >
          {toast}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

interface NextLabelProps {
  activeStep: WizardStep;
  hasCreated: boolean;
  isLastStep: boolean;
  rateTableAlreadyClassified: boolean;
  /** True when the Variables step has new classified data to persist. */
  variablesHasChanges: boolean;
}
const NextButtonLabel = ({
  activeStep,
  hasCreated,
  isLastStep,
  rateTableAlreadyClassified,
  variablesHasChanges,
}: NextLabelProps) => {
  if (activeStep === 'details') return <>{hasCreated ? 'Next' : 'Create & Next'}</>;
  if (activeStep === 'rateTable') {
    // If nothing has changed since the last successful classification,
    // the button is pure navigation — signal that to the user.
    return <>{rateTableAlreadyClassified ? 'Next' : 'Save & Next'}</>;
  }
  if (activeStep === 'variables') {
    // Only a fresh classification is a change to save; otherwise pure navigation.
    return <>{variablesHasChanges ? 'Save & Next' : 'Next'}</>;
  }
  if (activeStep === 'methodologies') return <>{isLastStep ? 'Finish' : 'Save & Next'}</>;
  return <>Save &amp; Next</>;
};

export default ScheduleWizard;
