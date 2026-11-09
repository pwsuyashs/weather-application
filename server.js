"use strict";

// Minimal dependency-free server: serves the static weather app and proxies
// /api/weather to OpenWeatherMap, adding the API key from the OWM_API_KEY
// environment variable so the key never reaches the browser.

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const OWM_HOST = "api.openweathermap.org";
const OWM_PATH = "/data/2.5/weather";
const MAX_CITY_LENGTH = 100;
const UPSTREAM_TIMEOUT_MS = 10000;

const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

// Server-side files that must never be served to clients.
const BLOCKED_FILES = new Set(["server.js", "package.json", "package-lock.json"]);

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function proxyWeather(reqUrl, res) {
  const apiKey = process.env.OWM_API_KEY;
  if (!apiKey) {
    // Fail closed: never fall back to an embedded key.
    sendJson(res, 500, { cod: "500", message: "Weather service is not configured" });
    return;
  }

  const city = reqUrl.searchParams.get("q");
  if (typeof city !== "string" || city.trim() === "" || city.length > MAX_CITY_LENGTH) {
    sendJson(res, 400, { cod: "400", message: "Invalid city" });
    return;
  }

  // Fixed upstream host and path; only the city is caller-controlled and it is
  // encoded as a query parameter value.
  const params = new URLSearchParams({ units: "metric", q: city, appid: apiKey });
  const upstream = https.request(
    {
      hostname: OWM_HOST,
      path: OWM_PATH + "?" + params.toString(),
      method: "GET",
      timeout: UPSTREAM_TIMEOUT_MS
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      upRes.pipe(res);
    }
  );

  upstream.on("timeout", () => {
    upstream.destroy(new Error("Upstream timeout"));
  });
  upstream.on("error", () => {
    if (!res.headersSent) {
      sendJson(res, 502, { cod: "502", message: "Weather service unavailable" });
    } else {
      res.end();
    }
  });
  upstream.end();
}

function serveStatic(pathname, res) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (e) {
    sendText(res, 400, "Bad request");
    return;
  }
  if (decoded.indexOf("\0") !== -1) {
    sendText(res, 400, "Bad request");
    return;
  }
  if (decoded === "/" || decoded === "") {
    decoded = "/index.html";
  }

  const segments = decoded.split("/").filter(Boolean);
  // Refuse hidden files/directories (e.g. .git, .env) and any dot segments.
  if (segments.length === 0 || segments.some((s) => s.startsWith("."))) {
    sendText(res, 404, "Not found");
    return;
  }

  const filePath = path.resolve(ROOT, segments.join(path.sep));
  if (!filePath.startsWith(ROOT + path.sep)) {
    sendText(res, 404, "Not found");
    return;
  }

  const type = STATIC_TYPES[path.extname(filePath).toLowerCase()];
  if (!type || BLOCKED_FILES.has(path.basename(filePath).toLowerCase())) {
    sendText(res, 404, "Not found");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => res.end());
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }

  let reqUrl;
  try {
    reqUrl = new URL(req.url, "http://localhost");
  } catch (e) {
    sendText(res, 400, "Bad request");
    return;
  }

  if (reqUrl.pathname === "/api/weather") {
    proxyWeather(reqUrl, res);
    return;
  }

  serveStatic(reqUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log("Weather app listening on port " + PORT);
});
