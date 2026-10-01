import { useState } from 'react';
import {
  Box,
  Button,
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
import { TypeChip } from '../theme/styled';

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
    <Box sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>

        {/* Breadcrumb / back navigation */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant="text"
            startIcon={<ArrowBackRoundedIcon fontSize="small" />}
            onClick={onBack}
            size="small"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              px: 1,
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            }}
          >
            PC Schedules
          </Button>
        </Box>

        {/* Schedule identity card */}
        <Box
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: 'primary.main',
            bgcolor: 'background.paper',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                Schedule
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.25, lineHeight: 1.2 }}>
                {schedule.scheduleId}
              </Typography>
              {schedule.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {schedule.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                    Start Date
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {schedule.startDate ?? '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                    End Date
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {schedule.endDate ?? '—'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <TypeChip
              label={schedule.scheduleType}
              size="small"
              colorVariant={schedule.scheduleType === 'PCE' ? 'primary' : 'secondary'}
            />
          </Box>
        </Box>

        {/* Tab navigation */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={active}
            onChange={(_, val: TabKey) => setActive(val)}
            slotProps={{
              indicator: {
                sx: { height: 2, bgcolor: 'primary.main', borderRadius: 0 },
              },
            }}
            sx={{ minHeight: 44 }}
          >
            <Tab
              value="rate-tables"
              label="Rate Tables"
              icon={<GridViewRoundedIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              sx={{ fontWeight: 600, textTransform: 'none', minHeight: 44, fontSize: '0.875rem' }}
            />
            <Tab
              value="variables"
              label="Variables"
              icon={<ViewModuleRoundedIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              sx={{ fontWeight: 600, textTransform: 'none', minHeight: 44, fontSize: '0.875rem' }}
            />
            <Tab
              value="methodologies"
              label="Methodologies"
              icon={<PlayCircleFilledRoundedIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              sx={{ fontWeight: 600, textTransform: 'none', minHeight: 44, fontSize: '0.875rem' }}
            />
          </Tabs>
        </Box>

        {/*
          All three tab bodies stay mounted; only the active one is visible.
          This preserves each tab's internal state across tab switches.
        */}
        <Box sx={{ display: active === 'rate-tables' ? 'block' : 'none' }}>
          <RateTableTab onNext={handleClassifyAndAdvance} nextLoading={classifying} />
        </Box>
        <Box sx={{ display: active === 'variables' ? 'block' : 'none' }}>
          <VariablesTab classified={classified} loading={classifying} error={classifyError} />
        </Box>
        <Box sx={{ display: active === 'methodologies' ? 'block' : 'none' }}>
          <MethodologiesTab />
        </Box>
      </Box>
    </Box>
  );
};

export default ScheduleDetail;
