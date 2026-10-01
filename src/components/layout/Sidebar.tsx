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
import type { ReactNode } from 'react';

export const SIDEBAR_WIDTH_EXPANDED = 248;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'schedules', label: 'PC Schedules', icon: <EventNoteRoundedIcon sx={{ fontSize: 20 }} /> },
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
          mx: 1,
          my: 0.25,
          borderRadius: 1.5,
          minHeight: 40,
          justifyContent: open ? 'flex-start' : 'center',
          px: open ? 1.5 : 1.25,
          position: 'relative',
          color: selected ? '#fff' : 'rgba(203, 213, 225, 0.80)',
          bgcolor: selected ? 'rgba(255,255,255,0.10)' : 'transparent',
          borderLeft: selected ? '3px solid' : '3px solid transparent',
          borderLeftColor: selected ? 'rgba(255,255,255,0.70)' : 'transparent',
          pl: open ? (selected ? 'calc(12px - 3px)' : 1.5) : undefined,
          '&:hover': {
            bgcolor: selected
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(255,255,255,0.05)',
            color: '#fff',
          },
          '&.Mui-selected': { bgcolor: undefined },
          transition: 'background-color 120ms ease, border-color 120ms ease',
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: open ? 1.5 : 0,
            justifyContent: 'center',
            color: 'inherit',
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
                  fontWeight: selected ? 600 : 400,
                  fontSize: '0.875rem',
                  letterSpacing: '0.01em',
                  color: 'inherit',
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
      <Tooltip key={item.key} title={item.label} placement="right" arrow>
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
          background: '#1E293B',
          color: '#CBD5E1',
        },
      }}
    >
      {/* Brand / logo area */}
      <Toolbar
        sx={{
          minHeight: 64,
          px: open ? 2 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {open && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#1A56DB',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.875rem',
                letterSpacing: '-0.5px',
                flexShrink: 0,
              }}
            >
              PC
            </Box>
            <Box>
              <Typography sx={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.1 }}>
                PCM
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.6875rem' }}>
                Compensation
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton
          onClick={onToggle}
          size="small"
          sx={{
            color: 'rgba(203,213,225,0.70)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' },
          }}
        >
          {open ? <MenuOpenRoundedIcon sx={{ fontSize: 20 }} /> : <MenuRoundedIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Toolbar>

      {/* Nav section */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 2 }}>
        {open && (
          <Typography
            sx={{
              px: 2,
              pb: 1,
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(203,213,225,0.35)',
            }}
          >
            Navigation
          </Typography>
        )}
        <List sx={{ py: 0, px: 0 }}>
          {NAV_ITEMS.map(renderItem)}
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
