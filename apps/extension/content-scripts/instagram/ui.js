// Instagram content script - UI Module
// Lia 360
// Handles all UI overlays and user interactions

(function () {
  'use strict';

  const utils = window.LiaInstagramUtils;
  if (!utils) {
    console.error('[Lia 360 UI] Utils not loaded');
    return;
  }

  // Constants
  const UI_ID = 'sos360-instagram-overlay';
  const POST_UI_ID = 'sos360-post-overlay';
  const FOLLOWERS_UI_ID = 'sos360-followers-overlay';

  /**
   * Create the main profile overlay UI
   */
  function createOverlay() {
    if (document.getElementById(UI_ID)) {
      document.getElementById(UI_ID).style.display = 'block';
      return;
    }

    const username = utils.getCurrentProfileUsername();
    const state = window.LiaInstagramState;
    if (state) {
      state.currentProfileUsername = username;
    }

    const overlay = document.createElement('div');
    overlay.id = UI_ID;
    overlay.innerHTML = `
      <div class="sos-header">
        <span class="sos-title">Import: @${username || 'Instagram'}</span>
        <button id="sos-close" class="sos-close">&times;</button>
      </div>
      <div class="sos-content">
        <div class="sos-input-group">
          <label for="sos-keywords">Filtrar por Keywords (bio/nome):</label>
          <input type="text" id="sos-keywords" placeholder="Ex: Marketing, CEO, Empreendedor">
        </div>
        <div class="sos-input-group">
          <label for="sos-criteria">Critérios de Qualificação IA:</label>
          <input type="text" id="sos-criteria" placeholder="Ex: Profissionais de marketing digital">
        </div>
        <div class="sos-checkbox-group" style="display:flex; align-items:center; gap:8px; margin-top:4px;">
          <input type="checkbox" id="sos-ai-qualify" style="width:16px; height:16px; cursor:pointer;">
          <label for="sos-ai-qualify" style="cursor:pointer; font-size:12px; color:#d1d5db;">🤖 Qualificar com IA durante scan</label>
        </div>
        <div class="sos-stats">
          <div class="stat-item">
            <span class="label">Escaneados</span>
            <span class="value" id="sos-scanned-count">0</span>
          </div>
          <div class="stat-item">
            <span class="label">Qualificados</span>
            <span class="value" id="sos-qualified-count">0</span>
          </div>
        </div>
        <div class="sos-dialog-actions">
          <button id="sos-open-followers" class="sos-btn sos-btn-secondary">
            👥 Abrir Seguidores
          </button>
          <button id="sos-open-following" class="sos-btn sos-btn-secondary">
            👤 Abrir Seguindo
          </button>
        </div>
        <div class="sos-actions">
          <button id="sos-scan-btn" class="sos-btn sos-btn-primary">
            🔍 Scanear Dialog
          </button>
          <button id="sos-import-btn" class="sos-btn sos-btn-action" disabled>
            <span class="icon">☁️</span> <span id="sos-import-text">Importar 0 perfis...</span>
          </button>
        </div>
      </div>
      <style>
      #${UI_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(225, 48, 108, 0.3);
        z-index: 2147483647;
        font-family: -apple-system, system-ui, sans-serif;
        border: 1px solid rgba(225, 48, 108, 0.3);
      }
      #${UI_ID} .sos-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: linear-gradient(90deg, #833ab4, #e1306c);
        border-radius: 12px 12px 0 0;
      }
      #${UI_ID} .sos-title { font-weight: 600; font-size: 14px; }
      #${UI_ID} .sos-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; opacity: 0.8; }
      #${UI_ID} .sos-close:hover { opacity: 1; }
      #${UI_ID} .sos-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      #${UI_ID} .sos-input-group { display: flex; flex-direction: column; gap: 6px; }
      #${UI_ID} label { font-size: 12px; color: #d1d5db; }
      #${UI_ID} input {
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 13px;
        color: #fff;
        transition: border-color 0.2s;
      }
      #${UI_ID} input:focus {
        outline: none;
        border-color: #e1306c;
      }
      #${UI_ID} .sos-stats {
        display: flex;
        justify-content: space-around;
        background: rgba(0,0,0,0.3);
        padding: 12px;
        border-radius: 8px;
      }
      #${UI_ID} .stat-item { display: flex; flex-direction: column; align-items: center; }
      #${UI_ID} .stat-item .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; }
      #${UI_ID} .stat-item .value { font-size: 20px; font-weight: bold; color: #fff; }
      #${UI_ID} .sos-dialog-actions { display: flex; gap: 8px; }
      #${UI_ID} .sos-actions { display: flex; flex-direction: column; gap: 8px; }
      #${UI_ID} .sos-btn {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      }
      #${UI_ID} .sos-btn:hover:not(:disabled) { transform: translateY(-1px); }
      #${UI_ID} .sos-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      #${UI_ID} .sos-btn-primary {
        background: linear-gradient(90deg, #833ab4, #e1306c);
        color: white;
      }
      #${UI_ID} .sos-btn-secondary {
        background: #374151;
        color: white;
        flex: 1;
      }
      #${UI_ID} .sos-btn-secondary:hover:not(:disabled) { background: #4b5563; }
      #${UI_ID} .sos-btn-action {
        background: linear-gradient(90deg, #e1306c, #f77737);
        color: white;
      }
      #${UI_ID} .sos-btn-stop {
        background: #ef4444;
        color: white;
      }
      </style>
    `;

    document.body.appendChild(overlay);

    // Attach event listeners
    document.getElementById('sos-close').addEventListener('click', () => {
      document.getElementById(UI_ID).style.display = 'none';
      if (window.LiaInstagramFollowers) {
        window.LiaInstagramFollowers.stopFollowersScanning();
      }
    });

    document.getElementById('sos-keywords').addEventListener('input', (e) => {
      const state = window.LiaInstagramState;
      if (state) {
        updateKeywords(e.target.value);
      }
    });

    document.getElementById('sos-criteria').addEventListener('input', (e) => {
      const state = window.LiaInstagramState;
      if (state) {
        state.criteria = e.target.value.trim();
      }
    });

    document.getElementById('sos-ai-qualify').addEventListener('change', (e) => {
      const state = window.LiaInstagramState;
      if (state) {
        state.useAIQualification = e.target.checked;
        if (!state.useAIQualification) {
          state.pendingAIBatch = [];
        }
      }
    });

    document.getElementById('sos-open-followers').addEventListener('click', () => {
      if (window.LiaInstagramFollowers) {
        window.LiaInstagramFollowers.openFollowersDialog();
      }
    });

    document.getElementById('sos-open-following').addEventListener('click', () => {
      if (window.LiaInstagramFollowers) {
        window.LiaInstagramFollowers.openFollowingDialog();
      }
    });

    document.getElementById('sos-scan-btn').addEventListener('click', toggleScanning);
    document.getElementById('sos-import-btn').addEventListener('click', importQualifiedLeads);
  }

  function updateKeywords(input) {
    const state = window.LiaInstagramState;
    if (!state) return;

    state.keywords = input.trim() ? input.split(',').map(s => s.trim()).filter(Boolean) : [];
    refilterLeads();
  }

  function refilterLeads() {
    const state = window.LiaInstagramState;
    if (!state || state.keywords.length === 0) return;

    for (const [username, lead] of state.qualifiedLeads) {
      const searchText = `${lead.fullName || ''} ${lead.bio || ''}`.toLowerCase();
      if (!utils.matchesKeywords(searchText, state.keywords)) {
        state.qualifiedLeads.delete(username);
      }
    }
    updateUI();
  }

  function updateUI() {
    const state = window.LiaInstagramState;
    if (!state) return;

    const scannedEl = document.getElementById('sos-scanned-count');
    const qualifiedEl = document.getElementById('sos-qualified-count');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');
    const scanBtn = document.getElementById('sos-scan-btn');

    if (!document.getElementById(UI_ID)) return;

    if (scannedEl) scannedEl.textContent = state.totalUsersFound;
    if (qualifiedEl) qualifiedEl.textContent = state.qualifiedLeads.size;

    if (importBtn) {
      importBtn.disabled = state.qualifiedLeads.size === 0;
      importText.textContent = `Importar ${state.qualifiedLeads.size} perfis...`;
    }

    if (scanBtn) {
      if (state.isAutoScrolling) {
        scanBtn.textContent = '⏹️ Parar Scan';
        scanBtn.className = 'sos-btn sos-btn-stop';
      } else {
        scanBtn.textContent = '🔍 Scanear Dialog';
        scanBtn.className = 'sos-btn sos-btn-primary';
      }
    }
  }

  function toggleScanning() {
    const state = window.LiaInstagramState;
    if (!state) return;

    if (state.isAutoScrolling) {
      if (window.LiaInstagramFollowers) {
        window.LiaInstagramFollowers.stopFollowersScanning();
      }
    } else {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) {
        alert('Por favor, abra o dialog de seguidores ou seguindo primeiro.');
        return;
      }
      if (window.LiaInstagramFollowers) {
        window.LiaInstagramFollowers.startFollowersScanning();
      }
    }
    updateUI();
  }

  async function importQualifiedLeads() {
    const state = window.LiaInstagramState;
    if (!state) return;

    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) return;

    const btn = document.getElementById('sos-import-btn');
    const textEl = document.getElementById('sos-import-text');
    if (!btn || !textEl) return;

    const originalText = textEl.textContent;

    btn.disabled = true;
    textEl.textContent = 'Importando...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'importLeads',
        data: {
          source: 'extension',
          platform: 'instagram',
          sourceUrl: window.location.href,
          leads: leads
        }
      });

      if (response?.success) {
        alert(`Sucesso! ${leads.length} leads importados.`);
        state.qualifiedLeads.clear();
        state.totalUsersFound = 0;
        updateUI();
      } else {
        alert('Falha na importação: ' + (response?.error || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error('[Lia 360 UI] Import exception:', e);
      alert('Erro: ' + e.message);
    } finally {
      btn.disabled = false;
      textEl.textContent = originalText;
    }
  }

  /**
   * Create followers overlay
   */
  function createFollowersOverlay() {
    removeFollowersOverlay();

    const state = window.LiaInstagramState;
    const dialogTypeLabel = state && state.dialogType === 'followers' ? 'Followers' : 'Following';

    const overlay = document.createElement('div');
    overlay.id = FOLLOWERS_UI_ID;
    overlay.innerHTML = `
      <div class="sos-followers-header">
        <span class="sos-title">Import: ${dialogTypeLabel}</span>
        <div class="sos-header-actions">
          <button id="sos-minimize-followers-btn" title="Minimize">−</button>
          <button id="sos-close-followers-btn" title="Close">×</button>
        </div>
      </div>

      <div class="sos-followers-body" id="sos-followers-body">
        <div class="sos-field">
          <label>Audience:</label>
          <select id="sos-audience-select">
            <option value="">No audience filter</option>
          </select>
        </div>

        <div class="sos-field">
          <label>Filter by Keywords:</label>
          <input type="text" id="sos-followers-keywords" placeholder="Keywords between commas">
        </div>

        <div class="sos-field sos-inline">
          <label>Scroll until</label>
          <input type="number" id="sos-scroll-limit" value="${state ? state.followersScrollLimit : 300}" min="50" max="1000" step="50">
          <span>profiles</span>
        </div>

        <div class="sos-stats">
          <div class="stat-item">
            <span class="label">Scanned</span>
            <span class="value" id="sos-followers-scanned-count">0</span>
          </div>
          <div class="stat-item">
            <span class="label">Qualified</span>
            <span class="value" id="sos-followers-qualified-count">0</span>
          </div>
        </div>

        <button id="sos-start-scroll-btn" class="sos-btn-primary">
          ⟳ Start Auto-Scroll
        </button>

        <button id="sos-followers-import-btn" class="sos-btn-secondary" disabled>
          ☁ Import 0 profiles...
        </button>

        <div class="sos-warning">
          <strong>⚠ Attention:</strong> We recommend limiting your scrolling to 300
          profiles and/or scrolling over a longer period of time, to avoid triggering
          account suspension.
        </div>
      </div>

      <style>
      #${FOLLOWERS_UI_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.1);
        color: #fff;
      }
      #${FOLLOWERS_UI_ID} .sos-followers-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: linear-gradient(90deg, #833ab4, #e1306c);
        border-radius: 12px 12px 0 0;
      }
      #${FOLLOWERS_UI_ID} .sos-title { font-weight: 600; font-size: 14px; }
      #${FOLLOWERS_UI_ID} .sos-header-actions { display: flex; gap: 8px; }
      #${FOLLOWERS_UI_ID} .sos-header-actions button {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      #${FOLLOWERS_UI_ID} .sos-header-actions button:hover { background: rgba(255,255,255,0.3); }
      #${FOLLOWERS_UI_ID} .sos-followers-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      #${FOLLOWERS_UI_ID} .sos-field { display: flex; flex-direction: column; gap: 6px; }
      #${FOLLOWERS_UI_ID} .sos-field.sos-inline { flex-direction: row; align-items: center; gap: 8px; }
      #${FOLLOWERS_UI_ID} .sos-field.sos-inline label { flex-shrink: 0; }
      #${FOLLOWERS_UI_ID} .sos-field.sos-inline input { width: 80px; text-align: center; }
      #${FOLLOWERS_UI_ID} .sos-field.sos-inline span { color: #9ca3af; font-size: 12px; }
      #${FOLLOWERS_UI_ID} label { font-size: 12px; color: #d1d5db; }
      #${FOLLOWERS_UI_ID} input, #${FOLLOWERS_UI_ID} select {
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 13px;
        color: #fff;
        transition: border-color 0.2s;
      }
      #${FOLLOWERS_UI_ID} input:focus, #${FOLLOWERS_UI_ID} select:focus {
        outline: none;
        border-color: #e1306c;
      }
      #${FOLLOWERS_UI_ID} .sos-stats {
        display: flex;
        justify-content: space-around;
        background: rgba(0,0,0,0.3);
        padding: 12px;
        border-radius: 8px;
      }
      #${FOLLOWERS_UI_ID} .stat-item { display: flex; flex-direction: column; align-items: center; }
      #${FOLLOWERS_UI_ID} .stat-item .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; }
      #${FOLLOWERS_UI_ID} .stat-item .value { font-size: 20px; font-weight: bold; color: #fff; }
      #${FOLLOWERS_UI_ID} .sos-btn-primary {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #e1306c, #833ab4);
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      #${FOLLOWERS_UI_ID} .sos-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(225, 48, 108, 0.4);
      }
      #${FOLLOWERS_UI_ID} .sos-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      #${FOLLOWERS_UI_ID} .sos-btn-stop { background: #ef4444 !important; }
      #${FOLLOWERS_UI_ID} .sos-btn-secondary {
        width: 100%;
        padding: 12px;
        background: #4299e1;
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      #${FOLLOWERS_UI_ID} .sos-btn-secondary:hover:not(:disabled) { background: #3182ce; }
      #${FOLLOWERS_UI_ID} .sos-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
      #${FOLLOWERS_UI_ID} .sos-warning {
        padding: 12px;
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 6px;
        font-size: 11px;
        color: #93c5fd;
        line-height: 1.4;
      }
      #${FOLLOWERS_UI_ID} .sos-warning strong { color: #60a5fa; }
      #${FOLLOWERS_UI_ID}.minimized .sos-followers-body { display: none; }
      #${FOLLOWERS_UI_ID}.minimized { width: auto; }
      </style>
    `;

    document.body.appendChild(overlay);
    console.log('[Lia 360 UI] Followers overlay created');

    attachFollowersOverlayListeners();
    loadAndPopulateAudiences();
  }

  function attachFollowersOverlayListeners() {
    document.getElementById('sos-start-scroll-btn')?.addEventListener('click', () => {
      const state = window.LiaInstagramState;
      if (state) {
        if (state.isAutoScrolling) {
          if (window.LiaInstagramFollowers) {
            window.LiaInstagramFollowers.stopFollowersScanning();
          }
        } else {
          if (window.LiaInstagramFollowers) {
            window.LiaInstagramFollowers.startFollowersScanning();
          }
        }
      }
    });

    document.getElementById('sos-followers-import-btn')?.addEventListener('click', importFollowersLeads);

    document.getElementById('sos-close-followers-btn')?.addEventListener('click', () => {
      removeFollowersOverlay();
    });

    document.getElementById('sos-minimize-followers-btn')?.addEventListener('click', () => {
      const overlay = document.getElementById(FOLLOWERS_UI_ID);
      if (overlay) {
        overlay.classList.toggle('minimized');
        const btn = document.getElementById('sos-minimize-followers-btn');
        if (btn) {
          btn.textContent = overlay.classList.contains('minimized') ? '+' : '−';
        }
      }
    });

    document.getElementById('sos-followers-keywords')?.addEventListener('input', (e) => {
      const state = window.LiaInstagramState;
      if (state) {
        state.keywords = e.target.value.trim() ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : [];
      }
    });

    document.getElementById('sos-scroll-limit')?.addEventListener('change', (e) => {
      const state = window.LiaInstagramState;
      if (state) {
        state.followersScrollLimit = parseInt(e.target.value) || 300;
      }
    });

    const escHandler = (e) => {
      if (e.key === 'Escape' && document.getElementById(FOLLOWERS_UI_ID)) {
        removeFollowersOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  async function loadAndPopulateAudiences() {
    const select = document.getElementById('sos-audience-select');
    if (!select) return;

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getAudiences' }, resolve);
      });

      if (response?.success && response.data?.length > 0) {
        const state = window.LiaInstagramState;
        if (state) {
          state.audiences = response.data;
        }

        response.data.forEach(audience => {
          const option = document.createElement('option');
          option.value = audience.id;
          option.textContent = audience.name;
          select.appendChild(option);
        });

        console.log(`[Lia 360 UI] Loaded ${response.data.length} audiences`);
      }
    } catch (error) {
      console.error('[Lia 360 UI] Error loading audiences:', error);
    }
  }

  function updateFollowersStats() {
    const state = window.LiaInstagramState;
    if (!state) return;

    const scannedEl = document.getElementById('sos-followers-scanned-count');
    const qualifiedEl = document.getElementById('sos-followers-qualified-count');
    const importBtn = document.getElementById('sos-followers-import-btn');

    if (scannedEl) scannedEl.textContent = state.scannedCount;
    if (qualifiedEl) qualifiedEl.textContent = state.qualifiedLeads.size;
    if (importBtn) {
      importBtn.textContent = `☁ Import ${state.qualifiedLeads.size} profiles...`;
      importBtn.disabled = state.qualifiedLeads.size === 0;
    }
  }

  function updateScrollButtonState(scanning) {
    const btn = document.getElementById('sos-start-scroll-btn');
    if (!btn) return;

    if (scanning) {
      btn.textContent = '⏹ Stop Auto-Scroll';
      btn.classList.add('sos-btn-stop');
    } else {
      btn.textContent = '⟳ Start Auto-Scroll';
      btn.classList.remove('sos-btn-stop');
    }
  }

  function removeFollowersOverlay() {
    const overlay = document.getElementById(FOLLOWERS_UI_ID);
    if (overlay) {
      overlay.remove();
      console.log('[Lia 360 UI] Followers overlay removed');
    }
    const state = window.LiaInstagramState;
    if (state && state.isAutoScrolling) {
      if (window.LiaInstagramFollowers) {
        window.LiaInstagramFollowers.stopFollowersScanning();
      }
    }
  }

  async function importFollowersLeads() {
    const state = window.LiaInstagramState;
    if (!state || state.qualifiedLeads.size === 0) {
      alert('No leads to import.');
      return;
    }

    // For now, simple import - pipeline dialog would be added here
    const leads = Array.from(state.qualifiedLeads.values());

    const response = await chrome.runtime.sendMessage({
      action: 'importLeads',
      data: {
        source: 'extension',
        platform: 'instagram',
        sourceUrl: window.location.href,
        leads: leads
      }
    });

    if (response?.success) {
      alert(`Sucesso! ${leads.length} leads importados.`);
      state.qualifiedLeads.clear();
      state.scannedCount = 0;
      state.totalUsersFound = 0;
      updateFollowersStats();
    } else {
      alert('Falha na importação: ' + (response?.error || 'Erro desconhecido'));
    }
  }

  /**
   * Inject post buttons
   */
  function injectPostButtons() {
    if (document.getElementById('sos-post-actions-container')) return;

    const article = document.querySelector('article');
    if (!article) return;

    let scrollContainer = article.querySelector('ul[class*="_a9z6"]');

    if (!scrollContainer) {
      const candidates = article.querySelectorAll('ul, div');
      for (const el of candidates) {
        if (el.tagName === 'HEADER' || el.querySelector('header')) continue;

        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.clientHeight > 50) {
          if (el.children.length > 0) {
            scrollContainer = el;
            break;
          }
        }
      }
    }

    if (!scrollContainer) return;

    const container = document.createElement('div');
    container.id = 'sos-post-actions-container';
    container.style.cssText = `
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 12px 16px;
      border-bottom: 1px solid rgb(38, 38, 38);
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    try {
      let bg = window.getComputedStyle(article).backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
        bg = window.getComputedStyle(scrollContainer).backgroundColor;
      }
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        container.style.backgroundColor = bg;
      } else {
        container.style.backgroundColor = '#000000';
      }
    } catch (e) {
      container.style.backgroundColor = '#000000';
    }

    const importBtn = document.createElement('button');
    importBtn.id = 'sos-import-post-data-btn';
    importBtn.innerHTML = '☁️ Import This Post Data';
    importBtn.style.cssText = `
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 32px;
    `;

    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      const originalText = importBtn.innerHTML;
      importBtn.innerHTML = '⏳ Importing...';

      try {
        if (window.LiaInstagramPost) {
          const postData = window.LiaInstagramPost.extractPostData();
          if (!postData) {
            throw new Error('Failed to extract post data');
          }

          const response = await chrome.runtime.sendMessage({
            action: 'importPostData',
            data: postData
          });

          if (response?.success) {
            importBtn.innerHTML = '✅ Imported!';
            setTimeout(() => {
              importBtn.innerHTML = originalText;
              importBtn.disabled = false;
            }, 2000);
          } else {
            throw new Error('Import failed');
          }
        }
      } catch (error) {
        console.error('[Lia 360 UI] Import post error:', error);
        importBtn.innerHTML = '❌ Error';
        setTimeout(() => {
          importBtn.innerHTML = originalText;
          importBtn.disabled = false;
        }, 2000);
      }
    });

    const autoReplyBtn = document.createElement('button');
    autoReplyBtn.id = 'sos-auto-reply-btn';
    autoReplyBtn.innerHTML = '↩️ Auto-Reply to Comments';
    autoReplyBtn.style.cssText = `
      background-color: #10b981;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 32px;
    `;

    container.appendChild(importBtn);
    container.appendChild(autoReplyBtn);

    if (scrollContainer.firstChild) {
      scrollContainer.insertBefore(container, scrollContainer.firstChild);
    } else {
      scrollContainer.appendChild(container);
    }

    console.log('[Lia 360 UI] Post buttons injected');
  }

  function removePostButtons() {
    const container = document.getElementById('sos-post-actions-container');
    if (container) {
      container.remove();
    }
  }

  // Expose public API
  window.LiaInstagramUI = {
    createOverlay,
    createFollowersOverlay,
    removeFollowersOverlay,
    updateFollowersStats,
    updateScrollButtonState,
    injectPostButtons,
    removePostButtons,
  };

  console.log('[Lia 360 UI] UI module loaded');
})();
