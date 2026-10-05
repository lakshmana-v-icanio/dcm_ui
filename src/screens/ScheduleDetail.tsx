import { useState } from 'react';
import { ArrowLeft, LayoutGrid, Grid3X3, PlayCircle } from 'lucide-react';
import RateTableTab from './detail/RateTableTab';
import VariablesTab from './detail/VariablesTab';
import MethodologiesTab from './detail/MethodologiesTab';
import type { PcScheduleDto } from '../api/pcSchedule';
import { classifyVariables, type ClassifiedVariable } from '../api/aiVariables';
import { TypeChip } from '../theme/styled';
import { Button } from '../components/ui/Button';
import { Tabs, Tab, TabPanel } from '../components/ui/Tabs';

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
    <div className="py-6 px-4 md:py-8 md:px-8">
      <div className="max-w-screen-xl mx-auto">

        {/* Breadcrumb */}
        <div className="mb-4">
          <Button variant="text" color="inherit" startIcon={<ArrowLeft className="w-4 h-4" />} onClick={onBack} size="small">
            PC Schedules
          </Button>
        </div>

        {/* Identity card */}
        <div className="p-5 mb-4 rounded-xl border border-slate-200 border-l-4 border-l-primary-600 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Schedule</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">{schedule.scheduleId}</h2>
              {schedule.description && (
                <p className="text-sm text-slate-500 mt-1.5">{schedule.description}</p>
              )}
              <div className="flex gap-6 mt-3 flex-wrap">
                <div>
                  <p className="text-xs text-slate-400">Start Date</p>
                  <p className="text-sm text-slate-600 font-tabular">{schedule.startDate ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">End Date</p>
                  <p className="text-sm text-slate-600 font-tabular">{schedule.endDate ?? '—'}</p>
                </div>
              </div>
            </div>
            <TypeChip label={schedule.scheduleType} size="small" colorVariant={schedule.scheduleType === 'PCE' ? 'primary' : 'secondary'} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={active} onChange={(v) => setActive(v as TabKey)} className="mb-4">
          <Tab value="rate-tables" label="Rate Tables" icon={<LayoutGrid className="w-4 h-4" />} />
          <Tab value="variables" label="Variables" icon={<Grid3X3 className="w-4 h-4" />} />
          <Tab value="methodologies" label="Methodologies" icon={<PlayCircle className="w-4 h-4" />} />
        </Tabs>

        {/* Tab panels — all kept mounted to preserve state */}
        <TabPanel value="rate-tables" active={active}>
          <RateTableTab onNext={handleClassifyAndAdvance} nextLoading={classifying} />
        </TabPanel>
        <TabPanel value="variables" active={active}>
          <VariablesTab classified={classified} loading={classifying} error={classifyError} />
        </TabPanel>
        <TabPanel value="methodologies" active={active}>
          <MethodologiesTab />
        </TabPanel>
      </div>
    </div>
  );
};

export default ScheduleDetail;
