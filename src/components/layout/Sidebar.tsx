import { CalendarDays, Menu, PanelLeftClose } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const SIDEBAR_WIDTH_EXPANDED = 248;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'schedules', label: 'PC Schedules', icon: <CalendarDays className="w-5 h-5" /> },
];

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  active: string;
  onSelect: (key: string) => void;
}

const Sidebar = ({ open, onToggle, active, onSelect }: SidebarProps) => (
  <aside
    className="fixed top-0 left-0 h-screen flex flex-col bg-sidebar text-slate-400 z-40 overflow-hidden transition-all duration-200 ease-in-out border-r border-white/5"
    style={{ width: open ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED }}
  >
    {/* Brand header */}
    <div className={cn('h-16 flex items-center shrink-0 border-b border-white/5', open ? 'px-4 justify-between' : 'px-2 justify-center')}>
      {open && (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
            PC
          </div>
          <div className="min-w-0">
            <p className="text-slate-50 font-bold text-[0.9375rem] leading-tight">PCM</p>
            <p className="text-slate-400/55 text-[0.6875rem] leading-tight">Compensation</p>
          </div>
        </div>
      )}
      <button
        onClick={onToggle}
        className="p-1.5 rounded-md text-slate-400/70 hover:text-white hover:bg-white/5 transition-colors shrink-0"
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {open ? <PanelLeftClose className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
    </div>

    {/* Nav section */}
    <div className="flex-1 flex flex-col pt-4 overflow-hidden">
      {open && (
        <p className="px-4 pb-2 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase text-slate-400/35">
          Navigation
        </p>
      )}
      <nav className="px-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const selected = item.key === active;
          const btn = (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              title={!open ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 w-full rounded-[6px] min-h-[40px] transition-colors duration-100 relative',
                open ? 'px-3 justify-start' : 'px-0 justify-center',
                selected
                  ? 'text-white bg-white/10 border-l-[3px] border-white/70'
                  : 'text-slate-300/80 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent',
                selected && open && 'pl-[9px]',
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {open && (
                <span className={cn('text-sm tracking-[0.01em]', selected ? 'font-semibold' : 'font-normal')}>
                  {item.label}
                </span>
              )}
            </button>
          );
          return btn;
        })}
      </nav>
    </div>
  </aside>
);

export default Sidebar;
