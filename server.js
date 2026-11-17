// Minimal static file server + OpenWeatherMap proxy.
// The API key is read from the OPENWEATHER_API_KEY environment variable and
// never sent to the browser. Requires Node.js 18+ (global fetch).
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const API_KEY = process.env.OPENWEATHER_API_KEY;
const UPSTREAM = "https://api.openweathermap.org/data/2.5/weather";

if (!API_KEY) {
  console.error("OPENWEATHER_API_KEY environment variable is required");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function handleWeather(req, res, url) {
  if (req.method !== "GET") {
    sendJson(res, 405, { cod: "405", message: "method not allowed" });
    return;
  }
  const city = (url.searchParams.get("q") || "").trim();
  if (!city || city.length > 100) {
    sendJson(res, 400, { cod: "400", message: "missing or invalid city" });
    return;
  }
  const upstream = new URL(UPSTREAM);
  upstream.searchParams.set("units", "metric");
  upstream.searchParams.set("q", city);
  upstream.searchParams.set("appid", API_KEY);
  try {
    const upstreamRes = await fetch(upstream);
    const body = await upstreamRes.text();
    res.writeHead(upstreamRes.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
  } catch (err) {
    sendJson(res, 502, { cod: "502", message: "upstream weather request failed" });
  }
}

function serveStatic(res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    sendJson(res, 400, { message: "bad request" });
    return;
  }
  if (decoded === "/") {
    decoded = "/index.html";
  }
  const filePath = path.normalize(path.join(ROOT, decoded));
  if (!filePath.startsWith(ROOT + path.sep)) {
    sendJson(res, 403, { message: "forbidden" });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!MIME[ext]) {
    sendJson(res, 404, { message: "not found" });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { message: "not found" });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/weather") {
    handleWeather(req, res, url);
    return;
  }
  serveStatic(res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Weather app listening on http://localhost:${PORT}`);
});
