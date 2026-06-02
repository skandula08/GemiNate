import { type ChatInfo, type ChatMoveLogPayload } from "@gamenite/shared";
import { getMessagesById } from "./message.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { type UserWithId } from "../types.ts";
import type { ChatRecord, MoveLogEntry, RecordId } from "../models.ts";
import { ChatRepo } from "../repository.ts";

/**
 * Expand a stored chat
 *
 * @param chatId - Valid chat id
 * @returns the expanded chat info object
 */
async function populateChatInfo(chatId: RecordId): Promise<ChatInfo> {
  const chat = await ChatRepo.get(chatId);
  return {
    chatId,
    createdAt: new Date(chat.createdAt),
    messages: await getMessagesById(chat.messages),
    moveLog: await Promise.all(
      chat.moveLog.map(async (entry) => ({
        moveDescription: entry.moveDescription,
        user: await populateSafeUserInfo(entry.userId),
        createdAt: new Date(entry.createdAt),
      })),
    ),
  };
}

/**
 * Creates and store a new chat
 *
 * @param createdAt - Time of chat creation
 * @returns the chat's info object
 */
export async function createChat(createdAt: Date): Promise<ChatInfo> {
  const id = await ChatRepo.add({
    createdAt: createdAt.toISOString(),
    messages: [],
    moveLog: [],
  });
  return populateChatInfo(id);
}

/**
 * Produces the chat for a given id
 *
 * @param chatId - Ostensible chat id
 * @param user - Authenticated user
 * @returns the chat's info object
 * @throws if the chat id is not valid
 */
export async function forceChatById(chatId: string, user: UserWithId): Promise<ChatInfo> {
  const chat = await ChatRepo.find(chatId);
  if (!chat) throw new Error(`user ${user.username} accessed invalid chat id`);

  return populateChatInfo(chatId);
}

/**
 * Adds a message to a chat, updating the chat
 *
 * @param chatId - Ostensible chat id
 * @param user - Authenticated user
 * @param message - Valid message id
 * @returns the updated chat info object
 * @throws if the chat id is not valid
 */
export async function addMessageToChat(
  chatId: string,
  user: UserWithId,
  messageId: string,
): Promise<ChatInfo> {
  const chat = await ChatRepo.find(chatId);
  if (!chat) throw new Error(`user ${user.username} sent to invalid chat id`);
  const newChat: ChatRecord = {
    ...chat,
    messages: [...chat.messages, messageId],
  };
  await ChatRepo.set(chatId, newChat);
  return populateChatInfo(chatId);
}

/**
 * Adds a move log entry to a chat, storing it persistently so it can be
 * retrieved when a user navigates back to the game page.
 *
 * @param chatId - Valid chat id
 * @param moveDescription - Human-readable description of the move
 * @param user - The user who made the move
 * @param createdAt - When the move was made
 * @returns the move log payload to broadcast to clients
 */
export async function addMoveLogToChat(
  chatId: string,
  moveDescription: string,
  user: UserWithId,
  createdAt: Date,
): Promise<ChatMoveLogPayload> {
  const chat = await ChatRepo.find(chatId);
  if (!chat) throw new Error(`move log added to invalid chat id`);
  const entry: MoveLogEntry = {
    moveDescription,
    userId: user.userId,
    createdAt: createdAt.toISOString(),
  };
  const newChat: ChatRecord = {
    ...chat,
    moveLog: [...chat.moveLog, entry],
  };
  await ChatRepo.set(chatId, newChat);
  const safeUser = await populateSafeUserInfo(user.userId);
  return { chatId, moveDescription, user: safeUser, createdAt };
}

/**
 * Retrieves all move log entries for a chat
 *
 * @param chatId - Valid chat id
 * @returns the list of move log entries
 */
export async function getMoveLog(chatId: string): Promise<MoveLogEntry[]> {
  const chat = await ChatRepo.find(chatId);
  if (!chat) return [];
  return chat.moveLog;
}
