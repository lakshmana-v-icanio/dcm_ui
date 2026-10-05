import { useRef, useState } from 'react';
import { Plus, Upload, Trash2, GripVertical, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Snackbar } from '../../components/ui/Snackbar';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/cn';

interface RateTable {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  cols: number;
  rows: number;
  cells: string[][];
  headers: string[];
}

const DEFAULT_COLS = 5;
const DEFAULT_ROWS = 10;
const ADD_ROWS_STEP = 5;
const END_OF_TIME = '2300-01-01';

const emptyGrid = (rows: number, cols: number): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
const defaultHeaders = (cols: number): string[] => Array.from({ length: cols }, () => '');
const makeRateTable = (index: number): RateTable => ({
  id: `rt-${Date.now()}-${index}`,
  name: `New Rate Table ${index}`,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: END_OF_TIME,
  cols: DEFAULT_COLS,
  rows: DEFAULT_ROWS,
  cells: emptyGrid(DEFAULT_ROWS, DEFAULT_COLS),
  headers: defaultHeaders(DEFAULT_COLS),
});

interface RateTableTabProps {
  onNext?: (rows: Record<string, string>[]) => void;
  nextLoading?: boolean;
}

const RateTableTab = ({ onNext, nextLoading = false }: RateTableTabProps) => {
  const [tables, setTables] = useState<RateTable[]>([makeRateTable(1)]);
  const [activeId, setActiveId] = useState<string>(tables[0].id);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [focused, setFocused] = useState<{ row: number; col: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = tables.find((t) => t.id === activeId) ?? tables[0];

  const addRateTable = () => {
    const next = makeRateTable(tables.length + 1);
    setTables((prev) => [...prev, next]);
    setActiveId(next.id);
  };

  const deleteRateTable = (id: string) => {
    setTables((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const fresh = makeRateTable(1);
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(remaining[0].id);
      return remaining;
    });
  };

  const updateActive = (patch: Partial<RateTable>) =>
    setTables((prev) => prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));

  const addColumn = () => {
    updateActive({ cols: active.cols + 1, cells: active.cells.map((r) => [...r, '']), headers: [...active.headers, ''] });
  };
  const addRows = () => {
    const extra = Array.from({ length: ADD_ROWS_STEP }, () => Array.from({ length: active.cols }, () => ''));
    updateActive({ rows: active.rows + ADD_ROWS_STEP, cells: [...active.cells, ...extra] });
  };

  const setHeader = (col: number, value: string) => {
    const next = [...active.headers]; next[col] = value; updateActive({ headers: next });
  };

  const handleNext = () => {
    if (!onNext) return;
    const headers = active.headers;
    const cellAt = (r: number, c: number) => (active.cells?.[r]?.[c] ?? '').trim();
    const activeCols: number[] = [];
    for (let c = 0; c < active.cols; c++) {
      for (let r = 0; r < active.rows; r++) { if (cellAt(r, c) !== '') { activeCols.push(c); break; } }
    }
    if (activeCols.length === 0) { setToast('Add at least one filled cell before continuing'); return; }
    const [labelCol, ...valueCols] = activeCols;
    const rowDimNameCell = cellAt(0, labelCol);
    const row1OtherColsEmpty = valueCols.length > 0 && valueCols.every((c) => cellAt(0, c) === '');
    let laterRowsInLabelColHaveData = false;
    for (let r = 1; r < active.rows; r++) { if (cellAt(r, labelCol) !== '') { laterRowsInLabelColHaveData = true; break; } }
    const isPivot = rowDimNameCell !== '' && row1OtherColsEmpty && laterRowsInLabelColHaveData && valueCols.length >= 1;
    const rows: Record<string, string>[] = [];
    if (isPivot) {
      const rowDimName = rowDimNameCell;
      const colDimName = (headers[labelCol] ?? '').trim();
      for (let r = 1; r < active.rows; r++) {
        const rowVal = cellAt(r, labelCol);
        if (rowVal === '') continue;
        for (const c of valueCols) {
          const val = cellAt(r, c); if (val === '') continue;
          const colVal = (headers[c] ?? '').trim();
          const entry: Record<string, string> = { [rowDimName]: rowVal, Value: val };
          if (colDimName !== '') entry[colDimName] = colVal;
          rows.push(entry);
        }
      }
    } else {
      for (let r = 0; r < active.rows; r++) {
        const row: Record<string, string> = {}; let rowHasAny = false;
        for (const c of activeCols) {
          const val = cellAt(r, c); if (val !== '') rowHasAny = true;
          const key = (headers[c] ?? '').trim(); if (key !== '') row[key] = val;
        }
        if (rowHasAny) rows.push(row);
      }
    }
    if (rows.length === 0) { setToast('Add at least one filled cell before continuing'); return; }
    onNext(rows);
  };

  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let current: string[] = []; let field = ''; let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { current.push(field); field = ''; }
        else if (ch === '\r') { /* skip */ }
        else if (ch === '\n') { current.push(field); rows.push(current); current = []; field = ''; }
        else { field += ch; }
      }
    }
    if (field !== '' || current.length > 0) { current.push(field); rows.push(current); }
    if (rows.length > 0 && rows[rows.length - 1].every((v) => v === '')) rows.pop();
    return rows;
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length === 0) { setToast('CSV appears to be empty'); return; }
      const [headerRow, ...dataRows] = grid;
      const cols = headerRow.length;
      const rowsCount = Math.max(dataRows.length, DEFAULT_ROWS);
      const cells: string[][] = [];
      for (let r = 0; r < rowsCount; r++) {
        const src = dataRows[r] ?? []; const row: string[] = [];
        for (let c = 0; c < cols; c++) row.push((src[c] ?? '').trim());
        cells.push(row);
      }
      updateActive({ cols, rows: rowsCount, headers: headerRow.map((h) => (h ?? '').trim()), cells });
      setFocused(null);
      setToast(`Loaded ${dataRows.length} row(s) × ${cols} column(s) from ${file.name}`);
    } catch (err: unknown) { setToast((err as { message?: string }).message ?? 'Failed to read CSV'); }
  };

  const setCell = (row: number, col: number, value: string) => {
    const nextCells = active.cells.map((r) => [...r]);
    while (nextCells.length < active.rows) nextCells.push([]);
    while (nextCells[row].length < active.cols) nextCells[row].push('');
    nextCells[row][col] = value;
    updateActive({ cells: nextCells });
  };

  const getCell = (row: number, col: number): string => active.cells?.[row]?.[col] ?? '';

  const parseClipboardGrid = (text: string): string[][] => {
    const trimmed = text.replace(/\r?\n$/, '');
    return trimmed.split(/\r?\n/).map((line) => line.split('\t'));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!focused) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    const raw = e.clipboardData.getData('text'); if (!raw) return;
    const grid = parseClipboardGrid(raw); if (grid.length === 0) return;
    e.preventDefault();
    const startRow = focused.row; const startCol = focused.col;
    const rowsNeeded = startRow + grid.length;
    const colsNeeded = startCol + Math.max(...grid.map((r) => r.length));
    const nextCells: string[][] = active.cells.map((r) => [...r]);
    while (nextCells.length < rowsNeeded) nextCells.push(Array.from({ length: active.cols }, () => ''));
    for (let r = 0; r < nextCells.length; r++) {
      while (nextCells[r].length < Math.max(active.cols, colsNeeded)) nextCells[r].push('');
    }
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) { nextCells[startRow + r][startCol + c] = grid[r][c]; }
    }
    const nextHeaders = [...active.headers];
    while (nextHeaders.length < colsNeeded) {
      const lastIdx = nextHeaders.length - 1;
      if (nextHeaders.length > 0 && nextHeaders[lastIdx] === 'Value') { nextHeaders.splice(lastIdx, 0, `Column ${nextHeaders.length}`); }
      else { nextHeaders.push(nextHeaders.length === colsNeeded - 1 ? 'Value' : `Column ${nextHeaders.length + 1}`); }
    }
    updateActive({ rows: Math.max(active.rows, rowsNeeded), cols: Math.max(active.cols, colsNeeded), cells: nextCells, headers: nextHeaders });
    setToast(`Pasted ${grid.length} row(s) × ${grid[0]?.length ?? 0} col(s)`);
  };

  const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!focused) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', getCell(focused.row, focused.col));
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex gap-2 mb-3">
        <Button size="small" variant="text" color="primary" startIcon={<Plus className="w-4 h-4" />} onClick={addRateTable}>Add Rate Table</Button>
        <Button size="small" variant="text" color="primary" startIcon={<Upload className="w-4 h-4" />} onClick={handleUploadClick}>Upload CSV</Button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChosen} />
      </div>

      {/* Tab strip */}
      <div className="border border-slate-200 rounded-xl p-3 mb-4">
        <p className="text-xs text-slate-500 mb-2">Click selected tab to edit name</p>
        <div className="flex items-center gap-2 flex-wrap">
          {tables.map((t) => {
            const isActive = t.id === activeId;
            const isRenaming = renamingId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => { if (isActive && !isRenaming) setRenamingId(t.id); else setActiveId(t.id); }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer border text-sm font-medium transition-all',
                  isActive ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                )}
              >
                {isRenaming ? (
                  <input
                    autoFocus
                    value={t.name}
                    onChange={(e) => setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
                    onBlur={() => setRenamingId(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRenamingId(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm border-none outline-none bg-transparent min-w-[120px] w-full"
                  />
                ) : (
                  <span>{t.name}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRateTable(t.id); }}
                  className={cn('p-0.5 rounded transition-colors', isActive ? 'text-primary-400 hover:text-error-600' : 'text-slate-400 hover:text-error-600')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          <div className="flex-1" />
          <button className="p-1.5 text-slate-300 rounded" title="Reorder (coming soon)">
            <GripVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Start / End dates */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="text-sm font-bold text-slate-700 min-w-[200px]">Rate Table Start and End Date:</span>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs font-medium text-slate-700">Start Date</label>
          <input type="date" className="border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600" value={active.startDate} onChange={(e) => updateActive({ startDate: e.target.value })} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs font-medium text-slate-700">End Date</label>
          <input type="date" className="border border-slate-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600" value={active.endDate} onChange={(e) => updateActive({ endDate: e.target.value })} />
        </div>
      </div>

      {/* Grid */}
      <div
        className="border border-slate-200 rounded-xl overflow-hidden outline-none"
        tabIndex={0}
        onPaste={handlePaste}
        onCopy={handleCopy}
      >
        <div className="relative">
          <button
            onClick={addColumn}
            className="absolute top-2 right-2 z-10 text-xs px-2 py-1 border border-primary-200 bg-white text-primary-600 rounded-full hover:bg-primary-50 hover:border-primary-600 transition-colors"
          >
            + 1 col
          </button>
          <div className="overflow-x-auto scrollbar-thin">
            <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `56px repeat(${active.cols}, minmax(180px, 1fr))` }}>
              {/* Header row */}
              <div className="h-10 bg-white border-b border-r border-slate-100" />
              {Array.from({ length: active.cols }, (_, i) => (
                <HeaderCell key={`col-${active.id}-${i}`} value={active.headers[i] ?? `Column ${i + 1}`} onCommit={(v) => setHeader(i, v)} isLast={i === active.cols - 1} />
              ))}
              {/* Body rows */}
              {Array.from({ length: active.rows }, (_, r) => (
                <div key={`row-${r}`} className="contents">
                  <div className="h-9 flex items-center justify-center text-xs font-medium text-slate-400 bg-white border-b border-r border-slate-100">{r + 1}</div>
                  {Array.from({ length: active.cols }, (_, c) => (
                    <EditableCell
                      key={`cell-${active.id}-${r}-${c}`}
                      value={getCell(r, c)}
                      onCommit={(v) => setCell(r, c, v)}
                      isLast={c === active.cols - 1}
                      focused={focused?.row === r && focused?.col === c}
                      onFocus={() => setFocused({ row: r, col: c })}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Add rows footer */}
        <div className="flex items-center px-3 py-2 border-t border-slate-100 bg-slate-50">
          <button
            onClick={addRows}
            className="text-xs px-3 py-1 border border-primary-200 text-primary-600 rounded-full hover:bg-primary-50 hover:border-primary-600 transition-colors"
          >
            + {ADD_ROWS_STEP} rows
          </button>
        </div>
      </div>

      {/* Next button */}
      {onNext && (
        <div className="flex justify-end mt-4">
          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={nextLoading}
            endIcon={nextLoading ? <Spinner size={16} color="white" /> : <ArrowRight className="w-4 h-4" />}
            onClick={handleNext}
          >
            {nextLoading ? 'Classifying…' : 'Next'}
          </Button>
        </div>
      )}

      <Alert severity="info" className="mt-4">
        Rate tables are stored locally for now — hooking to <code className="mx-1 text-xs">POST /pc/schedules/{'{id}'}/rate-tables</code> will persist tab structure, dates, columns and rows.
      </Alert>

      <Snackbar open={!!toast} onClose={() => setToast(null)} autoHideDuration={2500} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="info" variant="filled" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </div>
  );
};

interface HeaderCellProps { value: string; onCommit: (value: string) => void; isLast: boolean; }

const HeaderCell = ({ value, onCommit, isLast }: HeaderCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { const clean = draft.trim(); if (clean && clean !== value) onCommit(clean); else setDraft(value); setEditing(false); };
  const cellBase = cn('h-10 flex items-center justify-center text-sm font-semibold text-slate-500 bg-white border-b border-slate-100', !isLast && 'border-r');
  if (editing) {
    return (
      <div className={cellBase} style={{ padding: 0 }}>
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { setDraft(value); setEditing(false); } }} className="w-full h-full border-2 border-primary-600 outline-none bg-white px-2 text-sm font-bold text-center" />
      </div>
    );
  }
  return <div onClick={() => setEditing(true)} className={cn(cellBase, 'cursor-text text-slate-700')}>{value}</div>;
};

interface EditableCellProps { value: string; onCommit: (value: string) => void; isLast: boolean; focused?: boolean; onFocus?: () => void; }

const EditableCell = ({ value, onCommit, isLast, focused = false, onFocus }: EditableCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { if (draft !== value) onCommit(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };
  const cellBase = cn('h-9 bg-white border-b border-slate-100', !isLast && 'border-r');
  if (editing) {
    return (
      <div className={cellBase} style={{ padding: 0 }}>
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') cancel(); }} className="w-full h-full border-2 border-primary-600 outline-none bg-white px-2 text-sm" />
      </div>
    );
  }
  return (
    <div
      onClick={() => { onFocus?.(); setEditing(true); }}
      className={cn(cellBase, 'flex items-center px-2 text-sm cursor-text hover:bg-primary-50/40 transition-colors', value ? 'text-slate-800' : 'text-slate-300', focused && 'ring-inset ring-2 ring-primary-600 bg-primary-50/40')}
    >
      {value || ''}
    </div>
  );
};

export default RateTableTab;
