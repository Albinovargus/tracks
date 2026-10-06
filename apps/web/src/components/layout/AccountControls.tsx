import { useAuth } from '../../hooks/useAuth.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.js';

/** The signed-in email (truncating) and Sign out, shared by the Header and the room's menu. */
export function AccountControls({ className }: { className?: string }) {
  const { user, signOut } = useAuth();

  return (
    <div className={cn('flex min-w-0 items-center gap-4', className)}>
      <span className="min-w-0 truncate text-sm text-muted-foreground" title={user?.email}>
        {user?.email}
      </span>
      <Button variant="ghost" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}
