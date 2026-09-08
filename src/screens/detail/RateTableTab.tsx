import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CircularProgress from '@mui/material/CircularProgress';

interface RateTable {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  cols: number;
  rows: number;
  /** rows × cols string grid — sparse rows OK, undefined cell = empty */
  cells: string[][];
  /** Column header labels — used as AI classification field names */
  headers: string[];
}

const DEFAULT_COLS = 5;
const DEFAULT_ROWS = 10;
const ADD_ROWS_STEP = 5;
const END_OF_TIME = '2300-01-01';

const emptyGrid = (rows: number, cols: number): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

const defaultHeaders = (cols: number): string[] =>
  Array.from({ length: cols }, () => '');

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

  const updateActive = (patch: Partial<RateTable>) => {
    setTables((prev) => prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));
  };

  const addColumn = () => {
    const newCells = active.cells.map((r) => [...r, '']);
    const nextHeaders = [...active.headers, ''];
    updateActive({ cols: active.cols + 1, cells: newCells, headers: nextHeaders });
  };
  const addRows = () => {
    const extra = Array.from({ length: ADD_ROWS_STEP }, () =>
      Array.from({ length: active.cols }, () => ''),
    );
    updateActive({ rows: active.rows + ADD_ROWS_STEP, cells: [...active.cells, ...extra] });
  };

  const setHeader = (col: number, value: string) => {
    const next = [...active.headers];
    next[col] = value;
    updateActive({ headers: next });
  };

  const handleNext = () => {
    if (!onNext) return;
    const headers = active.headers;
    const cellAt = (r: number, c: number) => (active.cells?.[r]?.[c] ?? '').trim();

    // 1. Identify columns that actually contain data anywhere in the grid.
    const activeCols: number[] = [];
    for (let c = 0; c < active.cols; c++) {
      let colHasAny = false;
      for (let r = 0; r < active.rows; r++) {
        if (cellAt(r, c) !== '') { colHasAny = true; break; }
      }
      if (colHasAny) activeCols.push(c);
    }

    if (activeCols.length === 0) {
      setToast('Add at least one filled cell before continuing');
      return;
    }

    // 2. Detect pivot / matrix layout.
    //    Signature: row 1 col A has a label, row 1 in every other active column is empty,
    //    and at least one later row in col A has data.
    const [labelCol, ...valueCols] = activeCols;
    const rowDimNameCell = cellAt(0, labelCol);
    const row1OtherColsEmpty =
      valueCols.length > 0 &&
      valueCols.every((c) => cellAt(0, c) === '');
    let laterRowsInLabelColHaveData = false;
    for (let r = 1; r < active.rows; r++) {
      if (cellAt(r, labelCol) !== '') { laterRowsInLabelColHaveData = true; break; }
    }
    const isPivot =
      rowDimNameCell !== '' &&
      row1OtherColsEmpty &&
      laterRowsInLabelColHaveData &&
      valueCols.length >= 1;

    const rows: Record<string, string>[] = [];

    if (isPivot) {
      // Pivot mode — mirror legacy matrix rate-table editors.
      //   headers[labelCol]        → column-dimension NAME  (e.g. "MOverride")
      //   headers[valueCols[i]]    → column-dimension VALUE (e.g. "Special Producer")
      //   cellAt(0, labelCol)       → row-dimension NAME    (e.g. "TargetLevel")
      //   cellAt(r>=1, labelCol)    → row-dimension VALUE   (e.g. "[1,2)")
      //   cellAt(r>=1, valueCol)    → Value                 (the rate)
      const rowDimName = rowDimNameCell;
      const colDimName = (headers[labelCol] ?? '').trim();

      for (let r = 1; r < active.rows; r++) {
        const rowVal = cellAt(r, labelCol);
        if (rowVal === '') continue;
        for (const c of valueCols) {
          const val = cellAt(r, c);
          if (val === '') continue;
          const colVal = (headers[c] ?? '').trim();
          const entry: Record<string, string> = { [rowDimName]: rowVal, Value: val };
          if (colDimName !== '') entry[colDimName] = colVal;
          rows.push(entry);
        }
      }
    } else {
      // Flat mode — one JSON row per grid row using column headers as keys.
      // Columns without a header are simply skipped in the payload.
      for (let r = 0; r < active.rows; r++) {
        const row: Record<string, string> = {};
        let rowHasAny = false;
        for (const c of activeCols) {
          const val = cellAt(r, c);
          if (val !== '') rowHasAny = true;
          const key = (headers[c] ?? '').trim();
          if (key !== '') row[key] = val;
        }
        if (rowHasAny) rows.push(row);
      }
    }

    if (rows.length === 0) {
      setToast('Add at least one filled cell before continuing');
      return;
    }
    onNext(rows);
  };

  /* ---------------- CSV upload ----------------------------------------- */

  /**
   * Standards-compliant CSV parser — handles quoted fields, commas inside quotes,
   * escaped double-quotes ("") and either \n or \r\n line endings. Trailing empty
   * line is stripped.
   */
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else                     { inQuotes = false; }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"')      { inQuotes = true; }
        else if (ch === ',') { current.push(field); field = ''; }
        else if (ch === '\r') {
          // \r\n normalised
        }
        else if (ch === '\n') {
          current.push(field);
          rows.push(current);
          current = [];
          field = '';
        } else {
          field += ch;
        }
      }
    }
    // Flush trailing field / row
    if (field !== '' || current.length > 0) {
      current.push(field);
      rows.push(current);
    }
    // Drop a completely empty trailing row (from a final newline)
    if (rows.length > 0 && rows[rows.length - 1].every((v) => v === '')) rows.pop();
    return rows;
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file
    if (!file) return;
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length === 0) {
        setToast('CSV appears to be empty');
        return;
      }
      const [headerRow, ...dataRows] = grid;
      const cols = headerRow.length;
      const rowsCount = Math.max(dataRows.length, DEFAULT_ROWS);
      // Normalise each data row to `cols` width
      const cells: string[][] = [];
      for (let r = 0; r < rowsCount; r++) {
        const src = dataRows[r] ?? [];
        const row: string[] = [];
        for (let c = 0; c < cols; c++) row.push((src[c] ?? '').trim());
        cells.push(row);
      }
      // Keep headers exactly as they appear in the CSV — including blanks
      const headers = headerRow.map((h) => (h ?? '').trim());
      updateActive({ cols, rows: rowsCount, headers, cells });
      setFocused(null);
      setToast(`Loaded ${dataRows.length} row(s) × ${cols} column(s) from ${file.name}`);
    } catch (err: unknown) {
      const message = (err as { message?: string }).message ?? 'Failed to read CSV';
      setToast(message);
    }
  };

  const setCell = (row: number, col: number, value: string) => {
    const nextCells = active.cells.map((r) => [...r]);
    // Guard against sparse arrays after resizes
    while (nextCells.length < active.rows) nextCells.push([]);
    while (nextCells[row].length < active.cols) nextCells[row].push('');
    nextCells[row][col] = value;
    updateActive({ cells: nextCells });
  };

  const getCell = (row: number, col: number): string =>
    active.cells?.[row]?.[col] ?? '';

  /* ---------------- Copy / paste — spreadsheet-style ------------------- */

  const parseClipboardGrid = (text: string): string[][] => {
    // Strip a single trailing newline (Excel adds one) then split on \r?\n and \t
    const trimmed = text.replace(/\r?\n$/, '');
    return trimmed.split(/\r?\n/).map((line) => line.split('\t'));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!focused) return;
    // If a cell input is actively being edited, let it handle its own paste.
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const raw = e.clipboardData.getData('text');
    if (!raw) return;
    const grid = parseClipboardGrid(raw);
    if (grid.length === 0) return;
    e.preventDefault();

    const startRow = focused.row;
    const startCol = focused.col;
    const rowsNeeded = startRow + grid.length;
    const colsNeeded = startCol + Math.max(...grid.map((r) => r.length));

    // Grow the current cells matrix as needed
    const nextCells: string[][] = active.cells.map((r) => [...r]);
    while (nextCells.length < rowsNeeded) {
      nextCells.push(Array.from({ length: active.cols }, () => ''));
    }
    for (let r = 0; r < nextCells.length; r++) {
      while (nextCells[r].length < Math.max(active.cols, colsNeeded)) nextCells[r].push('');
    }
    // Write clipboard into place
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        nextCells[startRow + r][startCol + c] = grid[r][c];
      }
    }

    // Grow headers to cover any new columns
    const nextHeaders = [...active.headers];
    while (nextHeaders.length < colsNeeded) {
      // Insert new "Column N" before the trailing "Value" if it exists
      const lastIdx = nextHeaders.length - 1;
      if (
        nextHeaders.length > 0 &&
        nextHeaders[lastIdx] === 'Value'
      ) {
        nextHeaders.splice(lastIdx, 0, `Column ${nextHeaders.length}`);
      } else {
        nextHeaders.push(nextHeaders.length === colsNeeded - 1 ? 'Value' : `Column ${nextHeaders.length + 1}`);
      }
    }

    updateActive({
      rows:    Math.max(active.rows, rowsNeeded),
      cols:    Math.max(active.cols, colsNeeded),
      cells:   nextCells,
      headers: nextHeaders,
    });
    setToast(`Pasted ${grid.length} row(s) × ${grid[0]?.length ?? 0} col(s)`);
  };

  const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!focused) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const val = getCell(focused.row, focused.col);
    e.clipboardData.setData('text/plain', val);
  };

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          size="small"
          startIcon={<AddRoundedIcon />}
          onClick={addRateTable}
          sx={{ textTransform: 'none' }}
        >
          Add Rate Table
        </Button>
        <Button
          size="small"
          startIcon={<UploadRoundedIcon />}
          onClick={handleUploadClick}
          sx={{ textTransform: 'none' }}
        >
          Upload CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={handleFileChosen}
        />
      </Box>

      {/* Tab strip */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 2,
          p: 1.5,
          mb: 3,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Click selected tab to edit name
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {tables.map((t) => {
            const isActive = t.id === activeId;
            const isRenaming = renamingId === t.id;
            return (
              <Box
                key={t.id}
                onClick={() => {
                  if (isActive && !isRenaming) setRenamingId(t.id);
                  else setActiveId(t.id);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isActive ? 'primary.main' : 'rgba(15, 23, 42, 0.12)',
                  background: isActive ? 'rgba(79, 70, 229, 0.06)' : '#fff',
                  color: isActive ? 'primary.main' : 'text.primary',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 120ms ease',
                }}
              >
                {isRenaming ? (
                  <TextField
                    autoFocus
                    size="small"
                    value={t.name}
                    onChange={(e) =>
                      setTables((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    onBlur={() => setRenamingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    variant="standard"
                    sx={{ minWidth: 140, '& .MuiInputBase-input': { fontSize: 14, py: 0 } }}
                  />
                ) : (
                  <span style={{ fontSize: 14 }}>{t.name}</span>
                )}
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRateTable(t.id);
                  }}
                  sx={{
                    width: 20,
                    height: 20,
                    color: isActive ? 'primary.main' : 'text.disabled',
                    '&:hover': { color: 'error.main' },
                  }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })}

          <Box sx={{ flex: 1 }} />
          <Tooltip title="Reorder (coming soon)">
            <IconButton size="small" sx={{ color: 'text.disabled' }}>
              <DragIndicatorRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Start / End dates */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 200 }}>
          Rate Table Start and End Date:
        </Typography>
        <TextField
          type="date"
          label="Start Date"
          size="small"
          value={active.startDate}
          onChange={(e) => updateActive({ startDate: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="date"
          label="End Date"
          size="small"
          value={active.endDate}
          onChange={(e) => updateActive({ endDate: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      {/* Grid — Paper is tabIndex-able so paste events fire even without an input focus */}
      <Paper
        elevation={0}
        tabIndex={0}
        onPaste={handlePaste}
        onCopy={handleCopy}
        sx={{
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 2,
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        <Box sx={{ position: 'relative' }}>
          {/* Add column button */}
          <Button
            size="small"
            startIcon={<AddRoundedIcon fontSize="inherit" />}
            onClick={addColumn}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 2,
              textTransform: 'none',
              fontSize: 12,
              minHeight: 28,
              borderRadius: 4,
              px: 1.25,
              py: 0.25,
              color: 'primary.main',
              bgcolor: '#fff',
              border: '1px solid',
              borderColor: 'primary.light',
              '&:hover': { bgcolor: 'primary.50', borderColor: 'primary.main' },
            }}
          >
            1 col
          </Button>

          <Box sx={{ overflowX: 'auto' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `56px repeat(${active.cols}, minmax(180px, 1fr))`,
                minWidth: 900,
              }}
            >
              {/* Column header row */}
              <Box sx={cellHeaderCornerSx} />
              {Array.from({ length: active.cols }, (_, i) => (
                <HeaderCell
                  key={`col-${active.id}-${i}`}
                  value={active.headers[i] ?? `Column ${i + 1}`}
                  onCommit={(v) => setHeader(i, v)}
                  isLast={i === active.cols - 1}
                />
              ))}

              {/* Body rows */}
              {Array.from({ length: active.rows }, (_, r) => (
                <Box key={`row-${r}`} sx={{ display: 'contents' }}>
                  <Box sx={cellRowHeaderSx}>{r + 1}</Box>
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
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Add rows footer */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 1,
            borderTop: '1px solid rgba(15, 23, 42, 0.06)',
            background: 'rgba(15, 23, 42, 0.02)',
          }}
        >
          <Button
            size="small"
            startIcon={<AddRoundedIcon fontSize="inherit" />}
            onClick={addRows}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              borderRadius: 4,
              px: 1.5,
              color: 'primary.main',
              border: '1px solid',
              borderColor: 'primary.light',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
            }}
          >
            {ADD_ROWS_STEP} rows
          </Button>
        </Box>
      </Paper>

      {/* Next → Variables */}
      {onNext && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="contained"
            size="large"
            disabled={nextLoading}
            endIcon={
              nextLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <ArrowForwardRoundedIcon />
              )
            }
            onClick={handleNext}
            sx={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              minWidth: 200,
            }}
          >
            {nextLoading ? 'Classifying…' : 'Next'}
          </Button>
        </Box>
      )}

      <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
        Rate tables are stored locally for now — hooking to
        <code style={{ margin: '0 4px' }}>POST /pc/schedules/&#123;id&#125;/rate-tables</code>
        will persist tab structure, dates, columns and rows.
      </Alert>

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToast(null)} severity="info" variant="filled" sx={{ borderRadius: 2 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
};

/* ------------------------------------------------------------------------- */
/*  HeaderCell — editable column header                                       */
/* ------------------------------------------------------------------------- */

interface HeaderCellProps {
  value: string;
  onCommit: (value: string) => void;
  isLast: boolean;
}

const HeaderCell = ({ value, onCommit, isLast }: HeaderCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const clean = draft.trim();
    if (clean && clean !== value) onCommit(clean);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ ...cellHeaderSx, p: 0, ...(isLast ? { '&': { borderRight: 'none' } } : {}) }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            border: '2px solid #4f46e5',
            outline: 'none',
            background: '#fff',
            padding: '0 8px',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      onClick={() => setEditing(true)}
      sx={{
        ...cellHeaderSx,
        cursor: 'text',
        fontWeight: 700,
        color: 'text.primary',
        ...(isLast ? { '&': { borderRight: 'none' } } : {}),
      }}
    >
      {value}
    </Box>
  );
};

/* ------------------------------------------------------------------------- */
/*  EditableCell                                                              */
/* ------------------------------------------------------------------------- */

interface EditableCellProps {
  value: string;
  onCommit: (value: string) => void;
  isLast: boolean;
  focused?: boolean;
  onFocus?: () => void;
}

const EditableCell = ({
  value,
  onCommit,
  isLast,
  focused = false,
  onFocus,
}: EditableCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    if (draft !== value) onCommit(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <Box
        sx={{
          ...cellBodySx,
          p: 0,
          ...(isLast ? { '&': { borderRight: 'none' } } : {}),
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') cancel();
          }}
          style={{
            width: '100%',
            height: '100%',
            border: '2px solid #4f46e5',
            outline: 'none',
            background: '#fff',
            padding: '0 8px',
            fontSize: 13,
            fontFamily: 'inherit',
            color: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      onClick={() => {
        onFocus?.();
        setEditing(true);
      }}
      sx={{
        ...cellBodySx,
        cursor: 'text',
        display: 'flex',
        alignItems: 'center',
        px: 1,
        fontSize: 13,
        color: value ? 'text.primary' : 'text.disabled',
        // Focused (but not editing) state — visible outline for copy/paste anchor
        ...(focused
          ? {
              '&': {
                boxShadow: 'inset 0 0 0 2px #4f46e5',
                background: 'rgba(79, 70, 229, 0.06)',
              },
            }
          : {}),
        ...(isLast ? { '&': { borderRight: 'none' } } : {}),
      }}
    >
      {value || ''}
    </Box>
  );
};

/* ------------------------------------------------------------------------- */
/*  Cell style presets                                                        */
/* ------------------------------------------------------------------------- */

const cellHeaderCornerSx = {
  height: 40,
  background: '#fff',
  borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
  borderRight: '1px solid rgba(15, 23, 42, 0.06)',
};

const cellHeaderSx = {
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: 13,
  color: 'text.secondary',
  background: '#fff',
  borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
  borderRight: '1px solid rgba(15, 23, 42, 0.06)',
  '&:last-of-type': { borderRight: 'none' },
};

const cellRowHeaderSx = {
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 500,
  fontSize: 12,
  color: 'text.secondary',
  background: '#fff',
  borderBottom: '1px solid rgba(15, 23, 42, 0.05)',
  borderRight: '1px solid rgba(15, 23, 42, 0.06)',
};

const cellBodySx = {
  height: 36,
  background: '#fff',
  borderBottom: '1px solid rgba(15, 23, 42, 0.05)',
  borderRight: '1px solid rgba(15, 23, 42, 0.06)',
  transition: 'background-color 100ms ease',
  '&:hover': { background: 'rgba(79, 70, 229, 0.04)' },
  '&:last-of-type': { borderRight: 'none' },
};

export default RateTableTab;
