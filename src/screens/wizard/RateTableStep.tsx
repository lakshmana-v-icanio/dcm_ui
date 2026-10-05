import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Pencil, Save, X, Plus, Trash2, PenLine, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Snackbar } from '../../components/ui/Snackbar';
import { Spinner } from '../../components/ui/Spinner';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/cn';
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
  name: string;
  headers: string[];
  rows: string[][];
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

const KIND_BADGE: Record<AxisKind, string> = {
  CONTINUOUS: 'bg-blue-100 text-blue-700',
  DISCRETE: 'bg-slate-100 text-slate-600',
  DATE: 'bg-green-100 text-green-700',
  STRING: 'bg-amber-100 text-amber-700',
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

const isExcelFile = (filename: string): boolean => /\.xlsx?$/i.test(filename);

const makeUniqueName = (base: string, taken: Set<string>): string => {
  if (!taken.has(base.toLowerCase())) return base;
  let n = 1;
  while (taken.has(`${base}_${n}`.toLowerCase())) n++;
  return `${base}_${n}`;
};

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
    const rawBodyRows = rows.slice(1).map((r) => (r as unknown[]).map(cellToString));
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
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center text-center bg-slate-50 hover:bg-blue-50/30 hover:border-primary-600 transition-colors cursor-default"
      >
        <Upload className="w-10 h-10 text-primary-600 mb-2" />
        <p className="text-sm font-semibold text-slate-800 mt-1">Drop your rate table files here</p>
        <p className="text-xs text-slate-500 mt-1 mb-4">Multiple files supported · .xlsx, .xls</p>
        <Button variant="contained" onClick={() => fileInputRef.current?.click()}>
          Browse files
        </Button>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        {uploadedFileName && (
          <div className="mt-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              {tables.length} table{tables.length === 1 ? '' : 's'} loaded
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <Alert severity="error" variant="outlined">{error}</Alert>
        </div>
      )}

      {displayTables.length > 0 && (
        <div className="mt-3">
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
            <Alert severity="warning" icon={<AlertTriangle className="w-4 h-4" />} className="mb-2">
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
        </div>
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
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </div>
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
    <div className="border border-slate-200 rounded-xl p-3 mb-2 flex flex-wrap gap-2 items-center bg-white">
      {tables.map((t) => {
        const isActive = t.id === activeId;
        const isEditing = !!t.tableGid && t.tableGid === editingGid;
        const isRenaming = renamingId === t.id;
        return (
          <div
            key={t.id}
            onClick={() => !isRenaming && onSelect(t.id)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer border text-sm transition-all',
              isEditing
                ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold'
                : isActive
                ? 'border-primary-600 bg-blue-50 text-primary-600 font-bold'
                : 'border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-300',
            )}
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
                className="border border-primary-600 rounded px-1.5 py-0.5 text-xs font-normal min-w-[160px] outline-none focus:ring-2 focus:ring-primary-600/20"
              />
            ) : (
              <span
                onDoubleClick={!t.readOnly && onRename ? (e) => { e.stopPropagation(); startRename(t); } : undefined}
              >
                {t.name}
              </span>
            )}

            {/* Saved table — enter edit mode */}
            {t.readOnly && !isEditing && t.tableGid && !isRenaming && (
              <Tooltip title="Edit this rate table">
                <button
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                  onClick={(e) => { e.stopPropagation(); onEdit(t.tableGid!); }}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </Tooltip>
            )}

            {/* Currently in edit mode — save / cancel */}
            {isEditing && !isRenaming && (
              <>
                <Tooltip title="Save changes">
                  <button
                    disabled={isSaving}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-amber-100 text-amber-700 disabled:opacity-50"
                    onClick={(e) => { e.stopPropagation(); onSave(); }}
                  >
                    {isSaving ? <Spinner size={12} /> : <Save className="w-3 h-3" />}
                  </button>
                </Tooltip>
                <Tooltip title="Cancel editing">
                  <button
                    disabled={isSaving}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50"
                    onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Tooltip>
              </>
            )}

            {/* Uploaded table — rename + remove */}
            {!t.readOnly && !isEditing && !isRenaming && (
              <>
                {onRename && (
                  <Tooltip title="Rename this table">
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                      onClick={(e) => { e.stopPropagation(); startRename(t); }}
                    >
                      <PenLine className="w-3 h-3" />
                    </button>
                  </Tooltip>
                )}
                {onRemove && (
                  <Tooltip title="Remove this table">
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
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
  <div className="mb-2 border border-amber-200 rounded-xl overflow-hidden">
    <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
      <Pencil className="w-3 h-3 text-amber-700" />
      <span className="text-xs font-bold text-amber-800">Table Details</span>
    </div>
    <div className="p-3 flex flex-wrap gap-3 bg-white">
      <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <span className="text-xs font-medium text-slate-600">Name</span>
        <input
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
          value={meta.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 flex-[2_1_280px]">
        <span className="text-xs font-medium text-slate-600">Comment</span>
        <input
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
          value={meta.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          placeholder="Optional description"
        />
      </label>
      <div className="hidden sm:block w-px bg-slate-200 self-stretch" />
      <label className="flex flex-col gap-1 w-40">
        <span className="text-xs font-medium text-slate-600">Start Date</span>
        <input
          type="date"
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
          value={meta.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 w-40">
        <span className="text-xs font-medium text-slate-600">End Date</span>
        <input
          type="date"
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
          value={meta.endDate}
          onChange={(e) => onChange({ endDate: e.target.value })}
        />
      </label>
    </div>
  </div>
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
  const [axisMenu, setAxisMenu] = useState<{ axisIdx: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const valueColIdx = table.headers.lastIndexOf('Value');
  const axisColCount = valueColIdx >= 0 ? valueColIdx : table.headers.length;

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

  // Close menu on outside click
  useEffect(() => {
    if (!axisMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAxisMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [axisMenu]);

  const extraCols = editable ? 2 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {editable && (
        <div className="px-3 py-2 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
          <Pencil className="w-3 h-3 text-amber-700" />
          <span className="text-xs font-semibold text-amber-800">
            Editing — click axis headers to change variable · click cells to edit values
          </span>
        </div>
      )}

      <div className="overflow-auto max-h-[480px]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-primary-600 text-white">
              <th className="px-3 py-2 text-left font-semibold w-12 text-xs">#</th>

              {table.headers.map((h, i) => {
                const isAxisCol = i < axisColCount;
                if (!editable || !isAxisCol) {
                  return (
                    <th key={`h-${i}`} className="px-3 py-2 text-left font-semibold text-xs whitespace-nowrap">
                      {h}
                    </th>
                  );
                }
                const ax = editingAxes?.[i];

                // Blank new axis → inline free-form text input
                if (!h) {
                  return (
                    <th key={`h-${i}`} className="px-2 py-1 min-w-[180px]">
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          placeholder="Variable name…"
                          onBlur={(e) => {
                            const name = e.target.value.trim();
                            if (name) onAxisNameCommit?.(i, name);
                            else onAxisDelete?.(i);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const name = e.currentTarget.value.trim();
                              if (name) { onAxisNameCommit?.(i, name); (e.target as HTMLInputElement).blur(); }
                              else onAxisDelete?.(i);
                            }
                            if (e.key === 'Escape') onAxisDelete?.(i);
                          }}
                          className="flex-1 min-w-[100px] px-2 py-0.5 border border-amber-400 rounded text-xs font-bold bg-amber-50/80 text-slate-900 outline-none placeholder:text-slate-400 placeholder:italic placeholder:font-normal"
                        />
                        <button
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 text-white/80"
                          onClick={() => onAxisDelete?.(i)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  );
                }

                // Assigned axis → show kind badge + name + change/delete controls
                return (
                  <th key={`h-${i}`} className="px-2 py-1 min-w-[180px] relative">
                    <div className="flex items-center gap-1">
                      {ax && (
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0', KIND_BADGE[ax.kind])}>
                          {KIND_LABEL[ax.kind]}
                        </span>
                      )}
                      <span
                        className="text-xs font-bold flex-1 cursor-pointer hover:text-blue-200 truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAxisMenu((prev) => prev?.axisIdx === i ? null : { axisIdx: i });
                        }}
                      >
                        {h}
                      </span>
                      <button
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 text-white/80"
                        onClick={(e) => { e.stopPropagation(); setAxisMenu((prev) => prev?.axisIdx === i ? null : { axisIdx: i }); }}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-400/30 text-white/80 hover:text-white"
                        onClick={() => onAxisDelete?.(i)}
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Axis variable dropdown */}
                      {axisMenu?.axisIdx === i && (
                        <div
                          ref={menuRef}
                          className="absolute top-full left-0 z-50 mt-1 min-w-[260px] bg-white border border-slate-200 rounded-xl shadow-lg py-1"
                        >
                          <div className="px-3 py-1.5 border-b border-slate-100">
                            <span className="text-xs font-semibold text-slate-500">
                              {ax ? `Swap to another ${KIND_LABEL[ax.kind]} variable` : ''}
                            </span>
                          </div>
                          {changeCompatibleVars.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400">No variables available</div>
                          ) : (
                            changeCompatibleVars.map((v) => (
                              <button
                                key={v.gid}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors',
                                  axisMenu && editingAxes?.[axisMenu.axisIdx]?.variableName === v.name ? 'bg-blue-50' : '',
                                )}
                                onClick={() => {
                                  if (axisMenu) onAxisVariableChange?.(axisMenu.axisIdx, v.name, v.kind);
                                  setAxisMenu(null);
                                }}
                              >
                                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold min-w-[68px] text-center', KIND_BADGE[v.kind])}>
                                  {KIND_LABEL[v.kind]}
                                </span>
                                <span className="text-slate-700">{v.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}

              {editable && (
                <th className="w-11 px-1 py-1 text-center">
                  <Tooltip title="Add axis">
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/20 text-white/80 hover:text-white mx-auto"
                      onClick={() => onAddAxis?.()}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </th>
              )}

              {editable && <th className="w-10" />}
            </tr>
          </thead>

          <tbody>
            {table.rows.map((row, r) => (
              <tr key={`r-${r}`} className="hover:bg-slate-50 border-b border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-400 font-tabular">{r + 1}</td>
                {table.headers.map((_, c) => (
                  <td key={`c-${r}-${c}`} className={editable ? 'p-0' : 'px-3 py-2 text-sm text-slate-700'}>
                    {editable ? (
                      <EditableGridCell value={row[c] ?? ''} onChange={(v) => onCellChange?.(r, c, v)} />
                    ) : (
                      row[c] ?? ''
                    )}
                  </td>
                ))}
                {editable && <td />}
                {editable && (
                  <td className="px-1 py-1">
                    <Tooltip title="Delete row">
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50"
                        onClick={() => onDeleteRow?.(r)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </td>
                )}
              </tr>
            ))}

            {editable && (
              <tr>
                <td colSpan={table.headers.length + extraCols + 1} className="px-2 py-1">
                  <button
                    onClick={onAddRow}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary-600 hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add row
                  </button>
                </td>
              </tr>
            )}

            {table.rows.length === 0 && !editable && (
              <tr>
                <td colSpan={table.headers.length + 1} className="px-3 py-8 text-center text-sm text-slate-400">
                  No data rows in this sheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { setFocused(false); commit(e.target.value); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(draft); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      className={cn(
        'block w-full min-w-[80px] px-2 py-1.5 border-0 outline-none text-xs font-tabular cursor-text box-border transition-colors',
        focused
          ? 'ring-2 ring-inset ring-amber-400 bg-amber-50/80'
          : 'bg-transparent hover:bg-amber-50/40',
      )}
    />
  );
};

export default RateTableStep;
