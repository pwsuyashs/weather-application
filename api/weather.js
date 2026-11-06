// Server-side proxy for OpenWeatherMap (deployed as the /api/weather function).
// The API key is read from the OPENWEATHER_API_KEY environment variable
// (set it in the hosting platform's secret/environment configuration) and is
// never returned to or embedded in the client. Fails closed when it is missing.
//
// Abuse controls (so the proxy cannot be used to burn the owner's quota):
//  - per-client rate limit (PER_IP_LIMIT requests per WINDOW_MS)
//  - global rate limit across all clients (GLOBAL_LIMIT requests per WINDOW_MS)
//  - browser requests must be same-origin (Sec-Fetch-Site / Origin check)
// The counters are in-memory per function instance; this is a best-effort
// bound, so also configure a quota cap in the OpenWeatherMap console.
const UPSTREAM = "https://api.openweathermap.org/data/2.5/weather";
const MAX_CITY_LENGTH = 100;
const WINDOW_MS = 60 * 1000;
const PER_IP_LIMIT = 20;
const GLOBAL_LIMIT = 300;
const MAX_TRACKED_CLIENTS = 10000;

const perClient = new Map();
let globalWindowStart = Date.now();
let globalCount = 0;

function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp.trim();
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return "unknown";
}

function isRateLimited(req) {
  const now = Date.now();

  if (now - globalWindowStart >= WINDOW_MS) {
    globalWindowStart = now;
    globalCount = 0;
    perClient.clear();
  }

  globalCount += 1;
  if (globalCount > GLOBAL_LIMIT) {
    return true;
  }

  const key = clientKey(req);
  const entry = perClient.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    if (perClient.size >= MAX_TRACKED_CLIENTS) {
      // Memory bound reached: fail closed for new clients until the window resets.
      return true;
    }
    perClient.set(key, { start: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > PER_IP_LIMIT;
}

function isSameOriginBrowserRequest(req) {
  const fetchSite = req.headers["sec-fetch-site"];
  if (typeof fetchSite === "string" && fetchSite !== "same-origin") {
    return false;
  }

  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const origin = req.headers["origin"];
  if (typeof origin === "string" && origin.length > 0) {
    try {
      if (new URL(origin).host !== host) {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  const referer = req.headers["referer"];
  if (typeof referer === "string" && referer.length > 0) {
    try {
      if (new URL(referer).host !== host) {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  return true;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isSameOriginBrowserRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (isRateLimited(req)) {
    res.setHeader("Retry-After", String(Math.ceil(WINDOW_MS / 1000)));
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const apikey = process.env.OPENWEATHER_API_KEY;
  if (!apikey) {
    res.status(500).json({ error: "Weather service is not configured" });
    return;
  }

  const rawCity = req.query && req.query.city;
  const city = typeof rawCity === "string" ? rawCity.trim() : "";
  if (!city || city.length > MAX_CITY_LENGTH) {
    res.status(400).json({ error: "Invalid city" });
    return;
  }

  const url =
    UPSTREAM +
    "?units=metric&q=" +
    encodeURIComponent(city) +
    "&appid=" +
    encodeURIComponent(apikey);

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstream weather service unavailable" });
  }
};
