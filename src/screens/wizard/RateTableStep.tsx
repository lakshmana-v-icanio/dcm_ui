import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';

import {
  BrandButton,
  DropZone,
  StyledTableHeadRow,
  SurfaceCard,
} from '../../theme/styled';
import {
  getScheduleRateTables,
  type RateTableDto,
} from '../../api/pcSchedule';
import { queryKeys } from '../../queryClient';

export interface ParsedTable {
  id: string;
  /** Filename without extension — becomes the tab label. */
  name: string;
  headers: string[];
  rows: string[][];
  /** True for tables loaded from the server (persisted) — shown read-only. */
  readOnly?: boolean;
}

/**
 * Convert every parsed sheet into the classify-endpoint payload shape:
 * `{ name, grid }` where `grid` is the raw 2D array of cells the UI saw,
 * including the header row itself. No flattening, no key invention, no
 * pivot detection — Gemini reads the layout the same way a human would
 * look at the sheet in Excel.
 */
export const toRateTableGrids = (
  tables: ParsedTable[],
): Array<{ name: string; grid: string[][] }> =>
  tables.map((t) => ({
    name: t.name,
    // Prepend the header row so the grid is the true, unmodified sheet.
    grid: [t.headers, ...t.rows],
  }));

/** Build a human-readable label for a batch of rate tables. */
export const summariseTableNames = (tables: ParsedTable[]): string => {
  if (tables.length === 0) return '';
  if (tables.length === 1) return tables[0].name;
  if (tables.length <= 3) return tables.map((t) => t.name).join(' + ');
  return `${tables[0].name} + ${tables.length - 1} more`;
};

interface RateTableStepProps {
  scheduleId: number | null;
  /** Schedule GID — used to fetch already-persisted rate tables for this schedule. */
  scheduleGid?: string | null;
  uploadedFileName: string | null;
  onFileSelected: (name: string) => void;
  onTablesChange?: (tables: ParsedTable[]) => void;
  /** Fired when the user uploads one or more new files — signals a re-classify is needed. */
  onUpload?: () => void;
  /** Reports whether any tables (saved or uploaded) are shown — gates the wizard's Next. */
  onTablesAvailableChange?: (available: boolean) => void;
  /**
   * Tables preserved by the wizard across step navigation. When the user
   * uploads XLSX files, clicks Next, and then clicks Back, the wizard's
   * `parsedTables` state is passed here so this step re-mounts with the
   * previous uploads still visible.
   */
  initialTables?: ParsedTable[];
}

/**
 * Reconstruct a persisted rate table (axes + cells from the GET endpoint) into
 * the same {@link ParsedTable} grid shape an uploaded sheet produces, so it can
 * render in the existing tab-strip + grid view. Columns are the axis variable
 * names (in axisOrder) followed by "Value"; one row per populated cell.
 */
const rateTableToParsedTable = (t: RateTableDto): ParsedTable => {
  const axes = [...t.axes].sort((a, b) => a.axisOrder - b.axisOrder);
  const headers = [...axes.map((a) => a.variableName), 'Value'];
  const rows = t.cells.map((cell) => {
    const byVar = new Map(cell.coords.map((c) => [c.variableName, c.byName]));
    return [...axes.map((a) => byVar.get(a.variableName) ?? ''), String(cell.value)];
  });
  return { id: `saved-${t.gid}`, name: t.name, headers, rows, readOnly: true };
};

const stripExtension = (filename: string): string =>
  filename.replace(/\.[^./\\]+$/, '');

/**
 * Read one XLSX (or CSV) file → produce one ParsedTable per non-empty sheet.
 *
 * For workbooks with a single sheet — the common case — we return one entry
 * named after the file (without extension). For multi-sheet workbooks we
 * suffix `— <sheetName>` so tab labels stay unique.
 */
const parseWorkbook = async (file: File): Promise<ParsedTable[]> => {
  const buffer = await file.arrayBuffer();
  // cellDates → real Date objects; formatted strings for merged/formula cells.
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const base = stripExtension(file.name);

  const parsed: ParsedTable[] = [];
  workbook.SheetNames.forEach((sheetName, sheetIdx) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    // `raw: false` returns strings formatted the way Excel displays them —
    // preserves "[1,2)", "01/2025", "$0.05" verbatim (which the AI relies on
    // for pattern classification).
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: '',
    });
    if (rows.length === 0) return;

    // SheetJS trims trailing empty cells, so a row with gaps
    // ("PolicyYear", "", "", "", "", ">=2") comes back shorter than a fully
    // populated one. Normalise every row to the widest column count so
    // empty header cells between and after filled ones are preserved.
    const rawHeaderRow = (rows[0] ?? []).map(cellToString);
    const rawBodyRows = rows.slice(1).map((r) => r.map(cellToString));

    // Drop entirely-empty trailing rows — Excel often adds them.
    while (
      rawBodyRows.length > 0 &&
      rawBodyRows[rawBodyRows.length - 1].every((c) => c === '')
    ) {
      rawBodyRows.pop();
    }
    if (rawBodyRows.length === 0 && rawHeaderRow.every((c) => c === '')) return;

    const maxCols = Math.max(
      rawHeaderRow.length,
      ...rawBodyRows.map((r) => r.length),
      0,
    );
    const padRight = (arr: string[]): string[] =>
      arr.length >= maxCols
        ? arr
        : [...arr, ...Array.from({ length: maxCols - arr.length }, () => '')];

    parsed.push({
      id: `${file.name}-${sheetIdx}-${crypto.randomUUID()}`,
      name:
        workbook.SheetNames.length > 1 ? `${base} — ${sheetName}` : base,
      headers: padRight(rawHeaderRow),
      rows: rawBodyRows.map(padRight),
    });
  });
  return parsed;
};

/** Coerce whatever SheetJS hands back into a normalised trimmed string. */
const cellToString = (v: unknown): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') return v.trim();
  return String(v);
};

const RateTableStep = ({
  scheduleGid,
  uploadedFileName,
  onFileSelected,
  onTablesChange,
  onUpload,
  onTablesAvailableChange,
  initialTables,
}: RateTableStepProps) => {
  // Lazy initializer — seeds with the wizard's preserved tables on remount
  // so that uploads survive a Next → Back navigation.
  const [tables, setTables] = useState<ParsedTable[]>(
    () => initialTables ?? [],
  );
  const [activeId, setActiveId] = useState<string | null>(
    () => initialTables?.[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch already-persisted rate tables for this schedule. Fires whenever the
  // user navigates to this step (component mounts). These are shown together
  // with any newly uploaded tables — uploads are added, never replacing them.
  const { data: savedData } = useQuery({
    queryKey: scheduleGid
      ? queryKeys.scheduleSetup.rateTables(scheduleGid)
      : ['schedule-setup', 'rate-tables', 'noop'],
    queryFn: () => getScheduleRateTables(scheduleGid!),
    enabled: !!scheduleGid,
    refetchOnMount: 'always',
  });

  const savedTables = useMemo(
    () => (savedData?.rateTables ?? []).map(rateTableToParsedTable),
    [savedData],
  );

  // Combined view: persisted (read-only) tables first, then this session's uploads
  // that aren't already saved under the same name. This prevents a just-uploaded
  // table from showing twice once it's been persisted and comes back via the GET.
  const displayTables = useMemo(() => {
    const savedNames = new Set(savedTables.map((t) => t.name.trim().toLowerCase()));
    const uploadsNotSaved = tables.filter(
      (t) => !savedNames.has(t.name.trim().toLowerCase()),
    );
    return [...savedTables, ...uploadsNotSaved];
  }, [savedTables, tables]);

  const active =
    displayTables.find((t) => t.id === activeId) ?? displayTables[0] ?? null;

  // Let the wizard enable "Next" when there is at least one table to proceed with
  // (a saved one from the GET or a freshly uploaded one).
  useEffect(() => {
    onTablesAvailableChange?.(displayTables.length > 0);
  }, [displayTables.length, onTablesAvailableChange]);

  const updateTables = (next: ParsedTable[]) => {
    setTables(next);
    onTablesChange?.(next);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const parsedAll: ParsedTable[] = [];
    try {
      for (const file of Array.from(fileList)) {
        const parsed = await parseWorkbook(file);
        if (parsed.length === 0) {
          setError(`No sheets found in ${file.name}`);
          continue;
        }
        parsedAll.push(...parsed);
      }
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ?? 'Failed to parse workbook';
      setError(message);
      return;
    }

    if (parsedAll.length === 0) return;
    updateTables([...tables, ...parsedAll]);
    setActiveId((prev) => prev ?? parsedAll[0].id);
    // Bubble the first uploaded filename up so the wizard's `canNext` gate opens.
    onFileSelected(parsedAll[0].name);
    // Signal a genuine new upload so the wizard knows a re-classify is warranted.
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

  const openBrowser = () => fileInputRef.current?.click();

  return (
    <Box>

      <DropZone
        variant="outlined"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <UploadFileRoundedIcon color="primary" fontSize="large" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
          Drop your rate table files here
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Multiple files supported · .xlsx, .xls
        </Typography>
        <BrandButton variant="contained" onClick={openBrowser}>
          Browse files
        </BrandButton>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
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
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        </Box>
      )}

      {displayTables.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <TabStrip
            tables={displayTables}
            activeId={active?.id ?? null}
            onSelect={setActiveId}
            onRemove={removeTable}
          />
          {active && <SheetGrid table={active} />}
        </Box>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------------- */
/*  Tab strip                                                                 */
/* ------------------------------------------------------------------------- */

interface TabStripProps {
  tables: ParsedTable[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Omit to render read-only tabs (no delete button) — used for saved tables. */
  onRemove?: (id: string) => void;
}

const TabStrip = ({ tables, activeId, onSelect, onRemove }: TabStripProps) => (
  <Paper
    variant="outlined"
    sx={{ p: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}
  >
    {tables.map((t) => {
      const isActive = t.id === activeId;
      return (
        <Box
          key={t.id}
          onClick={() => onSelect(t.id)}
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.75,
            borderRadius: 1.5,
            cursor: 'pointer',
            border: '1px solid',
            borderColor: isActive
              ? theme.palette.primary.main
              : 'rgba(15, 23, 42, 0.12)',
            background: isActive
              ? 'rgba(79, 70, 229, 0.06)'
              : theme.palette.background.paper,
            color: isActive ? 'primary.main' : 'text.primary',
            fontWeight: isActive ? 700 : 500,
            transition: 'all 120ms ease',
          })}
        >
          <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
            {t.name}
          </Typography>
          {!t.readOnly && onRemove && (
            <Tooltip title="Remove this table">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t.id);
                }}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );
    })}
  </Paper>
);

/* ------------------------------------------------------------------------- */
/*  Sheet grid                                                                */
/* ------------------------------------------------------------------------- */

const SheetGrid = ({ table }: { table: ParsedTable }) => (
  <SurfaceCard elevation={0}>
    <TableContainer sx={{ maxHeight: 480 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <StyledTableHeadRow>
            <TableCell sx={{ width: 60 }}>#</TableCell>
            {table.headers.map((h, i) => (
              <TableCell key={`h-${i}`}>{h}</TableCell>
            ))}
          </StyledTableHeadRow>
        </TableHead>
        <TableBody>
          {table.rows.map((row, r) => (
            <TableRow key={`r-${r}`} hover>
              <TableCell sx={{ color: 'text.secondary' }}>{r + 1}</TableCell>
              {table.headers.map((_, c) => (
                <TableCell key={`c-${r}-${c}`}>{row[c] ?? ''}</TableCell>
              ))}
            </TableRow>
          ))}
          {table.rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={table.headers.length + 1}
                align="center"
                sx={{ color: 'text.secondary', py: 4 }}
              >
                No data rows in this sheet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  </SurfaceCard>
);

export default RateTableStep;
