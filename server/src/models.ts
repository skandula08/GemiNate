import type { CommunityRole, GameKey } from "@gamenite/shared";
import type { Track } from "@gamenite/shared/src/music.types.ts";

/**
 * Record identifiers used to look up keys in a database. This type
 * abbreviation is intended to suggest that the key should be a randomly
 * generated unique ID.
 */
export type RecordId = string;

/**
 * Actual JavaScript Date objects can't necessarily be stored in a database;
 * this type indicates that the string should be the result of taking a Date
 * object and turning it to a string with the Date.toISOString() method.
 */
export type DateISO = string;

/**
 * Represents a user's authorization record in the database.
 * - `userId`: the user ID of the corresponding User model
 * - `password`: the password for local accounts (absent for Google SSO users)
 * - `googleId`: the Google OAuth `sub` claim (absent for local accounts)
 * - `sessionToken`: an active session token for Google SSO users
 */
export interface AuthRecord {
  userId: RecordId; // References User models
  password?: string;
  googleId?: string;
  sessionToken?: string;
}

/**
 * Represents a chat document in the database.
 * - `messages`: the ordered list of messages in the chat
 * - `moveLog`: the ordered list of move log entries for this chat
 * - `createdAt`: when the chat was created
 */
export interface ChatRecord {
  messages: RecordId[]; // References Message models
  moveLog: MoveLogEntry[];
  createdAt: DateISO;
}

/**
 * Represents a game move log entry stored in a chat.
 * - `moveDescription`: human-readable description of the move
 * - `userId`: the user who made the move
 * - `createdAt`: when the move was made
 */
export interface MoveLogEntry {
  moveDescription: string;
  userId: RecordId;
  createdAt: DateISO;
}

/**
 * Represents a comment in the database.
 * - `text`: comment contents
 * - `createdBy`: username of the commenter
 * - `createdAt`: when the comment was made
 * - `editedAt`: when the comment was last modified
 */
export interface CommentRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
  editedAt?: DateISO;
}

/**
 * Represents a game document in the database.
 * - `type`: picks which game this is
 * - `state`: absent if the game hasn't started, or the id for the game's state
 * - `chat`: id for the game's chat
 * - `players`: active players for the game
 * - `createdAt`: when the game was created
 * - `createdBy`: username of the person who created the game
 */
export interface GameRecord {
  type: GameKey;
  state?: unknown;
  done: boolean;
  chat: RecordId; // References Chat records
  players: RecordId[]; // References User records
  createdAt: DateISO;
  createdBy: RecordId; // References User records
}

/**
 * Represents a message in the database.
 * - `text`: message contents
 * - `createdBy`: username of message sender
 * - `createdAt`: when the message was sent
 */
export interface MessageRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
}

/**
 * Represents a forum post as it's stored in the database.
 * - `title`: post title
 * - `text`: post contents
 * - `createdAt`: when the thread was posted
 * - `createdBy`: username of OP
 * - `comments`: replies to the post
 */
export interface ThreadRecord {
  title: string;
  text: string;
  createdAt: DateISO;
  createdBy: RecordId; // References User records
  comments: RecordId[]; // References Comment records
}

/**
 * Represents a user document in the database.
 * - `password`: user's password
 * - `display`: A display name
 * - `bio`: A bio the user can set to show on their profile
 * - `pronouns`: A set of personal pronouns a user can set to show on their profile
 * - `profilePic`: A base64-encoded data URL for the user's profile picture
 * - `createdAt`: when this user registered.
 */
export interface UserRecord {
  username: string; // References Auth records
  display: string;
  bio?: string;
  pronouns?: string;
  profilePic?: string;
  createdAt: DateISO;
}

/**
 * Represents a user's participation in a community
 * Basically a bridge between users and community -- just a user and what role they are
 * This isn't a db record, just a part of the community record
 * - `userId`: the user's id
 * - `role`: their role
 */
export interface CommunityParticipant {
  userId: RecordId;
  role: CommunityRole;
}

/**
 * Represents a community document in the database
 * - `name`: display name of the community
 * - `backgroundImage`: optional base64 encoded image
 * - `description`: optional description of the community
 * - `isPrivate`: whether the community is private
 * - `participants`: users associated with this community and their roles
 * - `chat`: the community's chat - its like the chat associated with a game
 * - `jukeboxId`: the community's jukebox (to be impl.)
 * - `createdAt`: when the community was created
 * - `createdBy`: the user who created the community
 */
export interface CommunityRecord {
  name: string;
  backgroundImage?: string;
  description?: string;
  isPrivate: boolean;
  participants: CommunityParticipant[];
  djRequests: RecordId[]; // userIds of members requesting DJ status
  chat: RecordId; // references chat records
  jukeboxId?: RecordId; // References Jukebox records
  createdAt: DateISO;
  createdBy: RecordId; // references User records
}

/**
 * Represents a community invite token in the database
 * - `communityId`: the community this token grants access to
 * - `createdBy`: the user who generated the token (must be owner at time of creation)
 * - `createdAt`: when the token was created
 * - `expiresAt`: when the token becomes invalid
 */
export interface InviteTokenRecord {
  communityId: RecordId; // References Community records
  targetUserId: RecordId; // References User records — the specific user this invite is for
  createdBy: RecordId; // References User records
  createdAt: DateISO;
  expiresAt: DateISO;
}

/**
 * Represents a playlist document in the database.
 * - `title`: title of the playlist
 * - `communityId`: the id of the community this music playlist is housed in
 * - `createdAt`: when this playlist was created.
 * */
export interface PlaylistRecord {
  title: string;
  communityId: string;
  owner: CommunityParticipant;
  djList: CommunityParticipant[];
  tracks: Track[];
  duration: number;
  createdAt: Date;
}
