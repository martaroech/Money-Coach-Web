import { budgets } from './config.js';
import { groupTransactions, summarize } from './analyzer.js';
import { parseRevolutCsv } from './csvImporter.js';
import { clearTransactions, loadTransactions, mergeTransactions, saveTransactions } from './storage.js';
import {
  budgetRow,
  coachCard,
  emptyState,
  groupCard,
  merchantCard,
  metricCard,
  renderCategoryBreakdown,
  transactionCard,
} from './templates.js';
import { escapeHtml, formatMoney, setText, showToast, sortCategories } from './utils.js';

const state = {
  transactions: [],
  activePage: 'dashboardPage',
  expenseView: 'grouped',
  expenseFilter: 'Tutte',
  expenseQuery: '',
  expandedCategories: new Set(),
};

export function initApp() {
  bindEvents();
  state.transactions = loadTransactions();
  render();
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
    showToast(
      `Importate ${result.transactions.length} righe da ${file.name}. Saltate: ${result.skippedRows}.`,
    );
    render();
  } catch (error) {
    showToast(`Import non riuscito: ${error.message || error}`);
  }
}

function clearData() {
  if (!window.confirm('Cancellare tutte le transazioni salvate in questo browser?')) return;
  clearTransactions();
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

  setText('heroKicker', hasData ? 'Uscite importate' : 'Importa Revolut');
  setText('heroAmount', hasData ? formatMoney(summary.spending) : 'CSV aprile');
  setText(
    'heroCopy',
    hasData
      ? `Entrate: ${formatMoney(summary.income)}. Netto: ${formatMoney(summary.net)}. Trasferimenti interni esclusi dalle spese.`
      : 'Carica l’export CSV di Revolut. Il coach categorizza, salva e analizza tutto nel browser.',
  );
  document.getElementById('heroImportButton').classList.toggle('d-none', hasData);

  document.getElementById('metricGrid').innerHTML = [
    metricCard('Uscite', formatMoney(summary.spending), 'fa-arrow-up-right-from-square', '#e36f54'),
    metricCard('Entrate', formatMoney(summary.income), 'fa-plus-square', '#b80022'),
    metricCard(
      'Saldo netto',
      formatMoney(summary.net),
      'fa-equals',
      summary.net >= 0 ? '#b80022' : '#e36f54',
    ),
    metricCard('Categorie', String(Object.keys(summary.categoryTotals).length), 'fa-tags', '#0e7c7b'),
  ].join('');

  setText('categoryCount', hasData ? 'Auto' : 'In attesa');
  document.getElementById('categoryBreakdown').innerHTML = hasData
    ? renderCategoryBreakdown(summary.categoryTotals)
    : emptyState(
        'fa-file-csv',
        'Nessun CSV importato',
        'Scegli l’export Revolut in formato CSV. Lo leggerò e lo salverò localmente.',
      );

  setText('coachCount', `${summary.coachNotes.length} note`);
  document.getElementById('coachPreview').innerHTML = summary.coachNotes.slice(0, 2).map(coachCard).join('');
}

function renderExpenses() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === state.expenseView);
  });

  const base = state.transactions.filter(
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
  if (filtered.length === 0) {
    container.innerHTML = emptyState(
      'fa-magnifying-glass-chart',
      'Nessuna spesa trovata',
      'Prova un’altra ricerca o cambia filtro.',
    );
    return;
  }

  container.innerHTML =
    state.expenseView === 'grouped'
      ? groupTransactions(filtered)
          .map((group) => groupCard(group, state.expandedCategories.has(group.category)))
          .join('')
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
  setText(
    'budgetIntro',
    `Spesa analizzata: ${formatMoney(summary.spending)}. Il coach confronta ogni categoria con un limite sano.`,
  );
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

function matchesExpenseSearch(item, query) {
  if (!query) return true;
  return (
    item.description.toLowerCase().includes(query) ||
    item.category.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query) ||
    formatMoney(item.absoluteAmount).toLowerCase().includes(query)
  );
}

