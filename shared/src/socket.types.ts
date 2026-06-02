import {
  type ChatInfo,
  type ChatMoveLogPayload,
  type ChatNewMessagePayload,
  type ChatUserJoinedPayload,
  type ChatUserLeftPayload,
} from "./chat.types.ts";
import { type NewMessagePayload } from "./message.types.ts";
import { type WithAuth } from "./auth.types.ts";
import { type GameMakeMovePayload, type GamePlayInfo, type TaggedGameView } from "./game.types.ts";
import { type SafeUserInfo } from "./user.types.ts";
import type { PlaybackState, Track, Playlist } from "./music.types.ts";
import type {
  CommunityUser,
  DjRequest,
  DjRequestPayload,
  DjRequestResponsePayload,
  SetCommunityRolePayload,
  TransferOwnershipPayload,
} from "./community.types.ts";

/**
 * The Socket.io interface for client to server communication
 */
export interface ClientToServerEvents {
  chatJoin: (payload: WithAuth<string>) => void;
  chatLeave: (payload: WithAuth<string>) => void;
  chatSendMessage: (payload: WithAuth<NewMessagePayload>) => void;
  gameJoinAsPlayer: (payload: WithAuth<string>) => void;
  gameMakeMove: (payload: WithAuth<GameMakeMovePayload>) => void;
  gameStart: (payload: WithAuth<string>) => void;
  gameWatch: (payload: WithAuth<string>) => void;
  communityPageJoin: (payload: WithAuth<string>) => void;
  communityPageLeave: (payload: WithAuth<string>) => void;
  communityJoinAsMember: (payload: WithAuth<string>) => void;
  musicJoin: (payload: WithAuth<{ playlistId: string }>) => void;
  musicPlay: (payload: WithAuth<{ playlistId: string; track: Track }>) => void;
  musicPause: (payload: WithAuth<{ playlistId: string }>) => void;
  musicResume: (payload: WithAuth<{ playlistId: string }>) => void;
  musicNextTrack: (payload: WithAuth<{ playlistId: string }>) => void;
  musicPrevTrack: (payload: WithAuth<{ playlistId: string }>) => void;
  musicRestartTrack: (payload: WithAuth<{ playlistId: string }>) => void;
  musicSeek: (payload: WithAuth<{ playlistId: string; positionMs: number }>) => void;
  musicShuffle: (payload: WithAuth<{ playlistId: string }>) => void;
  musicSetLoopMode: (
    payload: WithAuth<{ playlistId: string; loopMode: "none" | "all" | "one" }>,
  ) => void;
  communitySetRole: (payload: WithAuth<SetCommunityRolePayload>) => void;
  communityTransferOwnership: (payload: WithAuth<TransferOwnershipPayload>) => void;
  communityRequestDj: (payload: WithAuth<DjRequestPayload>) => void;
  communityRespondDjRequest: (payload: WithAuth<DjRequestResponsePayload>) => void;
}

/**
 * The Socket.io interface for server to client information
 */
export interface ServerToClientEvents {
  chatJoined: (payload: ChatInfo) => void;
  chatMoveLog: (payload: ChatMoveLogPayload) => void;
  chatNewMessage: (payload: ChatNewMessagePayload) => void;
  chatUserJoined: (payload: ChatUserJoinedPayload) => void;
  chatUserLeft: (payload: ChatUserLeftPayload) => void;
  gamePlayersUpdated: (payload: SafeUserInfo[]) => void;
  gameStateUpdated: (payload: TaggedGameView & { forPlayer: boolean }) => void;
  gameWatched: (payload: GamePlayInfo) => void;
  communityMembersUpdated: (payload: CommunityUser[]) => void;
  communityDjRequestsUpdated: (payload: DjRequest[]) => void;
  communityDjRequestResult: (payload: { accepted: boolean }) => void;
  joinedMusicStream: (payload: { playlistId: string; state: PlaybackState | null }) => void;
  musicPlaybackUpdate: (payload: { playlistId: string; state: PlaybackState }) => void;
  musicPlaylistUpdate: (payload: { playlist: Playlist }) => void;
}
