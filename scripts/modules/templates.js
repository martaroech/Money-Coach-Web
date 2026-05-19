import { CATEGORY_ICON_PICKER_ICONS } from './config.js';
import { alpha, colorFor, dateLabel, escapeHtml, formatMoney, iconFor, renderCategoryIconHtml } from './utils.js';

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
        ${renderCategoryIconHtml(iconFor(group.category))}
      </span>
      <span class="group-title flex-grow-1 min-w-0">
        <strong>${escapeHtml(group.category)}</strong>
        <small class="text-secondary">${group.items.length} movimenti</small>
      </span>
      <span class="group-total text-end d-grid gap-1 justify-items-end">
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
      ${renderCategoryIconHtml(iconFor(item.category))}
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
    <span class="compact-main min-w-0 d-grid gap-1">
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

function categoryNewSection() {
  const icons = CATEGORY_ICON_PICKER_ICONS.length ? CATEGORY_ICON_PICKER_ICONS : ['fa-circle'];
  const grid = icons
    .map(
      (ic, i) => `<button type="button" class="mc-icon-pick btn ${i === 0 ? 'mc-icon-pick--selected' : ''}" data-picker-icon="${escapeHtml(ic)}" aria-label="Scegli icona ${escapeHtml(ic)}" aria-pressed="${i === 0 ? 'true' : 'false'}">
      <span class="mc-icon-pick__inner"><i class="fa-solid ${escapeHtml(ic)}"></i></span>
    </button>`,
    )
    .join('');
  return `<article class="card data-card border-0 mb-3 mc-category-create-card">
    <div class="card-body">
      <strong class="d-block">Nuova categoria</strong>
      <small class="text-secondary d-block mt-1 mb-3">Nome, scegli un&apos;icona tra quelle disponibili e crea. Le categorie sono condivise con Budget.</small>
      <label class="form-label small mb-0 fw-bold" for="newCategoryNameInput">Nome</label>
      <input id="newCategoryNameInput" class="form-control form-control-sm mt-1 mb-3" type="text" maxlength="48" autocomplete="off" placeholder="Es. Palestra, Regali veterinario…" />
      <p id="iconPickerLegend" class="form-label small mb-2 fw-bold">Icona</p>
      <div class="mc-icon-picker" role="radiogroup" aria-labelledby="iconPickerLegend">${grid}</div>
      <button type="button" class="btn btn-brand btn-sm fw-bold mt-3 w-100" data-create-category>Crea categoria</button>
    </div>
  </article>`;
}

function categoryEditorRow(category) {
  return `<div class="row g-2 align-items-center category-editor-row category-editor-row--deletable" data-category-row="${escapeHtml(category.name)}">
    <div class="col-auto">
      <span class="category-icon category-editor-row__ico" style="background:${alpha(category.color, 0.14)};color:${category.color}">
        ${renderCategoryIconHtml(category.icon)}
      </span>
    </div>
    <div class="col min-w-0">
      <input class="form-control form-control-sm" type="text" value="${escapeHtml(category.name)}" data-category-name="${escapeHtml(category.name)}" aria-label="Nome categoria" />
    </div>
    <div class="col-auto">
      <input class="form-control form-control-sm text-end category-editor-row__goal-input" type="number" min="0" step="5" value="${Number(category.monthlyGoal) || 0}" data-category-goal="${escapeHtml(category.name)}" aria-label="Obiettivo mensile €" inputmode="decimal" />
    </div>
    <div class="col-auto">
      <button type="button" class="btn btn-outline-danger btn-sm category-editor-row__del" data-delete-category="${escapeHtml(category.name)}" title="Elimina categoria" aria-label="Elimina ${escapeHtml(category.name)}"><i class="fa-solid fa-trash-can"></i></button>
    </div>
  </div>`;
}

/** Contenuto modale Spese: creazione guidata + elenco modificabile / eliminabile. */
export function expenseCategoriesModalBody(categories) {
  const rows = categories.map((c) => categoryEditorRow(c)).join('');
  return `${categoryNewSection()}
  <article class="card data-card border-0 mc-category-list-card">
    <div class="card-body pb-3">
      <strong class="d-block mb-3">Le tue categorie</strong>
      <small class="text-secondary d-block mb-2">Rinomina, obiettivo mensile (<span class="text-nowrap">€</span>), elimina — le transazioni sulla categoria eliminata sono riassegnate.</small>
      <div class="d-grid gap-2">${rows}</div>
    </div>
  </article>`;
}

/** Pannello Budget: aggiunta rapida (icona predefinita) + stesso elenco modificabile. */
export function budgetCategoryPanel(categories) {
  const rows = categories.map((c) => categoryEditorRow(c)).join('');
  return `<article class="card data-card border-0">
    <div class="card-body">
      <div class="d-flex align-items-start justify-content-between gap-2 mb-3">
        <div class="min-w-0">
          <strong>Categorie e obiettivi</strong>
          <small class="d-block text-secondary">Nome, tetto mensile, elimina. Per creare una categoria con icona scegli <strong class="fw-bold">Spese → Gestisci categorie</strong>.</small>
        </div>
        <button class="btn btn-brand-soft btn-sm flex-shrink-0" type="button" data-add-category-budget aria-label="Aggiungi categoria veloce (icona predefinita)">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
      <div class="d-grid gap-2">${rows}</div>
    </div>
  </article>`;
}

function categorySelect(item, categories) {
  if (!item.countsAsSpending || !categories.length) return '';
  const tid = encodeURIComponent(item.id);
  const currentName = item.category;
  const curColor = colorFor(currentName);
  const trigIconHtml = renderCategoryIconHtml(iconFor(currentName));

  const optionsHtml = categories
    .map((cat) => {
      const isSel = cat.name === currentName;
      const nameEnc = encodeURIComponent(cat.name);
      const lbl = escapeHtml(cat.name);
      const col = colorFor(cat.name);
      const ic = renderCategoryIconHtml(iconFor(cat.name));
      return `<button type="button" class="dropdown-item mc-expense-cat-dd__option d-flex align-items-center gap-2${isSel ? ' mc-expense-cat-dd__option--selected active' : ''}" role="menuitemradio" aria-checked="${isSel ? 'true' : 'false'}" data-pick-cat="${escapeHtml(nameEnc)}">
          <span class="category-icon mc-expense-cat-dd__opt-ico flex-shrink-0" style="background:${alpha(col, 0.14)};color:${col}">${ic}</span>
          <span class="mc-expense-cat-dd__opt-txt text-truncate flex-grow-1">${lbl}</span>
          ${isSel ? '<i class="fa-solid fa-check mc-expense-cat-dd__check ms-auto flex-shrink-0" aria-hidden="true"></i>' : '<span class="mc-expense-cat-dd__check-slot ms-auto flex-shrink-0" aria-hidden="true"></span>'}
        </button>`;
    })
    .join('');

  return `<div class="dropdown mc-expense-cat-dd mt-2 w-100" data-transaction-picker="${escapeHtml(tid)}">
    <button
      type="button"
      class="btn dropdown-toggle mc-expense-cat-dd__toggle text-start shadow-none d-flex align-items-center gap-2 w-100"
      data-bs-toggle="dropdown"
      data-bs-popper-config='{"strategy":"fixed"}'
      aria-expanded="false"
      aria-haspopup="menu"
      aria-label="Categoria: ${escapeHtml(currentName)}">
      <span class="category-icon mc-expense-cat-dd__trig-ico flex-shrink-0" style="background:${alpha(curColor, 0.14)};color:${curColor}">${trigIconHtml}</span>
      <span class="mc-expense-cat-dd__trig-label text-truncate flex-grow-1">${escapeHtml(currentName)}</span>
      <i class="fa-solid fa-chevron-down mc-expense-cat-dd__chev flex-shrink-0 ms-auto" aria-hidden="true"></i>
    </button>
    <div class="dropdown-menu mc-expense-cat-dd__menu py-2" role="menu" aria-label="Scegli categoria">${optionsHtml}</div>
  </div>`;
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
    <div class="card-body d-grid gap-2">
      <i class="fa-solid ${icon}"></i>
      <strong>${escapeHtml(title)}</strong>
      <small class="text-secondary">${escapeHtml(body)}</small>
    </div>
  </article>`;
}
