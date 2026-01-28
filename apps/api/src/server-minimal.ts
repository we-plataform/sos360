// Ultra-minimal server for debugging Railway deployment issues
console.log("=== MINIMAL SERVER STARTING ===");
console.log("Time:", new Date().toISOString());
console.log("Node:", process.version);
console.log("PORT:", process.env.PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);

import express from "express";
import { createServer } from "http";

const app = express();
const server = createServer(app);

app.get("/", (_, res) => {
  res.json({ status: "ok", minimal: true });
});

app.get("/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT || "3001", 10);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`=== MINIMAL SERVER RUNNING ON 0.0.0.0:${PORT} ===`);
});

server.on("error", (err) => {
  console.error("SERVER ERROR:", err);
  process.exit(1);
});
