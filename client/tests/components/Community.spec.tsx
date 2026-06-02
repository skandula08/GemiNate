import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Community } from "../../src/pages/Community.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";
import type { CommunityPreview } from "@gamenite/shared";

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useNavigate: () => mockedNavigate };
});

vi.mock("../../src/hooks/useCommunityBanner.ts", () => ({
  default: () => undefined,
}));

vi.mock("../../src/services/communityService.ts", () => ({
  createInvite: vi.fn(),
}));

const mockHookBase = {
  members: [],
  removalReason: null as "kicked" | "banned" | null,
  promotionRole: null as "dj" | "owner" | null,
  demotionNotice: false,
  joinCommunity: vi.fn(),
  transferOwnership: vi.fn(),
  makeDJ: vi.fn(),
  makeRegularMember: vi.fn(),
  kickMember: vi.fn(),
  banMember: vi.fn(),
};

vi.mock("../../src/hooks/useSocketsForCommunity.ts", () => ({
  default: () => mockHookBase,
}));

const community: CommunityPreview = {
  communityId: "c1",
  name: "Test Community",
  memberCount: 0,
  members: [],
  chat: "chat1",
  isPrivate: false,
};

const loginContextValue = {
  user: { username: "testuser", display: "Test User", createdAt: new Date() },
  kind: "password" as const,
  pass: "password",
  socket: {} as GameSocket,
  reset: vi.fn(),
};

function renderCommunity() {
  return render(
    <LoginContext value={loginContextValue}>
      <Community {...community} />
    </LoginContext>,
  );
}

describe("Community – kick/ban removal notice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookBase.removalReason = null;
    mockHookBase.promotionRole = null;
    mockHookBase.demotionNotice = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show removal notice when removalReason is null", () => {
    renderCommunity();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows kicked notice when removalReason transitions to kicked", () => {
    const { rerender } = renderCommunity();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    mockHookBase.removalReason = "kicked";
    act(() => {
      rerender(
        <LoginContext value={loginContextValue}>
          <Community {...community} />
        </LoginContext>,
      );
    });

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("You've been kicked")).toBeTruthy();
  });

  it("shows banned notice when removalReason transitions to banned", () => {
    const { rerender } = renderCommunity();

    mockHookBase.removalReason = "banned";
    act(() => {
      rerender(
        <LoginContext value={loginContextValue}>
          <Community {...community} />
        </LoginContext>,
      );
    });

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("You've been banned")).toBeTruthy();
  });

  it("navigates to /communities when Leave Now is clicked", () => {
    mockHookBase.removalReason = "kicked";
    renderCommunity();

    fireEvent.click(screen.getByText("Leave Now"));
    expect(mockedNavigate).toHaveBeenCalledWith("/communities");
  });

  it("navigates to /communities after countdown expires", () => {
    mockHookBase.removalReason = "kicked";
    renderCommunity();

    // 5 ticks to reach seconds=0, plus 1 more for the 1000ms ring-transition delay
    for (let i = 0; i < 6; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(mockedNavigate).toHaveBeenCalledWith("/communities");
  });
});

describe("Community – promotion toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookBase.removalReason = null;
    mockHookBase.promotionRole = null;
    mockHookBase.demotionNotice = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show promotion toast when promotionRole is null", () => {
    renderCommunity();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows DJ toast when promotionRole transitions to dj", () => {
    const { rerender } = renderCommunity();
    expect(screen.queryByRole("status")).toBeNull();

    mockHookBase.promotionRole = "dj";
    act(() => {
      rerender(
        <LoginContext value={loginContextValue}>
          <Community {...community} />
        </LoginContext>,
      );
    });

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("You're now a DJ")).toBeTruthy();
  });

  it("shows owner toast when promotionRole transitions to owner", () => {
    const { rerender } = renderCommunity();

    mockHookBase.promotionRole = "owner";
    act(() => {
      rerender(
        <LoginContext value={loginContextValue}>
          <Community {...community} />
        </LoginContext>,
      );
    });

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("You're the new owner")).toBeTruthy();
  });

  it("clears the toast after 4 seconds", () => {
    mockHookBase.promotionRole = "dj";
    renderCommunity();

    expect(screen.getByRole("status")).toBeTruthy();

    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Community – demotion toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookBase.removalReason = null;
    mockHookBase.promotionRole = null;
    mockHookBase.demotionNotice = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show demotion toast when demotionNotice is false", () => {
    renderCommunity();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows demotion toast when demotionNotice transitions to true", () => {
    const { rerender } = renderCommunity();
    expect(screen.queryByRole("status")).toBeNull();

    mockHookBase.demotionNotice = true;
    act(() => {
      rerender(
        <LoginContext value={loginContextValue}>
          <Community {...community} />
        </LoginContext>,
      );
    });

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("You're no longer a DJ")).toBeTruthy();
  });
});
