import { Outlet } from 'react-router';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

/** The normal app frame (sidebar, header, scrolling main). Auth is checked by RequireAuth above it. */
export function AppShell() {
  return (
    <div className="flex h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
