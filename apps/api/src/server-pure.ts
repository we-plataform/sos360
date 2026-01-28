// Pure Node.js server - no dependencies
console.log("=== PURE NODE SERVER ===");
console.log("Time:", new Date().toISOString());
console.log("Node:", process.version);
console.log("PORT:", process.env.PORT);

import { createServer } from "http";

const PORT = parseInt(process.env.PORT || "3001", 10);

const server = createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      pure: true,
      timestamp: new Date().toISOString(),
      path: req.url,
    }),
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`=== PURE SERVER RUNNING ON 0.0.0.0:${PORT} ===`);
});

server.on("error", (err) => {
  console.error("SERVER ERROR:", err);
  process.exit(1);
});
