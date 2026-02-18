import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import app from "./app";
import { connectDB } from "./db";
import { initSocketServer } from "./services/socket.service";

const PORT = Number(process.env.PORT ?? 3000);

// CORS origins for Socket.io
const rawOrigins =
  process.env.FRONTEND_URL ||
  "http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:8081,http://localhost:8081,http://127.0.0.1:8082,http://localhost:8082,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000";
const corsOrigins = rawOrigins.split(",").map((s) => s.trim());

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
initSocketServer(httpServer, corsOrigins);

connectDB()
  .then(() => {
    console.log("✅ Database Connection Successful!!!");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is listening on http://localhost:${PORT}`);
      console.log(`🔌 Socket.io is ready for real-time connections`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed");
    console.error(err);
    process.exit(1);
  });
