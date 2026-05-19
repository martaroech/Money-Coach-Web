import { defaultSettings } from './config.js';

/** Backup JSON salvabile su File / iCloud; schema incrementabile nel tempo. */
export const BACKUP_SCHEMA_VERSION = 1;
export const LAST_BACKUP_EXPORT_KEY = 'moneyCoachWeb.lastBackupExportIso.v1';

export function buildBackupPayload(state) {
  return {
    moneyCoachBackup: true,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appHint: 'Money Coach Web',
    transactions: state.transactions.map(serializeTransactionRow),
    categories: state.categories,
    settings: { ...state.settings },
    ui: {
      expenseView: state.expenseView,
      expenseFilter: state.expenseFilter,
      expenseQuery: state.expenseQuery,
      expandedCategories: [...state.expandedCategories],
    },
  };
}

function serializeTransactionRow(item) {
  const row = { ...item };
  if (row.completedAt instanceof Date) {
    row.completedAt = row.completedAt.toISOString();
  }
  if (row.startedAt instanceof Date) {
    row.startedAt = row.startedAt.toISOString();
  }
  return row;
}

/**
 * @param {string} jsonText
 * @returns {{ transactions: unknown[], categories: unknown[], settings: object, ui?: object, exportedAt?: string }}
 */
export function parseMoneyCoachBackup(jsonText) {
  let raw;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Formato backup non valido.');
  }
  if (raw.moneyCoachBackup !== true) {
    throw new Error('Non è un backup Money Coach (manca il marcatore moneyCoachBackup).');
  }
  const ver = Number(raw.schemaVersion ?? 1);
  if (!Number.isFinite(ver) || ver < 1 || ver > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      ver > BACKUP_SCHEMA_VERSION
        ? 'Backup creato da una versione più recente dell’app. Aggiorna Money Coach e riprova.'
        : 'Versione backup non supportata.',
    );
  }
  if (!Array.isArray(raw.transactions)) {
    throw new Error('Backup senza elenco transazioni.');
  }
  if (!Array.isArray(raw.categories)) {
    throw new Error('Backup senza elenco categorie.');
  }
  const settings =
    raw.settings && typeof raw.settings === 'object' ? { ...defaultSettings, ...raw.settings } : { ...defaultSettings };
  const ui = raw.ui && typeof raw.ui === 'object' ? raw.ui : null;

  return {
    transactions: raw.transactions,
    categories: raw.categories,
    settings,
    ui,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
  };
}

export function backupFilenameSuggestion() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `money-coach-backup-${y}-${m}-${day}.json`;
}

/** Preferisce Condivisione iOS (Salva in File); altrimenti download nel browser. */
export async function shareOrDownloadBackupJson(jsonText, filename) {
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const file = new File([blob], filename, { type: 'application/json' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Backup Money Coach',
      });
      return 'share';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'aborted';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'download';
}

export function rememberBackupExportTimestamp() {
  try {
    localStorage.setItem(LAST_BACKUP_EXPORT_KEY, new Date().toISOString());
  } catch {
    /* ignore quota */
  }
}

export function getLastBackupExportHint() {
  try {
    const iso = localStorage.getItem(LAST_BACKUP_EXPORT_KEY);
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('it-IT', { dateStyle: 'medium' });
  } catch {
    return '';
  }
}
