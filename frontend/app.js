const ADMIN_TOKEN_KEY = "ilyushka_admin_token";
const BALANCE_ADMIN_TOKEN_KEY = "ilyushka_balance_admin_token";
const ROULETTE_LOOP_BUBBLE_WIDTH = 84;
const ROULETTE_STOP_DURATION_MS = 4200;
const ROULETTE_STAGGER_MS = 1200;

const state = {
  config: {},
  adminAccess: {
    authorized: false,
    canAccess: false,
  },
  balanceAdminAuthorized: false,
  adminUi: {
    menuOpen: false,
    panelOpen: false,
  },
  raffles: [],
  currentRaffleSlug: "",
  currentRaffle: null,
  adminToken: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  balanceAdminToken: localStorage.getItem(BALANCE_ADMIN_TOKEN_KEY) || "",
  pendingPaymentRaffleId: "",
  profile: null,
  lastWithdrawal: null,
  roulette: {
    loops: new Map(),
    finalKey: "",
    revealTimerId: 0,
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
  adminNav: document.getElementById("admin-nav"),
  adminMenuButton: document.getElementById("admin-menu-button"),
  adminMenuPanel: document.getElementById("admin-menu-panel"),
  adminMenuToggle: document.getElementById("admin-menu-toggle"),
  profileNav: document.getElementById("profile-nav"),
  profileButton: document.getElementById("profile-button"),
  profileAvatar: document.getElementById("profile-avatar"),
  profileBalanceChip: document.getElementById("profile-balance-chip"),
  profileSheet: document.getElementById("profile-sheet"),
  sheetBackdrop: document.getElementById("sheet-backdrop"),
  closeProfileButton: document.getElementById("close-profile-button"),
  profileName: document.getElementById("profile-name"),
  profileSheetAvatar: document.getElementById("profile-sheet-avatar"),
  profileUsernameLabel: document.getElementById("profile-username-label"),
  profileBalanceLabel: document.getElementById("profile-balance-label"),
  withdrawForm: document.getElementById("withdraw-form"),
  profileMessage: document.getElementById("profile-message"),
  withdrawResultCard: document.getElementById("withdraw-result-card"),
  withdrawResultText: document.getElementById("withdraw-result-text"),
  withdrawOpenButton: document.getElementById("withdraw-open-button"),
  heroCard: document.getElementById("hero-card"),
  landingTitle: document.getElementById("landing-title"),
  landingSubtitle: document.getElementById("landing-subtitle"),
  adminLoginCard: document.getElementById("admin-login-card"),
  adminLoginForm: document.getElementById("admin-login-form"),
  adminLoginMessage: document.getElementById("admin-login-message"),
  adminPanel: document.getElementById("admin-panel"),
  adminLogout: document.getElementById("admin-logout"),
  createRaffleForm: document.getElementById("create-raffle-form"),
  balanceLockCard: document.getElementById("balance-lock-card"),
  balanceAuthForm: document.getElementById("balance-auth-form"),
  balanceAdjustForm: document.getElementById("balance-adjust-form"),
  balanceAdminMessage: document.getElementById("balance-admin-message"),
  paymentCard: document.getElementById("payment-card"),
  paymentCardText: document.getElementById("payment-card-text"),
  payInvoiceButton: document.getElementById("pay-invoice-button"),
  verifyPaymentButton: document.getElementById("verify-payment-button"),
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
  emptyProfileButton: document.getElementById("empty-profile-button"),
  joinCard: document.getElementById("join-card"),
  playerMessage: document.getElementById("player-message"),
  rouletteStack: document.getElementById("roulette-stack"),
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
  elements.adminMenuButton.addEventListener("click", toggleAdminMenu);
  elements.adminMenuToggle.addEventListener("click", toggleAdminPanelView);
  elements.profileButton.addEventListener("click", openProfileSheet);
  elements.closeProfileButton.addEventListener("click", closeProfileSheet);
  elements.sheetBackdrop.addEventListener("click", closeProfileSheet);
  elements.adminLoginForm.addEventListener("submit", onAdminLogin);
  elements.adminLogout.addEventListener("click", onAdminLogout);
  elements.createRaffleForm.addEventListener("submit", onCreateRaffle);
  elements.balanceAuthForm.addEventListener("submit", onBalanceAdminLogin);
  elements.balanceAdjustForm.addEventListener("submit", onBalanceAdjust);
  elements.verifyPaymentButton.addEventListener("click", onVerifyPayment);
  elements.copyLinkButton.addEventListener("click", copyShareLink);
  elements.joinButton.addEventListener("click", joinCurrentRaffle);
  elements.emptyProfileButton.addEventListener("click", openProfileSheet);
  elements.withdrawForm.addEventListener("submit", onWithdrawSubmit);
  document.addEventListener("click", onDocumentClick);
}

async function refreshAll() {
  try {
    const requests = [
      api("/api/health", {
        headers: {
          ...buildAdminHeaders(),
          ...buildBalanceAdminHeaders(),
          ...buildTelegramHeaders(),
        },
      }),
      state.currentRaffleSlug
        ? api(`/api/raffles/slug/${encodeURIComponent(state.currentRaffleSlug)}`).catch((error) => {
            if (error.message === "raffle_not_found") {
              return { raffle: null };
            }
            throw error;
          })
        : api("/api/raffles"),
    ];

    if (state.auth.initData) {
      requests.push(
        api("/api/profile", {
          headers: buildTelegramHeaders(),
        }).catch(() => ({ profile: null }))
      );
    } else {
      requests.push(Promise.resolve({ profile: null }));
    }

    const [health, rafflePayload, profilePayload] = await Promise.all(requests);
    state.config = health.config || {};
    state.adminAccess = health.admin || { authorized: false, canAccess: false };
    state.balanceAdminAuthorized = Boolean(health.admin?.balanceAuthorized);
    state.profile = profilePayload.profile || null;

    if (!state.balanceAdminAuthorized && state.balanceAdminToken) {
      localStorage.removeItem(BALANCE_ADMIN_TOKEN_KEY);
      state.balanceAdminToken = "";
    }

    if (state.currentRaffleSlug) {
      state.raffles = rafflePayload.raffle ? [rafflePayload.raffle] : [];
    } else {
      state.raffles = Array.isArray(rafflePayload.raffles) ? rafflePayload.raffles : [];
    }

    syncCurrentRaffle();
    renderAdminVisibility();
    renderProfileVisibility();
    renderProfileSheet();
    renderCurrentRaffle();

    if (state.adminToken) {
      await renderAdminLists();
    }
  } catch (error) {
    console.error(error);
  }
}

function syncCurrentRaffle() {
  if (state.currentRaffleSlug) {
    state.currentRaffle = state.raffles[0] || null;
    return;
  }

  state.currentRaffle = state.raffles.find((item) => item.status === "active") || null;
}

function renderAdminVisibility() {
  const isAuthorized = Boolean(state.adminToken && state.adminAccess.authorized);
  const canAccessAdmin = Boolean(state.adminAccess.canAccess);
  const showPanel = canAccessAdmin && state.adminUi.panelOpen;
  elements.adminNav.classList.toggle("hidden", !canAccessAdmin);
  elements.adminLoginCard.classList.toggle("hidden", !showPanel || isAuthorized);
  elements.adminPanel.classList.toggle("hidden", !showPanel || !isAuthorized);
  elements.adminMenuPanel.classList.toggle("hidden", !canAccessAdmin || !state.adminUi.menuOpen);
  elements.adminMenuButton.classList.toggle("active", canAccessAdmin && state.adminUi.menuOpen);
  elements.adminMenuToggle.textContent = showPanel ? "Вернуться к розыгрышу" : "Перейти в админ раздел";
  elements.balanceLockCard.classList.toggle("hidden", !isAuthorized || state.balanceAdminAuthorized);
  elements.balanceAdjustForm.classList.toggle("hidden", !isAuthorized || !state.balanceAdminAuthorized);
}

function renderProfileVisibility() {
  const canShow = Boolean(state.auth.telegramId);
  elements.profileNav.classList.toggle("hidden", !canShow);
  if (!canShow) {
    closeProfileSheet();
    return;
  }

  renderAvatarContent(elements.profileAvatar, state.auth.displayName);
  elements.profileBalanceChip.textContent = compactBalance(state.profile?.balanceLabel, state.config.payoutAsset);
}

function renderProfileSheet() {
  const profile = state.profile;
  const name = state.auth.displayName || "Игрок";
  const usernameLabel = profile?.usernameLabel || state.auth.username || "Без username";
  const balanceLabel = profile?.balanceLabel || `Баланс 0 ${state.config.payoutAsset || "USDT"}`;

  elements.profileName.textContent = name;
  elements.profileUsernameLabel.textContent = usernameLabel;
  elements.profileBalanceLabel.textContent = balanceLabel;
  renderAvatarContent(elements.profileSheetAvatar, name);

  if (state.lastWithdrawal?.checkUrl) {
    elements.withdrawResultCard.classList.remove("hidden");
    elements.withdrawResultText.textContent = `${state.lastWithdrawal.amountLabel} • ${state.lastWithdrawal.providerLabel || "CryptoBot"}`;
    elements.withdrawOpenButton.href = state.lastWithdrawal.checkUrl;
  } else {
    elements.withdrawResultCard.classList.add("hidden");
  }
}

async function renderAdminLists() {
  try {
    const response = await api("/api/admin/raffles", {
      headers: buildAdminHeaders(),
    });

    const raffles = Array.isArray(response.raffles) ? response.raffles : [];
    const current = raffles.filter((item) => item.status === "pending_payment" || item.status === "active");
    const history = raffles.filter((item) => item.status === "completed");

    elements.adminActiveList.innerHTML = current.length
      ? current.map(renderAdminRaffleCard).join("")
      : `<div class="list-card empty">Текущих розыгрышей нет</div>`;

    elements.adminHistoryList.innerHTML = history.length
      ? history.map(renderHistoryCard).join("")
      : `<div class="list-card empty">История пока пустая</div>`;

    for (const button of elements.adminActiveList.querySelectorAll("[data-finalize-id]")) {
      button.addEventListener("click", async () => {
        await finalizeRaffle(button.dataset.finalizeId || "");
      });
    }

    for (const button of elements.adminActiveList.querySelectorAll("[data-verify-id]")) {
      button.addEventListener("click", async () => {
        await verifyPayment(button.dataset.verifyId || "");
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

function renderAdminRaffleCard(raffle) {
  const isPending = raffle.status === "pending_payment";
  const paymentUrl = getPaymentUrl(raffle.payment);
  const perWinner = raffle.winnersCount ? raffle.prizeAmount / raffle.winnersCount : raffle.prizeAmount;
  const action = isPending
    ? `
        <div class="list-actions">
          ${paymentUrl ? `<a class="primary" target="_blank" rel="noreferrer" href="${escapeHtml(paymentUrl)}">Оплатить</a>` : ""}
          <button class="secondary" type="button" data-verify-id="${escapeHtml(raffle.id)}">Проверить оплату</button>
        </div>
      `
    : `
        <div class="list-actions">
          <button class="secondary" type="button" data-finalize-id="${escapeHtml(raffle.id)}">Завершить</button>
        </div>
      `;

  return `
    <article class="list-card column ${isPending ? "pending" : ""}">
      <div class="list-row">
        <strong>${escapeHtml(raffle.title)}</strong>
        <span class="status-pill ${isPending ? "pending" : "active"}">${isPending ? "Ждет оплату" : "Активен"}</span>
      </div>
      <span>${escapeHtml(raffle.prizeText)} • ${formatMoney(raffle.prizeAmount)} ${escapeHtml(raffle.prizeAsset || state.config.payoutAsset || "USDT")}</span>
      <span>${raffle.winnersCount} побед. по ${formatMoney(perWinner)} ${escapeHtml(raffle.prizeAsset || state.config.payoutAsset || "USDT")}</span>
      <span>${raffle.participantCount} участников • ${formatTimeLeft(raffle.endsAt, raffle.status)}</span>
      ${action}
    </article>
  `;
}

function renderHistoryCard(raffle) {
  const winners = Array.isArray(raffle.winners) && raffle.winners.length
    ? raffle.winners
        .map((winner) => {
          const amountLabel = winner.prizeAmount
            ? ` • ${formatMoney(winner.prizeAmount)} ${escapeHtml(raffle.prizeAsset || state.config.payoutAsset || "USDT")}`
            : "";
          return `Победитель ${winner.place}: ${escapeHtml(winner.usernameLabel)}${amountLabel}`;
        })
        .join("<br />")
    : "Победителей нет";

  return `
    <article class="list-card history">
      <strong>${escapeHtml(raffle.title)}</strong>
      <span>${winners}</span>
    </article>
  `;
}

function renderCurrentRaffle() {
  const raffle = state.currentRaffle;
  if (!raffle) {
    renderEmptyPlayerState(Boolean(state.currentRaffleSlug));
    stopAllRouletteLoops();
    return;
  }

  const explicitRaffle = Boolean(state.currentRaffleSlug);
  const prizeAsset = raffle.prizeAsset || state.config.payoutAsset || "USDT";
  const perWinner = raffle.winnersCount ? raffle.prizeAmount / raffle.winnersCount : raffle.prizeAmount;

  elements.heroCard.classList.remove("hidden");
  elements.playerCard.classList.remove("landing");
  elements.playerBadge.classList.add("hidden");
  elements.joinCard.classList.remove("hidden");
  elements.joinButton.classList.remove("hidden");
  elements.emptyProfileButton.classList.add("hidden");
  elements.raffleTitle.textContent = explicitRaffle ? raffle.title : "Халява от Илюшки";
  elements.raffleSubtitle.textContent = explicitRaffle
    ? `${raffle.prizeText} • ${formatMoney(raffle.prizeAmount)} ${prizeAsset} • по ${formatMoney(perWinner)} ${prizeAsset}`
    : "";
  elements.playerStatus.classList.toggle("hidden", !explicitRaffle);
  elements.playerStatus.classList.add("compact");
  elements.playerStatus.innerHTML = explicitRaffle
    ? [
        statCard("Участников", String(raffle.participantCount)),
        statCard("Время", formatTimeLeft(raffle.endsAt, raffle.status)),
      ].join("")
    : "";
  elements.rouletteStack.classList.remove("hidden");

  const viewerParticipant = getViewerParticipant(raffle);
  const hasJoined = Boolean(viewerParticipant);
  const winnerEntry = Array.isArray(raffle.winners)
    ? raffle.winners.find((winner) => winner.telegramId === state.auth.telegramId)
    : null;

  if (raffle.status === "completed") {
    elements.joinButton.disabled = true;
    showResultMessage(hasJoined, winnerEntry, prizeAsset);
    renderRouletteStack(raffle, true);
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

  renderRouletteStack(raffle, false);
}

function renderEmptyPlayerState(hasExplicitRaffle) {
  elements.playerCard.classList.add("landing");
  elements.playerBadge.classList.add("hidden");
  elements.playerStatus.classList.remove("compact");
  elements.playerStatus.classList.add("hidden");
  elements.playerStatus.innerHTML = "";
  elements.joinCard.classList.toggle("hidden", hasExplicitRaffle);
  elements.joinButton.classList.toggle("hidden", !hasExplicitRaffle);
  elements.emptyProfileButton.classList.toggle("hidden", hasExplicitRaffle || !state.auth.telegramId);
  elements.rouletteStack.innerHTML = "";
  elements.rouletteStack.classList.add("hidden");
  stopAllRouletteLoops();

  if (hasExplicitRaffle) {
    elements.raffleTitle.textContent = "Ссылка не активна";
    elements.raffleSubtitle.textContent = "";
    showError(elements.playerMessage, "Розыгрыш не найден");
    return;
  }

  elements.heroCard.classList.remove("hidden");
  elements.landingTitle.textContent = "Халява от Илюшки";
  elements.landingSubtitle.textContent = state.auth.telegramId
    ? "Сейчас активного розыгрыша нет, но баланс и вывод доступны."
    : "";
  elements.raffleTitle.textContent = "Халява от Илюшки";
  elements.raffleSubtitle.textContent = state.auth.telegramId ? "Можно открыть профиль и вывести баланс." : "";
  if (state.auth.telegramId) {
    showMessage(elements.playerMessage, "Баланс и вывод доступны");
  } else {
    elements.playerMessage.classList.add("hidden");
  }
}

function showResultMessage(hasJoined, winnerEntry, prizeAsset) {
  if (!hasJoined) {
    showMessage(elements.playerMessage, "Итоги готовы");
    return;
  }

  if (winnerEntry) {
    elements.playerMessage.classList.remove("hidden", "lose", "error");
    elements.playerMessage.classList.add("win");
    const amountLabel = winnerEntry.prizeAmount ? ` +${formatMoney(winnerEntry.prizeAmount)} ${prizeAsset}` : "";
    elements.playerMessage.textContent = `Ты выиграл${amountLabel}`;
    return;
  }

  elements.playerMessage.classList.remove("hidden", "win", "error");
  elements.playerMessage.classList.add("lose");
  elements.playerMessage.textContent = "В этот раз не выпало";
}

function renderRouletteStack(raffle, animateToWinner) {
  const participants = Array.isArray(raffle.participants) && raffle.participants.length
    ? raffle.participants
    : [
        {
          id: "placeholder",
          displayName: "Ждем игроков",
          usernameLabel: "Новые участники",
          photoUrl: "",
        },
      ];

  const winners = Array.isArray(raffle.winners) && raffle.winners.length ? raffle.winners : [null];
  const cards = animateToWinner ? winners : [null];
  const raffleKey = `${raffle.id}:${raffle.status}:${raffle.participantCount}:${cards.length}`;

  if (!animateToWinner) {
    state.roulette.finalKey = "";
  }

  elements.rouletteStack.innerHTML = cards
    .map((winner, index) => renderRouletteCard(participants, winner, index, animateToWinner))
    .join("");

  if (animateToWinner && winners[0]) {
    stopAllRouletteLoops();
    state.roulette.finalKey = `${raffle.id}:${winners.map((winner) => winner.participantId).join(",")}`;
    return;
  }

  if (!animateToWinner || !winners[0]) {
    startRouletteLoops(raffleKey, participants.length);
    return;
  }

  stopAllRouletteLoops();
  const finalKey = `${raffle.id}:${winners.map((winner) => winner.participantId).join(",")}`;
  if (state.roulette.finalKey === finalKey) {
    return;
  }
  state.roulette.finalKey = finalKey;
  animateWinnerRoulettes(participants, winners);
}

function renderRouletteCard(participants, winner, index, completed) {
  if (completed && winner) {
    return renderWinnerCard(winner, index);
  }

  const repeated = buildRepeatedParticipants(participants);
  const title = completed && winner ? `Победитель ${winner.place}` : "Розыгрыш";
  const name = completed && winner ? winner.usernameLabel || winner.displayName || "Игрок" : "Список участников";

  return `
    <section class="roulette-card${completed ? " result" : ""}" data-roulette-card="${index}">
      <div class="roulette-card__head">
        <span class="roulette-card__label">${escapeHtml(title)}</span>
        <strong class="roulette-card__winner-name">${escapeHtml(name)}</strong>
      </div>
      <div class="roulette-window${completed ? " awaiting" : ""}" data-roulette-window="${index}">
        <div class="roulette-glow"></div>
        <div class="roulette-fade left"></div>
        <div class="roulette-fade right"></div>
        <div class="roulette-track" data-roulette-track="${index}">
          ${repeated
            .map(
              (participant) => `
                <div class="avatar-bubble" data-participant-id="${escapeHtml(participant.id)}">
                  ${
                    participant.photoUrl
                      ? `<img src="${escapeHtml(participant.photoUrl)}" alt="${escapeHtml(participant.displayName)}" />`
                      : `<span>${escapeHtml(initialsOf(participant.displayName))}</span>`
                  }
                  <small>${escapeHtml(participant.usernameLabel || participant.displayName)}</small>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="roulette-pointer"></div>
        <div class="roulette-center-ring"></div>
      </div>
    </section>
  `;
}

function renderWinnerCard(winner, index) {
  const name = winner.usernameLabel || winner.displayName || "Игрок";
  const amountLabel = winner.prizeAmount
    ? `${formatMoney(winner.prizeAmount)} ${winner.prizeAsset || state.config.payoutAsset || "USDT"}`
    : "";

  return `
    <section class="roulette-card result revealed" data-roulette-card="${index}">
      <div class="roulette-card__head">
        <span class="roulette-card__label">${escapeHtml(`Победитель ${winner.place}`)}</span>
        <strong class="roulette-card__winner-name">${escapeHtml(name)}</strong>
      </div>
      <div class="roulette-window winner-static revealed" data-roulette-window="${index}">
        <div class="roulette-glow"></div>
        <div class="winner-static__content">
          <div class="avatar-bubble winner static" data-participant-id="${escapeHtml(winner.participantId || winner.telegramId || String(index))}">
            ${
              winner.photoUrl
                ? `<img src="${escapeHtml(winner.photoUrl)}" alt="${escapeHtml(winner.displayName || name)}" />`
                : `<span>${escapeHtml(initialsOf(winner.displayName || name))}</span>`
            }
            <small>${escapeHtml(name)}</small>
          </div>
          ${amountLabel ? `<strong class="winner-static__amount">${escapeHtml(amountLabel)}</strong>` : ""}
        </div>
      </div>
    </section>
  `;
}

function buildRepeatedParticipants(participants) {
  const repeated = [];
  for (let index = 0; index < 8; index += 1) {
    for (const participant of participants) {
      repeated.push(participant);
    }
  }
  return repeated;
}

function startRouletteLoops(raffleKey, participantCount) {
  const tracks = Array.from(elements.rouletteStack.querySelectorAll("[data-roulette-track]"));
  const cycleWidth = Math.max(1, participantCount) * ROULETTE_LOOP_BUBBLE_WIDTH;

  for (const value of state.roulette.loops.values()) {
    cancelAnimationFrame(value.frameId);
  }
  state.roulette.loops.clear();

  tracks.forEach((track, index) => {
    const loopKey = `${raffleKey}:${index}`;
    let previousTime = performance.now();
    let offset = index * 28;
    track.style.transition = "none";

    const tick = (now) => {
      const loop = state.roulette.loops.get(loopKey);
      if (!loop) {
        return;
      }

      const delta = now - previousTime;
      previousTime = now;
      offset = (offset + delta * (0.048 + index * 0.004)) % cycleWidth;
      track.style.transform = `translateX(-${offset}px)`;
      loop.frameId = requestAnimationFrame(tick);
    };

    const frameId = requestAnimationFrame(tick);
    state.roulette.loops.set(loopKey, { frameId });
  });
}

function animateWinnerRoulettes(participants, winners) {
  clearTimeout(state.roulette.revealTimerId);
  const cards = Array.from(elements.rouletteStack.querySelectorAll("[data-roulette-card]"));

  winners.forEach((winner, index) => {
    const card = cards[index];
    if (!card) {
      return;
    }

    const track = card.querySelector("[data-roulette-track]");
    const windowEl = card.querySelector("[data-roulette-window]");
    const nodes = Array.from(track.querySelectorAll(".avatar-bubble"));
    const targetIndex = nodes.findIndex(
      (node, nodeIndex) => nodeIndex > participants.length * 3 && node.dataset.participantId === winner.participantId
    );
    const targetNode = nodes[targetIndex];
    if (!targetNode) {
      return;
    }

    const viewportWidth = windowEl.clientWidth;
    const center = targetNode.offsetLeft + targetNode.offsetWidth / 2;
    const transformX = Math.max(0, center - viewportWidth / 2);

    track.style.transition = "none";
    track.style.transform = `translateX(-${34 + index * 10}px)`;
    windowEl.classList.add("awaiting");

    window.setTimeout(() => {
      track.style.transition = `transform ${ROULETTE_STOP_DURATION_MS}ms cubic-bezier(0.12, 0.88, 0.14, 1)`;
      track.style.transform = `translateX(-${transformX}px)`;
    }, index * ROULETTE_STAGGER_MS + 30);
  });

  state.roulette.revealTimerId = window.setTimeout(() => {
    highlightWinnerCards(winners);
  }, ROULETTE_STOP_DURATION_MS + winners.length * ROULETTE_STAGGER_MS + 80);
}

function highlightWinnerCards(winners) {
  const cards = Array.from(elements.rouletteStack.querySelectorAll("[data-roulette-card]"));
  winners.forEach((winner, index) => {
    const card = cards[index];
    if (!card) {
      return;
    }

    const windowEl = card.querySelector("[data-roulette-window]");
    const nodes = Array.from(card.querySelectorAll(".avatar-bubble"));
    const winnerNode = nodes.find((node) => node.dataset.participantId === winner.participantId);
    if (winnerNode) {
      winnerNode.classList.add("winner");
    }
    windowEl.classList.remove("awaiting");
    windowEl.classList.add("revealed");
    card.classList.add("revealed");
  });
}

function stopAllRouletteLoops() {
  clearTimeout(state.roulette.revealTimerId);
  for (const value of state.roulette.loops.values()) {
    cancelAnimationFrame(value.frameId);
  }
  state.roulette.loops.clear();
}

async function onAdminLogin(event) {
  event.preventDefault();
  const password = new FormData(elements.adminLoginForm).get("password");

  try {
    const response = await api("/api/admin/login", {
      method: "POST",
      headers: buildTelegramHeaders(),
      body: JSON.stringify({ password }),
    });
    state.adminToken = response.token;
    localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
    showMessage(elements.adminLoginMessage, "Админка открыта");
    await refreshAll();
  } catch (error) {
    showError(elements.adminLoginMessage, formatAdminError(error.message));
  }
}

async function onBalanceAdminLogin(event) {
  event.preventDefault();
  const password = new FormData(elements.balanceAuthForm).get("password");

  try {
    const response = await api("/api/admin/balance/login", {
      method: "POST",
      headers: buildAdminHeaders(),
      body: JSON.stringify({ password }),
    });
    state.balanceAdminToken = response.token;
    state.balanceAdminAuthorized = true;
    localStorage.setItem(BALANCE_ADMIN_TOKEN_KEY, response.token);
    elements.balanceAuthForm.reset();
    showMessage(elements.balanceAdminMessage, "Доступ к балансам открыт");
    renderAdminVisibility();
  } catch (error) {
    showError(elements.balanceAdminMessage, formatBalanceAdminError(error.message));
  }
}

async function onBalanceAdjust(event) {
  event.preventDefault();
  const form = new FormData(elements.balanceAdjustForm);
  const payload = {
    username: String(form.get("username") || "").trim(),
    operation: String(form.get("operation") || "credit").trim(),
    amount: Number(form.get("amount")),
    note: String(form.get("note") || "").trim(),
  };

  try {
    const response = await api("/api/admin/balance/adjust", {
      method: "POST",
      headers: {
        ...buildAdminHeaders(),
        ...buildBalanceAdminHeaders(),
      },
      body: JSON.stringify(payload),
    });
    state.profile = isCurrentUserProfile(response.profile) ? response.profile : state.profile;
    elements.balanceAdjustForm.reset();
    elements.balanceAdjustForm.querySelector('[name="operation"]').value = "credit";
    showMessage(elements.balanceAdminMessage, response.message || "Баланс обновлен");
    renderProfileVisibility();
    renderProfileSheet();
  } catch (error) {
    if (error.message === "balance_admin_required") {
      localStorage.removeItem(BALANCE_ADMIN_TOKEN_KEY);
      state.balanceAdminToken = "";
      state.balanceAdminAuthorized = false;
      renderAdminVisibility();
    }
    showError(elements.balanceAdminMessage, formatBalanceAdminError(error.message));
  }
}

async function onAdminLogout() {
  try {
    await api("/api/admin/logout", {
      method: "POST",
      headers: {
        ...buildAdminHeaders(),
        ...buildBalanceAdminHeaders(),
      },
    });
  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(BALANCE_ADMIN_TOKEN_KEY);
  state.adminToken = "";
  state.balanceAdminToken = "";
  state.balanceAdminAuthorized = false;
  state.adminUi.panelOpen = false;
  state.adminUi.menuOpen = false;
  state.pendingPaymentRaffleId = "";
  hidePaymentCard();
  hideShareCard();
  await refreshAll();
}

async function onCreateRaffle(event) {
  event.preventDefault();
  const form = new FormData(elements.createRaffleForm);
  const payload = {
    title: String(form.get("title") || "").trim(),
    prizeText: String(form.get("prizeText") || "").trim(),
    prizeAmount: Number(form.get("prizeAmount")),
    winnersCount: Number(form.get("winnersCount")),
    timerMinutes: Number(form.get("timerMinutes")),
  };

  try {
    const response = await api("/api/admin/raffles", {
      method: "POST",
      headers: buildAdminHeaders(),
      body: JSON.stringify(payload),
    });

    elements.createRaffleForm.reset();
    state.currentRaffleSlug = "";
    state.pendingPaymentRaffleId = response.raffle?.status === "pending_payment" ? response.raffle.id : "";
    hideShareCard();
    if (response.raffle?.status === "pending_payment") {
      revealPaymentCard(response.raffle, response.payment);
      showMessage(elements.adminMessage, "Розыгрыш создан, теперь оплати счет");
    } else {
      revealShareCard(response.shareLink);
      showMessage(elements.adminMessage, "Розыгрыш создан");
    }
    await refreshAll();
  } catch (error) {
    showError(elements.adminMessage, formatAdminError(error.message));
  }
}

async function onVerifyPayment() {
  if (!state.pendingPaymentRaffleId) {
    showError(elements.adminMessage, "Нет счета для проверки");
    return;
  }

  await verifyPayment(state.pendingPaymentRaffleId);
}

async function verifyPayment(raffleId) {
  try {
    const response = await api(`/api/admin/raffles/${raffleId}/verify-payment`, {
      method: "POST",
      headers: buildAdminHeaders(),
    });

    if (response.raffle?.status === "active") {
      state.pendingPaymentRaffleId = "";
      hidePaymentCard();
      revealShareCard(response.shareLink);
      showMessage(elements.adminMessage, "Оплата подтверждена, розыгрыш запущен");
    } else {
      state.pendingPaymentRaffleId = raffleId;
      revealPaymentCard(response.raffle, response.payment);
      showMessage(elements.adminMessage, "Счет еще не оплачен");
    }
    await refreshAll();
  } catch (error) {
    showError(elements.adminMessage, formatAdminError(error.message));
  }
}

function revealPaymentCard(raffle, payment) {
  const paymentUrl = getPaymentUrl(payment);
  const asset = payment?.asset || raffle?.prizeAsset || state.config.payoutAsset || "USDT";
  const title = raffle?.title ? `«${raffle.title}»` : "розыгрыш";
  const status = payment?.status ? `Статус: ${translatePaymentStatus(payment.status)}.` : "";
  elements.paymentCard.classList.remove("hidden");
  elements.paymentCardText.textContent = `${title} • ${formatMoney(payment?.amount || raffle?.prizeAmount || 0)} ${asset}. ${status}`;
  elements.payInvoiceButton.href = paymentUrl || "#";
  elements.payInvoiceButton.classList.toggle("disabled", !paymentUrl);
}

function hidePaymentCard() {
  elements.paymentCard.classList.add("hidden");
  elements.payInvoiceButton.href = "#";
  elements.payInvoiceButton.classList.remove("disabled");
}

function revealShareCard(link) {
  if (!link) {
    return;
  }

  elements.shareCard.classList.remove("hidden");
  elements.shareLinkText.textContent = link;
  elements.openLinkButton.href = link;
}

function hideShareCard() {
  elements.shareCard.classList.add("hidden");
  elements.shareLinkText.textContent = "";
  elements.openLinkButton.removeAttribute("href");
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
    showMessage(elements.playerMessage, "Ты в игре");
    await refreshAll();
  } catch (error) {
    showError(elements.playerMessage, formatPlayerError(error.message));
  }
}

async function finalizeRaffle(raffleId) {
  try {
    await api(`/api/admin/raffles/${raffleId}/finalize`, {
      method: "POST",
      headers: buildAdminHeaders(),
    });
    showMessage(elements.adminMessage, "Итоги подведены");
    await refreshAll();
  } catch (error) {
    showError(elements.adminMessage, formatAdminError(error.message));
  }
}

async function onWithdrawSubmit(event) {
  event.preventDefault();
  if (!state.auth.initData) {
    showError(elements.profileMessage, "Открой mini app заново через Telegram");
    return;
  }

  const form = new FormData(elements.withdrawForm);
  const payload = {
    amount: Number(form.get("amount")),
    method: String(form.get("method") || "cryptobot"),
  };

  try {
    const response = await api("/api/profile/withdraw", {
      method: "POST",
      headers: buildTelegramHeaders(),
      body: JSON.stringify(payload),
    });

    state.profile = response.profile || state.profile;
    state.lastWithdrawal = response.withdrawal || null;
    elements.withdrawForm.reset();
    elements.withdrawForm.querySelector('[name="method"]').value = "cryptobot";
    showMessage(elements.profileMessage, "Чек создан");
    renderProfileVisibility();
    renderProfileSheet();
  } catch (error) {
    showError(elements.profileMessage, formatProfileError(error.message));
  }
}

function getViewerParticipant(raffle) {
  return Array.isArray(raffle.participants)
    ? raffle.participants.find((participant) => participant.telegramId === state.auth.telegramId) || null
    : null;
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

function toggleAdminMenu(event) {
  event.stopPropagation();
  if (!state.adminAccess.canAccess) {
    return;
  }

  state.adminUi.menuOpen = !state.adminUi.menuOpen;
  renderAdminVisibility();
}

function toggleAdminPanelView() {
  if (!state.adminAccess.canAccess) {
    return;
  }

  state.adminUi.panelOpen = !state.adminUi.panelOpen;
  state.adminUi.menuOpen = false;
  renderAdminVisibility();
  if (state.adminUi.panelOpen && state.adminToken) {
    renderAdminLists();
  }
}

function openProfileSheet() {
  if (!state.auth.telegramId) {
    return;
  }

  elements.profileSheet.classList.remove("hidden");
}

function closeProfileSheet() {
  elements.profileSheet.classList.add("hidden");
}

function onDocumentClick(event) {
  if (state.adminUi.menuOpen && !elements.adminNav.contains(event.target)) {
    state.adminUi.menuOpen = false;
    renderAdminVisibility();
  }
}

function buildAdminHeaders() {
  return state.adminToken
    ? {
        "X-Admin-Token": state.adminToken,
      }
    : {};
}

function buildBalanceAdminHeaders() {
  return state.balanceAdminToken
    ? {
        "X-Balance-Admin-Token": state.balanceAdminToken,
      }
    : {};
}

function buildTelegramHeaders() {
  return state.auth.initData
    ? {
        "X-Telegram-Init-Data": state.auth.initData,
      }
    : {};
}

function getPaymentUrl(payment) {
  return payment?.miniAppInvoiceUrl || payment?.botInvoiceUrl || payment?.webAppInvoiceUrl || "";
}

function statCard(label, value) {
  return `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function compactBalance(balanceLabel, fallbackAsset) {
  const clean = String(balanceLabel || "").replace(/^Баланс\s+/i, "").trim();
  return clean || `0 ${fallbackAsset || "USDT"}`;
}

function renderAvatarContent(element, fallbackName) {
  if (state.auth.photoUrl) {
    element.innerHTML = `<img src="${escapeHtml(state.auth.photoUrl)}" alt="${escapeHtml(fallbackName)}" />`;
    return;
  }
  element.textContent = initialsOf(fallbackName);
}

function isCurrentUserProfile(profile) {
  return Boolean(profile?.telegramId && profile.telegramId === state.auth.telegramId);
}

function formatTimeLeft(endsAt, status) {
  if (status === "completed") {
    return "Готово";
  }

  if (status === "pending_payment") {
    return "Ждет оплату";
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

function formatMoney(value) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, "");
}

function translatePaymentStatus(status) {
  switch (status) {
    case "paid":
      return "оплачено";
    case "expired":
      return "истек";
    default:
      return "ожидает";
  }
}

function formatAdminError(message) {
  switch (message) {
    case "invalid_password":
      return "Неверный пароль";
    case "admin_forbidden":
      return "Доступа нет";
    case "admin_required":
      return "Войди в админку заново";
    case "prize_amount_required":
      return "Укажи сумму розыгрыша";
    case "invoice_not_paid":
      return "Счет еще не оплачен";
    case "invoice_expired":
      return "Счет истек, создай новый";
    case "crypto_pay_not_configured":
      return "Crypto Pay пока не настроен";
    default:
      return message;
  }
}

function formatBalanceAdminError(message) {
  switch (message) {
    case "balance_invalid_password":
      return "Неверный второй пароль";
    case "balance_admin_required":
      return "Открой доступ к балансам заново";
    case "username_required":
      return "Укажи username";
    case "amount_required":
      return "Укажи сумму";
    case "operation_invalid":
      return "Выбери корректную операцию";
    case "player_not_found":
      return "Пользователь с таким username не найден";
    case "insufficient_balance":
      return "На балансе пользователя не хватает средств";
    default:
      return formatAdminError(message);
  }
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

function formatProfileError(message) {
  switch (message) {
    case "withdraw_amount_required":
      return "Укажи сумму вывода";
    case "withdraw_method_invalid":
      return "Этот способ пока недоступен";
    case "insufficient_balance":
      return "Недостаточно средств на балансе";
    case "crypto_pay_not_configured":
      return "Crypto Pay пока не настроен";
    default:
      return formatPlayerError(message);
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
