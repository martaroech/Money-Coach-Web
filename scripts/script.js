import { initApp } from './modules/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp().catch((error) => {
    console.error('Money Coach non è riuscita ad avviarsi.', error);
  });
});
