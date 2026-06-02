import type { Playlist, Track } from "@gamenite/shared";
import { useState, type ChangeEvent } from "react";
import { addToPlaylist, searchForMusic } from "../services/musicService";
import "../components/MusicBar.css";

/**
 * MusicSearch component allows users to search for songs and add them to the current playlist.
 * It displays a search bar, shows search results, and provides an option to add tracks to the queue.
 * Tracks that are already added to the playlist are marked as "Added".
 *
 * @param playlist - The playlist object where the search results will be added.
 *
 * @returns The rendered music search component with input for searching, results display, and add-to-queue functionality.
 */
export default function MusicSearch({ playlist }: { playlist: Playlist }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  /**
   * handleSearch function triggers a search for music based on the user's query.
   * It updates the results state with the search results or sets an error message if the search fails.
   *
   * @returns A promise resolving to the search results or an error if the search fails.
   */
  const handleSearch = async () => {
    setError(null);
    const result = await searchForMusic(query);
    if ("error" in result) {
      setError(result.error);
      setResults([]);
    } else {
      setResults(result);
    }
  };

  /**
   * handleAdd function adds a selected track to the playlist.
   * It updates the state to reflect the addition of the track to the playlist.
   *
   * @param track - The track object to be added to the playlist.
   * @returns A promise resolving to the result of the add-to-playlist operation, updating the `addedIds` state.
   */
  const handleAdd = async (track: Track) => {
    const result = await addToPlaylist(track, playlist.playlistId);
    if ("error" in result) {
      setError(result.error);
    } else {
      setAddedIds((prev) => new Set([...prev, track.trackId]));
    }
  };

  return (
    <div className="mbs-wrap">
      <div className="mbs-header">Search</div>
      <div className="mbs-input-row">
        <input
          className="mbs-input"
          type="text"
          placeholder="Search for songs..."
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSearch();
          }}
          title="Search for songs"
        />
        <button className="mbs-search-btn" onClick={() => void handleSearch()}>
          Search
        </button>
      </div>

      {error && <div className="mbs-error">{error}</div>}

      <div className="mbs-results">
        {results.map((track) => (
          <div key={track.trackId} className="mbs-result-item">
            <img
              className="mbs-artwork"
              src={track.artwork}
              alt={track.title}
              width={38}
              height={38}
            />
            <div className="mbs-info">
              <div className="mbs-track-title">{track.title}</div>
              {track.artist && <div className="mbs-track-artist">{track.artist}</div>}
            </div>
            <button
              className={`mbs-add-btn${addedIds.has(track.trackId) ? " added" : ""}`}
              disabled={addedIds.has(track.trackId)}
              onClick={() => void handleAdd(track)}
              title={addedIds.has(track.trackId) ? "Already added" : "Add to queue"}
            >
              {addedIds.has(track.trackId) ? "Added ✓" : "+ Add"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
