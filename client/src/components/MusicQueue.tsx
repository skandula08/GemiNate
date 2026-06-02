/* eslint-disable import/no-extraneous-dependencies */
import type { Playlist, Track } from "@gamenite/shared";
import { deleteFromPlaylist, moveTrackInPlaylist } from "../services/musicService";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import useLoginContext from "../hooks/useLoginContext";
import useAuth from "../hooks/useAuth";
import "../components/MusicBar.css";

/**
 * handleDelete function deletes a track from the playlist by calling the music service.
 * It triggers a request to remove the track from the server and updates the playlist accordingly.
 *
 * @param track - The track object to be deleted from the playlist.
 * @param playlistID - The ID of the playlist from which the track is to be deleted.
 *
 * @returns A promise resolving to the result of the deletion request. If an error occurs, no further action is taken.
 */
const handleDelete = async (track: Track, playlistID: string) => {
  if (!playlistID) return;
  const result = await deleteFromPlaylist(track, playlistID);
  if ("error" in result) return;
};

/**
 * DragHandle component renders the UI for the drag handle, which allows tracks to be reordered in the queue via drag-and-drop.
 * It uses multiple divs styled as drag handles for better UI representation.
 *
 * @returns The rendered drag handle UI component.
 */
function DragHandle() {
  return (
    <div className="mbq-drag-dot-row" style={{ flexDirection: "column", gap: 3, display: "flex" }}>
      <div className="mbq-drag-dot-row">
        <div className="mbq-drag-dot" />
        <div className="mbq-drag-dot" />
      </div>
      <div className="mbq-drag-dot-row">
        <div className="mbq-drag-dot" />
        <div className="mbq-drag-dot" />
      </div>
      <div className="mbq-drag-dot-row">
        <div className="mbq-drag-dot" />
        <div className="mbq-drag-dot" />
      </div>
    </div>
  );
}

/**
 * IconPlaySmall component renders a small play icon, used for the play button in the track actions.
 *
 * @returns The rendered play icon component in SVG format.
 */
function IconPlaySmall() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

/**
 * IconTrash component renders a trash icon, used for the delete button in the track actions.
 *
 * @returns The rendered trash icon component in SVG format.
 */
function IconTrash() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

/**
 * SortableItem component renders a single track in the music queue, which can be reordered via drag-and-drop.
 * Each track has associated actions such as playing and deleting from the queue.
 *
 * @param track - The track object containing track details such as title, artist, and artwork.
 * @param playlistId - The ID of the playlist the track belongs to, used for actions like delete.
 * @param access - Boolean flag indicating if the current user has permission to reorder or delete the track.
 * @param isCurrent - Boolean flag indicating if the track is currently playing, used to apply styling.
 * @param onPlay - A callback function triggered when the play button is clicked, accepting the track to play.
 *
 * @returns The rendered track component with drag handle, artwork, track info, and control actions (play, delete).
 */
function SortableItem({
  track,
  playlistId,
  access,
  isCurrent,
  onPlay,
}: {
  track: Track;
  playlistId: string;
  access: boolean;
  isCurrent: boolean;
  onPlay: (track: Track) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: track.trackId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`mbq-item${isCurrent ? " current" : ""}`}>
      {access && (
        <div className="mbq-drag-handle" {...attributes} {...listeners} title="Drag to reorder">
          <DragHandle />
        </div>
      )}
      <img className="mbq-artwork" src={track.artwork} alt={track.title} width={40} height={40} />
      <div className="mbq-info">
        <div className="mbq-track-title">{track.title}</div>
        {track.artist && <div className="mbq-track-artist">{track.artist}</div>}
      </div>
      {access && (
        <div className="mbq-actions">
          <button
            className="mbq-btn mbq-btn-play"
            onClick={() => onPlay(track)}
            title="Play this track"
          >
            <IconPlaySmall />
          </button>
          <button
            className="mbq-btn mbq-btn-delete"
            onClick={() => {
              void handleDelete(track, playlistId);
            }}
            title="Remove from queue"
          >
            <IconTrash />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * MusicQueue component displays a sortable queue of tracks within a playlist.
 * It allows users with the appropriate access (like DJs or playlist owner) to reorder tracks and remove them from the queue.
 * Users can also play tracks directly from the queue.
 *
 * @param playlist - The playlist object containing the list of tracks and related data.
 * @param currentTrackId - The ID of the currently playing track, used to highlight the active track in the queue.
 *
 * @returns The rendered music queue component, including sortable list of tracks with drag-and-drop functionality, play and delete actions.
 */

export default function MusicQueue({
  playlist,
  currentTrackId,
}: {
  playlist: Playlist;
  currentTrackId: number | null;
}) {
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = playlist.tracks.findIndex((t) => t.trackId === active.id);
    const newIndex = playlist.tracks.findIndex((t) => t.trackId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const result = await moveTrackInPlaylist(
      playlist.tracks[oldIndex],
      newIndex,
      playlist.playlistId,
    );
    if ("error" in result) return;
  };

  const { user, socket } = useLoginContext();
  const auth = useAuth();
  const userHasAccess =
    playlist.djList.some((member) => member.user.username === user.username) ||
    playlist.owner.user.username === user.username;

  const playTrack = (track: Track) => {
    socket.emit("musicPlay", { auth, payload: { playlistId: playlist.playlistId, track } });
  };

  return (
    <>
      <div className="mbq-header">
        <span className="mbq-title">Queue</span>
        <span className="mbq-count">{playlist.tracks.length} tracks</span>
      </div>
      <div className="mbq-list">
        {playlist.tracks.length === 0 ? (
          <div className="mbq-empty">No tracks in queue</div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={playlist.tracks.map((t) => t.trackId)}
              strategy={verticalListSortingStrategy}
            >
              {playlist.tracks.map((track) => (
                <SortableItem
                  key={track.trackId}
                  track={track}
                  playlistId={playlist.playlistId}
                  access={userHasAccess}
                  isCurrent={currentTrackId === track.trackId}
                  onPlay={playTrack}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </>
  );
}
