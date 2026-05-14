import { hasAny } from './utils.js';

/** Stati Revolut da escludere (annullati, rifiutati, in sospeso, ecc.). */
export function isRevolutExcludedState(state) {
  const s = String(state || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!s) return true;
  if (s.includes('ANNUL')) return true;
  if (s.includes('ANNULL')) return true;
  if (s.includes('RIFIUT')) return true;
  if (s.includes('CANCEL')) return true;
  if (s.includes('DECLINED') || s.includes('DECLINE')) return true;
  if (s.includes('FAILED') || s.includes('FAIL')) return true;
  if (s.includes('REVERSED')) return true;
  if (s.includes('SOSPES') || s.includes('PENDING')) return true;
  return false;
}

/** Solo completati/pagati, senza substring ambigue su «COMPLETATO». */
export function isRevolutCompletedState(state) {
  if (isRevolutExcludedState(state)) return false;
  const s = String(state || '').trim().toUpperCase();
  return s === 'COMPLETATO' || s === 'COMPLETED';
}

export function enrichTransaction(item) {
  const normalized = item.description.toLowerCase();
  const isCompleted = isRevolutCompletedState(item.state);
  const isIncome = item.amount > 0;
  const isInternalTransfer =
    normalized.includes('conto potenziato') ||
    normalized.includes('conto deposito') ||
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
    hasAny(text, ['conto potenziato', 'conto deposito', 'trasferimento']) ||
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
  if (value == null || String(value).trim() === '') return null;
  const normalized = String(value).trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ricostruisce Date da IndexedDB/localStorage senza trasformare null in epoch. */
export function coerceStoredDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseNumber(value) {
  if (!value) return 0;
  return Number.parseFloat(String(value).trim().replace(',', '.'));
}

