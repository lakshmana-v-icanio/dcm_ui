import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import * as XLSX from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  BrandButton,
  DropZone,
  StyledTableHeadRow,
  SurfaceCard,
} from '../../theme/styled';
import {
  getScheduleRateTables,
  getScheduleVariables,
  replaceRateTable,
  type RateTableDto,
  type ReplaceRateTableRequest,
  type ScheduleVariablesResponse,
} from '../../api/pcSchedule';
import { queryKeys } from '../../queryClient';

/* ======================================================================= */
/*  Domain types                                                            */
/* ======================================================================= */

type AxisKind = 'CONTINUOUS' | 'DATE' | 'STRING' | 'DISCRETE';

export interface ParsedTable {
  id: string;
  /** Filename without extension — becomes the tab label. */
  name: string;
  headers: string[];
  rows: string[][];
  /** True for tables loaded from the server (persisted) — shown read-only. */
  readOnly?: boolean;
  tableGid?: string;
  sourceDto?: RateTableDto;
}

interface EditingAxis {
  variableName: string;
  kind: AxisKind;
  isTopAxis: boolean;
  axisOrder: number;
  depth: number;
}

interface RateTableMeta {
  name: string;
  comment: string;
  startDate: string;
  endDate: string;
}

interface AvailableVariable {
  name: string;
  gid: string;
  kind: AxisKind;
}

/* ======================================================================= */
/*  Axis kind display config                                                */
/* ======================================================================= */

const KIND_LABEL: Record<AxisKind, string> = {
  CONTINUOUS: 'Continuous',
  DISCRETE: 'Discrete',
  DATE: 'Date',
  STRING: 'Text',
};

const KIND_COLOR: Record<AxisKind, 'primary' | 'default' | 'success' | 'warning'> = {
  CONTINUOUS: 'primary',
  DISCRETE: 'default',
  DATE: 'success',
  STRING: 'warning',
};

/* ======================================================================= */
/*  Exported helpers                                                        */
/* ======================================================================= */

export const toRateTableGrids = (
  tables: ParsedTable[],
): Array<{ name: string; grid: string[][] }> =>
  tables.map((t) => ({ name: t.name, grid: [t.headers, ...t.rows] }));

export const summariseTableNames = (tables: ParsedTable[]): string => {
  if (tables.length === 0) return '';
  if (tables.length === 1) return tables[0].name;
  if (tables.length <= 3) return tables.map((t) => t.name).join(' + ');
  return `${tables[0].name} + ${tables.length - 1} more`;
};

/* ======================================================================= */
/*  Private helpers                                                         */
/* ======================================================================= */

/** Only Excel workbooks are accepted — CSV (and anything else) is rejected. */
const isExcelFile = (filename: string): boolean => /\.xlsx?$/i.test(filename);

/**
 * Return a name unique against `taken` (case-insensitive). On a collision it
 * appends `_1`, `_2`, … so a re-uploaded file shows as `Filename_1`, `Filename_2`.
 */
const makeUniqueName = (base: string, taken: Set<string>): string => {
  if (!taken.has(base.toLowerCase())) return base;
  let n = 1;
  while (taken.has(`${base}_${n}`.toLowerCase())) n++;
  return `${base}_${n}`;
};

/** Classify a free-form variable name into a kind using name-pattern heuristics. */
const classifyVariableKind = (name: string): AxisKind => {
  const n = name.toLowerCase().replace(/[\s_-]/g, '');
  if (/date|dob|birth|effective|expiry|expir|inception|issued|start|end/.test(n)) return 'DATE';
  if (/age|count|amount|price|rate|qty|quantity|duration|weight|score|num|ratio|percent|factor|limit|deductible|premium/.test(n)) return 'CONTINUOUS';
  if (/code|type|category|status|class|kind|level|tier|group|segment|plan|product|state|zone|region|event/.test(n)) return 'DISCRETE';
  return 'STRING';
};

const rateTableToParsedTable = (t: RateTableDto): ParsedTable => {
  const axes = [...t.axes].sort((a, b) => a.axisOrder - b.axisOrder);
  const headers = [...axes.map((a) => a.variableName), 'Value'];
  const rows = t.cells.map((cell) => {
    const byVar = new Map(cell.coords.map((c) => [c.variableName, c.byName]));
    return [...axes.map((a) => byVar.get(a.variableName) ?? ''), String(cell.value)];
  });
  return {
    id: `saved-${t.gid}`,
    name: t.name,
    headers,
    rows,
    readOnly: true,
    tableGid: t.gid,
    sourceDto: t,
  };
};

const buildReplaceRequest = (
  edited: ParsedTable,
  meta: RateTableMeta,
  axes: EditingAxis[],
): ReplaceRateTableRequest => {
  const valueColIdx = edited.headers.lastIndexOf('Value');
  const assignedAxes = axes.filter((ax) => ax.variableName);
  const requestAxes = assignedAxes.map((ax) => ({
    kind: ax.kind,
    variableRef: { byName: ax.variableName },
    isTopAxis: ax.isTopAxis,
    axisOrder: ax.axisOrder,
    depth: ax.depth,
  }));
  const cells = edited.rows
    .filter((row) => row.some((c) => c !== ''))
    .map((row) => ({
      coords: assignedAxes.map((ax, i) => ({
        axisOrder: ax.axisOrder,
        byName: row[i] ?? '',
      })),
      value: parseFloat(row[valueColIdx] ?? '0') || 0,
    }));
  return {
    name: meta.name,
    comment: meta.comment || null,
    cellType: 'NUMERIC',
    startDate: meta.startDate,
    endDate: meta.endDate,
    axes: requestAxes,
    cells,
  };
};

const flattenVariables = (data: ScheduleVariablesResponse | undefined): AvailableVariable[] => {
  if (!data) return [];
  return [
    ...(data.continuous ?? []).map((v) => ({ name: v.name, gid: v.gid, kind: 'CONTINUOUS' as AxisKind })),
    ...(data.date ?? []).map((v) => ({ name: v.name, gid: v.gid, kind: 'DATE' as AxisKind })),
    ...(data.string ?? []).map((v) => ({ name: v.name, gid: v.gid, kind: 'STRING' as AxisKind })),
    ...(data.discrete ?? []).map((v) => ({ name: v.name, gid: v.gid, kind: 'DISCRETE' as AxisKind })),
  ];
};

const stripExtension = (filename: string): string =>
  filename.replace(/\.[^./\\]+$/, '');

const parseWorkbook = async (file: File): Promise<ParsedTable[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const base = stripExtension(file.name);
  const parsed: ParsedTable[] = [];
  workbook.SheetNames.forEach((sheetName, sheetIdx) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: '',
    });
    if (rows.length === 0) return;
    const rawHeaderRow = (rows[0] ?? []).map(cellToString);
    const rawBodyRows = rows.slice(1).map((r) => r.map(cellToString));
    while (rawBodyRows.length > 0 && rawBodyRows[rawBodyRows.length - 1].every((c) => c === '')) {
      rawBodyRows.pop();
    }
    if (rawBodyRows.length === 0 && rawHeaderRow.every((c) => c === '')) return;
    const maxCols = Math.max(rawHeaderRow.length, ...rawBodyRows.map((r) => r.length), 0);
    const padRight = (arr: string[]): string[] =>
      arr.length >= maxCols ? arr : [...arr, ...Array.from({ length: maxCols - arr.length }, () => '')];
    parsed.push({
      id: `${file.name}-${sheetIdx}-${crypto.randomUUID()}`,
      name: workbook.SheetNames.length > 1 ? `${base} — ${sheetName}` : base,
      headers: padRight(rawHeaderRow),
      rows: rawBodyRows.map(padRight),
    });
  });
  return parsed;
};

const cellToString = (v: unknown): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') return v.trim();
  return String(v);
};

/* ======================================================================= */
/*  RateTableStep                                                           */
/* ======================================================================= */

interface RateTableStepProps {
  scheduleId: number | null;
  scheduleGid?: string | null;
  uploadedFileName: string | null;
  onFileSelected: (name: string) => void;
  onTablesChange?: (tables: ParsedTable[]) => void;
  onUpload?: () => void;
  onTablesAvailableChange?: (available: boolean) => void;
  initialTables?: ParsedTable[];
}

const RateTableStep = ({
  scheduleGid,
  uploadedFileName,
  onFileSelected,
  onTablesChange,
  onUpload,
  onTablesAvailableChange,
  initialTables,
}: RateTableStepProps) => {
  const [tables, setTables] = useState<ParsedTable[]>(() => initialTables ?? []);
  const [activeId, setActiveId] = useState<string | null>(() => initialTables?.[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit-mode state
  const [editingGid, setEditingGid] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<ParsedTable | null>(null);
  const [editingMeta, setEditingMeta] = useState<RateTableMeta | null>(null);
  const [editingAxes, setEditingAxes] = useState<EditingAxis[] | null>(null);

  const queryClient = useQueryClient();

  const { data: savedData } = useQuery({
    queryKey: scheduleGid
      ? queryKeys.scheduleSetup.rateTables(scheduleGid)
      : ['schedule-setup', 'rate-tables', 'noop'],
    queryFn: () => getScheduleRateTables(scheduleGid!),
    enabled: !!scheduleGid,
    refetchOnMount: 'always',
  });

  const { data: variablesData } = useQuery({
    queryKey: scheduleGid
      ? queryKeys.scheduleSetup.variables(scheduleGid)
      : ['schedule-setup', 'variables', 'noop'],
    queryFn: () => getScheduleVariables(scheduleGid!),
    enabled: !!scheduleGid && !!editingGid,
  });

  const allVariables = useMemo(() => flattenVariables(variablesData), [variablesData]);

  const savedTables = useMemo(
    () => (savedData?.rateTables ?? []).map(rateTableToParsedTable),
    [savedData],
  );

  const hasStructuralChange = useMemo(() => {
    if (!editingAxes || !editingData?.sourceDto) return false;
    const orig = [...editingData.sourceDto.axes].sort((a, b) => a.axisOrder - b.axisOrder);
    if (editingAxes.length !== orig.length) return true;
    return editingAxes.some((ax, i) => ax.kind !== orig[i]?.kind);
  }, [editingAxes, editingData]);

  const replaceMutation = useMutation({
    mutationFn: ({ tableGid, body }: { tableGid: string; body: ReplaceRateTableRequest }) =>
      replaceRateTable(tableGid, body),
    onSuccess: (result) => {
      if (scheduleGid) {
        queryClient.invalidateQueries({ queryKey: queryKeys.scheduleSetup.rateTables(scheduleGid) });
      }
      setEditingGid(null);
      setEditingData(null);
      setEditingMeta(null);
      setEditingAxes(null);
      setToast({
        message: `Saved — ${result.cellsWritten} cell${result.cellsWritten !== 1 ? 's' : ''} written`,
        severity: 'success',
      });
    },
    onError: () => {
      setToast({ message: 'Failed to save rate table. Please try again.', severity: 'error' });
    },
  });

  const displayTables = useMemo(() => {
    const effectiveSaved =
      editingGid && editingData
        ? savedTables.map((t) =>
            t.tableGid === editingGid ? { ...editingData, readOnly: false } : t,
          )
        : savedTables;
    const savedNames = new Set(effectiveSaved.map((t) => t.name.trim().toLowerCase()));
    const uploadsNotSaved = tables.filter((t) => !savedNames.has(t.name.trim().toLowerCase()));
    return [...effectiveSaved, ...uploadsNotSaved];
  }, [savedTables, tables, editingGid, editingData]);

  const active = displayTables.find((t) => t.id === activeId) ?? displayTables[0] ?? null;
  const activeIsEditing = !!active?.tableGid && active.tableGid === editingGid;

  useEffect(() => {
    onTablesAvailableChange?.(displayTables.length > 0);
  }, [displayTables.length, onTablesAvailableChange]);

  /* ---- upload handlers ----------------------------------------------- */

  const updateTables = (next: ParsedTable[]) => {
    setTables(next);
    onTablesChange?.(next);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const files = Array.from(fileList);
    const accepted = files.filter((f) => isExcelFile(f.name));
    const rejected = files.filter((f) => !isExcelFile(f.name));
    if (rejected.length > 0) {
      setError(
        `Only .xlsx / .xls files are supported. Skipped: ${rejected.map((f) => f.name).join(', ')}`,
      );
    }
    if (accepted.length === 0) return;

    const parsedAll: ParsedTable[] = [];
    try {
      for (const file of accepted) {
        const parsed = await parseWorkbook(file);
        if (parsed.length === 0) { setError(`No sheets found in ${file.name}`); continue; }
        parsedAll.push(...parsed);
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to parse workbook');
      return;
    }
    if (parsedAll.length === 0) return;

    const taken = new Set<string>([
      ...tables.map((t) => t.name.toLowerCase()),
      ...savedTables.map((t) => t.name.toLowerCase()),
    ]);
    const named = parsedAll.map((t) => {
      const uniqueName = makeUniqueName(t.name, taken);
      taken.add(uniqueName.toLowerCase());
      return { ...t, name: uniqueName };
    });

    updateTables([...tables, ...named]);
    setActiveId((prev) => prev ?? named[0].id);
    onFileSelected(named[0].name);
    onUpload?.();
  };

  const removeTable = (id: string) => {
    setTables((prev) => {
      const next = prev.filter((t) => t.id !== id);
      onTablesChange?.(next);
      if (next.length === 0) onFileSelected('');
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const renameTable = (id: string, rawName: string) => {
    const clean = rawName.trim();
    if (!clean) return;
    setTables((prev) => {
      const taken = new Set<string>([
        ...prev.filter((t) => t.id !== id).map((t) => t.name.toLowerCase()),
        ...savedTables.map((t) => t.name.toLowerCase()),
      ]);
      const unique = makeUniqueName(clean, taken);
      const next = prev.map((t) => (t.id === id ? { ...t, name: unique } : t));
      onTablesChange?.(next);
      return next;
    });
  };

  /* ---- edit lifecycle handlers --------------------------------------- */

  const handleEditStart = (tableGid: string) => {
    const saved = savedTables.find((t) => t.tableGid === tableGid);
    if (!saved) return;
    const sortedAxes = [...(saved.sourceDto?.axes ?? [])].sort((a, b) => a.axisOrder - b.axisOrder);
    setEditingAxes(
      sortedAxes.map((ax) => ({
        variableName: ax.variableName,
        kind: ax.kind as AxisKind,
        isTopAxis: ax.isTopAxis,
        axisOrder: ax.axisOrder,
        depth: 1,
      })),
    );
    setEditingData({ ...saved, rows: saved.rows.map((r) => [...r]) });
    setEditingMeta({
      name: saved.sourceDto?.name ?? saved.name,
      comment: saved.sourceDto?.comment ?? '',
      startDate: saved.sourceDto?.startDate ?? '',
      endDate: saved.sourceDto?.endDate ?? '',
    });
    setEditingGid(tableGid);
    setActiveId(saved.id);
  };

  const handleEditCancel = () => {
    setEditingGid(null);
    setEditingData(null);
    setEditingMeta(null);
    setEditingAxes(null);
  };

  const handleEditSave = () => {
    if (!editingGid || !editingData || !editingMeta || !editingAxes) return;
    replaceMutation.mutate({ tableGid: editingGid, body: buildReplaceRequest(editingData, editingMeta, editingAxes) });
  };

  /* ---- cell / row handlers ------------------------------------------- */

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    if (!editingData) return;
    const newRows = editingData.rows.map((r) => [...r]);
    if (!newRows[rowIdx]) newRows[rowIdx] = [];
    newRows[rowIdx][colIdx] = value;
    setEditingData({ ...editingData, rows: newRows });
  };

  const handleAddRow = () => {
    if (!editingData) return;
    const emptyRow = Array<string>(editingData.headers.length).fill('');
    setEditingData({ ...editingData, rows: [...editingData.rows, emptyRow] });
  };

  const handleDeleteRow = (rowIdx: number) => {
    if (!editingData) return;
    setEditingData({ ...editingData, rows: editingData.rows.filter((_, i) => i !== rowIdx) });
  };

  /* ---- axis structural handlers -------------------------------------- */

  const handleChangeAxisVariable = (axisIdx: number, varName: string, kind: AxisKind) => {
    if (!editingData || !editingAxes) return;
    setEditingAxes(editingAxes.map((ax, i) => (i === axisIdx ? { ...ax, variableName: varName, kind } : ax)));
    setEditingData({
      ...editingData,
      headers: editingData.headers.map((h, i) => (i === axisIdx ? varName : h)),
    });
  };

  /** Called when the user commits a free-form name for a new (blank) axis. */
  const handleAxisNameCommit = (axisIdx: number, name: string) => {
    if (!editingData || !editingAxes) return;
    const kind = classifyVariableKind(name);
    setEditingAxes(editingAxes.map((ax, i) => (i === axisIdx ? { ...ax, variableName: name, kind } : ax)));
    setEditingData({
      ...editingData,
      headers: editingData.headers.map((h, i) => (i === axisIdx ? name : h)),
    });
  };

  const handleDeleteAxis = (axisIdx: number) => {
    if (!editingData || !editingAxes) return;
    setEditingAxes(editingAxes.filter((_, i) => i !== axisIdx));
    setEditingData({
      ...editingData,
      headers: editingData.headers.filter((_, i) => i !== axisIdx),
      rows: editingData.rows.map((row) => row.filter((_, i) => i !== axisIdx)),
    });
  };

  const handleAddAxis = () => {
    if (!editingData || !editingAxes) return;
    const newAxisOrder = editingAxes.reduce((max, ax) => Math.max(max, ax.axisOrder), -1) + 1;
    const newAxis: EditingAxis = { variableName: '', kind: 'DISCRETE', isTopAxis: false, axisOrder: newAxisOrder, depth: 1 };
    const valueColIdx = editingData.headers.lastIndexOf('Value');
    setEditingAxes([...editingAxes, newAxis]);
    setEditingData({
      ...editingData,
      headers: [...editingData.headers.slice(0, valueColIdx), '', 'Value'],
      rows: editingData.rows.map((row) => [
        ...row.slice(0, valueColIdx),
        '',
        row[valueColIdx] ?? '',
      ]),
    });
  };

  /* ---- render -------------------------------------------------------- */

  return (
    <Box>
      <DropZone
        variant="outlined"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <UploadFileRoundedIcon color="primary" fontSize="large" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
          Drop your rate table files here
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Multiple files supported · .xlsx, .xls
        </Typography>
        <BrandButton variant="contained" onClick={() => fileInputRef.current?.click()}>
          Browse files
        </BrandButton>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        {uploadedFileName && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Chip
              label={`${tables.length} table${tables.length === 1 ? '' : 's'} loaded`}
              color="primary"
              variant="outlined"
            />
          </Box>
        )}
      </DropZone>

      {error && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="error" variant="outlined">{error}</Alert>
        </Box>
      )}

      {displayTables.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <TabStrip
            tables={displayTables}
            activeId={active?.id ?? null}
            editingGid={editingGid}
            isSaving={replaceMutation.isPending}
            onSelect={setActiveId}
            onRemove={removeTable}
            onRename={renameTable}
            onEdit={handleEditStart}
            onSave={handleEditSave}
            onCancelEdit={handleEditCancel}
          />

          {activeIsEditing && editingMeta && (
            <EditMetaPanel
              meta={editingMeta}
              onChange={(patch) => setEditingMeta((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          )}

          {activeIsEditing && hasStructuralChange && (
            <Alert
              severity="warning"
              icon={<WarningAmberRoundedIcon fontSize="small" />}
              sx={{ mb: 1.5, borderRadius: 2 }}
            >
              Adding, removing, or changing axis types triggers a full axis rebuild on save —
              all existing bucket assignments will be rewritten.
            </Alert>
          )}

          {active && (
            <SheetGrid
              table={active}
              editable={activeIsEditing}
              editingAxes={activeIsEditing ? editingAxes : null}
              allVariables={allVariables}
              onCellChange={handleCellChange}
              onAxisVariableChange={handleChangeAxisVariable}
              onAxisNameCommit={handleAxisNameCommit}
              onAxisDelete={handleDeleteAxis}
              onAddAxis={handleAddAxis}
              onAddRow={handleAddRow}
              onDeleteRow={handleDeleteRow}
            />
          )}
        </Box>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.severity ?? 'info'}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

/* ======================================================================= */
/*  TabStrip                                                                */
/* ======================================================================= */

interface TabStripProps {
  tables: ParsedTable[];
  activeId: string | null;
  editingGid: string | null;
  isSaving: boolean;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onEdit: (tableGid: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
}

const TabStrip = ({
  tables, activeId, editingGid, isSaving,
  onSelect, onRemove, onRename, onEdit, onSave, onCancelEdit,
}: TabStripProps) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startRename = (t: ParsedTable) => { setRenamingId(t.id); setDraft(t.name); };
  const commitRename = (id: string) => { onRename?.(id, draft); setRenamingId(null); };

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
      {tables.map((t) => {
        const isActive = t.id === activeId;
        const isEditing = !!t.tableGid && t.tableGid === editingGid;
        const isRenaming = renamingId === t.id;
        return (
          <Box
            key={t.id}
            onClick={() => !isRenaming && onSelect(t.id)}
            sx={(theme) => ({
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer', border: '1px solid',
              borderColor: isEditing ? theme.palette.warning.main : isActive ? theme.palette.primary.main : 'rgba(15,23,42,0.12)',
              background: isEditing ? 'rgba(245,158,11,0.06)' : isActive ? 'rgba(79,70,229,0.06)' : theme.palette.background.paper,
              color: isEditing ? 'warning.dark' : isActive ? 'primary.main' : 'text.primary',
              fontWeight: isActive || isEditing ? 700 : 500,
              transition: 'all 120ms ease',
            })}
          >
            {isRenaming ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => commitRename(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(t.id);
                  else if (e.key === 'Escape') setRenamingId(null);
                }}
                style={{
                  border: '1px solid #4f46e5', borderRadius: 4, padding: '2px 6px',
                  fontSize: 13, fontFamily: 'inherit', minWidth: 160, outline: 'none',
                }}
              />
            ) : (
              <Typography
                variant="body2"
                sx={{ fontWeight: 'inherit' }}
                onDoubleClick={!t.readOnly && onRename ? (e) => { e.stopPropagation(); startRename(t); } : undefined}
              >
                {t.name}
              </Typography>
            )}

            {/* Saved table — enter edit mode */}
            {t.readOnly && !isEditing && t.tableGid && !isRenaming && (
              <Tooltip title="Edit this rate table">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(t.tableGid!); }}>
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* Currently in edit mode — save / cancel */}
            {isEditing && !isRenaming && (
              <>
                <Tooltip title="Save changes">
                  <span>
                    <IconButton size="small" color="warning" disabled={isSaving} onClick={(e) => { e.stopPropagation(); onSave(); }}>
                      {isSaving ? <CircularProgress size={14} color="inherit" /> : <SaveRoundedIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Cancel editing">
                  <IconButton size="small" disabled={isSaving} onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}>
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}

            {/* Uploaded table — rename + remove */}
            {!t.readOnly && !isEditing && !isRenaming && (
              <>
                {onRename && (
                  <Tooltip title="Rename this table">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); startRename(t); }}>
                      <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {onRemove && (
                  <Tooltip title="Remove this table">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
          </Box>
        );
      })}
    </Paper>
  );
};

/* ======================================================================= */
/*  EditMetaPanel                                                           */
/* ======================================================================= */

interface EditMetaPanelProps {
  meta: RateTableMeta;
  onChange: (patch: Partial<RateTableMeta>) => void;
}

const EditMetaPanel = ({ meta, onChange }: EditMetaPanelProps) => (
  <Paper variant="outlined" sx={{ mb: 1.5, borderColor: 'warning.light', borderRadius: 2, overflow: 'hidden' }}>
    <Box sx={{ px: 2, py: 0.75, bgcolor: 'rgba(245,158,11,0.06)', borderBottom: '1px solid', borderColor: 'warning.light', display: 'flex', alignItems: 'center', gap: 1 }}>
      <EditRoundedIcon sx={{ fontSize: 14, color: 'warning.dark' }} />
      <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 700 }}>Table Details</Typography>
    </Box>
    <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      <TextField
        label="Name" size="small" value={meta.name}
        onChange={(e) => onChange({ name: e.target.value })}
        sx={{ flex: '1 1 200px' }} slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="Comment" size="small" value={meta.comment}
        onChange={(e) => onChange({ comment: e.target.value })}
        sx={{ flex: '2 1 280px' }} slotProps={{ inputLabel: { shrink: true } }}
        placeholder="Optional description"
      />
      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
      <TextField
        label="Start Date" type="date" size="small" value={meta.startDate}
        onChange={(e) => onChange({ startDate: e.target.value })}
        slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }}
      />
      <TextField
        label="End Date" type="date" size="small" value={meta.endDate}
        onChange={(e) => onChange({ endDate: e.target.value })}
        slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }}
      />
    </Box>
  </Paper>
);

/* ======================================================================= */
/*  SheetGrid                                                               */
/* ======================================================================= */

interface SheetGridProps {
  table: ParsedTable;
  editable?: boolean;
  editingAxes?: EditingAxis[] | null;
  allVariables?: AvailableVariable[];
  onCellChange?: (rowIdx: number, colIdx: number, value: string) => void;
  onAxisVariableChange?: (axisIdx: number, varName: string, kind: AxisKind) => void;
  onAxisNameCommit?: (axisIdx: number, name: string) => void;
  onAxisDelete?: (axisIdx: number) => void;
  onAddAxis?: () => void;
  onAddRow?: () => void;
  onDeleteRow?: (rowIdx: number) => void;
}

const SheetGrid = ({
  table,
  editable = false,
  editingAxes,
  allVariables = [],
  onCellChange,
  onAxisVariableChange,
  onAxisNameCommit,
  onAxisDelete,
  onAddAxis,
  onAddRow,
  onDeleteRow,
}: SheetGridProps) => {
  const [axisMenu, setAxisMenu] = useState<{ anchor: HTMLElement; axisIdx: number } | null>(null);

  const valueColIdx = table.headers.lastIndexOf('Value');
  const axisColCount = valueColIdx >= 0 ? valueColIdx : table.headers.length;

  // Same-kind variables available for swapping an already-assigned axis
  const changeCompatibleVars = useMemo(() => {
    if (!axisMenu || !editingAxes) return [];
    const currentAxis = editingAxes[axisMenu.axisIdx];
    const currentName = currentAxis?.variableName;
    if (!currentName) return [];
    const currentKind = currentAxis?.kind;
    const usedNames = new Set(editingAxes.map((ax) => ax.variableName).filter(Boolean));
    return allVariables.filter(
      (v) => v.kind === currentKind && (!usedNames.has(v.name) || v.name === currentName),
    );
  }, [axisMenu, editingAxes, allVariables]);

  const extraCols = editable ? 2 : 0;

  return (
    <SurfaceCard elevation={0}>
      {editable && (
        <Box sx={{ px: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'warning.light', bgcolor: 'rgba(245,158,11,0.04)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditRoundedIcon sx={{ fontSize: 14, color: 'warning.dark' }} />
          <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 600 }}>
            Editing — click axis headers to change variable · click cells to edit values
          </Typography>
        </Box>
      )}

      <TableContainer sx={{ maxHeight: 480 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <StyledTableHeadRow>
              <TableCell sx={{ width: 48 }}>#</TableCell>

              {table.headers.map((h, i) => {
                const isAxisCol = i < axisColCount;
                if (!editable || !isAxisCol) {
                  return <TableCell key={`h-${i}`}>{h}</TableCell>;
                }
                const ax = editingAxes?.[i];

                // Blank new axis → inline free-form text input, AI classifies kind on commit
                if (!h) {
                  return (
                    <TableCell key={`h-${i}`} sx={{ minWidth: 180, p: '4px 8px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                          component="input"
                          autoFocus
                          placeholder="Variable name…"
                          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                            const name = e.target.value.trim();
                            if (name) onAxisNameCommit?.(i, name);
                            else onAxisDelete?.(i);
                          }}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') {
                              const name = e.currentTarget.value.trim();
                              if (name) { onAxisNameCommit?.(i, name); (e.target as HTMLInputElement).blur(); }
                              else onAxisDelete?.(i);
                            }
                            if (e.key === 'Escape') onAxisDelete?.(i);
                          }}
                          sx={{
                            flex: 1, minWidth: 100, px: 1, py: 0.5,
                            border: '1px solid', borderColor: 'warning.main', borderRadius: 1,
                            fontSize: '0.8125rem', fontFamily: 'inherit', fontWeight: 700,
                            outline: 'none', background: 'rgba(245,158,11,0.06)', color: 'text.primary',
                            '&::placeholder': { color: 'text.disabled', fontStyle: 'italic', fontWeight: 400 },
                          }}
                        />
                        <Tooltip title="Cancel">
                          <IconButton size="small" sx={{ width: 20, height: 20 }} onClick={() => onAxisDelete?.(i)}>
                            <CloseRoundedIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  );
                }

                // Assigned axis → show kind chip + name + change/delete controls
                return (
                  <TableCell key={`h-${i}`} sx={{ minWidth: 180, p: '4px 8px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {ax && (
                        <Chip
                          label={KIND_LABEL[ax.kind]}
                          size="small"
                          color={KIND_COLOR[ax.kind]}
                          sx={{ height: 18, fontSize: 10, flexShrink: 0 }}
                        />
                      )}
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, flex: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                        onClick={(e) => setAxisMenu({ anchor: e.currentTarget as HTMLElement, axisIdx: i })}
                      >
                        {h}
                      </Typography>
                      <Tooltip title="Change variable">
                        <IconButton
                          size="small"
                          sx={{ width: 20, height: 20 }}
                          onClick={(e) => setAxisMenu({ anchor: e.currentTarget, axisIdx: i })}
                        >
                          <EditRoundedIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove this axis">
                        <IconButton
                          size="small"
                          sx={{ width: 20, height: 20, '&:hover': { color: 'error.main' } }}
                          onClick={() => onAxisDelete?.(i)}
                        >
                          <CloseRoundedIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                );
              })}

              {/* Add axis button column */}
              {editable && (
                <TableCell sx={{ width: 44, p: '4px' }}>
                  <Tooltip title="Add axis">
                    <IconButton size="small" onClick={() => onAddAxis?.()}>
                      <AddRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}

              {/* Row-delete column header (spacer) */}
              {editable && <TableCell sx={{ width: 40 }} />}
            </StyledTableHeadRow>
          </TableHead>

          <TableBody>
            {table.rows.map((row, r) => (
              <TableRow key={`r-${r}`} hover>
                <TableCell sx={{ color: 'text.secondary' }}>{r + 1}</TableCell>
                {table.headers.map((_, c) => (
                  <TableCell key={`c-${r}-${c}`} sx={editable ? { p: 0 } : undefined}>
                    {editable ? (
                      <EditableGridCell value={row[c] ?? ''} onChange={(v) => onCellChange?.(r, c, v)} />
                    ) : (
                      row[c] ?? ''
                    )}
                  </TableCell>
                ))}
                {editable && <TableCell />}
                {editable && (
                  <TableCell sx={{ p: '2px 4px' }}>
                    <Tooltip title="Delete row">
                      <IconButton
                        size="small"
                        sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                        onClick={() => onDeleteRow?.(r)}
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {editable && (
              <TableRow>
                <TableCell colSpan={table.headers.length + extraCols + 1} sx={{ py: 0.5, px: 1 }}>
                  <Box
                    component="button"
                    onClick={onAddRow}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'text.secondary', fontSize: '0.75rem', fontFamily: 'inherit',
                      px: 1, py: 0.5, borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover', color: 'primary.main' },
                    }}
                  >
                    <AddRoundedIcon sx={{ fontSize: 14 }} />
                    Add row
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {table.rows.length === 0 && !editable && (
              <TableRow>
                <TableCell colSpan={table.headers.length + 1} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                  No data rows in this sheet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Change variable menu — for already-assigned axes (same-kind swap) */}
      <Menu
        anchorEl={axisMenu?.anchor ?? null}
        open={!!axisMenu}
        onClose={() => setAxisMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 260 } } }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {axisMenu && editingAxes?.[axisMenu.axisIdx]
              ? `Swap to another ${KIND_LABEL[editingAxes[axisMenu.axisIdx].kind]} variable`
              : ''}
          </Typography>
        </MenuItem>
        {changeCompatibleVars.length === 0 ? (
          <MenuItem disabled>No variables available</MenuItem>
        ) : (
          changeCompatibleVars.map((v) => (
            <MenuItem
              key={v.gid}
              selected={axisMenu ? editingAxes?.[axisMenu.axisIdx]?.variableName === v.name : false}
              onClick={() => {
                if (axisMenu) onAxisVariableChange?.(axisMenu.axisIdx, v.name, v.kind);
                setAxisMenu(null);
              }}
            >
              <Chip
                label={KIND_LABEL[v.kind]}
                size="small"
                color={KIND_COLOR[v.kind]}
                sx={{ height: 18, fontSize: 10, mr: 1, minWidth: 68 }}
              />
              <ListItemText primary={v.name} />
            </MenuItem>
          ))
        )}
      </Menu>
    </SurfaceCard>
  );
};

/* ======================================================================= */
/*  EditableGridCell                                                        */
/* ======================================================================= */

interface EditableGridCellProps {
  value: string;
  onChange: (value: string) => void;
}

const EditableGridCell = ({ value, onChange }: EditableGridCellProps) => {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = (next: string) => {
    if (next !== value) onChange(next);
  };

  return (
    <Box
      component="input"
      value={draft}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => { setFocused(false); commit(e.target.value); }}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { commit(draft); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      sx={{
        display: 'block', width: '100%', minWidth: 80, px: 1, py: 0.75,
        border: 'none',
        outline: focused ? '2px solid' : 'none',
        outlineColor: 'warning.main',
        outlineOffset: '-2px',
        background: focused ? 'rgba(245,158,11,0.08)' : 'transparent',
        fontSize: '0.8125rem', fontFamily: 'inherit', color: 'inherit',
        cursor: 'text', boxSizing: 'border-box', transition: 'background 100ms ease',
        '&:hover': { background: focused ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)' },
      }}
    />
  );
};

export default RateTableStep;
