import { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import AppLayout from './components/layout/AppLayout';
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
  <Box sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
    <Typography variant="h5" color="text.secondary" sx={{ mt: 6 }}>
      {label}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
      This section is coming soon.
    </Typography>
  </Box>
);

// 'wizard' covers both flows: creating a new schedule and resuming an existing one.
type ScheduleMode = 'list' | 'wizard';

function App() {
  const [active, setActive] = useState('schedules');
  const [mode, setMode] = useState<ScheduleMode>('list');
  const [selectedSchedule, setSelectedSchedule] = useState<PcScheduleDto | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const meta = useMemo(() => {
    if (active !== 'schedules') return TITLES[active] ?? TITLES.schedules;
    if (mode === 'wizard') {
      return selectedSchedule
        ? {
            title: `Schedule ${selectedSchedule.scheduleId}`,
            subtitle:
              selectedSchedule.description ||
              'Rate table, variables & methodologies',
          }
        : {
            title: 'New PC Schedule',
            subtitle:
              'Guided setup: schedule, rate table, variables, methodologies',
          };
    }
    return TITLES.schedules;
  }, [active, mode, selectedSchedule]);

  const handleSelectNav = (key: string) => {
    setActive(key);
    setMode('list');
    setSelectedSchedule(null);
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
    setSelectedSchedule(null);
    setMode('list');
  };

  const finishWizard = () => {
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
    </AppLayout>
  );
}

export default App;
