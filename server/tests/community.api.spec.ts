import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";

let response: Response;

const auth1 = { kind: "password" as const, username: "user1", password: "pwd1111" };
const auth2 = { kind: "password" as const, username: "user2", password: "pwd2222" };
const authBad = { kind: "password" as const, username: "user1", password: "wrong" };

describe("GET /api/communities/my-communities", () => {
  it("should return 400 when auth query params are missing", async () => {
    response = await supertest(app).get("/api/communities/my-communities");
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request. Must include auth" });

    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: "user1" });
    expect(response.status).toBe(400);

    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ password: "pwd1111" });
    expect(response.status).toBe(400);
  });

  it("should return 403 with invalid credentials", async () => {
    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: authBad.username, password: authBad.password });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should return an empty array when the user has no communities", async () => {
    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });

  it("should return communities the user is a member of after creating one", async () => {
    // Create a community
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Test Community", isPrivate: false } });
    expect(response.status).toBe(200);
    const { communityId } = response.body;

    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([
      {
        communityId,
        members: [
          {
            role: "owner",
            user: {
              username: auth1.username,
              display: "Yāo",
              createdAt: expect.any(String),
            },
          },
        ],
        chat: expect.any(String),
        memberCount: 1,
        name: "Test Community",
      },
    ]);
  });

  it("should include an optional description when present", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({
        auth: auth1,
        payload: { name: "Described Community", description: "A cool community", isPrivate: false },
      });
    expect(response.status).toBe(200);
    const { communityId } = response.body;

    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([
      {
        communityId,
        members: [
          {
            role: "owner",
            user: {
              username: auth1.username,
              display: "Yāo",
              createdAt: expect.any(String),
            },
          },
        ],
        chat: expect.any(String),
        memberCount: 1,
        name: "Described Community",
        description: "A cool community",
      },
    ]);
  });

  it("should not return communities the user has not joined", async () => {
    // user2 creates a community
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth2, payload: { name: "user2 Community", isPrivate: false } });
    expect(response.status).toBe(200);

    // user1 should not see it in their communities
    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });
});

describe("GET /api/communities/joinable", () => {
  it("should return 400 when auth query params are missing", async () => {
    response = await supertest(app).get("/api/communities/joinable");
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request. Must include auth" });

    response = await supertest(app).get("/api/communities/joinable").query({ username: "user1" });
    expect(response.status).toBe(400);

    response = await supertest(app).get("/api/communities/joinable").query({ password: "pwd1111" });
    expect(response.status).toBe(400);
  });

  it("should return 403 with invalid credentials", async () => {
    response = await supertest(app)
      .get("/api/communities/joinable")
      .query({ username: authBad.username, password: authBad.password });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should return an empty array when there are no joinable communities", async () => {
    response = await supertest(app)
      .get("/api/communities/joinable")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });

  it("should return public communities the user has not joined", async () => {
    // user2 creates a public community
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth2, payload: { name: "Public Community", isPrivate: false } });
    expect(response.status).toBe(200);
    const { communityId } = response.body;

    // user1 should see it as joinable
    response = await supertest(app)
      .get("/api/communities/joinable")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([
      {
        communityId,
        members: [
          {
            role: "owner",
            user: {
              username: auth2.username,
              display: "Sénior Dos",
              createdAt: expect.any(String),
            },
          },
        ],
        chat: expect.any(String),
        memberCount: 1,
        name: "Public Community",
      },
    ]);
  });

  it("should not return private communities", async () => {
    // user2 creates a private community
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth2, payload: { name: "Private Community", isPrivate: true } });
    expect(response.status).toBe(200);

    // user1 should not see it as joinable
    response = await supertest(app)
      .get("/api/communities/joinable")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });

  it("should not return communities the user has already joined", async () => {
    // user1 creates a community (making them the owner/member)
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "user1 Community", isPrivate: false } });
    expect(response.status).toBe(200);

    // user1 should not see their own community as joinable
    response = await supertest(app)
      .get("/api/communities/joinable")
      .query({ username: auth1.username, password: auth1.password });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });
});

describe("POST /api/communities/create", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: "not-an-object" });
    expect(response.status).toBe(400);

    // missing required name field
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { isPrivate: false } });
    expect(response.status).toBe(400);

    // missing required isPrivate field
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Test" } });
    expect(response.status).toBe(400);
  });

  it("should return 403 with bad auth", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: authBad, payload: { name: "Test Community", isPrivate: false } });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should succeed and return a communityId for a public community", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "My Community", isPrivate: false } });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ communityId: expect.any(String) });
  });

  it("should succeed and return a communityId for a private community", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Secret Community", isPrivate: true } });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ communityId: expect.any(String) });
  });

  it("should succeed with an optional description", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({
        auth: auth1,
        payload: { name: "Described Community", description: "A description", isPrivate: false },
      });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ communityId: expect.any(String) });
  });

  it("should reject creating a second community on the same day", async () => {
    // Create first community — should succeed
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "First Community", isPrivate: false } });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ communityId: expect.any(String) });

    // Create second community on the same day — should fail
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "Second Community", isPrivate: false } });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error:
        "You already created a community today. Please wait until tomorrow to create another one.",
    });
  });

  it("should allow different users to each create a community on the same day", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth1, payload: { name: "user1 Community", isPrivate: false } });
    expect(response.status).toBe(200);

    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth2, payload: { name: "user2 Community", isPrivate: false } });
    expect(response.status).toBe(200);
  });

  it("should make the creator a member visible in my-communities", async () => {
    response = await supertest(app)
      .post("/api/communities/create")
      .send({ auth: auth2, payload: { name: "user2 Club", isPrivate: false } });
    expect(response.status).toBe(200);
    const { communityId } = response.body;

    response = await supertest(app)
      .get("/api/communities/my-communities")
      .query({ username: auth2.username, password: auth2.password });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([{ communityId, name: "user2 Club", memberCount: 1 }]);
  });
});
