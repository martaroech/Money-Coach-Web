import { enrichTransaction, inferCategory, parseDate, parseNumber } from './transactions.js';

export function parseRevolutCsv(content) {
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
      if (!completedAt) {
        skippedRows += 1;
        continue;
      }
      const description = values.descrizione || '';
      const amount = parseNumber(values.importo);
      const fee = parseNumber(values.costo);
      const currency = values.valuta || 'EUR';
      const rowState = values.state || values.stato || '';
      const balance = parseNumber(values.saldo);

      transactions.push(
        enrichTransaction({
          id: [
            completedAt.toISOString(),
            description,
            amount.toFixed(2),
            balance.toFixed(2),
          ].join('|'),
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
        }),
      );
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

