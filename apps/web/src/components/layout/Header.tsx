import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../ui/button.js';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <div />
      <div className="flex min-w-0 items-center gap-4">
        <span className="min-w-0 truncate text-sm text-muted-foreground" title={user?.email}>
          {user?.email}
        </span>
        <Button variant="ghost" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
