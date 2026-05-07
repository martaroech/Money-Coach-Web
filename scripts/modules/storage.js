import { STORAGE_KEY } from './config.js';
import { enrichTransaction } from './transactions.js';

export function mergeTransactions(current, incoming) {
  const byId = new Map();
  current.forEach((item) => byId.set(item.id, item));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => b.completedAt - a.completedAt);
}

export function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw).map((item) =>
      enrichTransaction({
        ...item,
        startedAt: new Date(item.startedAt),
        completedAt: new Date(item.completedAt),
      }),
    );
  } catch {
    return [];
  }
}

export function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

export function clearTransactions() {
  localStorage.removeItem(STORAGE_KEY);
}

