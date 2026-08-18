const ADMIN_TOKEN_KEY = "ilyushka_admin_token";

const state = {
  config: {},
  adminAccess: {
    authorized: false,
    canAccess: false,
  },
  raffles: [],
  currentRaffleSlug: "",
  currentRaffle: null,
  adminToken: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  roulette: {
    frameId: 0,
    offset: 0,
    activeKey: "",
    finalKey: "",
  },
  auth: {
    telegramId: "",
    username: "",
    displayName: "",
    photoUrl: "",
    initData: "",
  },
};

const elements = {
  heroCard: document.getElementById("hero-card"),
  landingTitle: document.getElementById("landing-title"),
  landingSubtitle: document.getElementById("landing-subtitle"),
  adminLoginCard: document.getElementById("admin-login-card"),
  adminLoginForm: document.getElementById("admin-login-form"),
  adminLoginMessage: document.getElementById("admin-login-message"),
  adminPanel: document.getElementById("admin-panel"),
  adminLogout: document.getElementById("admin-logout"),
  createRaffleForm: document.getElementById("create-raffle-form"),
  adminMessage: document.getElementById("admin-message"),
  adminActiveList: document.getElementById("admin-active-list"),
  adminHistoryList: document.getElementById("admin-history-list"),
  shareCard: document.getElementById("share-card"),
  shareLinkText: document.getElementById("share-link-text"),
  copyLinkButton: document.getElementById("copy-link-button"),
  openLinkButton: document.getElementById("open-link-button"),
  playerCard: document.getElementById("player-card"),
  playerBadge: document.getElementById("player-badge"),
  raffleTitle: document.getElementById("raffle-title"),
  raffleSubtitle: document.getElementById("raffle-subtitle"),
  playerStatus: document.getElementById("player-status"),
  joinButton: document.getElementById("join-button"),
  joinCard: document.getElementById("join-card"),
  playerMessage: document.getElementById("player-message"),
  rouletteTrack: document.getElementById("roulette-track"),
  publicSection: document.getElementById("public-section"),
  publicRaffles: document.getElementById("public-raffles"),
};

boot();

async function boot() {
  initTelegram();
  state.currentRaffleSlug = getRaffleSlugFromLocation();
  bindEvents();
  await refreshAll();
  setInterval(refreshAll, 5000);
}

function initTelegram() {
  if (!window.Telegram?.WebApp) {
    return;
  }

  const webApp = window.Telegram.WebApp;
  webApp.ready();
  webApp.expand();
  state.auth.initData = String(webApp.initData || "");

  const user = webApp.initDataUnsafe?.user;
  if (!user) {
    return;
  }

  state.auth.telegramId = String(user.id || "");
  state.auth.username = String(user.username || "");
  state.auth.displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    state.auth.username ||
    "Игрок";
  state.auth.photoUrl = String(user.photo_url || user.photoUrl || "");
}

function bindEvents() {
  elements.adminLoginForm.addEventListener("submit", onAdminLogin);
  elements.adminLogout.addEventListener("click", onAdminLogout);
  elements.createRaffleForm.addEventListener("submit", onCreateRaffle);
  elements.copyLinkButton.addEventListener("click", copyShareLink);
  elements.joinButton.addEventListener("click", joinCurrentRaffle);
}

async function refreshAll() {
  const [health, raffles] = await Promise.all([
    api("/api/health", {
      headers: {
        ...(state.adminToken
          ? {
              "X-Admin-Token": state.adminToken,
            }
          : {}),
        ...(state.auth.initData
          ? {
              "X-Telegram-Init-Data": state.auth.initData,
            }
          : {}),
      },
    }),
    api("/api/raffles"),
  ]);

  state.config = health.config || {};
  state.adminAccess = health.admin || { authorized: false, canAccess: false };
  state.raffles = Array.isArray(raffles.raffles) ? raffles.raffles : [];
  syncCurrentRaffle();
  renderAdminVisibility();
  renderPublicRaffles();
  renderCurrentRaffle();

  if (state.adminToken) {
    await renderAdminLists();
  }
}

function syncCurrentRaffle() {
  if (state.currentRaffleSlug) {
    state.currentRaffle =
      state.raffles.find((item) => item.slug === state.currentRaffleSlug) || null;
    return;
  }

  state.currentRaffle =
    state.raffles.find((item) => item.status === "active") ||
    state.raffles[0] ||
    null;
}

function renderAdminVisibility() {
  const isAuthorized = Boolean(state.adminToken && state.adminAccess.authorized);
  const canAccessAdmin = Boolean(state.adminAccess.canAccess);
  const adminMode = isAdminView() && canAccessAdmin;
  elements.adminLoginCard.classList.toggle("hidden", !adminMode || isAuthorized);
  elements.adminPanel.classList.toggle("hidden", !adminMode || !isAuthorized);
}

async function renderAdminLists() {
  try {
    const response = await api("/api/admin/raffles", {
      headers: {
        "X-Admin-Token": state.adminToken,
      },
    });

    const raffles = Array.isArray(response.raffles) ? response.raffles : [];
    const active = raffles.filter((item) => item.status === "active");
    const history = raffles.filter((item) => item.status === "completed");

    elements.adminActiveList.innerHTML = active.length
      ? active
          .map(
            (raffle) => `
              <article class="list-card">
                <div>
                  <strong>${escapeHtml(raffle.title)}</strong>
                  <span>${raffle.participantCount} участников • ${formatTimeLeft(
                    raffle.endsAt,
                    raffle.status
                  )}</span>
                </div>
                <button class="secondary" type="button" data-finalize-id="${raffle.id}">Завершить</button>
              </article>
            `
          )
          .join("")
      : `<div class="list-card empty">Активных розыгрышей нет</div>`;

    elements.adminHistoryList.innerHTML = history.length
      ? history
          .map((raffle) => {
            const winners = raffle.winners.length
              ? raffle.winners
                  .map((winner) => `Победитель ${winner.place}: ${escapeHtml(winner.usernameLabel)}`)
                  .join("<br />")
              : "Победителей нет";
            return `
              <article class="list-card history">
                <strong>${escapeHtml(raffle.title)}</strong>
                <span>${winners}</span>
              </article>
            `;
          })
          .join("")
      : `<div class="list-card empty">История пока пустая</div>`;

    for (const button of elements.adminActiveList.querySelectorAll("[data-finalize-id]")) {
      button.addEventListener("click", async () => {
        await finalizeRaffle(button.dataset.finalizeId || "");
      });
    }
  } catch (error) {
    if (error.message === "admin_required") {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      state.adminToken = "";
      renderAdminVisibility();
    }
  }
}

function renderPublicRaffles() {
  elements.publicSection.classList.add("hidden");
}

function renderCurrentRaffle() {
  const raffle = state.currentRaffle;
  if (!raffle) {
    renderEmptyPlayerState(Boolean(state.currentRaffleSlug));
    stopRouletteLoop();
    return;
  }

  const explicitRaffle = Boolean(state.currentRaffleSlug);
  elements.heroCard.classList.remove("hidden");
  elements.playerCard.classList.remove("landing");
  elements.playerBadge.classList.add("hidden");
  elements.joinCard.classList.remove("hidden");
  elements.raffleTitle.textContent = explicitRaffle ? raffle.title : "";
  elements.raffleSubtitle.textContent = "";
  elements.playerStatus.classList.toggle("hidden", !explicitRaffle);
  elements.playerStatus.classList.add("compact");
  elements.playerStatus.innerHTML = explicitRaffle
    ? [
        statCard("Участников", String(raffle.participantCount)),
        statCard("Время", formatTimeLeft(raffle.endsAt, raffle.status)),
      ].join("")
    : "";
  elements.rouletteTrack.parentElement.parentElement.classList.remove("hidden");

  const viewerParticipant = getViewerParticipant(raffle);
  const hasJoined = Boolean(viewerParticipant);
  const isWinner = raffle.winners.some((winner) => winner.telegramId === state.auth.telegramId);

  if (raffle.status === "completed") {
    elements.joinButton.disabled = true;
    showResultMessage(hasJoined, isWinner);
    renderRoulette(raffle, true);
    return;
  }

  elements.joinButton.disabled = hasJoined || !state.auth.telegramId;

  if (!state.auth.telegramId) {
    showError(elements.playerMessage, "Открой mini app внутри Telegram");
  } else if (!state.auth.initData && state.config.hasTelegramAuth) {
    showError(elements.playerMessage, "Открой приложение заново из бота");
    elements.joinButton.disabled = true;
  } else if (hasJoined) {
    showMessage(elements.playerMessage, "Ты в игре");
  } else {
    elements.playerMessage.classList.add("hidden");
  }

  renderRoulette(raffle, false);
}

function renderEmptyPlayerState(hasExplicitRaffle) {
  elements.playerCard.classList.add("landing");
  elements.playerBadge.classList.add("hidden");
  elements.playerStatus.classList.remove("compact");
  elements.playerStatus.classList.add("hidden");
  elements.playerStatus.innerHTML = "";
  elements.joinCard.classList.toggle("hidden", hasExplicitRaffle);
  elements.rouletteTrack.innerHTML = "";
  elements.rouletteTrack.parentElement.parentElement.classList.add("hidden");

  if (hasExplicitRaffle) {
    elements.raffleTitle.textContent = "Ссылка не активна";
    elements.raffleSubtitle.textContent = "";
    showError(elements.playerMessage, "Розыгрыш не найден");
    return;
  }

  elements.heroCard.classList.remove("hidden");
  elements.landingTitle.textContent = "Халява от Илюшки";
  elements.landingSubtitle.textContent = "";
  elements.raffleTitle.textContent = "";
  elements.raffleSubtitle.textContent = "";
  elements.playerMessage.classList.add("hidden");
}

function showResultMessage(hasJoined, isWinner) {
  if (!hasJoined) {
    showMessage(elements.playerMessage, "Итоги готовы");
    return;
  }

  if (isWinner) {
    elements.playerMessage.classList.remove("hidden", "lose");
    elements.playerMessage.classList.add("win");
    elements.playerMessage.textContent = "ВЫ ВЫИГРАЛИ!";
    return;
  }

  elements.playerMessage.classList.remove("hidden", "win");
  elements.playerMessage.classList.add("lose");
  elements.playerMessage.textContent = "Вы не выпали";
}

function renderRoulette(raffle, animateToWinner) {
  const participants = raffle.participants.length
    ? raffle.participants
    : [
        {
          id: "placeholder",
          displayName: "Ждем игроков",
          usernameLabel: "Новые участники",
          photoUrl: "",
        },
      ];

  const baseTrack = participants.map((participant) => ({
    ...participant,
    isWinner: raffle.winners.some((winner) => winner.participantId === participant.id),
  }));
  const repeated = [];
  for (let index = 0; index < 8; index += 1) {
    for (const participant of baseTrack) {
      repeated.push(participant);
    }
  }

  elements.rouletteTrack.innerHTML = repeated
    .map(
      (participant) => `
        <div class="avatar-bubble${participant.isWinner ? " winner" : ""}" data-participant-id="${escapeHtml(participant.id)}">
          ${
            participant.photoUrl
              ? `<img src="${escapeHtml(participant.photoUrl)}" alt="${escapeHtml(participant.displayName)}" />`
              : `<span>${escapeHtml(initialsOf(participant.displayName))}</span>`
          }
          <small>${escapeHtml(participant.usernameLabel || participant.displayName)}</small>
        </div>
      `
    )
    .join("");

  const raffleKey = `${raffle.id}:${raffle.status}:${raffle.participantCount}`;
  if (!animateToWinner || !raffle.winners.length) {
    state.roulette.finalKey = "";
    startRouletteLoop(raffleKey, participants.length);
    return;
  }

  stopRouletteLoop();
  const finalKey = `${raffle.id}:${raffle.winners.map((winner) => winner.participantId).join(",")}`;
  if (state.roulette.finalKey === finalKey) {
    return;
  }
  state.roulette.finalKey = finalKey;

  const winnerId = raffle.winners[0].participantId;
  const nodes = Array.from(elements.rouletteTrack.querySelectorAll(".avatar-bubble"));
  const targetIndex = nodes.findIndex(
    (node, index) => index > participants.length * 3 && node.dataset.participantId === winnerId
  );
  const targetNode = nodes[targetIndex];
  if (!targetNode) {
    return;
  }

  const viewportWidth = elements.rouletteTrack.parentElement.clientWidth;
  const center = targetNode.offsetLeft + targetNode.offsetWidth / 2;
  const transformX = Math.max(0, center - viewportWidth / 2);

  elements.rouletteTrack.style.transition = "none";
  elements.rouletteTrack.style.transform = "translateX(-40px)";
  requestAnimationFrame(() => {
    elements.rouletteTrack.style.transition = "transform 4.8s cubic-bezier(0.12, 0.88, 0.14, 1)";
    elements.rouletteTrack.style.transform = `translateX(-${transformX}px)`;
  });
}

function startRouletteLoop(raffleKey, participantCount) {
  if (state.roulette.activeKey === raffleKey && state.roulette.frameId) {
    return;
  }

  stopRouletteLoop();
  state.roulette.activeKey = raffleKey;
  state.roulette.offset = 0;
  elements.rouletteTrack.style.transition = "none";

  const bubbleWidth = 96;
  const cycleWidth = Math.max(1, participantCount) * bubbleWidth;
  let previousTime = performance.now();

  const tick = (now) => {
    if (state.roulette.activeKey !== raffleKey) {
      return;
    }

    const delta = now - previousTime;
    previousTime = now;
    state.roulette.offset = (state.roulette.offset + delta * 0.065) % cycleWidth;
    elements.rouletteTrack.style.transform = `translateX(-${state.roulette.offset}px)`;
    state.roulette.frameId = requestAnimationFrame(tick);
  };

  state.roulette.frameId = requestAnimationFrame(tick);
}

function stopRouletteLoop() {
  if (state.roulette.frameId) {
    cancelAnimationFrame(state.roulette.frameId);
  }
  state.roulette.frameId = 0;
  state.roulette.activeKey = "";
}

async function onAdminLogin(event) {
  event.preventDefault();
  const password = new FormData(elements.adminLoginForm).get("password");

  try {
    const response = await api("/api/admin/login", {
      method: "POST",
      headers: state.auth.initData
        ? {
            "X-Telegram-Init-Data": state.auth.initData,
          }
        : {},
      body: JSON.stringify({ password }),
    });
    state.adminToken = response.token;
    localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
    showMessage(elements.adminLoginMessage, "Админка открыта");
    await refreshAll();
  } catch (error) {
    showError(
      elements.adminLoginMessage,
      error.message === "invalid_password"
        ? "Неверный пароль"
        : error.message === "admin_forbidden"
          ? "Доступа нет"
          : error.message
    );
  }
}

async function onAdminLogout() {
  try {
    await api("/api/admin/logout", {
      method: "POST",
      headers: {
        "X-Admin-Token": state.adminToken,
      },
    });
  } catch (error) {
    // Ignore logout errors.
  }

  localStorage.removeItem(ADMIN_TOKEN_KEY);
  state.adminToken = "";
  elements.shareCard.classList.add("hidden");
  await refreshAll();
}

async function onCreateRaffle(event) {
  event.preventDefault();
  const form = new FormData(elements.createRaffleForm);
  const payload = {
    title: form.get("title"),
    prizeText: form.get("prizeText"),
    winnersCount: Number(form.get("winnersCount")),
    timerMinutes: Number(form.get("timerMinutes")),
  };

  try {
    const response = await api("/api/admin/raffles", {
      method: "POST",
      headers: {
        "X-Admin-Token": state.adminToken,
      },
      body: JSON.stringify(payload),
    });
    elements.createRaffleForm.reset();
    revealShareCard(response.shareLink);
    showMessage(elements.adminMessage, "Розыгрыш создан");
    state.currentRaffleSlug = response.raffle.slug;
    await refreshAll();
  } catch (error) {
    showError(elements.adminMessage, error.message);
  }
}

function revealShareCard(link) {
  elements.shareCard.classList.remove("hidden");
  elements.shareLinkText.textContent = link;
  elements.openLinkButton.href = link;
}

async function copyShareLink() {
  const text = elements.shareLinkText.textContent.trim();
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showMessage(elements.adminMessage, "Ссылка скопирована");
  } catch (error) {
    showError(elements.adminMessage, "Не удалось скопировать ссылку");
  }
}

async function joinCurrentRaffle() {
  const raffle = state.currentRaffle;
  if (!raffle) {
    showError(elements.playerMessage, "Розыгрыш не найден");
    return;
  }

  if (!state.auth.telegramId) {
    showError(elements.playerMessage, "Зайди через Telegram Mini App");
    return;
  }

  try {
    const response = await api(`/api/raffles/slug/${encodeURIComponent(raffle.slug)}/join`, {
      method: "POST",
      body: JSON.stringify({
        initData: state.auth.initData,
      }),
    });
    state.currentRaffle = response.raffle;
    state.raffles = state.raffles.map((item) => (item.id === response.raffle.id ? response.raffle : item));
    showMessage(elements.playerMessage, "Ты в игре");
    renderCurrentRaffle();
    renderPublicRaffles();
  } catch (error) {
    showError(elements.playerMessage, formatPlayerError(error.message));
  }
}

async function finalizeRaffle(raffleId) {
  try {
    await api(`/api/admin/raffles/${raffleId}/finalize`, {
      method: "POST",
      headers: {
        "X-Admin-Token": state.adminToken,
      },
    });
    showMessage(elements.adminMessage, "Итоги подведены");
    await refreshAll();
  } catch (error) {
    showError(elements.adminMessage, error.message);
  }
}

function getViewerParticipant(raffle) {
  return raffle.participants.find((participant) => participant.telegramId === state.auth.telegramId) || null;
}

function getRaffleSlugFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const direct = params.get("raffle");
  const startParam =
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
    params.get("startapp") ||
    params.get("tgWebAppStartParam") ||
    "";

  if (direct) {
    return direct;
  }

  if (startParam) {
    if (String(startParam).startsWith("raffle_")) {
      return String(startParam).slice("raffle_".length);
    }
    return String(startParam);
  }

  return "";
}

function isAdminView() {
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "1" || Boolean(state.adminToken);
}

function buildRaffleUrl(slug) {
  const adminQuery = state.adminAccess.canAccess ? "admin=1&" : "";
  return `/?${adminQuery}raffle=${encodeURIComponent(slug)}`;
}

function statCard(label, value) {
  return `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function formatTimeLeft(endsAt, status) {
  if (status === "completed") {
    return "Готово";
  }

  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) {
    return "0м";
  }

  const totalMinutes = Math.ceil(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}ч ${minutes}м` : `${minutes}м`;
}

function formatPlayerError(message) {
  switch (message) {
    case "telegram_required":
      return "Открой приложение через Telegram";
    case "telegram_init_data_required":
      return "Открой розыгрыш заново из бота";
    case "telegram_bot_token_required":
      return "На сервере не настроен BOT_TOKEN";
    case "telegram_init_data_invalid":
      return "Проверка Telegram не пройдена";
    case "telegram_init_data_expired":
      return "Ссылка устарела, открой снова";
    case "raffle_closed":
      return "Розыгрыш уже завершен";
    default:
      return message;
  }
}

function showMessage(element, text) {
  element.classList.remove("hidden", "error", "win", "lose");
  element.textContent = text;
}

function showError(element, text) {
  element.classList.remove("hidden", "win", "lose");
  element.classList.add("error");
  element.textContent = text;
}

function initialsOf(text) {
  return String(text || "Игрок")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "request_failed");
  }
  return payload;
}
