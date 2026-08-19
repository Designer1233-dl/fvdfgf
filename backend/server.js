const http = require("http");
const https = require("https");
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

const DEFAULT_CASES = [
  buildCaseCatalogItem({
    id: "start-ilyushki",
    title: "СТАРТ ИЛЮШКИ",
    subtitle: "Первый разогрев",
    price: 0.1,
    accent: "#86f7c1",
    accentSoft: "#dbffe7",
    badge: "Легкий вход",
    rewards: [
      reward("Почти возврат", 0.08, 220),
      reward("Возврат", 0.1, 170),
      reward("Маленький плюс", 0.15, 110),
      reward("Разгон", 0.25, 55),
      reward("Мини буст", 0.5, 18),
      reward("Микро джек", 1, 5),
      reward("Редкий джек", 2, 1),
    ],
  }),
  buildCaseCatalogItem({
    id: "lyutiy-ilyushki",
    title: "ЛЮТЫЙ ИЛЮШКА",
    subtitle: "Быстрый спин на удачу",
    price: 0.5,
    accent: "#75e5ff",
    accentSoft: "#d8f8ff",
    badge: "Популярный",
    rewards: [
      reward("Тонкий возврат", 0.25, 260),
      reward("Норм возврат", 0.5, 160),
      reward("Хорошо", 0.75, 90),
      reward("Сочный плюс", 1.5, 40),
      reward("Плотно", 3, 12),
      reward("Жир", 5, 4),
      reward("Легенда", 10, 1),
    ],
  }),
  buildCaseCatalogItem({
    id: "gipokrad-ilyushki",
    title: "ГИПОКРАД ИЛЮШКИ",
    subtitle: "Крадет сон и дарит бусты",
    price: 1,
    accent: "#ffb45c",
    accentSoft: "#ffe7c6",
    badge: "Огненный",
    rewards: [
      reward("Пол-банки", 0.6, 250),
      reward("Ровно в ноль", 1, 140),
      reward("Чуть сверху", 1.5, 90),
      reward("Серьезный ап", 3, 35),
      reward("Крепко", 7, 10),
      reward("Безумно", 15, 3),
      reward("Культовый занос", 25, 1),
    ],
  }),
  buildCaseCatalogItem({
    id: "almaz-ilyushki",
    title: "АЛМАЗ ИЛЮШКИ",
    subtitle: "Холодный редкий блеск",
    price: 2.5,
    accent: "#8ec5ff",
    accentSoft: "#e3f1ff",
    badge: "Редкий дроп",
    rewards: [
      reward("Почти камбэк", 1.2, 290),
      reward("Камбэк", 2.5, 130),
      reward("Плотный плюс", 4, 65),
      reward("Ледяной буст", 8, 22),
      reward("Алмазный дроп", 15, 8),
      reward("Лютый алмаз", 30, 2),
      reward("Сверхалмаз", 40, 1),
    ],
  }),
  buildCaseCatalogItem({
    id: "bog-ilyushki",
    title: "БОГ ИЛЮШКИ",
    subtitle: "Самый злой кейс на полтос",
    price: 5,
    accent: "#f6d36e",
    accentSoft: "#fff2bd",
    badge: "Флагман",
    rewards: [
      reward("Почти жив", 2, 300),
      reward("Возврат половины", 2.5, 160),
      reward("Нормально", 5, 80),
      reward("Богатый плюс", 10, 26),
      reward("Почти легенда", 20, 8),
      reward("Занос", 35, 2),
      reward("Бог дропа", 50, 1),
    ],
  }),
];

const ROOT_DEFAULTS = {
  appName: process.env.APP_NAME || "Халява от Илюшки",
  port: Number(process.env.PORT || 3000),
  adminPassword: process.env.ADMIN_PASSWORD || "676767win",
  balanceAdminPassword: process.env.BALANCE_ADMIN_PASSWORD || "676767win1",
  adminIds: String(process.env.ADMIN_IDS || "")
    .split(",")
    .map((value) => String(value || "").trim())
    .filter(Boolean),
  webAppUrl: String(process.env.WEBAPP_URL || "").trim(),
  botUsername: String(process.env.BOT_USERNAME || "").trim().replace(/^@/, ""),
  telegramBotToken: String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "").trim(),
  telegramAppShortName: String(process.env.TELEGRAM_APP_SHORT_NAME || "")
    .trim()
    .replace(/^\/+|\/+$/g, ""),
  cryptoPayApiToken: String(process.env.CRYPTO_PAY_API_TOKEN || "").trim(),
  cryptoPayBaseUrl: String(
    process.env.CRYPTO_PAY_BASE_URL ||
      (String(process.env.CRYPTO_PAY_USE_TESTNET || "").trim() === "true"
        ? "https://testnet-pay.crypt.bot/api"
        : "https://pay.crypt.bot/api")
  )
    .trim()
    .replace(/\/+$/, ""),
  cryptoPayAsset: String(process.env.CRYPTO_PAY_ASSET || "USDT").trim().toUpperCase(),
  cryptoPayInvoiceExpiresIn: clampInt(process.env.CRYPTO_PAY_INVOICE_EXPIRES_IN, 60, 2678400, 3600),
  cryptoPayPaidBtnName: String(process.env.CRYPTO_PAY_PAID_BTN_NAME || "callback").trim() || "callback",
  cryptobotUsername: String(process.env.CRYPTOBOT_USERNAME || "CryptoBot").trim().replace(/^@/, ""),
  autoConfirmPayments: String(process.env.AUTO_CONFIRM_PAYMENTS || "").trim() === "true",
  dataFilePath: process.env.DB_PATH ? path.resolve(ROOT, process.env.DB_PATH) : DATA_FILE,
};

const CONFIG = ROOT_DEFAULTS;
const TASK_ADMIN_PASSWORD = "676767";

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
  const balanceAdminSession = getBalanceAdminSession(req);
  const adminViewer = resolveOptionalTelegramUserFromHeader(req);
  const canAccessAdmin = isAllowedAdmin(adminViewer);

  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      config: {
        appName: CONFIG.appName,
        hasTelegramLink: Boolean(buildShareLink({ slug: "preview" })),
        hasTelegramAuth: Boolean(CONFIG.telegramBotToken),
        payoutAsset: CONFIG.cryptoPayAsset,
        cryptoPayEnabled: Boolean(CONFIG.cryptoPayApiToken),
        withdrawalAutoMode: Boolean(state.withdrawalSettings.autoMode),
        cases: state.caseCatalog.map(serializeCase),
      },
      admin: {
        authorized: Boolean(adminSession),
        canAccess: canAccessAdmin,
        balanceAuthorized: Boolean(balanceAdminSession),
      },
      now: new Date().toISOString(),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/login") {
    if (!canAccessAdmin) {
      sendJson(res, 403, { error: "admin_forbidden" });
      return;
    }

    if (String(body.password || "") !== CONFIG.adminPassword) {
      sendJson(res, 401, { error: "invalid_password" });
      return;
    }

    const token = crypto.randomUUID();
    state.adminSessions = state.adminSessions.filter((item) => item.expiresAt > Date.now());
    state.adminSessions.push({
      token,
      telegramId: String(adminViewer?.id || "").trim(),
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
    }
    if (balanceAdminSession) {
      state.balanceAdminSessions = state.balanceAdminSessions.filter(
        (item) => item.token !== balanceAdminSession.token
      );
    }
    const taskAdminSession = getTaskAdminSession(req);
    if (taskAdminSession) {
      state.taskAdminSessions = state.taskAdminSessions.filter((item) => item.token !== taskAdminSession.token);
    }
    persistState();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/balance/login") {
    assertAdmin(adminSession);
    if (String(body.password || "") !== CONFIG.balanceAdminPassword) {
      sendJson(res, 401, { error: "balance_invalid_password" });
      return;
    }

    const token = crypto.randomUUID();
    state.balanceAdminSessions = state.balanceAdminSessions.filter((item) => item.expiresAt > Date.now());
    state.balanceAdminSessions.push({
      token,
      adminToken: String(adminSession.token || ""),
      telegramId: String(adminSession.telegramId || ""),
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 12,
    });
    persistState();
    sendJson(res, 200, { token });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/balance/adjust") {
    assertAdmin(adminSession);
    assertBalanceAdmin(balanceAdminSession);
    const result = adjustPlayerBalance(body, adminSession);
    persistState();
    sendJson(res, 200, result);
    return;
  }

  if (method === "GET" && pathname === "/api/admin/dashboard") {
    assertAdmin(adminSession);
    sendJson(res, 200, getAdminDashboardPayload());
    return;
  }

  if (method === "POST" && pathname === "/api/admin/tasks/login") {
    assertAdmin(adminSession);
    if (String(body.password || "") !== TASK_ADMIN_PASSWORD) {
      sendJson(res, 401, { error: "invalid_password" });
      return;
    }
    const token = crypto.randomUUID();
    state.taskAdminSessions = state.taskAdminSessions.filter((item) => item.expiresAt > Date.now());
    state.taskAdminSessions.push({
      token,
      adminToken: String(adminSession.token || ""),
      telegramId: String(adminSession.telegramId || ""),
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 12,
    });
    persistState();
    sendJson(res, 200, { token });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/tasks") {
    assertAdmin(adminSession);
    assertTaskAdmin(getTaskAdminSession(req));
    const task = createTask(body, adminSession);
    state.tasks.unshift(task);
    persistState();
    sendJson(res, 201, { task: serializeTask(task) });
    return;
  }

  const toggleTaskMatch = pathname.match(/^\/api\/admin\/tasks\/([^/]+)\/toggle$/);
  if (method === "POST" && toggleTaskMatch) {
    assertAdmin(adminSession);
    assertTaskAdmin(getTaskAdminSession(req));
    const task = state.tasks.find((item) => item.id === toggleTaskMatch[1]);
    if (!task) {
      sendJson(res, 404, { error: "task_not_found" });
      return;
    }
    task.status = task.status === "active" ? "paused" : "active";
    task.updatedAt = new Date().toISOString();
    persistState();
    sendJson(res, 200, { task: serializeTask(task) });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/withdrawals/settings") {
    assertAdmin(adminSession);
    assertBalanceAdmin(balanceAdminSession);
    state.withdrawalSettings.autoMode = Boolean(body.autoMode);
    persistState();
    sendJson(res, 200, {
      ok: true,
      settings: serializeWithdrawalSettings(),
    });
    return;
  }

  const approveWithdrawalMatch = pathname.match(/^\/api\/admin\/withdrawals\/([^/]+)\/approve$/);
  if (method === "POST" && approveWithdrawalMatch) {
    assertAdmin(adminSession);
    assertBalanceAdmin(balanceAdminSession);
    const result = await approveWithdrawalRequest(approveWithdrawalMatch[1], adminSession);
    persistState();
    sendJson(res, 200, result);
    return;
  }

  const rejectWithdrawalMatch = pathname.match(/^\/api\/admin\/withdrawals\/([^/]+)\/reject$/);
  if (method === "POST" && rejectWithdrawalMatch) {
    assertAdmin(adminSession);
    assertBalanceAdmin(balanceAdminSession);
    const result = rejectWithdrawalRequest(rejectWithdrawalMatch[1], body, adminSession);
    persistState();
    sendJson(res, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/admin/raffles") {
    assertAdmin(adminSession);
    const draft = await createPendingRaffleDraft(body, adminSession);
    state.pendingRafflePayments.push(draft);
    persistState();
    sendJson(res, 201, {
      raffle: serializePendingRaffleDraft(draft),
      payment: serializePayment(draft.payment),
      shareLink: "",
    });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/lucky-drops") {
    assertAdmin(adminSession);
    const draft = await createPendingLuckyDropDraft(body, adminSession);
    state.pendingLuckyDropPayments.push(draft);
    persistState();
    sendJson(res, 201, {
      game: serializePendingLuckyDropDraft(draft),
      payment: serializePayment(draft.payment),
    });
    return;
  }

  const verifyLuckyDropPaymentMatch = pathname.match(/^\/api\/admin\/lucky-drops\/([^/]+)\/verify-payment$/);
  if (method === "POST" && verifyLuckyDropPaymentMatch) {
    assertAdmin(adminSession);
    const draft = state.pendingLuckyDropPayments.find((item) => item.id === verifyLuckyDropPaymentMatch[1]);
    if (!draft) {
      sendJson(res, 404, { error: "lucky_drop_not_found" });
      return;
    }

    await verifyPaymentObject(draft.payment);
    let game = null;
    if (draft.payment.status === "paid") {
      game = activatePendingLuckyDropDraft(draft);
      state.luckyDrops.push(game);
      state.pendingLuckyDropPayments = state.pendingLuckyDropPayments.filter((item) => item.id !== draft.id);
    }
    persistState();
    sendJson(res, 200, {
      game: game ? serializeLuckyDrop(game) : serializePendingLuckyDropDraft(draft),
      payment: serializePayment((game || draft).payment),
    });
    return;
  }

  const verifyRafflePaymentMatch = pathname.match(/^\/api\/admin\/raffles\/([^/]+)\/verify-payment$/);
  if (method === "POST" && verifyRafflePaymentMatch) {
    assertAdmin(adminSession);
    const draft = state.pendingRafflePayments.find((item) => item.id === verifyRafflePaymentMatch[1]);
    if (!draft) {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }

    await verifyPaymentObject(draft.payment);
    let raffle = null;
    if (draft.payment.status === "paid") {
      raffle = activatePendingRaffleDraft(draft);
      state.raffles.push(raffle);
      state.pendingRafflePayments = state.pendingRafflePayments.filter((item) => item.id !== draft.id);
    }
    persistState();
    sendJson(res, 200, {
      raffle: raffle ? serializeRaffle(raffle, { admin: true }) : serializePendingRaffleDraft(draft),
      payment: serializePayment((raffle || draft).payment),
      shareLink: raffle ? raffle.shareLink : "",
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
    sendJson(res, 200, { raffle: serializeRaffle(raffle, { admin: true }) });
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

  if (method === "GET" && pathname === "/api/lucky-drops/active") {
    const activeGame = state.luckyDrops
      .filter((item) => item.status === "active")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const viewer = resolveOptionalTelegramUserFromHeader(req);
    const player = viewer ? getOrCreatePlayer(viewer) : null;
    if (viewer) {
      persistState();
    }
    sendJson(res, 200, {
      game: activeGame ? serializeLuckyDrop(activeGame, player) : null,
    });
    return;
  }

  const playLuckyDropMatch = pathname.match(/^\/api\/lucky-drops\/([^/]+)\/play$/);
  if (method === "POST" && playLuckyDropMatch) {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    const game = state.luckyDrops.find((item) => item.id === playLuckyDropMatch[1]);
    if (!game) {
      sendJson(res, 404, { error: "lucky_drop_not_found" });
      return;
    }
    const result = playLuckyDrop(game, player);
    persistState();
    sendJson(res, 200, {
      game: serializeLuckyDrop(game, player),
      profile: serializeProfile(player),
      result,
    });
    return;
  }

  const publicRaffleMatch = pathname.match(/^\/api\/raffles\/slug\/([^/]+)$/);
  if (method === "GET" && publicRaffleMatch) {
    const raffle = state.raffles.find((item) => item.slug === publicRaffleMatch[1]);
    if (!raffle) {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }
    sendJson(res, 200, { raffle: serializeRaffle(raffle) });
    return;
  }

  const joinRaffleMatch = pathname.match(/^\/api\/raffles\/slug\/([^/]+)\/join$/);
  if (method === "POST" && joinRaffleMatch) {
    const raffle = state.raffles.find((item) => item.slug === joinRaffleMatch[1]);
    if (!raffle) {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }
    const viewer = resolveTelegramViewer(req, body);
    const participant = joinRaffle(raffle, viewer);
    persistState();
    sendJson(res, 201, {
      raffle: serializeRaffle(raffle),
      participant,
    });
    return;
  }

  if (method === "GET" && pathname === "/api/cases") {
    sendJson(res, 200, {
      cases: state.caseCatalog.map(serializeCase),
      recentCaseOpens: getAdminCaseHistory().slice(0, 24),
    });
    return;
  }

  const openCaseMatch = pathname.match(/^\/api\/cases\/([^/]+)\/open$/);
  if (method === "POST" && openCaseMatch) {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    const result = openCase(openCaseMatch[1], player);
    persistState();
    sendJson(res, 200, {
      profile: serializeProfile(player),
      result,
    });
    return;
  }

  if (method === "GET" && pathname === "/api/profile") {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    persistState();
    sendJson(res, 200, {
      profile: serializeProfile(player),
    });
    return;
  }

  if (method === "GET" && pathname === "/api/tasks") {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    persistState();
    sendJson(res, 200, {
      tasks: state.tasks
        .filter((item) => item.status === "active")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((item) => serializeTask(item, player)),
    });
    return;
  }

  const completeTaskMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/complete$/);
  if (method === "POST" && completeTaskMatch) {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    const result = completeTask(completeTaskMatch[1], player);
    persistState();
    sendJson(res, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/profile/deposit") {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    const deposit = await createDepositRequest(player, viewer, body);
    persistState();
    sendJson(res, 201, {
      profile: serializeProfile(player),
      deposit,
    });
    return;
  }

  const verifyDepositMatch = pathname.match(/^\/api\/profile\/deposit\/([^/]+)\/verify$/);
  if (method === "POST" && verifyDepositMatch) {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    const deposit = await verifyDepositRequest(player, verifyDepositMatch[1]);
    persistState();
    sendJson(res, 200, {
      profile: serializeProfile(player),
      deposit,
    });
    return;
  }

  if (method === "POST" && pathname === "/api/profile/withdraw") {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    const withdrawal = await requestWithdrawal(player, viewer, body);
    persistState();
    sendJson(res, 201, {
      profile: serializeProfile(player),
      withdrawal,
    });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

function reward(label, amount, weight) {
  return { label, amount: roundMoney(amount), weight };
}

function buildCaseCatalogItem(caseConfig) {
  return {
    id: caseConfig.id,
    title: caseConfig.title,
    subtitle: caseConfig.subtitle,
    price: roundMoney(caseConfig.price),
    accent: caseConfig.accent,
    accentSoft: caseConfig.accentSoft,
    badge: caseConfig.badge,
    rewards: caseConfig.rewards.map((item) => ({
      label: item.label,
      amount: roundMoney(item.amount),
      weight: clampInt(item.weight, 1, 100000, 1),
    })),
  };
}

function getAdminDashboardPayload() {
  return {
    raffles: state.pendingRafflePayments
      .map((draft) => serializePendingRaffleDraft(draft))
      .concat(state.raffles.map((raffle) => serializeRaffle(raffle, { admin: true })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    luckyDrops: state.pendingLuckyDropPayments
      .map((draft) => serializePendingLuckyDropDraft(draft))
      .concat(state.luckyDrops.map((game) => serializeLuckyDrop(game)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    cases: state.caseCatalog.map(serializeCase),
    caseHistory: getAdminCaseHistory(),
    playerOperations: getAdminPlayerOperations(),
    withdrawals: getAdminWithdrawals(),
    tasks: state.tasks.map((task) => serializeTask(task)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    settings: serializeWithdrawalSettings(),
  };
}

function createTask(body, adminSession) {
  const title = String(body.title || "").trim() || "Новое задание";
  const taskType = String(body.taskType || "subscribe").trim();
  const rewardAmount = clampNumber(body.rewardAmount, 0.01, 25000, NaN);
  const link = String(body.link || "").trim();
  const channelName = String(body.channelName || "").trim();
  const reactionCode = String(body.reactionCode || "").trim();

  if (!Number.isFinite(rewardAmount)) {
    raise(400, "task_reward_required");
  }

  return {
    id: crypto.randomUUID(),
    title,
    taskType: taskType === "reaction" ? "reaction" : "subscribe",
    rewardAmount: roundMoney(rewardAmount),
    rewardAsset: CONFIG.cryptoPayAsset,
    link,
    channelName,
    reactionCode,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByTelegramId: String(adminSession.telegramId || ""),
    completedByTelegramIds: [],
  };
}

function serializeWithdrawalSettings() {
  return {
    autoMode: Boolean(state.withdrawalSettings.autoMode),
  };
}

async function createPendingLuckyDropDraft(body, adminSession) {
  const title = String(body.title || "").trim() || "Lucky Drop";
  const prizePool = clampNumber(body.prizePool, 0.1, 25000, NaN);
  const dropCount = clampInt(body.dropCount, 1, 200, 12);

  if (!Number.isFinite(prizePool)) {
    raise(400, "prize_amount_required");
  }

  return {
    id: crypto.randomUUID(),
    title,
    prizePool: roundMoney(prizePool),
    prizeAsset: CONFIG.cryptoPayAsset,
    dropCount,
    createdAt: new Date().toISOString(),
    createdByTelegramId: String(adminSession.telegramId || ""),
    payment: await createInvoicePayment({
      key: `lucky_drop_draft_${Date.now()}`,
      amount: prizePool,
      description: `${title} • lucky drop`.slice(0, 1024),
      payload: { type: "lucky_drop_draft" },
    }),
  };
}

function activatePendingLuckyDropDraft(draft) {
  return {
    id: crypto.randomUUID(),
    title: draft.title,
    prizePool: roundMoney(draft.prizePool),
    prizeAsset: draft.prizeAsset || CONFIG.cryptoPayAsset,
    totalDrops: draft.dropCount,
    remainingDrops: draft.dropCount,
    remainingPool: roundMoney(draft.prizePool),
    createdAt: draft.createdAt,
    activatedAt: new Date().toISOString(),
    status: "active",
    plays: [],
    createdByTelegramId: String(draft.createdByTelegramId || ""),
    payment: {
      ...draft.payment,
      status: "paid",
      paidAt: draft.payment.paidAt || new Date().toISOString(),
    },
  };
}

async function createPendingRaffleDraft(body, adminSession) {
  const title = String(body.title || "").trim() || "Новый розыгрыш";
  const prizeText = String(body.prizeText || "").trim() || "Денежный розыгрыш";
  const winnersCount = clampInt(body.winnersCount, 1, 20, 1);
  const timerMinutes = clampInt(body.timerMinutes, 1, 60 * 24 * 30, 60);
  const prizeAmount = clampNumber(body.prizeAmount, 0.1, 25000, NaN);

  if (!Number.isFinite(prizeAmount)) {
    raise(400, "prize_amount_required");
  }

  if (Math.round(roundMoney(prizeAmount) * 100) < winnersCount) {
    raise(400, "prize_amount_too_small");
  }

  return {
    id: crypto.randomUUID(),
    slug: "",
    title,
    prizeText,
    prizeAmount: roundMoney(prizeAmount),
    prizeAsset: CONFIG.cryptoPayAsset,
    winnersCount,
    timerMinutes,
    createdAt: new Date().toISOString(),
    createdByTelegramId: String(adminSession.telegramId || ""),
    payment: await createInvoicePayment({
      key: `raffle_draft_${Date.now()}`,
      amount: prizeAmount,
      description: `${title} • ${prizeText}`.slice(0, 1024),
      payload: { type: "raffle_draft" },
    }),
  };
}

function activatePendingRaffleDraft(draft) {
  const slug = randomSlug();
  return {
    id: crypto.randomUUID(),
    slug,
    title: draft.title,
    prizeText: draft.prizeText,
    prizeAmount: roundMoney(draft.prizeAmount),
    prizeAsset: draft.prizeAsset || CONFIG.cryptoPayAsset,
    winnersCount: draft.winnersCount,
    timerMinutes: draft.timerMinutes,
    createdAt: draft.createdAt,
    activatedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + draft.timerMinutes * 60 * 1000).toISOString(),
    status: "active",
    shareLink: buildShareLink({ slug }),
    participants: [],
    winners: [],
    resultText: "",
    payoutDistributedAt: "",
    createdByTelegramId: String(draft.createdByTelegramId || ""),
    payment: {
      ...draft.payment,
      status: "paid",
      paidAt: draft.payment.paidAt || new Date().toISOString(),
    },
  };
}

function joinRaffle(raffle, viewer) {
  if (raffle.status !== "active") {
    raise(409, "raffle_closed");
  }

  const player = getOrCreatePlayer(viewer);
  const existing = raffle.participants.find((item) => item.telegramId === player.telegramId);
  if (existing) {
    return serializeParticipant(existing, raffle);
  }

  const participant = {
    id: crypto.randomUUID(),
    telegramId: player.telegramId,
    username: player.username,
    displayName: player.displayName,
    photoUrl: player.photoUrl,
    joinedAt: new Date().toISOString(),
  };
  raffle.participants.push(participant);
  return serializeParticipant(participant, raffle);
}

function finalizeRaffle(raffle) {
  if (raffle.status === "completed") {
    return raffle;
  }
  if (raffle.status !== "active") {
    raise(409, "raffle_not_active");
  }

  raffle.status = "completed";
  const pool = raffle.participants.slice();
  const winners = [];
  const payableWinnerLimit = Math.max(1, Math.round(roundMoney(raffle.prizeAmount) * 100));
  const winnerCount = Math.min(raffle.winnersCount, pool.length, payableWinnerLimit);
  const shares = splitAmount(raffle.prizeAmount, winnerCount);

  for (let index = 0; index < winnerCount; index += 1) {
    const selectedIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool.splice(selectedIndex, 1)[0];
    const creditedAmount = shares[index] || 0;
    winners.push({
      place: index + 1,
      participantId: chosen.id,
      telegramId: chosen.telegramId,
      username: chosen.username,
      displayName: chosen.displayName,
      photoUrl: chosen.photoUrl,
      prizeAmount: creditedAmount,
      prizeAsset: raffle.prizeAsset,
    });
    creditPlayerBalance(chosen, creditedAmount, {
      type: "raffle_win",
      title: raffle.title,
      id: raffle.id,
      asset: raffle.prizeAsset,
    });
  }

  raffle.winners = winners;
  raffle.resultText = winners.length
    ? winners
        .map(
          (winner) =>
            `Победитель ${winner.place}: ${winner.username ? `@${winner.username}` : winner.displayName} • ${formatMoney(
              winner.prizeAmount
            )} ${raffle.prizeAsset}`
        )
        .join(" | ")
    : "Победителей нет";
  raffle.payoutDistributedAt = new Date().toISOString();
  return raffle;
}

function completeTask(taskId, player) {
  const task = state.tasks.find((item) => item.id === taskId && item.status === "active");
  if (!task) {
    raise(404, "task_not_found");
  }
  if (task.completedByTelegramIds.includes(player.telegramId)) {
    raise(409, "task_already_completed");
  }

  task.completedByTelegramIds.push(player.telegramId);
  task.updatedAt = new Date().toISOString();
  player.balance = roundMoney(player.balance + task.rewardAmount);
  player.updatedAt = new Date().toISOString();
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "task_reward",
    amount: task.rewardAmount,
    asset: task.rewardAsset,
    note: task.title,
    createdAt: task.updatedAt,
  });
  player.transactions = player.transactions.slice(0, 60);

  return {
    profile: serializeProfile(player),
    task: serializeTask(task, player),
  };
}

function playLuckyDrop(game, player) {
  if (game.status !== "active") {
    raise(409, "lucky_drop_inactive");
  }
  if (game.plays.some((item) => item.telegramId === player.telegramId)) {
    raise(409, "lucky_drop_already_played");
  }
  if (game.remainingDrops <= 0) {
    game.status = "completed";
    raise(409, "lucky_drop_inactive");
  }

  const reward = getLuckyDropReward(game);
  const playedAt = new Date().toISOString();
  const play = {
    id: crypto.randomUUID(),
    telegramId: player.telegramId,
    username: player.username,
    displayName: player.displayName,
    photoUrl: player.photoUrl,
    rewardAmount: reward.amount,
    resultLabel: reward.label,
    createdAt: playedAt,
  };

  game.plays.unshift(play);
  game.plays = game.plays.slice(0, 80);
  game.remainingDrops = Math.max(0, game.remainingDrops - 1);
  game.remainingPool = roundMoney(Math.max(0, game.remainingPool - reward.amount));
  if (game.remainingDrops === 0 || game.remainingPool <= 0) {
    game.status = "completed";
  }

  if (reward.amount > 0) {
    player.balance = roundMoney(player.balance + reward.amount);
    player.totalWon = roundMoney(player.totalWon + reward.amount);
    player.transactions.unshift({
      id: crypto.randomUUID(),
      type: "lucky_drop_win",
      amount: reward.amount,
      asset: game.prizeAsset,
      note: game.title,
      createdAt: playedAt,
    });
    player.transactions = player.transactions.slice(0, 60);
  }
  player.updatedAt = playedAt;

  return {
    rewardAmount: reward.amount,
    rewardAsset: game.prizeAsset,
    rewardLabel: reward.amount > 0 ? `${formatMoney(reward.amount)} ${game.prizeAsset}` : "0",
    resultLabel: reward.label,
  };
}

function getLuckyDropReward(game) {
  const outcomes = [
    { label: "Пустой слот", multiplier: 0, weight: 42 },
    { label: "Малый дроп", multiplier: 0.5, weight: 28 },
    { label: "Ровный дроп", multiplier: 1, weight: 18 },
    { label: "Жирный дроп", multiplier: 2, weight: 9 },
    { label: "Джекпот", multiplier: 4, weight: 3 },
  ];
  const picked = chooseWeightedReward(outcomes);
  if (!picked.multiplier || game.remainingPool <= 0) {
    return { label: picked.label, amount: 0 };
  }
  const base = Math.max(0.01, roundMoney(game.prizePool / Math.max(1, game.totalDrops)));
  const amount = roundMoney(Math.min(game.remainingPool, Math.max(0.01, base * picked.multiplier)));
  return { label: picked.label, amount };
}

function openCase(caseId, player) {
  const caseItem = state.caseCatalog.find((item) => item.id === caseId);
  if (!caseItem) {
    raise(404, "case_not_found");
  }
  if (player.balance < caseItem.price) {
    raise(409, "insufficient_balance");
  }

  const rewardEntry = chooseWeightedReward(caseItem.rewards);
  const openedAt = new Date().toISOString();
  player.balance = roundMoney(player.balance - caseItem.price + rewardEntry.amount);
  player.totalWon = roundMoney(player.totalWon + rewardEntry.amount);
  player.updatedAt = openedAt;

  const caseOpen = {
    id: crypto.randomUUID(),
    caseId: caseItem.id,
    caseTitle: caseItem.title,
    price: caseItem.price,
    rewardAmount: rewardEntry.amount,
    rewardLabel: rewardEntry.label,
    asset: CONFIG.cryptoPayAsset,
    createdAt: openedAt,
    net: roundMoney(rewardEntry.amount - caseItem.price),
  };

  player.caseHistory.unshift(caseOpen);
  player.caseHistory = player.caseHistory.slice(0, 40);
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "case_open_cost",
    amount: -caseItem.price,
    asset: CONFIG.cryptoPayAsset,
    caseId: caseItem.id,
    caseTitle: caseItem.title,
    createdAt: openedAt,
  });
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "case_win",
    amount: rewardEntry.amount,
    asset: CONFIG.cryptoPayAsset,
    caseId: caseItem.id,
    caseTitle: caseItem.title,
    note: rewardEntry.label,
    createdAt: openedAt,
  });
  player.transactions = player.transactions.slice(0, 60);

  return {
    openedAt,
    case: serializeCase(caseItem),
    reward: {
      label: rewardEntry.label,
      amount: rewardEntry.amount,
      asset: CONFIG.cryptoPayAsset,
      net: roundMoney(rewardEntry.amount - caseItem.price),
    },
    recentRoll: buildCaseRoll(caseItem, rewardEntry),
  };
}

async function createDepositRequest(player, viewer, body) {
  const amount = clampNumber(body.amount, 0.1, 25000, NaN);
  if (!Number.isFinite(amount)) {
    raise(400, "deposit_amount_required");
  }

  const createdAt = new Date().toISOString();
  const deposit = {
    id: crypto.randomUUID(),
    telegramId: player.telegramId,
    username: player.username,
    displayName: player.displayName,
    amount: roundMoney(amount),
    asset: CONFIG.cryptoPayAsset,
    status: "pending",
    createdAt,
    paidAt: "",
    creditedAt: "",
    payment: await createInvoicePayment({
      key: `deposit_${player.telegramId}_${Date.now()}`,
      amount,
      description: `Пополнение баланса @${player.username || player.displayName}`.slice(0, 1024),
      payload: {
        type: "deposit",
        telegramId: player.telegramId,
        username: player.username,
      },
    }),
  };

  state.pendingDepositPayments.push(deposit);
  player.deposits.unshift({
    id: deposit.id,
    amount: deposit.amount,
    asset: deposit.asset,
    status: deposit.status,
    createdAt: deposit.createdAt,
    paidAt: "",
    payment: serializePayment(deposit.payment),
  });
  player.deposits = player.deposits.slice(0, 20);
  player.updatedAt = createdAt;
  return serializeDeposit(deposit);
}

async function verifyDepositRequest(player, depositId) {
  const deposit = state.pendingDepositPayments.find(
    (item) => item.id === depositId && item.telegramId === player.telegramId
  );
  if (!deposit) {
    raise(404, "deposit_not_found");
  }

  await verifyPaymentObject(deposit.payment);
  deposit.status = deposit.payment.status;
  if (deposit.payment.status === "paid" && !deposit.creditedAt) {
    deposit.paidAt = deposit.payment.paidAt || new Date().toISOString();
    deposit.creditedAt = new Date().toISOString();
    player.balance = roundMoney(player.balance + deposit.amount);
    player.updatedAt = deposit.creditedAt;
    player.transactions.unshift({
      id: crypto.randomUUID(),
      type: "deposit_credit",
      amount: deposit.amount,
      asset: CONFIG.cryptoPayAsset,
      note: "Пополнение через CryptoBot",
      createdAt: deposit.creditedAt,
    });
    player.transactions = player.transactions.slice(0, 60);
    syncPlayerDepositRecord(player, deposit);
    state.pendingDepositPayments = state.pendingDepositPayments.filter((item) => item.id !== deposit.id);
  } else {
    syncPlayerDepositRecord(player, deposit);
  }

  return serializeDeposit(deposit);
}

function syncPlayerDepositRecord(player, deposit) {
  const index = player.deposits.findIndex((item) => item.id === deposit.id);
  const record = {
    id: deposit.id,
    amount: deposit.amount,
    asset: deposit.asset,
    status: deposit.status,
    createdAt: deposit.createdAt,
    paidAt: deposit.paidAt || "",
    payment: serializePayment(deposit.payment),
  };
  if (index >= 0) {
    player.deposits[index] = record;
  } else {
    player.deposits.unshift(record);
  }
  player.deposits = player.deposits.slice(0, 20);
}

async function requestWithdrawal(player, viewer, body) {
  const method = String(body.method || "cryptobot").trim().toLowerCase();
  const amount = clampNumber(body.amount, 0.1, 25000, NaN);
  if (!Number.isFinite(amount)) {
    raise(400, "withdraw_amount_required");
  }
  if (method !== "cryptobot") {
    raise(400, "withdraw_method_invalid");
  }

  const roundedAmount = roundMoney(amount);
  if (roundedAmount > player.balance) {
    raise(409, "insufficient_balance");
  }

  if (state.withdrawalSettings.autoMode) {
    try {
      const issued = await issueWithdrawalCheck(player, viewer, roundedAmount);
      return issued;
    } catch (error) {
      console.error("auto withdrawal fallback to manual review", error);
    }
  }

  const createdAt = new Date().toISOString();
  player.balance = roundMoney(player.balance - roundedAmount);
  player.updatedAt = createdAt;
  const withdrawal = {
    id: crypto.randomUUID(),
    telegramId: player.telegramId,
    username: player.username,
    displayName: player.displayName,
    amount: roundedAmount,
    asset: CONFIG.cryptoPayAsset,
    method: "cryptobot",
    status: "pending_review",
    createdAt,
    reviewedAt: "",
    reviewReason: "",
    checkId: "",
    checkUrl: "",
  };
  player.withdrawals.unshift(withdrawal);
  player.withdrawals = player.withdrawals.slice(0, 20);
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "withdrawal_pending",
    amount: -roundedAmount,
    asset: CONFIG.cryptoPayAsset,
    note: "Заявка на ручной вывод",
    createdAt,
  });
  player.transactions = player.transactions.slice(0, 60);
  return serializeWithdrawal(withdrawal);
}

async function issueWithdrawalCheck(player, viewer, amount) {
  let check;
  if (!CONFIG.cryptoPayApiToken) {
    check = {
      check_id: `mock_${crypto.randomUUID()}`,
      bot_check_url: `https://t.me/${CONFIG.cryptobotUsername}`,
    };
  } else {
    check = await cryptoPayRequest("createCheck", {
      asset: CONFIG.cryptoPayAsset,
      amount: formatMoney(amount),
      pin_to_user_id: Number(String(viewer.id || viewer.telegramId || "0")) || undefined,
    });
  }

  const createdAt = new Date().toISOString();
  player.balance = roundMoney(player.balance - amount);
  player.totalWithdrawn = roundMoney(player.totalWithdrawn + amount);
  player.updatedAt = createdAt;
  const withdrawal = {
    id: crypto.randomUUID(),
    telegramId: player.telegramId,
    username: player.username,
    displayName: player.displayName,
    amount,
    asset: CONFIG.cryptoPayAsset,
    method: "cryptobot",
    status: CONFIG.cryptoPayApiToken ? "issued" : "mock_issued",
    createdAt,
    reviewedAt: createdAt,
    reviewReason: "",
    checkId: String(check.check_id || ""),
    checkUrl: String(check.bot_check_url || `https://t.me/${CONFIG.cryptobotUsername}`),
  };
  player.withdrawals.unshift(withdrawal);
  player.withdrawals = player.withdrawals.slice(0, 20);
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "withdrawal",
    amount: -amount,
    asset: CONFIG.cryptoPayAsset,
    createdAt,
  });
  player.transactions = player.transactions.slice(0, 60);
  return serializeWithdrawal(withdrawal);
}

async function approveWithdrawalRequest(withdrawalId, adminSession) {
  const player = state.players.find((item) =>
    item.withdrawals.some((withdrawal) => withdrawal.id === withdrawalId && withdrawal.status === "pending_review")
  );
  if (!player) {
    raise(404, "withdrawal_not_found");
  }

  const withdrawal = player.withdrawals.find((item) => item.id === withdrawalId);
  let check;
  if (!CONFIG.cryptoPayApiToken) {
    check = {
      check_id: `mock_${crypto.randomUUID()}`,
      bot_check_url: `https://t.me/${CONFIG.cryptobotUsername}`,
    };
  } else {
    check = await cryptoPayRequest("createCheck", {
      asset: CONFIG.cryptoPayAsset,
      amount: formatMoney(withdrawal.amount),
      pin_to_user_id: Number(player.telegramId) || undefined,
    });
  }

  withdrawal.status = CONFIG.cryptoPayApiToken ? "issued" : "mock_issued";
  withdrawal.reviewedAt = new Date().toISOString();
  withdrawal.reviewReason = "";
  withdrawal.checkId = String(check.check_id || "");
  withdrawal.checkUrl = String(check.bot_check_url || `https://t.me/${CONFIG.cryptobotUsername}`);
  player.totalWithdrawn = roundMoney(player.totalWithdrawn + withdrawal.amount);
  player.updatedAt = withdrawal.reviewedAt;
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "withdrawal_approved",
    amount: 0,
    asset: CONFIG.cryptoPayAsset,
    note: `Одобрено админом ${String(adminSession.telegramId || "")}`,
    createdAt: withdrawal.reviewedAt,
  });
  player.transactions = player.transactions.slice(0, 60);
  return {
    ok: true,
    withdrawal: serializeWithdrawal(withdrawal),
    profile: serializeProfile(player),
  };
}

function rejectWithdrawalRequest(withdrawalId, body, adminSession) {
  const reason = String(body.reason || "").trim();
  const player = state.players.find((item) =>
    item.withdrawals.some((withdrawal) => withdrawal.id === withdrawalId && withdrawal.status === "pending_review")
  );
  if (!player) {
    raise(404, "withdrawal_not_found");
  }

  const withdrawal = player.withdrawals.find((item) => item.id === withdrawalId);
  withdrawal.status = "rejected";
  withdrawal.reviewReason = reason;
  withdrawal.reviewedAt = new Date().toISOString();
  player.balance = roundMoney(player.balance + withdrawal.amount);
  player.updatedAt = withdrawal.reviewedAt;
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "withdrawal_rejected_refund",
    amount: withdrawal.amount,
    asset: CONFIG.cryptoPayAsset,
    note: reason || `Отклонено админом ${String(adminSession.telegramId || "")}`,
    createdAt: withdrawal.reviewedAt,
  });
  player.transactions = player.transactions.slice(0, 60);
  return {
    ok: true,
    withdrawal: serializeWithdrawal(withdrawal),
    profile: serializeProfile(player),
  };
}

function adjustPlayerBalance(body, adminSession) {
  const username = String(body.username || "").trim().replace(/^@/, "").toLowerCase();
  const operation = String(body.operation || "").trim().toLowerCase();
  const amount = clampNumber(body.amount, 0.1, 25000, NaN);
  const note = String(body.note || "").trim();

  if (!username) {
    raise(400, "username_required");
  }
  if (!Number.isFinite(amount)) {
    raise(400, "amount_required");
  }
  if (operation !== "credit" && operation !== "debit") {
    raise(400, "operation_invalid");
  }

  const player = state.players.find((item) => String(item.username || "").trim().toLowerCase() === username);
  if (!player) {
    raise(404, "player_not_found");
  }

  const roundedAmount = roundMoney(amount);
  if (operation === "debit" && roundedAmount > player.balance) {
    raise(409, "insufficient_balance");
  }

  player.balance = roundMoney(
    operation === "credit" ? player.balance + roundedAmount : player.balance - roundedAmount
  );
  player.updatedAt = new Date().toISOString();
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: operation === "credit" ? "admin_credit" : "admin_debit",
    amount: operation === "credit" ? roundedAmount : -roundedAmount,
    asset: CONFIG.cryptoPayAsset,
    note,
    adminTelegramId: String(adminSession.telegramId || ""),
    createdAt: player.updatedAt,
  });
  player.transactions = player.transactions.slice(0, 60);

  return {
    ok: true,
    message:
      operation === "credit"
        ? `Пользователю @${player.username} выдано ${formatMoney(roundedAmount)} ${CONFIG.cryptoPayAsset}`
        : `У пользователя @${player.username} списано ${formatMoney(roundedAmount)} ${CONFIG.cryptoPayAsset}`,
    profile: serializeProfile(player),
  };
}

function chooseWeightedReward(rewards) {
  const totalWeight = rewards.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const item of rewards) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item;
    }
  }
  return rewards[rewards.length - 1];
}

function buildCaseRoll(caseItem, winner) {
  const tape = [];
  for (let index = 0; index < 16; index += 1) {
    tape.push(caseItem.rewards[index % caseItem.rewards.length]);
  }
  tape.push(winner);
  for (let index = 0; index < 8; index += 1) {
    tape.push(caseItem.rewards[(index + 3) % caseItem.rewards.length]);
  }
  return tape.map((item) => ({
    label: item.label,
    amount: item.amount,
    asset: CONFIG.cryptoPayAsset,
  }));
}

function creditPlayerBalance(playerLike, amount, meta) {
  if (!amount) {
    return;
  }
  const player = getOrCreatePlayerFromParticipant(playerLike);
  const createdAt = new Date().toISOString();
  player.balance = roundMoney(player.balance + amount);
  player.totalWon = roundMoney(player.totalWon + amount);
  player.updatedAt = createdAt;
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: meta.type || "credit",
    amount: roundMoney(amount),
    asset: meta.asset || CONFIG.cryptoPayAsset,
    raffleId: meta.id || "",
    raffleTitle: meta.title || "",
    caseId: meta.caseId || "",
    caseTitle: meta.caseTitle || "",
    createdAt,
  });
  player.transactions = player.transactions.slice(0, 60);
}

function getOrCreatePlayerFromParticipant(participant) {
  const telegramId = String(participant.telegramId || participant.id || "").trim();
  const username = String(participant.username || "").trim();
  const displayName = String(participant.displayName || username || "Игрок").trim();
  const photoUrl = String(participant.photoUrl || participant.photo_url || "").trim();
  if (!telegramId) {
    raise(400, "telegram_required");
  }

  let player = state.players.find((item) => String(item.telegramId || "").trim() === telegramId);
  if (!player && username) {
    player = state.players.find(
      (item) => String(item.username || "").trim().toLowerCase() === username.toLowerCase()
    );
  }

  if (!player) {
    player = normalizePlayer({
      telegramId,
      username,
      displayName,
      photoUrl,
    });
    state.players.push(player);
  } else {
    player.telegramId = telegramId;
    player.username = username || player.username;
    player.displayName = displayName || player.displayName;
    player.photoUrl = photoUrl || player.photoUrl;
  }
  return player;
}

function getOrCreatePlayer(viewer) {
  const telegramId = String(viewer.id || viewer.telegramId || "").trim();
  if (!telegramId) {
    raise(400, "telegram_required");
  }

  let player = state.players.find((item) => item.telegramId === telegramId);
  const username = String(viewer.username || "").trim();
  const displayName = String(
    viewer.displayName ||
      [viewer.first_name, viewer.last_name].filter(Boolean).join(" ").trim() ||
      username ||
      "Игрок"
  ).trim();
  const photoUrl = String(viewer.photo_url || viewer.photoUrl || "").trim();

  if (!player) {
    player = normalizePlayer({
      telegramId,
      username,
      displayName,
      photoUrl,
    });
    state.players.push(player);
  } else {
    player.username = username || player.username;
    player.displayName = displayName || player.displayName;
    player.photoUrl = photoUrl || player.photoUrl;
    player.updatedAt = new Date().toISOString();
  }
  return player;
}

function getAdminPlayerOperations() {
  return state.players
    .flatMap((player) =>
      player.transactions.map((transaction) => ({
        id: transaction.id || crypto.randomUUID(),
        telegramId: player.telegramId,
        username: player.username,
        usernameLabel: player.username ? `@${player.username}` : player.displayName,
        displayName: player.displayName,
        type: transaction.type || "unknown",
        amount: roundMoney(transaction.amount || 0),
        asset: transaction.asset || CONFIG.cryptoPayAsset,
        note: transaction.note || "",
        raffleTitle: transaction.raffleTitle || "",
        caseTitle: transaction.caseTitle || "",
        createdAt: transaction.createdAt || player.updatedAt || player.createdAt || "",
      }))
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 150);
}

function getAdminCaseHistory() {
  return state.players
    .flatMap((player) =>
      player.caseHistory.map((entry) => ({
        ...entry,
        username: player.username,
        usernameLabel: player.username ? `@${player.username}` : player.displayName,
        displayName: player.displayName,
      }))
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 120);
}

function getAdminWithdrawals() {
  return state.players
    .flatMap((player) =>
      player.withdrawals.map((withdrawal) => ({
        ...serializeWithdrawal(withdrawal),
        username: player.username,
        usernameLabel: player.username ? `@${player.username}` : player.displayName,
        displayName: player.displayName,
      }))
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 120);
}

function autoFinalizeDueRaffles() {
  let changed = false;
  for (const raffle of state.raffles) {
    if (raffle.status === "active" && raffle.endsAt && new Date(raffle.endsAt).getTime() <= Date.now()) {
      finalizeRaffle(raffle);
      changed = true;
    }
  }
  if (changed) {
    persistState();
  }
}

async function createInvoicePayment({ key, amount, description, payload }) {
  const now = new Date().toISOString();
  if (!CONFIG.cryptoPayApiToken) {
    return {
      provider: "mock",
      status: "pending",
      amount: roundMoney(amount),
      asset: CONFIG.cryptoPayAsset,
      createdAt: now,
      expiresAt: new Date(Date.now() + CONFIG.cryptoPayInvoiceExpiresIn * 1000).toISOString(),
      botInvoiceUrl: `https://t.me/${CONFIG.cryptobotUsername}`,
      miniAppInvoiceUrl: "",
      webAppInvoiceUrl: "",
      invoiceId: `mock_${key}`,
      paidAt: "",
    };
  }

  const callbackUrl = sanitizeCallbackUrl(CONFIG.webAppUrl) || `https://t.me/${CONFIG.cryptobotUsername}`;
  const invoice = await cryptoPayRequest("createInvoice", {
    asset: CONFIG.cryptoPayAsset,
    amount: formatMoney(amount),
    description,
    payload: JSON.stringify(payload),
    paid_btn_name: CONFIG.cryptoPayPaidBtnName,
    paid_btn_url: callbackUrl,
    allow_comments: false,
    allow_anonymous: false,
    expires_in: CONFIG.cryptoPayInvoiceExpiresIn,
  });

  return {
    provider: "crypto_pay",
    status: String(invoice.status || "pending"),
    amount: roundMoney(amount),
    asset: CONFIG.cryptoPayAsset,
    createdAt: now,
    expiresAt: invoice.expiration_date || "",
    invoiceId: String(invoice.invoice_id || ""),
    botInvoiceUrl: String(invoice.bot_invoice_url || ""),
    miniAppInvoiceUrl: String(invoice.mini_app_invoice_url || ""),
    webAppInvoiceUrl: String(invoice.web_app_invoice_url || ""),
    paidAt: "",
  };
}

async function verifyPaymentObject(payment) {
  if (!payment) {
    raise(409, "payment_missing");
  }

  if (payment.provider === "mock") {
    raise(409, "payment_verification_unavailable");
  }

  const result = await cryptoPayRequest("getInvoices", {
    invoice_ids: String(payment.invoiceId || ""),
  });
  const invoice = Array.isArray(result.items) ? result.items[0] : Array.isArray(result) ? result[0] : null;
  if (!invoice) {
    raise(404, "invoice_not_found");
  }

  payment.status = String(invoice.status || payment.status || "pending");
  payment.botInvoiceUrl = String(invoice.bot_invoice_url || payment.botInvoiceUrl || "");
  payment.miniAppInvoiceUrl = String(invoice.mini_app_invoice_url || payment.miniAppInvoiceUrl || "");
  payment.webAppInvoiceUrl = String(invoice.web_app_invoice_url || payment.webAppInvoiceUrl || "");
  payment.expiresAt = String(invoice.expiration_date || payment.expiresAt || "");

  if (invoice.status === "paid") {
    payment.paidAt = payment.paidAt || new Date().toISOString();
    return payment;
  }
  if (invoice.status === "expired") {
    raise(409, "invoice_expired");
  }
  raise(409, "invoice_not_paid");
}

function serializeCase(caseItem) {
  return {
    id: caseItem.id,
    title: caseItem.title,
    subtitle: caseItem.subtitle,
    price: caseItem.price,
    asset: CONFIG.cryptoPayAsset,
    accent: caseItem.accent,
    accentSoft: caseItem.accentSoft,
    badge: caseItem.badge,
    topReward: Math.max(...caseItem.rewards.map((item) => item.amount)),
    rewards: caseItem.rewards.map((item) => ({
      label: item.label,
      amount: item.amount,
      asset: CONFIG.cryptoPayAsset,
      rarity: classifyRewardRarity(caseItem, item),
    })),
  };
}

function classifyRewardRarity(caseItem, rewardItem) {
  const weights = caseItem.rewards.map((item) => item.weight);
  const minWeight = Math.min(...weights);
  if (rewardItem.weight === minWeight) {
    return "legendary";
  }
  if (rewardItem.amount >= caseItem.price * 4) {
    return "epic";
  }
  if (rewardItem.amount > caseItem.price) {
    return "rare";
  }
  return "common";
}

function serializeRaffle(raffle, options = {}) {
  const participantCount = raffle.participants.length;
  const chancePercent = participantCount
    ? Number(((Math.min(raffle.winnersCount, participantCount) / participantCount) * 100).toFixed(2))
    : 0;

  return {
    id: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    prizeText: raffle.prizeText,
    prizeAmount: roundMoney(raffle.prizeAmount || 0),
    prizeAsset: raffle.prizeAsset || CONFIG.cryptoPayAsset,
    winnersCount: raffle.winnersCount,
    timerMinutes: raffle.timerMinutes,
    createdAt: raffle.createdAt,
    activatedAt: raffle.activatedAt || "",
    endsAt: raffle.endsAt || "",
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
    payment: options.admin ? serializePayment(raffle.payment) : undefined,
  };
}

function serializeLuckyDrop(game, player) {
  const telegramId = String(player?.telegramId || "").trim();
  const hasPlayed = telegramId ? game.plays.some((item) => item.telegramId === telegramId) : false;
  return {
    id: game.id,
    title: game.title,
    prizePool: roundMoney(game.prizePool || 0),
    prizeAsset: game.prizeAsset || CONFIG.cryptoPayAsset,
    totalDrops: clampInt(game.totalDrops, 1, 200, 1),
    remainingDrops: clampInt(game.remainingDrops, 0, 200, 0),
    remainingPool: roundMoney(game.remainingPool || 0),
    createdAt: game.createdAt || "",
    activatedAt: game.activatedAt || "",
    status: game.status || "active",
    hasPlayed,
    plays: Array.isArray(game.plays)
      ? game.plays.slice(0, 8).map((item) => ({
          telegramId: item.telegramId,
          username: item.username,
          displayName: item.displayName,
          photoUrl: item.photoUrl,
          usernameLabel: item.username ? `@${item.username}` : item.displayName,
          rewardAmount: roundMoney(item.rewardAmount || 0),
          resultLabel: item.resultLabel || "",
          createdAt: item.createdAt || "",
        }))
      : [],
    payment: game.payment ? serializePayment(game.payment) : undefined,
  };
}

function serializePendingRaffleDraft(draft) {
  return {
    id: draft.id,
    slug: "",
    title: draft.title,
    prizeText: draft.prizeText,
    prizeAmount: draft.prizeAmount,
    prizeAsset: draft.prizeAsset,
    winnersCount: draft.winnersCount,
    timerMinutes: draft.timerMinutes,
    createdAt: draft.createdAt,
    activatedAt: "",
    endsAt: "",
    status: "pending_payment",
    shareLink: "",
    participantCount: 0,
    chancePercent: 0,
    participants: [],
    winners: [],
    resultText: "",
    payment: serializePayment(draft.payment),
  };
}

function serializePendingLuckyDropDraft(draft) {
  return {
    id: draft.id,
    title: draft.title,
    prizePool: roundMoney(draft.prizePool || 0),
    prizeAsset: draft.prizeAsset || CONFIG.cryptoPayAsset,
    totalDrops: clampInt(draft.dropCount, 1, 200, 1),
    remainingDrops: clampInt(draft.dropCount, 1, 200, 1),
    remainingPool: roundMoney(draft.prizePool || 0),
    createdAt: draft.createdAt || "",
    activatedAt: "",
    status: "pending_payment",
    hasPlayed: false,
    plays: [],
    payment: serializePayment(draft.payment),
  };
}

function serializeParticipant(participant, raffle) {
  const participantCount = Math.max(1, raffle.participants.length);
  return {
    ...participant,
    usernameLabel: participant.username ? `@${participant.username}` : participant.displayName,
    chancePercent: Number(
      ((Math.min(raffle.winnersCount, participantCount) / participantCount) * 100).toFixed(2)
    ),
  };
}

function serializePayment(payment) {
  if (!payment) {
    return null;
  }
  return {
    provider: payment.provider || "mock",
    status: payment.status || "pending",
    amount: roundMoney(payment.amount || 0),
    asset: payment.asset || CONFIG.cryptoPayAsset,
    invoiceId: payment.invoiceId || "",
    botInvoiceUrl: payment.botInvoiceUrl || "",
    miniAppInvoiceUrl: payment.miniAppInvoiceUrl || "",
    webAppInvoiceUrl: payment.webAppInvoiceUrl || "",
    createdAt: payment.createdAt || "",
    expiresAt: payment.expiresAt || "",
    paidAt: payment.paidAt || "",
    isMock: payment.provider === "mock",
  };
}

function serializeDeposit(deposit) {
  return {
    id: deposit.id,
    amount: roundMoney(deposit.amount || 0),
    asset: deposit.asset || CONFIG.cryptoPayAsset,
    status: deposit.status || "pending",
    createdAt: deposit.createdAt || "",
    paidAt: deposit.paidAt || "",
    creditedAt: deposit.creditedAt || "",
    payment: serializePayment(deposit.payment),
  };
}

function serializeWithdrawal(withdrawal) {
  return {
    id: withdrawal.id,
    amount: roundMoney(withdrawal.amount || 0),
    amountLabel: `${formatMoney(withdrawal.amount || 0)} ${withdrawal.asset || CONFIG.cryptoPayAsset}`,
    asset: withdrawal.asset || CONFIG.cryptoPayAsset,
    method: withdrawal.method || "cryptobot",
    status: withdrawal.status || "created",
    createdAt: withdrawal.createdAt || "",
    reviewedAt: withdrawal.reviewedAt || "",
    reviewReason: withdrawal.reviewReason || "",
    checkId: withdrawal.checkId || "",
    checkUrl: withdrawal.checkUrl || "",
    providerLabel: "CryptoBot",
  };
}

function serializeProfile(player) {
  return {
    telegramId: player.telegramId,
    username: player.username,
    usernameLabel: player.username ? `@${player.username}` : player.displayName,
    displayName: player.displayName,
    photoUrl: player.photoUrl,
    balance: roundMoney(player.balance),
    balanceLabel: `${formatMoney(player.balance)} ${CONFIG.cryptoPayAsset}`,
    payoutAsset: CONFIG.cryptoPayAsset,
    totalWon: roundMoney(player.totalWon),
    totalWithdrawn: roundMoney(player.totalWithdrawn),
    recentTransactions: player.transactions.slice(0, 10),
    recentWithdrawals: player.withdrawals.slice(0, 10).map(serializeWithdrawal),
    recentCaseOpens: player.caseHistory.slice(0, 10),
    recentDeposits: player.deposits.slice(0, 10),
  };
}

function serializeTask(task, player) {
  const telegramId = String(player?.telegramId || "").trim();
  const completed = telegramId ? task.completedByTelegramIds.includes(telegramId) : false;
  return {
    id: task.id,
    title: task.title,
    taskType: task.taskType || "subscribe",
    rewardAmount: roundMoney(task.rewardAmount || 0),
    rewardAsset: task.rewardAsset || CONFIG.cryptoPayAsset,
    rewardLabel: `${formatMoney(task.rewardAmount || 0)} ${task.rewardAsset || CONFIG.cryptoPayAsset}`,
    link: task.link || "",
    channelName: task.channelName || "",
    reactionCode: task.reactionCode || "",
    status: task.status || "active",
    createdAt: task.createdAt || "",
    completed,
    completedCount: Array.isArray(task.completedByTelegramIds) ? task.completedByTelegramIds.length : 0,
  };
}

function splitAmount(total, count) {
  if (!count) {
    return [];
  }
  const cents = Math.round(roundMoney(total) * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  const result = [];
  for (let index = 0; index < count; index += 1) {
    result.push((base + (index < remainder ? 1 : 0)) / 100);
  }
  return result;
}

function buildShareLink({ slug }) {
  if (CONFIG.botUsername && CONFIG.botUsername !== "your_bot") {
    return `https://t.me/${CONFIG.botUsername}?startapp=${encodeURIComponent(`raffle_${slug}`)}`;
  }
  if (CONFIG.webAppUrl && !CONFIG.webAppUrl.includes("your-domain")) {
    const separator = CONFIG.webAppUrl.includes("?") ? "&" : "?";
    return `${CONFIG.webAppUrl}${separator}raffle=${encodeURIComponent(slug)}`;
  }
  return `/?raffle=${encodeURIComponent(slug)}`;
}

function getAdminSession(req) {
  const token = String(req.headers["x-admin-token"] || "").trim();
  return token
    ? state.adminSessions.find((item) => item.token === token && item.expiresAt > Date.now()) || null
    : null;
}

function getBalanceAdminSession(req) {
  const token = String(req.headers["x-balance-admin-token"] || "").trim();
  return token
    ? state.balanceAdminSessions.find((item) => item.token === token && item.expiresAt > Date.now()) || null
    : null;
}

function getTaskAdminSession(req) {
  const token = String(req.headers["x-task-admin-token"] || "").trim();
  return token
    ? state.taskAdminSessions.find((item) => item.token === token && item.expiresAt > Date.now()) || null
    : null;
}

function assertAdmin(session) {
  if (!session) {
    raise(401, "admin_required");
  }
}

function assertBalanceAdmin(session) {
  if (!session) {
    raise(401, "balance_admin_required");
  }
}

function assertTaskAdmin(session) {
  if (!session) {
    raise(401, "task_admin_required");
  }
}

function ensureDataFile() {
  fs.mkdirSync(path.dirname(CONFIG.dataFilePath), { recursive: true });
  if (!fs.existsSync(CONFIG.dataFilePath)) {
    fs.writeFileSync(
      CONFIG.dataFilePath,
      JSON.stringify(
        {
          raffles: [],
          pendingRafflePayments: [],
          luckyDrops: [],
          pendingLuckyDropPayments: [],
          pendingDepositPayments: [],
          adminSessions: [],
          balanceAdminSessions: [],
          taskAdminSessions: [],
          players: [],
          caseCatalog: DEFAULT_CASES,
          tasks: [],
          withdrawalSettings: { autoMode: true },
        },
        null,
        2
      )
    );
  }
}

function loadState() {
  try {
    return normalizeState(JSON.parse(fs.readFileSync(CONFIG.dataFilePath, "utf8")));
  } catch (error) {
    return normalizeState({});
  }
}

function normalizeState(parsed) {
  return {
    raffles: Array.isArray(parsed.raffles) ? parsed.raffles.map(normalizeRaffle) : [],
    pendingRafflePayments: Array.isArray(parsed.pendingRafflePayments)
      ? parsed.pendingRafflePayments.map(normalizePendingRaffleDraft)
      : [],
    luckyDrops: Array.isArray(parsed.luckyDrops) ? parsed.luckyDrops.map(normalizeLuckyDrop) : [],
    pendingLuckyDropPayments: Array.isArray(parsed.pendingLuckyDropPayments)
      ? parsed.pendingLuckyDropPayments.map(normalizePendingLuckyDropDraft)
      : [],
    pendingDepositPayments: Array.isArray(parsed.pendingDepositPayments)
      ? parsed.pendingDepositPayments.map(normalizePendingDeposit)
      : [],
    adminSessions: Array.isArray(parsed.adminSessions) ? parsed.adminSessions : [],
    balanceAdminSessions: Array.isArray(parsed.balanceAdminSessions) ? parsed.balanceAdminSessions : [],
    taskAdminSessions: Array.isArray(parsed.taskAdminSessions) ? parsed.taskAdminSessions : [],
    players: Array.isArray(parsed.players) ? parsed.players.map(normalizePlayer) : [],
    caseCatalog: Array.isArray(parsed.caseCatalog) && parsed.caseCatalog.length
      ? parsed.caseCatalog.map(buildCaseCatalogItem)
      : DEFAULT_CASES.map(buildCaseCatalogItem),
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask) : [],
    withdrawalSettings: {
      autoMode:
        typeof parsed.withdrawalSettings?.autoMode === "boolean"
          ? parsed.withdrawalSettings.autoMode
          : true,
    },
  };
}

function normalizePendingRaffleDraft(draft) {
  return {
    id: draft.id || crypto.randomUUID(),
    slug: "",
    title: String(draft.title || "").trim() || "Новый розыгрыш",
    prizeText: String(draft.prizeText || "").trim() || "Денежный розыгрыш",
    prizeAmount: roundMoney(draft.prizeAmount || 0),
    prizeAsset: String(draft.prizeAsset || CONFIG.cryptoPayAsset).trim().toUpperCase(),
    winnersCount: clampInt(draft.winnersCount, 1, 20, 1),
    timerMinutes: clampInt(draft.timerMinutes, 1, 60 * 24 * 30, 60),
    createdAt: draft.createdAt || new Date().toISOString(),
    createdByTelegramId: String(draft.createdByTelegramId || ""),
    payment: normalizePayment(draft.payment, draft.prizeAmount),
  };
}

function normalizePendingLuckyDropDraft(draft) {
  return {
    id: draft.id || crypto.randomUUID(),
    title: String(draft.title || "").trim() || "Lucky Drop",
    prizePool: roundMoney(draft.prizePool || 0),
    prizeAsset: String(draft.prizeAsset || CONFIG.cryptoPayAsset).trim().toUpperCase(),
    dropCount: clampInt(draft.dropCount || draft.totalDrops, 1, 200, 12),
    createdAt: draft.createdAt || new Date().toISOString(),
    createdByTelegramId: String(draft.createdByTelegramId || ""),
    payment: normalizePayment(draft.payment, draft.prizePool),
  };
}

function normalizePendingDeposit(deposit) {
  return {
    id: deposit.id || crypto.randomUUID(),
    telegramId: String(deposit.telegramId || "").trim(),
    username: String(deposit.username || "").trim(),
    displayName: String(deposit.displayName || "").trim() || "Игрок",
    amount: roundMoney(deposit.amount || 0),
    asset: String(deposit.asset || CONFIG.cryptoPayAsset).trim().toUpperCase(),
    status: String(deposit.status || "pending"),
    createdAt: deposit.createdAt || new Date().toISOString(),
    paidAt: deposit.paidAt || "",
    creditedAt: deposit.creditedAt || "",
    payment: normalizePayment(deposit.payment, deposit.amount),
  };
}

function normalizeRaffle(raffle) {
  return {
    id: raffle.id || crypto.randomUUID(),
    slug: raffle.slug || randomSlug(),
    title: String(raffle.title || "").trim() || "Новый розыгрыш",
    prizeText: String(raffle.prizeText || "").trim() || "Денежный розыгрыш",
    prizeAmount: roundMoney(raffle.prizeAmount || 0),
    prizeAsset: String(raffle.prizeAsset || CONFIG.cryptoPayAsset).trim().toUpperCase(),
    winnersCount: clampInt(raffle.winnersCount, 1, 20, 1),
    timerMinutes: clampInt(raffle.timerMinutes, 1, 60 * 24 * 30, 60),
    createdAt: raffle.createdAt || new Date().toISOString(),
    activatedAt: raffle.activatedAt || "",
    endsAt: raffle.endsAt || "",
    status: raffle.status || "active",
    shareLink: raffle.shareLink || buildShareLink({ slug: raffle.slug || randomSlug() }),
    participants: Array.isArray(raffle.participants) ? raffle.participants : [],
    winners: Array.isArray(raffle.winners) ? raffle.winners : [],
    resultText: String(raffle.resultText || ""),
    payoutDistributedAt: raffle.payoutDistributedAt || "",
    createdByTelegramId: String(raffle.createdByTelegramId || ""),
    payment: normalizePayment(raffle.payment, raffle.prizeAmount),
  };
}

function normalizeLuckyDrop(game) {
  return {
    id: game.id || crypto.randomUUID(),
    title: String(game.title || "").trim() || "Lucky Drop",
    prizePool: roundMoney(game.prizePool || 0),
    prizeAsset: String(game.prizeAsset || CONFIG.cryptoPayAsset).trim().toUpperCase(),
    totalDrops: clampInt(game.totalDrops, 1, 200, 1),
    remainingDrops: clampInt(game.remainingDrops, 0, 200, 0),
    remainingPool: roundMoney(game.remainingPool || 0),
    createdAt: game.createdAt || new Date().toISOString(),
    activatedAt: game.activatedAt || "",
    status: String(game.status || "active"),
    plays: Array.isArray(game.plays) ? game.plays : [],
    createdByTelegramId: String(game.createdByTelegramId || ""),
    payment: normalizePayment(game.payment, game.prizePool),
  };
}

function normalizePayment(payment, fallbackAmount) {
  return payment
    ? {
        provider: payment.provider || "mock",
        status: payment.status || "pending",
        amount: roundMoney(payment.amount || fallbackAmount || 0),
        asset: payment.asset || CONFIG.cryptoPayAsset,
        invoiceId: payment.invoiceId || "",
        botInvoiceUrl: payment.botInvoiceUrl || "",
        miniAppInvoiceUrl: payment.miniAppInvoiceUrl || "",
        webAppInvoiceUrl: payment.webAppInvoiceUrl || "",
        createdAt: payment.createdAt || new Date().toISOString(),
        expiresAt: payment.expiresAt || "",
        paidAt: payment.paidAt || "",
      }
    : null;
}

function normalizePlayer(player) {
  return {
    telegramId: String(player.telegramId || "").trim(),
    username: String(player.username || "").trim(),
    displayName: String(player.displayName || "").trim() || "Игрок",
    photoUrl: String(player.photoUrl || "").trim(),
    balance: roundMoney(player.balance || 0),
    totalWon: roundMoney(player.totalWon || 0),
    totalWithdrawn: roundMoney(player.totalWithdrawn || 0),
    transactions: Array.isArray(player.transactions) ? player.transactions : [],
    withdrawals: Array.isArray(player.withdrawals) ? player.withdrawals : [],
    caseHistory: Array.isArray(player.caseHistory) ? player.caseHistory : [],
    deposits: Array.isArray(player.deposits) ? player.deposits : [],
    createdAt: player.createdAt || new Date().toISOString(),
    updatedAt: player.updatedAt || new Date().toISOString(),
  };
}

function normalizeTask(task) {
  return {
    id: task.id || crypto.randomUUID(),
    title: String(task.title || "").trim() || "Новое задание",
    taskType: String(task.taskType || "subscribe").trim() === "reaction" ? "reaction" : "subscribe",
    rewardAmount: roundMoney(task.rewardAmount || 0),
    rewardAsset: String(task.rewardAsset || CONFIG.cryptoPayAsset).trim().toUpperCase(),
    link: String(task.link || "").trim(),
    channelName: String(task.channelName || "").trim(),
    reactionCode: String(task.reactionCode || "").trim(),
    status: String(task.status || "active"),
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
    createdByTelegramId: String(task.createdByTelegramId || ""),
    completedByTelegramIds: Array.isArray(task.completedByTelegramIds)
      ? task.completedByTelegramIds.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
}

function persistState() {
  fs.writeFileSync(CONFIG.dataFilePath, JSON.stringify(state, null, 2));
}

function writeCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Token, X-Balance-Admin-Token, X-Task-Admin-Token, X-Telegram-Init-Data"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(res, statusCode, payload) {
  writeCors(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function serveStatic(pathname, res) {
  const normalized = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
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

function readJsonBody(req) {
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

async function cryptoPayRequest(method, payload = {}) {
  const requestUrl = new URL(`${CONFIG.cryptoPayBaseUrl}/${method}`);
  return new Promise((resolve, reject) => {
    const request = https.request(
      requestUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Crypto-Pay-API-Token": CONFIG.cryptoPayApiToken,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!parsed.ok) {
              reject(Object.assign(new Error(parsed.error?.name || parsed.error || "crypto_pay_request_failed"), { statusCode: 502 }));
              return;
            }
            resolve(parsed.result);
          } catch (error) {
            reject(Object.assign(new Error("crypto_pay_invalid_response"), { statusCode: 502 }));
          }
        });
      }
    );
    request.on("error", (error) => reject(Object.assign(error, { statusCode: 502 })));
    request.write(JSON.stringify(payload));
    request.end();
  });
}

function randomSlug() {
  return crypto.randomBytes(4).toString("hex");
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, "");
}

function raise(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

  const secret = crypto.createHmac("sha256", "WebAppData").update(CONFIG.telegramBotToken).digest();
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

function resolveOptionalTelegramUserFromHeader(req) {
  const initData = String(req.headers["x-telegram-init-data"] || "").trim();
  if (!initData || !CONFIG.telegramBotToken) {
    return null;
  }
  try {
    return resolveVerifiedTelegramUser({ initData });
  } catch (error) {
    return null;
  }
}

function resolveTelegramViewer(req, body) {
  const fromHeader = String(req.headers["x-telegram-init-data"] || "").trim();
  const fromBody = String(body.initData || "").trim();
  return resolveVerifiedTelegramUser({ initData: fromBody || fromHeader });
}

function isAllowedAdmin(viewer) {
  if (!CONFIG.telegramBotToken || !CONFIG.adminIds.length) {
    return true;
  }
  const telegramId = String(viewer?.id || "").trim();
  return Boolean(telegramId && CONFIG.adminIds.includes(telegramId));
}

function sanitizeCallbackUrl(url) {
  const value = String(url || "").trim();
  if (!value || value.includes("your-domain")) {
    return "";
  }
  return value;
}
