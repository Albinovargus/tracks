import { NavLinks } from './NavLinks.js';

export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-border bg-muted/50 md:block">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-lg font-semibold">Tracks</span>
      </div>
      <NavLinks />
    </aside>
  );
}
