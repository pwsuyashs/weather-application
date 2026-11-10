"use strict";

// Small server with no dependencies. It serves the static weather page and
// forwards weather lookups to OpenWeatherMap. The API key is read only from
// the OWM_API_KEY environment variable and is never sent to the browser.
// Run with: OWM_API_KEY=<key> node server.js

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const OWM_HOST = "api.openweathermap.org";
const OWM_PATH = "/data/2.5/weather";
const MAX_CITY_LENGTH = 100;
const MAX_UPSTREAM_BYTES = 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 10000;

const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendStatus(res, status) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(http.STATUS_CODES[status] || "Error");
}

function handleWeather(reqUrl, res) {
  const apiKey = process.env.OWM_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { message: "Weather service is not configured" });
    return;
  }

  const city = reqUrl.searchParams.get("q");
  if (typeof city !== "string" || city.trim() === "" || city.length > MAX_CITY_LENGTH) {
    sendJson(res, 400, { message: "Invalid city name" });
    return;
  }

  const params = new URLSearchParams({ units: "metric", q: city, appid: apiKey });
  let finished = false;
  const fail = () => {
    if (finished) return;
    finished = true;
    if (!res.headersSent) {
      sendJson(res, 502, { message: "Weather service unavailable" });
    } else {
      res.destroy();
    }
  };

  const upstream = https.get(
    { host: OWM_HOST, path: OWM_PATH + "?" + params.toString(), timeout: UPSTREAM_TIMEOUT_MS },
    (up) => {
      const chunks = [];
      let size = 0;
      up.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_UPSTREAM_BYTES) {
          upstream.destroy(new Error("Upstream response too large"));
          return;
        }
        chunks.push(chunk);
      });
      up.on("end", () => {
        if (finished) return;
        finished = true;
        res.writeHead(up.statusCode || 502, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        });
        res.end(Buffer.concat(chunks));
      });
      up.on("error", fail);
    }
  );
  upstream.on("timeout", () => upstream.destroy(new Error("Upstream timeout")));
  upstream.on("error", fail);
}

function handleStatic(reqUrl, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(reqUrl.pathname);
  } catch (e) {
    sendStatus(res, 400);
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname.includes("\0") || pathname.includes("\\")) {
    sendStatus(res, 400);
    return;
  }
  // Do not serve dotfiles or dot-directories (for example .git or .env).
  if (pathname.split("/").some((segment) => segment.startsWith("."))) {
    sendStatus(res, 404);
    return;
  }

  const filePath = path.resolve(ROOT, "." + pathname);
  if (!filePath.startsWith(ROOT + path.sep)) {
    sendStatus(res, 404);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  let type = STATIC_TYPES[ext];
  if (ext === ".js" && filePath === path.join(ROOT, "app.js")) {
    type = "text/javascript; charset=utf-8";
  }
  if (!type) {
    sendStatus(res, 404);
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendStatus(res, 404);
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    sendStatus(res, 405);
    return;
  }
  let reqUrl;
  try {
    reqUrl = new URL(req.url, "http://localhost");
  } catch (e) {
    sendStatus(res, 400);
    return;
  }
  if (reqUrl.pathname === "/api/weather") {
    handleWeather(reqUrl, res);
    return;
  }
  handleStatic(reqUrl, res);
});

server.listen(PORT, () => {
  if (!process.env.OWM_API_KEY) {
    console.warn("OWM_API_KEY is not set; /api/weather will return 500 until it is configured.");
  }
  console.log("Weather app listening on port " + PORT);
});
