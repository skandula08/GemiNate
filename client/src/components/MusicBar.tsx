import { useEffect, useState, useRef } from "react";
import type { Playlist } from "@gamenite/shared";
import { getPlaylistByCommunityId, createPlaylistForCommunity } from "../services/musicService";
import { useMusicSocket } from "../hooks/useMusicSocket";
import useLoginContext from "../hooks/useLoginContext";
import useAuth from "../hooks/useAuth";
import MusicQueue from "./MusicQueue";
import MusicSearch from "./MusicSearch";
import { audio } from "../util/audio";
import "./MusicBar.css";
/**
 * Slider component for rendering a customizable slider input.
 * Can be used for progress tracking (e.g., playback progress) or volume control.
 *
 * @param props - The component props.
 * @param value - The current value of the slider (between 0 and 1).
 * @param  onChange - Callback function to handle value changes. It receives the new value as a parameter.
 * @param disabled - Optional flag to disable the slider (default is false).
 * @param variant - The type of slider. "progress" is used for playback progress, "volume" is for volume control.
 * @param title - Optional title for the slider, used as a tooltip.
 *
 * @returns The rendered slider component.
 */
function Slider({
  value,
  onChange,
  disabled,
  variant,
  title,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  variant: "progress" | "volume";
  title?: string;
}) {
  const pct = `${(value * 100).toFixed(2)}%`;

  return (
    <div className={`mb-slider mb-slider--${variant}${disabled ? " mb-slider--disabled" : ""}`}>
      <div className="mb-slider__track">
        <div className="mb-slider__fill" style={{ "--p": pct } as React.CSSProperties} />
        <div className="mb-slider__glow" style={{ left: pct } as React.CSSProperties} />
        <div className="mb-slider__thumb" style={{ left: pct } as React.CSSProperties} />
      </div>
      <input
        type="range"
        className="mb-slider__input"
        title={title}
        min={0}
        max={1}
        step={0.001}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

/**
 * Icon component for the "Previous" button.
 * Represents a leftward pointing arrow and is used to go to the previous track.
 *
 * @param disabled - Whether the button is disabled (changes icon opacity).
 *
 * @returns The rendered SVG icon for the previous button.
 */
function IconPrev({ disabled }: { disabled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={disabled ? 0.3 : 1}
    >
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  );
}

/**
 * Icon component for the "Next" button.
 * Represents a rightward pointing arrow and is used to go to the next track.
 *
 * @param disabled - Whether the button is disabled (changes icon opacity).
 *
 * @returns The rendered SVG icon for the next button.
 */
function IconNext({ disabled }: { disabled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={disabled ? 0.3 : 1}
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

/**
 * Icon component for the "Play" button.
 * Represents the "Play" icon and is used to start music playback.
 *
 * @param disabled - Whether the button is disabled (changes icon opacity).
 *
 * @returns The rendered SVG icon for the play button.
 */
function IconPlay({ disabled }: { disabled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      opacity={disabled ? 0.3 : 1}
      style={{ marginLeft: "2px" }}
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

/**
 * Icon component for the "Pause" button.
 * Represents the "Pause" icon and is used to stop music playback.
 *
 * @param disabled - Whether the button is disabled (changes icon opacity).
 *
 * @returns The rendered SVG icon for the pause button.
 */
function IconPause({ disabled }: { disabled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      opacity={disabled ? 0.3 : 1}
    >
      <line x1="8" y1="5" x2="8" y2="19" />
      <line x1="16" y1="5" x2="16" y2="19" />
    </svg>
  );
}

/**
 * Icon component for the "Volume" button.
 * Represents the volume icon, which changes depending on the current volume level.
 *
 * @param level - The current volume level (between 0 and 1).
 *
 * @returns The rendered SVG icon for the volume button.
 */
function IconVolume({ level }: { level: number }) {
  if (level === 0) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  if (level < 0.5) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

/**
 * Icon component for the "Shuffle" button.
 * Represents the shuffle icon, used to shuffle the playlist.
 *
 * @param disabled - Whether the button is disabled (changes icon opacity).
 *
 * @returns The rendered SVG icon for the shuffle button.
 */
function IconShuffle({ disabled }: { disabled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={disabled ? 0.3 : 1}
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

/**
 * Icon component for the "Loop" button.
 * Represents the loop icon, which changes based on the loop mode ("none", "all", or "one").
 *
 * @param mode - The current loop mode.
 * @param disabled - Whether the button is disabled (changes icon opacity).
 *
 * @returns The rendered SVG icon for the loop button.
 */
function IconLoop({ mode, disabled }: { mode: "none" | "all" | "one"; disabled: boolean }) {
  const opacity = disabled ? 0.3 : 1;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      {mode === "one" && (
        <text x="9" y="14" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">
          1
        </text>
      )}
    </svg>
  );
}

/**
 * MusicBar component that controls music playback for a community playlist.
 * Handles playback state (play/pause), volume, track navigation (next/prev), and loop mode.
 * It also allows users to interact with the music queue and search for tracks.
 *
 * @param communityID - The community ID, used to fetch and manage the playlist for the community.
 *
 * @returns The rendered music bar UI, or null if no playlist is available.
 */
export default function MusicBar({ communityID }: { communityID: string }) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [volume, setVolume] = useState(1);
  const { user, socket } = useLoginContext();
  const auth = useAuth();
  const rafRef = useRef<number | null>(null);

  // Fetch playlist on mount
  useEffect(() => {
    const fetchPlaylist = async () => {
      const existing = await getPlaylistByCommunityId(communityID);
      if (!("error" in existing)) {
        setPlaylist(existing);
        return;
      }
      const created = await createPlaylistForCommunity(communityID);
      if ("error" in created) return;
      setPlaylist(created);
    };
    void fetchPlaylist();
  }, [communityID]);

  // useMusicSocket handles playback events and playlist sync
  const { currentTrackId, loopMode, playFromGesture } = useMusicSocket(
    playlist?.playlistId ?? "",
    auth,
    (p) => setPlaylist(p),
  );

  // Stop audio and reset when the community changes
  useEffect(() => {
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [communityID]);

  // Mirror audio element's play/pause state into React
  useEffect(() => {
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  // Progress bar via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      if (audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  if (!playlist) return null;

  const currentTrack =
    playlist.tracks.find((t) => t.trackId === currentTrackId) ?? playlist.tracks[0] ?? null;

  const isDJ =
    playlist.owner.user.username === user.username ||
    playlist.djList.some((dj) => dj.user.username === user.username);

  const nextLoopMode = (current: "none" | "all" | "one"): "none" | "all" | "one" => {
    if (current === "none") return "all";
    if (current === "all") return "one";
    return "none";
  };

  const pause = () =>
    socket.emit("musicPause", { auth, payload: { playlistId: playlist.playlistId } });

  const resume = () => {
    socket.emit("musicResume", { auth, payload: { playlistId: playlist.playlistId } });
    // Play directly from the user gesture so browsers don't block autoplay.
    // The socket round-trip is too slow; by the time the server responds the
    // gesture context is gone and audio.play() throws a DOMException.
    if (currentTrack) void playFromGesture(currentTrack);
  };

  return (
    <>
      {/* Queue panel */}
      {showQueue && (
        <div className="musicbar-panel">
          <MusicQueue playlist={playlist} currentTrackId={currentTrackId} />
        </div>
      )}

      {/* Search panel */}
      {showSearch && (
        <div className="musicbar-panel">
          <MusicSearch playlist={playlist} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="musicbar">
        {/* Left zone: track info */}
        <div className="musicbar-track">
          {currentTrack ? (
            <>
              <div className={`musicbar-artwork-wrap ${isPlaying ? "playing" : ""}`}>
                <img
                  className="musicbar-artwork"
                  src={currentTrack.artwork}
                  alt={currentTrack.title}
                  width={48}
                  height={48}
                />
              </div>
              {isPlaying && (
                <div className="musicbar-eq" aria-hidden="true">
                  <div className="musicbar-eq-bar" />
                  <div className="musicbar-eq-bar" />
                  <div className="musicbar-eq-bar" />
                  <div className="musicbar-eq-bar" />
                </div>
              )}
              <div className="musicbar-track-info">
                {isPlaying && <div className="musicbar-now-playing">Now playing</div>}
                <div className="musicbar-title">{currentTrack.title}</div>
                {currentTrack.artist && (
                  <div className="musicbar-artist">{currentTrack.artist}</div>
                )}
              </div>
            </>
          ) : (
            <div className="musicbar-empty">No track playing</div>
          )}
        </div>

        {/* Center zone: controls + progress */}
        <div className="musicbar-center">
          <div className="musicbar-controls">
            <button
              className="musicbar-btn"
              disabled={!isDJ}
              onClick={() =>
                socket.emit("musicShuffle", { auth, payload: { playlistId: playlist.playlistId } })
              }
              title="Shuffle queue"
            >
              <IconShuffle disabled={!isDJ} />
            </button>

            <button
              className="musicbar-btn"
              disabled={!isDJ}
              onClick={() => {
                if (audio.currentTime > 3) {
                  socket.emit("musicRestartTrack", {
                    auth,
                    payload: { playlistId: playlist.playlistId },
                  });
                } else {
                  socket.emit("musicPrevTrack", {
                    auth,
                    payload: { playlistId: playlist.playlistId },
                  });
                }
              }}
              title="Skip back"
            >
              <IconPrev disabled={!isDJ} />
            </button>

            <button
              className="musicbar-btn musicbar-btn-play"
              disabled={!isDJ}
              onClick={isPlaying ? pause : resume}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <IconPause disabled={!isDJ} /> : <IconPlay disabled={!isDJ} />}
            </button>

            <button
              className="musicbar-btn"
              disabled={!isDJ}
              onClick={() =>
                socket.emit("musicNextTrack", {
                  auth,
                  payload: { playlistId: playlist.playlistId },
                })
              }
              title="Skip forward"
            >
              <IconNext disabled={!isDJ} />
            </button>

            <button
              className={`musicbar-btn${loopMode !== "none" && isDJ ? " musicbar-btn--active" : ""}`}
              disabled={!isDJ}
              onClick={() =>
                socket.emit("musicSetLoopMode", {
                  auth,
                  payload: { playlistId: playlist.playlistId, loopMode: nextLoopMode(loopMode) },
                })
              }
              title={`Loop: ${loopMode}`}
            >
              <IconLoop mode={loopMode} disabled={!isDJ} />
            </button>
          </div>

          <Slider
            variant="progress"
            value={progress}
            disabled={!isDJ}
            onChange={(v) => {
              socket.emit("musicSeek", {
                auth,
                payload: {
                  playlistId: playlist.playlistId,
                  positionMs: v * audio.duration * 1000,
                },
              });
            }}
            title="Playback progress"
          />
        </div>

        {/* Right zone: volume + panel toggles */}
        <div className="musicbar-right">
          <div className="musicbar-volume-wrap">
            <span className="musicbar-volume-icon">
              <IconVolume level={volume} />
            </span>
            <Slider
              variant="volume"
              value={volume}
              onChange={(v) => {
                audio.volume = v;
                setVolume(v);
              }}
              title="Volume"
            />
          </div>

          <button
            className={`musicbar-toggle-btn ${showSearch ? "active" : ""}`}
            onClick={() => {
              setShowSearch((s) => !s);
              setShowQueue(false);
            }}
            title="Search for music"
          >
            Search
          </button>

          <button
            className={`musicbar-toggle-btn ${showQueue ? "active" : ""}`}
            onClick={() => {
              setShowQueue((q) => !q);
              setShowSearch(false);
            }}
            title="View queue"
          >
            Queue
          </button>
        </div>
      </div>
    </>
  );
}
