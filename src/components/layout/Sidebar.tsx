import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import type { ReactNode } from 'react';

export const SIDEBAR_WIDTH_EXPANDED = 260;
export const SIDEBAR_WIDTH_COLLAPSED = 76;

interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'schedules', label: 'PC Schedules', icon: <EventNoteRoundedIcon /> },
];


interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  active: string;
  onSelect: (key: string) => void;
}

const Sidebar = ({ open, onToggle, active, onSelect }: SidebarProps) => {
  const width = open ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  const renderItem = (item: NavItem) => {
    const selected = item.key === active;
    const button = (
      <ListItemButton
        key={item.key}
        selected={selected}
        onClick={() => onSelect(item.key)}
        sx={{
          mx: 1.25,
          my: 0.5,
          borderRadius: 2,
          minHeight: 46,
          justifyContent: open ? 'flex-start' : 'center',
          px: open ? 1.5 : 1,
          color: selected ? '#fff' : 'rgba(226, 232, 240, 0.85)',
          background: selected
            ? 'linear-gradient(135deg, rgba(129, 140, 248, 0.35) 0%, rgba(6, 182, 212, 0.3) 100%)'
            : 'transparent',
          boxShadow: selected
            ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
            : 'none',
          '&:hover': {
            background: selected
              ? 'linear-gradient(135deg, rgba(129, 140, 248, 0.45) 0%, rgba(6, 182, 212, 0.4) 100%)'
              : 'rgba(255,255,255,0.06)',
          },
          '&.Mui-selected': { background: undefined },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: open ? 2 : 0,
            justifyContent: 'center',
            color: selected ? '#fff' : 'rgba(226, 232, 240, 0.9)',
          }}
        >
          {item.icon}
        </ListItemIcon>
        {open && (
          <ListItemText
            primary={item.label}
            slotProps={{
              primary: {
                sx: {
                  fontWeight: selected ? 700 : 500,
                  fontSize: 14.5,
                  letterSpacing: 0.1,
                },
              },
            }}
          />
        )}
      </ListItemButton>
    );

    return open ? (
      button
    ) : (
      <Tooltip key={item.key} title={item.label} placement="right">
        {button}
      </Tooltip>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        transition: 'width 220ms ease',
        '& .MuiDrawer-paper': {
          width,
          overflowX: 'hidden',
          transition: 'width 220ms ease',
          border: 'none',
          background:
            'linear-gradient(180deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
          color: '#e2e8f0',
        },
      }}
    >
      <Toolbar
        sx={{
          minHeight: 72,
          px: open ? 2.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {open && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                color: '#fff',
                boxShadow: '0 8px 24px -10px rgba(79, 70, 229, 0.8)',
              }}
            >
              <RocketLaunchRoundedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.1 }}
              >
                PCM
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'rgba(226,232,240,0.6)' }}
              >
                Primary Compensation
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton
          onClick={onToggle}
          sx={{
            color: 'rgba(226,232,240,0.85)',
            '&:hover': { background: 'rgba(255,255,255,0.06)' },
          }}
        >
          {open ? <MenuOpenRoundedIcon /> : <MenuRoundedIcon />}
        </IconButton>
      </Toolbar>

      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <List sx={{ flex: 1, py: 1 }}>{NAV_ITEMS.map(renderItem)}</List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
