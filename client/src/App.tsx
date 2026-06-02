/* eslint no-console: "off" */

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login.tsx";
import type { AuthContext } from "./contexts/LoginContext.ts";
import Layout from "./components/Layout.tsx";
import Home from "./pages/Home.tsx";
import ThreadList from "./pages/ThreadList.tsx";
import Profile from "./pages/Profile.tsx";
import { io } from "socket.io-client";
import type { GameSocket } from "./util/types.ts";
import LoggedInRoute from "./components/LoggedInRoute.tsx";
import NewGame from "./pages/NewGame.tsx";
import Game from "./pages/Game.tsx";
import GameList from "./pages/GameList.tsx";
import ThreadPage from "./pages/ThreadPage.tsx";
import { ErrorBoundary } from "react-error-boundary";
import fallback from "./fallback.tsx";
import NewThread from "./pages/NewThread.tsx";
import TimeContextKeeper from "./components/UpdatingTimeContext.tsx";
import Communities from "./pages/Communities.tsx";
import CreateCommunityForm from "./components/CreateCommunityForm.tsx";
import CommunityPage from "./pages/CommunityPage.tsx";
import GoogleCallback from "./pages/GoogleCallback.tsx";
import EditCommunityPage from "./pages/EditCommunityPage.tsx";
import { loginUser, getUserById } from "./services/userService.ts";
/** Check if an error response was caused by a transient server issue */
function isTransientError(result: { error: string; serverError?: boolean }): boolean {
  return result.serverError === true;
}

/** If `true`, all incoming socket messages will be logged */
const DEBUG_SOCKETS = false;

/**
 * Websocket connection for the app. It would be natural to define this in a
 * useEffect hook, but the React docts advise against this.
 * https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application
 * */
let socket: GameSocket | null = null;
if (typeof window !== "undefined") {
  socket = io({ transports: ["websocket"] });
  if (DEBUG_SOCKETS) {
    socket.onAny((tag, payload) => {
      console.log(`from socket got ${tag}(${JSON.stringify(payload)})`);
    });
  }
}

function NoSuchRoute() {
  const { pathname } = useLocation();
  return `No page found for route '${pathname}'`;
}

const STORAGE_KEY = "gamenite_auth";

type StoredAuth =
  | { kind: "password"; username: string; pass: string }
  | { kind: "google"; username: string; sessionToken: string };

export default function App() {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const updateAuth = useCallback((newAuth: AuthContext | null) => {
    if (newAuth) {
      const stored: StoredAuth =
        newAuth.kind === "password"
          ? { kind: "password", username: newAuth.user.username, pass: newAuth.pass }
          : { kind: "google", username: newAuth.user.username, sessionToken: newAuth.sessionToken };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setAuth(newAuth);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsRestoringSession(false);
      return;
    }
    let stored: StoredAuth;
    try {
      stored = JSON.parse(raw) as StoredAuth;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setIsRestoringSession(false);
      return;
    }
    const restore = async () => {
      try {
        if (stored.kind === "password") {
          const user = await loginUser({
            kind: "password",
            username: stored.username,
            password: stored.pass,
          });
          if (!("error" in user)) {
            setAuth({ kind: "password", user, pass: stored.pass, reset: () => updateAuth(null) });
          } else if (!isTransientError(user as { error: string; serverError?: boolean })) {
            // Only clear credentials on definitive auth failures (4xx),
            // NOT on transient server errors (502, 503, etc.)
            localStorage.removeItem(STORAGE_KEY);
          }
        } else if (stored.kind === "google") {
          const user = await getUserById(stored.username);
          if (!("error" in user)) {
            setAuth({
              kind: "google",
              user,
              sessionToken: stored.sessionToken,
              reset: () => updateAuth(null),
            });
          } else if (!isTransientError(user as { error: string; serverError?: boolean })) {
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        setIsRestoringSession(false);
      }
    };
    void restore();
  }, [updateAuth]);

  return (
    socket && (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login setAuth={updateAuth} />} />
          <Route path="/auth/callback" element={<GoogleCallback setAuth={updateAuth} />} />
          <Route
            element={
              isRestoringSession ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                  }}
                >
                  Restoring session...
                </div>
              ) : (
                <LoggedInRoute auth={auth} socket={socket}>
                  <TimeContextKeeper updateFrequency={20 * 1000}>
                    <ErrorBoundary fallbackRender={fallback}>
                      <Layout />
                    </ErrorBoundary>
                  </TimeContextKeeper>
                </LoggedInRoute>
              )
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/forum" element={<ThreadList />} />
            <Route path="/forum/post/new" element={<NewThread />} />
            <Route path="/forum/post/:threadId" element={<ThreadPage />} />
            <Route path="/games" element={<GameList />} />
            <Route path="/game/new" element={<NewGame />} />
            <Route path="/game/:gameId" element={<Game />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/communities/new" element={<CreateCommunityForm />} />
            <Route path="/community/:communityID" element={<CommunityPage />} />
            <Route path="/community/edit/:communityID" element={<EditCommunityPage />} />
            <Route path="/*" element={<NoSuchRoute />} />
          </Route>
        </Routes>
      </BrowserRouter>
    )
  );
}
