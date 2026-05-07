import { formatMoney, sum } from './utils.js';

export function summarize(transactions) {
  const completed = transactions.filter((item) => item.isCompleted);
  const spendingRows = completed.filter((item) => item.countsAsSpending);
  const incomeRows = completed.filter((item) => item.isIncome && !item.isInternalTransfer);
  const transferRows = completed.filter((item) => item.isInternalTransfer);
  const categoryTotals = {};
  const merchants = {};

  spendingRows.forEach((item) => {
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.absoluteAmount;
    merchants[item.description] ||= {
      name: item.description,
      count: 0,
      total: 0,
      category: item.category,
    };
    merchants[item.description].count += 1;
    merchants[item.description].total += item.absoluteAmount;
  });

  const topMerchants = Object.values(merchants).sort((a, b) => b.total - a.total);
  const recurring = topMerchants
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count);
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

export function groupTransactions(transactions) {
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

function buildCoachNotes(categoryTotals, recurring, spendingCount) {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return [
      {
        title: 'Importa il primo CSV',
        body: 'Quando carichi un export Revolut, il coach crea categorie, budget e insight locali.',
        kind: 'info',
      },
    ];
  }

  const [topCategory, topValue] = entries[0];
  const notes = [
    {
      title: 'Categoria dominante',
      body: `${topCategory} è la voce più alta del periodo: ${formatMoney(topValue)}. È il primo punto da guardare se vuoi ridurre le uscite.`,
      kind: 'warning',
    },
    {
      title: 'Movimenti analizzati',
      body: `Ho letto ${spendingCount} spese reali, escludendo trasferimenti interni e operazioni non completate.`,
      kind: 'good',
    },
  ];

  if (recurring.length) {
    notes.push({
      title: 'Possibili ricorrenti',
      body: `Questi esercenti compaiono più volte: ${recurring
        .slice(0, 3)
        .map((item) => item.name)
        .join(', ')}.`,
      kind: 'info',
    });
  }

  const restaurants = categoryTotals.Ristoranti || 0;
  if (restaurants > 100) {
    notes.push({
      title: 'Fuori casa sotto controllo',
      body: `Ristoranti e delivery superano ${formatMoney(restaurants)}. Un tetto settimanale può dare un risparmio rapido.`,
      kind: 'warning',
    });
  }

  return notes;
}

