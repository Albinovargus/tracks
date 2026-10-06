import { Link, useLocation } from 'react-router';

/** The signed-in app's destinations, shared by the Sidebar and the room's menu. */
export const navItems = [{ path: '/', label: 'Room' }] as const;

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav className="p-2">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
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
  );
}
