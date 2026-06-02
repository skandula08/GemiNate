import { describe, expect, it } from "vitest";
import {
  getUserByUsername,
  checkAuth,
  findOrCreateGoogleUser,
  generateSessionToken,
  updateAuth,
} from "../../src/services/auth.service.ts";
import { AuthRepo } from "../../src/repository.ts";

describe("getUserByUsername", () => {
  it("should return { userId, username } for an existing user", async () => {
    const result = await getUserByUsername("user0");
    expect(result).toStrictEqual({ userId: expect.any(String), username: "user0" });
  });

  it("should return null for a nonexistent username", async () => {
    const result = await getUserByUsername("doesnotexist");
    expect(result).toBeNull();
  });
});

describe("checkAuth with password kind", () => {
  it("should return user for correct password", async () => {
    const result = await checkAuth({ kind: "password", username: "user1", password: "pwd1111" });
    expect(result).toStrictEqual({ userId: expect.any(String), username: "user1" });
  });

  it("should return null for wrong password", async () => {
    const result = await checkAuth({ kind: "password", username: "user1", password: "wrong" });
    expect(result).toBeNull();
  });

  it("should return null for nonexistent user", async () => {
    const result = await checkAuth({
      kind: "password",
      username: "nobody",
      password: "anything",
    });
    expect(result).toBeNull();
  });
});

describe("checkAuth with google kind", () => {
  it("should return user for correct sessionToken", async () => {
    const token = await generateSessionToken("user2");
    const result = await checkAuth({ kind: "google", username: "user2", sessionToken: token });
    expect(result).toStrictEqual({ userId: expect.any(String), username: "user2" });
  });

  it("should return null for wrong sessionToken", async () => {
    await generateSessionToken("user2");
    const result = await checkAuth({
      kind: "google",
      username: "user2",
      sessionToken: "bad-token",
    });
    expect(result).toBeNull();
  });
});

describe("findOrCreateGoogleUser", () => {
  it("should create a new user on first call", async () => {
    const result = await findOrCreateGoogleUser("google-id-1", "alice@example.com", "Alice");
    expect(result).toStrictEqual({ userId: expect.any(String), username: "alice" });

    // Auth record should have the googleId attached
    const record = await AuthRepo.find("alice");
    expect(record).not.toBeNull();
    expect(record!.googleId).toBe("google-id-1");
  });

  it("should return existing user on second call with same googleId", async () => {
    const first = await findOrCreateGoogleUser("google-id-2", "bob@example.com", "Bob");
    const second = await findOrCreateGoogleUser("google-id-2", "bob@example.com", "Bob");
    expect(second).toStrictEqual(first);
  });

  it("should handle username collision by appending a UUID suffix", async () => {
    // "user0" already exists from seed data, so a Google user with email
    // user0@example.com should get a suffixed username.
    const result = await findOrCreateGoogleUser("google-id-3", "user0@example.com", "User Zero");
    expect(result.username).not.toBe("user0");
    expect(result.username).toMatch(/^user0_[a-f0-9]{8}$/);
    expect(result.userId).toEqual(expect.any(String));
  });
});

describe("generateSessionToken", () => {
  it("should return a token string", async () => {
    const token = await generateSessionToken("user3");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("should allow subsequent checkAuth with the generated token", async () => {
    const token = await generateSessionToken("user3");
    const result = await checkAuth({ kind: "google", username: "user3", sessionToken: token });
    expect(result).toStrictEqual({ userId: expect.any(String), username: "user3" });
  });

  it("should throw if username does not exist", async () => {
    await expect(generateSessionToken("nonexistent")).rejects.toThrow();
  });
});

describe("updateAuth", () => {
  it("should update an existing auth record's password", async () => {
    // Verify original password works
    const before = await checkAuth({ kind: "password", username: "user0", password: "pwd0000" });
    expect(before).not.toBeNull();

    // Update password
    await updateAuth("user0", "newpassword", before!.userId);

    // Old password should no longer work
    const oldPw = await checkAuth({ kind: "password", username: "user0", password: "pwd0000" });
    expect(oldPw).toBeNull();

    // New password should work
    const newPw = await checkAuth({
      kind: "password",
      username: "user0",
      password: "newpassword",
    });
    expect(newPw).toStrictEqual({ userId: before!.userId, username: "user0" });
  });
});
