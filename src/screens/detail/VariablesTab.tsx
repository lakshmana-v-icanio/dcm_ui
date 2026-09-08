import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Snackbar,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import Filter1RoundedIcon from '@mui/icons-material/Filter1Rounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
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

type VarType = 'Discrete' | 'Continuous' | 'Date' | 'String';

export interface VariableItem {
  id: string;
  name: string;
  type: VarType;
  description: string;
  /** Actual value labels — populated for Discrete; empty for all other types. */
  values: string[];
}

const buildDescription = (v: ClassifiedVariable): string => {
  // Discrete → list labels; the other three are field-name only.
  if (v.type === 'Continuous') return 'Numeric ranges / buckets';
  if (v.type === 'Date')       return 'Calendar date';
  if (v.type === 'String')     return 'Free-text / unique per row';
  // Discrete
  if (!v.values || v.values.length === 0) return '(no labels reported)';
  const preview = v.values.slice(0, 4).join(', ');
  return v.values.length > 4 ? `${preview}, +${v.values.length - 4} more` : preview;
};

const toVariableItems = (list: ClassifiedVariable[]): VariableItem[] =>
  list.map((v, i) => ({
    id: `${v.name}-${i}`,
    name: v.name,
    type: (['Discrete', 'Continuous', 'Date', 'String'] as VarType[]).includes(
      v.type as VarType,
    )
      ? (v.type as VarType)
      : 'String',
    description: buildDescription(v),
    values: v.type === 'Discrete' ? (v.values ?? []) : [],
  }));

const COLUMN_META: Record<
  VarType,
  { title: string; icon: ReactNode; accent: string; bg: string; chipFg: string }
> = {
  Discrete:   { title: 'Discrete',   icon: <Filter1RoundedIcon />,        accent: '#4f46e5', bg: 'rgba(79, 70, 229, 0.08)', chipFg: 'primary.main'   },
  Continuous: { title: 'Continuous', icon: <TimelineRoundedIcon />,       accent: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)', chipFg: 'secondary.dark' },
  Date:       { title: 'Date',       icon: <CalendarMonthRoundedIcon />,  accent: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', chipFg: 'warning.dark'   },
  String:     { title: 'String',     icon: <TextFieldsRoundedIcon />,     accent: '#ef4444', bg: 'rgba(239, 68, 68, 0.10)',  chipFg: 'error.dark'     },
};

const COLUMN_ORDER: VarType[] = ['Discrete', 'Continuous', 'Date', 'String'];

/* ------------------------------------------------------------------------- */
/*  Draggable card                                                            */
/* ------------------------------------------------------------------------- */

interface VariableCardProps {
  variable: VariableItem;
  accent: string;
  dragging?: boolean;
}

const VariableCard = ({ variable, accent, dragging = false }: VariableCardProps) => (
  <Card
    elevation={0}
    sx={{
      p: 1.5,
      background: '#fff',
      border: '1px solid rgba(15, 23, 42, 0.06)',
      borderLeft: `4px solid ${accent}`,
      borderRadius: 2,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 1,
      cursor: 'grab',
      transition: 'transform 120ms ease, box-shadow 120ms ease',
      boxShadow: dragging
        ? '0 20px 40px -10px rgba(15, 23, 42, 0.35)'
        : 'none',
      '&:hover': {
        transform: dragging ? undefined : 'translateY(-1px)',
        boxShadow: dragging
          ? '0 20px 40px -10px rgba(15, 23, 42, 0.35)'
          : '0 10px 24px -14px rgba(15, 23, 42, 0.25)',
      },
      '&:active': { cursor: 'grabbing' },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 0, flex: 1 }}>
      <DragIndicatorRoundedIcon
        fontSize="small"
        sx={{ color: 'text.disabled', mt: 0.25, flexShrink: 0 }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
          {variable.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.25 }}
        >
          {variable.description}
        </Typography>
      </Box>
    </Box>
  </Card>
);

interface DraggableCardProps {
  variable: VariableItem;
  accent: string;
}

const DraggableCard = ({ variable, accent }: DraggableCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: variable.id,
    data: { variable },
  });

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

/* ------------------------------------------------------------------------- */
/*  Droppable column                                                          */
/* ------------------------------------------------------------------------- */

interface ColumnProps {
  type: VarType;
  items: VariableItem[];
}

const Column = ({ type, items }: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: type });
  const meta = COLUMN_META[type];

  return (
    <Box
      ref={setNodeRef}
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px dashed',
        borderColor: isOver ? meta.accent : 'rgba(15, 23, 42, 0.06)',
        background: meta.bg,
        minHeight: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        transition: 'border-color 120ms ease, background 120ms ease',
        boxShadow: isOver ? `inset 0 0 0 2px ${meta.accent}22` : 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: meta.accent, display: 'flex' }}>{meta.icon}</Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {meta.title}
          </Typography>
        </Box>
        <Chip
          label={items.length}
          size="small"
          sx={{ fontWeight: 700, bgcolor: '#fff', color: meta.chipFg }}
        />
      </Box>

      {items.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Drop variables here.
        </Typography>
      )}

      {items.map((v) => (
        <DraggableCard key={v.id} variable={v} accent={meta.accent} />
      ))}
    </Box>
  );
};

/* ------------------------------------------------------------------------- */
/*  Main tab                                                                  */
/* ------------------------------------------------------------------------- */

interface VariablesTabProps {
  classified?: ClassifiedVariable[];
  loading?: boolean;
  error?: string | null;
  onVariablesChange?: (items: VariableItem[]) => void;
}

const VariablesTab = ({ classified, loading = false, error = null, onVariablesChange }: VariablesTabProps) => {
  const [variables, setVariables] = useState<VariableItem[]>(() =>
    toVariableItems(classified ?? []),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // When new classification arrives from AI, reset the board and notify parent
  useEffect(() => {
    if (classified) {
      const items = toVariableItems(classified);
      setVariables(items);
      onVariablesChange?.(items);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classified]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small activation distance so clicks on IconButtons still work
      activationConstraint: { distance: 6 },
    }),
  );

  const grouped = COLUMN_ORDER.reduce<Record<VarType, VariableItem[]>>(
    (acc, key) => {
      acc[key] = variables.filter((v) => v.type === key);
      return acc;
    },
    { Discrete: [], Continuous: [], Date: [], String: [] },
  );

  const activeVar = activeId ? variables.find((v) => v.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

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
        // Clear pre-classified values when moving away from Discrete so the
        // builder falls back to extracting them from the parsed table column.
        const values = targetType === 'Discrete' ? v.values : [];
        return { ...v, type: targetType, values };
      });
      onVariablesChange?.(next);
      return next;
    });
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Variables
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drag any card into another column to change its type.
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={<AddRoundedIcon />}
          onClick={() => setToast('Create Variable — coming soon')}
          sx={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            minWidth: 200,
          }}
        >
          Create Variable
        </Button>
      </Box>

      {loading && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 3,
            mb: 2,
            borderRadius: 3,
            border: '1px dashed rgba(79, 70, 229, 0.3)',
            background:
              'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(6, 182, 212, 0.05) 100%)',
          }}
        >
          <CircularProgress size={22} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Classifying variables with AI…
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Analysing the rate-table columns and grouping distinct values.
            </Typography>
          </Box>
        </Box>
      )}

      {error && !loading && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && variables.length === 0 && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          No variables yet — build a rate table and click <strong>Next</strong> to
          run the AI classifier.
        </Alert>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {COLUMN_ORDER.map((type) => (
            <Column key={type} type={type} items={grouped[type]} />
          ))}
        </Box>

        <DragOverlay dropAnimation={null}>
          {activeVar ? (
            <VariableCard
              variable={activeVar}
              accent={COLUMN_META[activeVar.type].accent}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>


      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToast(null)} severity="success" variant="filled" sx={{ borderRadius: 2 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VariablesTab;
