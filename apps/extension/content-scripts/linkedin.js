// LinkedIn content script - SOS 360
// Version 3 - Updated for current LinkedIn UI

(function () {
  'use strict';

  const UI_ID = 'sos360-linkedin-overlay';

  // --- State Management ---
  const state = {
    isAutoScrolling: false,
    qualifiedLeads: new Map(),
    keywords: [],
    totalConnectionsFound: 0,
  };

  // --- Helper Functions ---
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  function parseLinkedInUrl(url) {
    if (!url) return null;
    const href = url.startsWith('http') ? url : `https://www.linkedin.com${url}`;
    const match = href.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? match[1] : null;
  }

  function matchesKeywords(text, keywords) {
    if (!keywords || keywords.length === 0) return true;
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase().trim()));
  }

  // --- Find scrollable container ---
  function findScrollableContainer() {
    // LinkedIn uses several possible scroll containers
    const candidates = [
      '.scaffold-layout__main',
      '.scaffold-finite-scroll__content',
      'main',
      '.authentication-outlet',
      '[data-finite-scroll-hotkey-context]',
    ];

    for (const selector of candidates) {
      const el = document.querySelector(selector);
      if (el) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;

        console.log(`[SOS 360] Checking ${selector}: overflow=${overflowY}, scrollHeight=${el.scrollHeight}, clientHeight=${el.clientHeight}, scrollable=${isScrollable}`);

        if (isScrollable) {
          return el;
        }
      }
    }

    // Fallback: find the first scrollable element with significant height
    const allElements = document.querySelectorAll('div, main, section');
    for (const el of allElements) {
      if (el.scrollHeight > 1000 && el.scrollHeight > el.clientHeight + 100) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          console.log(`[SOS 360] Found scrollable via fallback: ${el.className}`);
          return el;
        }
      }
    }

    console.log('[SOS 360] No scrollable container found, using documentElement');
    return document.documentElement;
  }

  // --- Find connection cards by finding profile links first ---
  function findConnectionCards() {
    // Find ALL links to LinkedIn profiles on the page
    const profileLinks = document.querySelectorAll('a[href*="/in/"]');
    console.log(`[SOS 360] Found ${profileLinks.length} profile links on page`);

    if (profileLinks.length === 0) {
      return [];
    }

    // Group by closest list item or card container
    const cardMap = new Map();

    for (const link of profileLinks) {
      // Skip if it's a navigation/header link
      if (link.closest('header') || link.closest('nav') || link.closest('.global-nav')) {
        continue;
      }

      // Find the closest containing element that looks like a card
      // LinkedIn uses li elements for list items
      let card = link.closest('li');

      // If no li, try common card container patterns
      if (!card) {
        card = link.closest('[class*="card"]') ||
          link.closest('[class*="entity"]') ||
          link.closest('[class*="list-item"]') ||
          link.closest('.artdeco-list__item');
      }

      // If still nothing, use the link's parent's parent as a reasonable container
      if (!card) {
        card = link.parentElement?.parentElement;
      }

      if (card && !cardMap.has(card)) {
        cardMap.set(card, link);
      }
    }

    const cards = Array.from(cardMap.keys());
    console.log(`[SOS 360] Found ${cards.length} unique card containers`);
    return cards;
  }


  // --- Extraction Logic ---
  function extractSearchResults() {
    const leads = [];
    const cards = document.querySelectorAll('.entity-result__item, .search-result__wrapper');
    cards.forEach(card => {
      try {
        const linkEl = card.querySelector('a[href*="/in/"]');
        if (!linkEl) return;
        const profileUrl = linkEl.href?.split('?')[0];
        const username = parseLinkedInUrl(profileUrl);
        if (!username || leads.some(l => l.username === username)) return;

        leads.push({
          username,
          fullName: getTextContent(card.querySelector('span[aria-hidden="true"]')) || getTextContent(linkEl),
          profileUrl,
          bio: getTextContent(card.querySelector('.entity-result__primary-subtitle, .search-result__subtitle')),
          avatarUrl: card.querySelector('img')?.src || null,
        });
      } catch (e) { }
    });
    return leads;
  }

  function extractCurrentProfile() {
    const url = window.location.href;
    if (!url.includes('/in/')) return null;
    const username = parseLinkedInUrl(url);
    if (!username) return null;

    return {
      username,
      fullName: getTextContent(document.querySelector('h1')),
      profileUrl: `https://linkedin.com/in/${username}`,
      bio: getTextContent(document.querySelector('.text-body-medium')),
      location: getTextContent(document.querySelector('.text-body-small.inline')),
      avatarUrl: document.querySelector('.pv-top-card-profile-picture__image, .profile-photo-edit__preview')?.src || null,
    };
  }

  // --- UI Construction ---
  function createOverlay() {
    if (document.getElementById(UI_ID)) {
      document.getElementById(UI_ID).style.display = 'block';
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = UI_ID;
    overlay.innerHTML = `
      <div class="sos-header">
        <span class="sos-title">Import: Connections</span>
        <button id="sos-close" class="sos-close">&times;</button>
      </div>
      <div class="sos-content">
        <div class="sos-input-group">
          <label for="sos-keywords">Filter by Job Title Keywords:</label>
          <input type="text" id="sos-keywords" placeholder="Keywords between commas">
        </div>
        <div class="sos-stats">
          <div class="stat-item">
            <span class="label">Total Scanned</span>
            <span class="value" id="sos-scanned-count">0</span>
          </div>
          <div class="stat-item">
            <span class="label">Qualified</span>
            <span class="value" id="sos-qualified-count">0</span>
          </div>
        </div>
        <div class="sos-actions">
          <button id="sos-scroll-btn" class="sos-btn sos-btn-primary">
            <span>&raquo;</span> Start Auto-Scroll
          </button>
          <button id="sos-import-btn" class="sos-btn sos-btn-action" disabled>
            <span class="icon">☁️</span> <span id="sos-import-text">Import 0 profiles...</span>
          </button>
        </div>
        <div id="sos-debug" style="font-size:10px;color:#888;margin-top:8px;"></div>
      </div>
      <style>
      #${UI_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background: #1f2937;
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: -apple-system, system-ui, sans-serif;
      }
      #${UI_ID} .sos-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #111827;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #374151;
      }
      #${UI_ID} .sos-title { font-weight: 600; font-size: 14px; }
      #${UI_ID} .sos-close { background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; }
      #${UI_ID} .sos-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      #${UI_ID} .sos-input-group { display: flex; flex-direction: column; gap: 6px; }
      #${UI_ID} label { font-size: 12px; color: #d1d5db; }
      #${UI_ID} input { background: #374151; border: 1px solid #4b5563; border-radius: 4px; padding: 8px; font-size: 13px; color: #fff; }
      #${UI_ID} .sos-stats { display: flex; justify-content: space-between; background: #111827; padding: 8px; border-radius: 4px; }
      #${UI_ID} .stat-item { display: flex; flex-direction: column; align-items: center; }
      #${UI_ID} .stat-item .label { font-size: 10px; color: #9ca3af; }
      #${UI_ID} .stat-item .value { font-size: 16px; font-weight: bold; color: #fff; }
      #${UI_ID} .sos-btn { width: 100%; padding: 10px; border: none; border-radius: 4px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px; }
      #${UI_ID} .sos-btn:hover:not(:disabled) { opacity: 0.9; }
      #${UI_ID} .sos-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      #${UI_ID} .sos-btn-primary { background: #ec4899; color: white; margin-bottom: 8px; }
      #${UI_ID} .sos-btn-action { background: #3b82f6; color: white; }
      #${UI_ID} .sos-btn-stop { background: #ef4444; color: white; margin-bottom: 8px; }
      </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sos-close').addEventListener('click', () => {
      document.getElementById(UI_ID).style.display = 'none';
      stopAutoScroll();
    });

    document.getElementById('sos-keywords').addEventListener('input', (e) => {
      updateKeywords(e.target.value);
    });

    if (state.keywords.length > 0) {
      document.getElementById('sos-keywords').value = state.keywords.join(', ');
    }

    document.getElementById('sos-scroll-btn').addEventListener('click', () => {
      if (state.isAutoScrolling) stopAutoScroll();
      else startAutoScroll();
    });

    document.getElementById('sos-import-btn').addEventListener('click', importQualifiedLeads);

    setTimeout(scanConnections, 500);
  }

  function updateKeywords(input) {
    state.keywords = input.trim() ? input.split(',').map(s => s.trim()).filter(Boolean) : [];
    scanConnections();
  }

  function updateUI() {
    const scannedEl = document.getElementById('sos-scanned-count');
    const qualifiedEl = document.getElementById('sos-qualified-count');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');
    const scrollBtn = document.getElementById('sos-scroll-btn');

    if (!document.getElementById(UI_ID)) return;

    if (scannedEl) scannedEl.textContent = state.totalConnectionsFound;
    if (qualifiedEl) qualifiedEl.textContent = state.qualifiedLeads.size;

    if (importBtn) {
      importBtn.disabled = state.qualifiedLeads.size === 0;
      importText.textContent = `Import ${state.qualifiedLeads.size} profiles...`;
    }

    if (scrollBtn) {
      if (state.isAutoScrolling) {
        scrollBtn.textContent = 'Stop Auto-Scroll';
        scrollBtn.className = 'sos-btn sos-btn-stop';
      } else {
        scrollBtn.innerHTML = '<span>&raquo;</span> Start Auto-Scroll';
        scrollBtn.className = 'sos-btn sos-btn-primary';
      }
    }
  }

  function updateDebug(msg) {
    const el = document.getElementById('sos-debug');
    if (el) el.textContent = msg;
  }

  // --- Core Logic ---
  function scanConnections() {
    const cards = findConnectionCards();
    state.totalConnectionsFound = cards.length;

    cards.forEach(card => {
      try {
        // Find profile link
        const linkEl = card.querySelector('a[href*="/in/"]');
        if (!linkEl) return;

        const profileUrl = linkEl.href?.split('?')[0];
        const username = parseLinkedInUrl(profileUrl);
        if (!username) return;

        // Find occupation/bio - try multiple selectors
        const bioSelectors = [
          '.mn-connection-card__occupation',
          '[class*="occupation"]',
          '.entity-result__primary-subtitle',
          '.artdeco-entity-lockup__subtitle',
          'p',
          'span:not([aria-hidden])'
        ];

        let bio = '';
        for (const sel of bioSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim().length > 5) {
            bio = el.textContent.trim();
            break;
          }
        }

        if (matchesKeywords(bio, state.keywords)) {
          // Find name
          const nameSelectors = [
            '.mn-connection-card__name',
            '[class*="connection-card__name"]',
            '.entity-result__title-text',
            '.artdeco-entity-lockup__title',
            'span[aria-hidden="true"]'
          ];

          let fullName = '';
          for (const sel of nameSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim().length > 1) {
              fullName = el.textContent.trim();
              break;
            }
          }

          const avatarEl = card.querySelector('img');

          state.qualifiedLeads.set(username, {
            username,
            fullName,
            profileUrl,
            bio,
            avatarUrl: avatarEl?.src || null,
          });
        } else {
          state.qualifiedLeads.delete(username);
        }
      } catch (e) {
        console.warn('[SOS 360] Error parsing card', e);
      }
    });

    updateUI();
  }

  async function startAutoScroll() {
    if (state.isAutoScrolling) return;
    state.isAutoScrolling = true;
    updateUI();

    console.log('[SOS 360] Auto-scroll started');

    let noChangeCount = 0;
    let scrollContainer = findScrollableContainer();

    console.log(`[SOS 360] Using scroll container: ${scrollContainer.tagName}.${scrollContainer.className?.split(' ')[0]}`);
    updateDebug(`Container: ${scrollContainer.tagName}`);

    while (state.isAutoScrolling) {
      const prevCount = state.totalConnectionsFound;
      const prevScroll = scrollContainer === document.documentElement
        ? window.scrollY
        : scrollContainer.scrollTop;

      const maxScroll = scrollContainer === document.documentElement
        ? document.body.scrollHeight
        : scrollContainer.scrollHeight;

      console.log(`[SOS 360] Scrolling to ${maxScroll}, current: ${prevScroll}`);

      // Scroll using scrollTop directly (more reliable)
      if (scrollContainer === document.documentElement) {
        window.scrollTo(0, maxScroll);
      } else {
        scrollContainer.scrollTop = maxScroll;
      }

      // Also trigger scroll event manually
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

      await sleep(2000);
      scanConnections();

      const newCount = state.totalConnectionsFound;
      const newScroll = scrollContainer === document.documentElement
        ? window.scrollY
        : scrollContainer.scrollTop;

      updateDebug(`Scanned: ${newCount}, Scroll: ${Math.round(newScroll)}`);
      console.log(`[SOS 360] After: count=${newCount}, scroll=${newScroll}`);

      if (newCount === prevCount && Math.abs(newScroll - prevScroll) < 50) {
        noChangeCount++;
        console.log(`[SOS 360] No change (${noChangeCount}/4)`);

        // Try scrolling up then down
        if (scrollContainer === document.documentElement) {
          window.scrollBy(0, -500);
        } else {
          scrollContainer.scrollTop -= 500;
        }
        await sleep(500);
        if (scrollContainer === document.documentElement) {
          window.scrollTo(0, maxScroll + 500);
        } else {
          scrollContainer.scrollTop = maxScroll + 500;
        }

        if (noChangeCount >= 4) {
          console.log('[SOS 360] Complete - no more content');
          stopAutoScroll();
        }
      } else {
        noChangeCount = 0;
      }
    }
  }

  function stopAutoScroll() {
    state.isAutoScrolling = false;
    updateUI();
    scanConnections();
  }

  async function importQualifiedLeads() {
    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) return;

    const btn = document.getElementById('sos-import-btn');
    const textEl = document.getElementById('sos-import-text');
    if (!btn || !textEl) return;

    const originalText = textEl.textContent;
    btn.disabled = true;
    textEl.textContent = 'Importing...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'importLeads',
        data: {
          source: 'extension',
          platform: 'linkedin',
          sourceUrl: window.location.href,
          leads: leads
        }
      });

      if (response?.success) {
        alert(`Success! Imported ${leads.length} leads.`);
      } else {
        alert('Import failed: ' + (response?.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      btn.disabled = false;
      textEl.textContent = originalText;
    }
  }

  // --- Initialization ---
  function init() {
    const url = location.href;

    if (url.includes('/mynetwork/invite-connect/connections/')) {
      const poller = setInterval(() => {
        const cards = findConnectionCards();
        if (cards.length > 0) {
          clearInterval(poller);
          console.log(`[SOS 360] Found ${cards.length} connection cards, creating overlay`);
          createOverlay();
          scanConnections();
        }
      }, 1000);
      setTimeout(() => clearInterval(poller), 30000);
    } else {
      const el = document.getElementById(UI_ID);
      if (el) el.style.display = 'none';
      state.isAutoScrolling = false;
    }
  }

  // SPA Observer
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      init();
    }
  }).observe(document, { subtree: true, childList: true });

  init();

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      if (request.action === 'extractLeads') {
        const url = window.location.href;
        if (url.includes('/connections/') && state.qualifiedLeads.size > 0) {
          sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
        } else if (url.includes('/search/results/')) {
          sendResponse({ success: true, data: extractSearchResults() });
        } else if (url.includes('/in/')) {
          const profile = extractCurrentProfile();
          sendResponse({ success: !!profile, data: profile ? [profile] : [] });
        } else {
          scanConnections();
          sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
        }
      } else if (request.action === 'extractProfile') {
        const p = extractCurrentProfile();
        sendResponse({ success: !!p, data: p });
      } else if (request.action === 'openOverlay') {
        createOverlay();
        sendResponse({ success: true });
      }
    })();
    return true;
  });

  console.log('[SOS 360] LinkedIn Script v3 Loaded');
})();
