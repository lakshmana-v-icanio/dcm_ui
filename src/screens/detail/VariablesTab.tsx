import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, GripVertical, TrendingUp, Hash, Calendar, AlignLeft } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { ClassifiedVariable } from '../../api/aiVariables';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { Snackbar } from '../../components/ui/Snackbar';
import { cn } from '../../lib/cn';

type VarType = 'Discrete' | 'Continuous' | 'Date' | 'String';

export interface VariableItem {
  id: string;
  name: string;
  type: VarType;
  description: string;
  values: string[];
}

const buildDescription = (v: ClassifiedVariable): string => {
  if (v.type === 'Continuous') return 'Numeric ranges / buckets';
  if (v.type === 'Date') return 'Calendar date';
  if (v.type === 'String') return 'Free-text / unique per row';
  if (!v.values || v.values.length === 0) return '(no labels reported)';
  const preview = v.values.slice(0, 4).join(', ');
  return v.values.length > 4 ? `${preview}, +${v.values.length - 4} more` : preview;
};

const toVariableItems = (list: ClassifiedVariable[]): VariableItem[] =>
  list.map((v, i) => ({
    id: `${v.name}-${i}`,
    name: v.name,
    type: (['Discrete', 'Continuous', 'Date', 'String'] as VarType[]).includes(v.type as VarType) ? (v.type as VarType) : 'String',
    description: buildDescription(v),
    values: v.type === 'Discrete' ? (v.values ?? []) : [],
  }));

const COLUMN_META: Record<VarType, { title: string; icon: ReactNode; accent: string; bg: string; border: string; badge: string }> = {
  Discrete:   { title: 'Discrete',   icon: <Hash className="w-4 h-4" />,        accent: '#4f46e5', bg: 'bg-indigo-50',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700' },
  Continuous: { title: 'Continuous', icon: <TrendingUp className="w-4 h-4" />,  accent: '#06b6d4', bg: 'bg-cyan-50',    border: 'border-cyan-200',    badge: 'bg-cyan-100 text-cyan-700' },
  Date:       { title: 'Date',       icon: <Calendar className="w-4 h-4" />,    accent: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  String:     { title: 'String',     icon: <AlignLeft className="w-4 h-4" />,   accent: '#ef4444', bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-100 text-red-700' },
};

const COLUMN_ORDER: VarType[] = ['Discrete', 'Continuous', 'Date', 'String'];

/* ---- Variable card ---- */
interface VariableCardProps { variable: VariableItem; accent: string; dragging?: boolean; }

const VariableCard = ({ variable, accent, dragging = false }: VariableCardProps) => (
  <div className={cn(
    'p-3 bg-white rounded-xl border border-l-4 flex items-start gap-2 select-none border-slate-100 transition-all',
    dragging ? 'shadow-2xl' : 'shadow-none hover:-translate-y-0.5 hover:shadow-md'
  )} style={{ borderLeftColor: accent }}>
    <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 shrink-0 cursor-grab active:cursor-grabbing" />
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-900 break-words">{variable.name}</p>
      <p className="text-xs text-slate-500 mt-0.5">{variable.description}</p>
    </div>
  </div>
);

/* ---- Draggable card ---- */
interface DraggableCardProps { variable: VariableItem; accent: string; }

const DraggableCard = ({ variable, accent }: DraggableCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: variable.id, data: { variable } });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <VariableCard variable={variable} accent={accent} />
    </div>
  );
};

/* ---- Droppable column ---- */
interface ColumnProps { type: VarType; items: VariableItem[]; }

const Column = ({ type, items }: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: type });
  const meta = COLUMN_META[type];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'p-3 rounded-2xl border-2 border-dashed min-h-[320px] flex flex-col gap-3 transition-all',
        meta.bg,
        isOver ? meta.border : 'border-slate-200',
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span style={{ color: meta.accent }}>{meta.icon}</span>
          <span className="text-sm font-bold text-slate-800">{meta.title}</span>
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', meta.badge)}>{items.length}</span>
      </div>
      {items.length === 0 && <p className="text-xs text-slate-400 mt-1">Drop variables here.</p>}
      {items.map((v) => <DraggableCard key={v.id} variable={v} accent={meta.accent} />)}
    </div>
  );
};

/* ---- Main tab ---- */
interface VariablesTabProps {
  classified?: ClassifiedVariable[];
  loading?: boolean;
  error?: string | null;
  onVariablesChange?: (items: VariableItem[]) => void;
}

const VariablesTab = ({ classified, loading = false, error = null, onVariablesChange }: VariablesTabProps) => {
  const [variables, setVariables] = useState<VariableItem[]>(() => toVariableItems(classified ?? []));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (classified) {
      const items = toVariableItems(classified);
      setVariables(items);
      onVariablesChange?.(items);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classified]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = COLUMN_ORDER.reduce<Record<VarType, VariableItem[]>>((acc, key) => {
    acc[key] = variables.filter((v) => v.type === key);
    return acc;
  }, { Discrete: [], Continuous: [], Date: [], String: [] });

  const activeVar = activeId ? variables.find((v) => v.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const targetType = String(over.id) as VarType;
    if (!COLUMN_ORDER.includes(targetType)) return;
    setVariables((prev) => {
      const next = prev.map((v) => {
        if (v.id !== active.id) return v;
        if (v.type === targetType) return v;
        setToast(`Moved "${v.name}" to ${targetType}`);
        return { ...v, type: targetType, values: targetType === 'Discrete' ? v.values : [] };
      });
      onVariablesChange?.(next);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Variables</h2>
          <p className="text-sm text-slate-500">Drag any card into another column to change its type.</p>
        </div>
        <Button variant="contained" color="primary" startIcon={<Plus className="w-4 h-4" />} onClick={() => setToast('Create Variable — coming soon')}>
          Create Variable
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 mb-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50">
          <Spinner size={22} />
          <div>
            <p className="text-sm font-bold text-slate-900">Classifying variables with AI…</p>
            <p className="text-xs text-slate-500">Analysing the rate-table columns and grouping distinct values.</p>
          </div>
        </div>
      )}

      {error && !loading && <Alert severity="error" className="mb-3">{error}</Alert>}

      {!loading && !error && variables.length === 0 && (
        <Alert severity="info" className="mb-3">
          No variables yet — build a rate table and click <strong>Next</strong> to run the AI classifier.
        </Alert>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMN_ORDER.map((type) => <Column key={type} type={type} items={grouped[type]} />)}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeVar ? <VariableCard variable={activeVar} accent={COLUMN_META[activeVar.type].accent} dragging /> : null}
        </DragOverlay>
      </DndContext>

      <Snackbar open={!!toast} onClose={() => setToast(null)} autoHideDuration={2500} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </div>
  );
};

export default VariablesTab;
