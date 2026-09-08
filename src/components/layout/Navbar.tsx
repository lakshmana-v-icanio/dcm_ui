import {
  AppBar,
  Box,
  Toolbar,
  Typography,
} from '@mui/material';

interface NavbarProps {
  title: string;
  subtitle?: string;
  sidebarWidth: number;
}

const Navbar = ({ title, subtitle, sidebarWidth }: NavbarProps) => {
  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${sidebarWidth}px)`,
        ml: `${sidebarWidth}px`,
        transition: 'width 220ms ease, margin 220ms ease',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(14px)',
        color: 'text.primary',
        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
      }}
    >
      <Toolbar sx={{ minHeight: 72, gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
