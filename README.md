# 📋 WoWHead Copier

A lightweight Chrome extension that adds copy buttons to crafting tables on [WoWHead.com](https://www.wowhead.com), making it easy to grab item names, reagent lists, and aggregated shopping lists.

No more tedious manual copying — hover, click, paste.

## Features

### Per-row copy buttons (visible on hover)

Each row in a WoWHead listview table gets up to three small copy buttons:

| Button | Location | What it copies |
|--------|----------|----------------|
| 📋 | Next to item name | The item name (e.g. `Banc en argent de Dalaran`) |
| 📋 | Second button, next to name | Item name + full reagent list |
| 📋 | End of reagent cell | Reagent list only |

**Example output (name + reagents):**

```
Banc en argent de Dalaran
  18x Bois de Vent-froid
  4x Barre d'acier-titan
  10x Encre tombeneige
```

### Bulk table buttons (above each table)

Two buttons appear above every crafting table:

| Button | What it does |
|--------|--------------|
| 📋 **Copy full list** | Copies every row with its individual reagents |
| 🧮 **Copy total reagents** | Aggregates all reagents across every row into a single shopping list, sorted by quantity |

**Example output (total reagents):**

```
=== Total des composants ===
465x Bois de Vent-froid
34x Barre d'acier-titan
20x Barre de titane
19x Encre tombeneige
14x Encre marine
...
```

This is especially useful when you need to buy everything to craft all items in a list at once.

<img width="1031" height="611" alt="image" src="https://github.com/user-attachments/assets/d44819c9-e6bf-40a6-ab66-68b5ec8c195a" />

### Real item names via XML API

Reagent icons on WoWHead tables have no visible text. The extension resolves real item names (with proper accents and apostrophes) by calling WoWHead's XML endpoint (`/item=ID&xml`). Names are cached in memory so each item is only fetched once per session.

### Dynamic content support

WoWHead loads tab content (like "Reagent for", "Created by", etc.) dynamically via JavaScript. The extension uses a `MutationObserver` to detect new tables as they appear and automatically injects copy buttons.

## Installation

1. **Download** this repository (clone or download ZIP)

   ```bash
   git clone https://github.com/YOUR_USERNAME/wowhead-copier.git
   ```

2. Open Chrome and navigate to:

   ```
   chrome://extensions/
   ```

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **"Load unpacked"** (top-left)

5. Select the `wowhead-copier` folder (the one containing `manifest.json`)

6. Done! Navigate to any WoWHead item page with a crafting table and the buttons will appear.

> **Tip:** After updating the extension files, click the 🔄 reload button on the extension card in `chrome://extensions/` to apply changes.

## Compatibility

- Works on all localized versions of WoWHead (EN, FR, DE, ES, PT, IT, RU, KO, CN)
- Chrome & Chromium-based browsers (Edge, Brave, Arc, etc.)
- Manifest V3

## File structure

```
wowhead-copier/
├── manifest.json    # Extension manifest (permissions, content scripts)
├── content.js       # Main logic (DOM parsing, XML API, copy buttons)
├── styles.css       # Button and toast notification styles
├── icon48.png       # Extension icon (48px)
└── icon128.png      # Extension icon (128px)
```

## How it works

1. A `MutationObserver` watches for WoWHead's dynamically loaded `table.listview-mode-default` elements
2. For each `tr.listview-row`, the script parses:
   - **Item name** from `a.listview-cleartext` (visible text)
   - **Reagents** from `div.iconmedium` containers (item ID extracted from the `<a>` href, quantity from `span.wh-icon-text`)
3. Item IDs are prefetched in the background via WoWHead's XML API (`/item=ID&xml`) to resolve display names
4. Copy buttons are injected inline; clicking them writes formatted text to the clipboard

## License

MIT
