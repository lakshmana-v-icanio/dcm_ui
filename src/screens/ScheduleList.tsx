import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { listPcSchedules, type PcScheduleDto } from '../api/pcSchedule';
import { getScheduleProgress, progressLabel } from '../utils/scheduleProgress';
import { queryKeys } from '../queryClient';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { LinearProgress } from '../components/ui/Progress';
import { Spinner } from '../components/ui/Spinner';
import { Snackbar } from '../components/ui/Snackbar';
import { Tooltip } from '../components/ui/Tooltip';
import { TypeChip } from '../theme/styled';
import { cn } from '../lib/cn';

interface ScheduleListProps {
  onOpen: (schedule: PcScheduleDto) => void;
  onCreate: () => void;
  flashMessage?: string | null;
  onFlashConsumed?: () => void;
}

const extractApiMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } }; message?: string })
    ?.response?.data?.message ??
  (err as { message?: string })?.message ??
  fallback;

const progressTone = (pct: number): 'default' | 'primary' | 'success' => {
  if (pct >= 100) return 'success';
  if (pct > 0) return 'primary';
  return 'default';
};

const ScheduleList = ({ onOpen, onCreate, flashMessage, onFlashConsumed }: ScheduleListProps) => {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.schedules.list(pageNumber, pageSize),
    queryFn: () => listPcSchedules(pageNumber, pageSize),
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];
  const totalRecords = data?.totalRecords ?? 0;
  const errorMsg = isError ? extractApiMessage(error, 'Failed to load schedules') : null;

  useEffect(() => {
    if (flashMessage) {
      setToast(flashMessage);
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
      onFlashConsumed?.();
    }
  }, [flashMessage, onFlashConsumed, qc]);

  return (
    <div className="p-6 md:p-8 flex flex-col gap-4">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col gap-4">
        {/* Action bar */}
        <div className="flex items-center justify-end gap-2">
          <Tooltip title="Refresh list">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </Tooltip>
          <Button variant="contained" color="primary" startIcon={<Plus />} onClick={onCreate}>
            Create Schedule
          </Button>
        </div>

        {errorMsg && <Alert severity="error" variant="outlined">{errorMsg}</Alert>}

        {/* Table card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isFetching && !isLoading && (
            <div className="h-0.5 w-full bg-slate-100 overflow-hidden">
              <div className="h-full w-1/3 bg-primary-600 animate-[slide_1.5s_ease_infinite]" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 pl-6">Schedule ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Description</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Start Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">End Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Progress</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <LoadingRow />}
                {!isLoading && rows.length === 0 && !errorMsg && <EmptyRow />}
                {!isLoading && rows.map((row) => (
                  <ScheduleRow key={row.scheduleGid} row={row} onOpen={onOpen} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPageNumber(1); }}
                className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
              >
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>{Math.min((pageNumber - 1) * pageSize + 1, totalRecords)}–{Math.min(pageNumber * pageSize, totalRecords)} of {totalRecords}</span>
              <div className="flex gap-0.5 ml-2">
                <button
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber === 1}
                  className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >‹</button>
                <button
                  onClick={() => setPageNumber((p) => p + 1)}
                  disabled={pageNumber * pageSize >= totalRecords}
                  className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >›</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Snackbar open={!!toast} onClose={() => setToast(null)} autoHideDuration={3500} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </div>
  );
};

const LoadingRow = () => (
  <tr>
    <td colSpan={6} className="text-center py-12">
      <div className="flex flex-col items-center gap-2">
        <Spinner size={24} />
        <span className="text-sm text-slate-500">Loading schedules…</span>
      </div>
    </td>
  </tr>
);

const EmptyRow = () => (
  <tr>
    <td colSpan={6} className="text-center py-14">
      <div className="flex flex-col items-center gap-1">
        <Calendar className="w-9 h-9 text-slate-300 mb-1" />
        <span className="text-sm font-medium text-slate-500">No schedules found</span>
        <span className="text-xs text-slate-400">Click <strong>Create Schedule</strong> to add your first one.</span>
      </div>
    </td>
  </tr>
);

interface ScheduleRowProps {
  row: PcScheduleDto;
  onOpen: (schedule: PcScheduleDto) => void;
}

const ScheduleRow = ({ row, onOpen }: ScheduleRowProps) => {
  const pct = row.percentage ?? getScheduleProgress(row.scheduleGid);
  const label = progressLabel(pct);
  const isComplete = pct >= 100;

  return (
    <tr
      onClick={() => onOpen(row)}
      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 pl-6">
        <span className="font-semibold font-mono text-xs tracking-wide text-slate-800">{row.scheduleId}</span>
      </td>
      <td className="px-4 py-3">
        <TypeChip label={row.scheduleType} size="small" colorVariant={row.scheduleType === 'PCE' ? 'primary' : 'secondary'} />
      </td>
      <td className="px-4 py-3 max-w-0">
        {row.description ? (
          <span className="block truncate text-slate-700" title={row.description}>{row.description}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-slate-500 font-tabular">{row.startDate ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-slate-500 font-tabular">{row.endDate ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-1">
            <Badge label={label} tone={progressTone(pct)} />
            <span className="text-xs text-slate-500 font-tabular font-medium">{pct}%</span>
          </div>
          <LinearProgress value={pct} tone={isComplete ? 'success' : 'primary'} barHeight={4} />
        </div>
      </td>
    </tr>
  );
};

export default ScheduleList;
