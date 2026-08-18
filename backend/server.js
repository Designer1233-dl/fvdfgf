const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const ENV_FILE = path.join(ROOT, ".env");

loadEnvFile(ENV_FILE);

const CONFIG = {
  appName: process.env.APP_NAME || "Халява от Илюшки",
  port: Number(process.env.PORT || 3000),
  adminPassword: process.env.ADMIN_PASSWORD || "676767win",
  webAppUrl: String(process.env.WEBAPP_URL || "").trim(),
  botUsername: String(process.env.BOT_USERNAME || "").trim().replace(/^@/, ""),
  telegramBotToken: String(
    process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ""
  ).trim(),
  telegramAppShortName: String(process.env.TELEGRAM_APP_SHORT_NAME || "").trim().replace(/^\/+|\/+$/g, ""),
  dataFilePath: process.env.DB_PATH
    ? path.resolve(ROOT, process.env.DB_PATH)
    : DATA_FILE,
};

ensureDataFile();
const state = loadState();

setInterval(() => {
  autoFinalizeDueRaffles();
}, 1000);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if ((req.method || "GET") === "OPTIONS") {
      writeCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      const body = await readJsonBody(req);
      await handleApi(req, res, url, body);
      return;
    }

    serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : "internal_error",
      message: error.message,
    });
  }
});

server.listen(CONFIG.port, () => {
  console.log(`${CONFIG.appName} listening on http://localhost:${CONFIG.port}`);
});

async function handleApi(req, res, url, body) {
  const pathname = url.pathname;
  const method = req.method || "GET";
  const adminSession = getAdminSession(req);

  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      config: {
        appName: CONFIG.appName,
        hasTelegramLink: Boolean(buildShareLink({ slug: "preview" })),
        hasTelegramAuth: Boolean(CONFIG.telegramBotToken),
      },
      admin: {
        authorized: Boolean(adminSession),
      },
      now: new Date().toISOString(),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/login") {
    const password = String(body.password || "");
    if (password !== CONFIG.adminPassword) {
      sendJson(res, 401, { error: "invalid_password" });
      return;
    }

    const token = crypto.randomUUID();
    state.adminSessions = (state.adminSessions || []).filter((item) => item.expiresAt > Date.now());
    state.adminSessions.push({
      token,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });
    persistState();
    sendJson(res, 200, { token });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/logout") {
    if (adminSession) {
      state.adminSessions = state.adminSessions.filter((item) => item.token !== adminSession.token);
      persistState();
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/admin/raffles") {
    assertAdmin(adminSession);
    sendJson(res, 200, {
      raffles: state.raffles
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((raffle) => serializeRaffle(raffle)),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/raffles") {
    assertAdmin(adminSession);
    const raffle = createRaffle(body);
    state.raffles.push(raffle);
    persistState();
    sendJson(res, 201, {
      raffle: serializeRaffle(raffle),
      shareLink: raffle.shareLink,
    });
    return;
  }

  const adminFinalizeMatch = pathname.match(/^\/api\/admin\/raffles\/([^/]+)\/finalize$/);
  if (method === "POST" && adminFinalizeMatch) {
    assertAdmin(adminSession);
    const raffle = state.raffles.find((item) => item.id === adminFinalizeMatch[1]);
    if (!raffle) {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }

    finalizeRaffle(raffle);
    persistState();
    sendJson(res, 200, { raffle: serializeRaffle(raffle) });
    return;
  }

  if (method === "GET" && pathname === "/api/raffles") {
    sendJson(res, 200, {
      raffles: state.raffles
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((raffle) => serializeRaffle(raffle)),
    });
    return;
  }

  const publicMatch = pathname.match(/^\/api\/raffles\/slug\/([^/]+)$/);
  if (method === "GET" && publicMatch) {
    const raffle = state.raffles.find((item) => item.slug === publicMatch[1]);
    if (!raffle) {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }

    sendJson(res, 200, { raffle: serializeRaffle(raffle) });
    return;
  }

  const joinMatch = pathname.match(/^\/api\/raffles\/slug\/([^/]+)\/join$/);
  if (method === "POST" && joinMatch) {
    const raffle = state.raffles.find((item) => item.slug === joinMatch[1]);
    if (!raffle) {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }

    const participant = joinRaffle(raffle, body);
    persistState();
    sendJson(res, 201, {
      raffle: serializeRaffle(raffle),
      participant,
    });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

function createRaffle(body) {
  const title = String(body.title || "").trim() || "Новый розыгрыш";
  const prizeText = String(body.prizeText || "").trim() || "Секретный приз";
  const winnersCount = clampInt(body.winnersCount, 1, 20, 1);
  const timerMinutes = clampInt(body.timerMinutes, 1, 60 * 24 * 30, 60);
  const slug = randomSlug();
  const endsAt = new Date(Date.now() + timerMinutes * 60 * 1000).toISOString();

  const raffle = {
    id: crypto.randomUUID(),
    slug,
    title,
    prizeText,
    winnersCount,
    timerMinutes,
    createdAt: new Date().toISOString(),
    endsAt,
    status: "active",
    shareLink: buildShareLink({ slug }),
    participants: [],
    winners: [],
    resultText: "",
  };

  return raffle;
}

function joinRaffle(raffle, body) {
  if (raffle.status !== "active") {
    raise(409, "raffle_closed");
  }

  const viewer = resolveVerifiedTelegramUser(body);
  const telegramId = String(viewer.id || "").trim();
  const username = String(viewer.username || "").trim();
  const displayName = String(
    [viewer.first_name, viewer.last_name].filter(Boolean).join(" ").trim() ||
      viewer.username ||
      "Игрок"
  ).trim();
  const photoUrl = String(viewer.photo_url || viewer.photoUrl || "").trim();

  if (!telegramId) {
    raise(400, "telegram_required");
  }

  const existing = raffle.participants.find((item) => item.telegramId === telegramId);
  if (existing) {
    return serializeParticipant(existing, raffle);
  }

  const participant = {
    id: crypto.randomUUID(),
    telegramId,
    username,
    displayName,
    photoUrl,
    joinedAt: new Date().toISOString(),
  };

  raffle.participants.push(participant);
  return serializeParticipant(participant, raffle);
}

function finalizeRaffle(raffle) {
  if (raffle.status === "completed") {
    return raffle;
  }

  raffle.status = "completed";
  const pool = raffle.participants.slice();
  const winners = [];
  const winnerCount = Math.min(raffle.winnersCount, pool.length);

  for (let index = 0; index < winnerCount; index += 1) {
    const selectedIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool.splice(selectedIndex, 1)[0];
    winners.push({
      place: index + 1,
      participantId: chosen.id,
      telegramId: chosen.telegramId,
      username: chosen.username,
      displayName: chosen.displayName,
      photoUrl: chosen.photoUrl,
    });
  }

  raffle.winners = winners;
  raffle.resultText = winners.length
    ? winners
        .map((winner) => `Победитель ${winner.place}: ${winner.username ? `@${winner.username}` : winner.displayName}`)
        .join(" | ")
    : "Победителей нет";
  return raffle;
}

function autoFinalizeDueRaffles() {
  let changed = false;
  for (const raffle of state.raffles) {
    if (raffle.status === "active" && new Date(raffle.endsAt).getTime() <= Date.now()) {
      finalizeRaffle(raffle);
      changed = true;
    }
  }
  if (changed) {
    persistState();
  }
}

function serializeRaffle(raffle) {
  const participantCount = raffle.participants.length;
  const chancePercent = participantCount
    ? Number(((Math.min(raffle.winnersCount, participantCount) / participantCount) * 100).toFixed(2))
    : 0;

  return {
    id: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    prizeText: raffle.prizeText,
    winnersCount: raffle.winnersCount,
    timerMinutes: raffle.timerMinutes,
    createdAt: raffle.createdAt,
    endsAt: raffle.endsAt,
    status: raffle.status,
    shareLink: raffle.shareLink,
    participantCount,
    chancePercent,
    participants: raffle.participants.map((participant) => serializeParticipant(participant, raffle)),
    winners: raffle.winners.map((winner) => ({
      ...winner,
      usernameLabel: winner.username ? `@${winner.username}` : winner.displayName,
    })),
    resultText: raffle.resultText,
  };
}

function serializeParticipant(participant, raffle) {
  const participantCount = Math.max(1, raffle.participants.length);
  const chancePercent = Number(
    ((Math.min(raffle.winnersCount, participantCount) / participantCount) * 100).toFixed(2)
  );

  return {
    ...participant,
    usernameLabel: participant.username ? `@${participant.username}` : participant.displayName,
    chancePercent,
  };
}

function buildShareLink({ slug }) {
  const botUsername = CONFIG.botUsername;
  if (botUsername && botUsername !== "your_bot") {
    return `https://t.me/${botUsername}?startapp=${encodeURIComponent(slug)}`;
  }

  const webAppUrl = CONFIG.webAppUrl;
  if (webAppUrl && !webAppUrl.includes("your-domain")) {
    const separator = webAppUrl.includes("?") ? "&" : "?";
    return `${webAppUrl}${separator}raffle=${encodeURIComponent(slug)}`;
  }

  return `/?raffle=${encodeURIComponent(slug)}`;
}

function getAdminSession(req) {
  const token = String(req.headers["x-admin-token"] || "").trim();
  if (!token) {
    return null;
  }

  const session = (state.adminSessions || []).find(
    (item) => item.token === token && item.expiresAt > Date.now()
  );
  return session || null;
}

function assertAdmin(session) {
  if (!session) {
    raise(401, "admin_required");
  }
}

function ensureDataFile() {
  fs.mkdirSync(path.dirname(CONFIG.dataFilePath), { recursive: true });
  if (!fs.existsSync(CONFIG.dataFilePath)) {
    fs.writeFileSync(
      CONFIG.dataFilePath,
      JSON.stringify({ raffles: [], adminSessions: [] }, null, 2)
    );
  }
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG.dataFilePath, "utf8"));
    return {
      raffles: Array.isArray(parsed.raffles) ? parsed.raffles : [],
      adminSessions: Array.isArray(parsed.adminSessions) ? parsed.adminSessions : [],
    };
  } catch (error) {
    return { raffles: [], adminSessions: [] };
  }
}

function persistState() {
  fs.writeFileSync(CONFIG.dataFilePath, JSON.stringify(state, null, 2));
}

function writeCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(res, statusCode, payload) {
  writeCors(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function serveStatic(pathname, res) {
  const normalized = (pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  const filePath = path.join(FRONTEND_DIR, normalized);
  if (!filePath.startsWith(FRONTEND_DIR)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallback = path.join(FRONTEND_DIR, "index.html");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(fallback));
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  };

  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(Object.assign(new Error("invalid_json"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function randomSlug() {
  return crypto.randomBytes(4).toString("hex");
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function raise(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function resolveVerifiedTelegramUser(body) {
  const initData = String(body.initData || "").trim();
  if (!initData) {
    raise(400, "telegram_init_data_required");
  }

  if (!CONFIG.telegramBotToken) {
    raise(500, "telegram_bot_token_required");
  }

  const params = new URLSearchParams(initData);
  const providedHash = params.get("hash");
  if (!providedHash) {
    raise(400, "telegram_hash_missing");
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) {
    raise(400, "telegram_auth_date_missing");
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - authDate);
  if (ageSeconds > 60 * 60 * 24) {
    raise(401, "telegram_init_data_expired");
  }

  const checkString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(CONFIG.telegramBotToken)
    .digest();
  const expectedHash = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  if (expectedHash !== providedHash) {
    raise(401, "telegram_init_data_invalid");
  }

  const userJson = params.get("user");
  if (!userJson) {
    raise(400, "telegram_user_missing");
  }

  try {
    return JSON.parse(userJson);
  } catch (error) {
    raise(400, "telegram_user_invalid");
  }
}
