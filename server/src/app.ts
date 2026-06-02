/* eslint no-console: "off" */

import express, { Router } from "express";
import session from "express-session";
import connectMongo from "connect-mongo";
import passport from "passport";
import { Server } from "socket.io";
import { z } from "zod";
import * as http from "node:http";
import * as chat from "./controllers/chat.controller.ts";
import * as game from "./controllers/game.controller.ts";
import * as user from "./controllers/user.controller.ts";
import * as auth from "./controllers/auth.controller.ts";
import * as thread from "./controllers/thread.controller.ts";
import * as community from "./controllers/community.controller.ts";
import { type GameServer } from "./types.ts";
import * as music from "./controllers/music.controller.ts";
import { setIO } from "./io.ts";
export const app = express();
export const httpServer = http.createServer(app);
const io: GameServer = new Server(httpServer, {
  // Disable HTTP long-polling and use WebSockets only.  The default behaviour
  // is to start every connection with dozens of rapid polling HTTP requests
  // before upgrading to a WebSocket.  Each polling request goes through the
  // full Express middleware stack (session / MongoDB lookup), which overwhelms
  // free-tier hosts like Render and causes intermittent 502s.
  transports: ["websocket"],
});
setIO(io);

// Required for Render (and other reverse-proxy hosts) so Express sees the
// correct protocol and sets secure cookies properly.
app.set("trust proxy", 1);

app.use((req, res, next) => {
  if (req.is("multipart/form-data")) return next();
  express.json({ limit: "5mb" })(req, res, next);
});

export const IS_PROD = process.env.SECURE_COOKIES === "true";

/**
 * Build session configuration object.
 * Extracted for testability of environment-dependent branches.
 */
export function buildSessionConfig(
  isProd: boolean,
  mongoStr: string | undefined,
  secret: string | undefined,
) {
  return {
    secret: secret ?? "dev-secret",
    resave: false,
    saveUninitialized: false,
    ...(mongoStr && { store: connectMongo.create({ mongoUrl: mongoStr }) }),
    cookie: {
      secure: isProd,
      sameSite: isProd ? ("none" as const) : ("lax" as const),
    },
  };
}

/**
 * Express global error handler.
 * Extracted for testability of branch coverage.
 */
export function globalErrorHandler(
  err: unknown,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("Unhandled error in request:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: message });
  }
}

const sessionMiddleware = session(
  buildSessionConfig(IS_PROD, process.env.MONGO_STR, process.env.SESSION_SECRET),
);

// Wrap the session middleware with a timeout so that a slow or broken MongoDB
// connection does not hang the entire request until Render's proxy gives up and
// returns a 502.  If the session store doesn't respond within 5 s we skip it
// and let the request continue without a session (the route will still work for
// unauthenticated endpoints; authenticated ones will return 401/403 as usual).
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    console.error("Session middleware timed out – continuing without session");
    next();
  }, 5_000);

  sessionMiddleware(req, res, (err?: unknown) => {
    clearTimeout(timer);
    next(err as Error | undefined);
  });
});

app.use(passport.initialize());

app.use(
  "/api",
  Router()
    .use(
      "/auth",
      Router().get("/google", auth.getGoogleAuth).get("/google/callback", auth.getGoogleCallback),
    )
    .use(
      "/game",
      express
        .Router() //
        .post("/create", game.postCreate)
        .get("/list", game.getList)
        .get("/:id", game.getById),
    )
    .use(
      "/thread",
      express
        .Router() //
        .post("/create", thread.postCreate)
        .get("/list", thread.getList)
        .get("/:id", thread.getById)
        .post("/:id/comment", thread.postByIdComment),
    )
    .use(
      "/user",
      Router() // Any concrete routes here should be disallowed as usernames
        .post("/list", user.postList)
        .post("/login", user.postLogin)
        .post("/signup", user.postSignup)
        .post("/:username", user.postByUsername)
        .get("/:username", user.getByUsername),
    )
    .use(
      "/communities",
      Router()
        .get("/my-communities", community.getMyCommunities)
        .get("/joinable", community.getJoinableCommunities)
        .get("/ownerID", community.getCommunityOwnerId)
        .get("/banner", community.getCommunityBanner)
        .get("/my-invites", community.getMyInvites)
        .post("/create", community.postCommunity)
        .post("/edit", community.postEditCommunity)
        .post("/invite", community.postCreateInvite)
        .post("/invite/accept", community.postAcceptInvite)
        .post("/invite/decline", community.postDeclineInvite),
    )
    .use(
      "/playlist",
      Router()
        .get("/all", music.getAllPlaylistsCon)
        .post("/create", music.postCreatePlaylist)
        .get("/:playlistID", music.getPlaylistById)
        .get("/update/:playlistID", music.updatePlaylistInfo)
        .get("/community/:communityId", music.getCommunityPlaylist)
        .post("/add/:playlistID", music.addTrack)
        .post("/move/:playlistID", music.moveTrack)
        .post("/delete/:playlistID/", music.deleteTrack),
    )
    .use(
      "/soundcloud",
      Router() // Any concrete routes here should be disallowed as usernames
        .get("/callback", music.authorizeInRedirect)
        .get("/login", music.authorizeInRedirect),
    )
    .use(
      "/tracks",
      Router().get("/search/", music.searchTracks).post("/stream/", music.streamTrack),
    ),
);

// Catch-all 404 for /api/* – any API request that didn't match a route above
// gets a JSON 404 instead of falling through to the SPA catch-all in
// server.ts (which would return index.html and confuse the client/proxy,
// often surfaced as a 502 on Render).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// --- Global Express error handler ---
// This MUST be after all routes/middleware. Express identifies error handlers
// by their 4-parameter signature (err, req, res, next).

app.use(globalErrorHandler);

io.on("connection", (socket) => {
  const socketId = socket.id;
  console.log(`CONN [${socketId}] connected`);

  socket.on("disconnect", () => {
    console.log(`CONN [${socketId}] disconnected`);
  });

  socket.on("chatJoin", chat.socketJoin(socket, io));
  socket.on("chatLeave", chat.socketLeave(socket, io));
  socket.on("chatSendMessage", chat.socketSendMessage(socket, io));

  socket.on("gameJoinAsPlayer", game.socketJoinAsPlayer(socket, io));
  socket.on("gameMakeMove", game.socketMakeMove(socket, io));
  socket.on("gameStart", game.socketStart(socket, io));
  socket.on("gameWatch", game.socketWatch(socket, io));

  socket.on("communityPageJoin", community.socketCommunityPageJoin(socket, io));
  socket.on("communityPageLeave", community.socketCommunityPageLeave(socket, io));
  socket.on("communityJoinAsMember", community.socketJoinAsMember(socket, io));
  socket.on("communitySetRole", community.socketSetRole(socket, io));
  socket.on("communityTransferOwnership", community.socketTransferOwnership(socket, io));
  socket.on("communityRequestDj", community.socketRequestDj(socket, io));
  socket.on("communityRespondDjRequest", community.socketRespondDjRequest(socket, io));

  socket.on("musicJoin", music.musicJoin(socket, io));
  socket.on("musicPlay", music.socketPlayMusic(socket, io));
  socket.on("musicPause", music.musicPause(socket, io));
  socket.on("musicResume", music.musicResume(socket, io));
  socket.on("musicNextTrack", music.musicPlayNextTrack(socket, io));
  socket.on("musicPrevTrack", music.musicPrevTrack(socket, io));
  socket.on("musicRestartTrack", music.musicRestartTrack(socket, io));
  socket.on("musicSeek", music.musicSeek(socket, io));
  socket.on("musicShuffle", music.musicShuffle(socket, io));
  socket.on("musicSetLoopMode", music.musicSetLoopMode(socket, io));

  socket.onAny((name, payload) => {
    const zPayload = z.object({ auth: z.object({ username: z.string() }), payload: z.any() });
    const checked = zPayload.safeParse(payload);

    if (checked.error) {
      console.log(`RECV error: ${checked.error.message}`);
    } else {
      console.log(
        `RECV [${socketId}] got ${name}${checked.data.auth.username} ${JSON.stringify(checked.data.payload)}`,
      );
    }
  });
  socket.onAnyOutgoing((name) => {
    console.log(`SEND [${socketId}] gets ${name}`);
  });
});
