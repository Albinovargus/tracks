import { useState } from "react";
import { Link } from "react-router";
import { Menu, Pencil, X } from "lucide-react";
import { AccountControls } from "../../components/layout/AccountControls.js";
import { NavLinks } from "../../components/layout/NavLinks.js";
import { Button } from "../../components/ui/button.js";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet.js";
import { cn } from "../../lib/utils.js";

/** Floating glass controls over the room art. */
const GLASS = "pointer-events-auto rounded-full bg-background/70 shadow-sm backdrop-blur-sm hover:bg-background/90";

/** The room screen's app chrome, laid over the art inside the safe areas. */
export function RoomChrome({ showEdit }: { showEdit: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[calc(env(safe-area-inset-right)+0.75rem)] pl-[calc(env(safe-area-inset-left)+0.75rem)]">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Menu" className={GLASS}>
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border">
            <SheetTitle className="text-lg font-semibold">Tracks</SheetTitle>
            <SheetDescription className="sr-only">Navigation and account</SheetDescription>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X />
              </Button>
            </SheetClose>
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
          <AccountControls className="mt-auto justify-between border-t border-border p-4" />
        </SheetContent>
      </Sheet>
      {showEdit && (
        <Button asChild variant="ghost" className={cn(GLASS)}>
          <Link to="/create">
            <Pencil /> Edit avatar
          </Link>
        </Button>
      )}
    </div>
  );
}
