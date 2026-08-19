const ADMIN_TOKEN_KEY = "ilyushka_admin_token";
const BALANCE_ADMIN_TOKEN_KEY = "ilyushka_balance_admin_token";

const state = {
  tg: null,
  health: null,
  auth: {
    telegramId: "",
    username: "",
    displayName: "",
    photoUrl: "",
    initData: "",
    startParam: "",
  },
  ui: {
    adminMenuOpen: false,
    adminPanelOpen: false,
    profileOpen: false,
    historyOpen: false,
  },
  adminToken: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  balanceAdminToken: localStorage.getItem(BALANCE_ADMIN_TOKEN_KEY) || "",
  raffles: [],
  currentRaffleSlug: "",
  currentRaffle: null,
  profile: null,
  dashboard: null,
  pendingDraftId: "",
  activeDraftPayment: null,
  activeDepositId: "",
  activeDeposit: null,
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
  raffleTitle: document.getElementById("raffle-title"),
  raffleSubtitle: document.getElementById("raffle-subtitle"),
  playerBadge: document.getElementById("player-badge"),
  playerStatus: document.getElementById("player-status"),
  joinButton: document.getElementById("join-button"),
  emptyProfileButton: document.getElementById("empty-profile-button"),
  playerMessage: document.getElementById("player-message"),
  rouletteStack: document.getElementById("roulette-stack"),
  adminLoginCard: document.getElementById("admin-login-card"),
  adminLoginForm: document.getElementById("admin-login-form"),
  adminLoginMessage: document.getElementById("admin-login-message"),
  adminPanel: document.getElementById("admin-panel"),
  adminLogout: document.getElementById("admin-logout"),
  createRaffleForm: document.getElementById("create-raffle-form"),
  paymentCard: document.getElementById("payment-card"),
  paymentCardText: document.getElementById("payment-card-text"),
  payInvoiceButton: document.getElementById("pay-invoice-button"),
  verifyPaymentButton: document.getElementById("verify-payment-button"),
  shareCard: document.getElementById("share-card"),
  shareLinkText: document.getElementById("share-link-text"),
  copyLinkButton: document.getElementById("copy-link-button"),
  openLinkButton: document.getElementById("open-link-button"),
  adminMessage: document.getElementById("admin-message"),
  balanceLockCard: document.getElementById("balance-lock-card"),
  balanceAuthForm: document.getElementById("balance-auth-form"),
  balanceAdjustForm: document.getElementById("balance-adjust-form"),
  balanceAdminMessage: document.getElementById("balance-admin-message"),
  withdrawalSettingsForm: document.getElementById("withdrawal-settings-form"),
  withdrawalModeSelect: document.getElementById("withdrawal-mode-select"),
  withdrawalSettingsMessage: document.getElementById("withdrawal-settings-message"),
  adminWithdrawalsList: document.getElementById("admin-withdrawals-list"),
  adminActiveList: document.getElementById("admin-active-list"),
  adminHistoryList: document.getElementById("admin-history-list"),
  adminOperationsList: document.getElementById("admin-operations-list"),
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
};

boot().catch((error) => {
  console.error(error);
  showMessage(elements.playerMessage, formatError(error.message), "error");
});

async function boot() {
  initTelegram();
  bindEvents();
  state.currentRaffleSlug = getRaffleSlugFromLocation();
  await refreshAll();
}

function initTelegram() {
  const tg = window.Telegram?.WebApp || null;
  state.tg = tg;
  if (!tg) {
    return;
  }
  tg.ready();
  tg.expand();
  const user = tg.initDataUnsafe?.user || {};
  state.auth.telegramId = user.id ? String(user.id) : "";
  state.auth.username = String(user.username || "").trim();
  state.auth.displayName = String(
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || "Игрок"
  ).trim();
  state.auth.photoUrl = String(user.photo_url || "").trim();
  state.auth.initData = String(tg.initData || "");
  state.auth.startParam = String(tg.initDataUnsafe?.start_param || "").trim();
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
    state.ui.historyOpen = !state.ui.historyOpen;
    renderProfileSheet();
  });
  elements.joinButton.addEventListener("click", joinCurrentRaffle);
  elements.emptyProfileButton.addEventListener("click", async () => {
    const featured = pickFeaturedRaffle();
    if (featured) {
      state.currentRaffleSlug = featured.slug;
      window.history.replaceState({}, "", `?raffle=${encodeURIComponent(featured.slug)}`);
      await refreshAll();
    }
  });
  elements.adminLoginForm.addEventListener("submit", onAdminLogin);
  elements.adminLogout.addEventListener("click", onAdminLogout);
  elements.createRaffleForm.addEventListener("submit", onCreateRaffle);
  elements.verifyPaymentButton.addEventListener("click", verifyRafflePayment);
  elements.copyLinkButton.addEventListener("click", copyShareLink);
  elements.openLinkButton.addEventListener("click", () => openExternal(elements.openLinkButton.dataset.link || ""));
  elements.payInvoiceButton.addEventListener("click", () => openExternal(elements.payInvoiceButton.dataset.link || ""));
  elements.balanceAuthForm.addEventListener("submit", onBalanceAdminLogin);
  elements.balanceAdjustForm.addEventListener("submit", onBalanceAdjust);
  elements.withdrawalSettingsForm.addEventListener("submit", onWithdrawalSettingsSubmit);
  elements.depositForm.addEventListener("submit", onDepositSubmit);
  elements.verifyDepositButton.addEventListener("click", onVerifyDeposit);
  elements.depositOpenButton.addEventListener("click", () => openExternal(elements.depositOpenButton.dataset.link || ""));
  elements.withdrawForm.addEventListener("submit", onWithdrawSubmit);
  elements.withdrawOpenButton.addEventListener("click", () => openExternal(elements.withdrawOpenButton.dataset.link || ""));
  document.addEventListener("click", onDocumentClick);
}

async function refreshAll() {
  const requests = [
    api("/api/health", { method: "GET" }),
    api("/api/raffles", { method: "GET" }),
  ];
  if (state.currentRaffleSlug) {
    requests.push(api(`/api/raffles/slug/${encodeURIComponent(state.currentRaffleSlug)}`, { method: "GET" }).catch(() => null));
  } else {
    requests.push(Promise.resolve(null));
  }
  requests.push(fetchProfile());
  requests.push(fetchDashboard());

  const [health, rafflesPayload, currentPayload, profilePayload, dashboardPayload] = await Promise.all(requests);
  state.health = health;
  state.raffles = Array.isArray(rafflesPayload?.raffles) ? rafflesPayload.raffles : [];
  state.currentRaffle = currentPayload?.raffle || null;
  state.profile = profilePayload?.profile || null;
  state.dashboard = dashboardPayload;
  syncPendingDepositFromProfile();

  if (!state.currentRaffle) {
    state.currentRaffle = pickFeaturedRaffle();
  }

  render();
}

async function fetchProfile() {
  try {
    return await api("/api/profile", { method: "GET" });
  } catch (error) {
    return { profile: null };
  }
}

async function fetchDashboard() {
  if (!state.adminToken) {
    return null;
  }
  try {
    return await api("/api/admin/dashboard", { method: "GET", admin: true });
  } catch (error) {
    if (error.message === "admin_required") {
      clearAdminTokens();
    }
    return null;
  }
}

function render() {
  renderAdminVisibility();
  renderProfileVisibility();
  renderCurrentRaffle();
  renderAdminDashboard();
  renderProfileSheet();
}

function renderAdminVisibility() {
  const canAccess = Boolean(state.health?.admin?.canAccess);
  const authorized = Boolean(state.dashboard && state.adminToken);
  elements.adminNav.classList.toggle("hidden", !canAccess);
  elements.adminMenuPanel.classList.toggle("hidden", !canAccess || !state.ui.adminMenuOpen);
  elements.adminLoginCard.classList.toggle("hidden", !canAccess || !state.ui.adminPanelOpen || authorized);
  elements.adminPanel.classList.toggle("hidden", !canAccess || !state.ui.adminPanelOpen || !authorized);
}

function renderProfileVisibility() {
  elements.profileNav.classList.toggle("hidden", !state.profile);
  renderAvatar(elements.profileAvatar, state.profile);
  elements.profileBalanceChip.textContent = state.profile?.balanceLabel || "0.00 USDT";
}

function renderCurrentRaffle() {
  const raffle = state.currentRaffle;
  elements.landingTitle.textContent = state.health?.config?.appName || "Халява от Илюшки";
  elements.landingSubtitle.textContent = "";

  if (!raffle) {
    elements.raffleTitle.textContent = "Халява от Илюшки";
    elements.raffleSubtitle.textContent = "Нет активных розыгрышей";
    elements.playerBadge.textContent = "Ожидание";
    elements.playerStatus.textContent = "Когда админ создаст новый розыгрыш, он появится здесь.";
    elements.joinButton.classList.add("hidden");
    elements.emptyProfileButton.classList.toggle("hidden", !state.raffles.length);
    elements.rouletteStack.innerHTML = buildPlaceholderTrack();
    return;
  }

  const now = state.health?.now ? new Date(state.health.now).getTime() : Date.now();
  const endsAt = raffle.endsAt ? new Date(raffle.endsAt).getTime() : 0;
  const joined = Boolean(
    state.profile?.telegramId &&
      Array.isArray(raffle.participants) &&
      raffle.participants.some((item) => String(item.telegramId) === String(state.profile.telegramId))
  );

  elements.raffleTitle.textContent = raffle.title || "Розыгрыш";
  elements.raffleSubtitle.textContent =
    `${raffle.prizeText || "Приз"} • ${formatMoney(raffle.prizeAmount)} ${raffle.prizeAsset}`;
  elements.playerBadge.textContent = `${raffle.participantCount || 0} участников`;
  elements.playerStatus.textContent =
    raffle.status === "finished"
      ? buildFinishedText(raffle)
      : `Итоги через ${formatCountdown(Math.max(0, endsAt - now))}`;
  elements.joinButton.classList.toggle("hidden", raffle.status !== "active");
  elements.emptyProfileButton.classList.add("hidden");
  elements.joinButton.textContent = joined ? "Вы участвуете" : "Участвовать";
  elements.joinButton.disabled = joined || raffle.status !== "active";
  elements.rouletteStack.innerHTML = buildRouletteMarkup(raffle);
}

function renderAdminDashboard() {
  const dashboard = state.dashboard;
  const balanceReady = Boolean(state.balanceAdminToken && state.health?.admin?.balanceAuthorized);

  elements.balanceLockCard.classList.toggle("hidden", !dashboard || balanceReady);
  elements.balanceAdjustForm.classList.toggle("hidden", !dashboard || !balanceReady);
  elements.withdrawalSettingsForm.classList.toggle("hidden", !dashboard || !balanceReady);

  if (!dashboard) {
    elements.adminActiveList.innerHTML = "";
    elements.adminHistoryList.innerHTML = "";
    elements.adminWithdrawalsList.innerHTML = "";
    elements.adminOperationsList.innerHTML = "";
    return;
  }

  elements.withdrawalModeSelect.value = dashboard.settings?.autoMode ? "auto" : "manual";

  const active = dashboard.raffles.filter((item) => item.status === "active" || item.status === "pending_payment");
  const history = dashboard.raffles.filter((item) => item.status === "finished");

  elements.adminActiveList.innerHTML = active.length
    ? active.map(renderAdminRaffleCard).join("")
    : `<div class="mini-card mini-card--muted">Активных розыгрышей пока нет.</div>`;
  elements.adminHistoryList.innerHTML = history.length
    ? history.map(renderAdminHistoryCard).join("")
    : `<div class="mini-card mini-card--muted">История пока пустая.</div>`;
  elements.adminWithdrawalsList.innerHTML = (dashboard.withdrawals || []).length
    ? dashboard.withdrawals.map(renderWithdrawalCard).join("")
    : `<div class="mini-card mini-card--muted">Заявок на вывод пока нет.</div>`;
  elements.adminOperationsList.innerHTML = (dashboard.playerOperations || []).length
    ? dashboard.playerOperations.slice(0, 20).map(renderOperationCard).join("")
    : `<div class="mini-card mini-card--muted">Операций пока нет.</div>`;
}

function renderProfileSheet() {
  const profile = state.profile;
  elements.profileSheet.classList.toggle("hidden", !state.ui.profileOpen || !profile);
  elements.sheetBackdrop.classList.toggle("hidden", !state.ui.profileOpen || !profile);
  if (!profile) {
    return;
  }

  renderAvatar(elements.profileSheetAvatar, profile);
  elements.profileName.textContent = profile.displayName || "Игрок";
  elements.profileUsernameLabel.textContent = profile.usernameLabel || "Без username";
  elements.profileBalanceLabel.textContent = profile.balanceLabel || "0.00 USDT";
  elements.profileHistoryCard.classList.toggle("hidden", !state.ui.historyOpen);
  elements.profileHistoryToggle.textContent = state.ui.historyOpen ? "Скрыть" : "Показать";
  elements.profileHistoryList.innerHTML = buildProfileHistory(profile);

  if (!state.activeDeposit) {
    elements.depositResultCard.classList.add("hidden");
  }
  if (!state.lastWithdrawal) {
    elements.withdrawResultCard.classList.add("hidden");
  }
}

function renderRafflePaymentCard(payment) {
  if (!payment) {
    elements.paymentCard.classList.add("hidden");
    return;
  }
  const payLink = pickPaymentLink(payment);
  elements.paymentCard.classList.remove("hidden");
  elements.paymentCardText.textContent =
    `Счет на ${formatMoney(payment.amount)} ${payment.asset}. Статус: ${formatStatus(payment.status)}.`;
  elements.payInvoiceButton.dataset.link = payLink;
  elements.verifyPaymentButton.disabled = !state.pendingDraftId;
}

function renderShareCard(link) {
  if (!link) {
    elements.shareCard.classList.add("hidden");
    return;
  }
  elements.shareCard.classList.remove("hidden");
  elements.shareLinkText.textContent = link;
  elements.openLinkButton.dataset.link = link;
}

function renderAdminRaffleCard(raffle) {
  const actions = [];
  if (raffle.status === "pending_payment") {
    actions.push(
      `<button class="secondary small" type="button" data-action="verify-payment" data-id="${escapeAttribute(raffle.id)}">Проверить оплату</button>`
    );
  }
  if (raffle.status === "active") {
    actions.push(
      `<button class="secondary small" type="button" data-action="finalize-raffle" data-id="${escapeAttribute(raffle.id)}">Завершить</button>`
    );
    actions.push(
      `<button class="secondary small" type="button" data-action="copy-link" data-link="${escapeAttribute(raffle.shareLink || "")}">Скопировать ссылку</button>`
    );
  }
  return `
    <div class="mini-card">
      <strong>${escapeHtml(raffle.title)}</strong>
      <span>${escapeHtml(raffle.prizeText)} • ${formatMoney(raffle.prizeAmount)} ${escapeHtml(raffle.prizeAsset || "")}</span>
      <span>${raffle.participantCount || 0} участников • ${raffle.winnersCount} победителей • ${formatStatus(raffle.status)}</span>
      <span>${raffle.shareLink ? escapeHtml(raffle.shareLink) : "Ссылка появится после оплаты"}</span>
      <div class="inline-actions">${actions.join("")}</div>
    </div>
  `;
}

function renderAdminHistoryCard(raffle) {
  const winners = Array.isArray(raffle.winners) && raffle.winners.length
    ? raffle.winners.map((item, index) => `${index + 1}. ${item.usernameLabel}`).join(" • ")
    : "Победителей пока нет";
  return `
    <div class="mini-card">
      <strong>${escapeHtml(raffle.title)}</strong>
      <span>${escapeHtml(raffle.prizeText)} • ${formatMoney(raffle.prizeAmount)} ${escapeHtml(raffle.prizeAsset || "")}</span>
      <span>${escapeHtml(winners)}</span>
    </div>
  `;
}

function renderWithdrawalCard(withdrawal) {
  const actions = [];
  if (withdrawal.status === "pending_review") {
    actions.push(
      `<button class="secondary small" type="button" data-action="approve-withdrawal" data-id="${escapeAttribute(withdrawal.id)}">Подтвердить</button>`
    );
    actions.push(
      `<button class="secondary small" type="button" data-action="reject-withdrawal" data-id="${escapeAttribute(withdrawal.id)}">Отклонить</button>`
    );
  }
  return `
    <div class="mini-card">
      <strong>${escapeHtml(withdrawal.usernameLabel || withdrawal.displayName || "Игрок")}</strong>
      <span>${escapeHtml(withdrawal.amountLabel || "")}</span>
      <span>${formatStatus(withdrawal.status)}</span>
      ${withdrawal.checkUrl ? `<a class="link-button" href="${escapeAttribute(withdrawal.checkUrl)}" target="_blank" rel="noreferrer">Открыть чек</a>` : ""}
      <div class="inline-actions">${actions.join("")}</div>
    </div>
  `;
}

function renderOperationCard(operation) {
  const amount = Number(operation.amount || 0);
  const tone = amount >= 0 ? "win" : "error";
  return `
    <div class="mini-card">
      <strong>${escapeHtml(operation.usernameLabel || operation.displayName || "Игрок")}</strong>
      <span>${escapeHtml(formatTransactionType(operation.type))}</span>
      <span class="${tone}">${amount >= 0 ? "+" : ""}${formatMoney(amount)} ${escapeHtml(operation.asset || state.health?.config?.payoutAsset || "USDT")}</span>
    </div>
  `;
}

function buildRouletteMarkup(raffle) {
  if (raffle.status === "finished" && Array.isArray(raffle.winners) && raffle.winners.length) {
    return raffle.winners
      .map(
        (winner, index) => `
          <div class="winner-card">
            <div class="winner-place">${index + 1}</div>
            ${renderAvatarMarkup(winner, "winner-avatar")}
            <div class="winner-meta">
              <strong>${escapeHtml(winner.usernameLabel || winner.displayName || "Победитель")}</strong>
              <span>${formatMoney(winner.prizeAmount || 0)} ${escapeHtml(winner.prizeAsset || raffle.prizeAsset || "")}</span>
            </div>
          </div>
        `
      )
      .join("");
  }

  const participants = Array.isArray(raffle.participants) ? raffle.participants : [];
  const items = participants.length ? participants : [{ displayName: "Ждем игроков" }, { displayName: "Новый шанс" }];
  const loop = items.concat(items).concat(items);

  return `
    <div class="roulette-track">
      ${loop
        .map(
          (item) => `
            <div class="roulette-pill">
              ${renderAvatarMarkup(item, "roulette-avatar")}
              <span>${escapeHtml(item.usernameLabel || item.displayName || "Игрок")}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildPlaceholderTrack() {
  return `
    <div class="roulette-track">
      <div class="roulette-pill"><span>Новый розыгрыш</span></div>
      <div class="roulette-pill"><span>Скоро тут</span></div>
      <div class="roulette-pill"><span>Халява от Илюшки</span></div>
      <div class="roulette-pill"><span>Ждем старт</span></div>
    </div>
  `;
}

function buildProfileHistory(profile) {
  const rows = [];
  for (const transaction of profile.recentTransactions || []) {
    rows.push({
      id: transaction.id,
      title: formatTransactionType(transaction.type),
      subtitle: transaction.note || formatDateTime(transaction.createdAt),
      amount: transaction.amount,
      asset: transaction.asset || profile.payoutAsset,
      createdAt: transaction.createdAt,
      tone: Number(transaction.amount || 0) >= 0 ? "win" : "error",
    });
  }
  for (const withdrawal of profile.recentWithdrawals || []) {
    rows.push({
      id: `withdrawal_${withdrawal.id}`,
      title: `Вывод: ${formatStatus(withdrawal.status)}`,
      subtitle: withdrawal.checkUrl ? "Чек доступен для получения" : formatDateTime(withdrawal.createdAt),
      amount: -Math.abs(Number(withdrawal.amount || 0)),
      asset: withdrawal.asset || profile.payoutAsset,
      createdAt: withdrawal.createdAt,
      tone: "muted",
      link: withdrawal.checkUrl || "",
    });
  }
  for (const deposit of profile.recentDeposits || []) {
    rows.push({
      id: `deposit_${deposit.id}`,
      title: `Пополнение: ${formatStatus(deposit.status)}`,
      subtitle: formatDateTime(deposit.createdAt),
      amount: Number(deposit.amount || 0),
      asset: deposit.asset || profile.payoutAsset,
      createdAt: deposit.createdAt,
      tone: deposit.status === "paid" || deposit.status === "credited" ? "win" : "muted",
      link: pickPaymentLink(deposit.payment),
    });
  }

  return dedupeById(rows)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 20)
    .map((item) => {
      const amount = Number(item.amount || 0);
      return `
        <div class="history-row">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.subtitle)}</span>
            ${item.link ? `<a class="link-button link-button--inline" href="${escapeAttribute(item.link)}" target="_blank" rel="noreferrer">Открыть</a>` : ""}
          </div>
          <div class="${escapeAttribute(item.tone)}">${amount >= 0 ? "+" : ""}${formatMoney(amount)} ${escapeHtml(item.asset || "")}</div>
        </div>
      `;
    })
    .join("");
}

async function onAdminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const payload = await api("/api/admin/login", {
      method: "POST",
      body: { password: String(form.get("password") || "") },
    });
    state.adminToken = payload.token;
    localStorage.setItem(ADMIN_TOKEN_KEY, payload.token);
    state.dashboard = await fetchDashboard();
    showMessage(elements.adminLoginMessage, "Админка открыта.", "win");
    render();
  } catch (error) {
    showMessage(elements.adminLoginMessage, formatError(error.message), "error");
  }
}

async function onAdminLogout() {
  try {
    await api("/api/admin/logout", { method: "POST", admin: true, balanceAdmin: true });
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
      admin: true,
      body: {
        title: String(form.get("title") || ""),
        prizeText: String(form.get("prizeText") || ""),
        prizeAmount: Number(form.get("prizeAmount") || 0),
        winnersCount: Number(form.get("winnersCount") || 1),
        timerMinutes: Number(form.get("timerMinutes") || 1),
      },
    });
    state.pendingDraftId = payload.raffle?.id || "";
    state.activeDraftPayment = payload.payment || null;
    renderRafflePaymentCard(payload.payment);
    renderShareCard("");
    state.dashboard = await fetchDashboard();
    event.currentTarget.reset();
    showMessage(elements.adminMessage, "Счет создан. Сначала оплати его, потом нажми проверить оплату.", "win");
    render();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function verifyRafflePayment() {
  if (!state.pendingDraftId) {
    showMessage(elements.adminMessage, "Нет счета для проверки.", "error");
    return;
  }
  try {
    const payload = await api(`/api/admin/raffles/${encodeURIComponent(state.pendingDraftId)}/verify-payment`, {
      method: "POST",
      admin: true,
    });
    state.activeDraftPayment = payload.payment || null;
    renderRafflePaymentCard(payload.payment);
    if (payload.shareLink) {
      renderShareCard(payload.shareLink);
      state.pendingDraftId = "";
      state.currentRaffleSlug = payload.raffle?.slug || state.currentRaffleSlug;
      await refreshAll();
      showMessage(elements.adminMessage, "Оплата найдена. Ссылка на розыгрыш готова.", "win");
      return;
    }
    showMessage(elements.adminMessage, "Оплата еще не подтверждена.", "muted");
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function finalizeRaffleNow(raffleId) {
  try {
    await api(`/api/admin/raffles/${encodeURIComponent(raffleId)}/finalize`, { method: "POST", admin: true });
    await refreshAll();
    showMessage(elements.adminMessage, "Розыгрыш завершен.", "win");
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
      admin: true,
      body: { password: String(form.get("password") || "") },
    });
    state.balanceAdminToken = payload.token;
    localStorage.setItem(BALANCE_ADMIN_TOKEN_KEY, payload.token);
    await refreshAll();
    showMessage(elements.balanceAdminMessage, "Доступ к балансу открыт.", "win");
  } catch (error) {
    showMessage(elements.balanceAdminMessage, formatError(error.message), "error");
  }
}

async function onBalanceAdjust(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/admin/balance/adjust", {
      method: "POST",
      admin: true,
      balanceAdmin: true,
      body: {
        username: String(form.get("username") || ""),
        operation: String(form.get("operation") || ""),
        amount: Number(form.get("amount") || 0),
        note: String(form.get("note") || ""),
      },
    });
    event.currentTarget.reset();
    await refreshAll();
    showMessage(elements.balanceAdminMessage, "Баланс обновлен.", "win");
  } catch (error) {
    showMessage(elements.balanceAdminMessage, formatError(error.message), "error");
  }
}

async function onWithdrawalSettingsSubmit(event) {
  event.preventDefault();
  try {
    await api("/api/admin/withdrawals/settings", {
      method: "POST",
      admin: true,
      balanceAdmin: true,
      body: { autoMode: elements.withdrawalModeSelect.value === "auto" },
    });
    await refreshAll();
    showMessage(elements.withdrawalSettingsMessage, "Режим вывода обновлен.", "win");
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
      body: { amount: Number(form.get("amount") || 0) },
    });
    state.profile = payload.profile || state.profile;
    state.activeDeposit = payload.deposit || null;
    state.activeDepositId = payload.deposit?.id || "";
    elements.depositResultCard.classList.remove("hidden");
    elements.depositResultText.textContent = `Счет на ${formatMoney(payload.deposit?.amount || 0)} ${payload.deposit?.asset || ""}`;
    elements.depositOpenButton.dataset.link = pickPaymentLink(payload.deposit?.payment);
    event.currentTarget.reset();
    renderProfileSheet();
  } catch (error) {
    showMessage(elements.profileMessage, formatError(error.message), "error");
  }
}

async function onVerifyDeposit() {
  if (!state.activeDepositId) {
    showMessage(elements.profileMessage, "Нет пополнения для проверки.", "error");
    return;
  }
  try {
    const payload = await api(`/api/profile/deposit/${encodeURIComponent(state.activeDepositId)}/verify`, {
      method: "POST",
    });
    state.profile = payload.profile || state.profile;
    state.activeDeposit = payload.deposit || state.activeDeposit;
    elements.depositResultCard.classList.remove("hidden");
    elements.depositResultText.textContent = `Статус пополнения: ${formatStatus(payload.deposit?.status)}`;
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
      body: {
        amount: Number(form.get("amount") || 0),
        method: "cryptobot",
      },
    });
    state.profile = payload.profile || state.profile;
    state.lastWithdrawal = payload.withdrawal || null;
    elements.withdrawResultCard.classList.remove("hidden");
    elements.withdrawResultText.textContent = buildWithdrawalText(payload.withdrawal);
    elements.withdrawOpenButton.dataset.link = payload.withdrawal?.checkUrl || "";
    event.currentTarget.reset();
    render();
  } catch (error) {
    showMessage(elements.profileMessage, formatError(error.message), "error");
  }
}

async function joinCurrentRaffle() {
  if (!state.currentRaffleSlug) {
    showMessage(elements.playerMessage, "Нет ссылки на розыгрыш.", "error");
    return;
  }
  if (!ensureTelegramProfile(elements.playerMessage)) {
    return;
  }
  try {
    await api(`/api/raffles/slug/${encodeURIComponent(state.currentRaffleSlug)}/join`, {
      method: "POST",
    });
    await refreshAll();
    showMessage(elements.playerMessage, "Вы участвуете в розыгрыше.", "win");
  } catch (error) {
    showMessage(elements.playerMessage, formatError(error.message), "error");
  }
}

async function approveWithdrawal(withdrawalId) {
  try {
    await api(`/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/approve`, {
      method: "POST",
      admin: true,
      balanceAdmin: true,
    });
    await refreshAll();
    showMessage(elements.balanceAdminMessage, "Вывод подтвержден.", "win");
  } catch (error) {
    showMessage(elements.balanceAdminMessage, formatError(error.message), "error");
  }
}

async function rejectWithdrawal(withdrawalId) {
  try {
    await api(`/api/admin/withdrawals/${encodeURIComponent(withdrawalId)}/reject`, {
      method: "POST",
      admin: true,
      balanceAdmin: true,
      body: { reason: "Отклонено админом" },
    });
    await refreshAll();
    showMessage(elements.balanceAdminMessage, "Вывод отклонен.", "win");
  } catch (error) {
    showMessage(elements.balanceAdminMessage, formatError(error.message), "error");
  }
}

function onDocumentClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action || "";
  if (action === "finalize-raffle") {
    finalizeRaffleNow(button.dataset.id || "");
  }
  if (action === "verify-payment") {
    state.pendingDraftId = button.dataset.id || "";
    verifyRafflePayment();
  }
  if (action === "copy-link") {
    copyText(button.dataset.link || "");
  }
  if (action === "approve-withdrawal") {
    approveWithdrawal(button.dataset.id || "");
  }
  if (action === "reject-withdrawal") {
    rejectWithdrawal(button.dataset.id || "");
  }
}

function getRaffleSlugFromLocation() {
  const search = new URLSearchParams(window.location.search);
  const fromQuery = String(search.get("raffle") || "").trim();
  if (fromQuery) {
    return fromQuery;
  }
  const startParam = String(state.auth.startParam || "").trim();
  if (startParam.startsWith("raffle_")) {
    return startParam.slice("raffle_".length);
  }
  return "";
}

function pickFeaturedRaffle() {
  return state.raffles.find((item) => item.status === "active") || state.raffles[0] || null;
}

function syncPendingDepositFromProfile() {
  const pending = findPendingDeposit(state.profile);
  state.activeDeposit = pending;
  state.activeDepositId = pending?.id || "";
  if (pending?.payment) {
    elements.depositResultCard.classList.remove("hidden");
    elements.depositResultText.textContent = `Счет на ${formatMoney(pending.amount || 0)} ${pending.asset || ""}`;
    elements.depositOpenButton.dataset.link = pickPaymentLink(pending.payment);
  }
}

function findPendingDeposit(profile) {
  return (profile?.recentDeposits || []).find((item) => item.status === "pending") || null;
}

function buildFinishedText(raffle) {
  const me = state.profile?.telegramId ? String(state.profile.telegramId) : "";
  const isWinner = Array.isArray(raffle.winners) && raffle.winners.some((item) => String(item.telegramId) === me);
  return isWinner ? "Вы выиграли" : "Вы не выпали";
}

function buildWithdrawalText(withdrawal) {
  if (!withdrawal) {
    return "";
  }
  if (withdrawal.checkUrl) {
    return `Чек готов: ${withdrawal.amountLabel}`;
  }
  return `Заявка создана: ${formatStatus(withdrawal.status)}`;
}

function openProfileSheet() {
  state.ui.profileOpen = true;
  renderProfileSheet();
}

function closeProfileSheet() {
  state.ui.profileOpen = false;
  renderProfileSheet();
}

function ensureTelegramProfile(messageEl) {
  if (state.profile?.telegramId || state.auth.telegramId) {
    return true;
  }
  showMessage(messageEl, "Откройте мини-приложение внутри Telegram.", "error");
  return false;
}

async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.auth.initData) {
    headers["X-Telegram-Init-Data"] = state.auth.initData;
  }
  if (state.adminToken && options.admin) {
    headers["X-Admin-Token"] = state.adminToken;
  }
  if (state.balanceAdminToken && options.balanceAdmin) {
    headers["X-Balance-Admin-Token"] = state.balanceAdminToken;
  }
  const viewer = {
    id: state.auth.telegramId || undefined,
    username: state.auth.username || undefined,
    displayName: state.auth.displayName || undefined,
    photoUrl: state.auth.photoUrl || undefined,
  };
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body:
      options.method && options.method !== "GET"
        ? JSON.stringify({ ...viewer, ...(options.body || {}) })
        : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `http_${response.status}`);
  }
  return payload;
}

function showMessage(element, text, tone) {
  if (!element) {
    return;
  }
  element.className = `message ${tone || "muted"}`;
  element.textContent = text || "";
}

function clearAdminTokens() {
  state.adminToken = "";
  state.balanceAdminToken = "";
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(BALANCE_ADMIN_TOKEN_KEY);
}

function copyShareLink() {
  copyText(elements.shareLinkText.textContent || "");
}

function copyText(value) {
  if (!value) {
    return;
  }
  navigator.clipboard?.writeText(value).catch(() => {});
}

function openExternal(link) {
  if (!link) {
    return;
  }
  if (state.tg?.openTelegramLink && link.startsWith("https://t.me/")) {
    state.tg.openTelegramLink(link);
    return;
  }
  window.open(link, "_blank", "noopener,noreferrer");
}

function renderAvatar(element, user) {
  if (!element) {
    return;
  }
  if (user?.photoUrl) {
    element.innerHTML = `<img src="${escapeAttribute(user.photoUrl)}" alt="">`;
    return;
  }
  element.textContent = getInitials(user?.displayName || user?.usernameLabel || "И");
}

function renderAvatarMarkup(user, className) {
  if (user?.photoUrl) {
    return `<div class="${className}"><img src="${escapeAttribute(user.photoUrl)}" alt=""></div>`;
  }
  return `<div class="${className}">${escapeHtml(getInitials(user?.displayName || user?.usernameLabel || "И"))}</div>`;
}

function getInitials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join("") || "И";
}

function pickPaymentLink(payment) {
  return payment?.miniAppInvoiceUrl || payment?.botInvoiceUrl || payment?.webAppInvoiceUrl || "";
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatStatus(status) {
  const map = {
    active: "Активен",
    pending_payment: "Ожидает оплату",
    pending: "Ожидает оплату",
    paid: "Оплачен",
    credited: "Зачислен",
    finished: "Завершен",
    created: "Создан",
    pending_review: "На проверке",
    issued: "Выдан чек",
    mock_issued: "Тестовый чек",
    rejected: "Отклонен",
  };
  return map[status] || status || "Статус";
}

function formatTransactionType(type) {
  const map = {
    raffle_win: "Выигрыш в розыгрыше",
    withdrawal: "Вывод",
    deposit: "Пополнение",
    admin_credit: "Начисление админом",
    admin_debit: "Списание админом",
  };
  return map[type] || type || "Операция";
}

function formatError(code) {
  const map = {
    invalid_password: "Неверный пароль.",
    admin_forbidden: "У вас нет доступа к админке.",
    admin_required: "Снова войдите в админку.",
    balance_admin_required: "Нужен второй пароль.",
    balance_invalid_password: "Неверный второй пароль.",
    prize_amount_required: "Укажите сумму розыгрыша.",
    prize_amount_too_small: "Сумма слишком маленькая для такого числа победителей.",
    amount_required: "Укажите сумму.",
    player_not_found: "Игрок не найден.",
    raffle_not_found: "Розыгрыш не найден.",
    telegram_required: "Откройте приложение из Telegram.",
    insufficient_balance: "Недостаточно средств.",
    not_found: "Страница не найдена.",
  };
  return map[code] || code || "Ошибка";
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
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
