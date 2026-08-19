const ADMIN_TOKEN_KEY = "ilyushka_admin_token";
const BALANCE_ADMIN_TOKEN_KEY = "ilyushka_balance_admin_token";
const TASK_ADMIN_TOKEN_KEY = "ilyushka_task_admin_token";
var luckyDropActive = [];
var luckyDropHistory = [];

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
  taskAdminToken: localStorage.getItem(TASK_ADMIN_TOKEN_KEY) || "",
  raffles: [],
  activeRaffles: [],
  tasks: [],
  luckyDrop: null,
  currentRaffleSlug: "",
  currentRaffle: null,
  profile: null,
  dashboard: null,
  pendingDraftId: "",
  lastDraftPayment: null,
  pendingLuckyDropDraftId: "",
  lastLuckyDropPayment: null,
  lastWithdrawal: null,
  recentFinishedRaffle: null,
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
  heroCopy: document.getElementById("hero-copy"),
  playerCard: document.querySelector(".player-card"),
  raffleTitle: document.getElementById("raffle-title"),
  raffleSubtitle: document.getElementById("raffle-subtitle"),
  playerBadge: document.getElementById("player-badge"),
  playerStatus: document.getElementById("player-status"),
  joinButton: document.getElementById("join-button"),
  emptyProfileButton: document.getElementById("empty-profile-button"),
  playerMessage: document.getElementById("player-message"),
  rouletteWindow: document.getElementById("roulette-window"),
  rouletteStack: document.getElementById("roulette-stack"),
  quickStatus: document.getElementById("quick-status"),
  tasksCard: document.getElementById("tasks-card"),
  tasksList: document.getElementById("tasks-list"),
  tasksMessage: document.getElementById("tasks-message"),
  luckyDropCard: document.getElementById("lucky-drop-card"),
  luckyDropSubtitle: document.getElementById("lucky-drop-subtitle"),
  luckyDropBadge: document.getElementById("lucky-drop-badge"),
  luckyDropPool: document.getElementById("lucky-drop-pool"),
  luckyDropLeft: document.getElementById("lucky-drop-left"),
  luckyDropPlayButton: document.getElementById("lucky-drop-play-button"),
  luckyDropFeed: document.getElementById("lucky-drop-feed"),
  luckyDropMessage: document.getElementById("lucky-drop-message"),
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
  createLuckyDropForm: document.getElementById("create-lucky-drop-form"),
  luckyDropPaymentCard: document.getElementById("lucky-drop-payment-card"),
  luckyDropPaymentText: document.getElementById("lucky-drop-payment-text"),
  luckyDropPayButton: document.getElementById("lucky-drop-pay-button"),
  luckyDropVerifyButton: document.getElementById("lucky-drop-verify-button"),
  adminLuckyDropList: document.getElementById("admin-lucky-drop-list"),
  adminLuckyDropHistoryList: document.getElementById("admin-lucky-drop-history-list"),
  taskAdminLockCard: document.getElementById("task-admin-lock-card"),
  taskAdminLoginForm: document.getElementById("task-admin-login-form"),
  taskCreateForm: document.getElementById("task-create-form"),
  taskAdminListCard: document.getElementById("task-admin-list-card"),
  taskAdminList: document.getElementById("task-admin-list"),
  taskAdminMessage: document.getElementById("task-admin-message"),
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
  showMessage(elements.playerMessage, "Не удалось обновить экран. Попробуйте открыть мини-приложение еще раз.", "error");
});

async function boot() {
  initTelegram();
  bindEvents();
  state.currentRaffleSlug = getRaffleSlugFromLocation();
  window.setInterval(() => renderCurrentRaffle(), 1000);
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
    if (!featured) {
      return;
    }
    state.currentRaffleSlug = featured.slug;
    window.history.replaceState({}, "", `?raffle=${encodeURIComponent(featured.slug)}`);
    await refreshAll();
  });
  elements.adminLoginForm.addEventListener("submit", onAdminLogin);
  elements.adminLogout.addEventListener("click", onAdminLogout);
  elements.createRaffleForm.addEventListener("submit", onCreateRaffle);
  elements.createLuckyDropForm.addEventListener("submit", onCreateLuckyDrop);
  elements.taskAdminLoginForm.addEventListener("submit", onTaskAdminLogin);
  elements.taskCreateForm.addEventListener("submit", onCreateTask);
  elements.verifyPaymentButton.addEventListener("click", verifyRafflePayment);
  elements.luckyDropVerifyButton.addEventListener("click", verifyLuckyDropPayment);
  elements.copyLinkButton.addEventListener("click", copyShareLink);
  elements.openLinkButton.addEventListener("click", () => openExternal(elements.openLinkButton.dataset.link || ""));
  elements.payInvoiceButton.addEventListener("click", () => openExternal(elements.payInvoiceButton.dataset.link || ""));
  elements.luckyDropPayButton.addEventListener("click", () => openExternal(elements.luckyDropPayButton.dataset.link || ""));
  elements.balanceAuthForm.addEventListener("submit", onBalanceAdminLogin);
  elements.balanceAdjustForm.addEventListener("submit", onBalanceAdjust);
  elements.withdrawalSettingsForm.addEventListener("submit", onWithdrawalSettingsSubmit);
  elements.withdrawForm.addEventListener("submit", onWithdrawSubmit);
  elements.luckyDropPlayButton.addEventListener("click", playLuckyDropAction);
  elements.withdrawOpenButton.addEventListener("click", () => openExternal(elements.withdrawOpenButton.dataset.link || ""));
  document.addEventListener("click", onDocumentClick);
}

async function refreshAll() {
  const requests = [
    api("/api/health", { method: "GET" }),
    api("/api/raffles", { method: "GET" }),
    fetchProfile(),
    fetchDashboard(),
    fetchTasks(),
    fetchLuckyDrop(),
  ];

  const [health, rafflesPayload, profilePayload, dashboardPayload, tasksPayload, luckyDropPayload] = await Promise.all(requests);
  state.health = health;
  state.raffles = Array.isArray(rafflesPayload?.raffles) ? rafflesPayload.raffles : [];
  state.activeRaffles = state.raffles.filter((item) => item.status === "active");
  state.recentFinishedRaffle = findRecentFinishedRaffle();
  state.profile = profilePayload?.profile || null;
  state.dashboard = dashboardPayload;
  state.tasks = Array.isArray(tasksPayload?.tasks) ? tasksPayload.tasks : [];
  state.luckyDrop = luckyDropPayload?.game || null;
  syncCurrentRaffle();
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

async function fetchLuckyDrop() {
  try {
    return await api("/api/lucky-drops/active", { method: "GET" });
  } catch (error) {
    return { game: null };
  }
}

async function fetchTasks() {
  try {
    return await api("/api/tasks", { method: "GET" });
  } catch (error) {
    return { tasks: [] };
  }
}

function syncCurrentRaffle() {
  const direct = state.currentRaffleSlug
    ? state.raffles.find((item) => item.slug === state.currentRaffleSlug) || null
    : null;
  const canShowDirect = direct && (direct.status === "active" || isFreshFinished(direct));
  state.currentRaffle = canShowDirect ? direct : pickFeaturedRaffle();
  if (state.currentRaffle) {
    state.currentRaffleSlug = state.currentRaffle.slug;
  } else {
    state.currentRaffleSlug = "";
  }
}

function render() {
  renderAdminVisibility();
  renderProfileVisibility();
  renderCurrentRaffle();
  renderTasks();
  renderLuckyDrop();
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

  if (!raffle) {
    elements.landingSubtitle.textContent = "";
    elements.heroCopy.textContent = "";
    elements.playerCard?.classList.add("hidden");
    return;
  }

  elements.playerCard?.classList.remove("hidden");

  if (raffle.status === "finished") {
    renderFinishedRaffle(raffle);
    return;
  }

  const now = state.health?.now ? new Date(state.health.now).getTime() : Date.now();
  const endsAt = raffle.endsAt ? new Date(raffle.endsAt).getTime() : 0;
  const joined = hasJoinedRaffle(raffle);

  elements.landingSubtitle.textContent = "Активная рулетка";
  elements.heroCopy.textContent = "Живой конкурс уже идет. Участвуй сейчас, пока таймер не закрыл набор.";
  elements.raffleTitle.textContent = raffle.title || "Конкурс";
  elements.raffleSubtitle.textContent = `${raffle.prizeText || "Приз"} • ${formatMoney(raffle.prizeAmount)} ${raffle.prizeAsset || ""}`;
  elements.playerBadge.textContent = `${raffle.participantCount || 0} участников`;
  elements.playerStatus.textContent = `До розыгрыша осталось ${formatCountdown(Math.max(0, endsAt - now))}`;
  elements.quickStatus.textContent = joined ? "Вы уже в конкурсе" : "Можно залетать";
  elements.joinButton.classList.remove("hidden");
  elements.emptyProfileButton.classList.add("hidden");
  elements.joinButton.textContent = joined ? "Вы уже участвуете" : "Участвовать";
  elements.joinButton.disabled = joined;
  elements.rouletteStack.classList.remove("empty");
  elements.rouletteStack.classList.remove("celebrate");
  elements.rouletteStack.innerHTML = buildRouletteMarkup(raffle);
}

function renderTasks() {
  const tasks = state.tasks || [];
  elements.tasksList.innerHTML = tasks.length
    ? tasks.map(renderTaskCard).join("")
    : `<div class="mini-card mini-card--muted">Сейчас заданий нет.</div>`;
}

function renderLuckyDrop() {
  const game = state.luckyDrop;
  elements.luckyDropCard.classList.toggle("hidden", !game);
  if (!game) {
    return;
  }

  const hasPlayed = Boolean(game.hasPlayed);
  const canPlay = game.status === "active" && !hasPlayed;
  elements.luckyDropSubtitle.textContent = hasPlayed
    ? "Шанс уже использован. Теперь можно следить за выпадениями."
    : "Один шанс на игрока. Иногда пусто, иногда приятно, иногда джекпот.";
  elements.luckyDropBadge.textContent = formatStatus(game.status);
  elements.luckyDropPool.textContent = `${formatMoney(game.remainingPool)} ${game.prizeAsset || ""}`;
  elements.luckyDropLeft.textContent = String(game.remainingDrops || 0);
  elements.luckyDropPlayButton.disabled = !canPlay;
  elements.luckyDropPlayButton.textContent = hasPlayed ? "Дроп уже открыт" : "Открыть дроп";
  elements.luckyDropFeed.innerHTML = Array.isArray(game.plays) && game.plays.length
    ? game.plays.map(renderLuckyDropFeedCard).join("")
    : `<div class="mini-card mini-card--muted">Пока никто не открывал дроп.</div>`;
}

function renderFinishedRaffle(raffle) {
  const winner = getViewerWinner(raffle);
  const winnersCount = Array.isArray(raffle.winners) ? raffle.winners.length : 0;
  elements.landingSubtitle.textContent = "Итоги конкурса";
  elements.heroCopy.textContent = winner
    ? "Рулетка остановилась. Поздравляем, приз выпал именно вам."
    : "Конкурс завершен. Итоговая рулетка показала победителей.";
  elements.raffleTitle.textContent = winner ? "Поздравляем с победой" : "Конкурс завершен";
  elements.raffleSubtitle.textContent = winner
    ? `${raffle.prizeText || "Приз"} • ${formatMoney(winner.prizeAmount || raffle.prizeAmount)} ${winner.prizeAsset || raffle.prizeAsset || ""}`
    : `${raffle.prizeText || "Приз"} • победителей: ${winnersCount}`;
  elements.playerBadge.textContent = winner ? "Победа" : "Финал";
  elements.playerStatus.textContent = winner ? "Приз уже выпал. Можно открыть профиль и проверить баланс." : "Рулетка остановилась. Проверяйте результаты.";
  elements.quickStatus.textContent = winner ? "Приз у вас" : "Финал показан";
  elements.joinButton.classList.add("hidden");
  elements.emptyProfileButton.classList.add("hidden");
  elements.rouletteStack.classList.remove("empty");
  elements.rouletteStack.classList.add("celebrate");
  elements.rouletteStack.innerHTML = buildFinishedRoulette(raffle, winner);
}

function renderAdminDashboard() {
  const dashboard = state.dashboard;
  const balanceReady = Boolean(state.balanceAdminToken && state.health?.admin?.balanceAuthorized);
  const taskReady = Boolean(state.taskAdminToken);

  elements.balanceLockCard.classList.toggle("hidden", !dashboard || balanceReady);
  elements.balanceAdjustForm.classList.toggle("hidden", !dashboard || !balanceReady);
  elements.withdrawalSettingsForm.classList.toggle("hidden", !dashboard || !balanceReady);
  elements.taskAdminLockCard.classList.toggle("hidden", !dashboard || taskReady);
  elements.taskCreateForm.classList.toggle("hidden", !dashboard || !taskReady);
  elements.taskAdminListCard.classList.toggle("hidden", !dashboard || !taskReady);

  if (!dashboard) {
    elements.adminActiveList.innerHTML = "";
    elements.adminHistoryList.innerHTML = "";
    elements.adminWithdrawalsList.innerHTML = "";
    elements.adminOperationsList.innerHTML = "";
    elements.taskAdminList.innerHTML = "";
    elements.adminLuckyDropList.innerHTML = "";
    elements.adminLuckyDropHistoryList.innerHTML = "";
    return;
  }

  elements.withdrawalModeSelect.value = dashboard.settings?.autoMode ? "auto" : "manual";

  const active = dashboard.raffles.filter((item) => item.status === "active" || item.status === "pending_payment");
  const history = dashboard.raffles.filter((item) => item.status === "finished");
  const luckyDrops = Array.isArray(dashboard.luckyDrops) ? dashboard.luckyDrops : [];
  const luckyDropActive = luckyDrops.filter((item) => item.status === "active" || item.status === "pending_payment");
  const luckyDropHistory = luckyDrops.filter((item) => item.status === "completed");

  elements.adminActiveList.innerHTML = active.length
    ? active.map(renderAdminRaffleCard).join("")
    : '<div class="mini-card mini-card--muted">???? ??? ???????? ?????????.</div>';
  elements.adminHistoryList.innerHTML = history.length
    ? history.map(renderAdminHistoryCard).join("")
    : '<div class="mini-card mini-card--muted">??????? ???? ??????.</div>';
  elements.adminWithdrawalsList.innerHTML = (dashboard.withdrawals || []).length
    ? dashboard.withdrawals.map(renderWithdrawalCard).join("")
    : '<div class="mini-card mini-card--muted">?????? ?? ????? ???? ???.</div>';
  elements.adminOperationsList.innerHTML = (dashboard.playerOperations || []).length
    ? dashboard.playerOperations.slice(0, 20).map(renderOperationCard).join("")
    : '<div class="mini-card mini-card--muted">???????? ???? ???.</div>';
  elements.taskAdminList.innerHTML = (dashboard.tasks || []).length
    ? dashboard.tasks.map(renderTaskAdminCard).join("")
    : '<div class="mini-card mini-card--muted">??????? ???? ???.</div>';
  elements.adminLuckyDropList.innerHTML = luckyDropActive.length
    ? luckyDropActive.map(renderAdminLuckyDropCard).join("")
    : '<div class="mini-card mini-card--muted">?????? ??? ???????? Lucky Drop.</div>';
  elements.adminLuckyDropHistoryList.innerHTML = luckyDropHistory.length
    ? luckyDropHistory.map(renderAdminLuckyDropHistoryCard).join("")
    : '<div class="mini-card mini-card--muted">??????? Lucky Drop ???? ??????.</div>';
}

function renderProfileSheet() {
  const profile = state.profile;
  const opened = state.ui.profileOpen && Boolean(profile);
  elements.profileSheet.classList.toggle("hidden", !opened);
  elements.sheetBackdrop.classList.toggle("hidden", !opened);
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

  if (!state.lastWithdrawal) {
    elements.withdrawResultCard.classList.add("hidden");
  }
}

function renderPaymentCard(payment) {
  if (!payment) {
    elements.paymentCard.classList.add("hidden");
    return;
  }
  elements.paymentCard.classList.remove("hidden");
  elements.paymentCardText.textContent =
    `Счет создан на ${formatMoney(payment.amount)} ${payment.asset}. После оплаты нажми "Проверить и запустить".`;
  elements.payInvoiceButton.dataset.link = pickPaymentLink(payment);
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
    : "Победители еще не определены";
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

function renderTaskCard(task) {
  const actionLabel = task.completed ? "Награда получена" : "Забрать награду";
  const caption =
    task.taskType === "reaction"
      ? `Поставь реакцию ${task.reactionCode || "на пост"}`
      : `Подпишись: ${task.channelName || "канал"}`;
  return `
    <div class="mini-card">
      <strong>${escapeHtml(task.title)}</strong>
      <span>${escapeHtml(caption)}</span>
      <span>${escapeHtml(task.rewardLabel)}</span>
      ${task.link ? `<a class="link-button" href="${escapeAttribute(task.link)}" target="_blank" rel="noreferrer">Открыть</a>` : ""}
      <button class="secondary small" type="button" data-action="complete-task" data-id="${escapeAttribute(task.id)}" ${task.completed ? "disabled" : ""}>${actionLabel}</button>
    </div>
  `;
}

function renderTaskAdminCard(task) {
  const typeLabel = task.taskType === "reaction" ? "???????" : "????????";
  return `
    <div class="mini-card">
      <strong>${escapeHtml(task.title)}</strong>
      <span>${typeLabel} ? ${escapeHtml(task.rewardLabel)}</span>
      <span>${task.completedCount || 0} ?????????? ? ${formatStatus(task.status)}</span>
      <button class="secondary small" type="button" data-action="toggle-task" data-id="${escapeAttribute(task.id)}">${task.status === "active" ? "??????????" : "?????????"}</button>
    </div>
  `;
}

function renderLuckyDropFeedCard(play) {
  return `
    <div class="mini-card">
      <strong>${escapeHtml(play.usernameLabel || play.displayName || "?????")}</strong>
      <span>${escapeHtml(play.resultLabel || "????")}</span>
      <span>${Number(play.rewardAmount || 0) > 0 ? `${formatMoney(play.rewardAmount)} USDT` : "0 USDT"}</span>
    </div>
  `;
}

function renderAdminLuckyDropCard(game) {
  const actions = [];
  if (game.status === "pending_payment") {
    actions.push(
      `<button class="secondary small" type="button" data-action="verify-lucky-drop-payment" data-id="${escapeAttribute(game.id)}">????????? ??????</button>`
    );
  }
  return `
    <div class="mini-card">
      <strong>${escapeHtml(game.title || "Lucky Drop")}</strong>
      <span>????: ${formatMoney(game.remainingPool)} ${escapeHtml(game.prizeAsset || "")}</span>
      <span>??????: ${game.remainingDrops || 0}/${game.totalDrops || 0} ? ${formatStatus(game.status)}</span>
      <div class="inline-actions">${actions.join("")}</div>
    </div>
  `;
}

function renderAdminLuckyDropHistoryCard(game) {
  return `
    <div class="mini-card">
      <strong>${escapeHtml(game.title || "Lucky Drop")}</strong>
      <span>??????: ${formatMoney((game.prizePool || 0) - (game.remainingPool || 0))} ${escapeHtml(game.prizeAsset || "")}</span>
      <span>??????? ??????: ${Math.max(0, (game.totalDrops || 0) - (game.remainingDrops || 0))}</span>
    </div>
  `;
}

function buildRouletteMarkup(raffle) {
  const participants = Array.isArray(raffle.participants) ? raffle.participants : [];
  const source = participants.length ? participants : createGhostParticipants();
  const loop = source.concat(source).concat(source);

  return loop
    .map((item, index) => {
      const joined = state.profile?.telegramId && String(item.telegramId || "") === String(state.profile.telegramId);
      const toneClass = joined || index % 5 === 0 ? "roulette-card roulette-card--highlight" : "roulette-card";
      return `
        <div class="${toneClass}">
          ${renderAvatarMarkup(item, "roulette-avatar")}
          <div class="roulette-meta">
            <strong>${escapeHtml(item.usernameLabel || item.displayName || "Игрок")}</strong>
            <span>${joined ? "Это вы" : "Участник розыгрыша"}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function buildFinishedRoulette(raffle, viewerWinner) {
  const winners = Array.isArray(raffle.winners) && raffle.winners.length ? raffle.winners : createGhostParticipants();
  const repeated = winners.concat(winners).concat(winners).concat(winners);
  const stopIndex = winners.length + Math.max(0, winners.findIndex((item) => String(item.telegramId || "") === String(viewerWinner?.telegramId || "")));

  return repeated
    .map((item, index) => {
      const isWinner = winners.some((winner) => String(winner.telegramId || winner.usernameLabel || "") === String(item.telegramId || item.usernameLabel || ""));
      const isViewerWinner = viewerWinner && String(item.telegramId || "") === String(viewerWinner.telegramId || "");
      const classes = [
        "roulette-card",
        isWinner ? "roulette-card--winner" : "",
        index === stopIndex ? "roulette-card--jackpot" : "",
        isViewerWinner ? "roulette-card--viewer" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <div class="${classes}">
          ${renderAvatarMarkup(item, "roulette-avatar")}
          <div class="roulette-meta">
            <strong>${escapeHtml(item.usernameLabel || item.displayName || "Победитель")}</strong>
            <span>${isViewerWinner ? "Это ваш приз" : isWinner ? "Победитель" : "Финальный слот"}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function buildEmptyRoulette() {
  const placeholders = [
    { displayName: "Новый запуск" },
    { displayName: "Скоро здесь" },
    { displayName: "Живая рулетка" },
    { displayName: "Ожидаем старт" },
    { displayName: "Новый конкурс" },
  ];
  const loop = placeholders.concat(placeholders).concat(placeholders);
  return loop
    .map(
      (item, index) => `
        <div class="${index % 3 === 0 ? "roulette-card roulette-card--highlight" : "roulette-card"}">
          <div class="roulette-avatar">?</div>
          <div class="roulette-meta">
            <strong>${escapeHtml(item.displayName)}</strong>
            <span>Нет активных рулеток</span>
          </div>
        </div>
      `
    )
    .join("");
}

function createGhostParticipants() {
  return [
    { displayName: "Первый участник" },
    { displayName: "Новый шанс" },
    { displayName: "Счастливый слот" },
    { displayName: "Ожидаем вход" },
  ];
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
      subtitle: withdrawal.checkUrl ? "Чек готов к получению" : formatDateTime(withdrawal.createdAt),
      amount: -Math.abs(Number(withdrawal.amount || 0)),
      asset: withdrawal.asset || profile.payoutAsset,
      createdAt: withdrawal.createdAt,
      tone: "muted",
      link: withdrawal.checkUrl || "",
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
    showMessage(elements.adminLoginMessage, "Панель открыта.", "win");
    render();
  } catch (error) {
    showMessage(elements.adminLoginMessage, formatError(error.message), "error");
  }
}

async function onTaskAdminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const payload = await api("/api/admin/tasks/login", {
      method: "POST",
      admin: true,
      body: { password: String(form.get("password") || "") },
      taskAdmin: false,
    });
    state.taskAdminToken = payload.token;
    localStorage.setItem(TASK_ADMIN_TOKEN_KEY, payload.token);
    await refreshAll();
    showMessage(elements.taskAdminMessage, "Раздел заданий открыт.", "win");
  } catch (error) {
    showMessage(elements.taskAdminMessage, "Неверный пароль.", "error");
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

async function onCreateTask(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/admin/tasks", {
      method: "POST",
      admin: true,
      taskAdmin: true,
      body: {
        title: String(form.get("title") || ""),
        taskType: String(form.get("taskType") || ""),
        rewardAmount: Number(form.get("rewardAmount") || 0),
        channelName: String(form.get("channelName") || ""),
        link: String(form.get("link") || ""),
        reactionCode: String(form.get("reactionCode") || ""),
      },
    });
    event.currentTarget.reset();
    await refreshAll();
    showMessage(elements.taskAdminMessage, "Задание создано.", "win");
  } catch (error) {
    showMessage(elements.taskAdminMessage, formatError(error.message), "error");
  }
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
    state.lastDraftPayment = payload.payment || null;
    renderPaymentCard(payload.payment);
    renderShareCard("");
    state.dashboard = await fetchDashboard();
    event.currentTarget.reset();
    showMessage(elements.adminMessage, "Счет создан. После оплаты конкурс появится только после подтверждения.", "win");
    render();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function verifyRafflePayment() {
  if (!state.pendingDraftId) {
    showMessage(elements.adminMessage, "?????? ??? ????? ??? ????????.", "error");
    return;
  }
  try {
    const payload = await api(`/api/admin/raffles/${encodeURIComponent(state.pendingDraftId)}/verify-payment`, {
      method: "POST",
      admin: true,
    });
    state.lastDraftPayment = payload.payment || null;
    renderPaymentCard(payload.payment);
    if (payload.shareLink) {
      renderShareCard(payload.shareLink);
      state.pendingDraftId = "";
      state.currentRaffleSlug = payload.raffle?.slug || "";
      await refreshAll();
      showMessage(elements.adminMessage, "?????? ???????. ??????? ??????? ? ??? ???????? ???????.", "win");
      return;
    }
    showMessage(elements.adminMessage, "?????? ??? ?? ????????????. ??????? ???? ? ???????? ?????.", "muted");
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function onCreateLuckyDrop(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const payload = await api("/api/admin/lucky-drops", {
      method: "POST",
      admin: true,
      body: {
        title: String(form.get("title") || ""),
        prizePool: Number(form.get("prizePool") || 0),
        dropCount: Number(form.get("dropCount") || 12),
      },
    });
    state.pendingLuckyDropDraftId = payload.game?.id || "";
    state.lastLuckyDropPayment = payload.payment || null;
    renderLuckyDropPaymentCard(payload.payment);
    state.dashboard = await fetchDashboard();
    event.currentTarget.reset();
    showMessage(elements.adminMessage, "???? ?? Lucky Drop ??????. ????? ?????? ??????? ??? ? ???? ??????????.", "win");
    render();
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function verifyLuckyDropPayment() {
  if (!state.pendingLuckyDropDraftId) {
    showMessage(elements.adminMessage, "?????? ??? ????? Lucky Drop ??? ????????.", "error");
    return;
  }
  try {
    const payload = await api(`/api/admin/lucky-drops/${encodeURIComponent(state.pendingLuckyDropDraftId)}/verify-payment`, {
      method: "POST",
      admin: true,
    });
    state.lastLuckyDropPayment = payload.payment || null;
    renderLuckyDropPaymentCard(payload.payment);
    if (payload.game?.status === "active") {
      state.pendingLuckyDropDraftId = "";
      await refreshAll();
      showMessage(elements.adminMessage, "Lucky Drop ??????????? ? ??? ???????? ???????.", "win");
      return;
    }
    showMessage(elements.adminMessage, "?????? Lucky Drop ??? ?? ????????????.", "muted");
  } catch (error) {
    showMessage(elements.adminMessage, formatError(error.message), "error");
  }
}

async function playLuckyDropAction() {
  const game = state.luckyDrop;
  if (!game?.id) {
    showMessage(elements.luckyDropMessage, "?????? ??? ????????? Lucky Drop.", "error");
    return;
  }
  if (!ensureTelegramProfile(elements.luckyDropMessage)) {
    return;
  }
  try {
    const payload = await api(`/api/lucky-drops/${encodeURIComponent(game.id)}/play`, {
      method: "POST",
    });
    state.luckyDrop = payload.game || null;
    state.profile = payload.profile || state.profile;
    render();
    showMessage(
      elements.luckyDropMessage,
      payload.result?.rewardAmount > 0
        ? `??????: ${payload.result.resultLabel} ? ${payload.result.rewardLabel}`
        : `??????: ${payload.result?.resultLabel || "?????? ????"}`,
      payload.result?.rewardAmount > 0 ? "win" : "muted"
    );
  } catch (error) {
    showMessage(elements.luckyDropMessage, formatPlayerError(error.message), "error");
  }
}

async function finalizeRaffleNow(raffleId) {
  try {
    await api(`/api/admin/raffles/${encodeURIComponent(raffleId)}/finalize`, {
      method: "POST",
      admin: true,
    });
    await refreshAll();
    showMessage(elements.adminMessage, "Конкурс завершен.", "win");
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
    showMessage(elements.balanceAdminMessage, "Баланс игрока обновлен.", "win");
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
    showMessage(elements.playerMessage, "Сейчас нет активного конкурса для входа.", "error");
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
    showMessage(elements.playerMessage, "Вы участвуете в конкурсе. Удачи.", "win");
  } catch (error) {
    showMessage(elements.playerMessage, formatPlayerError(error.message), "error");
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

async function completeTaskAction(taskId) {
  try {
    const payload = await api(`/api/tasks/${encodeURIComponent(taskId)}/complete`, {
      method: "POST",
    });
    state.profile = payload.profile || state.profile;
    await refreshAll();
    showMessage(elements.tasksMessage, "Награда за задание начислена.", "win");
  } catch (error) {
    showMessage(elements.tasksMessage, formatPlayerError(error.message), "error");
  }
}

async function toggleTask(taskId) {
  try {
    await api(`/api/admin/tasks/${encodeURIComponent(taskId)}/toggle`, {
      method: "POST",
      admin: true,
      taskAdmin: true,
    });
    await refreshAll();
    showMessage(elements.taskAdminMessage, "Статус задания обновлен.", "win");
  } catch (error) {
    showMessage(elements.taskAdminMessage, formatError(error.message), "error");
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
  if (action === "complete-task") {
    completeTaskAction(button.dataset.id || "");
  }
  if (action === "toggle-task") {
    toggleTask(button.dataset.id || "");
  }
  if (action === "verify-lucky-drop-payment") {
    state.pendingLuckyDropDraftId = button.dataset.id || "";
    verifyLuckyDropPayment();
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
  return state.activeRaffles[0] || state.recentFinishedRaffle || null;
}

function hasJoinedRaffle(raffle) {
  return Boolean(
    state.profile?.telegramId &&
      Array.isArray(raffle.participants) &&
      raffle.participants.some((item) => String(item.telegramId) === String(state.profile.telegramId))
  );
}

function getViewerWinner(raffle) {
  const telegramId = String(state.profile?.telegramId || state.auth.telegramId || "");
  if (!telegramId || !Array.isArray(raffle.winners)) {
    return null;
  }
  return raffle.winners.find((item) => String(item.telegramId || "") === telegramId) || null;
}

function findRecentFinishedRaffle() {
  const candidates = state.raffles.filter((item) => isFreshFinished(item));
  return candidates[0] || null;
}

function isFreshFinished(raffle) {
  if (!raffle || raffle.status !== "finished") {
    return false;
  }
  const finishedAt = new Date(raffle.finishedAt || raffle.updatedAt || raffle.endsAt || 0).getTime();
  if (!finishedAt) {
    return false;
  }
  return Date.now() - finishedAt < 1000 * 60 * 20;
}

function buildWithdrawalText(withdrawal) {
  if (!withdrawal) {
    return "";
  }
  if (withdrawal.checkUrl) {
    return `Чек уже готов: ${withdrawal.amountLabel}`;
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
  if (state.taskAdminToken && options.taskAdmin) {
    headers["X-Task-Admin-Token"] = state.taskAdminToken;
  }
  const viewer = {
    id: state.auth.telegramId || undefined,
    username: state.auth.username || undefined,
    displayName: state.auth.displayName || undefined,
    photoUrl: state.auth.photoUrl || undefined,
    initData: state.auth.initData || undefined,
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
  state.taskAdminToken = "";
  state.pendingLuckyDropDraftId = "";
  state.lastLuckyDropPayment = null;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(BALANCE_ADMIN_TOKEN_KEY);
  localStorage.removeItem(TASK_ADMIN_TOKEN_KEY);
}

function renderLuckyDropPaymentCard(payment) {
  const ready = Boolean(payment);
  elements.luckyDropPaymentCard.classList.toggle("hidden", !ready);
  if (!ready) {
    elements.luckyDropPayButton.dataset.link = "";
    return;
  }
  elements.luckyDropPaymentText.textContent = `??????: ${formatStatus(payment.status)} ? ${formatMoney(payment.amount)} ${payment.asset || "USDT"}`;
  elements.luckyDropPayButton.dataset.link = pickPaymentLink(payment);
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
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatStatus(status) {
  const map = {
    active: "???????",
    pending_payment: "??????? ??????",
    pending: "??????? ??????",
    paid: "???????",
    credited: "????????",
    finished: "????????",
    completed: "????????",
    created: "??????",
    pending_review: "?? ????????",
    issued: "??? ?????",
    mock_issued: "???????? ???",
    rejected: "????????",
    paused: "???????????",
  };
  return map[status] || beautifyCode(status);
}

function formatTransactionType(type) {
  const map = {
    raffle_win: "??????? ? ????????",
    lucky_drop_win: "??????? ? Lucky Drop",
    withdrawal: "?????",
    deposit: "??????????",
    admin_credit: "?????????? ???????",
    admin_debit: "???????? ???????",
    task_reward: "??????? ?? ???????",
  };
  return map[type] || beautifyCode(type);
}

function formatError(code) {
  const map = {
    invalid_password: "???????? ??????.",
    admin_forbidden: "? ??? ??? ??????? ? ???????.",
    admin_required: "????? ?????? ????? ? ???????.",
    balance_admin_required: "??????? ???????? ?????? ? ??????? ?????? ???????.",
    balance_invalid_password: "???????? ?????? ??????.",
    prize_amount_required: "??????? ????? ????????.",
    prize_amount_too_small: "????? ??????? ????????? ??? ?????? ?????????? ???????????.",
    amount_required: "??????? ?????.",
    invalid_amount: "??????? ?????????? ?????.",
    player_not_found: "????? ?? ??????.",
    raffle_not_found: "??????? ?? ?????? ??? ??? ????????.",
    lucky_drop_not_found: "Lucky Drop ?? ??????.",
    lucky_drop_inactive: "Lucky Drop ??? ???????? ??? ??? ?? ???????.",
    lucky_drop_already_played: "????? ??? ??????????? ???? ????.",
    telegram_required: "???????? ?????????? ?????? Telegram.",
    insufficient_balance: "???????????? ??????? ?? ???????.",
    not_enough_coins: "???????????? ??????? ?? ???????.",
    "NOT ENOUGH COINS": "???????????? ??????? ?? ???????.",
    duplicate_participant: "?? ??? ?????????? ? ???? ????????.",
    withdrawal_not_found: "?????? ?? ????? ?? ???????.",
    not_found: "?????? ???????? ?? ???????.",
    internal_error: "???-?? ????? ?? ??? ?? ???????.",
  };
  return map[code] || map[String(code || "").toLowerCase()] || beautifyCode(code);
}

function formatPlayerError(code) {
  const map = {
    raffle_not_found: "???? ??????? ??? ??????????.",
    duplicate_participant: "?? ??? ?????????? ? ???? ????????.",
    telegram_required: "???????? ????-?????????? ?????? Telegram.",
    task_not_found: "??????? ??? ??????????.",
    task_already_completed: "??????? ?? ??? ??????? ??? ????????.",
    lucky_drop_not_found: "???? Lucky Drop ??? ??????????.",
    lucky_drop_inactive: "Lucky Drop ??? ??????????.",
    lucky_drop_already_played: "?? ??? ?????? ???? ???? ? ???? ????.",
    internal_error: "?? ?????????? ????????? ????????. ?????????? ??? ???.",
  };
  return map[code] || "?? ?????????? ????????? ????????. ?????????? ??? ???.";
}

function beautifyCode(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "Произошла ошибка.";
  }
  if (text.startsWith("http_")) {
    return "Ошибка запроса. Попробуйте еще раз.";
  }
  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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
