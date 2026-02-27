#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "..", "dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

const port = parseInt(process.env.PORT || "5180", 10);
const host = process.env.HOST || "0.0.0.0";

async function tryReadFile(filePath) {
  try {
    await access(filePath);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  let filePath = join(distDir, pathname);
  let content = await tryReadFile(filePath);

  if (!content && !extname(pathname)) {
    filePath = join(distDir, pathname, "index.html");
    content = await tryReadFile(filePath);
  }

  // SPA fallback: serve index.html for client-side routes
  if (!content) {
    filePath = join(distDir, "index.html");
    content = await tryReadFile(filePath);
  }

  if (!content) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(content);
});

server.listen(port, host, () => {
  const url = `http://localhost:${port}`;
  console.log();
  console.log("  \x1b[36m\u{1F3E2} OpenClaw Office\x1b[0m");
  console.log();
  console.log(`  \x1b[32m\u{27A1}\x1b[0m  Local:   \x1b[36m${url}\x1b[0m`);
  if (host === "0.0.0.0") {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(`  \x1b[32m\u{27A1}\x1b[0m  Network: \x1b[36mhttp://${net.address}:${port}\x1b[0m`);
        }
      }
    }
  }
  console.log();
  console.log("  Press \x1b[1mCtrl+C\x1b[0m to stop");
  console.log();
});
