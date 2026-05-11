import { formatMoney, sum } from './utils.js';

export function buildBudgetPlan(transactions, categories, settings) {
  const completed = transactions.filter((item) => item.isCompleted);
  const spendingRows = completed.filter((item) => item.countsAsSpending);
  const incomeRows = completed.filter((item) => item.isIncome && !item.isInternalTransfer);
  const months = getCoveredMonths(completed);
  const monthCount = Math.max(months.length, 1);
  const targetSavings = Number(settings.monthlySavingsTarget) || 0;
  const averageIncome = sum(incomeRows, 'absoluteAmount') / monthCount;
  const averageSpending = sum(spendingRows, 'absoluteAmount') / monthCount;
  const availableForSpending = Math.max(0, averageIncome - targetSavings);
  const needsReduction = averageSpending > availableForSpending && (averageIncome > 0 || targetSavings > 0);
  const reductionRatio = needsReduction ? availableForSpending / averageSpending : 1;
  const rows = categories.map((category) => {
    const categoryRows = spendingRows.filter((item) => item.category === category.name);
    const average = sum(categoryRows, 'absoluteAmount') / monthCount;
    const userGoal = Number(category.monthlyGoal) || 0;
    const suggested = Math.round((needsReduction ? average * reductionRatio : average) / 5) * 5;
    const budget = userGoal || suggested;

    return {
      ...category,
      average,
      budget,
      suggested,
      transactionCount: categoryRows.length,
    };
  });

  return {
    months,
    monthCount,
    averageIncome,
    averageSpending,
    targetSavings,
    availableForSpending,
    plannedSpending: sum(rows, 'budget'),
    needsReduction,
    rows: rows.sort((a, b) => b.average - a.average),
    notes: buildPlanNotes({
      averageIncome,
      averageSpending,
      targetSavings,
      availableForSpending,
      needsReduction,
    }),
  };
}

export function applyCategoryToTransaction(transactions, transactionId, categoryName) {
  return transactions.map((item) =>
    item.id === transactionId
      ? {
          ...item,
          category: categoryName,
          manualCategory: true,
        }
      : item,
  );
}

export function categorySpendingForCurrentMonth(transactions, categoryName) {
  const now = new Date();
  return transactions
    .filter((item) => item.countsAsSpending)
    .filter((item) => item.category === categoryName)
    .filter(
      (item) =>
        item.completedAt.getFullYear() === now.getFullYear() &&
        item.completedAt.getMonth() === now.getMonth(),
    )
    .reduce((total, item) => total + item.absoluteAmount, 0);
}

function getCoveredMonths(transactions) {
  const months = new Set(
    transactions
      .filter((item) => item.completedAt instanceof Date && !Number.isNaN(item.completedAt.getTime()))
      .map((item) => `${item.completedAt.getFullYear()}-${String(item.completedAt.getMonth() + 1).padStart(2, '0')}`),
  );
  return [...months].sort();
}

function buildPlanNotes(plan) {
  if (!plan.averageIncome && !plan.averageSpending) {
    return ['Importa uno storico più lungo per far calcolare budget e abitudini con più precisione.'];
  }

  const notes = [
    `Media entrate: ${formatMoney(plan.averageIncome)} al mese.`,
    `Media uscite: ${formatMoney(plan.averageSpending)} al mese.`,
  ];

  if (plan.targetSavings > 0) {
    notes.push(`Obiettivo risparmio: ${formatMoney(plan.targetSavings)} al mese.`);
  }

  if (plan.needsReduction) {
    notes.push(`Per rispettarlo devi tenere le uscite entro ${formatMoney(plan.availableForSpending)} al mese.`);
  } else if (plan.targetSavings > 0) {
    notes.push('Con le tue medie attuali il target sembra sostenibile.');
  }

  return notes;
}
