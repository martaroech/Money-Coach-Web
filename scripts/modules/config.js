export const STORAGE_KEY = 'moneyCoachWeb.transactions.v1';
export const SETTINGS_KEY = 'moneyCoachWeb.settings.v1';
export const CATEGORIES_KEY = 'moneyCoachWeb.categories.v1';

export const categoryOrder = [
  'Casa',
  'Spesa',
  'Ristoranti',
  'Trasporti',
  'Shopping',
  'Abbonamenti',
  'Salute',
  'Viaggi',
  'Entrate',
  'Trasferimenti',
  'Altro',
];

export const categoryColors = {
  Casa: '#116a4a',
  Spesa: '#0e7c7b',
  Ristoranti: '#e36f54',
  Trasporti: '#547aa5',
  Shopping: '#8a6f3e',
  Abbonamenti: '#7a5ea7',
  Salute: '#d05d86',
  Viaggi: '#4b8f8c',
  Entrate: '#b80022',
  Trasferimenti: '#8d9691',
  Altro: '#66736d',
};

export const categoryIcons = {
  Casa: 'fa-house',
  Spesa: 'fa-cart-shopping',
  Ristoranti: 'fa-utensils',
  Trasporti: 'fa-bus',
  Shopping: 'fa-bag-shopping',
  Abbonamenti: 'fa-repeat',
  Salute: 'fa-heart-pulse',
  Viaggi: 'fa-plane',
  Entrate: 'far fa-square-plus',
  Trasferimenti: 'fa-right-left',
  Altro: 'fa-tag',
};

/** Classi icone già usate dalle categorie predefinite (escluse dal selettore «nuova categoria»). */
export const BUILT_IN_ICON_CLASS_TOKENS = new Set(
  Object.values(categoryIcons)
    .join(' ')
    .split(/\s+/)
    .filter((token) => token.startsWith('fa-')),
);

/**
 * Circa 30 icone Font Awesome Solid per nuove categorie, senza ripetere quelle built-in.
 */
export const CATEGORY_ICON_PICKER_ICONS = [
  'fa-mug-hot',
  'fa-film',
  'fa-dumbbell',
  'fa-paw',
  'fa-gift',
  'fa-wrench',
  'fa-mobile-screen-button',
  'fa-book',
  'fa-landmark',
  'fa-gas-pump',
  'fa-car-side',
  'fa-train',
  'fa-gamepad',
  'fa-burger',
  'fa-pills',
].filter((cls) => !BUILT_IN_ICON_CLASS_TOKENS.has(cls));

export const NEW_CATEGORY_COLOR_ROTATION = [
  '#5c6bc0',
  '#00897b',
  '#fb8c00',
  '#7e57c2',
  '#43a047',
  '#d81b60',
  '#3949ab',
  '#6d4c41',
];

export const budgets = {
  Casa: 650,
  Spesa: 420,
  Ristoranti: 260,
  Trasporti: 180,
  Shopping: 180,
  Abbonamenti: 90,
  Salute: 120,
  Viaggi: 250,
  Altro: 160,
};

export const defaultSettings = {
  monthlySavingsTarget: 300,
  /** yyyy-MM-DD o '' = nessun limite su quel estremo */
  analyticsPeriodStart: '',
  analyticsPeriodEnd: '',
};

export const defaultCategories = categoryOrder
  .filter((name) => !['Entrate', 'Trasferimenti'].includes(name))
  .map((name) => ({
    id: slugCategory(name),
    name,
    color: categoryColors[name],
    icon: categoryIcons[name],
    monthlyGoal: 0,
  }));

function slugCategory(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
