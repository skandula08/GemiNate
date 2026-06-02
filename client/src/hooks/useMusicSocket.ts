import type { Playlist, Track, UserAuth, PlaybackState } from "@gamenite/shared";
import { audio } from "../util/audio";
import useLoginContext from "./useLoginContext";
import { useEffect, useRef, useState } from "react";
import { getPlaylistById } from "../services/musicService";

export function useMusicSocket(
  playlistId: string,
  auth: UserAuth,
  setPlaylist: (p: Playlist) => void,
) {
  const { socket } = useLoginContext();
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [loopMode, setLoopMode] = useState<"none" | "all" | "one">("none");
  // Tracks which track ID is currently loaded into audio.src — avoids re-fetching on pause/resume
  const loadedTrackIdRef = useRef<number | null>(null);

  // Called from click handlers (user gesture context) so audio.play() isn't blocked by autoplay policy
  const playFromGesture = async (track: Track) => {
    if (track.trackId !== loadedTrackIdRef.current) {
      const res = await fetch("/api/tracks/stream/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
      if (!res.ok) return;
      audio.src = await res.text();
      loadedTrackIdRef.current = track.trackId;
      setCurrentTrackId(track.trackId);
    }
    try {
      await audio.play();
    } catch {
      /* autoplay still blocked by browser */
    }
  };

  useEffect(() => {
    if (!playlistId) return;

    socket.emit("musicJoin", { auth, payload: { playlistId } });

    const handlePlaybackState = async (state: PlaybackState | null) => {
      if (!state) return;

      setLoopMode(state.loopMode ?? "none");

      // Only re-fetch and reload audio.src when the track actually changes
      if (state.trackId !== loadedTrackIdRef.current) {
        const playlist = await getPlaylistById(playlistId);
        if ("error" in playlist) return;
        const trackToPlay = playlist.tracks.find((t) => t.trackId === state.trackId);
        if (!trackToPlay) return;

        const res = await fetch("/api/tracks/stream/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trackToPlay),
        });
        if (!res.ok) return;

        const streamUrl = await res.text();
        audio.src = streamUrl;
        loadedTrackIdRef.current = state.trackId;
        setCurrentTrackId(state.trackId);
      }

      if (state.isPlaying) {
        audio.currentTime = (Date.now() - state.startedAt) / 1000;
        if (audio.paused) {
          void audio.play();
        }
      } else {
        audio.pause();
      }
    };

    const handlePlaybackUpdate = ({ state }: { state: PlaybackState }) => {
      void handlePlaybackState(state);
    };

    const handleJoinedStream = ({ state }: { state: PlaybackState | null }) => {
      void handlePlaybackState(state);
    };

    const handlePlaylistUpdate = ({ playlist }: { playlist: Playlist }) => {
      setPlaylist(playlist);
    };

    socket.on("musicPlaybackUpdate", handlePlaybackUpdate);
    socket.on("joinedMusicStream", handleJoinedStream);
    socket.on("musicPlaylistUpdate", handlePlaylistUpdate);

    const handleEnded = () => {
      socket.emit("musicNextTrack", { auth, payload: { playlistId } });
    };
    audio.addEventListener("ended", handleEnded);

    return () => {
      socket.off("musicPlaybackUpdate", handlePlaybackUpdate);
      socket.off("joinedMusicStream", handleJoinedStream);
      socket.off("musicPlaylistUpdate", handlePlaylistUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  return { currentTrackId, loopMode, playFromGesture };
}
