/**
 * WoWHead Copier - Content Script
 * Adds copy buttons to item names and reagent lists on WoWHead listview tables.
 * Uses WoWHead's XML API (?item=ID&xml) to resolve real item names.
 *
 * DOM structure (per row):
 *   tr.listview-row
 *     td[0] → div.iconmedium > a[aria-label]        (item icon)
 *     td[1] → a.listview-cleartext.q2 "Item Name"   (item text link)
 *     td[2] → N × div.iconmedium                    (reagents)
 *                  > a[href="/fr/item=ID/slug"]      (icon only, no text)
 *                  > span.wh-icon-text "qty"         (missing if qty=1)
 *     td[3] → profession info
 */

(function () {
  'use strict';

  const PROCESSED = 'data-whc';

  // ── Detect current locale from URL (fr, de, es, etc.) ──────────────────
  const localeMatch = location.pathname.match(/^\/(fr|de|es|pt|it|ru|ko|cn)\//);
  const locale = localeMatch ? localeMatch[1] : '';
  const baseUrl = locale
    ? `${location.origin}/${locale}`
    : location.origin;

  // ── Name cache: itemId → Promise<string> ───────────────────────────────
  const nameCache = new Map();

  // ── Fetch real item name from WoWHead XML API ──────────────────────────
  function fetchItemName(itemId) {
    if (nameCache.has(itemId)) return nameCache.get(itemId);

    const promise = fetch(`${baseUrl}/item=${itemId}&xml`)
      .then(res => res.text())
      .then(xml => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const nameEl = doc.querySelector('item > name');
        if (nameEl?.textContent) {
          return nameEl.textContent.trim();
        }
        // Fallback: try json field
        const jsonEl = doc.querySelector('item > json');
        if (jsonEl?.textContent) {
          const m = jsonEl.textContent.match(/"displayName"\s*:\s*"([^"]+)"/);
          if (m) return m[1];
          const m2 = jsonEl.textContent.match(/"name"\s*:\s*"([^"]+)"/);
          if (m2) return m2[1];
        }
        return null;
      })
      .catch(() => null);

    nameCache.set(itemId, promise);
    return promise;
  }

  // ── Extract item ID from href ──────────────────────────────────────────
  function itemIdFromHref(href) {
    if (!href) return null;
    const m = href.match(/\/item=(\d+)/);
    return m ? m[1] : null;
  }

  // ── Fallback: readable name from URL slug ──────────────────────────────
  function nameFromSlug(href) {
    if (!href) return '??';
    const m = href.match(/\/(?:item|spell)=\d+\/(.+?)(?:#|$)/);
    if (!m) return '??';
    return decodeURIComponent(m[1])
      .replace(/-/g, ' ')
      .replace(/^\w/, c => c.toUpperCase());
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  function toast(msg, anchor) {
    document.querySelectorAll('.whc-toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'whc-toast';
    el.textContent = msg;
    const r = anchor.getBoundingClientRect();
    el.style.left = (r.left + window.scrollX) + 'px';
    el.style.top = (r.top + window.scrollY - 32) + 'px';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('whc-toast-visible'));
    setTimeout(() => {
      el.classList.remove('whc-toast-visible');
      setTimeout(() => el.remove(), 250);
    }, 1200);
  }

  // ── Copy to clipboard ──────────────────────────────────────────────────
  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), {
        value: text, style: 'position:fixed;left:-9999px',
      });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('✓ Copié !', btn);
  }

  // ── Build a small copy button ──────────────────────────────────────────
  const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  function makeBtn(title, onClick, extraClass) {
    const btn = document.createElement('button');
    btn.className = 'whc-copy-btn' + (extraClass ? ' ' + extraClass : '');
    btn.title = title;
    btn.innerHTML = COPY_SVG;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      onClick(btn);
    });
    return btn;
  }

  // ── Parse one reagent div.iconmedium ───────────────────────────────────
  // Returns { href, itemId, qty, slugName }
  // Real names are resolved async via resolveReagentNames()
  function parseReagentDiv(div) {
    const link = div.querySelector('a[href*="/item="], a[href*="/spell="]');
    if (!link) return null;

    const href = link.getAttribute('href') || '';
    const itemId = itemIdFromHref(href);
    const slugName = nameFromSlug(href);

    const qtySpan = div.querySelector('span.wh-icon-text');
    const qty = qtySpan ? (parseInt(qtySpan.textContent, 10) || 1) : 1;

    return { href, itemId, qty, slugName };
  }

  // ── Resolve real names for an array of reagents ────────────────────────
  // Returns Promise<Array<{ name, qty }>>
  async function resolveReagentNames(reagents) {
    return Promise.all(
      reagents.map(async r => {
        let name = r.slugName;
        if (r.itemId) {
          const realName = await fetchItemName(r.itemId);
          if (realName) name = realName;
        }
        return { name, qty: r.qty };
      })
    );
  }

  // ── Format reagent list as text ────────────────────────────────────────
  function formatReagents(resolved, indent = '') {
    return resolved.map(r => `${indent}${r.qty}x ${r.name}`).join('\n');
  }

  // ── Prefetch all reagent names visible in a table ──────────────────────
  function prefetchTable(table) {
    const links = table.querySelectorAll('td:nth-child(3) div.iconmedium a[href*="/item="]');
    const seen = new Set();
    links.forEach(link => {
      const id = itemIdFromHref(link.getAttribute('href'));
      if (id && !seen.has(id)) {
        seen.add(id);
        fetchItemName(id); // fire and forget — populates cache
      }
    });
  }

  // ── Process a single .listview-row ─────────────────────────────────────
  function processRow(row) {
    if (row.getAttribute(PROCESSED)) return;
    row.setAttribute(PROCESSED, '1');

    const cells = row.querySelectorAll(':scope > td');
    if (cells.length < 3) return;

    // ── Item name (td[1] → a.listview-cleartext) ─────────────────────
    const nameLink = cells[1]?.querySelector('a.listview-cleartext');
    const itemName = nameLink?.textContent.trim();
    if (!itemName) return;

    // ── Reagents (td[2] → all div.iconmedium) ────────────────────────
    const reagentDivs = cells[2]?.querySelectorAll(':scope > div.iconmedium') || [];
    const reagents = Array.from(reagentDivs).map(parseReagentDiv).filter(Boolean);

    // ── Inject buttons ───────────────────────────────────────────────
    const nameContainer = nameLink.parentElement;
    nameContainer.style.display = 'flex';
    nameContainer.style.alignItems = 'center';
    nameContainer.style.gap = '2px';

    // 1) Copy item name
    nameContainer.appendChild(
      makeBtn('Copier le nom', btn => copy(itemName, btn))
    );

    if (reagents.length > 0) {
      // 2) Copy name + reagents
      nameContainer.appendChild(
        makeBtn('Copier nom + composants', async btn => {
          const resolved = await resolveReagentNames(reagents);
          const text = itemName + '\n' + formatReagents(resolved, '  ');
          copy(text, btn);
        }, 'whc-copy-all')
      );

      // 3) Copy reagents only (end of reagent cell)
      const reagentCell = cells[2];
      const reagentBtn = makeBtn('Copier les composants', async btn => {
        const resolved = await resolveReagentNames(reagents);
        copy(formatReagents(resolved), btn);
      }, 'whc-copy-reagents');
      reagentBtn.style.verticalAlign = 'middle';
      reagentBtn.style.display = 'inline-flex';
      reagentCell.appendChild(reagentBtn);
    }
  }

  // ── Collect & aggregate all reagents from a table ────────────────────
  function collectAllReagents(table) {
    const totals = new Map(); // itemId → { slugName, qty }
    const rows = table.querySelectorAll('tr.listview-row');

    for (const row of rows) {
      const cells = row.querySelectorAll(':scope > td');
      if (cells.length < 3) continue;
      const divs = cells[2]?.querySelectorAll(':scope > div.iconmedium') || [];
      for (const div of divs) {
        const r = parseReagentDiv(div);
        if (!r || !r.itemId) continue;
        if (totals.has(r.itemId)) {
          totals.get(r.itemId).qty += r.qty;
        } else {
          totals.set(r.itemId, { itemId: r.itemId, slugName: r.slugName, qty: r.qty });
        }
      }
    }

    return Array.from(totals.values());
  }

  // ── Bulk buttons (copy list + copy total) ──────────────────────────────
  function addBulkButtons(table) {
    if (table.getAttribute(PROCESSED + '-bulk')) return;
    table.setAttribute(PROCESSED + '-bulk', '1');

    // Container for both buttons
    const bar = document.createElement('div');
    bar.className = 'whc-bulk-bar';

    // ── Button 1: Copy all rows (existing) ───────────────────────────
    const btnList = document.createElement('button');
    btnList.className = 'whc-copy-btn whc-bulk-copy';
    btnList.textContent = '📋 Copier toute la liste';
    btnList.title = 'Copier tous les objets avec leurs composants';
    btnList.addEventListener('click', async e => {
      e.preventDefault();
      btnList.textContent = '⏳ Chargement…';
      btnList.disabled = true;

      const rows = table.querySelectorAll('tr.listview-row');
      const blocks = [];

      for (const row of rows) {
        const cells = row.querySelectorAll(':scope > td');
        if (cells.length < 3) continue;
        const name = cells[1]?.querySelector('a.listview-cleartext')?.textContent.trim();
        if (!name) continue;
        const divs = cells[2]?.querySelectorAll(':scope > div.iconmedium') || [];
        const reagents = Array.from(divs).map(parseReagentDiv).filter(Boolean);
        if (reagents.length) {
          const resolved = await resolveReagentNames(reagents);
          blocks.push(name + '\n' + formatReagents(resolved, '  '));
        } else {
          blocks.push(name);
        }
      }

      btnList.textContent = '📋 Copier toute la liste';
      btnList.disabled = false;
      if (blocks.length) copy(blocks.join('\n\n'), btnList);
    });

    // ── Button 2: Copy total reagents (NEW) ──────────────────────────
    const btnTotal = document.createElement('button');
    btnTotal.className = 'whc-copy-btn whc-bulk-copy whc-bulk-total';
    btnTotal.textContent = '🧮 Copier le total des composants';
    btnTotal.title = 'Additionner tous les composants nécessaires pour tout crafter';
    btnTotal.addEventListener('click', async e => {
      e.preventDefault();
      btnTotal.textContent = '⏳ Chargement…';
      btnTotal.disabled = true;

      const aggregated = collectAllReagents(table);
      const resolved = await resolveReagentNames(aggregated);

      // Sort by quantity descending
      resolved.sort((a, b) => b.qty - a.qty);

      const text = '=== Total des composants ===\n' +
        resolved.map(r => `${r.qty}x ${r.name}`).join('\n');

      btnTotal.textContent = '🧮 Copier le total des composants';
      btnTotal.disabled = false;
      copy(text, btnTotal);
    });

    bar.appendChild(btnList);
    bar.appendChild(btnTotal);
    table.parentElement.insertBefore(bar, table);
  }

  // ── Scan page ──────────────────────────────────────────────────────────
  function scan() {
    document.querySelectorAll('table.listview-mode-default').forEach(table => {
      // Prefetch all item names in background as soon as table appears
      prefetchTable(table);
      addBulkButtons(table);
      table.querySelectorAll('tr.listview-row').forEach(processRow);
    });
  }

  // ── Observe dynamic content ────────────────────────────────────────────
  const obs = new MutationObserver(() => {
    clearTimeout(obs._t);
    obs._t = setTimeout(scan, 200);
  });

  function init() {
    obs.observe(document.body, { childList: true, subtree: true });
    scan();
    setTimeout(scan, 1500);
    setTimeout(scan, 3500);
    document.addEventListener('click', e => {
      if (e.target.closest('.tabs-tab, [class*="tab"]')) {
        setTimeout(scan, 400);
        setTimeout(scan, 1200);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
