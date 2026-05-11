import { CATEGORIES_KEY, SETTINGS_KEY, STORAGE_KEY, defaultCategories, defaultSettings } from './config.js';
import { coerceStoredDate, enrichTransaction } from './transactions.js';

const DB_NAME = 'moneyCoachWeb';
const DB_VERSION = 1;
const STORE_NAME = 'records';

export function mergeTransactions(current, incoming) {
  const byId = new Map();
  current.forEach((item) => byId.set(item.id, item));
  incoming.forEach((item) => {
    const existing = byId.get(item.id);
    byId.set(
      item.id,
      existing?.manualCategory
        ? {
            ...item,
            category: existing.category,
            manualCategory: true,
          }
        : item,
    );
  });
  return [...byId.values()].sort((a, b) => b.completedAt - a.completedAt);
}

export async function loadTransactions() {
  const stored = await readRecord(STORAGE_KEY, readLegacyTransactions());
  return normalizeTransactions(stored);
}

export async function saveTransactions(transactions) {
  await writeRecord(STORAGE_KEY, transactions);
}

export async function clearTransactions() {
  await deleteRecord(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

export async function loadSettings() {
  const stored = await readRecord(SETTINGS_KEY, readJson(SETTINGS_KEY));
  return {
    ...defaultSettings,
    ...(stored || {}),
  };
}

export async function saveSettings(settings) {
  await writeRecord(SETTINGS_KEY, {
    ...defaultSettings,
    ...settings,
  });
}

export async function loadCategories() {
  const stored = await readRecord(CATEGORIES_KEY, readJson(CATEGORIES_KEY));
  return normalizeCategories(stored);
}

export async function saveCategories(categories) {
  await writeRecord(CATEGORIES_KEY, normalizeCategories(categories));
}

async function readRecord(key, fallback) {
  if (!window.indexedDB) return fallback;

  try {
    const db = await openDb();
    const record = await requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key));
    return record?.value ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeRecord(key, value) {
  if (!window.indexedDB) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  const db = await openDb();
  await requestToPromise(
    db
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put({ key, value, updatedAt: new Date().toISOString() }),
  );
}

async function deleteRecord(key) {
  if (!window.indexedDB) return;
  const db = await openDb();
  await requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key));
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function normalizeTransactions(transactions) {
  if (!Array.isArray(transactions)) return [];
  return transactions
    .map((item) =>
      enrichTransaction({
        ...item,
        startedAt: coerceStoredDate(item.startedAt),
        completedAt: coerceStoredDate(item.completedAt),
      }),
    )
    .filter((item) => item.completedAt instanceof Date && !Number.isNaN(item.completedAt.getTime()))
    .sort((a, b) => b.completedAt - a.completedAt);
}

function normalizeCategories(categories) {
  const byName = new Map();
  defaultCategories.forEach((category) => byName.set(category.name, { ...category }));
  if (Array.isArray(categories)) {
    categories.forEach((category) => {
      if (!category?.name) return;
      byName.set(category.name, {
        ...category,
        id: category.id || slugCategory(category.name),
        color: category.color || '#66736d',
        icon: category.icon || 'fa-tag',
        monthlyGoal: Number(category.monthlyGoal) || 0,
      });
    });
  }
  return [...byName.values()];
}

function readLegacyTransactions() {
  return readJson(STORAGE_KEY) || [];
}

function readJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function slugCategory(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
