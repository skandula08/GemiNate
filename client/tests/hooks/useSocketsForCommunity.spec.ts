import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useSocketsForCommunity from "../../src/hooks/useSocketsForCommunity.ts";
import type { CommunityUser } from "@gamenite/shared";

const mockEmit = vi.fn();
const mockOff = vi.fn();
const mockSocketHandlers: Record<string, (members: CommunityUser[]) => void> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: (members: CommunityUser[]) => void) => {
    mockSocketHandlers[event] = handler;
  }),
  off: mockOff,
  emit: mockEmit,
};

vi.mock("../../src/hooks/useLoginContext.ts", () => {
  const stableUser = { username: "testuser", display: "Test User", createdAt: new Date() };
  return {
    default: () => ({
      user: stableUser,
      kind: "password",
      pass: "password",
      socket: mockSocket,
      reset: vi.fn(),
    }),
  };
});

vi.mock("../../src/hooks/useAuth.ts", () => {
  const stableAuth = { kind: "password", username: "testuser", password: "password" };
  return { default: () => stableAuth };
});

const BASE_MEMBERS: CommunityUser[] = [
  {
    user: { username: "owner", display: "Owner", createdAt: new Date() },
    role: "owner",
  },
  {
    user: { username: "testuser", display: "Test User", createdAt: new Date() },
    role: "member",
  },
];

describe("useSocketsForCommunity – removalReason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);
  });

  it("starts with removalReason null", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));
    expect(result.current.removalReason).toBeNull();
  });

  it("sets removalReason to 'kicked' when current user transitions from member to kicked", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        {
          user: { username: "testuser", display: "Test User", createdAt: new Date() },
          role: "kicked",
        },
      ]);
    });

    expect(result.current.removalReason).toBe("kicked");
  });

  it("sets removalReason to 'banned' when current user transitions from member to banned", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        {
          user: { username: "testuser", display: "Test User", createdAt: new Date() },
          role: "banned",
        },
      ]);
    });

    expect(result.current.removalReason).toBe("banned");
  });

  it("does not set removalReason when user was already kicked before the update", () => {
    const kickedMembers: CommunityUser[] = [
      { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
      {
        user: { username: "testuser", display: "Test User", createdAt: new Date() },
        role: "kicked",
      },
    ];

    const { result } = renderHook(() => useSocketsForCommunity("community-1", kickedMembers));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        {
          user: { username: "testuser", display: "Test User", createdAt: new Date() },
          role: "kicked",
        },
      ]);
    });

    expect(result.current.removalReason).toBeNull();
  });
});

describe("useSocketsForCommunity – promotionRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);
  });

  it("starts with promotionRole null", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));
    expect(result.current.promotionRole).toBeNull();
  });

  it("sets promotionRole to 'dj' when current user transitions from member to dj", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        { user: { username: "testuser", display: "Test User", createdAt: new Date() }, role: "dj" },
      ]);
    });

    expect(result.current.promotionRole).toBe("dj");
  });

  it("sets promotionRole to 'owner' when current user transitions from member to owner", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        {
          user: { username: "testuser", display: "Test User", createdAt: new Date() },
          role: "owner",
        },
      ]);
    });

    expect(result.current.promotionRole).toBe("owner");
  });

  it("does not set promotionRole when user was already dj before the update", () => {
    const djMembers: CommunityUser[] = [
      { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
      { user: { username: "testuser", display: "Test User", createdAt: new Date() }, role: "dj" },
    ];

    const { result } = renderHook(() => useSocketsForCommunity("community-1", djMembers));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        { user: { username: "testuser", display: "Test User", createdAt: new Date() }, role: "dj" },
      ]);
    });

    expect(result.current.promotionRole).toBeNull();
  });

  it("fires promotionRole again after demotion then re-promotion", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));

    // promote to DJ
    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        { user: { username: "testuser", display: "Test User", createdAt: new Date() }, role: "dj" },
      ]);
    });
    expect(result.current.promotionRole).toBe("dj");

    // demote back to member — promotionRole should reset to null
    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        {
          user: { username: "testuser", display: "Test User", createdAt: new Date() },
          role: "member",
        },
      ]);
    });
    expect(result.current.promotionRole).toBeNull();

    // re-promote — should fire again
    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        { user: { username: "testuser", display: "Test User", createdAt: new Date() }, role: "dj" },
      ]);
    });
    expect(result.current.promotionRole).toBe("dj");
  });
});

describe("useSocketsForCommunity – demotionNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);
  });

  it("starts with demotionNotice false", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));
    expect(result.current.demotionNotice).toBe(false);
  });

  it("sets demotionNotice when current user transitions from dj to member", () => {
    const djMembers: CommunityUser[] = [
      { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
      { user: { username: "testuser", display: "Test User", createdAt: new Date() }, role: "dj" },
    ];

    const { result } = renderHook(() => useSocketsForCommunity("community-1", djMembers));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        {
          user: { username: "testuser", display: "Test User", createdAt: new Date() },
          role: "member",
        },
      ]);
    });

    expect(result.current.demotionNotice).toBe(true);
  });

  it("does not set demotionNotice when user was already a member", () => {
    const { result } = renderHook(() => useSocketsForCommunity("community-1", BASE_MEMBERS));

    act(() => {
      mockSocketHandlers["communityMembersUpdated"]([
        { user: { username: "owner", display: "Owner", createdAt: new Date() }, role: "owner" },
        {
          user: { username: "testuser", display: "Test User", createdAt: new Date() },
          role: "member",
        },
      ]);
    });

    expect(result.current.demotionNotice).toBe(false);
  });
});
