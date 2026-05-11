import {
  enrichTransaction,
  inferCategory,
  parseDate,
  parseFlexibleRevolutDate,
  parseItalianLocaleAmount,
  parseNumber,
} from './transactions.js';

function isTransactionsExport(headers) {
  return headers.includes('importo');
}

function isStatementExport(headers) {
  return (
    headers.includes('data') &&
    headers.includes('descrizione') &&
    headers.includes('entrate') &&
    headers.includes('uscite') &&
    headers.includes('saldo')
  );
}

export function parseRevolutCsv(content) {
  const normalized = String(content).replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(normalized);
  const rows = parseCsv(normalized, delimiter);
  if (rows.length <= 1) return { transactions: [], skippedRows: 0 };

  const headers = rows[0].map((header) =>
    header
      .trim()
      .replace(/^\uFEFF/, '')
      .toLowerCase(),
  );
  if (isStatementExport(headers) && !isTransactionsExport(headers)) {
    return parseStatementRows(rows.slice(1), headers);
  }
  return parseTransactionRows(rows.slice(1), headers);
}

function parseStatementRows(rows, headers) {
  const transactions = [];
  let skippedRows = 0;

  rows.forEach((row) => {
    if (!row.some((cell) => String(cell).trim())) return;

    try {
      const values = {};
      headers.forEach((header, col) => {
        values[header] = (row[col] || '').trim();
      });

      const entrate = parseItalianLocaleAmount(values.entrate);
      const uscite = parseItalianLocaleAmount(values.uscite);
      let amount = 0;
      if (entrate > 0) amount = entrate;
      else if (uscite > 0) amount = -uscite;

      if (!values.descrizione && amount === 0) return;

      const movementAt = parseFlexibleRevolutDate(values.data);
      if (movementAt.getTime() === new Date(0).getTime() && amount === 0) {
        skippedRows += 1;
        return;
      }

      const description = values.descrizione || '';
      const balance = parseItalianLocaleAmount(values.saldo);
      const fee = 0;
      const currency = 'EUR';
      const rateNote = values['tasso di interesse lordo guadagnato'] || '';
      const type = rateNote ? 'Interessi' : 'Estratto conto';

      transactions.push(
        enrichTransaction({
          id: [movementAt.toISOString(), description, amount.toFixed(2), balance.toFixed(2)].join('|'),
          type,
          product: '',
          startedAt: movementAt,
          completedAt: movementAt,
          description,
          amount,
          fee,
          currency,
          state: 'COMPLETATO',
          balance,
          category: inferCategory(description, type, amount),
        }),
      );
    } catch {
      skippedRows += 1;
    }
  });

  transactions.sort((a, b) => b.completedAt - a.completedAt);
  return { transactions, skippedRows };
}

function parseTransactionRows(rows, headers) {
  const transactions = [];
  let skippedRows = 0;

  for (let index = 0; index < rows.length; index += 1) {
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
      const completedAt = parseFlexibleRevolutDate(values['data di completamento']);
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

function detectCsvDelimiter(content) {
  const lineEnd = content.search(/\r?\n/);
  const line = lineEnd >= 0 ? content.slice(0, lineEnd) : content;
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1] || '';
    if (char === '"') {
      if (inQuotes && next === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === ',') commas += 1;
    if (char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseCsv(content, delimiter = ',') {
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

    if (char === delimiter && !inQuotes) {
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

