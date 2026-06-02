import type { Playlist } from "@gamenite/shared";
import useLoginContext from "../hooks/useLoginContext";
import useAuth from "../hooks/useAuth";

/**
 * MusicPlayer component displays the current track of a playlist and provides controls for play/pause functionality.
 * It fetches the current track based on the `currentTrackId` and renders the track information along with play/pause controls.
 * The component also ensures that only DJs can control the music playback.
 *
 * @param playlist - The playlist object containing the tracks and other playlist data.
 * @param currentTrackId - The ID of the currently playing track. If null, the first track in the playlist is used.
 *
 * @returns The rendered music player component containing the track's artwork, title, artist, and playback controls.
 */

export default function MusicPlayer({
  playlist,
  currentTrackId,
}: {
  playlist: Playlist;
  currentTrackId: number | null;
}) {
  const { user, socket } = useLoginContext();
  const auth = useAuth();

  let currentTrack = playlist.tracks.find((t) => t.trackId === currentTrackId);
  if (!currentTrack) {
    currentTrack = playlist.tracks[0];
  }
  const isDJ =
    playlist.owner.user.username === user.username ||
    playlist.djList.some((dj) => dj.user.username === user.username);

  const pause = () => {
    socket.emit("musicPause", {
      auth: auth,
      payload: { playlistId: playlist.playlistId },
    });
  };

  const resume = () => {
    socket.emit("musicResume", {
      auth: auth,
      payload: { playlistId: playlist.playlistId },
    });
  };

  return (
    <div className="music-player">
      {currentTrack && (
        <>
          <img className="album-art" src={currentTrack.artwork} width={"100px"} height={"100px"} />

          <div className="right">
            <div className="track-info">
              <b className="track-title">{currentTrack.title}</b>
              <i className="track-title">{currentTrack.artist}</i>
            </div>

            <input type="range" className="progress" />
            <div className="controls">
              {/* <button disabled={!isDJ} onClick={play}>
        Play ▶
      </button> */}
              <button disabled={!isDJ} onClick={resume} title="Play">
                Play ▶
              </button>
              <button disabled={!isDJ} onClick={pause} title="Pause">
                Pause ❚❚
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
