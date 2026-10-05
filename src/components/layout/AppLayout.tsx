import { useState } from 'react';
import type { ReactNode } from 'react';
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
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        active={active}
        onSelect={onSelect}
      />
      <Navbar title={title} subtitle={subtitle} sidebarWidth={sidebarWidth} />
      <main
        className="flex-1 min-w-0 transition-all duration-200 ease-in-out"
        style={{ marginLeft: sidebarWidth, paddingTop: 64 }}
      >
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
