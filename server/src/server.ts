// Run this script to launch the server.
/* eslint no-console: "off" */

import { KeyvMongo } from "@keyv/mongo";
import { Keyv } from "keyv";
import "dotenv/config";
import { app, httpServer } from "./app.ts";
import * as path from "node:path";
import express from "express";
import { createRepo, setDbInitializer } from "./keyv.ts";
import { resetEverythingToDefaults } from "./initRepository.ts";
import { rebuildIndexes } from "./rebuildIndexes.ts";

// --- Global process error handlers to prevent silent crashes ---
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

async function main() {
  // If a MONGO_STR environment variable is given (or set in `server/.env`),
  // then use MongoDB to create the repository.
  const mongoStr = process.env.MONGO_STR || null;
  const mongoDbName = process.env.MONGO_DB_NAME || "GameNite";
  if (mongoStr) {
    setDbInitializer(<T>(name: string) => {
      const mongoConnection = new KeyvMongo(mongoStr, { collection: name, db: mongoDbName });
      return new Keyv<T>(mongoConnection);
    });
  }

  // We only want to initialize the database once, so we check whether
  // we've set the INIT_KEY before. If the INIT_KEY is set, then don't
  // initialize the database anew.
  const initKey = "is_initialized";
  const initRepo = createRepo<{ exists: true; time: string }>("init");
  try {
    const initialized = await initRepo.find(initKey);
    if (!initialized) {
      await resetEverythingToDefaults();
      await initRepo.set(initKey, { exists: true, time: new Date().toISOString() });
    }
  } catch (err) {
    console.error("Failed to initialize database — starting server anyway:", err);
  }

  // Rebuild secondary indexes from existing data so queries can use
  // O(1) lookups instead of full collection scans.
  try {
    await rebuildIndexes();
  } catch (err) {
    console.error("Failed to rebuild indexes — starting server anyway:", err);
  }

  // This if-then-else check for MODE=production helps avoid a common source of
  // pain:
  //
  // 1. You build the website (`npm run build`) and test it in production mode
  // 2. You want to update the frontend, so you start the Vite development
  //    server and edit code
  // 3. You don't realize you have the *Express* server open in your browser,
  //    serving stale files created during the build command in step #1.
  //    You can't get any frontend changes to show up in the browser, no
  //    matter what you do.
  if (process.env.MODE === "production") {
    // In production mode, we want to serve the frontend code from Express
    const clientDist = path.join(import.meta.dirname, "../../client/dist");
    app.use(express.static(clientDist));

    // SPA catch-all: serve index.html for any non-API GET request so that
    // client-side routing works.  The negative lookahead prevents this from
    // intercepting /api/* requests (which would return HTML instead of JSON
    // and cause the browser / Render proxy to surface a 502).
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  } else {
    app.get("/", (req, res) => {
      res.send(
        "You are connecting directly to the API server in development mode! " +
          "You probably want to look elsewhere for the Vite frontend.",
      );
    });
  }

  // Actually start the server
  const port = parseInt(process.env.PORT || "8000");
  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
