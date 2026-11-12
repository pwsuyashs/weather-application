// Minimal Node.js server: serves the static site and proxies weather lookups to
// OpenWeatherMap so the API key never leaves the server.
// Run with:  OPENWEATHER_API_KEY=<your key> node server.js
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY;
const ROOT = __dirname;
const MAX_CITY_LENGTH = 100;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

if (!API_KEY) {
  console.error("WARNING: OPENWEATHER_API_KEY is not set; /api/weather will respond with 503.");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function handleWeather(req, res, url) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { cod: "405", message: "Method not allowed" });
  }
  // Fail closed: never call upstream without a configured key.
  if (!API_KEY) {
    return sendJson(res, 503, { cod: "503", message: "Weather service is not configured" });
  }
  const city = (url.searchParams.get("city") || "").trim();
  if (!city || city.length > MAX_CITY_LENGTH) {
    return sendJson(res, 400, { cod: "400", message: "A city name is required" });
  }

  const upstream = new URL("https://api.openweathermap.org/data/2.5/weather");
  upstream.searchParams.set("units", "metric");
  upstream.searchParams.set("q", city);
  upstream.searchParams.set("appid", API_KEY);

  const upstreamReq = https.get(upstream, (upstreamRes) => {
    const chunks = [];
    upstreamRes.on("data", (chunk) => chunks.push(chunk));
    upstreamRes.on("end", () => {
      // Pass through OpenWeatherMap's status and JSON body so the client sees the
      // same response shape it did when calling the API directly.
      res.writeHead(upstreamRes.statusCode || 502, {
        "Content-Type": "application/json; charset=utf-8"
      });
      res.end(Buffer.concat(chunks));
    });
    upstreamRes.on("error", () => {
      sendJson(res, 502, { cod: "502", message: "Weather service unavailable" });
    });
  });
  upstreamReq.on("error", () => {
    sendJson(res, 502, { cod: "502", message: "Weather service unavailable" });
  });
}

function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (e) {
    res.writeHead(400);
    return res.end();
  }
  if (pathname === "/") {
    pathname = "/index.html";
  }
  const filePath = path.normalize(path.join(ROOT, pathname));
  const relative = path.relative(ROOT, filePath);
  // Confine to the site root; never serve the server itself or dotfiles (e.g. .env).
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative === "server.js" ||
    relative === "package.json" ||
    relative.split(path.sep).some((segment) => segment.startsWith("."))
  ) {
    res.writeHead(404);
    return res.end("Not found");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/weather") {
    return handleWeather(req, res, url);
  }
  return serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Weather app listening on http://localhost:${PORT}`);
});
