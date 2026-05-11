import { categoryColors, categoryIcons, categoryOrder } from './config.js';

const customCategoryColors = {};
const customCategoryIcons = {};

export function hasAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

export function sum(items, key) {
  return items.reduce((acc, item) => acc + item[key], 0);
}

export function sortCategories(categories) {
  return categories.sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

export function colorFor(category) {
  return customCategoryColors[category] || categoryColors[category] || categoryColors.Altro;
}

export function iconFor(category) {
  return customCategoryIcons[category] || categoryIcons[category] || categoryIcons.Altro;
}

export function setCategoryStyles(categories) {
  Object.keys(customCategoryColors).forEach((key) => delete customCategoryColors[key]);
  Object.keys(customCategoryIcons).forEach((key) => delete customCategoryIcons[key]);
  categories.forEach((category) => {
    customCategoryColors[category.name] = category.color || categoryColors.Altro;
    customCategoryIcons[category.name] = category.icon || categoryIcons.Altro;
  });
}

export function formatMoney(amount) {
  const formatted = amount.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `€${formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted}`;
}

export function dateLabel(date) {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function alpha(hex, opacity) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function setText(id, value) {
  document.getElementById(id).textContent = value;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}
