import { createTheme } from '@mui/material/styles';

/**
 * Design tokens exposed to every component via the MUI theme.
 *
 * Rules of the road for this project:
 *   1. Never hard-code a hex color inside a component — reach for `theme.palette` or
 *      `theme.brand` instead. Colors live here, layout lives in components.
 *   2. Repeated visual motifs (brand gradient, tinted-row background, table-header wash)
 *      are named tokens under `brand`, referenced by name at call sites.
 *   3. Component-scoped overrides use `styleOverrides` below rather than per-usage `sx`.
 */

declare module '@mui/material/styles' {
  interface Theme {
    brand: {
      gradient: string;
      gradientSoft: string;
      gradientSuccess: string;
      cardShadow: string;
      buttonShadow: string;
      buttonShadowHover: string;
      hairline: string;
      tableHeaderWash: string;
      rowHoverWash: string;
    };
  }
  interface ThemeOptions {
    brand?: Partial<Theme['brand']>;
  }
}

const PRIMARY = '#4f46e5';
const SECONDARY = '#06b6d4';
const SUCCESS = '#10b981';

const brand = {
  gradient: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`,
  gradientSoft: `linear-gradient(135deg, rgba(79, 70, 229, 0.10) 0%, rgba(6, 182, 212, 0.08) 100%)`,
  gradientSuccess: `linear-gradient(135deg, ${SUCCESS} 0%, ${SECONDARY} 100%)`,
  cardShadow: '0 20px 60px -30px rgba(15, 23, 42, 0.20)',
  buttonShadow: '0 6px 20px -6px rgba(79, 70, 229, 0.55)',
  buttonShadowHover: '0 8px 24px -6px rgba(79, 70, 229, 0.70)',
  hairline: '1px solid rgba(15, 23, 42, 0.06)',
  tableHeaderWash: `linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%)`,
  rowHoverWash: 'rgba(15, 23, 42, 0.04)',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: PRIMARY, light: '#818cf8', dark: '#3730a3', contrastText: '#ffffff' },
    secondary: { main: SECONDARY, light: '#67e8f9', dark: '#0e7490' },
    success: { main: SUCCESS },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    background: { default: '#f5f7fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#475569' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.5px' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  brand,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 20,
          paddingBlock: 10,
          '&.MuiButton-containedPrimary': { boxShadow: brand.buttonShadow },
          '&.MuiButton-containedPrimary:hover': {
            boxShadow: brand.buttonShadowHover,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#ffffff',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: PRIMARY,
            borderWidth: 2,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 18 },
      },
    },
  },
});

export default theme;
