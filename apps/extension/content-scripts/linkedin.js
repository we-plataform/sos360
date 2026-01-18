// LinkedIn content script

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const SELECTORS = {
    // Search results / connections
    searchResultCard: '.entity-result__item',
    personName: '.entity-result__title-text a span[aria-hidden="true"]',
    personLink: '.entity-result__title-text a',
    personHeadline: '.entity-result__primary-subtitle',
    personAvatar: '.entity-result__image img',

    // Profile page
    profileName: 'h1.text-heading-xlarge',
    profileHeadline: '.text-body-medium',
    profileLocation: '.text-body-small',
    profileAbout: '#about ~ .display-flex span[aria-hidden="true"]',
    profileAvatar: '.pv-top-card-profile-picture__image',
    connectionsCount: '.pv-top-card--list li:last-child span',

    // Connections page
    connectionCard: '.mn-connection-card',
    connectionName: '.mn-connection-card__name',
    connectionLink: '.mn-connection-card__link',
    connectionOccupation: '.mn-connection-card__occupation',
    connectionAvatar: '.mn-connection-card__picture img',
    connectionContainer: '.mn-connection-card__details', // useful scope

    // Containers
    connectionsGrid: '.mn-connections__grid-list',
  };

  const UI_ID = 'sos360-linkedin-overlay';

  // --- State Management ---
  const state = {
    isAutoScrolling: false,
    qualifiedLeads: new Map(), // username -> lead object
    keywords: [],
    scrolledCount: 0,
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
    // Handle both full URLs and relative paths
    const href = url.startsWith('http') ? url : `https://www.linkedin.com${url}`;
    const match = href.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? match[1] : null;
  }

  function matchesKeywords(text, keywords) {
    if (!keywords || keywords.length === 0) return true; // No filter = all match
    if (!text) return false;

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase().trim()));
  }

  // --- UI Construction ---
  function createOverlay() {
    if (document.getElementById(UI_ID)) return;

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
      </div>
    `;

    // Inject Styles
    const style = document.createElement('style');
    style.textContent = `
      #${UI_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background: #333; /* Dark background as in request image */
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        overflow: hidden;
      }
      
      #${UI_ID} .sos-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #444;
        border-bottom: 1px solid #555;
      }
      
      #${UI_ID} .sos-title {
        font-weight: 600;
        font-size: 14px;
      }
      
      #${UI_ID} .sos-close {
        background: none;
        border: none;
        color: #aaa;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      
      #${UI_ID} .sos-close:hover {
        color: #fff;
      }
      
      #${UI_ID} .sos-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      #${UI_ID} .sos-input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      #${UI_ID} label {
        font-size: 12px;
        color: #ccc;
      }
      
      #${UI_ID} input {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px;
        font-size: 13px;
        color: #333;
      }
      
      #${UI_ID} .sos-stats {
        display: flex;
        justify-content: space-between;
        background: #222;
        padding: 8px;
        border-radius: 4px;
        margin-bottom: 4px;
      }
      
      #${UI_ID} .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      #${UI_ID} .stat-item .label {
        font-size: 10px;
        color: #aaa;
      }
      
      #${UI_ID} .stat-item .value {
        font-size: 16px;
        font-weight: bold;
        color: #fff;
      }
      
      #${UI_ID} .sos-btn {
        width: 100%;
        padding: 10px;
        border: none;
        border-radius: 4px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: opacity 0.2s;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
      }
      
      #${UI_ID} .sos-btn:hover:not(:disabled) {
        opacity: 0.9;
      }
      
      #${UI_ID} .sos-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      #${UI_ID} .sos-btn-primary {
        background: #ec4899; /* Pinkish/Magenta from screenshot */
        color: white;
        margin-bottom: 8px;
      }
      
      #${UI_ID} .sos-btn-action {
        background: #3b82f6; /* Blue */
        color: white;
      }
      
      #${UI_ID} .sos-btn-stop {
        background: #ef4444; /* Red */
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Event Listeners
    document.getElementById('sos-close').addEventListener('click', () => {
      overlay.style.display = 'none';
      stopAutoScroll();
    });

    document.getElementById('sos-keywords').addEventListener('input', (e) => {
      updateKeywords(e.target.value);
    });

    const scrollBtn = document.getElementById('sos-scroll-btn');
    scrollBtn.addEventListener('click', () => {
      if (state.isAutoScrolling) {
        stopAutoScroll();
      } else {
        startAutoScroll();
      }
    });

    document.getElementById('sos-import-btn').addEventListener('click', importQualifiedLeads);
  }

  function updateKeywords(input) {
    if (!input.trim()) {
      state.keywords = [];
    } else {
      state.keywords = input.split(',').map(s => s.trim()).filter(Boolean);
    }
    // Re-scan current connections just in case filters changed (optional, but good UX)
    scanConnections();
  }

  function updateUI() {
    const scannedEl = document.getElementById('sos-scanned-count');
    const qualifiedEl = document.getElementById('sos-qualified-count');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');
    const scrollBtn = document.getElementById('sos-scroll-btn');

    if (scannedEl) scannedEl.textContent = state.totalConnectionsFound;
    if (qualifiedEl) qualifiedEl.textContent = state.qualifiedLeads.size;

    if (importBtn) {
      importBtn.disabled = state.qualifiedLeads.size === 0;
      importText.textContent = `Import ${state.qualifiedLeads.size} profiles...`;
    }

    if (scrollBtn) {
      if (state.isAutoScrolling) {
        scrollBtn.textContent = 'Stop Auto-Scroll';
        scrollBtn.classList.add('sos-btn-stop');
        scrollBtn.classList.remove('sos-btn-primary');
      } else {
        scrollBtn.innerHTML = '<span>&raquo;</span> Start Auto-Scroll';
        scrollBtn.classList.add('sos-btn-primary');
        scrollBtn.classList.remove('sos-btn-stop');
      }
    }
  }

  // --- Core Logic ---

  function scanConnections() {
    const cards = document.querySelectorAll(SELECTORS.connectionCard);
    state.totalConnectionsFound = cards.length;

    cards.forEach(card => {
      try {
        const linkEl = card.querySelector(SELECTORS.connectionLink);
        if (!linkEl) return;

        const profileUrl = linkEl.href?.split('?')[0];
        const username = parseLinkedInUrl(profileUrl);
        if (!username) return;

        // If we already have this valid user in our map, we skip reprocessing strictly
        // UNLESS we want to re-eval based on new keywords.
        // For simplicity, let's always re-eval if keywords change or on scroll.

        const occupationEl = card.querySelector(SELECTORS.connectionOccupation);
        const bio = getTextContent(occupationEl);

        // Qualification Check
        if (matchesKeywords(bio, state.keywords)) {
          const nameEl = card.querySelector(SELECTORS.connectionName);
          const avatarEl = card.querySelector(SELECTORS.connectionAvatar);

          state.qualifiedLeads.set(username, {
            username,
            fullName: getTextContent(nameEl),
            profileUrl,
            bio,
            avatarUrl: avatarEl?.src || null,
          });
        } else {
          // Remove if it was there but now doesn't match new keywords
          if (state.qualifiedLeads.has(username)) {
            state.qualifiedLeads.delete(username);
          }
        }
      } catch (e) {
        console.warn('Error parsing card', e);
      }
    });

    updateUI();
  }

  async function startAutoScroll() {
    state.isAutoScrolling = true;
    updateUI();

    let noChangeCount = 0;
    let lastHeight = document.body.scrollHeight;

    while (state.isAutoScrolling) {
      // 1. Scan current view
      scanConnections();

      // 2. Scroll
      window.scrollTo(0, document.body.scrollHeight);

      // 3. Wait randomly
      await sleep(2000 + Math.random() * 1500);

      // 4. Check for end of list
      const newHeight = document.body.scrollHeight;
      if (newHeight === lastHeight) {
        noChangeCount++;
        // Try a tiny scroll up then down to trigger lazy load events if stuck
        if (noChangeCount === 2) {
          window.scrollBy(0, -300);
          await sleep(500);
          window.scrollTo(0, document.body.scrollHeight);
        }

        if (noChangeCount >= 4) {
          console.log('No new content loaded after multiple attempts. Stopping.');
          stopAutoScroll();
          break;
        }
      } else {
        noChangeCount = 0;
        lastHeight = newHeight;
      }
    }
  }

  function stopAutoScroll() {
    state.isAutoScrolling = false;
    updateUI();
    // One final scan
    scanConnections();
  }

  async function importQualifiedLeads() {
    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) return;

    const btn = document.getElementById('sos-import-btn');
    const originalText = document.getElementById('sos-import-text').textContent;
    btn.disabled = true;
    document.getElementById('sos-import-text').textContent = 'Importing...';

    // Send to background
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'importLeads',
        data: {
          source: 'extension_linkedin_connections',
          platform: 'linkedin',
          sourceUrl: window.location.href,
          leads: leads
        }
      });

      if (response && response.success) {
        alert(`Successfully imported ${leads.length} leads!`);
        // Clear qualified leads to prevent duplicate import? 
        // Maybe keep them but visual feedback is enough.
      } else {
        alert('Import failed: ' + (response?.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Import error', e);
      alert('Communication error with extension background script.');
    } finally {
      btn.disabled = false;
      document.getElementById('sos-import-text').textContent = originalText;
    }
  }

  // --- Logic Router ---
  function init() {
    // Only run on Connections page for the UI overlay feature
    if (window.location.href.includes('/mynetwork/invite-connect/connections/')) {
      // Wait a small delay for page init
      setTimeout(createOverlay, 1500);
    }
  }

  // Listen for URL changes (SPA navigation)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const url = window.location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      init();
    }
  }).observe(document, { subtree: true, childList: true });

  // Initial Run
  init();

  // --- Message Listener (Keep existing functionality/compatibility) ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      // Keep existing handling just in case popup needs it, but we mostly use the overlay now
      if (request.action === 'extractLeads') {
        scanConnections();
        sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
      }
    })();
    return true;
  });

  console.log('SOS 360 LinkedIn Overlay Loaded');

})();
