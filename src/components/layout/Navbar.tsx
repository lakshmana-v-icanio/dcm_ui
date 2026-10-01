import {
  AppBar,
  Box,
  Divider,
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
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 2 }}>
        <Box>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, lineHeight: 1.15, fontSize: '1rem' }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1 }} />
      </Toolbar>
      <Divider />
    </AppBar>
  );
};

export default Navbar;
