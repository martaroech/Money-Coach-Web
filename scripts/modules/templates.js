import { alpha, colorFor, dateLabel, escapeHtml, formatMoney, iconFor } from './utils.js';

export function metricCard(label, value, icon, color, subtitle = '') {
  const sub = subtitle
    ? `<small class="d-block text-secondary mt-1">${escapeHtml(subtitle)}</small>`
    : '';
  return `<div class="col-6">
    <article class="card metric-card border-0 h-100">
      <div class="card-body">
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="fa-solid ${icon}" style="color:${color}"></i>
          <span>${escapeHtml(label)}</span>
        </div>
        <strong>${escapeHtml(value)}</strong>
        ${sub}
      </div>
    </article>
  </div>`;
}

export function renderCategoryBreakdown(categoryTotals) {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, value]) => acc + value, 0);
  return `<article class="card data-card border-0"><div class="card-body">${entries
    .slice(0, 7)
    .map(([category, value]) => {
      const percent = total ? (value / total) * 100 : 0;
      return `<div class="breakdown-row">
      <div class="breakdown-label">
        <span class="dot" style="background:${colorFor(category)}"></span>
        <strong>${escapeHtml(category)}</strong>
        <span>${formatMoney(value)}</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${percent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${percent}%;background:${colorFor(category)}"></div></div>
    </div>`;
    })
    .join('')}</div></article>`;
}

export function groupCard(group, expanded, categories = []) {
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
    ${expanded ? `<div class="list-group list-group-flush compact-list">${group.items.map((item) => compactTransactionRow(item, categories)).join('')}</div>` : ''}
  </article>`;
}

export function transactionCard(item, categories = []) {
  const color = item.isIncome ? '#b80022' : colorFor(item.category);
  return `<article class="card data-card transaction-card border-0">
    <span class="category-icon" style="background:${alpha(color, 0.14)};color:${color}">
      <i class="fa-solid ${iconFor(item.category)}"></i>
    </span>
    <span class="transaction-main flex-grow-1 min-w-0">
      <strong>${escapeHtml(item.description)}</strong>
      <small class="text-secondary">${escapeHtml(item.category)} · ${dateLabel(item.completedAt)}</small>
      ${categorySelect(item, categories)}
    </span>
    <strong class="transaction-amount" style="color:${color}">${item.isIncome ? '+' : '-'}${formatMoney(item.absoluteAmount)}</strong>
  </article>`;
}

export function compactTransactionRow(item, categories = []) {
  const color = item.isIncome ? '#b80022' : colorFor(item.category);
  return `<div class="list-group-item compact-row">
    <span class="text-secondary">${dateLabel(item.completedAt)}</span>
    <span class="compact-main min-w-0">
      <strong>${escapeHtml(item.description)}</strong>
      ${categorySelect(item, categories)}
    </span>
    <em style="color:${color}">${item.isIncome ? '+' : '-'}${formatMoney(item.absoluteAmount)}</em>
  </div>`;
}

export function budgetRow(category, spent, budget, average = 0, suggested = 0) {
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
      <small class="text-secondary">${left >= 0 ? `Restano ${formatMoney(left)}` : `Sopra di ${formatMoney(Math.abs(left))}`} · Media ${formatMoney(average)} · Suggerito ${formatMoney(suggested)}</small>
    </div>
  </article>`;
}

export function budgetSummaryCard(plan) {
  const tone = plan.needsReduction ? '#e36f54' : '#b80022';
  return `<article class="card data-card border-0">
    <div class="card-body">
      <div class="row g-2">
        <div class="col-6"><small class="text-secondary">Entrate medie</small><strong class="d-block">${formatMoney(plan.averageIncome)}</strong></div>
        <div class="col-6"><small class="text-secondary">Uscite medie</small><strong class="d-block">${formatMoney(plan.averageSpending)}</strong></div>
        <div class="col-6"><small class="text-secondary">Risparmio target</small><strong class="d-block">${formatMoney(plan.targetSavings)}</strong></div>
        <div class="col-6"><small class="text-secondary">Budget massimo</small><strong class="d-block" style="color:${tone}">${formatMoney(plan.availableForSpending)}</strong></div>
      </div>
      <div class="mt-3">${plan.notes.map((note) => `<small class="d-block text-secondary">${escapeHtml(note)}</small>`).join('')}</div>
    </div>
  </article>`;
}

export function categoryEditor(categories) {
  return `<article class="card data-card border-0">
    <div class="card-body">
      <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
        <div>
          <strong>Categorie e obiettivi</strong>
          <small class="d-block text-secondary">Modifica limite mensile o crea una categoria.</small>
        </div>
        <button class="btn btn-brand-soft btn-sm" type="button" id="addCategoryButton" aria-label="Aggiungi categoria">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
      <div class="category-editor-list">
        ${categories.map(categoryEditorRow).join('')}
      </div>
    </div>
  </article>`;
}

function categoryEditorRow(category) {
  return `<div class="category-editor-row" data-category-row="${escapeHtml(category.name)}">
    <span class="category-icon" style="background:${alpha(category.color, 0.14)};color:${category.color}">
      <i class="fa-solid ${escapeHtml(category.icon)}"></i>
    </span>
    <input class="form-control form-control-sm" type="text" value="${escapeHtml(category.name)}" data-category-name="${escapeHtml(category.name)}" aria-label="Nome categoria">
    <input class="form-control form-control-sm" type="number" min="0" step="5" value="${Number(category.monthlyGoal) || 0}" data-category-goal="${escapeHtml(category.name)}" aria-label="Obiettivo mensile">
  </div>`;
}

function categorySelect(item, categories) {
  if (!item.countsAsSpending || !categories.length) return '';
  return `<select class="form-select form-select-sm category-select mt-2" data-transaction-category="${escapeHtml(item.id)}" aria-label="Categoria transazione">
    ${categories
      .map(
        (category) =>
          `<option value="${escapeHtml(category.name)}" ${category.name === item.category ? 'selected' : ''}>${escapeHtml(category.name)}</option>`,
      )
      .join('')}
  </select>`;
}

export function coachCard(note) {
  const tone =
    note.kind === 'good' ? '#b80022' : note.kind === 'warning' ? '#e36f54' : '#547aa5';
  const icon =
    note.kind === 'good'
      ? 'fa-circle-check'
      : note.kind === 'warning'
        ? 'fa-circle-exclamation'
        : 'fa-lightbulb';
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

export function merchantCard(item) {
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

export function emptyState(icon, title, body) {
  return `<article class="card data-card empty-state border-0">
    <div class="card-body">
      <i class="fa-solid ${icon}"></i>
      <strong>${escapeHtml(title)}</strong>
      <small class="text-secondary">${escapeHtml(body)}</small>
    </div>
  </article>`;
}
