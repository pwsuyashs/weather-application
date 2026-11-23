"use strict";

// Minimal dependency-free server for the weather app.
// - Serves the static front end (index.html, style.css, app.js, image/*).
// - Proxies GET /api/weather?city=<name> to OpenWeatherMap, adding the API key
//   from the OPENWEATHER_API_KEY environment variable on the server side only.
// Requires Node.js 18+ (global fetch, AbortSignal.timeout).

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const UPSTREAM_URL = "https://api.openweathermap.org/data/2.5/weather";
const MAX_CITY_LENGTH = 100;

const ROOT = __dirname;
const IMAGE_DIR = path.join(ROOT, "image");
const PUBLIC_FILES = new Set(["index.html", "style.css", "app.js"]);
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

if (!OPENWEATHER_API_KEY) {
  console.error("OPENWEATHER_API_KEY environment variable is required");
  process.exit(1);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendNotFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

async function handleWeather(reqUrl, res) {
  const rawCity = reqUrl.searchParams.get("city");
  const city = typeof rawCity === "string" ? rawCity.trim() : "";
  if (city.length === 0 || city.length > MAX_CITY_LENGTH) {
    sendJson(res, 400, { message: "invalid city" });
    return;
  }

  const upstream = new URL(UPSTREAM_URL);
  upstream.searchParams.set("units", "metric");
  upstream.searchParams.set("q", city);
  upstream.searchParams.set("appid", OPENWEATHER_API_KEY);

  try {
    const upstreamRes = await fetch(upstream, { signal: AbortSignal.timeout(10000) });
    const text = await upstreamRes.text();
    res.writeHead(upstreamRes.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(text);
  } catch (err) {
    sendJson(res, 502, { message: "weather service unavailable" });
  }
}

function serveStatic(pathname, res, headOnly) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (err) {
    sendNotFound(res);
    return;
  }
  if (rel.includes("\0")) {
    sendNotFound(res);
    return;
  }
  if (rel === "/") {
    rel = "/index.html";
  }
  rel = rel.replace(/^\/+/, "");

  const full = path.resolve(ROOT, rel);
  const allowed = PUBLIC_FILES.has(rel) || full.startsWith(IMAGE_DIR + path.sep);
  const contentType = CONTENT_TYPES[path.extname(full).toLowerCase()];
  if (!allowed || !contentType) {
    sendNotFound(res);
    return;
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      sendNotFound(res);
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(headOnly ? undefined : data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Allow": "GET, HEAD" });
    res.end();
    return;
  }

  let reqUrl;
  try {
    reqUrl = new URL(req.url, "http://localhost");
  } catch (err) {
    sendNotFound(res);
    return;
  }

  if (reqUrl.pathname === "/api/weather") {
    handleWeather(reqUrl, res);
    return;
  }

  serveStatic(reqUrl.pathname, res, req.method === "HEAD");
});

server.listen(PORT, () => {
  console.log(`Weather app listening on http://localhost:${PORT}`);
});
