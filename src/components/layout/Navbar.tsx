interface NavbarProps {
  title: string;
  subtitle?: string;
  sidebarWidth: number;
}

const Navbar = ({ title, subtitle, sidebarWidth }: NavbarProps) => (
  <header
    className="fixed top-0 right-0 h-16 bg-white border-b border-slate-200 z-30 flex items-center transition-all duration-200 ease-in-out"
    style={{ left: sidebarWidth }}
  >
    <div className="flex items-center gap-3 px-6 h-full w-full">
      <div>
        <h1 className="text-base font-bold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 leading-tight mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1" />
    </div>
  </header>
);

export default Navbar;
