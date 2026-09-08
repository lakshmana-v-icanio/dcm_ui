import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded';

import RateTableTab from './detail/RateTableTab';
import VariablesTab from './detail/VariablesTab';
import MethodologiesTab from './detail/MethodologiesTab';
import type { PcScheduleDto } from '../api/pcSchedule';
import { classifyVariables, type ClassifiedVariable } from '../api/aiVariables';

interface ScheduleDetailProps {
  schedule: PcScheduleDto;
  onBack: () => void;
}

type TabKey = 'rate-tables' | 'variables' | 'methodologies';

const ScheduleDetail = ({ schedule, onBack }: ScheduleDetailProps) => {
  const [active, setActive] = useState<TabKey>('rate-tables');
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [classified, setClassified] = useState<ClassifiedVariable[] | undefined>(undefined);

  const handleClassifyAndAdvance = async (rows: Record<string, string>[]) => {
    setClassifying(true);
    setClassifyError(null);
    setActive('variables');
    try {
      const result = await classifyVariables(rows);
      setClassified(result);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })
          .response?.data?.message ??
        (err as { message?: string }).message ??
        'Failed to classify variables';
      setClassifyError(message);
      setClassified([]);
    } finally {
      setClassifying(false);
    }
  };

  return (
    <Box
      sx={{
        py: { xs: 3, md: 4 },
        px: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="text"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={onBack}
              sx={{ color: 'text.secondary' }}
            >
              Back to Schedules
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={schedule.scheduleType}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor:
                  schedule.scheduleType === 'PCE'
                    ? 'rgba(79, 70, 229, 0.12)'
                    : 'rgba(6, 182, 212, 0.12)',
                color:
                  schedule.scheduleType === 'PCE'
                    ? 'primary.main'
                    : 'secondary.dark',
              }}
            />
          </Box>
        </Box>

        {/* Schedule identity card */}
        <Box
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid rgba(15, 23, 42, 0.06)',
            background:
              'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%)',
            mb: 3,
          }}
        >
          <Typography variant="overline" color="text.secondary">
            Schedule
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
            {schedule.scheduleId}
          </Typography>
          {schedule.description && (
            <Typography variant="body1" color="text.primary" sx={{ mt: 1 }}>
              {schedule.description}
            </Typography>
          )}
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              mt: 2,
              flexWrap: 'wrap',
              color: 'text.secondary',
              fontSize: 14,
            }}
          >
            <span>
              <strong>Start:</strong> {schedule.startDate}
            </span>
            <span>
              <strong>End:</strong> {schedule.endDate}
            </span>
          </Box>
        </Box>

        {/* Tabs */}
        <Box
          sx={{
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
            mb: 3,
          }}
        >
          <Tabs
            value={active}
            onChange={(_, val: TabKey) => setActive(val)}
            slotProps={{
              indicator: {
                sx: {
                  height: 3,
                  borderRadius: 3,
                  background:
                    'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                },
              },
            }}
          >
            <Tab
              value="rate-tables"
              label="Rate Tables"
              icon={<GridViewRoundedIcon fontSize="small" />}
              iconPosition="start"
              sx={{ fontWeight: 600, textTransform: 'none', minHeight: 48 }}
            />
            <Tab
              value="variables"
              label="Variables"
              icon={<ViewModuleRoundedIcon fontSize="small" />}
              iconPosition="start"
              sx={{ fontWeight: 600, textTransform: 'none', minHeight: 48 }}
            />
            <Tab
              value="methodologies"
              label="Methodologies"
              icon={<PlayCircleFilledRoundedIcon fontSize="small" />}
              iconPosition="start"
              sx={{ fontWeight: 600, textTransform: 'none', minHeight: 48 }}
            />
          </Tabs>
        </Box>

        {/*
          All three tab bodies stay mounted; only the active one is visible.
          This preserves each tab's internal state (rate-table cells, focused
          cell, variable drag positions) across tab switches — otherwise
          unmounting resets useState every time the user navigates away.
        */}
        <Box sx={{ display: active === 'rate-tables' ? 'block' : 'none' }}>
          <RateTableTab onNext={handleClassifyAndAdvance} nextLoading={classifying} />
        </Box>
        <Box sx={{ display: active === 'variables' ? 'block' : 'none' }}>
          <VariablesTab
            classified={classified}
            loading={classifying}
            error={classifyError}
          />
        </Box>
        <Box sx={{ display: active === 'methodologies' ? 'block' : 'none' }}>
          <MethodologiesTab />
        </Box>
      </Box>
    </Box>
  );
};

export default ScheduleDetail;
