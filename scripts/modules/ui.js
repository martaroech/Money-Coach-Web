import { groupTransactions, summarize } from './analyzer.js';
import { applyCategoryToTransaction, buildBudgetPlan, categorySpendingForCurrentMonth } from './budgetPlanner.js';
import { parseRevolutCsv } from './csvImporter.js';
import {
  clearTransactions,
  loadCategories,
  loadSettings,
  loadTransactions,
  mergeTransactions,
  saveCategories,
  saveSettings,
  saveTransactions,
} from './storage.js';
import {
  budgetSummaryCard,
  budgetRow,
  categoryEditor,
  coachCard,
  emptyState,
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
    await saveTransactions(state.transactions);
    showToast(
      `Importate ${result.transactions.length} righe da ${file.name}. Saltate: ${result.skippedRows}.`,
    );
    render();
  } catch (error) {
    showToast(`Import non riuscito: ${error.message || error}`);
  }
}

async function clearData() {
  if (!window.confirm('Cancellare tutte le transazioni salvate in questo browser?')) return;
  await clearTransactions();
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

  setText('heroKicker', hasData ? 'Totale conti' : '');
  setText('heroAmount', hasData ? formatMoney(summary.spending) : 'Importa CSV');
  setText(
    'heroCopy',
    hasData ? '' : 'Carica l’export in .csv di Revolut. Il coach categorizza, salva e analizza tutto nel browser.',
  );
  document.getElementById('heroImportButton').classList.toggle('d-none', hasData);

  document.getElementById('metricGrid').innerHTML = [
    metricCard('Uscite', formatMoney(summary.spending), 'fa-arrow-up-right-from-square', '##b80022'),
    metricCard('Entrate', formatMoney(summary.income), 'fa-plus-square', '#b80022'),
    metricCard(
      'Saldo netto',
      formatMoney(summary.net),
      'fa-equals',
      summary.net >= 0 ? '#b80022' : '#b80022',
    ),
    metricCard('Categorie', String(Object.keys(summary.categoryTotals).length), 'fa-tags', '#b80022'),
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

  bindTransactionCategorySelectors();
}

function renderBudget() {
  const summary = summarize(state.transactions);
  const plan = buildBudgetPlan(state.transactions, state.categories, state.settings);
  setText(
    'budgetIntro',
    `Spesa analizzata: ${formatMoney(summary.spending)} su ${plan.monthCount} mesi. Il coach propone limiti coerenti con il tuo obiettivo.`,
  );
  document.getElementById('monthlySavingsTarget').value = state.settings.monthlySavingsTarget || 0;
  document.getElementById('budgetSummary').innerHTML = budgetSummaryCard(plan);
  document.getElementById('budgetList').innerHTML = plan.rows
    .map((row) =>
      budgetRow(
        row.name,
        categorySpendingForCurrentMonth(state.transactions, row.name),
        row.budget,
        row.average,
        row.suggested,
      ),
    )
    .join('');
  document.getElementById('categoryManager').innerHTML = categoryEditor(state.categories);
  bindBudgetControls();
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

function bindBudgetControls() {
  document.getElementById('addCategoryButton')?.addEventListener('click', async () => {
    const name = uniqueCategoryName('Nuova categoria');
    state.categories.push({
      id: slugCategory(name),
      name,
      color: '#66736d',
      icon: 'fa-tag',
      monthlyGoal: 0,
    });
    await persistCategories();
    render();
  });

  document.querySelectorAll('[data-category-name]').forEach((input) => {
    input.addEventListener('change', async () => {
      const previousName = input.dataset.categoryName;
      const nextName = input.value.trim();
      if (!nextName) {
        input.value = previousName;
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
      showToast('Categoria rinominata.');
    });
  });

  document.querySelectorAll('[data-category-goal]').forEach((input) => {
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
      renderBudget();
      showToast('Obiettivo categoria aggiornato.');
    });
  });
}

async function handleSavingsTargetChange(event) {
  state.settings.monthlySavingsTarget = Number(event.target.value) || 0;
  await saveSettings(state.settings);
  renderBudget();
  showToast('Obiettivo di risparmio aggiornato.');
}

function bindTransactionCategorySelectors() {
  document.querySelectorAll('[data-transaction-category]').forEach((select) => {
    select.addEventListener('change', async () => {
      state.transactions = applyCategoryToTransaction(
        state.transactions,
        select.dataset.transactionCategory,
        select.value,
      );
      await saveTransactions(state.transactions);
      render();
      showToast('Spesa ricategorizzata.');
    });
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
