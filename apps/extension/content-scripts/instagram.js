// Instagram content script - SOS 360
// Version 2 - With Import UI Overlay

(function () {
  'use strict';

  const UI_ID = 'sos360-instagram-overlay';

  // Rate limiting configuration
  const RATE_LIMIT = {
    maxProfilesPerHour: 40,
    delayMin: 3000,
    delayMax: 8000,
  };

  // --- State Management ---
  const state = {
    // State
    qualifiedLeads: new Map(),
    isAutoScrolling: false,
    totalUsersFound: 0,
    keywords: [],
    currentProfileUsername: null,
    criteria: '',
    useAIQualification: false,
    pendingAIBatch: [],
    aiAnalyzing: false,
    batchSize: 20
  };

  // --- Selectors ---
  const SELECTORS = {
    // Followers/Following dialog - these are the most critical and fragile
    dialogList: 'div[role="dialog"] div[style*="flex-direction: column"] > div',
    dialogContainer: 'div[role="dialog"]',
    dialogScrollable: 'div[role="dialog"] div[style*="overflow"]',

    // User item in dialog
    userItem: 'div[role="dialog"] a[href^="/"]',

    // Profile page elements
    profileHeader: 'header',
    profileUsername: 'header h2, header section > div > div > span',
    profileFullName: 'header section span[dir="auto"]',
    profileBio: 'header section > div > span, header section h1',
    profileStats: 'header section ul li',
    profileAvatar: 'header img[alt*="profile"], header canvas + img',

    // Action buttons on profile
    followersButton: 'a[href$="/followers/"], a[href*="/followers"]',
    followingButton: 'a[href$="/following/"], a[href*="/following"]',

    // Posts
    postLink: 'a[href^="/p/"]',

    // Search
    searchInput: 'input[aria-label="Search input"], input[placeholder="Search"], input[placeholder="Pesquisar"]',
  };

  // --- Helper Functions ---
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  function parseCount(text) {
    if (!text) return 0;
    const clean = text.toLowerCase().replace(/,/g, '').replace(/\./g, '');
    if (clean.includes('k')) return parseFloat(clean) * 1000;
    if (clean.includes('m')) return parseFloat(clean) * 1000000;
    if (clean.includes('mi')) return parseFloat(clean) * 1000000; // Portuguese
    if (clean.includes('mil')) return parseFloat(clean) * 1000; // Portuguese
    return parseInt(clean.replace(/\D/g, ''), 10) || 0;
  }

  function matchesKeywords(text, keywords) {
    if (!keywords || keywords.length === 0) return true;
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase().trim()));
  }

  function getCurrentProfileUsername() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0 && !['explore', 'reels', 'direct', 'stories', 'p', 'tv', 'accounts'].includes(parts[0])) {
      return parts[0];
    }
    return null;
  }

  // --- UI Construction ---
  function createOverlay() {
    if (document.getElementById(UI_ID)) {
      document.getElementById(UI_ID).style.display = 'block';
      return;
    }

    const username = getCurrentProfileUsername();
    state.currentProfileUsername = username;

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
        <div id="sos-progress-container" style="display:none; margin-top:12px;">
          <div style="font-size:12px; color:#9ca3af; margin-bottom:4px;">
            <span id="sos-progress-status">Aguardando...</span>
          </div>
          <div style="background:#374151; border-radius:4px; height:8px; overflow:hidden;">
            <div id="sos-progress-bar" style="background:linear-gradient(to right, #e1306c, #833ab4); height:100%; width:0%; transition: width 0.3s ease;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:11px; color:#6b7280;">
            <span id="sos-progress-count">0 / 0</span>
            <span id="sos-progress-percentage">0%</span>
          </div>
        </div>
        <div id="sos-debug" style="font-size:10px;color:#888;margin-top:8px;"></div>
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
      #${UI_ID} .sos-btn:active:not(:disabled) { transform: translateY(0); }
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

    document.getElementById('sos-close').addEventListener('click', () => {
      document.getElementById(UI_ID).style.display = 'none';
      stopScanning();
    });

    document.getElementById('sos-keywords').addEventListener('input', (e) => {
      updateKeywords(e.target.value);
    });

    document.getElementById('sos-criteria').addEventListener('input', (e) => {
      state.criteria = e.target.value.trim();
    });

    document.getElementById('sos-ai-qualify').addEventListener('change', (e) => {
      state.useAIQualification = e.target.checked;
      if (!state.useAIQualification) {
        state.pendingAIBatch = [];
      }
    });

    document.getElementById('sos-open-followers').addEventListener('click', openFollowersDialog);
    document.getElementById('sos-open-following').addEventListener('click', openFollowingDialog);
    document.getElementById('sos-scan-btn').addEventListener('click', toggleScanning);
    document.getElementById('sos-import-btn').addEventListener('click', importQualifiedLeads);
  }

  function updateKeywords(input) {
    state.keywords = input.trim() ? input.split(',').map(s => s.trim()).filter(Boolean) : [];
    // Re-filter existing leads
    refilterLeads();
  }

  function refilterLeads() {
    if (state.keywords.length === 0) return;

    // Filter based on new keywords
    for (const [username, lead] of state.qualifiedLeads) {
      const searchText = `${lead.fullName || ''} ${lead.bio || ''}`.toLowerCase();
      if (!matchesKeywords(searchText, state.keywords)) {
        state.qualifiedLeads.delete(username);
      }
    }
    updateUI();
  }

  function updateUI() {
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

  function updateDebug(msg) {
    const el = document.getElementById('sos-debug');
    if (el) el.textContent = msg;
  }

  // --- Dialog Navigation ---
  async function openFollowersDialog() {
    const username = getCurrentProfileUsername();
    if (!username) {
      alert('Por favor, navegue para uma página de perfil primeiro.');
      return;
    }

    // Try clicking the followers link
    const followersLink = document.querySelector(SELECTORS.followersButton);
    if (followersLink) {
      followersLink.click();
      await sleep(1500);
      updateDebug('Dialog de seguidores aberto');
    } else {
      // Navigate directly
      window.location.href = `https://www.instagram.com/${username}/followers/`;
    }
  }

  async function openFollowingDialog() {
    const username = getCurrentProfileUsername();
    if (!username) {
      alert('Por favor, navegue para uma página de perfil primeiro.');
      return;
    }

    const followingLink = document.querySelector(SELECTORS.followingButton);
    if (followingLink) {
      followingLink.click();
      await sleep(1500);
      updateDebug('Dialog de seguindo aberto');
    } else {
      window.location.href = `https://www.instagram.com/${username}/following/`;
    }
  }

  // --- Scanning Logic ---
  function toggleScanning() {
    if (state.isAutoScrolling) {
      stopScanning();
    } else {
      startScanning();
    }
  }

  async function startScanning() {
    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) {
      alert('Por favor, abra o dialog de seguidores ou seguindo primeiro.');
      return;
    }

    state.isAutoScrolling = true;
    updateUI();
    updateDebug('Iniciando scan...');

    console.log('[SOS 360] Starting Instagram dialog scan');

    let noChangeCount = 0;
    const maxNoChange = 5;

    while (state.isAutoScrolling) {
      const prevCount = state.qualifiedLeads.size;

      // Find scrollable container in dialog
      const scrollContainer = findDialogScrollContainer();
      if (!scrollContainer) {
        updateDebug('Container de scroll não encontrado');
        await sleep(2000);
        continue;
      }

      // Extract users from current view
      await extractUsersFromDialog();

      // Scroll down
      const prevScrollTop = scrollContainer.scrollTop;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;

      await sleep(2000 + Math.random() * 1000);

      // Check if we scrolled and found new users
      const newCount = state.qualifiedLeads.size;
      const scrolled = scrollContainer.scrollTop > prevScrollTop;
      const foundNew = newCount > prevCount;

      if (!scrolled && !foundNew) {
        noChangeCount++;
        updateDebug(`Sem novos usuários (${noChangeCount}/${maxNoChange})`);

        if (noChangeCount >= maxNoChange) {
          console.log('[SOS 360] Scan complete - no more users to load');
          stopScanning();
          updateDebug('Scan completo!');
          break;
        }
      } else {
        noChangeCount = 0;
        updateDebug(`Encontrados: ${state.totalUsersFound} | Qualificados: ${state.qualifiedLeads.size}`);
      }
    }
  }

  async function stopScanning() {
    state.isAutoScrolling = false;
    state.pendingAIBatch = []; // Clear pending batch immediately to stop processing

    // If AI is currently analyzing, just let it finish naturally
    // Don't wait for it - this prevents the tab from freezing
    if (state.aiAnalyzing) {
      updateDebug('Parando... aguardando análise atual...');
      // Set a timeout to force reset if it takes too long
      setTimeout(() => {
        if (state.aiAnalyzing) {
          state.aiAnalyzing = false;
          updateDebug('Scan parado (análise cancelada)');
          updateUI();
        }
      }, 5000);
    } else {
      updateDebug('Scan parado');
    }

    updateUI();
  }

  function findDialogScrollContainer() {
    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) return null;

    // Find the scrollable div inside the dialog
    const scrollables = dialog.querySelectorAll('div');
    let bestMatch = null;
    let maxHeight = 0;

    for (const div of scrollables) {
      const style = window.getComputedStyle(div);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        div.scrollHeight > div.clientHeight + 50) {
        if (div.scrollHeight > maxHeight) {
          maxHeight = div.scrollHeight;
          bestMatch = div;
        }
      }
    }

    return bestMatch;
  }

  async function extractUsersFromDialog() {
    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) return;

    // Find all user links in the dialog
    const userLinks = dialog.querySelectorAll('a[href^="/"][role="link"], a[href^="/"]');
    let newLeadsForBatch = [];

    for (const link of userLinks) {
      try {
        const href = link.getAttribute('href');
        if (!href || href === '/') continue;

        // Extract username from href
        const username = href.replace(/\//g, '').split('?')[0];
        if (!username || username.length < 2) continue;
        if (['explore', 'reels', 'direct', 'stories', 'p', 'accounts'].includes(username)) continue;

        // Skip if already processed
        if (state.qualifiedLeads.has(username)) continue;

        state.totalUsersFound++;

        // Get parent container for more info
        const container = link.closest('div[role="listitem"]') ||
          link.closest('li') ||
          link.parentElement?.parentElement?.parentElement;

        // Extract avatar
        let avatarUrl = null;
        const img = container?.querySelector('img[crossorigin="anonymous"]') ||
          container?.querySelector('img') ||
          link.querySelector('img');
        if (img && img.src && !img.src.includes('data:image/gif')) {
          avatarUrl = img.src;
        }

        // Extract name - usually in a span near the link
        let fullName = null;
        const spans = container?.querySelectorAll('span') || [];
        for (const span of spans) {
          const text = span.textContent?.trim();
          if (text && text.length > 2 && text !== username && !text.includes('@')) {
            // Avoid picking up "Follow" or "Following" text
            if (!['Follow', 'Following', 'Seguir', 'Seguindo', 'Remove', 'Remover'].includes(text)) {
              fullName = text;
              break;
            }
          }
        }

        const lead = {
          username,
          profileUrl: `https://instagram.com/${username}`,
          avatarUrl,
          fullName: fullName || username,
          platform: 'instagram',
        };

        // If AI qualification is enabled, add to batch
        if (state.useAIQualification && state.criteria) {
          newLeadsForBatch.push(lead);
        } else {
          // Fallback to keyword filtering
          const searchText = `${lead.fullName || ''} ${lead.bio || ''}`.toLowerCase();
          if (matchesKeywords(searchText, state.keywords)) {
            state.qualifiedLeads.set(username, lead);
          }
        }

      } catch (e) {
        console.error('[SOS 360] Error extracting user:', e);
      }
    }

    // Process AI batch if needed
    if (state.useAIQualification && newLeadsForBatch.length > 0) {
      state.pendingAIBatch.push(...newLeadsForBatch);

      // Process batch when we have enough leads
      if (state.pendingAIBatch.length >= state.batchSize && !state.aiAnalyzing) {
        await processAIBatch();
      }
    }

    updateUI();
  }

  // Process pending AI batch
  async function processAIBatch() {
    if (state.pendingAIBatch.length === 0 || state.aiAnalyzing) return;

    state.aiAnalyzing = true;
    const batch = state.pendingAIBatch.splice(0, state.batchSize);

    updateDebug(`\ud83e\udd16 Analisando ${batch.length} perfis com IA...`);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeBatch',
        data: {
          profiles: batch.map(lead => ({
            name: lead.fullName,
            username: lead.username,
            bio: lead.bio || '',
            platform: 'instagram'
          })),
          criteria: state.criteria
        }
      });

      if (response?.success && response.data?.results) {
        const results = response.data.results;

        for (let i = 0; i < batch.length; i++) {
          if (results[i]?.qualified) {
            const lead = batch[i];
            lead.aiScore = results[i].score;
            lead.aiReason = results[i].reason;
            state.qualifiedLeads.set(lead.username, lead);
          }
        }

        updateDebug(`\u2705 ${response.data.qualified}/${batch.length} qualificados`);
      } else {
        console.error('[SOS 360] AI batch analysis failed:', response?.error);
        updateDebug('\u26a0\ufe0f Erro na an\u00e1lise IA');

        // Fallback: add all to qualified if AI fails
        for (const lead of batch) {
          state.qualifiedLeads.set(lead.username, lead);
        }
      }
    } catch (error) {
      console.error('[SOS 360] AI batch error:', error);
      updateDebug('\u26a0\ufe0f Erro na an\u00e1lise IA');

      // Fallback: add all to qualified if AI fails
      for (const lead of batch) {
        state.qualifiedLeads.set(lead.username, lead);
      }
    }

    state.aiAnalyzing = false;
    updateUI();
  }

  // --- Profile Extraction ---
  function extractCurrentProfile() {
    const username = getCurrentProfileUsername();
    if (!username) return null;

    // Get avatar
    let avatarUrl = null;
    const avatarImg = document.querySelector('header img[alt*="profile"], header img');
    if (avatarImg && avatarImg.src && !avatarImg.src.includes('44x44')) {
      avatarUrl = avatarImg.src;
    }

    // Get full name
    let fullName = null;
    const nameEl = document.querySelector('header section span[dir="auto"]');
    if (nameEl) {
      fullName = nameEl.textContent?.trim();
    }

    // Get bio
    let bio = null;
    const bioContainer = document.querySelector('header section > div > span');
    if (bioContainer) {
      bio = bioContainer.textContent?.trim();
    }

    // Get stats (posts, followers, following)
    let postsCount = 0, followersCount = 0, followingCount = 0;
    const statItems = document.querySelectorAll('header section ul li');
    if (statItems.length >= 3) {
      postsCount = parseCount(statItems[0]?.textContent);
      followersCount = parseCount(statItems[1]?.textContent);
      followingCount = parseCount(statItems[2]?.textContent);
    }

    // Try to extract website
    let website = null;
    const websiteLink = document.querySelector('header a[href*="l.instagram.com"]');
    if (websiteLink) {
      website = websiteLink.textContent?.trim();
    }

    // Try to extract email from bio
    let email = null;
    if (bio) {
      const emailMatch = bio.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        email = emailMatch[0];
      }
    }

    return {
      username,
      profileUrl: `https://instagram.com/${username}`,
      fullName: fullName || username,
      bio,
      avatarUrl,
      website,
      email,
      followersCount,
      followingCount,
      postsCount,
      platform: 'instagram',
    };
  }

  // --- Import Logic ---
  async function importQualifiedLeads() {
    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) return;

    console.log('[SOS 360] Leads to import:', JSON.stringify(leads, null, 2));

    const btn = document.getElementById('sos-import-btn');
    const textEl = document.getElementById('sos-import-text');
    const criteriaEl = document.getElementById('sos-criteria');
    if (!btn || !textEl) return;

    const originalText = textEl.textContent;
    const criteria = criteriaEl?.value?.trim() || '';

    btn.disabled = true;
    textEl.textContent = 'Importando...';

    try {
      if (criteria) {
        // Deep Import with AI analysis
        textEl.textContent = 'Iniciando Deep Import com IA...';
        console.log('[SOS 360] Starting Instagram Deep Import with criteria:', criteria);

        updateDeepImportProgress(0, leads.length, 'Iniciando análise com IA...');

        const response = await chrome.runtime.sendMessage({
          action: 'startInstagramDeepImport',
          data: {
            leads: leads,
            criteria: criteria
          }
        });

        if (response?.success) {
          textEl.textContent = 'Deep Import em andamento...';
        } else {
          console.error('[SOS 360] Deep Import failed:', response?.error);
          alert('Falha ao iniciar Deep Import: ' + (response?.error || 'Erro desconhecido'));
          btn.disabled = false;
          textEl.textContent = originalText;
        }
      } else {
        // Simple import without AI
        const importData = {
          source: 'extension',
          platform: 'instagram',
          sourceUrl: window.location.href,
          leads: leads
        };
        console.log('[SOS 360] Sending import request:', JSON.stringify(importData, null, 2));

        const response = await chrome.runtime.sendMessage({
          action: 'importLeads',
          data: importData
        });

        console.log('[SOS 360] Import response:', response);

        if (response?.success) {
          alert(`Sucesso! ${leads.length} leads importados.`);
          // Clear imported leads
          state.qualifiedLeads.clear();
          state.totalUsersFound = 0;
          updateUI();
        } else {
          console.error('[SOS 360] Import failed:', response?.error);
          alert('Falha na importação: ' + (response?.error || 'Erro desconhecido'));
        }
      }
    } catch (e) {
      console.error('[SOS 360] Import exception:', e);
      alert('Erro: ' + e.message);
    } finally {
      btn.disabled = false;
      textEl.textContent = originalText;
    }
  }

  // --- Deep Import Progress UI ---
  function updateDeepImportProgress(current, total, status, qualified = null, discarded = null) {
    const container = document.getElementById('sos-progress-container');
    const statusEl = document.getElementById('sos-progress-status');
    const barEl = document.getElementById('sos-progress-bar');
    const countEl = document.getElementById('sos-progress-count');
    const percentEl = document.getElementById('sos-progress-percentage');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');

    if (!container) return;

    container.style.display = 'block';
    if (statusEl) statusEl.textContent = status || 'Processando...';

    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    if (barEl) barEl.style.width = `${percent}%`;

    // Show qualification stats if available
    if (qualified !== null && discarded !== null) {
      if (countEl) countEl.textContent = `✅ ${qualified} | ❌ ${discarded}`;
    } else {
      if (countEl) countEl.textContent = `${current} / ${total}`;
    }
    if (percentEl) percentEl.textContent = `${percent}%`;

    const isDone = status?.startsWith('Concluído') || (current >= total && total > 0);

    if (isDone) {
      if (statusEl) statusEl.textContent = `✅ ${status}`;
      if (barEl) barEl.style.background = 'linear-gradient(to right, #10b981, #059669)';

      if (importBtn) {
        importBtn.disabled = false;
        if (importText) importText.textContent = 'Importar mais perfis...';
      }

      showCompletionNotification(qualified || total, discarded);

      // Clear state
      state.qualifiedLeads.clear();
      state.totalUsersFound = 0;
      updateUI();

      setTimeout(() => {
        container.style.display = 'none';
        if (barEl) {
          barEl.style.width = '0%';
          barEl.style.background = 'linear-gradient(to right, #e1306c, #833ab4)';
        }
      }, 5000);
    }

    console.log(`[SOS 360] Instagram Deep Import Progress: ${current}/${total} - ${status}`);
  }

  function showCompletionNotification(qualified, discarded = 0) {
    const notif = document.createElement('div');
    notif.id = 'sos-completion-notif';
    const discardedText = discarded > 0 ? `, ${discarded} descartados` : '';
    notif.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #833ab4, #e1306c);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(225, 48, 108, 0.4);
        z-index: 2147483648;
        font-family: -apple-system, system-ui, sans-serif;
        animation: slideIn 0.3s ease;
      ">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:24px;">🎉</span>
          <div>
            <div style="font-weight:600; font-size:14px;">Deep Import Concluído!</div>
            <div style="font-size:12px; opacity:0.9;">${qualified} perfis importados${discardedText}</div>
          </div>
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    document.body.appendChild(notif);

    setTimeout(() => {
      notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(100%)';
      setTimeout(() => notif.remove(), 300);
    }, 5000);
  }

  // --- Initialization ---
  function init() {
    const username = getCurrentProfileUsername();

    if (username) {
      // We're on a profile page, show overlay after a short delay
      setTimeout(() => {
        console.log(`[SOS 360] On Instagram profile: @${username}`);
        // Don't auto-show, wait for popup trigger
      }, 1000);
    }

    // Hide overlay if navigating away from profile
    if (!username) {
      const el = document.getElementById(UI_ID);
      if (el) el.style.display = 'none';
    }
  }

  // SPA Observer - Instagram is a SPA
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      state.currentProfileUsername = getCurrentProfileUsername();

      // Update overlay title if visible
      const titleEl = document.querySelector(`#${UI_ID} .sos-title`);
      if (titleEl && state.currentProfileUsername) {
        titleEl.textContent = `Import: @${state.currentProfileUsername}`;
      }

      init();
    }
  }).observe(document, { subtree: true, childList: true });

  init();

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        switch (request.action) {
          case 'openOverlay':
            createOverlay();
            sendResponse({ success: true });
            break;

          case 'extractLeads':
            // Extract from dialog if open, otherwise from current profile
            const dialog = document.querySelector(SELECTORS.dialogContainer);
            if (dialog && state.qualifiedLeads.size > 0) {
              sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
            } else {
              const profile = extractCurrentProfile();
              sendResponse({ success: !!profile, data: profile ? [profile] : [] });
            }
            break;

          case 'extractProfile':
            const p = extractCurrentProfile();
            sendResponse({ success: !!p, data: p });
            break;

          case 'updateImportProgress':
            const { current, total, status, qualified, discarded } = request.data;
            updateDeepImportProgress(current, total, status, qualified, discarded);
            sendResponse({ success: true });
            break;

          case 'performSearch':
            // Legacy search support
            const opened = await openSearch();
            if (opened) {
              const typed = await typeSearch(request.keyword);
              if (typed) {
                const results = await getSearchResults();
                sendResponse({ success: true, data: results });
              } else {
                sendResponse({ success: false, error: 'Input not found' });
              }
            } else {
              sendResponse({ success: false, error: 'Search not found' });
            }
            break;

          case 'getPostLinks':
            await scrollWindow(3);
            const links = getPostLinks(request.limit);
            sendResponse({ success: true, data: links });
            break;

          case 'extractAuthorFromPost':
            const author = extractAuthorFromPost();
            sendResponse({ success: !!author, data: author });
            break;

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[SOS 360] Instagram content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  });

  // --- Legacy Functions (for LeadNavigator compatibility) ---
  async function openSearch() {
    console.log('[SOS 360] Opening search...');
    const searchIcon = document.querySelector('svg[aria-label="Search"], svg[aria-label="Pesquisar"]');
    if (searchIcon) {
      const button = searchIcon.closest('a') || searchIcon.closest('button') || searchIcon.closest('div[role="button"]');
      if (button) {
        button.click();
        await sleep(2500);
        return true;
      }
    }
    const existingInput = document.querySelector(SELECTORS.searchInput);
    if (existingInput) return true;
    return false;
  }

  async function typeSearch(keyword) {
    console.log('[SOS 360] Typing search:', keyword);
    const input = document.querySelector(SELECTORS.searchInput);
    if (!input) return false;

    input.focus();
    input.click();
    await sleep(500);
    input.value = '';

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, keyword);
    } else {
      input.value = keyword;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await sleep(3000);
    return true;
  }

  async function getSearchResults() {
    const links = Array.from(document.querySelectorAll('a[href^="/"]'));
    const results = links
      .map(a => a.getAttribute('href'))
      .filter(href => {
        if (['/', '/explore/', '/reels/', '/direct/inbox/', '/accounts/activity/'].includes(href)) return false;
        if (href.startsWith('/p/')) return false;
        return true;
      })
      .map(href => `https://instagram.com${href}`);
    return [...new Set(results)];
  }

  async function scrollWindow(maxScrolls = 3) {
    let count = 0;
    while (count < maxScrolls) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(2000 + Math.random() * 1000);
      count++;
    }
  }

  function getPostLinks(limit = 20) {
    const links = Array.from(document.querySelectorAll('a[href^="/p/"]'))
      .map(a => a.href)
      .filter(href => href.includes('/p/'));
    return [...new Set(links)].slice(0, limit);
  }

  function extractAuthorFromPost() {
    const authorHeader = document.querySelector('header');
    if (authorHeader) {
      const links = authorHeader.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href !== '/' && !href.includes('/explore/') && !href.includes('/p/')) {
          const username = href.replace(/\//g, '');
          return extractCurrentProfile() || {
            username,
            profileUrl: `https://instagram.com/${username}`,
          };
        }
      }
    }
    return extractCurrentProfile();
  }

  console.log('[SOS 360] Instagram Script v2 Loaded (with Import UI)');
})();
