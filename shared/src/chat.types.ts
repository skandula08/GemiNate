import { type SafeUserInfo } from "./user.types.ts";
import { type MessageInfo } from "./message.types.ts";

/**
 * Represents a chat document in the database.
 * - `chatId`: database key
 * - `messages`: the ordered list of messages in the chat
 * - `createdAt`: when the chat was created
 */
export interface DatabaseChat {
  chatId: string;
  messages: string[];
  createdAt: Date;
}

/**
 * Represents a game move log entry as exposed to the client
 * - `moveDescription`: the suffix describing what happened (e.g. " took two tokens, leaving 19")
 * - `user`: the user who made the move
 * - `createdAt`: when the move was made
 */
export interface MoveLogInfo {
  moveDescription: string;
  user: SafeUserInfo;
  createdAt: Date;
}

/**
 * Represents a chat as exposed to the client
 * - `chatId`: database key
 * - `messages`: the ordered list of messages in the chat
 * - `moveLog`: the ordered list of game move descriptions in the chat
 * - `createdAt`: when the chat was created
 */
export interface ChatInfo {
  chatId: string;
  messages: MessageInfo[];
  moveLog: MoveLogInfo[];
  createdAt: Date;
}

/*** TYPES USED IN THE CHAT API ***/

/**
 * Relevant information for informing the client that a user joined a chat
 */
export interface ChatUserJoinedPayload {
  chatId: string;
  user: SafeUserInfo;
}

/**
 * Relevant information for informing the client that a user left a chat
 */
export interface ChatUserLeftPayload {
  chatId: string;
  user: SafeUserInfo;
}

/**
 * Relevant information for informing the client that a message was added to a
 * chat
 */
export interface ChatNewMessagePayload {
  chatId: string;
  message: MessageInfo;
}

/**
 * Relevant information for informing the client that a game move was made
 * - `chatId`: the chat where the move was made
 * - `moveDescription`: a human-readable description of the move
 * - `user`: the user who made the move
 * - `createdAt`: when the move was made
 */
export interface ChatMoveLogPayload {
  chatId: string;
  moveDescription: string;
  user: SafeUserInfo;
  createdAt: Date;
}
