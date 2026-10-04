import { Link, useLocation } from 'react-router';

const navItems = [{ path: '/', label: 'Dashboard' }];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-64 border-r border-border bg-muted/50 md:block">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-lg font-semibold">Tracks</span>
      </div>
      <nav className="p-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${
              location.pathname === item.path
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
