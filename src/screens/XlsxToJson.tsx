import { useRef, useState } from 'react';
import { CloudUpload, Download, Copy, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

type SheetJson = Record<string, unknown>[];
type WorkbookJson = Record<string, SheetJson>;

const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

  const onToggleAllSheets = (checked: boolean) => {
    setAllSheets(checked);
    setCopied(false);
  };

  const onToggleRawHeader = async (checked: boolean) => {
    setRawHeader(checked);
    setCopied(false);
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
    <div className="p-4 md:p-8 max-w-screen-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-1">XLSX → JSON Converter</h1>
      <p className="text-sm text-slate-500 mb-5">
        Upload a spreadsheet (.xlsx, .xls, .xlsm, .csv) to convert it to JSON. Everything runs in your browser — no upload to the server.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50 hover:bg-blue-50/30 hover:border-primary-600 transition-colors cursor-pointer"
      >
        <CloudUpload className="w-12 h-12 text-primary-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800">
          {fileName ? fileName : 'Click to browse or drop a spreadsheet here'}
        </p>
        <p className="text-xs text-slate-400 mt-1">Supported: .xlsx, .xls, .xlsm, .csv · Max 25 MB</p>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={onInputChange}
        />
      </div>

      {error && (
        <div className="mt-3">
          <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
        </div>
      )}

      {sheetNames.length > 0 && (
        <>
          <div className="mt-4 mb-3 flex flex-wrap gap-3 items-center">
            {/* Sheet selector */}
            <div className="flex flex-col gap-1 min-w-[200px]">
              <span className="text-xs text-slate-500 font-medium">Sheet</span>
              <select
                value={activeSheet}
                onChange={(e) => setActiveSheet(e.target.value)}
                disabled={allSheets}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              >
                {sheetNames.map((n) => (
                  <option key={n} value={n}>
                    {n} ({workbookJson[n]?.length ?? 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Toggles */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSheets}
                onChange={(e) => onToggleAllSheets(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 accent-primary-600"
              />
              <span className="text-sm text-slate-700">Export all sheets</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rawHeader}
                onChange={(e) => void onToggleRawHeader(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 accent-primary-600"
              />
              <span className="text-sm text-slate-700">Rows as arrays (no header row)</span>
            </label>

            <div className="flex-1" />

            {/* Row count badge */}
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
              'bg-slate-100 text-slate-600'
            )}>
              {allSheets ? `${sheetNames.length} sheets` : `${activeRows} rows`}
            </span>

            <Button
              size="small"
              variant="outlined"
              startIcon={<Copy className="w-3.5 h-3.5" />}
              onClick={() => void copyJson()}
              disabled={busy}
            >
              {copied ? 'Copied!' : 'Copy JSON'}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Download className="w-3.5 h-3.5" />}
              onClick={downloadJson}
              disabled={busy}
            >
              Download
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={reset}
            >
              Reset
            </Button>
          </div>

          {/* JSON output */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-auto max-h-[520px] p-4">
            <pre className="m-0 text-slate-200 font-mono text-xs leading-relaxed whitespace-pre">
              {jsonText}
            </pre>
          </div>
        </>
      )}
    </div>
  );
};

export default XlsxToJson;
