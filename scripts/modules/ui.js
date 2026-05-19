import { estimatedLatestSaldoEur, groupTransactions, summarize } from './analyzer.js';
import { applyCategoryToTransaction, buildBudgetPlan } from './budgetPlanner.js';
import {
  describeAnalyticsPeriod,
  dateToIsoInput,
  filterTransactionsByPeriod,
  getTransactionDateBounds,
} from './periodFilter.js';
import {
  LAST_BACKUP_EXPORT_KEY,
  backupFilenameSuggestion,
  buildBackupPayload,
  getLastBackupExportHint,
  parseMoneyCoachBackup,
  rememberBackupExportTimestamp,
  shareOrDownloadBackupJson,
} from './backup.js';
import { parseRevolutCsv } from './csvImporter.js';
import { NEW_CATEGORY_COLOR_ROTATION } from './config.js';
import {
  clearTransactions,
  loadCategories,
  loadSettings,
  loadTransactions,
  mergeTransactions,
  normalizeStoredCategories,
  normalizeStoredTransactions,
  saveCategories,
  saveSettings,
  saveTransactions,
} from './storage.js';
import {
  budgetCategoryPanel,
  budgetRow,
  budgetSummaryCard,
  coachCard,
  emptyState,
  expenseCategoriesModalBody,
  groupCard,
  merchantCard,
  metricCard,
  renderCategoryBreakdown,
  transactionCard,
} from './templates.js';
import { escapeHtml, formatMoney, setCategoryStyles, setText, showToast, sortCategories } from './utils.js';

const state = {
  transactions: [],
  activePage: 'dashboardPage',
  expenseView: 'grouped',
  expenseFilter: 'Tutte',
  expenseQuery: '',
  expandedCategories: new Set(),
  settings: {},
  categories: [],
};

/** Oggetto restituito da `parseMoneyCoachBackup` finché l’utente non conferma o chiude il modale. */
let pendingBackupRestore = null;

export async function initApp() {
  bindEvents();
  const [transactions, settings, categories] = await Promise.all([
    loadTransactions(),
    loadSettings(),
    loadCategories(),
  ]);
  state.transactions = transactions;
  state.settings = settings;
  state.categories = categories;
  setCategoryStyles(state.categories);
  render();
}

async function handleExportBackup() {
  const payload = buildBackupPayload(state);
  const json = JSON.stringify(payload, null, 2);
  const filename = backupFilenameSuggestion();
  const mode = await shareOrDownloadBackupJson(json, filename);
  if (mode === 'aborted') return;
  rememberBackupExportTimestamp();
  updateBackupHintDom();
  if (mode === 'share') {
    showToast('Backup condiviso. Salva il file in File o iCloud se non l’hai già fatto.');
  } else {
    showToast('Backup scaricato.');
  }
}

function formatBackupRestoreSummaryHtml(data) {
  let dateLabel = '—';
  if (data.exportedAt) {
    const d = new Date(data.exportedAt);
    if (!Number.isNaN(d.getTime())) {
      dateLabel = d.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
    }
  }
  const tx = Array.isArray(data.transactions) ? data.transactions.length : 0;
  const cat = Array.isArray(data.categories) ? data.categories.length : 0;
  return `<ul class="mb-0 ps-3"><li>Esportazione: ${escapeHtml(dateLabel)}</li><li>Transazioni nel file: ${tx}</li><li>Voci categorie nel file: ${cat}</li></ul>`;
}

function updateBackupHintDom() {
  const el = document.getElementById('backupLastHint');
  if (!el) return;
  const hint = getLastBackupExportHint();
  if (hint) {
    el.textContent = `Ultimo backup esportato: ${hint}`;
    el.classList.remove('d-none');
  } else {
    el.textContent = '';
    el.classList.add('d-none');
  }
}

async function executeBackupRestore() {
  if (!pendingBackupRestore) return;
  const data = pendingBackupRestore;
  state.transactions = normalizeStoredTransactions(data.transactions);
  state.categories = normalizeStoredCategories(data.categories);
  state.settings = data.settings;
  if (data.ui) {
    state.expenseView = data.ui.expenseView === 'list' ? 'list' : 'grouped';
    state.expenseFilter = typeof data.ui.expenseFilter === 'string' ? data.ui.expenseFilter : 'Tutte';
    state.expenseQuery = typeof data.ui.expenseQuery === 'string' ? data.ui.expenseQuery : '';
    state.expandedCategories = new Set(
      Array.isArray(data.ui.expandedCategories)
        ? data.ui.expandedCategories.filter((x) => typeof x === 'string')
        : [],
    );
  } else {
    state.expenseFilter = 'Tutte';
    state.expenseQuery = '';
    state.expandedCategories.clear();
  }
  await Promise.all([
    saveTransactions(state.transactions),
    saveCategories(state.categories),
    saveSettings(state.settings),
  ]);
  setCategoryStyles(state.categories);
  pendingBackupRestore = null;
  window.bootstrap?.Modal?.getInstance(document.getElementById('backupRestoreModal'))?.hide();
  syncPeriodInputsFromState();
  render();
  showToast(`Ripristino completato (${state.transactions.length} transazioni).`);
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activePage = button.dataset.page;
      renderNavigation();
      renderPages();
    });
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.expenseView = button.dataset.view;
      renderExpenses();
    });
  });

  document.getElementById('heroImportButton').addEventListener('click', openImporter);
  document.getElementById('csvInput').addEventListener('change', handleCsvImport);
  document.getElementById('expenseSearch').addEventListener('input', (event) => {
    state.expenseQuery = event.target.value;
    renderExpenses();
  });
  document.getElementById('monthlySavingsTarget').addEventListener('change', handleSavingsTargetChange);
  document.getElementById('clearDataButton').addEventListener('click', openClearDataModal);
  document.getElementById('confirmClearDataButton').addEventListener('click', executeClearLocalData);

  function syncMoneyCoachModalBlur() {
    const ids = ['periodFilterModal', 'clearDataModal', 'expenseCategoriesModal', 'backupRestoreModal'];
    const anyOpen = ids.some((id) => document.getElementById(id)?.classList.contains('show'));
    document.body.classList.toggle('mc-modal-blur-active', anyOpen);
  }

  const clearDataModalEl = document.getElementById('clearDataModal');
  clearDataModalEl.addEventListener('show.bs.modal', syncMoneyCoachModalBlur);
  clearDataModalEl.addEventListener('hidden.bs.modal', syncMoneyCoachModalBlur);

  document.getElementById('periodStartInput').addEventListener('change', handlePeriodInputsChange);
  document.getElementById('periodEndInput').addEventListener('change', handlePeriodInputsChange);
  document.getElementById('periodResetButton').addEventListener('click', resetAnalyticsPeriod);

  const periodModalEl = document.getElementById('periodFilterModal');
  periodModalEl.addEventListener('show.bs.modal', () => {
    syncMoneyCoachModalBlur();
    syncPeriodInputsFromState();
  });
  periodModalEl.addEventListener('hidden.bs.modal', syncMoneyCoachModalBlur);

  const expenseCategoriesModalEl = document.getElementById('expenseCategoriesModal');
  expenseCategoriesModalEl.addEventListener('show.bs.modal', () => {
    syncMoneyCoachModalBlur();
    mountExpenseCategoriesModal();
  });
  expenseCategoriesModalEl.addEventListener('hidden.bs.modal', syncMoneyCoachModalBlur);

  const backupRestoreModalEl = document.getElementById('backupRestoreModal');
  backupRestoreModalEl.addEventListener('show.bs.modal', syncMoneyCoachModalBlur);
  backupRestoreModalEl.addEventListener('hidden.bs.modal', () => {
    pendingBackupRestore = null;
    syncMoneyCoachModalBlur();
  });

  document.getElementById('openExpenseCategoriesModal').addEventListener('click', () => {
    window.bootstrap?.Modal?.getOrCreateInstance(expenseCategoriesModalEl)?.show();
  });

  document.getElementById('exportBackupButton').addEventListener('click', () => {
    handleExportBackup().catch((err) => {
      console.error(err);
      showToast('Impossibile creare il backup.');
    });
  });
  document.getElementById('importBackupButton').addEventListener('click', () => {
    document.getElementById('backupImportInput').click();
  });
  document.getElementById('backupImportInput').addEventListener('change', async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      pendingBackupRestore = parseMoneyCoachBackup(text);
      document.getElementById('backupRestoreSummary').innerHTML =
        formatBackupRestoreSummaryHtml(pendingBackupRestore);
      window.bootstrap?.Modal?.getOrCreateInstance(backupRestoreModalEl)?.show();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Backup non valido.');
    }
  });
  document.getElementById('confirmBackupRestoreButton').addEventListener('click', () => {
    executeBackupRestore().catch((err) => {
      console.error(err);
      showToast('Errore durante il ripristino.');
    });
  });

  const expensesPageEl = document.getElementById('expensesPage');
  expensesPageEl.addEventListener('show.bs.dropdown', (event) => {
    const toggle = event.target;
    if (!(toggle instanceof Element) || !toggle.matches('[data-bs-toggle="dropdown"]')) return;
    if (!expensesPageEl.contains(toggle)) return;
    expensesPageEl.querySelectorAll('[data-bs-toggle="dropdown"].show').forEach((openBtn) => {
      if (openBtn !== toggle) {
        window.bootstrap?.Dropdown?.getInstance(openBtn)?.hide();
      }
    });
  });

  expensesPageEl.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-pick-cat]');
    if (!btn || !expensesPageEl.contains(btn)) return;

    const wrapper = btn.closest('[data-transaction-picker]');
    if (!wrapper) return;

    let transactionId = '';
    try {
      transactionId = decodeURIComponent(wrapper.getAttribute('data-transaction-picker') || '');
    } catch {
      transactionId = wrapper.getAttribute('data-transaction-picker') || '';
    }
    let value = '';
    try {
      value = decodeURIComponent(btn.getAttribute('data-pick-cat') || '');
    } catch {
      value = btn.getAttribute('data-pick-cat') || '';
    }
    if (!value || !transactionId) return;

    const toggle = wrapper.querySelector('[data-bs-toggle="dropdown"]');
    if (toggle) window.bootstrap?.Dropdown?.getInstance(toggle)?.hide();

    const result = applyCategoryToTransaction(state.transactions, transactionId, value);
    state.transactions = result.transactions;
    await saveTransactions(state.transactions);
    render();
    showToast(
      result.affectedCount > 1
        ? `Ricategoria applicata a ${result.affectedCount} movimenti con la stessa voce.`
        : 'Spesa ricategorizzata.',
    );
  });
}

function mountExpenseCategoriesModal() {
  const body = document.getElementById('expenseCategoriesModalBody');
  if (!body) return;
  body.innerHTML = expenseCategoriesModalBody(state.categories);
  bindCategoryCreationForm(body);
  bindCategoryEditorListeners(body);
}

function refreshExpenseCategoriesModalIfOpen() {
  const modal = document.getElementById('expenseCategoriesModal');
  if (modal?.classList.contains('show')) {
    mountExpenseCategoriesModal();
  }
}

function openImporter() {
  document.getElementById('csvInput').click();
}

async function handleCsvImport(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const prevBounds = getTransactionDateBounds(state.transactions);

    const content = await file.text();
    const result = parseRevolutCsv(content);
    state.transactions = mergeTransactions(state.transactions, result.transactions);
    await saveTransactions(state.transactions);

    const periodExpanded = expandAnalyticsPeriodAfterMerge(prevBounds);
    if (periodExpanded) {
      await saveSettings(state.settings);
    }
    await applyDefaultPeriodFromCsvBoundsIfUnset();

    const afterCount = state.transactions.length;
    showToast(
      `CSV «${file.name}»: ${result.transactions.length} righe unite all’archivio (${afterCount} movimenti). Saltate in lettura: ${result.skippedRows}.${periodExpanded ? ' Intervallo «Al» aggiornato alla nuova ultima data.' : ''}`,
    );
    render();
  } catch (error) {
    showToast(`Import non riuscito: ${error.message || error}`);
  }
}

function openClearDataModal() {
  window.bootstrap?.Modal?.getOrCreateInstance(document.getElementById('clearDataModal'))?.show();
}

async function executeClearLocalData() {
  const confirmBtn = document.getElementById('confirmClearDataButton');
  const clearModalEl = document.getElementById('clearDataModal');
  const modalInst = window.bootstrap?.Modal?.getInstance(clearModalEl);

  confirmBtn.disabled = true;
  try {
    modalInst?.hide();
    await clearTransactions();
    try {
      localStorage.removeItem(LAST_BACKUP_EXPORT_KEY);
    } catch {
      /* ignore */
    }
    state.transactions = [];
    state.settings.analyticsPeriodStart = '';
    state.settings.analyticsPeriodEnd = '';
    await saveSettings(state.settings);
    state.expenseFilter = 'Tutte';
    state.expenseQuery = '';
    state.expandedCategories.clear();
    window.bootstrap?.Modal?.getInstance(document.getElementById('periodFilterModal'))?.hide();
    syncPeriodInputsFromState();
    showToast('Dati locali cancellati.');
    render();
  } finally {
    confirmBtn.disabled = false;
  }
}

function getScopedTransactions() {
  return filterTransactionsByPeriod(
    state.transactions,
    state.settings.analyticsPeriodStart || '',
    state.settings.analyticsPeriodEnd || '',
  );
}

/**
 * Dopo aver unito nuove righe, se il limite «Al» era agganciato alla vecchia ultima data
 * di completamento, lo sposta alla nuova data massima così il nuovo mese resta nell’analisi.
 */
function expandAnalyticsPeriodAfterMerge(prevBounds) {
  const nextBounds = getTransactionDateBounds(state.transactions);
  if (!prevBounds?.max || !nextBounds?.max) return false;
  if (nextBounds.max.getTime() <= prevBounds.max.getTime()) return false;

  const prevIso = dateToIsoInput(prevBounds.max);
  const nextIso = dateToIsoInput(nextBounds.max);
  const hasFilter = Boolean(state.settings.analyticsPeriodStart || state.settings.analyticsPeriodEnd);
  if (!hasFilter) return false;

  if (state.settings.analyticsPeriodEnd === prevIso) {
    state.settings.analyticsPeriodEnd = nextIso;
    return true;
  }
  return false;
}

function syncPeriodInputsFromState() {
  const startEl = document.getElementById('periodStartInput');
  const endEl = document.getElementById('periodEndInput');
  startEl.value = state.settings.analyticsPeriodStart || '';
  endEl.value = state.settings.analyticsPeriodEnd || '';
}

async function handlePeriodInputsChange() {
  let start = document.getElementById('periodStartInput').value;
  let end = document.getElementById('periodEndInput').value;
  const bounds = getTransactionDateBounds(state.transactions);
  if (bounds.min && bounds.max) {
    const minS = dateToIsoInput(bounds.min);
    const maxS = dateToIsoInput(bounds.max);
    if (start && start < minS) start = minS;
    if (start && start > maxS) start = maxS;
    if (end && end < minS) end = minS;
    if (end && end > maxS) end = maxS;
  }
  if (start && end && start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  state.settings.analyticsPeriodStart = start;
  state.settings.analyticsPeriodEnd = end;
  syncPeriodInputsFromState();
  await saveSettings(state.settings);
  render();
}

async function resetAnalyticsPeriod() {
  state.settings.analyticsPeriodStart = '';
  state.settings.analyticsPeriodEnd = '';
  syncPeriodInputsFromState();
  await saveSettings(state.settings);
  render();
}

/** Se l’utente non ha mai ristretto il periodo, ancorarlo agli estremi ricavati dal CSV (startedAt/completedAt). */
async function applyDefaultPeriodFromCsvBoundsIfUnset() {
  if (state.settings.analyticsPeriodStart || state.settings.analyticsPeriodEnd) return;
  const bounds = getTransactionDateBounds(state.transactions);
  if (!bounds.min || !bounds.max) return;
  state.settings.analyticsPeriodStart = dateToIsoInput(bounds.min);
  state.settings.analyticsPeriodEnd = dateToIsoInput(bounds.max);
  syncPeriodInputsFromState();
  await saveSettings(state.settings);
}

function categorySpendingInPeriod(transactions, categoryName) {
  return transactions
    .filter((item) => item.countsAsSpending && item.category === categoryName)
    .reduce((acc, item) => acc + item.absoluteAmount, 0);
}

function render() {
  renderNavigation();
  renderPages();
  renderDashboard();
  renderExpenses();
  renderBudget();
  renderCoach();
  updateBackupHintDom();
}

function renderNavigation() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === state.activePage);
  });
}

function renderPages() {
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.toggle('active', page.id === state.activePage);
  });
}

function renderDashboard() {
  const hasFullData = state.transactions.length > 0;
  const bounds = getTransactionDateBounds(state.transactions);
  const periodLine = describeAnalyticsPeriod(
    state.settings.analyticsPeriodStart || '',
    state.settings.analyticsPeriodEnd || '',
    bounds,
  );
  const scoped = getScopedTransactions();
  const summary = summarize(scoped, { totalImportedCount: state.transactions.length });
  const saldoEur = estimatedLatestSaldoEur(state.transactions);
  const heroBalance = saldoEur != null ? saldoEur : summary.net;

  const heroPeriodEl = document.getElementById('heroPeriodLabel');
  const heroCopyEl = document.getElementById('heroCopy');
  document.getElementById('openPeriodModalBtn').classList.toggle('d-none', !hasFullData);

  heroPeriodEl.classList.toggle('d-none', !hasFullData);
  heroPeriodEl.textContent =
    hasFullData && periodLine ? `Periodo di calcolo: ${periodLine}` : '';
  if (hasFullData && bounds.min && bounds.max) {
    const isoMin = dateToIsoInput(bounds.min);
    const isoMax = dateToIsoInput(bounds.max);
    const startEl = document.getElementById('periodStartInput');
    const endEl = document.getElementById('periodEndInput');
    startEl.min = isoMin;
    startEl.max = isoMax;
    endEl.min = isoMin;
    endEl.max = isoMax;
  }
  syncPeriodInputsFromState();

  setText('heroKicker', hasFullData ? 'Saldo (ultimo movimento)' : '');
  setText('heroAmount', hasFullData ? formatMoney(heroBalance) : 'Importa CSV');
  setText(
    'heroCopy',
    hasFullData ? '' : 'Carica l’export in .csv di Revolut. Il coach categorizza, salva e analizza tutto nel browser.',
  );
  heroCopyEl.classList.toggle('d-none', hasFullData);
  const heroImportBtn = document.getElementById('heroImportButton');
  heroImportBtn.classList.remove('d-none');
  if (hasFullData) {
    heroImportBtn.innerHTML =
      '<i class="fa-solid fa-file-circle-plus me-2"></i>Carica CSV';
    heroImportBtn.className = 'btn btn-outline-light btn-sm fw-bold mt-2';
  } else {
    heroImportBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down me-2"></i>Importa CSV';
    heroImportBtn.className = 'btn btn-light btn-sm fw-bold';
  }

  document.getElementById('metricGrid').innerHTML = [
    metricCard('Entrate', formatMoney(summary.income), 'fa-plus-square', '#b80022'),
    metricCard('Uscite', formatMoney(summary.spending), 'fa-arrow-up-right-from-square', '#b80022'),
  ].join('');

  setText('categoryCount', hasFullData ? 'Auto' : 'In attesa');
  document.getElementById('categoryBreakdown').innerHTML = !hasFullData
    ? emptyState(
        'fa-file-csv',
        'Nessun CSV importato',
        'Scegli l’export Revolut in formato CSV. Lo leggerò e lo salverò localmente.',
      )
    : Object.keys(summary.categoryTotals).length
      ? renderCategoryBreakdown(summary.categoryTotals)
      : emptyState(
          'fa-calendar-xmark',
          'Niente in questo periodo',
          'Apri il modale calendario in alto sulla Home per allargare «Dal»/«Al» o clicca Tutti i dati.',
        );

  setText('coachCount', `${summary.coachNotes.length} note`);
  document.getElementById('coachPreview').innerHTML = summary.coachNotes.slice(0, 2).map(coachCard).join('');
}

function renderExpenses() {
  closeAllExpenseCategoryDropdowns();

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === state.expenseView);
  });

  const scoped = getScopedTransactions();
  const base = scoped.filter(
    (item) => item.countsAsSpending || (item.isIncome && !item.isInternalTransfer),
  );
  const categories = ['Tutte', ...sortCategories([...new Set(base.map((item) => item.category))])];
  document.getElementById('categoryFilters').innerHTML = categories
    .map(
      (category) =>
        `<button class="btn btn-sm rounded-pill ${state.expenseFilter === category ? 'btn-brand' : 'btn-outline-secondary'}" type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`,
    )
    .join('');
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.expenseFilter = button.dataset.filter;
      renderExpenses();
    });
  });

  const query = state.expenseQuery.trim().toLowerCase();
  const filtered = base
    .filter((item) => state.expenseFilter === 'Tutte' || item.category === state.expenseFilter)
    .filter((item) => matchesExpenseSearch(item, query))
    .sort((a, b) => b.completedAt - a.completedAt);

  const container = document.getElementById('expensesList');
  const scopedSpend = getScopedTransactions().filter(
    (item) => item.countsAsSpending || (item.isIncome && !item.isInternalTransfer),
  );
  if (filtered.length === 0) {
    container.innerHTML =
      scopedSpend.length === 0
        ? emptyState(
            'fa-calendar-xmark',
            'Nessun movimento nel periodo',
            'Apri il modale dalla Home (icona calendario) o clicca Tutti i dati.',
          )
        : emptyState(
            'fa-magnifying-glass-chart',
            'Nessuna spesa trovata',
            'Prova un’altra ricerca o cambia filtro.',
          );
    return;
  }

  container.innerHTML =
    state.expenseView === 'grouped'
      ? groupTransactions(filtered)
          .map((group) => groupCard(group, state.expandedCategories.has(group.category), state.categories))
          .join('')
      : filtered.map((item) => transactionCard(item, state.categories)).join('');

  document.querySelectorAll('[data-group]').forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.group;
      if (state.expandedCategories.has(category)) {
        state.expandedCategories.delete(category);
      } else {
        state.expandedCategories.add(category);
      }
      renderExpenses();
    });
  });
}

function renderBudget() {
  const scoped = getScopedTransactions();
  const summary = summarize(scoped, { totalImportedCount: state.transactions.length });
  const plan = buildBudgetPlan(scoped, state.categories, state.settings);
  setText(
    'budgetIntro',
    `Spesa nel periodo filtrato: ${formatMoney(summary.spending)} distribuita su ${plan.monthCount} mesi. Budget e medi si basano su questa finestra.`,
  );
  document.getElementById('monthlySavingsTarget').value = state.settings.monthlySavingsTarget || 0;
  document.getElementById('budgetSummary').innerHTML = budgetSummaryCard(plan);
  document.getElementById('budgetList').innerHTML = plan.rows
    .map((row) =>
      budgetRow(
        row.name,
        categorySpendingInPeriod(scoped, row.name),
        row.budget,
        row.average,
        row.suggested,
      ),
    )
    .join('');
  document.getElementById('categoryManager').innerHTML = budgetCategoryPanel(state.categories);
  bindBudgetControls();
}

function renderCoach() {
  const scoped = getScopedTransactions();
  const summary = summarize(scoped, { totalImportedCount: state.transactions.length });
  document.getElementById('coachList').innerHTML = summary.coachNotes.map(coachCard).join('');
  setText('merchantCount', String(summary.topMerchants.length));
  document.getElementById('merchantList').innerHTML = summary.topMerchants.length
    ? summary.topMerchants.slice(0, 8).map(merchantCard).join('')
    : emptyState(
        'fa-shop',
        'Nessun esercente',
        state.transactions.length === 0
          ? 'Importa un CSV per vedere gli esercenti più presenti.'
          : 'Prova un altro periodo o allarga «Dal»/«Al» dal modale sulla Home.',
      );
}

function matchesExpenseSearch(item, query) {
  if (!query) return true;
  return (
    item.description.toLowerCase().includes(query) ||
    item.category.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query) ||
    formatMoney(item.absoluteAmount).toLowerCase().includes(query)
  );
}

function bindBudgetControls() {
  const root = document.getElementById('categoryManager');
  if (!root) return;
  root.querySelector('[data-add-category-budget]')?.addEventListener('click', async () => {
    const name = uniqueCategoryName('Nuova categoria');
    state.categories.push({
      id: slugCategory(name),
      name,
      color: NEW_CATEGORY_COLOR_ROTATION[state.categories.length % NEW_CATEGORY_COLOR_ROTATION.length],
      icon: 'fa-tag',
      monthlyGoal: 0,
    });
    await persistCategories();
    render();
    refreshExpenseCategoriesModalIfOpen();
    showToast('Categoria veloce aggiunta: personalizza nome e icona da Spese → Gestisci categorie.');
  });
  bindCategoryEditorListeners(root);
}

/**
 * Form «Nuova categoria» nel modale Spese (icona + Crea).
 */
function bindCategoryCreationForm(root) {
  const picker = root.querySelector('.mc-icon-picker');
  const nameInput = root.querySelector('#newCategoryNameInput');
  const createBtn = root.querySelector('[data-create-category]');

  /** @type {HTMLElement[]} */
  const pickBtns = picker ? [...picker.querySelectorAll('[data-picker-icon]')] : [];

  let selectedIcon = pickBtns[0]?.dataset.pickerIcon || 'fa-circle';

  function setSelected(btn) {
    selectedIcon = btn.dataset.pickerIcon || selectedIcon;
    pickBtns.forEach((b) => {
      b.classList.toggle('mc-icon-pick--selected', b === btn);
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
  }

  pickBtns.forEach((btn) => {
    btn.addEventListener('click', () => setSelected(btn));
  });

  createBtn?.addEventListener('click', async () => {
    const raw = (nameInput?.value || '').trim();
    if (!raw) {
      showToast('Inserisci un nome per la categoria.');
      nameInput?.focus();
      return;
    }
    if (state.categories.some((c) => c.name.toLowerCase() === raw.toLowerCase())) {
      showToast('Esiste già una categoria con questo nome.');
      return;
    }
    const name = raw.length > 48 ? raw.slice(0, 48) : raw;
    state.categories.push({
      id: slugCategory(name),
      name,
      color: NEW_CATEGORY_COLOR_ROTATION[state.categories.length % NEW_CATEGORY_COLOR_ROTATION.length],
      icon: selectedIcon,
      monthlyGoal: 0,
    });
    await persistCategories();
    render();
    refreshExpenseCategoriesModalIfOpen();
    showToast('Categoria creata.');
    if (nameInput) nameInput.value = '';
    if (pickBtns[0]) setSelected(pickBtns[0]);
  });
}

async function deleteCategoryByName(categoryName) {
  if (state.categories.length <= 1) {
    showToast('Serve almeno una categoria.');
    return;
  }
  const exists = state.categories.some((c) => c.name === categoryName);
  if (!exists) return;
  const fallback =
    state.categories.find((c) => c.name === 'Altro' && c.name !== categoryName) ||
    state.categories.find((c) => c.name !== categoryName);
  if (!fallback) return;

  const ok = window.confirm(
    `Eliminare «${categoryName}»?\nLe spese e le riclassifiche useranno la categoria «${fallback.name}».`,
  );
  if (!ok) return;

  state.categories = state.categories.filter((c) => c.name !== categoryName);
  state.transactions = state.transactions.map((item) =>
    item.category === categoryName ? { ...item, category: fallback.name } : item,
  );
  await Promise.all([persistCategories(), saveTransactions(state.transactions)]);
  render();
  refreshExpenseCategoriesModalIfOpen();
  showToast(`Categoria «${categoryName}» eliminata.`);
}

/**
 * Elenco modificabile delle categorie (rinomina, obiettivo, elimina) dentro `root`.
 */
function bindCategoryEditorListeners(root) {
  if (!root) return;

  root.querySelectorAll('[data-category-name]').forEach((input) => {
    input.addEventListener('change', async () => {
      const previousName = input.dataset.categoryName;
      const nextName = input.value.trim();
      if (!nextName) {
        input.value = previousName;
        return;
      }
      if (
        nextName !== previousName &&
        state.categories.some((c) => c.name === nextName)
      ) {
        input.value = previousName;
        showToast('Esiste già una categoria con questo nome.');
        return;
      }

      state.categories = state.categories.map((category) =>
        category.name === previousName
          ? {
              ...category,
              id: slugCategory(nextName),
              name: nextName,
            }
          : category,
      );
      state.transactions = state.transactions.map((item) =>
        item.category === previousName ? { ...item, category: nextName } : item,
      );
      await Promise.all([persistCategories(), saveTransactions(state.transactions)]);
      render();
      refreshExpenseCategoriesModalIfOpen();
      showToast('Categoria rinominata.');
    });
  });

  root.querySelectorAll('[data-category-goal]').forEach((input) => {
    input.addEventListener('change', async () => {
      const categoryName = input.dataset.categoryGoal;
      state.categories = state.categories.map((category) =>
        category.name === categoryName
          ? {
              ...category,
              monthlyGoal: Number(input.value) || 0,
            }
          : category,
      );
      await persistCategories();
      render();
      refreshExpenseCategoriesModalIfOpen();
      showToast('Obiettivo categoria aggiornato.');
    });
  });

  root.querySelectorAll('[data-delete-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nm = btn.getAttribute('data-delete-category');
      if (nm) deleteCategoryByName(nm);
    });
  });
}

async function handleSavingsTargetChange(event) {
  state.settings.monthlySavingsTarget = Number(event.target.value) || 0;
  await saveSettings(state.settings);
  renderBudget();
  showToast('Obiettivo di risparmio aggiornato.');
}

/** Chiude tutti i dropdown categoria Bootstrap sulla pagina Spese (prima di un nuovo render). */
function closeAllExpenseCategoryDropdowns() {
  const root = document.getElementById('expensesPage');
  if (!root) return;
  root.querySelectorAll('[data-bs-toggle="dropdown"]').forEach((toggle) => {
    window.bootstrap?.Dropdown?.getInstance(toggle)?.hide();
  });
}

async function persistCategories() {
  setCategoryStyles(state.categories);
  await saveCategories(state.categories);
}

function uniqueCategoryName(baseName) {
  const names = new Set(state.categories.map((category) => category.name));
  if (!names.has(baseName)) return baseName;
  let counter = 2;
  while (names.has(`${baseName} ${counter}`)) counter += 1;
  return `${baseName} ${counter}`;
}

function slugCategory(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
