import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { listPcSchedules, type PcScheduleDto } from '../api/pcSchedule';
import {
  getScheduleProgress,
  progressLabel,
} from '../utils/scheduleProgress';
import { queryKeys } from '../queryClient';
import {
  ActionBar,
  BrandButton,
  BrandLinearProgress,
  ClickableTableRow,
  InlineLoader,
  PageContainer,
  PageLane,
  ProgressCell,
  ProgressStack,
  StatusChip,
  StyledTableHeadRow,
  SurfaceCard,
  TypeChip,
} from '../theme/styled';

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

/** Map a progress percentage to a StatusChip tone. */
const progressTone = (pct: number): 'default' | 'primary' | 'success' => {
  if (pct >= 100) return 'success';
  if (pct > 0) return 'primary';
  return 'default';
};

const ScheduleList = ({
  onOpen,
  onCreate,
  flashMessage,
  onFlashConsumed,
}: ScheduleListProps) => {
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
  const errorMsg = isError
    ? extractApiMessage(error, 'Failed to load schedules')
    : null;

  useEffect(() => {
    if (flashMessage) {
      setToast(flashMessage);
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
      onFlashConsumed?.();
    }
  }, [flashMessage, onFlashConsumed, qc]);

  return (
    <PageContainer>
      <PageLane>
        <ActionBar>
          <Tooltip title="Refresh list">
            <span>
              <IconButton
                onClick={() => refetch()}
                disabled={isFetching}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <BrandButton
            size="medium"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={onCreate}
          >
            Create Schedule
          </BrandButton>
        </ActionBar>

        {errorMsg && (
          <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
            {errorMsg}
          </Alert>
        )}

        <SurfaceCard elevation={0}>
          {isFetching && !isLoading && <InlineLoader />}

          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <TableHead>
                <StyledTableHeadRow>
                  <TableCell sx={{ pl: 3 }}>Schedule ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <ProgressCell>Progress</ProgressCell>
                </StyledTableHeadRow>
              </TableHead>

              <TableBody>
                {isLoading && <LoadingRow />}
                {!isLoading && rows.length === 0 && !errorMsg && <EmptyRow />}
                {!isLoading &&
                  rows.map((row) => (
                    <ScheduleRow key={row.scheduleGid} row={row} onOpen={onOpen} />
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider />

          <TablePagination
            component="div"
            count={totalRecords}
            page={pageNumber - 1}
            onPageChange={(_, newPage) => setPageNumber(newPage + 1)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPageNumber(1);
            }}
            rowsPerPageOptions={[5, 10, 20, 50]}
            sx={{ borderTop: 'none' }}
          />
        </SurfaceCard>
      </PageLane>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToast(null)} severity="success" variant="filled">
          {toast}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

/* ─── row sub-components ─── */

const LoadingRow = () => (
  <ClickableTableRow hover={false} sx={{ cursor: 'default' }}>
    <TableCell colSpan={6} align="center">
      <Box sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={24} thickness={4} />
        <Typography variant="body2" color="text.secondary">
          Loading schedules…
        </Typography>
      </Box>
    </TableCell>
  </ClickableTableRow>
);

const EmptyRow = () => (
  <ClickableTableRow hover={false} sx={{ cursor: 'default' }}>
    <TableCell colSpan={6} align="center">
      <Box sx={{ py: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <CalendarTodayRoundedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="subtitle2" color="text.secondary">
          No schedules found
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Click <strong>Create Schedule</strong> to add your first one.
        </Typography>
      </Box>
    </TableCell>
  </ClickableTableRow>
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
    <ClickableTableRow hover onClick={() => onOpen(row)}>
      {/* Schedule ID */}
      <TableCell sx={{ pl: 3, py: 1.5 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, letterSpacing: '0.01em', fontFamily: '"Fira Code", monospace' }}
        >
          {row.scheduleId}
        </Typography>
      </TableCell>

      {/* Type badge */}
      <TableCell sx={{ py: 1.5 }}>
        <TypeChip
          label={row.scheduleType}
          size="small"
          colorVariant={row.scheduleType === 'PCE' ? 'primary' : 'secondary'}
        />
      </TableCell>

      {/* Description */}
      <TableCell sx={{ py: 1.5, maxWidth: 280 }}>
        {row.description ? (
          <Typography variant="body2" noWrap title={row.description}>
            {row.description}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        )}
      </TableCell>

      {/* Start date */}
      <TableCell sx={{ py: 1.5 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {row.startDate ?? '—'}
        </Typography>
      </TableCell>

      {/* End date */}
      <TableCell sx={{ py: 1.5 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {row.endDate ?? '—'}
        </Typography>
      </TableCell>

      {/* Progress */}
      <ProgressCell sx={{ py: 1.5 }}>
        <ProgressStack>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <StatusChip label={label} tone={progressTone(pct)} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
            >
              {pct}%
            </Typography>
          </Box>
          <BrandLinearProgress
            variant="determinate"
            value={pct}
            tone={isComplete ? 'success' : 'primary'}
            barHeight={4}
          />
        </ProgressStack>
      </ProgressCell>
    </ClickableTableRow>
  );
};

export default ScheduleList;
