import { describe, expect, it } from "vitest";
import { createMessage, getMessagesById } from "../../src/services/message.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import type { UserWithId } from "../../src/types.ts";

/** Helper: get a seeded user or fail */
async function getUser(username: string): Promise<UserWithId> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`Seeded user "${username}" not found`);
  return user;
}

describe("createMessage", () => {
  it("should create a message with the correct text, createdAt, and createdBy", async () => {
    const user = await getUser("user0");
    const text = "Hello, world!";
    const createdAt = new Date("2025-06-15T12:00:00.000Z");

    const msg = await createMessage(user, text, createdAt);

    expect(msg.messageId).toEqual(expect.any(String));
    expect(msg.text).toBe(text);
    expect(new Date(msg.createdAt).toISOString()).toBe(createdAt.toISOString());
    expect(msg.createdBy).toStrictEqual(
      expect.objectContaining({
        username: "user0",
        display: "The Knight Of Games",
      }),
    );
  });

  it("should return distinct message ids for different messages", async () => {
    const user = await getUser("user1");
    const now = new Date();

    const msg1 = await createMessage(user, "first", now);
    const msg2 = await createMessage(user, "second", now);

    expect(msg1.messageId).not.toBe(msg2.messageId);
  });

  it("should preserve the createdBy user info from a different user", async () => {
    const user = await getUser("user2");
    const msg = await createMessage(user, "testing user2", new Date());

    expect(msg.createdBy.username).toBe("user2");
    expect(msg.createdBy.display).toBe("Sénior Dos");
  });
});

describe("getMessagesById", () => {
  it("should return messages in the same order as the provided ids", async () => {
    const user = await getUser("user0");
    const now = new Date();

    const msg1 = await createMessage(user, "alpha", now);
    const msg2 = await createMessage(user, "beta", now);
    const msg3 = await createMessage(user, "gamma", now);

    // Request in reverse order
    const results = await getMessagesById([msg3.messageId, msg1.messageId, msg2.messageId]);

    expect(results).toHaveLength(3);
    expect(results[0].text).toBe("gamma");
    expect(results[1].text).toBe("alpha");
    expect(results[2].text).toBe("beta");
  });

  it("should return an empty array when given an empty id list", async () => {
    const results = await getMessagesById([]);
    expect(results).toStrictEqual([]);
  });

  it("should throw for an invalid message id", async () => {
    await expect(getMessagesById(["nonexistent-id"])).rejects.toThrow();
  });

  it("should throw if any id in the list is invalid", async () => {
    const user = await getUser("user1");
    const msg = await createMessage(user, "valid message", new Date());

    await expect(getMessagesById([msg.messageId, "bad-id"])).rejects.toThrow();
  });

  it("should return a single message when given one valid id", async () => {
    const user = await getUser("user3");
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const msg = await createMessage(user, "solo", createdAt);

    const results = await getMessagesById([msg.messageId]);

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe(msg.messageId);
    expect(results[0].text).toBe("solo");
    expect(new Date(results[0].createdAt).toISOString()).toBe(createdAt.toISOString());
    expect(results[0].createdBy.username).toBe("user3");
  });
});
