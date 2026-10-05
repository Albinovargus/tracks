import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { Avatar, AvatarAppearance } from "@tracks/types";
import type { User } from "../../../lib/supabase.js";

const { get, put, scene } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  // How many times the stub scene has mounted.
  scene: { mounts: 0 },
}));

vi.mock("../../../lib/api.js", () => ({
  api: { get, put },
}));

// jsdom has no canvas: the real RoomScene never mounts (.claude/CLAUDE.md rule 26).
vi.mock("../RoomScene.js", async () => {
  const { useEffect } = await import("react");
  const { describeAppearance } = await import("../../avatar/appearance.js");
  return {
    RoomScene: (props: { appearance: AvatarAppearance }) => {
      useEffect(() => {
        scene.mounts += 1;
      }, []);
      return (
        <div role="img" aria-label={describeAppearance(props.appearance)} />
      );
    },
  };
});

import { useAuthStore } from "../../../store/auth.store.js";
import { describeAppearance } from "../../avatar/appearance.js";
import { RoomPage } from "../RoomPage.js";

const USER_A = { id: "user-a" } as User;
const USER_B = { id: "user-b" } as User;

const APPEARANCE: AvatarAppearance = {
  skin_tone: "tone-3",
  hair_style: "curly",
  hair_color: "auburn",
  top: "starter-tee-blue",
  bottom: "starter-shorts-black",
  shoes: "starter-shoes-red",
};
const EDITED: AvatarAppearance = { ...APPEARANCE, hair_color: "blonde" };

const AVATAR: Avatar = {
  ...APPEARANCE,
  created_at: "2026-10-04T12:00:00+00:00",
  updated_at: "2026-10-04T12:00:00+00:00",
};

const FOUND = { success: true, data: AVATAR };
const FOUND_EDITED = {
  success: true,
  data: { ...AVATAR, ...EDITED, updated_at: "2026-10-04T13:00:00+00:00" },
};
const NOT_FOUND = {
  success: false,
  error: { code: "AVATAR_NOT_FOUND", message: "Avatar not found" },
};
// What api.ts throws for GitHub Pages' HTML 404 while the API is unhosted.
const PAGES_404 = {
  success: false,
  error: { code: "UNKNOWN", message: "Not Found" },
};

function renderRoom() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([
    { path: "/", element: <RoomPage /> },
    { path: "/create", element: <h1>Creator stub</h1> },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

describe("RoomPage", () => {
  beforeEach(() => {
    get.mockReset();
    scene.mounts = 0;
    useAuthStore.setState({ user: USER_A });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null });
  });

  it("shows a loading skeleton while the avatar loads", async () => {
    get.mockReturnValue(new Promise(() => {}));
    renderRoom();

    expect(
      await screen.findByRole("status", { name: "Loading your room" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/avatar");
  });

  it("shows the room with the saved avatar", async () => {
    get.mockResolvedValue(FOUND);
    const { router } = renderRoom();

    expect(
      await screen.findByRole("img", { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("links Edit avatar to the creator", async () => {
    get.mockResolvedValue(FOUND);
    const { router } = renderRoom();

    const edit = await screen.findByRole("link", { name: "Edit avatar" });
    expect(edit).toHaveAttribute("href", "/create");
    fireEvent.click(edit);

    expect(
      await screen.findByRole("heading", { name: "Creator stub" }),
    ).toBeInTheDocument();
    expect(router.state.historyAction).toBe("PUSH");
  });

  it("keeps the room mounted through a background refetch and passes the new look on", async () => {
    let answer: (value: unknown) => void = () => {};
    get.mockResolvedValueOnce(FOUND).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { queryClient } = renderRoom();
    expect(
      await screen.findByRole("img", { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();

    // What a window-focus refetch does after an edit in another tab or on another device.
    await act(async () => {
      void queryClient.refetchQueries();
      // Let TanStack Query's batched notification render the fetching state.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      screen.getByRole("img", { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    answer(FOUND_EDITED);
    expect(
      await screen.findByRole("img", { name: describeAppearance(EDITED) }),
    ).toBeInTheDocument();
    // Same scene instance: RoomScene itself starts over for the new look.
    expect(scene.mounts).toBe(1);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("replaces the room with the creator when the user has no avatar", async () => {
    get.mockRejectedValue(NOT_FOUND);
    const { router } = renderRoom();

    expect(
      await screen.findByRole("heading", { name: "Creator stub" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/create");
    // Replace, so Back does not bounce through the room again.
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it.each([
    ["a network failure", new TypeError("Failed to fetch")],
    ["an UNKNOWN error from an HTML 404", PAGES_404],
  ])(
    "shows the unreachable state on %s and never redirects",
    async (_name, error) => {
      get.mockRejectedValue(error);
      const { router } = renderRoom();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Can't reach the server",
      );
      expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Edit avatar" }),
      ).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/");
    },
  );

  it("refetches on Retry and shows the room once the server answers", async () => {
    get
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(FOUND);
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("img", { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("refetches for a new user and redirects when that user has no avatar", async () => {
    get.mockResolvedValueOnce(FOUND).mockRejectedValueOnce(NOT_FOUND);
    const { router } = renderRoom();
    expect(
      await screen.findByRole("img", { name: describeAppearance(APPEARANCE) }),
    ).toBeInTheDocument();

    act(() => {
      useAuthStore.setState({ user: USER_B });
    });

    await waitFor(() => expect(router.state.location.pathname).toBe("/create"));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
