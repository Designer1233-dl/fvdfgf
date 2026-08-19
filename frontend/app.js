const ADMIN_TOKEN_KEY = "ilyushka_admin_token";
const BALANCE_ADMIN_TOKEN_KEY = "ilyushka_balance_admin_token";
const CASE_REEL_ITEM_WIDTH = 124;
const CASE_REEL_GAP = 12;

const state = {
  health: {
    config: {
      appName: "Халява от Илюшки",
      payoutAsset: "USDT",
      withdrawalAutoMode: true,
      cases: [],
    },
    admin: {
      authorized: false,
      canAccess: false,
      balanceAuthorized: false,
    },
  },
  auth: {
    initData: "",
    telegramId: "",
    username: "",
    displayName: "",
    photoUrl: "",
  },
  ui: {
    adminMenuOpen: false,
    adminPanelOpen: false,
    profileOpen: false,
    profileHistoryOpen: false,
  },
  adminToken: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  balanceAdminToken: localStorage.getItem(BALANCE_ADMIN_TOKEN_KEY) || "",
  cases: [],
  raffles: [],
  currentRaffleSlug: "",
  currentRaffle: null,
  profile: null,
  dashboard: null,
  pendingRafflePaymentId: "",
  activeDepositId: "",
  lastDeposit: null,
  lastWithdrawal: null,
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
  withdrawalSettingsForm: document.getElementById("withdrawal-settings-form"),
  withdrawalModeSelect: document.getElementById("withdrawal-mode-select"),
  withdrawalSettingsMessage: document.getElementById("withdrawal-settings-message"),
  paymentCard: document.getElementById("payment-card"),
  paymentCardText: document.getElementById("payment-card-text"),
  payInvoiceButton: document.getElementById("pay-invoice-button"),
  verifyPaymentButton: document.getElementById("verify-payment-button"),
  shareCard: document.getElementById("share-card"),
  shareLinkText: document.getElementById("share-link-text"),
  copyLinkButton: document.getElementById("copy-link-button"),
  openLinkButton: document.getElementById("open-link-button"),
  adminMessage: document.getElementById("admin-message"),
  adminCaseHistoryList: document.getElementById("admin-case-history-list"),
  adminWithdrawalsList: document.getElementById("admin-withdrawals-list"),
  adminActiveList: document.getElementById("admin-active-list"),
  adminHistoryList: document.getElementById("admin-history-list"),
  adminOperationsList: document.getElementById("admin-operations-list"),
  casesGrid: document.getElementById("cases-grid"),
  caseMessage: document.getElementById("case-message"),
  raffleTitle: document.getElementById("raffle-title"),
  raffleSubtitle: document.getElementById("raffle-subtitle"),
  playerBadge: document.getElementById("player-badge"),
  playerStatus: document.getElementById("player-status"),
  joinButton: document.getElementById("join-button"),
  emptyProfileButton: document.getElementById("empty-profile-button"),
  playerMessage: document.getElementById("player-message"),
  rouletteStack: document.getElementById("roulette-stack"),
  profileSheet: document.getElementById("profile-sheet"),
  sheetBackdrop: document.getElementById("sheet-backdrop"),
  closeProfileButton: document.getElementById("close-profile-button"),
  profileName: document.getElementById("profile-name"),
  profileSheetAvatar: document.getElementById("profile-sheet-avatar"),
  profileUsernameLabel: document.getElementById("profile-username-label"),
  profileBalanceLabel: document.getElementById("profile-balance-label"),
  depositForm: document.getElementById("deposit-form"),
  verifyDepositButton: document.getElementById("verify-deposit-button"),
  depositResultCard: document.getElementById("deposit-result-card"),
  depositResultText: document.getElementById("deposit-result-text"),
  depositOpenButton: document.getElementById("deposit-open-button"),
  withdrawForm: document.getElementById("withdraw-form"),
  profileMessage: document.getElementById("profile-message"),
  withdrawResultCard: document.getElementById("withdraw-result-card"),
  withdrawResultText: document.getElementById("withdraw-result-text"),
  withdrawOpenButton: document.getElementById("withdraw-open-button"),
  profileHistoryToggle: document.getElementById("profile-history-toggle"),
  profileHistoryCard: document.getElementById("profile-history-card"),
  profileHistoryList: document.getElementById("profile-history-list"),
  caseModal: document.getElementById("case-modal"),
  caseModalBackdrop: document.getElementById("case-modal-backdrop"),
  closeCaseModalButton: document.getElementById("close-case-modal-button"),
  caseModalBadge: document.getElementById("case-modal-badge"),
  caseModalTitle: document.getElementById("case-modal-title"),
  caseReelTrack: document.getElementById("case-reel-track"),
  caseModalResult: document.getElementById("case-modal-result"),
};

boot();

async function boot() {
  initTelegram();
  state.currentRaffleSlug = getRaffleSlugFromLocation();
  bindEvents();
  await refreshAll();
  window.setInterval(refreshAll, 7000);
}

function initTelegram() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    return;
  }

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
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || state.auth.username || "Игрок";
  state.auth.photoUrl = String(user.photo_url || user.photoUrl || "");
}

function getRaffleSlugFromLocation() {
  const url = new URL(window.location.href);
  const direct = url.searchParams.get("raffle") || url.searchParams.get("slug");
  if (direct) {
    return String(direct).trim();
  }
  const startApp = url.searchParams.get("startapp") || "";
  return startApp.startsWith("raffle_") ? startApp.slice(7) : "";
}

function bindEvents() {
  elements.adminMenuButton.addEventListener("click", () => {
    state.ui.adminMenuOpen = !state.ui.adminMenuOpen;
    renderAdminVisibility();
  });
  elements.adminMenuToggle.addEventListener("click", () => {
    state.ui.adminPanelOpen = !state.ui.adminPanelOpen;
    state.ui.adminMenuOpen = false;
    renderAdminVisibility();
  });
  elements.profileButton.addEventListener("click", openProfileSheet);
  elements.sheetBackdrop.addEventListener("click", closeProfileSheet);
  elements.closeProfileButton.addEventListener("click", closeProfileSheet);
  elements.profileHistoryToggle.addEventListener("click", () => {
    state.ui.profileHistoryOpen = !state.ui.profileHistoryOpen;
    renderProfileSheet();
  });
  elements.caseModalBackdrop.addEventListener("click", closeCaseModal);
  elements.closeCaseModalButton.addEventListener("click", closeCaseModal);
  elements.adminLoginForm.addEventListener("submit", onAdminLogin);
  elements.adminLogout.addEventListener("click", onAdminLogout);
  elements.createRaffleForm.addEventListener("submit", onCreateRaffle);
  elements.balanceAuthForm.addEventListener("submit", onBalanceAdminLogin);
  elements.balanceAdjustForm.addEventListener("submit", onBalanceAdjust);
  elements.withdrawalSettingsForm.addEventListener("submit", onWithdrawalSettingsSubmit);
  elements.verifyPaymentButton.addEventListener("click", () => verifyRafflePayment(state.pendingRafflePaymentId));
  elements.copyLinkButton.addEventListener("click", copyShareLink);
  elements.joinButton.addEventListener("click", joinCurrentRaffle);
  elements.emptyProfileButton.addEventListener("click", openProfileSheet);
  elements.depositForm.addEventListener("submit", onDepositSubmit);
  elements.verifyDepositButton.addEventListener("click", onVerifyDeposit);
  elements.withdrawForm.addEventListener("submit", onWithdrawSubmit);
  document.addEventListener("click", onDocumentClick);
}

async function refreshAll() {
  try {
    const raffleUrl = state.currentRaffleSlug
      ? `/api/raffles/slug/${encodeURIComponent(state.currentRaffleSlug)}`
      : "/api/raffles";
    const requests = [
      api("/api/health", { headers: buildCommonHeaders() }),
      api("/api/cases"),
      api(raffleUrl).catch((error) => {
        if (error.message === "raffle_not_found") {
          return state.currentRaffleSlug ? { raffle: null } : { raffles: [] };
        }
        throw error;
      }),
    ];

    if (state.auth.initData) {
      requests.push(api("/api/profile", { headers: buildTelegramHeaders() }));
    } else {
      requests.push(Promise.resolve({ profile: null }));
    }

    if (state.adminToken) {
      requests.push(api("/api/admin/dashboard", { headers: buildAdminHeaders() }).catch(handleAdminDashboardError));
    } else {
      requests.push(Promise.resolve(null));
    }

    const [health, casesPayload, rafflePayload, profilePayload, dashboardPayload] = await Promise.all(requests);
    state.health = health;
    state.cases = Array.isArray(casesPayload?.cases) ? casesPayload.cases : health.config?.cases || [];
    state.profile = profilePayload?.profile || null;
    state.dashboard = dashboardPayload;
    state.currentRaffle = state.currentRaffleSlug
      ? rafflePayload?.raffle || null
      : pickFeaturedRaffle(rafflePayload?.raffles || []);
    state.raffles = state.currentRaffleSlug
      ? state.currentRaffle
        ? [state.currentRaffle]
        : []
      : Array.isArray(rafflePayload?.raffles)
        ? rafflePayload.raffles
        : [];

    syncPendingDepositFromProfile();
    render();
  } catch (error) {
    console.error(error);
  }
}

function handleAdminDashboardError(error) {
  if (error.status === 401) {
    clearAdminTokens();
    return null;
  }
  throw error;
}

function render() {
  elements.landingTitle.textContent = state.health.config?.appName || "Халява от Илюшки";
  elements.landingSubtitle.textContent =
    "Кейсы теперь на первом месте: открывай, пополняй баланс через CryptoBot и ниже залетай в розыгрыши.";
  renderAdminVisibility();
  renderProfileVisibility();
  renderCases();
  renderCurrentRaffle();
  renderProfileSheet();
  renderAdminDashboard();
}

function renderAdminVisibility() {
  const admin = state.health.admin || {};
  const canAccess = Boolean(admin.canAccess);
  const authorized = Boolean(state.adminToken && admin.authorized);
  const balanceAuthorized = Boolean(admin.balanceAuthorized);
  const showPanel = canAccess && state.ui.adminPanelOpen;

  elements.adminNav.classList.toggle("hidden", !canAccess);
  elements.adminMenuPanel.classList.toggle("hidden", !canAccess || !state.ui.adminMenuOpen);
  elements.adminMenuButton.classList.toggle("active", canAccess && state.ui.adminMenuOpen);
  elements.adminMenuToggle.textContent = showPanel ? "Вернуться к играм" : "Открыть админку";
  elements.adminLoginCard.classList.toggle("hidden", !showPanel || authorized);
  elements.adminPanel.classList.toggle("hidden", !showPanel || !authorized);
  elements.balanceLockCard.classList.toggle("hidden", !authorized || balanceAuthorized);
  elements.balanceAdjustForm.classList.toggle("hidden", !authorized || !balanceAuthorized);
  elements.withdrawalSettingsForm.classList.toggle("hidden", !authorized || !balanceAuthorized);
  if (elements.withdrawalModeSelect && state.dashboard?.settings) {
    elements.withdrawalModeSelect.value = String(Boolean(state.dashboard.settings.autoMode));
  }
}

function renderProfileVisibility() {
  const canShow = Boolean(state.auth.initData);
  elements.profileNav.classList.toggle("hidden", !canShow);
  if (!canShow) {
    state.ui.profileOpen = false;
    elements.profileSheet.classList.add("hidden");
    return;
  }

  renderAvatar(elements.profileAvatar, state.auth.photoUrl, state.auth.displayName);
  elements.profileBalanceChip.textContent = state.profile?.balanceLabel || `0 ${state.health.config?.payoutAsset || "USDT"}`;
}

function renderCases() {
  const canOpen = Boolean(state.auth.initData);
  const balance = Number(state.profile?.balance || 0);

  elements.casesGrid.innerHTML = state.cases
    .map((caseItem) => {
      const disabled = !canOpen || balance < caseItem.price;
      const rewardPreview = caseItem.rewards
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map(
          (reward) =>
            `<span class="reward-pill ${escapeHtml(reward.rarity)}">${escapeHtml(reward.label)} • ${formatMoney(reward.amount)} ${escapeHtml(reward.asset)}</span>`
        )
        .join("");

      return `
        <article class="case-card" style="--case-accent:${escapeHtml(caseItem.accent)};--case-accent-soft:${escapeHtml(caseItem.accentSoft)}">
          <div class="case-card__top">
            <span class="case-badge">${escapeHtml(caseItem.badge)}</span>
            <span class="case-price">${formatMoney(caseItem.price)} ${escapeHtml(caseItem.asset)}</span>
          </div>
          <h3>${escapeHtml(caseItem.title)}</h3>
          <p>${escapeHtml(caseItem.subtitle)}</p>
          <div class="case-meta">
            <strong>До ${formatMoney(caseItem.topReward)} ${escapeHtml(caseItem.asset)}</strong>
            <span>Редкий дроп с маленьким шансом</span>
          </div>
          <div class="reward-row">${rewardPreview}</div>
          <button class="primary ${disabled ? "disabled" : ""}" type="button" data-action="open-case" data-case-id="${escapeHtml(caseItem.id)}">
            ${canOpen ? "Открыть кейс" : "Нужен Telegram"}
          </button>
        </article>
      `;
    })
    .join("");
}

function renderCurrentRaffle() {
  const raffle = state.currentRaffle;
  const hasProfile = Boolean(state.auth.initData);
  elements.playerBadge.classList.toggle("hidden", !raffle);

  if (!raffle) {
    elements.raffleTitle.textContent = "Розыгрыши Илюшки";
    elements.raffleSubtitle.textContent = "Активный розыгрыш появится здесь сразу после оплаты счета админом.";
    elements.playerStatus.innerHTML = buildStatsMarkup([
      ["Статус", "Ожидание"],
      ["Приз", `0 ${state.health.config?.payoutAsset || "USDT"}`],
    ]);
    elements.joinButton.classList.add("hidden");
    elements.emptyProfileButton.classList.toggle("hidden", hasProfile);
    elements.rouletteStack.innerHTML = "";
    return;
  }

  elements.raffleTitle.textContent = raffle.title;
  elements.raffleSubtitle.textContent = `${raffle.prizeText} • до конца ${formatCountdown(raffle.endsAt)}.`;
  elements.playerStatus.innerHTML = buildStatsMarkup([
    ["Приз", `${formatMoney(raffle.prizeAmount)} ${raffle.prizeAsset}`],
    ["Участников", String(raffle.participantCount || 0)],
    ["Победителей", String(raffle.winnersCount || 0)],
    ["Шанс", `${formatMoney(raffle.chancePercent || 0)}%`],
  ]);
  elements.joinButton.classList.toggle("hidden", !hasProfile || raffle.status !== "active");
  elements.emptyProfileButton.classList.toggle("hidden", hasProfile);
  elements.joinButton.textContent = raffle.status === "completed" ? "Розыгрыш завершен" : "Вступить в розыгрыш";
  elements.joinButton.disabled = raffle.status !== "active";

  if (raffle.status === "completed" && Array.isArray(raffle.winners) && raffle.winners.length) {
    elements.rouletteStack.innerHTML = raffle.winners
      .map(
        (winner) => `
          <article class="list-card winner-card">
            <div class="list-row">
              <div>
                <strong>Победитель ${winner.place}</strong>
                <span>${escapeHtml(winner.usernameLabel || winner.displayName || "Игрок")}</span>
              </div>
              <strong>${formatMoney(winner.prizeAmount)} ${escapeHtml(winner.prizeAsset)}</strong>
            </div>
          </article>
        `
      )
      .join("");
  } else {
    elements.rouletteStack.innerHTML = "";
  }
}

function renderProfileSheet() {
  const profile = state.profile;
  elements.profileSheet.classList.toggle("hidden", !state.ui.profileOpen);

  if (!profile) {
    elements.profileName.textContent = state.auth.displayName || "Игрок";
    elements.profileUsernameLabel.textContent = state.auth.username ? `@${state.auth.username}` : "Без username";
    elements.profileBalanceLabel.textContent = `Баланс 0 ${state.health.config?.payoutAsset || "USDT"}`;
    renderAvatar(elements.profileSheetAvatar, state.auth.photoUrl, state.auth.displayName);
    elements.profileHistoryCard.classList.toggle("hidden", !state.ui.profileHistoryOpen);
    elements.profileHistoryList.innerHTML = `<article class="list-card"><span>История появится после первых действий.</span></article>`;
    return;
  }

  elements.profileName.textContent = profile.displayName || state.auth.displayName || "Игрок";
  elements.profileUsernameLabel.textContent = profile.usernameLabel || "Без username";
  elements.profileBalanceLabel.textContent = profile.balanceLabel;
  renderAvatar(elements.profileSheetAvatar, profile.photoUrl || state.auth.photoUrl, profile.displayName || state.auth.displayName);

  const deposit = findPendingDeposit(profile);
  state.activeDepositId = deposit?.id || "";
  state.lastDeposit = deposit || state.lastDeposit;
  elements.depositResultCard.classList.toggle("hidden", !deposit);
  if (deposit) {
    elements.depositResultText.textContent = `${formatMoney(deposit.amount)} ${deposit.asset} • статус ${formatStatus(deposit.status)}`;
    elements.depositOpenButton.href = pickPaymentLink(deposit.payment);
  }

  const withdrawal = profile.recentWithdrawals?.[0] || state.lastWithdrawal;
  elements.withdrawResultCard.classList.toggle("hidden", !withdrawal);
  if (withdrawal) {
    elements.withdrawResultText.textContent = buildWithdrawalText(withdrawal);
    elements.withdrawOpenButton.classList.toggle("hidden", !withdrawal.checkUrl);
    elements.withdrawOpenButton.href = withdrawal.checkUrl || "#";
  }

  elements.profileHistoryCard.classList.toggle("hidden", !state.ui.profileHistoryOpen);
  elements.profileHistoryList.innerHTML = buildProfileHistory(profile);
}

function buildProfileHistory(profile) {
  const items = [];

  for (const entry of profile.recentCaseOpens || []) {
    items.push({
      id: `case_${entry.id}`,
      createdAt: entry.createdAt,
      title: entry.caseTitle,
      subtitle: `${entry.rewardLabel} • ${formatMoney(entry.rewardAmount)} ${entry.asset}`,
      side: `${entry.net >= 0 ? "+" : ""}${formatMoney(entry.net)} ${entry.asset}`,
      kind: entry.net >= 0 ? "win" : "lose",
    });
  }

  for (const entry of profile.recentDeposits || []) {
    items.push({
      id: `deposit_${entry.id}`,
      createdAt: entry.createdAt,
      title: "Пополнение",
      subtitle: `${formatStatus(entry.status)} • ${formatMoney(entry.amount)} ${entry.asset}`,
      side: `+${formatMoney(entry.amount)} ${entry.asset}`,
      kind: "win",
    });
  }

  for (const entry of profile.recentWithdrawals || []) {
    items.push({
      id: `withdraw_${entry.id}`,
      createdAt: entry.createdAt,
      title: "Вывод",
      subtitle: formatStatus(entry.status),
      side: `-${formatMoney(entry.amount)} ${entry.asset}`,
      kind: entry.status === "rejected" ? "lose" : "",
    });
  }

  for (const entry of profile.recentTransactions || []) {
    items.push({
      id: `tx_${entry.id}`,
      createdAt: entry.createdAt,
      title: formatTransactionType(entry.type),
      subtitle: entry.note || entry.raffleTitle || entry.caseTitle || "Операция по балансу",
      side: `${entry.amount > 0 ? "+" : ""}${formatMoney(entry.amount)} ${entry.asset || profile.payoutAsset}`,
      kind: entry.amount > 0 ? "win" : entry.amount < 0 ? "lose" : "",
    });
  }

  const rows = dedupeById(items)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 18);

  if (!rows.length) {
    return `<article class="list-card"><span>История появится после первых действий.</span></article>`;
  }

  return rows
    .map(
      (item) => `
        <article class="list-card">
          <div class="list-row">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.subtitle)}</span>
            </div>
            <div class="list-side">
              <strong class="${escapeHtml(item.kind)}">${escapeHtml(item.side)}</strong>
              <span>${escapeHtml(formatDateTime(item.createdAt))}</span>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminDashboard() {
  if (!state.dashboard) {
    return;
  }

  elements.adminCaseHistoryList.innerHTML = renderCaseHistoryList(state.dashboard.caseHistory || []);
  elements.adminWithdrawalsList.innerHTML = renderAdminWithdrawals(state.dashboard.withdrawals || []);
  elements.adminActiveList.innerHTML = renderAdminRaffles((state.dashboard.raffles || []).filter((item) => item.status !== "completed"));
  elements.adminHistoryList.innerHTML = renderAdminRaffles((state.dashboard.raffles || []).filter((item) => item.status === "completed"));
  elements.adminOperationsList.innerHTML = renderAdminOperations(state.dashboard.playerOperations || []);
  elements.withdrawalModeSelect.value = String(Boolean(state.dashboard.settings?.autoMode));
}

function renderCaseHistoryList(items) {
  if (!items.length) {
    return `<article class="list-card"><span>Открытий кейсов пока нет.</span></article>`;
  }

  return items
    .slice(0, 24)
    .map(
      (entry) => `
        <article class="list-card">
          <div class="list-row">
            <div>
              <strong>${escapeHtml(entry.caseTitle)}</strong>
              <span>${escapeHtml(entry.usernameLabel || entry.displayName || "Игрок")} • ${escapeHtml(entry.rewardLabel)}</span>
            </div>
            <div class="list-side">
              <strong class="${entry.net >= 0 ? "win" : "lose"}">${entry.net >= 0 ? "+" : ""}${formatMoney(entry.net)} ${escapeHtml(entry.asset)}</strong>
              <span>${escapeHtml(formatDateTime(entry.createdAt))}</span>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminWithdrawals(items) {
  if (!items.length) {
    return `<article class="list-card"><span>Заявок на вывод пока нет.</span></article>`;
  }

  return items
    .slice(0, 30)
    .map((item) => {
      const actions =
        item.status === "pending_review"
          ? `
            <div class="list-actions">
              <button class="primary" type="button" data-action="approve-withdrawal" data-withdrawal-id="${escapeHtml(item.id)}">Подтвердить</button>
              <button class="secondary" type="button" data-action="reject-withdrawal" data-withdrawal-id="${escapeHtml(item.id)}">Отклонить</button>
            </div>
          `
          : item.checkUrl
            ? `<div class="list-actions"><a class="secondary" href="${escapeAttribute(item.checkUrl)}" target="_blank" rel="noreferrer">Открыть чек</a></div>`
            : "";

      return `
        <article class="list-card">
          <div class="list-row">
            <div>
              <strong>${escapeHtml(item.usernameLabel || item.displayName || "Игрок")}</strong>
              <span>${escapeHtml(formatStatus(item.status))} • ${escapeHtml(item.providerLabel || "CryptoBot")}</span>
            </div>
            <div class="list-side">
              <strong>${formatMoney(item.amount)} ${escapeHtml(item.asset)}</strong>
              <span>${escapeHtml(formatDateTime(item.createdAt))}</span>
            </div>
          </div>
          ${item.reviewReason ? `<p class="admin-inline-note">${escapeHtml(item.reviewReason)}</p>` : ""}
          ${actions}
        </article>
      `;
    })
    .join("");
}

function renderAdminRaffles(items) {
  if (!items.length) {
    return `<article class="list-card"><span>Пока пусто.</span></article>`;
  }

  return items
    .slice(0, 24)
    .map((raffle) => {
      const paymentLink = pickPaymentLink(raffle.payment);
      const verifyAction =
        raffle.status === "pending_payment"
          ? `
            <div class="list-actions">
              ${paymentLink ? `<a class="secondary" href="${escapeAttribute(paymentLink)}" target="_blank" rel="noreferrer">Открыть счет</a>` : ""}
              <button class="primary" type="button" data-action="verify-raffle-payment" data-raffle-id="${escapeHtml(raffle.id)}">Проверить оплату</button>
            </div>
          `
          : "";
      const finalizeAction =
        raffle.status === "active"
          ? `<div class="list-actions"><button class="secondary" type="button" data-action="finalize-raffle" data-raffle-id="${escapeHtml(raffle.id)}">Завершить сейчас</button></div>`
          : "";
      const shareAction =
        raffle.shareLink
          ? `<div class="list-actions"><a class="secondary" href="${escapeAttribute(raffle.shareLink)}" target="_blank" rel="noreferrer">Открыть ссылку</a></div>`
          : "";

      return `
        <article class="list-card">
          <div class="list-row">
            <div>
              <strong>${escapeHtml(raffle.title)}</strong>
              <span>${escapeHtml(raffle.prizeText)} • ${escapeHtml(formatStatus(raffle.status))}</span>
            </div>
            <div class="list-side">
              <strong>${formatMoney(raffle.prizeAmount)} ${escapeHtml(raffle.prizeAsset)}</strong>
              <span>${escapeHtml(formatDateTime(raffle.createdAt))}</span>
            </div>
          </div>
          <p class="admin-inline-note">Участников: ${raffle.participantCount || 0} • Победителей: ${raffle.winnersCount || 0}</p>
          ${verifyAction}
          ${finalizeAction}
          ${shareAction}
        </article>
      `;
    })
    .join("");
}

function renderAdminOperations(items) {
  if (!items.length) {
    return `<article class="list-card"><span>Операций игроков пока нет.</span></article>`;
  }

  return items
    .slice(0, 40)
    .map(
      (item) => `
        <article class="list-card">
          <div class="list-row">
            <div>
              <strong>${escapeHtml(item.usernameLabel || item.displayName || "Игрок")}</strong>
              <span>${escapeHtml(formatTransactionType(item.type))}${item.note ? ` • ${escapeHtml(item.note)}` : ""}</span>
            </div>
            <div class="list-side">
              <strong class="${item.amount > 0 ? "win" : item.amount < 0 ? "lose" : ""}">${item.amount > 0 ? "+" : ""}${formatMoney(item.amount)} ${escapeHtml(item.asset)}</strong>
              <span>${escapeHtml(formatDateTime(item.createdAt))}</span>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

async function onAdminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const payload = await api("/api/admin/login", {
      method: "POST",
      headers: buildTelegramHeaders(),
      body: { password: String(form.get("password") || "") },
    });
    state.adminToken = payload.token || "";
    localStorage.setItem(ADMIN_TOKEN_KEY, state.adminToken);
    showMessage(elements.adminLoginMessage, "Доступ открыт.", "win");
    await refreshAll();
  } catch (error) {
    showMessage(elements.adminLoginMessage, formatError(error.message), "error");
  }
}

async function onAdminLogout() {
  try {
    await api("/api/admin/logout", {
      method: "POST",
      headers: buildCommonHeaders(),
    });
  } catch (error) {
    console.error(error);
  }

  clearAdminTokens();
  state.dashboard = null;
  render();
}

async function onCreateRaffle(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const payload = await api("/api/admin/raffles", {
      method: "POST",
      headers: buildAdminHeaders(),
      body: {
        title: String(form.get("title") || ""),
        prizeText: String(form.get("prizeText") || ""),
        prizeAmount: Number(form.get("prizeAmount") || 0),
        winnersCount: Number(form.get("winnersCount") || 1),
        timerMinutes: Number(form.get("timerMinutes") || 60),
      },
    });
    state.pendingRafflePaymentId = payload.raffle?.id || "";
    renderRafflePaymentCard(payload.payment, payload.raffle);
    showMessage(elements.adminMessage, "Счет создан. Розыгрыш включится только после оплаты.", "win");
    event.currentTarget.reset();
    await refreshAll();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function onBalanceAdminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const payload = await api("/api/admin/balance/login", {
      method: "POST",
      headers: buildAdminHeaders(),
      body: { password: String(form.get("password") || "") },
    });
    state.balanceAdminToken = payload.token || "";
    localStorage.setItem(BALANCE_ADMIN_TOKEN_KEY, state.balanceAdminToken);
    showMessage(elements.balanceAdminMessage, "Доступ к балансам и выводам открыт.", "win");
    await refreshAll();
  } catch (error) {
    showMessage(elements.balanceAdminMessage, formatError(error.message), "error");
  }
}

async function onBalanceAdjust(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const payload = await api("/api/admin/balance/adjust", {
      method: "POST",
      headers: buildCommonHeaders(),
      body: {
        username: String(form.get("username") || ""),
        operation: String(form.get("operation") || ""),
        amount: Number(form.get("amount") || 0),
        note: String(form.get("note") || ""),
      },
    });
    showMessage(
      elements.balanceAdminMessage,
      `${payload.player?.usernameLabel || "Игрок"}: баланс ${payload.player?.balanceLabel || ""}`,
      "win"
    );
    event.currentTarget.reset();
    await refreshAll();
  } catch (error) {
    showMessage(elements.balanceAdminMessage, formatError(error.message), "error");
  }
}

async function onWithdrawalSettingsSubmit(event) {
  event.preventDefault();

  try {
    const payload = await api("/api/admin/withdrawals/settings", {
      method: "POST",
      headers: buildCommonHeaders(),
      body: { autoMode: elements.withdrawalModeSelect.value === "true" },
    });
    state.dashboard = { ...(state.dashboard || {}), settings: payload.settings };
    showMessage(
      elements.withdrawalSettingsMessage,
      payload.settings?.autoMode ? "Автовывод включен." : "Выводы теперь подтверждаются вручную.",
      "win"
    );
    await refreshAll();
  } catch (error) {
    showMessage(elements.withdrawalSettingsMessage, formatError(error.message), "error");
  }
}

async function onDepositSubmit(event) {
  event.preventDefault();
  if (!ensureTelegramProfile(elements.profileMessage)) {
    return;
  }

  const form = new FormData(event.currentTarget);
  try {
    const payload = await api("/api/profile/deposit", {
      method: "POST",
      headers: buildTelegramHeaders(),
      body: {
        amount: Number(form.get("amount") || 0),
        initData: state.auth.initData,
      },
    });
    state.profile = payload.profile;
    state.lastDeposit = payload.deposit;
    state.activeDepositId = payload.deposit?.id || "";
    showMessage(elements.profileMessage, "Счет на пополнение создан. После оплаты нажми проверить.", "win");
    render();
  } catch (error) {
    showMessage(elements.profileMessage, formatError(error.message), "error");
  }
}

async function onVerifyDeposit() {
  if (!state.activeDepositId) {
    showMessage(elements.profileMessage, "Сначала создай счет на пополнение.", "error");
    return;
  }

  try {
    const payload = await api(`/api/profile/deposit/${encodeURIComponent(state.activeDepositId)}/verify`, {
      method: "POST",
      headers: buildTelegramHeaders(),
      body: { initData: state.auth.initData },
    });
    state.profile = payload.profile;
    state.lastDeposit = payload.deposit;
    if (payload.deposit?.status === "paid") {
      state.activeDepositId = "";
    }
    showMessage(
      elements.profileMessage,
      payload.deposit?.status === "paid" ? "Пополнение подтверждено и зачислено." : "Оплата еще не найдена.",
      payload.deposit?.status === "paid" ? "win" : "error"
    );
    render();
  } catch (error) {
    showMessage(elements.profileMessage, formatError(error.message), "error");
  }
}

async function onWithdrawSubmit(event) {
  event.preventDefault();
  if (!ensureTelegramProfile(elements.profileMessage)) {
    return;
  }

  const form = new FormData(event.currentTarget);
  try {
    const payload = await api("/api/profile/withdraw", {
      method: "POST",
      headers: buildTelegramHeaders(),
      body: {
        amount: Number(form.get("amount") || 0),
        method: String(form.get("method") || "cryptobot"),
        initData: state.auth.initData,
      },
    });
    state.profile = payload.profile;
    state.lastWithdrawal = payload.withdrawal;
    showMessage(elements.profileMessage, "Заявка на вывод обработана.", "win");
    render();
  } catch (error) {
    showMessage(elements.profileMessage, formatError(error.message), "error");
  }
}

async function joinCurrentRaffle() {
  if (!ensureTelegramProfile(elements.playerMessage)) {
    return;
  }
  if (!state.currentRaffle?.slug) {
    showMessage(elements.playerMessage, "Активный розыгрыш пока не найден.", "error");
    return;
  }

  try {
    const payload = await api(`/api/raffles/slug/${encodeURIComponent(state.currentRaffle.slug)}/join`, {
      method: "POST",
      body: { initData: state.auth.initData },
    });
    state.currentRaffle = payload.raffle;
    showMessage(elements.playerMessage, "Ты в розыгрыше. Удачи!", "win");
    renderCurrentRaffle();
  } catch (error) {
    showMessage(elements.playerMessage, formatError(error.message), "error");
  }
}

async function verifyRafflePayment(raffleId) {
  if (!raffleId) {
    showMessage(elements.adminMessage, "Нет счета для проверки.", "error");
    return;
  }

  try {
    const payload = await api(`/api/admin/raffles/${encodeURIComponent(raffleId)}/verify-payment`, {
      method: "POST",
      headers: buildAdminHeaders(),
    });
    state.pendingRafflePaymentId = payload.raffle?.status === "pending_payment" ? raffleId : "";
    renderRafflePaymentCard(payload.payment, payload.raffle);
    if (payload.shareLink) {
      renderShareCard(payload.shareLink);
      showMessage(elements.adminMessage, "Оплата подтверждена. Розыгрыш активирован.", "win");
    } else {
      showMessage(elements.adminMessage, "Оплата еще не найдена.", "error");
    }
    await refreshAll();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function finalizeRaffleNow(raffleId) {
  try {
    await api(`/api/admin/raffles/${encodeURIComponent(raffleId)}/finalize`, {
      method: "POST",
      headers: buildAdminHeaders(),
    });
    showMessage(elements.adminMessage, "Розыгрыш завершен и призы начислены.", "win");
    await refreshAll();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function openCase(caseId) {
  if (!ensureTelegramProfile(elements.caseMessage)) {
    return;
  }

  try {
    const payload = await api(`/api/cases/${encodeURIComponent(caseId)}/open`, {
      method: "POST",
      headers: buildTelegramHeaders(),
      body: { initData: state.auth.initData },
    });
    state.profile = payload.profile;
    showMessage(elements.caseMessage, "Кейс открыт. Выигрыш уже зачислен на баланс.", "win");
    playCaseAnimation(payload.result);
    render();
  } catch (error) {
    showMessage(elements.caseMessage, formatError(error.message), "error");
  }
}

async function approveWithdrawal(withdrawalId) {
  try {
    await api(`/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/approve`, {
      method: "POST",
      headers: buildCommonHeaders(),
    });
    showMessage(elements.adminMessage, "Вывод подтвержден.", "win");
    await refreshAll();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function rejectWithdrawal(withdrawalId) {
  const reason = window.prompt("Причина отказа");
  if (reason === null) {
    return;
  }

  try {
    await api(`/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/reject`, {
      method: "POST",
      headers: buildCommonHeaders(),
      body: { reason },
    });
    showMessage(elements.adminMessage, "Вывод отклонен, деньги возвращены игроку.", "win");
    await refreshAll();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

function onDocumentClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  if (action === "open-case") {
    openCase(target.dataset.caseId || "");
  } else if (action === "verify-raffle-payment") {
    verifyRafflePayment(target.dataset.raffleId || "");
  } else if (action === "finalize-raffle") {
    finalizeRaffleNow(target.dataset.raffleId || "");
  } else if (action === "approve-withdrawal") {
    approveWithdrawal(target.dataset.withdrawalId || "");
  } else if (action === "reject-withdrawal") {
    rejectWithdrawal(target.dataset.withdrawalId || "");
  }
}

function playCaseAnimation(result) {
  if (!result) {
    return;
  }

  const roll = Array.isArray(result.recentRoll) ? result.recentRoll : [];
  elements.caseModal.classList.remove("hidden");
  elements.caseModalBadge.textContent = result.case?.badge || "Кейс";
  elements.caseModalTitle.textContent = result.case?.title || "Открытие кейса";
  elements.caseModalResult.className = "message hidden";
  elements.caseReelTrack.style.transition = "none";
  elements.caseReelTrack.style.transform = "translate3d(0,0,0)";
  elements.caseReelTrack.innerHTML = roll
    .map(
      (item) => `
        <div class="case-reel-item">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${formatMoney(item.amount)} ${escapeHtml(item.asset)}</span>
        </div>
      `
    )
    .join("");

  const winnerIndex = Math.max(0, roll.length - 9);
  const offset = -winnerIndex * (CASE_REEL_ITEM_WIDTH + CASE_REEL_GAP);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      elements.caseReelTrack.style.transition = "transform 4.6s cubic-bezier(0.08, 0.7, 0.15, 1)";
      elements.caseReelTrack.style.transform = `translate3d(${offset}px,0,0)`;
    });
  });

  window.setTimeout(() => {
    const tone = result.reward?.net >= 0 ? "message win" : "message lose";
    elements.caseModalResult.className = tone;
    elements.caseModalResult.textContent = `${result.reward?.label || "Выигрыш"} • ${formatMoney(result.reward?.amount || 0)} ${result.reward?.asset || state.health.config?.payoutAsset || "USDT"} (${result.reward?.net >= 0 ? "+" : ""}${formatMoney(result.reward?.net || 0)})`;
  }, 4800);
}

function openProfileSheet() {
  if (!state.auth.initData) {
    return;
  }
  state.ui.profileOpen = true;
  renderProfileSheet();
}

function closeProfileSheet() {
  state.ui.profileOpen = false;
  renderProfileSheet();
}

function closeCaseModal() {
  elements.caseModal.classList.add("hidden");
}

function renderRafflePaymentCard(payment, raffle) {
  if (!payment) {
    elements.paymentCard.classList.add("hidden");
    return;
  }
  elements.paymentCard.classList.remove("hidden");
  elements.paymentCardText.textContent = `${raffle?.title || "Розыгрыш"} • ${formatMoney(payment.amount)} ${payment.asset} • ${formatStatus(payment.status)}`;
  elements.payInvoiceButton.href = pickPaymentLink(payment) || "#";
}

function renderShareCard(link) {
  if (!link) {
    elements.shareCard.classList.add("hidden");
    return;
  }
  elements.shareCard.classList.remove("hidden");
  elements.shareLinkText.textContent = link;
  elements.openLinkButton.href = link;
}

async function copyShareLink() {
  const text = elements.shareLinkText.textContent || "";
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showMessage(elements.adminMessage, "Ссылка скопирована.", "win");
  } catch (error) {
    showMessage(elements.adminMessage, "Не удалось скопировать ссылку.", "error");
  }
}

function syncPendingDepositFromProfile() {
  const deposit = findPendingDeposit(state.profile);
  if (deposit) {
    state.activeDepositId = deposit.id;
    state.lastDeposit = deposit;
  }
}

function findPendingDeposit(profile) {
  return profile?.recentDeposits?.find((item) => item.status === "pending") || null;
}

function pickFeaturedRaffle(items) {
  return items.find((item) => item.status === "active") || items[0] || null;
}

function buildStatsMarkup(items) {
  return items
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");
}

function buildWithdrawalText(withdrawal) {
  return withdrawal.reviewReason
    ? `${formatMoney(withdrawal.amount)} ${withdrawal.asset} • ${formatStatus(withdrawal.status)} • ${withdrawal.reviewReason}`
    : `${formatMoney(withdrawal.amount)} ${withdrawal.asset} • ${formatStatus(withdrawal.status)}`;
}

function buildAdminHeaders() {
  return state.adminToken ? { "x-admin-token": state.adminToken } : {};
}

function buildBalanceAdminHeaders() {
  return state.balanceAdminToken ? { "x-balance-admin-token": state.balanceAdminToken } : {};
}

function buildTelegramHeaders() {
  return state.auth.initData ? { "x-telegram-init-data": state.auth.initData } : {};
}

function buildCommonHeaders() {
  return {
    ...buildAdminHeaders(),
    ...buildBalanceAdminHeaders(),
    ...buildTelegramHeaders(),
  };
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || "request_failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function ensureTelegramProfile(element) {
  if (state.auth.initData) {
    return true;
  }
  showMessage(element, "Открой mini app внутри Telegram, чтобы играть и выводить баланс.", "error");
  return false;
}

function showMessage(element, text, tone = "") {
  element.textContent = text;
  element.className = `message ${tone}`.trim();
  element.classList.remove("hidden");
}

function clearAdminTokens() {
  state.adminToken = "";
  state.balanceAdminToken = "";
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(BALANCE_ADMIN_TOKEN_KEY);
}

function renderAvatar(element, photoUrl, displayName) {
  if (photoUrl) {
    element.innerHTML = `<img src="${escapeAttribute(photoUrl)}" alt="${escapeAttribute(displayName || "Игрок")}" />`;
  } else {
    element.textContent = getInitials(displayName || "Игрок");
  }
}

function getInitials(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join("") || "IG";
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return number.toFixed(number % 1 === 0 ? 0 : 2);
}

function formatDateTime(value) {
  if (!value) {
    return "сейчас";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "сейчас";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCountdown(value) {
  if (!value) {
    return "без таймера";
  }
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) {
    return "таймер вышел";
  }
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

function formatStatus(status) {
  const map = {
    pending: "ожидает оплаты",
    pending_payment: "ожидает оплаты",
    active: "активен",
    completed: "завершен",
    paid: "оплачен",
    issued: "чек выдан",
    mock_issued: "чек создан",
    pending_review: "ждет подтверждения",
    rejected: "отклонен",
  };
  return map[String(status || "").trim()] || String(status || "неизвестно");
}

function formatTransactionType(type) {
  const map = {
    case_open_cost: "Открытие кейса",
    case_win: "Выигрыш из кейса",
    raffle_win: "Выигрыш в розыгрыше",
    deposit_credit: "Пополнение",
    withdrawal: "Вывод",
    withdrawal_pending: "Заявка на вывод",
    withdrawal_approved: "Вывод подтвержден",
    withdrawal_rejected_refund: "Возврат после отказа",
    admin_credit: "Ручное пополнение",
    admin_debit: "Ручное списание",
  };
  return map[String(type || "").trim()] || "Операция";
}

function formatError(code) {
  const map = {
    admin_forbidden: "Этот Telegram-аккаунт не допущен в админку.",
    invalid_password: "Неверный пароль администратора.",
    balance_invalid_password: "Неверный второй пароль.",
    insufficient_balance: "Недостаточно средств на балансе.",
    telegram_init_data_required: "Открой mini app через Telegram.",
    telegram_init_data_invalid: "Telegram-авторизация не прошла проверку.",
    telegram_init_data_expired: "Сессия Telegram истекла, открой mini app заново.",
    prize_amount_too_small: "Сумма приза слишком мала для выбранного числа победителей.",
    deposit_not_found: "Счет на пополнение не найден.",
    raffle_not_found: "Розыгрыш не найден.",
    case_not_found: "Кейс не найден.",
    withdrawal_not_found: "Заявка на вывод не найдена.",
    username_required: "Укажи username игрока.",
    amount_required: "Укажи сумму.",
    withdraw_amount_required: "Укажи сумму вывода.",
    deposit_amount_required: "Укажи сумму пополнения.",
  };
  return map[String(code || "").trim()] || "Операция не выполнена.";
}

function pickPaymentLink(payment) {
  return payment?.miniAppInvoiceUrl || payment?.botInvoiceUrl || payment?.webAppInvoiceUrl || "";
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
