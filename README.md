# Money Coach Web

Versione web nativa di Money Coach, senza build tool obbligatori:

- HTML
- JavaScript vanilla
- LESS per gli stili sorgente
- Bootstrap locale
- Fontawesome locale
- dati salvati nel browser (**IndexedDB**, con fallback `localStorage`): transazioni, impostazioni, categorie
- backup manuale in **JSON** dalla scheda Coach («Esporta backup»): utile prima di cancellare i dati di Safari o della PWA

## File principali

- `index.html`
- `styles/style-min.css`
- `scripts/script.js` (moduli in `scripts/modules/`)


## Pubblicazione GitHub Pages

Questa repo e statica. In GitHub imposta:

- `Settings > Pages`
- `Source: Deploy from a branch`
- branch `main`
- folder `/ (root)`

URL atteso:

```text
https://martaroech.github.io/Money-Coach-Web/
```
