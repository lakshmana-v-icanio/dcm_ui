import { createTheme } from '@mui/material/styles';

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
      tableHeaderBg: string;
      rowHoverWash: string;
    };
  }
  interface ThemeOptions {
    brand?: Partial<Theme['brand']>;
  }
}

const PRIMARY = '#1A56DB';   // Professional enterprise blue
const SECONDARY = '#64748B'; // Professional slate gray
const SUCCESS = '#16A34A';   // Clean green

const brand = {
  gradient: PRIMARY,
  gradientSoft: `rgba(26, 86, 219, 0.06)`,
  gradientSuccess: SUCCESS,
  cardShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
  buttonShadow: 'none',
  buttonShadowHover: '0 2px 8px -2px rgba(26, 86, 219, 0.30)',
  hairline: '1px solid rgba(0, 0, 0, 0.10)',
  tableHeaderBg: '#F1F5F9',
  rowHoverWash: 'rgba(0, 0, 0, 0.03)',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: PRIMARY, light: '#3B82F6', dark: '#1E3A8A', contrastText: '#ffffff' },
    secondary: { main: SECONDARY, light: '#94A3B8', dark: '#334155' },
    success: { main: SUCCESS },
    error: { main: '#DC2626' },
    warning: { main: '#D97706' },
    background: { default: '#F8FAFC', paper: '#ffffff' },
    text: { primary: '#0F172A', secondary: '#475569' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.25px' },
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
          borderRadius: 6,
          paddingInline: 20,
          paddingBlock: 9,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
          '&.MuiButton-containedPrimary:hover': {
            boxShadow: brand.buttonShadowHover,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: '#ffffff',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#93C5FD' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: PRIMARY,
            borderWidth: 2,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 10 },
        elevation1: { boxShadow: brand.cardShadow },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: 'rgba(0,0,0,0.08)' },
      },
    },
  },
});

export default theme;
