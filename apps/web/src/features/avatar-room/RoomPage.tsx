import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Pencil } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { useAvatar } from "../avatar/useAvatar.js";
import { RoomScene } from "./RoomScene.js";

/** The main screen: the avatar in its room, or where to go when there is none. */
export function RoomPage() {
  const { data: avatar, isError, isFetching, refetch } = useAvatar();
  const navigate = useNavigate();
  const hasNoAvatar = avatar === null;

  useEffect(() => {
    if (hasNoAvatar) void navigate("/create", { replace: true });
  }, [hasNoAvatar, navigate]);

  if (!avatar && isError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 text-center">
        <div role="alert" className="space-y-1">
          <p className="font-medium">Can't reach the server</p>
          <p className="text-sm text-muted-foreground">
            Check your connection, then try again.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        {avatar ? (
          <RoomScene appearance={avatar} />
        ) : (
          <Skeleton
            role="status"
            aria-label="Loading your room"
            className="aspect-[3/2] max-h-full w-full"
          />
        )}
      </div>
      {avatar && (
        <Button asChild variant="secondary" className="my-3 shrink-0">
          <Link to="/create">
            <Pencil /> Edit avatar
          </Link>
        </Button>
      )}
    </div>
  );
}
