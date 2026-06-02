import { describe, expect, it } from "vitest";
import {
  createChat,
  forceChatById,
  addMessageToChat,
  addMoveLogToChat,
  getMoveLog,
} from "../../src/services/chat.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { createMessage } from "../../src/services/message.service.ts";
import type { UserWithId } from "../../src/types.ts";

/** Helper: grab a seeded user that is guaranteed to exist after resetEverythingToDefaults */
async function getUser(username: string): Promise<UserWithId> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`seeded user ${username} not found`);
  return user;
}

describe("createChat", () => {
  it("should create a chat with the correct structure", async () => {
    const now = new Date();
    const chat = await createChat(now);

    expect(chat).toStrictEqual({
      chatId: expect.any(String),
      createdAt: now,
      messages: [],
      moveLog: [],
    });
  });

  it("should return unique chatIds for different chats", async () => {
    const chat1 = await createChat(new Date("2025-01-01"));
    const chat2 = await createChat(new Date("2025-01-02"));

    expect(chat1.chatId).not.toBe(chat2.chatId);
  });

  it("should preserve the provided createdAt date", async () => {
    const specificDate = new Date("2024-06-15T12:30:00.000Z");
    const chat = await createChat(specificDate);

    expect(chat.createdAt).toStrictEqual(specificDate);
  });
});

describe("forceChatById", () => {
  it("should return the chat info for a valid chatId", async () => {
    const user = await getUser("user0");
    const now = new Date();
    const created = await createChat(now);

    const fetched = await forceChatById(created.chatId, user);

    expect(fetched).toStrictEqual({
      chatId: created.chatId,
      createdAt: now,
      messages: [],
      moveLog: [],
    });
  });

  it("should throw for an invalid chatId", async () => {
    const user = await getUser("user0");

    await expect(forceChatById("nonexistent-id", user)).rejects.toThrow(/invalid chat id/);
  });

  it("should include the username in the error message for an invalid chatId", async () => {
    const user = await getUser("user1");

    await expect(forceChatById("bad-id", user)).rejects.toThrow(
      `user ${user.username} accessed invalid chat id`,
    );
  });
});

describe("addMessageToChat", () => {
  it("should add a message to an existing chat", async () => {
    const user = await getUser("user0");
    const chat = await createChat(new Date());
    const msg = await createMessage(user, "hello world", new Date());

    const updated = await addMessageToChat(chat.chatId, user, msg.messageId);

    expect(updated.chatId).toBe(chat.chatId);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].text).toBe("hello world");
    expect(updated.messages[0].messageId).toBe(msg.messageId);
  });

  it("should accumulate multiple messages in order", async () => {
    const user = await getUser("user1");
    const chat = await createChat(new Date());
    const msg1 = await createMessage(user, "first", new Date());
    const msg2 = await createMessage(user, "second", new Date());
    const msg3 = await createMessage(user, "third", new Date());

    await addMessageToChat(chat.chatId, user, msg1.messageId);
    await addMessageToChat(chat.chatId, user, msg2.messageId);
    const updated = await addMessageToChat(chat.chatId, user, msg3.messageId);

    expect(updated.messages).toHaveLength(3);
    expect(updated.messages[0].text).toBe("first");
    expect(updated.messages[1].text).toBe("second");
    expect(updated.messages[2].text).toBe("third");
  });

  it("should throw for an invalid chatId", async () => {
    const user = await getUser("user0");
    const msg = await createMessage(user, "test", new Date());

    await expect(addMessageToChat("nonexistent-chat", user, msg.messageId)).rejects.toThrow(
      /invalid chat id/,
    );
  });

  it("should include the username in the error for an invalid chatId", async () => {
    const user = await getUser("user2");

    await expect(addMessageToChat("bad-chat-id", user, "some-message-id")).rejects.toThrow(
      `user ${user.username} sent to invalid chat id`,
    );
  });
});

describe("addMoveLogToChat", () => {
  it("should add a move log entry and return the correct payload", async () => {
    const user = await getUser("user0");
    const chat = await createChat(new Date());
    const moveTime = new Date("2025-03-15T10:00:00.000Z");

    const payload = await addMoveLogToChat(chat.chatId, "took 3 tokens", user, moveTime);

    expect(payload).toStrictEqual({
      chatId: chat.chatId,
      moveDescription: "took 3 tokens",
      user: expect.objectContaining({ username: "user0" }),
      createdAt: moveTime,
    });
  });

  it("should persist the move log entry in the chat", async () => {
    const user = await getUser("user1");
    const chat = await createChat(new Date());
    const moveTime = new Date();

    await addMoveLogToChat(chat.chatId, "played a card", user, moveTime);

    const fetched = await forceChatById(chat.chatId, user);
    expect(fetched.moveLog).toHaveLength(1);
    expect(fetched.moveLog[0].moveDescription).toBe("played a card");
    expect(fetched.moveLog[0].user.username).toBe("user1");
    expect(fetched.moveLog[0].createdAt).toStrictEqual(moveTime);
  });

  it("should accumulate multiple move log entries in order", async () => {
    const user1 = await getUser("user1");
    const user2 = await getUser("user2");
    const chat = await createChat(new Date());

    await addMoveLogToChat(chat.chatId, "move A", user1, new Date("2025-01-01"));
    await addMoveLogToChat(chat.chatId, "move B", user2, new Date("2025-01-02"));
    await addMoveLogToChat(chat.chatId, "move C", user1, new Date("2025-01-03"));

    const fetched = await forceChatById(chat.chatId, user1);
    expect(fetched.moveLog).toHaveLength(3);
    expect(fetched.moveLog[0].moveDescription).toBe("move A");
    expect(fetched.moveLog[1].moveDescription).toBe("move B");
    expect(fetched.moveLog[2].moveDescription).toBe("move C");
    expect(fetched.moveLog[0].user.username).toBe("user1");
    expect(fetched.moveLog[1].user.username).toBe("user2");
  });

  it("should throw for an invalid chatId", async () => {
    const user = await getUser("user0");

    await expect(
      addMoveLogToChat("nonexistent-chat", "some move", user, new Date()),
    ).rejects.toThrow(/invalid chat id/);
  });
});

describe("getMoveLog", () => {
  it("should return an empty array for a nonexistent chat", async () => {
    const result = await getMoveLog("does-not-exist");
    expect(result).toStrictEqual([]);
  });

  it("should return an empty array for a chat with no move log entries", async () => {
    const chat = await createChat(new Date());
    const result = await getMoveLog(chat.chatId);
    expect(result).toStrictEqual([]);
  });

  it("should return move log entries after adding them", async () => {
    const user = await getUser("user3");
    const chat = await createChat(new Date());
    const time1 = new Date("2025-05-01T08:00:00.000Z");
    const time2 = new Date("2025-05-01T08:05:00.000Z");

    await addMoveLogToChat(chat.chatId, "opened with pawn", user, time1);
    await addMoveLogToChat(chat.chatId, "moved knight", user, time2);

    const entries = await getMoveLog(chat.chatId);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toStrictEqual({
      moveDescription: "opened with pawn",
      userId: user.userId,
      createdAt: time1.toISOString(),
    });
    expect(entries[1]).toStrictEqual({
      moveDescription: "moved knight",
      userId: user.userId,
      createdAt: time2.toISOString(),
    });
  });
});
