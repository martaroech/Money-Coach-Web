const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

export function parseIsoDateToLocal(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function dateToIsoInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pushBoundedDate(times, d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return;
  if (d.getTime() === 0) return;
  times.push(d.getTime());
}

export function getTransactionDateBounds(transactions) {
  const times = [];
  for (const item of transactions) {
    pushBoundedDate(times, item.completedAt);
    pushBoundedDate(times, item.startedAt);
  }
  if (!times.length) return { min: null, max: null };
  return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) };
}

/**
 * Filtra per data di completamento (inclusive). Date vuote = nessun limite su quel lato.
 */
export function filterTransactionsByPeriod(transactions, periodStartIso, periodEndIso) {
  const hasStart = Boolean(periodStartIso);
  const hasEnd = Boolean(periodEndIso);
  if (!hasStart && !hasEnd) return transactions;

  const startBound = hasStart ? startOfLocalDay(parseIsoDateToLocal(periodStartIso)) : null;
  const endBound = hasEnd ? endOfLocalDay(parseIsoDateToLocal(periodEndIso)) : null;

  return transactions.filter((item) => {
    const ct = item.completedAt;
    if (!(ct instanceof Date) || Number.isNaN(ct.getTime())) return false;
    if (startBound && ct < startBound) return false;
    if (endBound && ct > endBound) return false;
    return true;
  });
}

export function describeAnalyticsPeriod(periodStartIso, periodEndIso, bounds) {
  if (!bounds.min || !bounds.max) return '';

  const startBound = periodStartIso ? startOfLocalDay(parseIsoDateToLocal(periodStartIso)) : null;
  const endBound = periodEndIso ? endOfLocalDay(parseIsoDateToLocal(periodEndIso)) : null;

  if (!periodStartIso && !periodEndIso) {
    return `${dateFmt.format(bounds.min)} → ${dateFmt.format(bounds.max)}`;
  }

  const fromLabel = periodStartIso ? dateFmt.format(startBound) : dateFmt.format(bounds.min);
  const toLabel = periodEndIso ? dateFmt.format(endBound) : dateFmt.format(bounds.max);
  return `${fromLabel} → ${toLabel}`;
}
