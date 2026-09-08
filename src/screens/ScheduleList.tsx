import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
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
  ProgressCaptionRow,
  ProgressCell,
  ProgressStack,
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
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={() => refetch()} disabled={isFetching}>
                <RefreshRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <BrandButton
            size="large"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={onCreate}
          >
            Create Schedule
          </BrandButton>
        </ActionBar>

        {errorMsg && (
          <Alert severity="error" variant="outlined">
            {errorMsg}
          </Alert>
        )}

        <SurfaceCard elevation={0}>
          {isFetching && !isLoading && <InlineLoader />}
          <TableContainer sx={{ maxHeight: 640 }}>
            <Table stickyHeader size="medium">
              <TableHead>
                <StyledTableHeadRow>
                  <TableCell>Schedule ID</TableCell>
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
                    <ScheduleRow
                      key={row.scheduleGid}
                      row={row}
                      onOpen={onOpen}
                    />
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

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
          />
        </SurfaceCard>
      </PageLane>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
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

/* ------------------------- row sub-components ------------------------- */

const LoadingRow = () => (
  <ClickableTableRow hover={false} sx={{ cursor: 'default' }}>
    <TableCell colSpan={6} align="center">
      <Box sx={{ py: 4 }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Loading schedules…
        </Typography>
      </Box>
    </TableCell>
  </ClickableTableRow>
);

const EmptyRow = () => (
  <ClickableTableRow hover={false} sx={{ cursor: 'default' }}>
    <TableCell colSpan={6} align="center">
      <Box sx={{ py: 6 }}>
        <Typography variant="subtitle1" color="text.secondary">
          No schedules yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
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
  const isComplete = pct >= 100;
  return (
    <ClickableTableRow hover onClick={() => onOpen(row)}>
      <TableCell>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {row.scheduleId}
        </Typography>
      </TableCell>
      <TableCell>
        <TypeChip
          label={row.scheduleType}
          size="small"
          colorVariant={row.scheduleType === 'PCE' ? 'primary' : 'secondary'}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2">{row.description || '—'}</Typography>
      </TableCell>
      <TableCell>{row.startDate}</TableCell>
      <TableCell>{row.endDate}</TableCell>
      <TableCell>
        <ProgressStack>
          <ProgressCaptionRow>
            <Typography
              variant="caption"
              color={isComplete ? 'success.main' : 'text.secondary'}
              sx={{ fontWeight: 600 }}
            >
              {progressLabel(pct)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {pct}%
            </Typography>
          </ProgressCaptionRow>
          <BrandLinearProgress
            variant="determinate"
            value={pct}
            tone={isComplete ? 'success' : 'primary'}
          />
        </ProgressStack>
      </TableCell>
    </ClickableTableRow>
  );
};

export default ScheduleList;
