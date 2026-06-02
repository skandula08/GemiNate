import { describe, expect, it } from "vitest";
import { updateUser } from "../../src/services/user.service.ts";
import { enforceAuth } from "../../src/services/auth.service.ts";

// enforceAuth isn't tested by current integration tests,
// because existing tests exercise the REST api, and enforceAuth
// is only used in the socket api
describe("enforceAuth", () => {
  it("should return a user and id on good auth", async () => {
    const user = await enforceAuth({
      kind: "password" as const,
      username: "user1",
      password: "pwd1111",
    });
    expect(user).toStrictEqual({ userId: expect.any(String), username: "user1" });
  });

  it("should raise on bad auth", async () => {
    await expect(
      enforceAuth({ kind: "password", username: "user1", password: "no" }),
    ).rejects.toThrow();
  });
});

// updateUser can't be fully tested by current integration tests; part of its
// contract is that it throws if updateUser is called with an invalid user id,
// but a well-behaved controller won't ever invoke updateUser with an invalid
// user id
describe("updateUser", () => {
  it("should throw if given an invalid user id", async () => {
    await expect(updateUser("fake", { display: "Stacey Fakename" })).rejects.toThrow();
  });

  it("should store and return a profile picture", async () => {
    const profilePic =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const result = await updateUser("user2", { profilePic });
    expect(result.profilePic).toBe(profilePic);
  });

  it("should remove profilePic when set to empty string", async () => {
    // First set a profile pic
    await updateUser("user2", { profilePic: "data:image/png;base64,abc" });
    // Then clear it with empty string
    const result = await updateUser("user2", { profilePic: "" });
    expect(result.profilePic).toBeUndefined();
  });

  it("should update bio and pronouns", async () => {
    const result = await updateUser("user2", { bio: "hello", pronouns: "they/them" });
    expect(result.bio).toBe("hello");
    expect(result.pronouns).toBe("they/them");
  });

  it("should clear bio when set to empty string", async () => {
    await updateUser("user2", { bio: "hello" });
    const result = await updateUser("user2", { bio: "" });
    expect(result.bio).toBeUndefined();
  });

  it("should clear pronouns when set to empty string", async () => {
    await updateUser("user2", { pronouns: "they/them" });
    const result = await updateUser("user2", { pronouns: "" });
    expect(result.pronouns).toBeUndefined();
  });

  it("should update display name", async () => {
    const result = await updateUser("user2", { display: "New Display" });
    expect(result.display).toBe("New Display");
  });

  it("should update password without error", async () => {
    const result = await updateUser("user2", { password: "newpass123" });
    expect(result.username).toBe("user2");
  });
});
