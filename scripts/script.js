const STORAGE_KEY = 'moneyCoachWeb.transactions.v1';

const categoryOrder = [
  'Casa',
  'Spesa',
  'Ristoranti',
  'Trasporti',
  'Shopping',
  'Abbonamenti',
  'Salute',
  'Viaggi',
  'Entrate',
  'Trasferimenti',
  'Altro',
];

const categoryColors = {
  Casa: '#116a4a',
  Spesa: '#0e7c7b',
  Ristoranti: '#e36f54',
  Trasporti: '#547aa5',
  Shopping: '#8a6f3e',
  Abbonamenti: '#7a5ea7',
  Salute: '#d05d86',
  Viaggi: '#4b8f8c',
  Entrate: '#b80022',
  Trasferimenti: '#8d9691',
  Altro: '#66736d',
};

const categoryIcons = {
  Casa: 'fa-house',
  Spesa: 'fa-cart-shopping',
  Ristoranti: 'fa-utensils',
  Trasporti: 'fa-bus',
  Shopping: 'fa-bag-shopping',
  Abbonamenti: 'fa-repeat',
  Salute: 'fa-heart-pulse',
  Viaggi: 'fa-plane',
  Entrate: 'fa-arrow-down-left',
  Trasferimenti: 'fa-right-left',
  Altro: 'fa-tag',
};

const budgets = {
  Casa: 650,
  Spesa: 420,
  Ristoranti: 260,
  Trasporti: 180,
  Shopping: 180,
  Abbonamenti: 90,
  Salute: 120,
  Viaggi: 250,
  Altro: 160,
};

const state = {
  transactions: [],
  activePage: 'dashboardPage',
  expenseView: 'grouped',
  expenseFilter: 'Tutte',
  expenseQuery: '',
  expandedCategories: new Set(),
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  state.transactions = loadTransactions();
  render();
});

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

  document.getElementById('importButton').addEventListener('click', openImporter);
  document.getElementById('heroImportButton').addEventListener('click', openImporter);
  document.getElementById('csvInput').addEventListener('change', handleCsvImport);
  document.getElementById('expenseSearch').addEventListener('input', (event) => {
    state.expenseQuery = event.target.value;
    renderExpenses();
  });
  document.getElementById('clearDataButton').addEventListener('click', clearData);
}

function openImporter() {
  document.getElementById('csvInput').click();
}

async function handleCsvImport(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const content = await file.text();
    const result = parseRevolutCsv(content);
    state.transactions = mergeTransactions(state.transactions, result.transactions);
    saveTransactions(state.transactions);
    showToast(`Importate ${result.transactions.length} righe da ${file.name}. Saltate: ${result.skippedRows}.`);
    render();
  } catch (error) {
    showToast(`Import non riuscito: ${error.message || error}`);
  }
}

function clearData() {
  if (!window.confirm('Cancellare tutte le transazioni salvate in questo browser?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state.transactions = [];
  state.expenseFilter = 'Tutte';
  state.expenseQuery = '';
  state.expandedCategories.clear();
  showToast('Dati locali cancellati.');
  render();
}

function render() {
  renderNavigation();
  renderPages();
  renderDashboard();
  renderExpenses();
  renderBudget();
  renderCoach();
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
  const summary = summarize(state.transactions);
  const hasData = state.transactions.length > 0;

  setText('heroKicker', hasData ? 'Uscite importate' : 'Importa CSV da Revolut.');
  setText('heroAmount', hasData ? formatMoney(summary.spending) : '');
  setText(
    'heroCopy',
    hasData
      ? `Entrate: ${formatMoney(summary.income)}. Netto: ${formatMoney(summary.net)}. Trasferimenti interni esclusi dalle spese.`
      : 'Carica l’export CSV di Revolut. Il coach categorizza, salva e analizza tutto nel browser.',
  );
  document.getElementById('heroImportButton').classList.toggle('d-none', hasData);

  document.getElementById('metricGrid').innerHTML = [
    metricCard('Uscite', formatMoney(summary.spending), 'fa-arrow-up-right-from-square', '#e36f54'),
    metricCard('Entrate', formatMoney(summary.income), 'fa-arrow-down-left', '#b80022'),
    metricCard('Saldo netto', formatMoney(summary.net), 'fa-equals', summary.net >= 0 ? '#b80022' : '#e36f54'),
    metricCard('Categorie', String(Object.keys(summary.categoryTotals).length), 'fa-tags', '#0e7c7b'),
  ].join('');

  setText('categoryCount', hasData ? 'Auto' : 'In attesa');
  document.getElementById('categoryBreakdown').innerHTML = hasData
    ? renderCategoryBreakdown(summary.categoryTotals)
    : emptyState('fa-file-csv', 'Nessun CSV importato', 'Scegli l’export Revolut in formato CSV. Lo leggerò e lo salverò localmente.');

  setText('coachCount', `${summary.coachNotes.length} note`);
  document.getElementById('coachPreview').innerHTML = summary.coachNotes.slice(0, 2).map(coachCard).join('');
}

function renderExpenses() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === state.expenseView);
  });

  const base = state.transactions.filter((item) => item.countsAsSpending || (item.isIncome && !item.isInternalTransfer));
  const categories = ['Tutte', ...sortCategories([...new Set(base.map((item) => item.category))])];
  document.getElementById('categoryFilters').innerHTML = categories
    .map((category) => `<button class="btn btn-sm rounded-pill ${state.expenseFilter === category ? 'btn-brand' : 'btn-outline-secondary'}" type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
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
  if (filtered.length === 0) {
    container.innerHTML = emptyState('fa-magnifying-glass-chart', 'Nessuna spesa trovata', 'Prova un’altra ricerca o cambia filtro.');
    return;
  }

  container.innerHTML = state.expenseView === 'grouped'
    ? groupTransactions(filtered).map(groupCard).join('')
    : filtered.map(transactionCard).join('');

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
  const summary = summarize(state.transactions);
  setText('budgetIntro', `Spesa analizzata: ${formatMoney(summary.spending)}. Il coach confronta ogni categoria con un limite sano.`);
  document.getElementById('budgetList').innerHTML = Object.entries(budgets)
    .map(([category, budget]) => budgetRow(category, summary.categoryTotals[category] || 0, budget))
    .join('');
}

function renderCoach() {
  const summary = summarize(state.transactions);
  document.getElementById('coachList').innerHTML = summary.coachNotes.map(coachCard).join('');
  setText('merchantCount', String(summary.topMerchants.length));
  document.getElementById('merchantList').innerHTML = summary.topMerchants.length
    ? summary.topMerchants.slice(0, 8).map(merchantCard).join('')
    : emptyState('fa-shop', 'Nessun esercente', 'Importa un CSV per vedere gli esercenti più presenti.');
}

function parseRevolutCsv(content) {
  const rows = parseCsv(content);
  if (rows.length <= 1) return { transactions: [], skippedRows: 0 };

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const transactions = [];
  let skippedRows = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.every((cell) => cell.trim() === '')) continue;

    try {
      const values = {};
      headers.forEach((header, col) => {
        values[header] = (row[col] || '').trim();
      });

      const type = values.tipo || '';
      const product = values.prodotto || '';
      const startedAt = parseDate(values['data di inizio']);
      const completedAt = parseDate(values['data di completamento']);
      const description = values.descrizione || '';
      const amount = parseNumber(values.importo);
      const fee = parseNumber(values.costo);
      const currency = values.valuta || 'EUR';
      const rowState = values.state || values.stato || '';
      const balance = parseNumber(values.saldo);

      transactions.push(enrichTransaction({
        id: [completedAt.toISOString(), description, amount.toFixed(2), balance.toFixed(2)].join('|'),
        type,
        product,
        startedAt,
        completedAt,
        description,
        amount,
        fee,
        currency,
        state: rowState,
        balance,
        category: inferCategory(description, type, amount),
      }));
    } catch {
      skippedRows += 1;
    }
  }

  transactions.sort((a, b) => b.completedAt - a.completedAt);
  return { transactions, skippedRows };
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1] || '';

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function enrichTransaction(item) {
  const normalized = item.description.toLowerCase();
  const isCompleted = item.state.toUpperCase().includes('COMPLETATO');
  const isIncome = item.amount > 0;
  const isInternalTransfer = normalized.includes('conto potenziato')
    || normalized.includes('trasferimento')
    || normalized.startsWith('da eur')
    || normalized.startsWith('a eur');

  return {
    ...item,
    isCompleted,
    isIncome,
    isExpense: item.amount < 0,
    isInternalTransfer,
    countsAsSpending: isCompleted && item.amount < 0 && !isInternalTransfer,
    absoluteAmount: Math.abs(item.amount),
  };
}

function inferCategory(description, type, amount) {
  const text = `${description} ${type}`.toLowerCase();
  if (amount > 0) return 'Entrate';
  if (hasAny(text, ['conto potenziato', 'trasferimento']) || text.startsWith('a eur') || text.startsWith('da eur')) return 'Trasferimenti';
  if (hasAny(text, ['sisa', 'esselunga', 'coop', 'md ', 'supermercati'])) return 'Spesa';
  if (hasAny(text, ['farmacia', 'asl', 'cup', 'medic', 'dott'])) return 'Salute';
  if (hasAny(text, ['ristorante', 'pizzeria', 'pizza', 'kfc', 'deliveroo', 'gelateria', 'bar ', 'cafe'])) return 'Ristoranti';
  if (hasAny(text, ['fastweb', 'apple', 'spotify', 'netflix', 'icloud'])) return 'Abbonamenti';
  if (hasAny(text, ['tamoil', 'trenitalia', 'atm', 'taxi', 'benzina'])) return 'Trasporti';
  if (hasAny(text, ['amazon', 'action', 'pepco', 'lefties', 'happy casa', 'store', 'negozio'])) return 'Shopping';
  if (hasAny(text, ['hotel', 'booking', 'airbnb', 'ryanair', 'easyjet'])) return 'Viaggi';
  return 'Altro';
}

function summarize(transactions) {
  const completed = transactions.filter((item) => item.isCompleted);
  const spendingRows = completed.filter((item) => item.countsAsSpending);
  const incomeRows = completed.filter((item) => item.isIncome && !item.isInternalTransfer);
  const transferRows = completed.filter((item) => item.isInternalTransfer);
  const categoryTotals = {};
  const merchants = {};

  spendingRows.forEach((item) => {
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.absoluteAmount;
    merchants[item.description] ||= { name: item.description, count: 0, total: 0, category: item.category };
    merchants[item.description].count += 1;
    merchants[item.description].total += item.absoluteAmount;
  });

  const topMerchants = Object.values(merchants).sort((a, b) => b.total - a.total);
  const recurring = topMerchants.filter((item) => item.count >= 2).sort((a, b) => b.count - a.count);
  const income = sum(incomeRows, 'absoluteAmount');
  const spending = sum(spendingRows, 'absoluteAmount');

  return {
    income,
    spending,
    net: income - spending,
    internalTransfers: sum(transferRows, 'absoluteAmount'),
    completedCount: completed.length,
    cancelledCount: transactions.length - completed.length,
    categoryTotals,
    topMerchants,
    recurringCandidates: recurring,
    coachNotes: buildCoachNotes(categoryTotals, recurring, spendingRows.length),
  };
}

function buildCoachNotes(categoryTotals, recurring, spendingCount) {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return [{ title: 'Importa il primo CSV', body: 'Quando carichi un export Revolut, il coach crea categorie, budget e insight locali.', kind: 'info' }];
  }

  const [topCategory, topValue] = entries[0];
  const notes = [
    { title: 'Categoria dominante', body: `${topCategory} è la voce più alta del periodo: ${formatMoney(topValue)}. È il primo punto da guardare se vuoi ridurre le uscite.`, kind: 'warning' },
    { title: 'Movimenti analizzati', body: `Ho letto ${spendingCount} spese reali, escludendo trasferimenti interni e operazioni non completate.`, kind: 'good' },
  ];

  if (recurring.length) {
    notes.push({ title: 'Possibili ricorrenti', body: `Questi esercenti compaiono più volte: ${recurring.slice(0, 3).map((item) => item.name).join(', ')}.`, kind: 'info' });
  }

  const restaurants = categoryTotals.Ristoranti || 0;
  if (restaurants > 100) {
    notes.push({ title: 'Fuori casa sotto controllo', body: `Ristoranti e delivery superano ${formatMoney(restaurants)}. Un tetto settimanale può dare un risparmio rapido.`, kind: 'warning' });
  }

  return notes;
}

function groupTransactions(transactions) {
  const grouped = {};
  transactions.forEach((item) => {
    grouped[item.category] ||= [];
    grouped[item.category].push(item);
  });

  return Object.entries(grouped)
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => b.completedAt - a.completedAt),
      total: sum(items, 'absoluteAmount'),
    }))
    .sort((a, b) => {
      if (a.category === 'Entrate') return 1;
      if (b.category === 'Entrate') return -1;
      if (a.category === 'Trasferimenti') return 1;
      if (b.category === 'Trasferimenti') return -1;
      return b.total - a.total;
    });
}

function metricCard(label, value, icon, color) {
  return `<div class="col-6">
    <article class="card metric-card border-0 h-100">
      <div class="card-body">
        <i class="fa-solid ${icon}" style="color:${color}"></i>
        <div>
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </div>
      </div>
    </article>
  </div>`;
}

function renderCategoryBreakdown(categoryTotals) {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, value]) => acc + value, 0);
  return `<article class="card data-card border-0"><div class="card-body">${entries.slice(0, 7).map(([category, value]) => {
    const percent = total ? (value / total) * 100 : 0;
    return `<div class="breakdown-row">
      <div class="breakdown-label">
        <span class="dot" style="background:${colorFor(category)}"></span>
        <strong>${escapeHtml(category)}</strong>
        <span>${formatMoney(value)}</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${percent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${percent}%;background:${colorFor(category)}"></div></div>
    </div>`;
  }).join('')}</div></article>`;
}

function groupCard(group) {
  const expanded = state.expandedCategories.has(group.category);
  return `<article class="card data-card group-card border-0">
    <button class="btn group-head d-flex align-items-center gap-3 text-start" type="button" data-group="${escapeHtml(group.category)}">
      <span class="category-icon" style="background:${alpha(colorFor(group.category), 0.14)};color:${colorFor(group.category)}">
        <i class="fa-solid ${iconFor(group.category)}"></i>
      </span>
      <span class="group-title flex-grow-1 min-w-0">
        <strong>${escapeHtml(group.category)}</strong>
        <small class="text-secondary">${group.items.length} movimenti</small>
      </span>
      <span class="group-total text-end">
        <strong>${formatMoney(group.total)}</strong>
        <i class="fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
      </span>
    </button>
    ${expanded ? `<div class="list-group list-group-flush compact-list">${group.items.map(compactTransactionRow).join('')}</div>` : ''}
  </article>`;
}

function transactionCard(item) {
  const color = item.isIncome ? '#b80022' : colorFor(item.category);
  return `<article class="card data-card transaction-card border-0">
    <span class="category-icon" style="background:${alpha(color, 0.14)};color:${color}">
      <i class="fa-solid ${iconFor(item.category)}"></i>
    </span>
    <span class="transaction-main flex-grow-1 min-w-0">
      <strong>${escapeHtml(item.description)}</strong>
      <small class="text-secondary">${escapeHtml(item.category)} · ${dateLabel(item.completedAt)}</small>
    </span>
    <strong class="transaction-amount" style="color:${color}">${item.isIncome ? '+' : '-'}${formatMoney(item.absoluteAmount)}</strong>
  </article>`;
}

function compactTransactionRow(item) {
  const color = item.isIncome ? '#b80022' : colorFor(item.category);
  return `<div class="list-group-item compact-row">
    <span class="text-secondary">${dateLabel(item.completedAt)}</span>
    <strong>${escapeHtml(item.description)}</strong>
    <em style="color:${color}">${item.isIncome ? '+' : '-'}${formatMoney(item.absoluteAmount)}</em>
  </div>`;
}

function budgetRow(category, spent, budget) {
  const ratio = budget ? Math.min(spent / budget, 1) : 0;
  const left = budget - spent;
  return `<article class="card data-card budget-row border-0">
    <div class="card-body">
    <div class="breakdown-label">
      <span class="dot" style="background:${colorFor(category)}"></span>
      <strong>${escapeHtml(category)}</strong>
      <span>${formatMoney(spent)} / ${formatMoney(budget)}</span>
    </div>
    <div class="progress" role="progressbar" aria-valuenow="${(ratio * 100).toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${ratio * 100}%;background:${ratio > 0.86 ? '#e36f54' : colorFor(category)}"></div></div>
    <small class="text-secondary">${left >= 0 ? `Restano ${formatMoney(left)}` : `Sopra di ${formatMoney(Math.abs(left))}`}</small>
    </div>
  </article>`;
}

function coachCard(note) {
  const tone = note.kind === 'good' ? '#b80022' : note.kind === 'warning' ? '#e36f54' : '#547aa5';
  const icon = note.kind === 'good' ? 'fa-circle-check' : note.kind === 'warning' ? 'fa-circle-exclamation' : 'fa-lightbulb';
  return `<article class="card data-card coach-card border-0">
    <div class="card-body d-flex align-items-start gap-3">
    <span class="category-icon" style="background:${alpha(tone, 0.14)};color:${tone}">
      <i class="fa-solid ${icon}"></i>
    </span>
    <span class="flex-grow-1 min-w-0">
      <strong>${escapeHtml(note.title)}</strong>
      <small class="text-secondary">${escapeHtml(note.body)}</small>
    </span>
    </div>
  </article>`;
}

function merchantCard(item) {
  return `<article class="card data-card merchant-card border-0">
    <div class="card-body d-flex align-items-center gap-3">
    <span class="dot" style="background:${colorFor(item.category)}"></span>
    <span class="flex-grow-1 min-w-0">
      <strong>${escapeHtml(item.name)}</strong>
      <small class="text-secondary">${item.count} movimenti · ${escapeHtml(item.category)}</small>
    </span>
    <strong>${formatMoney(item.total)}</strong>
    </div>
  </article>`;
}

function emptyState(icon, title, body) {
  return `<article class="card data-card empty-state border-0">
    <div class="card-body">
    <i class="fa-solid ${icon}"></i>
    <strong>${escapeHtml(title)}</strong>
    <small class="text-secondary">${escapeHtml(body)}</small>
    </div>
  </article>`;
}

function matchesExpenseSearch(item, query) {
  if (!query) return true;
  return item.description.toLowerCase().includes(query)
    || item.category.toLowerCase().includes(query)
    || item.type.toLowerCase().includes(query)
    || formatMoney(item.absoluteAmount).toLowerCase().includes(query);
}

function mergeTransactions(current, incoming) {
  const byId = new Map();
  current.forEach((item) => byId.set(item.id, item));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => b.completedAt - a.completedAt);
}

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw).map((item) => enrichTransaction({
      ...item,
      startedAt: new Date(item.startedAt),
      completedAt: new Date(item.completedAt),
    }));
  } catch {
    return [];
  }
}

function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function sortCategories(categories) {
  return categories.sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function parseDate(value) {
  if (!value) return new Date(0);
  return new Date(value.replace(' ', 'T'));
}

function parseNumber(value) {
  if (!value) return 0;
  return Number.parseFloat(String(value).trim().replace(',', '.'));
}

function hasAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function sum(items, key) {
  return items.reduce((acc, item) => acc + item[key], 0);
}

function colorFor(category) {
  return categoryColors[category] || categoryColors.Altro;
}

function iconFor(category) {
  return categoryIcons[category] || categoryIcons.Altro;
}

function formatMoney(amount) {
  const formatted = amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `€${formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted}`;
}

function dateLabel(date) {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(date);
}

function alpha(hex, opacity) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 3200);
}
