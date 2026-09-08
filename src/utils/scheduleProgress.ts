/**
 * Per-schedule wizard progress persisted in localStorage.
 *
 * Backend does not track the wizard state today, so we key by `scheduleGid`
 * and store the highest step reached. Steps map to progress percentages:
 *
 *   details        → 30   (schedule created via REST)
 *   rateTable      → 60
 *   variables      → 85
 *   methodologies  → 100
 */

export type WizardStep = 'details' | 'rateTable' | 'variables' | 'methodologies';

export const STEP_PROGRESS: Record<WizardStep, number> = {
  details: 30,
  rateTable: 60,
  variables: 85,
  methodologies: 100,
};

export const STEP_ORDER: WizardStep[] = [
  'details',
  'rateTable',
  'variables',
  'methodologies',
];

const STORAGE_KEY = 'pc_ui.schedule_progress.v1';

type ProgressMap = Record<string, WizardStep>;

const readMap = (): ProgressMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
};

const writeMap = (map: ProgressMap) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private-mode: silently ignore */
  }
};

export const getScheduleStep = (scheduleGid: string): WizardStep | null => {
  const map = readMap();
  return map[scheduleGid] ?? null;
};

export const getScheduleProgress = (scheduleGid: string): number => {
  const step = getScheduleStep(scheduleGid);
  return step ? STEP_PROGRESS[step] : 0;
};

export const setScheduleStep = (scheduleGid: string, step: WizardStep) => {
  const map = readMap();
  const current = map[scheduleGid];
  if (current && STEP_ORDER.indexOf(current) >= STEP_ORDER.indexOf(step)) {
    return;
  }
  map[scheduleGid] = step;
  writeMap(map);
};

export const progressLabel = (progress: number): string => {
  if (progress >= 100) return 'Completed';
  // Rate table + variables persisted → 80%; methodologies is the remaining step.
  if (progress >= 80) return 'Methodologies pending';
  if (progress >= 60) return 'Variables pending';
  if (progress >= 30) return 'Rate table pending';
  return 'Not started';
};
