import {
  type ClientToServerEvents,
  type ErrorMsg,
  type MessageInfo,
  type SafeUserInfo,
  type ServerToClientEvents,
} from "@gamenite/shared";
import { Socket } from "socket.io-client";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Any REST API endpoint that returns `T` must return a promise, and always
 * includes the possibility of failure, so `APIResponse<T>` is shorthand for
 * `Promise<T | { error: string }>`. To check for the error condition in
 * TypeScript, use the `if ('error' in obj)` test.
 */
export type APIResponse<T> = Promise<T | ErrorMsg>;

/**
 * In addition to messages, chats can include socket-introduced messages
 * that a user entered or left the chat, as well as game move log entries.
 */
export type ChatMessage =
  | MessageInfo
  | { messageId: string; meta: "entered"; dateTime: Date; user: SafeUserInfo }
  | { messageId: string; meta: "left"; dateTime: Date; user: SafeUserInfo }
  | {
      messageId: string;
      meta: "move";
      dateTime: Date;
      moveDescription: string;
      user: SafeUserInfo;
    };

export interface GameProps<View, Move> {
  userPlayerIndex: number;
  players: SafeUserInfo[];
  view: View;
  makeMove: (move: Move) => void;
}
