import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MusicBar from "../../src/components/MusicBar.tsx";

const mockEmit = vi.fn();
const mockSocket = {
  emit: mockEmit,
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({
    user: { username: "testuser", display: "Test", createdAt: new Date() },
    socket: mockSocket,
    kind: "password",
    pass: "password",
  }),
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => ({ kind: "password" as const, username: "testuser", password: "password" }),
}));

vi.mock("../../src/hooks/useMusicSocket.ts", () => ({
  useMusicSocket: () => ({ currentTrackId: 1, loopMode: "none" as const }),
}));

const mockAudio = vi.hoisted(() => ({
  pause: vi.fn(),
  play: vi.fn(async () => {}),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  src: "",
  currentTime: 0,
  duration: 300,
  volume: 1,
}));

vi.mock("../../src/util/audio.ts", () => ({
  audio: mockAudio,
}));

const fakeDJPlaylist = {
  playlistId: "p1",
  title: "Test",
  communityId: "c1",
  owner: {
    user: { username: "testuser", display: "Test", createdAt: new Date() },
    role: "owner" as const,
  },
  djList: [],
  tracks: [
    {
      trackId: 1,
      urn: "sc:1",
      title: "Track 1",
      artist: null,
      artwork: "https://example.com/art.jpg",
      duration: 180000,
      streamUrl: "",
    },
  ],
  duration: 180000,
};

vi.mock("../../src/services/musicService.ts", () => ({
  getPlaylistByCommunityId: vi.fn(() => Promise.resolve(fakeDJPlaylist)),
  createPlaylistForCommunity: vi.fn(() => Promise.resolve({ error: "exists" })),
}));

const fakeAuth = { kind: "password" as const, username: "testuser", password: "password" };

beforeEach(() => {
  vi.clearAllMocks();
  mockAudio.currentTime = 0;
  mockAudio.duration = 300;
  mockAudio.volume = 1;
});

describe("MusicBar skip buttons", () => {
  it("skip back emits musicPrevTrack when currentTime <= 3", async () => {
    mockAudio.currentTime = 1;
    render(<MusicBar communityID="c1" />);
    await waitFor(() => screen.getByTitle("Skip back"));
    fireEvent.click(screen.getByTitle("Skip back"));
    expect(mockEmit).toHaveBeenCalledWith("musicPrevTrack", {
      auth: fakeAuth,
      payload: { playlistId: "p1" },
    });
  });

  it("skip back emits musicRestartTrack when currentTime > 3", async () => {
    mockAudio.currentTime = 10;
    render(<MusicBar communityID="c1" />);
    await waitFor(() => screen.getByTitle("Skip back"));
    fireEvent.click(screen.getByTitle("Skip back"));
    expect(mockEmit).toHaveBeenCalledWith("musicRestartTrack", {
      auth: fakeAuth,
      payload: { playlistId: "p1" },
    });
  });

  it("skip forward emits musicNextTrack", async () => {
    render(<MusicBar communityID="c1" />);
    await waitFor(() => screen.getByTitle("Skip forward"));
    fireEvent.click(screen.getByTitle("Skip forward"));
    expect(mockEmit).toHaveBeenCalledWith("musicNextTrack", {
      auth: fakeAuth,
      payload: { playlistId: "p1" },
    });
  });
});

describe("MusicBar scrubbing", () => {
  it("progress bar emits musicSeek with correct positionMs when DJ scrubs", async () => {
    mockAudio.duration = 300;
    render(<MusicBar communityID="c1" />);
    await waitFor(() => screen.getByTitle("Playback progress"));
    const input = screen.getByTitle("Playback progress");
    fireEvent.change(input, { target: { value: "0.5" } });
    expect(mockEmit).toHaveBeenCalledWith("musicSeek", {
      auth: fakeAuth,
      payload: { playlistId: "p1", positionMs: 150000 },
    });
  });

  it("progress bar is disabled for non-DJs", async () => {
    const { getPlaylistByCommunityId } = await import("../../src/services/musicService.ts");
    (getPlaylistByCommunityId as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...fakeDJPlaylist,
      owner: {
        user: { username: "someoneelse", display: "Other", createdAt: new Date() },
        role: "owner" as const,
      },
    });
    render(<MusicBar communityID="c1" />);
    await waitFor(() => screen.getByTitle("Playback progress"));
    const input = screen.getByTitle("Playback progress");
    expect((input as HTMLInputElement).disabled).toBe(true);
  });
});

describe("MusicBar volume", () => {
  it("volume slider sets audio.volume", async () => {
    render(<MusicBar communityID="c1" />);
    await waitFor(() => screen.getByTitle("Volume"));
    const slider = screen.getByTitle("Volume");
    fireEvent.change(slider, { target: { value: "0.4" } });
    expect(mockAudio.volume).toBe(0.4);
  });

  it("volume slider does not emit any socket event", async () => {
    render(<MusicBar communityID="c1" />);
    await waitFor(() => screen.getByTitle("Volume"));
    fireEvent.change(screen.getByTitle("Volume"), { target: { value: "0.7" } });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
