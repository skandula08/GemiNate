import { createContext } from "react";

/**
 * Context to manage the state for the music bar component.
 * It provides the community ID and a function to set the community ID.
 *
 * @property communityID - The current community ID, or null if not set.
 * @property setCommunityID - A function to update the community ID.
 */
export interface MusicBarState {
  communityID: string | null;
  setCommunityID: (id: string | null) => void;
}

export const MusicBarContext = createContext<MusicBarState>({
  communityID: null,
  setCommunityID: () => {},
});
