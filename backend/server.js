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

const CONFIG = {
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
  telegramBotToken: String(
    process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ""
  ).trim(),
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

    const password = String(body.password || "");
    if (password !== CONFIG.adminPassword) {
      sendJson(res, 401, { error: "invalid_password" });
      return;
    }

    const token = crypto.randomUUID();
    state.adminSessions = (state.adminSessions || []).filter((item) => item.expiresAt > Date.now());
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
    persistState();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/balance/login") {
    assertAdmin(adminSession);

    const password = String(body.password || "");
    if (password !== CONFIG.balanceAdminPassword) {
      sendJson(res, 401, { error: "balance_invalid_password" });
      return;
    }

    const token = crypto.randomUUID();
    state.balanceAdminSessions = (state.balanceAdminSessions || []).filter(
      (item) => item.expiresAt > Date.now()
    );
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

  if (method === "GET" && pathname === "/api/admin/raffles") {
    assertAdmin(adminSession);
    sendJson(res, 200, {
      raffles: state.raffles
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((raffle) => serializeRaffle(raffle, { admin: true })),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/raffles") {
    assertAdmin(adminSession);
    const raffle = await createPendingRaffle(body, adminSession);
    state.raffles.push(raffle);
    persistState();
    sendJson(res, 201, {
      raffle: serializeRaffle(raffle, { admin: true }),
      payment: serializePayment(raffle.payment),
      shareLink: raffle.status === "active" ? raffle.shareLink : "",
    });
    return;
  }

  const verifyPaymentMatch = pathname.match(/^\/api\/admin\/raffles\/([^/]+)\/verify-payment$/);
  if (method === "POST" && verifyPaymentMatch) {
    assertAdmin(adminSession);
    const raffle = state.raffles.find((item) => item.id === verifyPaymentMatch[1]);
    if (!raffle) {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }

    await verifyPendingRafflePayment(raffle);
    persistState();
    sendJson(res, 200, {
      raffle: serializeRaffle(raffle, { admin: true }),
      payment: serializePayment(raffle.payment),
      shareLink: raffle.status === "active" ? raffle.shareLink : "",
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
        .filter((raffle) => raffle.status !== "pending_payment")
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((raffle) => serializeRaffle(raffle)),
    });
    return;
  }

  const publicMatch = pathname.match(/^\/api\/raffles\/slug\/([^/]+)$/);
  if (method === "GET" && publicMatch) {
    const raffle = state.raffles.find((item) => item.slug === publicMatch[1]);
    if (!raffle || raffle.status === "pending_payment") {
      sendJson(res, 404, { error: "raffle_not_found" });
      return;
    }

    sendJson(res, 200, { raffle: serializeRaffle(raffle) });
    return;
  }

  const joinMatch = pathname.match(/^\/api\/raffles\/slug\/([^/]+)\/join$/);
  if (method === "POST" && joinMatch) {
    const raffle = state.raffles.find((item) => item.slug === joinMatch[1]);
    if (!raffle || raffle.status === "pending_payment") {
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

  if (method === "GET" && pathname === "/api/profile") {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    persistState();
    sendJson(res, 200, {
      profile: serializeProfile(player),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/profile/withdraw") {
    const viewer = resolveTelegramViewer(req, body);
    const player = getOrCreatePlayer(viewer);
    const result = await requestWithdrawal(player, viewer, body);
    persistState();
    sendJson(res, 201, {
      profile: serializeProfile(player),
      withdrawal: result,
    });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

async function createPendingRaffle(body, adminSession) {
  const title = String(body.title || "").trim() || "Новый розыгрыш";
  const prizeText = String(body.prizeText || "").trim() || "Денежный розыгрыш";
  const winnersCount = clampInt(body.winnersCount, 1, 20, 1);
  const timerMinutes = clampInt(body.timerMinutes, 1, 60 * 24 * 30, 60);
  const prizeAmount = clampNumber(body.prizeAmount, 0.1, 25000, NaN);

  if (!Number.isFinite(prizeAmount)) {
    raise(400, "prize_amount_required");
  }

  const slug = randomSlug();
  const raffle = {
    id: crypto.randomUUID(),
    slug,
    title,
    prizeText,
    prizeAmount: roundMoney(prizeAmount),
    prizeAsset: CONFIG.cryptoPayAsset,
    winnersCount,
    timerMinutes,
    createdAt: new Date().toISOString(),
    activatedAt: "",
    endsAt: "",
    status: "pending_payment",
    shareLink: buildShareLink({ slug }),
    participants: [],
    winners: [],
    resultText: "",
    payoutDistributedAt: "",
    createdByTelegramId: String(adminSession.telegramId || ""),
    payment: await createRafflePayment({
      raffleId: slug,
      title,
      prizeText,
      amount: prizeAmount,
    }),
  };

  return raffle;
}

async function createRafflePayment({ raffleId, title, prizeText, amount }) {
  const now = new Date().toISOString();
  if (!CONFIG.cryptoPayApiToken) {
    return {
      provider: "mock",
      status: "pending",
      amount: roundMoney(amount),
      asset: CONFIG.cryptoPayAsset,
      createdAt: now,
      expiresAt: new Date(Date.now() + CONFIG.cryptoPayInvoiceExpiresIn * 1000).toISOString(),
      mockAutoConfirm: true,
      botInvoiceUrl: `https://t.me/${CONFIG.cryptobotUsername}`,
      miniAppInvoiceUrl: "",
      webAppInvoiceUrl: "",
      invoiceId: `mock_${raffleId}`,
    };
  }

  const callbackUrl = sanitizeCallbackUrl(CONFIG.webAppUrl) || "https://t.me/" + CONFIG.cryptobotUsername;
  const invoice = await cryptoPayRequest("createInvoice", {
    asset: CONFIG.cryptoPayAsset,
    amount: formatMoney(amount),
    description: `${title} • ${prizeText}`.slice(0, 1024),
    payload: JSON.stringify({ type: "raffle", raffleId }),
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

async function verifyPendingRafflePayment(raffle) {
  if (raffle.status === "active" || raffle.status === "completed") {
    return raffle;
  }

  if (!raffle.payment) {
    raise(409, "payment_missing");
  }

  if (raffle.payment.provider === "mock" || CONFIG.autoConfirmPayments) {
    raffle.payment.status = "paid";
    raffle.payment.paidAt = new Date().toISOString();
    activateRaffle(raffle);
    return raffle;
  }

  const result = await cryptoPayRequest("getInvoices", {
    invoice_ids: String(raffle.payment.invoiceId || ""),
  });
  const invoice = Array.isArray(result.items)
    ? result.items[0]
    : Array.isArray(result)
      ? result[0]
      : null;

  if (!invoice) {
    raise(404, "invoice_not_found");
  }

  raffle.payment.status = String(invoice.status || raffle.payment.status || "pending");
  raffle.payment.botInvoiceUrl = String(invoice.bot_invoice_url || raffle.payment.botInvoiceUrl || "");
  raffle.payment.miniAppInvoiceUrl = String(invoice.mini_app_invoice_url || raffle.payment.miniAppInvoiceUrl || "");
  raffle.payment.webAppInvoiceUrl = String(invoice.web_app_invoice_url || raffle.payment.webAppInvoiceUrl || "");
  raffle.payment.expiresAt = String(invoice.expiration_date || raffle.payment.expiresAt || "");

  if (invoice.status === "paid") {
    raffle.payment.paidAt = new Date().toISOString();
    activateRaffle(raffle);
    return raffle;
  }

  if (invoice.status === "expired") {
    raise(409, "invoice_expired");
  }

  raise(409, "invoice_not_paid");
}

function activateRaffle(raffle) {
  if (raffle.status !== "pending_payment") {
    return raffle;
  }

  raffle.status = "active";
  raffle.activatedAt = new Date().toISOString();
  raffle.endsAt = new Date(Date.now() + raffle.timerMinutes * 60 * 1000).toISOString();
  raffle.shareLink = buildShareLink({ slug: raffle.slug });
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
  getOrCreatePlayer(viewer);
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
  const winnerCount = Math.min(raffle.winnersCount, pool.length);
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

    creditPlayerBalance(chosen, creditedAmount, raffle);
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

function creditPlayerBalance(participant, amount, raffle) {
  if (!amount) {
    return;
  }

  const player = getOrCreatePlayer(participant);
  player.balance = roundMoney(player.balance + amount);
  player.totalWon = roundMoney(player.totalWon + amount);
  player.updatedAt = new Date().toISOString();
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "raffle_win",
    amount: roundMoney(amount),
    asset: raffle.prizeAsset,
    raffleId: raffle.id,
    raffleTitle: raffle.title,
    createdAt: new Date().toISOString(),
  });
  player.transactions = player.transactions.slice(0, 20);
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
    recentTransactions: player.transactions.slice(0, 6),
    recentWithdrawals: player.withdrawals.slice(0, 6),
  };
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
    player = {
      telegramId,
      username,
      displayName,
      photoUrl,
      balance: 0,
      totalWon: 0,
      totalWithdrawn: 0,
      transactions: [],
      withdrawals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.players.push(player);
  } else {
    player.username = username || player.username;
    player.displayName = displayName || player.displayName;
    player.photoUrl = photoUrl || player.photoUrl;
    player.updatedAt = new Date().toISOString();
  }

  return player;
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

  let check;
  if (!CONFIG.cryptoPayApiToken) {
    check = {
      check_id: `mock_${crypto.randomUUID()}`,
      bot_check_url: `https://t.me/${CONFIG.cryptobotUsername}`,
    };
  } else {
    check = await cryptoPayRequest("createCheck", {
      asset: CONFIG.cryptoPayAsset,
      amount: formatMoney(roundedAmount),
      pin_to_user_id: Number(String(viewer.id || viewer.telegramId || "0")) || undefined,
    });
  }

  player.balance = roundMoney(player.balance - roundedAmount);
  player.totalWithdrawn = roundMoney(player.totalWithdrawn + roundedAmount);
  player.updatedAt = new Date().toISOString();

  const withdrawal = {
    id: crypto.randomUUID(),
    amount: roundedAmount,
    asset: CONFIG.cryptoPayAsset,
    method: "cryptobot",
    status: CONFIG.cryptoPayApiToken ? "issued" : "mock_issued",
    createdAt: new Date().toISOString(),
    checkId: String(check.check_id || ""),
    checkUrl: String(check.bot_check_url || `https://t.me/${CONFIG.cryptobotUsername}`),
  };

  player.withdrawals.unshift(withdrawal);
  player.withdrawals = player.withdrawals.slice(0, 20);
  player.transactions.unshift({
    id: crypto.randomUUID(),
    type: "withdrawal",
    amount: -roundedAmount,
    asset: CONFIG.cryptoPayAsset,
    createdAt: new Date().toISOString(),
  });
  player.transactions = player.transactions.slice(0, 20);

  return withdrawal;
}

function adjustPlayerBalance(body, adminSession) {
  const username = String(body.username || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
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
    createdAt: new Date().toISOString(),
  });
  player.transactions = player.transactions.slice(0, 20);

  return {
    ok: true,
    message:
      operation === "credit"
        ? `Пользователю @${player.username} выдано ${formatMoney(roundedAmount)} ${CONFIG.cryptoPayAsset}`
        : `У пользователя @${player.username} списано ${formatMoney(roundedAmount)} ${CONFIG.cryptoPayAsset}`,
    profile: serializeProfile(player),
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
    const extra = index < remainder ? 1 : 0;
    result.push((base + extra) / 100);
  }
  return result;
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

function getBalanceAdminSession(req) {
  const token = String(req.headers["x-balance-admin-token"] || "").trim();
  if (!token) {
    return null;
  }

  const session = (state.balanceAdminSessions || []).find(
    (item) => item.token === token && item.expiresAt > Date.now()
  );
  return session || null;
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

function ensureDataFile() {
  fs.mkdirSync(path.dirname(CONFIG.dataFilePath), { recursive: true });
  if (!fs.existsSync(CONFIG.dataFilePath)) {
    fs.writeFileSync(
      CONFIG.dataFilePath,
      JSON.stringify({ raffles: [], adminSessions: [], balanceAdminSessions: [], players: [] }, null, 2)
    );
  }
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG.dataFilePath, "utf8"));
    return normalizeState(parsed);
  } catch (error) {
    return normalizeState({});
  }
}

function normalizeState(parsed) {
  return {
    raffles: Array.isArray(parsed.raffles) ? parsed.raffles.map(normalizeRaffle) : [],
    adminSessions: Array.isArray(parsed.adminSessions) ? parsed.adminSessions : [],
    balanceAdminSessions: Array.isArray(parsed.balanceAdminSessions) ? parsed.balanceAdminSessions : [],
    players: Array.isArray(parsed.players) ? parsed.players.map(normalizePlayer) : [],
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
    payment: raffle.payment
      ? {
          provider: raffle.payment.provider || "mock",
          status: raffle.payment.status || "pending",
          amount: roundMoney(raffle.payment.amount || raffle.prizeAmount || 0),
          asset: raffle.payment.asset || CONFIG.cryptoPayAsset,
          invoiceId: raffle.payment.invoiceId || "",
          botInvoiceUrl: raffle.payment.botInvoiceUrl || "",
          miniAppInvoiceUrl: raffle.payment.miniAppInvoiceUrl || "",
          webAppInvoiceUrl: raffle.payment.webAppInvoiceUrl || "",
          createdAt: raffle.payment.createdAt || raffle.createdAt || "",
          expiresAt: raffle.payment.expiresAt || "",
          paidAt: raffle.payment.paidAt || "",
        }
      : null,
  };
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
    createdAt: player.createdAt || new Date().toISOString(),
    updatedAt: player.updatedAt || new Date().toISOString(),
  };
}

function persistState() {
  fs.writeFileSync(CONFIG.dataFilePath, JSON.stringify(state, null, 2));
}

function writeCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Token, X-Balance-Admin-Token, X-Telegram-Init-Data"
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

async function cryptoPayRequest(method, payload = {}) {
  const requestUrl = new URL(`${CONFIG.cryptoPayBaseUrl}/${method}`);
  const body = JSON.stringify(payload);

  const responseText = await new Promise((resolve, reject) => {
    const request = https.request(
      requestUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "Crypto-Pay-API-Token": CONFIG.cryptoPayApiToken,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    raise(502, "crypto_pay_invalid_response");
  }

  if (!parsed.ok) {
    raise(502, parsed.error?.name || parsed.error || "crypto_pay_request_failed");
  }

  return parsed.result;
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

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return roundMoney(value).toFixed(2);
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
  const initData = fromBody || fromHeader;
  return resolveVerifiedTelegramUser({ initData });
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
