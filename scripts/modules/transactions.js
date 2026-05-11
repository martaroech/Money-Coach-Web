import { hasAny } from './utils.js';

export function enrichTransaction(item) {
  const normalized = item.description.toLowerCase();
  const isCompleted = item.state.toUpperCase().includes('COMPLETATO');
  const isIncome = item.amount > 0;
  const isInternalTransfer =
    normalized.includes('conto potenziato') ||
    normalized.includes('trasferimento') ||
    normalized.startsWith('da eur') ||
    normalized.startsWith('a eur');

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

export function inferCategory(description, type, amount) {
  const text = `${description} ${type}`.toLowerCase();
  if (amount > 0) return 'Entrate';
  if (
    hasAny(text, ['conto potenziato', 'trasferimento']) ||
    text.startsWith('a eur') ||
    text.startsWith('da eur')
  ) {
    return 'Trasferimenti';
  }
  if (hasAny(text, ['sisa', 'esselunga', 'coop', 'md ', 'supermercati'])) return 'Spesa';
  if (hasAny(text, ['farmacia', 'asl', 'cup', 'medic', 'dott'])) return 'Salute';
  if (
    hasAny(text, [
      'ristorante',
      'pizzeria',
      'pizza',
      'kfc',
      'deliveroo',
      'gelateria',
      'bar ',
      'cafe',
    ])
  ) {
    return 'Ristoranti';
  }
  if (hasAny(text, ['fastweb', 'apple', 'spotify', 'netflix', 'icloud'])) return 'Abbonamenti';
  if (hasAny(text, ['tamoil', 'trenitalia', 'atm', 'taxi', 'benzina'])) return 'Trasporti';
  if (
    hasAny(text, [
      'amazon',
      'action',
      'pepco',
      'lefties',
      'happy casa',
      'store',
      'negozio',
    ])
  ) {
    return 'Shopping';
  }
  if (hasAny(text, ['hotel', 'booking', 'airbnb', 'ryanair', 'easyjet'])) return 'Viaggi';
  return 'Altro';
}

export function parseDate(value) {
  if (!value) return new Date(0);
  return new Date(value.replace(' ', 'T'));
}

const IT_MONTH_KEYS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const IT_MONTH_MAP = IT_MONTH_KEYS.reduce((acc, key, idx) => {
  acc[key] = idx;
  return acc;
}, {});

export function parseFlexibleRevolutDate(value) {
  if (!value || !String(value).trim()) return new Date(0);
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return parseDate(s);
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    const day = Number.parseInt(parts[0], 10);
    const monKey = parts[1].toLowerCase().slice(0, 3);
    const month = IT_MONTH_MAP[monKey];
    const year = Number.parseInt(parts[2], 10);
    if (!Number.isNaN(day) && month !== undefined && !Number.isNaN(year)) {
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
  }
  return new Date(0);
}

export function parseItalianLocaleAmount(value) {
  if (value === undefined || value === null) return 0;
  let s = String(value)
    .trim()
    .replace(/€/gi, '')
    .replace(/\s|\u00a0/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    const i = s.lastIndexOf(',');
    const frac = s.slice(i + 1).replace(/\D/g, '');
    const intRaw = s.slice(0, i).replace(/\./g, '').replace(/\D/g, '');
    if (!frac) return 0;
    return Number.parseFloat(`${intRaw}.${frac}`) || 0;
  }
  return Number.parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0;
}

export function parseNumber(value) {
  if (!value) return 0;
  return Number.parseFloat(String(value).trim().replace(',', '.'));
}

