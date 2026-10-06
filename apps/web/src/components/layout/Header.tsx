import { AccountControls } from './AccountControls.js';

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <div />
      <AccountControls />
    </header>
  );
}
