import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import * as XLSX from 'xlsx';

type SheetJson = Record<string, unknown>[];
type WorkbookJson = Record<string, SheetJson>;

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const XlsxToJson = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [workbookJson, setWorkbookJson] = useState<WorkbookJson>({});
  const [allSheets, setAllSheets] = useState<boolean>(false);
  const [rawHeader, setRawHeader] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const parseWorkbook = (data: ArrayBuffer, useRawHeader: boolean) => {
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    const result: WorkbookJson = {};
    wb.SheetNames.forEach((name) => {
      const sheet = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: true,
        header: useRawHeader ? 1 : undefined,
      }) as SheetJson;
      result[name] = rows;
    });
    return { wb, result };
  };

  const handleFile = async (file: File) => {
    setError(null);
    setCopied(false);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 25 MB.`);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.xlsm') && !lower.endsWith('.csv')) {
      setError('Unsupported file type. Please choose an .xlsx, .xls, .xlsm or .csv file.');
      return;
    }
    try {
      setBusy(true);
      const buf = await file.arrayBuffer();
      const { wb, result } = parseWorkbook(buf, rawHeader);
      setFileName(file.name);
      setSheetNames(wb.SheetNames);
      setActiveSheet(wb.SheetNames[0] ?? '');
      setWorkbookJson(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to parse workbook: ${msg}`);
      setWorkbookJson({});
      setSheetNames([]);
      setActiveSheet('');
      setFileName('');
    } finally {
      setBusy(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onSheetChange = (e: SelectChangeEvent<string>) => {
    setActiveSheet(e.target.value);
  };

  const onToggleAllSheets = (_: unknown, checked: boolean) => {
    setAllSheets(checked);
    setCopied(false);
  };

  const onToggleRawHeader = async (_: unknown, checked: boolean) => {
    setRawHeader(checked);
    setCopied(false);
    // Re-parse currently loaded file if we have one, using new header mode.
    const file = inputRef.current?.files?.[0];
    if (file) {
      try {
        setBusy(true);
        const buf = await file.arrayBuffer();
        const { wb, result } = parseWorkbook(buf, checked);
        setSheetNames(wb.SheetNames);
        setWorkbookJson(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to re-parse workbook: ${msg}`);
      } finally {
        setBusy(false);
      }
    }
  };

  const payload = allSheets ? workbookJson : workbookJson[activeSheet] ?? [];
  const jsonText = JSON.stringify(payload, null, 2);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Clipboard copy failed. Your browser may block it.');
    }
  };

  const downloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = fileName.replace(/\.[^.]+$/, '') || 'workbook';
    a.href = url;
    a.download = allSheets ? `${base}.json` : `${base}.${activeSheet || 'sheet'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFileName('');
    setSheetNames([]);
    setActiveSheet('');
    setWorkbookJson({});
    setError(null);
    setCopied(false);
  };

  const activeRows = workbookJson[activeSheet]?.length ?? 0;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        XLSX → JSON Converter
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a spreadsheet (.xlsx, .xls, .xlsm, .csv) to convert it to JSON. Everything runs in your browser — no upload to the server.
      </Typography>

      <Paper
        variant="outlined"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        sx={{
          p: 4,
          borderStyle: 'dashed',
          borderWidth: 2,
          borderRadius: 3,
          textAlign: 'center',
          background: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(15, 23, 42, 0.02)',
          cursor: 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
      >
        <CloudUploadRoundedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {fileName ? fileName : 'Click to browse or drop a spreadsheet here'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Supported: .xlsx, .xls, .xlsm, .csv · Max 25 MB
        </Typography>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={onInputChange}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {sheetNames.length > 0 && (
        <>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              mt: 3,
              mb: 2,
              alignItems: { xs: 'stretch', md: 'center' },
            }}
          >
            <Box sx={{ minWidth: 220 }}>
              <Typography variant="caption" color="text.secondary">
                Sheet
              </Typography>
              <Select
                fullWidth
                size="small"
                value={activeSheet}
                onChange={onSheetChange}
                disabled={allSheets}
              >
                {sheetNames.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n} ({workbookJson[n]?.length ?? 0})
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <FormControlLabel
              control={<Switch checked={allSheets} onChange={onToggleAllSheets} />}
              label="Export all sheets"
            />
            <FormControlLabel
              control={<Switch checked={rawHeader} onChange={onToggleRawHeader} />}
              label="Rows as arrays (no header row)"
            />
            <Box sx={{ flex: 1 }} />
            <Chip
              label={
                allSheets
                  ? `${sheetNames.length} sheets`
                  : `${activeRows} rows`
              }
              size="small"
            />
            <Button
              size="small"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={copyJson}
              variant="outlined"
              disabled={busy}
            >
              {copied ? 'Copied!' : 'Copy JSON'}
            </Button>
            <Button
              size="small"
              startIcon={<DownloadRoundedIcon />}
              onClick={downloadJson}
              variant="contained"
              disabled={busy}
            >
              Download
            </Button>
            <Button
              size="small"
              startIcon={<RestartAltRoundedIcon />}
              onClick={reset}
              color="inherit"
            >
              Reset
            </Button>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              maxHeight: 520,
              overflow: 'auto',
              background: (t) =>
                t.palette.mode === 'dark' ? '#0f172a' : '#0f172a',
              color: '#e2e8f0',
            }}
          >
            <Box
              component="pre"
              sx={{
                m: 0,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 12.5,
                lineHeight: 1.55,
                whiteSpace: 'pre',
              }}
            >
              {jsonText}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default XlsxToJson;
