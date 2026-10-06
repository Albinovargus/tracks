import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { useAvatar } from "../avatar/useAvatar.js";
import { RoomChrome } from "./RoomChrome.js";
import { RoomScene } from "./RoomScene.js";

/** The main screen: the avatar in its room, or where to go when there is none. */
export function RoomPage() {
  const { data: avatar, isError, isFetching, refetch } = useAvatar();
  const navigate = useNavigate();
  const hasNoAvatar = avatar === null;

  useEffect(() => {
    if (hasNoAvatar) void navigate("/create", { replace: true });
  }, [hasNoAvatar, navigate]);

  let content: ReactNode;
  if (!avatar && isError) {
    content = (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
        <div role="alert" className="space-y-1">
          <p className="font-medium">Can't reach the server</p>
          <p className="text-sm text-muted-foreground">Check your connection, then try again.</p>
        </div>
        <Button variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  } else if (avatar) {
    content = (
      <div className="absolute inset-0">
        <RoomScene appearance={avatar} />
      </div>
    );
  } else {
    content = (
      <Skeleton role="status" aria-label="Loading your room" className="absolute inset-0 rounded-none" />
    );
  }

  // Full-bleed: the art runs under the notch and home indicator; RoomChrome pads
  // its controls with the safe-area insets (room world spec §1). The chrome comes
  // first so Tab reaches Menu and Edit avatar before the room; z-10 keeps it on top.
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <RoomChrome showEdit={Boolean(avatar)} />
      {content}
    </div>
  );
}
