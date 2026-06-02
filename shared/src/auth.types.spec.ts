import { expect, describe, it } from "vitest";
import { withAuth, zUserAuth } from "./auth.types.ts";
import { z } from "zod";

describe("zod's safeParse", () => {
  it("successfully parses valid input", () => {
    expect(zUserAuth.safeParse({ kind: "password", username: "a", password: "b" })).toStrictEqual({
      success: true,
      data: { kind: "password", username: "a", password: "b" },
    });
    expect(
      zUserAuth.safeParse({ kind: "google", username: "a", sessionToken: "tok" }),
    ).toStrictEqual({
      success: true,
      data: { kind: "google", username: "a", sessionToken: "tok" },
    });
  });

  it("rejects bad inputs without exceptions", () => {
    expect(zUserAuth.safeParse(4)).toMatchObject({ success: false });
    expect(zUserAuth.safeParse({ kind: "password", username: 4, password: "b" })).toMatchObject({
      success: false,
    });
    expect(zUserAuth.safeParse({ kind: "password", username: "a" })).toMatchObject({
      success: false,
    });
    expect(zUserAuth.safeParse({ username: "a", password: "b" })).toMatchObject({
      success: false,
    });
  });
});

describe("zod's parse()", () => {
  it("identifies errors and raises exceptions", () => {
    const goodAuth = { kind: "password", username: "a", password: "b" };
    const badAuth = { kind: "password", username: 4, password: "b" };
    expect(withAuth(z.string()).parse({ auth: goodAuth, payload: "c" })).toStrictEqual({
      auth: goodAuth,
      payload: "c",
    });

    expect(() => withAuth(z.string()).parse({ auth: goodAuth, payload: 3 })).toThrow();
    expect(() => withAuth(z.string()).parse({ auth: badAuth, payload: "c" })).toThrow();
  });
});
