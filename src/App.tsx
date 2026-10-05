import { useMemo, useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import ConfirmDialog from './components/common/ConfirmDialog';
import ScheduleList from './screens/ScheduleList';
import ScheduleWizard from './screens/wizard/ScheduleWizard';
import type { PcScheduleDto } from './api/pcSchedule';

const TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your compensation programme' },
  schedules: { title: 'PC Schedules', subtitle: 'Manage primary compensation schedules' },
  products: { title: 'Products', subtitle: 'Product catalog and mappings' },
  producers: { title: 'Producers', subtitle: 'Agents, licensing and appointments' },
  transactions: { title: 'Transactions', subtitle: 'Recent policy and commission events' },
  reports: { title: 'Reports', subtitle: 'Business insights and analytics' },
  settings: { title: 'Settings', subtitle: 'Configure your workspace' },
};

const Placeholder = ({ label }: { label: string }) => (
  <div className="p-12 text-center">
    <h2 className="text-xl font-semibold text-slate-400 mt-12">{label}</h2>
    <p className="text-sm text-slate-400 mt-1">This section is coming soon.</p>
  </div>
);

type ScheduleMode = 'list' | 'wizard';

const CLASSIFY_LEAVE_MESSAGE =
  'AI Variable Classification is in progress. If you leave now the process may be interrupted. Leave anyway?';

function App() {
  const [active, setActive] = useState('schedules');
  const [mode, setMode] = useState<ScheduleMode>('list');
  const [selectedSchedule, setSelectedSchedule] = useState<PcScheduleDto | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [pendingNavKey, setPendingNavKey] = useState<string | null>(null);

  const meta = useMemo(() => {
    if (active !== 'schedules') return TITLES[active] ?? TITLES.schedules;
    if (mode === 'wizard') {
      return selectedSchedule
        ? {
            title: `Schedule ${selectedSchedule.scheduleId}`,
            subtitle: selectedSchedule.description || 'Rate table, variables & methodologies',
          }
        : {
            title: 'New PC Schedule',
            subtitle: 'Guided setup: schedule, rate table, variables, methodologies',
          };
    }
    return TITLES.schedules;
  }, [active, mode, selectedSchedule]);

  const doSelectNav = (key: string) => {
    setClassifying(false);
    setActive(key);
    setMode('list');
    setSelectedSchedule(null);
  };

  const handleSelectNav = (key: string) => {
    if (classifying) {
      setPendingNavKey(key);
      return;
    }
    doSelectNav(key);
  };

  const openSchedule = (s: PcScheduleDto) => {
    setSelectedSchedule(s);
    setMode('wizard');
  };

  const openNewWizard = () => {
    setSelectedSchedule(null);
    setMode('wizard');
  };

  const closeWizard = () => {
    setClassifying(false);
    setSelectedSchedule(null);
    setMode('list');
  };

  const finishWizard = () => {
    setClassifying(false);
    setSelectedSchedule(null);
    setMode('list');
    setFlash('Schedule setup complete');
  };

  const renderScreen = () => {
    if (active !== 'schedules') return <Placeholder label={meta.title} />;
    if (mode === 'wizard') {
      return (
        <ScheduleWizard
          onCancel={closeWizard}
          onFinish={finishWizard}
          existingSchedule={selectedSchedule ?? undefined}
          onClassifyingChange={setClassifying}
        />
      );
    }
    return (
      <ScheduleList
        onOpen={openSchedule}
        onCreate={openNewWizard}
        flashMessage={flash}
        onFlashConsumed={() => setFlash(null)}
      />
    );
  };

  return (
    <AppLayout
      title={meta.title}
      subtitle={meta.subtitle}
      active={active}
      onSelect={handleSelectNav}
    >
      {renderScreen()}

      <ConfirmDialog
        open={pendingNavKey !== null}
        title="Classification in progress"
        message={CLASSIFY_LEAVE_MESSAGE}
        onConfirm={() => {
          if (pendingNavKey) doSelectNav(pendingNavKey);
          setPendingNavKey(null);
        }}
        onCancel={() => setPendingNavKey(null)}
      />
    </AppLayout>
  );
}

export default App;
