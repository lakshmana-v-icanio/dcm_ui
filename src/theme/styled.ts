import {
  Box,
  Button,
  Chip,
  LinearProgress,
  linearProgressClasses,
  Paper,
  TableCell,
  TableRow,
  buttonClasses,
  type ButtonProps,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import type { ElementType } from 'react';

/**
 * Reusable styled primitives.
 *
 * These wrap raw MUI components with the project's brand tokens so screens
 * stay `sx`-free. Add here, not inline, whenever the same visual pattern
 * shows up in more than one screen.
 */

/**
 * Primary CTA carrying the brand gradient. Falls back to disabled state cleanly.
 * The `component` prop is threaded through the generic so callers can render as
 * `<label>` for file-input triggers.
 */
export const BrandButton = styled(Button)<
  ButtonProps & { component?: ElementType }
>(({ theme }) => ({
  minWidth: 200,
  background: theme.brand.gradient,
  color: theme.palette.primary.contrastText,
  [`&.${buttonClasses.disabled}`]: {
    background: theme.palette.action.disabledBackground,
    color: theme.palette.action.disabled,
  },
}));

/** Elevated card with the brand shadow + hairline border. Use for tables, forms, panels. */
export const SurfaceCard = styled(Paper)(({ theme }) => ({
  border: theme.brand.hairline,
  boxShadow: theme.brand.cardShadow,
  overflow: 'hidden',
}));

/** Panel-style card without shadow — use inside a page as a content section. */
export const PanelCard = styled(Paper)(({ theme }) => ({
  border: theme.brand.hairline,
  padding: theme.spacing(3),
}));

/**
 * LinearProgress driven by the brand gradient. Pass `tone="success"` when a row
 * is complete to swap the gradient. Height tunable via `barHeight` prop.
 * `tone` is deliberately named — MUI's own `variant` prop drives determinate /
 * indeterminate and stays untouched.
 */
type BrandProgressProps = { tone?: 'primary' | 'success'; barHeight?: number };
export const BrandLinearProgress = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== 'tone' && prop !== 'barHeight',
})<BrandProgressProps>(({ theme, tone = 'primary', barHeight = 6 }) => ({
  height: barHeight,
  borderRadius: barHeight / 2,
  backgroundColor: 'rgba(15, 23, 42, 0.06)',
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: barHeight / 2,
    background:
      tone === 'success' ? theme.brand.gradientSuccess : theme.brand.gradient,
  },
}));

/** Thin indeterminate loader — for the top of a table while re-fetching. */
export const InlineLoader = styled(LinearProgress)(({ theme }) => ({
  height: 2,
  [`& .${linearProgressClasses.bar}`]: { background: theme.brand.gradient },
}));

/** Table head with the brand wash + bold cells. Use as `<StyledTableHead>` around `<TableRow>`. */
export const StyledTableHeadRow = styled(TableRow)(({ theme }) => ({
  '& th': {
    fontWeight: 700,
    color: theme.palette.text.primary,
    // Opaque base + translucent wash on top. Without the solid backgroundColor the
    // header wash is nearly transparent, so with `stickyHeader` the scrolling rows
    // show through and overlap the header text.
    backgroundColor: theme.palette.background.paper,
    backgroundImage: theme.brand.tableHeaderWash,
    borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
  },
}));

/** Clickable table row with hover transition — used in list screens. */
export const ClickableTableRow = styled(TableRow)({
  cursor: 'pointer',
  transition: 'background-color 120ms ease',
  '&:last-child td': { border: 0 },
});

/** Wide leading cell wrapper for the progress column. */
export const ProgressCell = styled(TableCell)({ minWidth: 220 });

/** Page container with responsive padding and max-width constraint. */
export const PageContainer = styled(Box)(({ theme }) => ({
  paddingBlock: theme.spacing(4),
  paddingInline: theme.spacing(2),
  [theme.breakpoints.down('md')]: {
    paddingBlock: theme.spacing(3),
    paddingInline: theme.spacing(1),
  },
}));

/** Centered content lane inside a PageContainer. */
export const PageLane = styled(Box)({
  maxWidth: '100%',
  marginInline: 'auto',
});

/** Right-aligned action bar (buttons row above tables/forms). */
export const ActionBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(3),
}));

/** Row that stacks label + value at the top of a progress cell. */
export const ProgressCaptionRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
});

/** Column layout for progress cell contents (label row + bar). */
export const ProgressStack = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));

/** Container laying out the wizard at a narrower max-width than list pages. */
export const WizardLane = styled(Box)({
  maxWidth: '100%',
  marginInline: 'auto',
});

/** Header row above the wizard (back-button + title + status chip). */
export const WizardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
}));

/** Subtle IconButton for header-back — reads as "escape hatch", not primary action. */
export const SubtleIconButton = styled(Box)({});

/** Card used for the wizard's step content — same silhouette as SurfaceCard but with padding. */
export const StepCard = styled(Paper)(({ theme }) => ({
  border: theme.brand.hairline,
  boxShadow: theme.brand.cardShadow,
  padding: theme.spacing(4),
  minHeight: 360,
  [theme.breakpoints.down('md')]: { padding: theme.spacing(3) },
}));

/** Card for the stepper + overall-progress panels (no shadow, hairline border). */
export const WizardPanel = styled(Paper)(({ theme }) => ({
  border: theme.brand.hairline,
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

/** Slim caption row above the overall-progress bar. */
export const OverallProgressCaption = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(1),
}));

/** Footer row with Back on the left, primary action on the right. */
export const WizardFooter = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

/** Preformatted code block used to render generated methodology drafts. */
export const CodePre = styled('pre')(({ theme }) => ({
  fontFamily:
    '"Fira Code", "SF Mono", Menlo, Consolas, "Courier New", monospace',
  fontSize: theme.typography.pxToRem(13),
  whiteSpace: 'pre-wrap',
  margin: 0,
}));

/** Card wrapping an AI-generated draft — outlined, pre-wrapped, subtle padding. */
export const DraftCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.5),
  whiteSpace: 'pre-wrap',
}));

/** Dashed drop-zone with a soft brand tint — used by RateTableStep. */
export const DropZone = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  textAlign: 'center',
  borderStyle: 'dashed',
  borderColor: alpha(theme.palette.primary.main, 0.4),
  background: `linear-gradient(135deg, ${alpha(
    theme.palette.primary.main,
    0.04,
  )} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
}));

/**
 * Colour-encoded schedule-type chip. Uses palette tokens with alpha so we don't
 * hard-code rgba() in components.
 */
type TypeChipVariant = 'primary' | 'secondary';
export const TypeChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'colorVariant',
})<{ colorVariant: TypeChipVariant }>(({ theme, colorVariant }) => {
  const paletteColor =
    colorVariant === 'primary'
      ? theme.palette.primary
      : theme.palette.secondary;
  return {
    fontWeight: 600,
    backgroundColor: alpha(paletteColor.main, 0.12),
    color: colorVariant === 'primary' ? paletteColor.main : paletteColor.dark,
  };
});
