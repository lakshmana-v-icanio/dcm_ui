import { useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Toolbar } from '@mui/material';
import Sidebar, { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from './Sidebar';
import Navbar from './Navbar';

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  active: string;
  onSelect: (key: string) => void;
  children: ReactNode;
}

const AppLayout = ({ title, subtitle, active, onSelect, children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        active={active}
        onSelect={onSelect}
      />
      <Navbar title={title} subtitle={subtitle} sidebarWidth={sidebarWidth} />

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          transition: 'margin 220ms ease',
        }}
      >
        <Toolbar sx={{ minHeight: 72 }} />
        {children}
      </Box>
    </Box>
  );
};

export default AppLayout;
