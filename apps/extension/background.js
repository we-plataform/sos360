// Background service worker

const API_URL = 'http://localhost:3001';

// --- Storage helpers ---
async function getToken() {
  const result = await chrome.storage.local.get(['accessToken']);
  return result.accessToken;
}

async function setToken(token) {
  await chrome.storage.local.set({ accessToken: token });
}

async function clearToken() {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'user']);
}

// --- API helpers ---
async function apiRequest(endpoint, options = {}) {
  const token = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const url = `${API_URL}${endpoint}`;
  console.log('[SOS 360] API Request:', url, { method: options.method || 'GET' });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      // If it's a 200 OK but text, we might treat it as success if body is optional, but usually we expect JSON
      if (!response.ok) {
        throw new Error(`API returned non-JSON: ${text.substring(0, 100)}`);
      }
      data = { message: text };
    }

    if (!response.ok) {
      const errorMessage = data?.error?.detail || data?.error?.message || data?.message || 'API request failed';
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('[SOS 360] API Error:', error);

    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      throw new Error('Não foi possível conectar à API. Verifique se a API está rodando em http://localhost:3001');
    }
    if (error.message.includes('CORS') || error.message.includes('Not allowed')) {
      throw new Error('Erro de CORS. Verifique se a API permite requisições da extensão.');
    }
    throw error;
  }
}

// --- LEAD NAVIGATOR (Autonomous Agent) ---

class LeadNavigator {
  constructor() {
    this.state = {
      status: 'IDLE', // IDLE, NAVIGATING_TO_SEARCH, COLLECTING_POSTS, VISITING_PROFILE, EXTRACTING_DATA, ANALYZING_LEAD, NEXT_KEYWORD
      keywords: [],
      criteria: '',
      currentKeywordIndex: 0,
      postQueue: [],
      processedProfiles: new Set(),
      currentTabId: null,
    };

    this.config = {
      postsPerKeyword: 10,
      delayMin: 3000,
      delayMax: 8000,
      longDelayMin: 10000,
      longDelayMax: 20000,
      maxProfilesPerHour: 40,
    };

    this.profilesVisitedThisSession = 0;
    this.loadState();
  }

  async loadState() {
    const stored = await chrome.storage.local.get(['autoModeState', 'processedProfiles']);
    if (stored.autoModeState) {
      // Restore basic state if needed, but usually we start fresh or continue
      // For now, let's keep it simple and just ensure we don't re-visit profiles
    }
    if (stored.processedProfiles) {
      this.processedProfiles = new Set(stored.processedProfiles);
    }
  }

  async saveState() {
    // Calculate progress
    let progress = 0;
    let detailedStatus = '';

    if (this.state.status === 'IDLE' || this.state.status === 'STOPPED') {
      progress = 0;
      detailedStatus = '';
    } else {
      // Simple progress logic
      if (this.state.status === 'NAVIGATING_TO_SEARCH') {
        progress = 10;
        detailedStatus = `Iniciando busca por "${this.state.keywords[this.state.currentKeywordIndex]}"`;
      }
      else if (this.state.status === 'COLLECTING_POSTS') {
        progress = 20;
        detailedStatus = 'Coletando posts da página de resultados';
      }
      else if (this.state.postQueue && this.state.totalPostsForKeyword) {
        const processed = this.state.totalPostsForKeyword - this.state.postQueue.length;
        // 20% to 100% mapped to posts
        const postProgress = (processed / this.state.totalPostsForKeyword) * 80;
        progress = 20 + postProgress;
        detailedStatus = `Processando lead ${processed + 1} de ${this.state.totalPostsForKeyword} para "${this.state.keywords[this.state.currentKeywordIndex]}"`;
      } else {
        progress = 15;
        detailedStatus = this.getStatusMessage();
      }
    }

    const state = {
      status: this.state.status,
      message: this.getStatusMessage(),
      progress: Math.min(Math.round(progress), 100),
      detailedStatus: detailedStatus || this.getStatusMessage()
    };

    await chrome.storage.local.set({
      autoModeState: state,
      processedProfiles: Array.from(this.state.processedProfiles),
    });

    // Broadcast status update
    chrome.runtime.sendMessage({
      action: 'autoModeUpdate',
      state: state
    }).catch(() => { }); // Ignore error if popup is closed
  }

  getStatusMessage() {
    const k = this.state.keywords[this.state.currentKeywordIndex];
    switch (this.state.status) {
      case 'IDLE': return 'Aguardando comando.';
      case 'NAVIGATING_TO_SEARCH': return `Buscando por "${k}"...`;
      case 'COLLECTING_POSTS': return `Coletando posts... (${this.state.postQueue.length} encontrados)`;
      case 'VISITING_PROFILE': return 'Visitando perfil...';
      case 'EXTRACTING_DATA': return 'Analisando perfil...';
      case 'ANALYZING_LEAD': return 'Analisando qualificação com AI...';
      case 'NEXT_KEYWORD': return 'Mudando de tócpico...';
      case 'STOPPED': return 'Parado pelo usuário.';
      default: return '';
    }
  }

  async start(keywords, criteria = '') {
    if (this.state.status !== 'IDLE' && this.state.status !== 'STOPPED') return;

    this.state.keywords = keywords;
    this.state.criteria = criteria;
    this.state.currentKeywordIndex = 0;
    this.state.postQueue = [];
    this.profilesVisitedThisSession = 0;

    // Get current tab or create new one
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url.includes('instagram.com')) {
      this.state.currentTabId = tab.id;
    } else {
      const newTab = await chrome.tabs.create({ url: 'https://instagram.com' });
      this.state.currentTabId = newTab.id;
      await this.sleep(5000); // Wait for load
    }

    this.processNextStep();
  }

  stop() {
    this.state.status = 'STOPPED';
    this.saveState();
  }

  async processNextStep() {
    if (this.state.status === 'STOPPED') return;

    try {
      // 1. Check if we have keywords left
      if (this.state.currentKeywordIndex >= this.state.keywords.length) {
        this.stop();
        return;
      }

      const keyword = this.state.keywords[this.state.currentKeywordIndex];

      // 2. Logic Machine
      if (this.state.postQueue.length === 0) {
        // Need to find posts
        this.state.status = 'NAVIGATING_TO_SEARCH';
        await this.saveState();

        await this.navigateToSearch(keyword);

        this.state.status = 'COLLECTING_POSTS';
        await this.saveState();

        const posts = await this.collectPosts();
        if (posts.length === 0) {
          // No posts found, next keyword
          this.state.currentKeywordIndex++;
          this.processNextStep();
          return;
        }

        this.state.postQueue = posts;
      }

      // 3. Process Queue
      if (this.state.postQueue.length > 0) {
        const postUrl = this.state.postQueue.shift();

        this.state.status = 'VISITING_PROFILE';
        await this.saveState();

        // Navigate to post
        await this.navigateToUrl(postUrl);
        await this.sleep(this.randomDelay(2000, 4000));

        // Click on username to go to profile (or extract from post if easier)
        // For simplicity, let's try to extract profile from post page first
        // Usually clicking the top header username is safest

        this.state.status = 'EXTRACTING_DATA';
        await this.saveState();

        const lead = await this.extractLeadFromCurrentPage();

        if (lead && !this.state.processedProfiles.has(lead.username)) {
          console.log('[LeadNavigator] Found lead:', lead.username);

          // INTELLIGENT SEARCH CHECK
          let shouldImport = true;
          let analysisReason = '';
          let score = 0;

          if (this.state.criteria) {
            this.state.status = 'ANALYZING_LEAD';
            await this.saveState();

            try {
              const analysis = await this.analyzeLead(lead, this.state.criteria);
              shouldImport = analysis.qualified;
              analysisReason = analysis.reason;
              score = analysis.score;
              console.log(`[LeadNavigator] Analyzed ${lead.username}: Qualified=${shouldImport} (${score}) - ${analysisReason}`);
            } catch (e) {
              console.warn('[LeadNavigator] Analysis failed, allowing import by default', e);
            }
          }

          if (shouldImport) {
            await this.saveLead({ ...lead, score, analysisReason });
            this.profilesVisitedThisSession++;
          } else {
            console.log('[LeadNavigator] Lead disqualified:', lead.username);
          }

          this.state.processedProfiles.add(lead.username);
        }

        await this.sleep(this.randomDelay(this.config.delayMin, this.config.delayMax));

        // Periodically take a longer break
        if (this.profilesVisitedThisSession % 5 === 0) {
          await this.sleep(this.randomDelay(this.config.longDelayMin, this.config.longDelayMax));
        }

        this.processNextStep();
      }

    } catch (error) {
      console.error('[LeadNavigator] Error:', error);
      // Try to recover or stop
      this.stop();
    }
  }

  async navigateToSearch(keyword) {
    // STRATEGY 1: Human-like Search (Click Icon -> Type -> Click Result)
    try {
      console.log('[LeadNavigator] Trying Human-like Search strategy...');
      const response = await chrome.tabs.sendMessage(this.state.currentTabId, {
        action: 'performSearch',
        keyword: keyword
      });

      if (response && response.success && response.data && response.data.length > 0) {
        // We found results. Let's click the first one or best one.
        // For now, let's just pick the first one that looks like a tag or profile.
        const bestResult = response.data.find(u => u.includes('/explore/tags/')) || response.data[0];

        console.log('[LeadNavigator] Human search successful, navigating to:', bestResult);
        await this.navigateToUrl(bestResult);
        await this.sleep(4000); // Wait for load
        return;
      } else {
        console.log('[LeadNavigator] Human search yielded no results, falling back...');
      }
    } catch (e) {
      console.warn('[LeadNavigator] Human search failed:', e);
    }

    // STRATEGY 2: Direct URL Fallback
    console.log('[LeadNavigator] Falling back to Direct URL strategy...');
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(keyword)}/`;
    await this.navigateToUrl(url);
    await this.sleep(5000);
  }

  async collectPosts() {
    // Send message to content script to scrape hrefs
    try {
      const response = await chrome.tabs.sendMessage(this.state.currentTabId, {
        action: 'getPostLinks',
        limit: this.config.postsPerKeyword
      });
      const posts = response?.data || [];
      this.state.totalPostsForKeyword = posts.length;
      return posts;
    } catch (e) {
      console.warn('Failed to collect posts:', e);
      return [];
    }
  }

  async extractLeadFromCurrentPage() {
    // We are on a post page. We want the author.
    // Or we click through to profile.
    // Let's try to extract author from post first.
    try {
      // Ask content script to get author from post
      const response = await chrome.tabs.sendMessage(this.state.currentTabId, {
        action: 'extractAuthorFromPost'
      });
      return response?.data;
    } catch (e) {
      return null;
    }
  }

  async analyzeLead(lead, criteria) {
    return await apiRequest('/api/v1/leads/analyze', {
      method: 'POST',
      body: JSON.stringify({ profile: lead, criteria })
    }).then(res => res.data);
  }

  async saveLead(lead) {
    try {
      // Send to API
      await apiRequest('/api/v1/leads/import', {
        method: 'POST',
        body: JSON.stringify({
          source: 'autonomous_agent',
          platform: 'instagram',
          sourceUrl: lead.profileUrl,
          leads: [lead]
        }),
      });

      // Update local stats
      const stats = await chrome.storage.local.get(['leadsToday', 'leadsMonth']);
      await chrome.storage.local.set({
        leadsToday: (stats.leadsToday || 0) + 1,
        leadsMonth: (stats.leadsMonth || 0) + 1,
      });
    } catch (e) {
      console.error('Failed to save lead:', e);
    }
  }

  async navigateToUrl(url) {
    await chrome.tabs.update(this.state.currentTabId, { url });
    await this.waitForTabLoad(this.state.currentTabId);
  }

  waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      const listener = (tid, changeInfo) => {
        if (tid === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}

const navigator = new LeadNavigator();

// --- Message handlers ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'login': {
          const response = await apiRequest('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify(request.data),
          });
          await chrome.storage.local.set({
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            user: response.data.user,
          });
          sendResponse({ success: true, data: response.data });
          break;
        }

        case 'logout': {
          await clearToken();
          sendResponse({ success: true });
          break;
        }

        case 'getUser': {
          const result = await chrome.storage.local.get(['user', 'accessToken']);
          if (result.accessToken && result.user) {
            sendResponse({ success: true, data: result.user });
          } else {
            sendResponse({ success: false, error: 'Not logged in' });
          }
          break;
        }

        case 'importLeads': {
          const response = await apiRequest('/api/v1/leads/import', {
            method: 'POST',
            body: JSON.stringify(request.data),
          });
          sendResponse({ success: true, data: response.data });
          break;
        }

        case 'startAutoMode': {
          navigator.start(request.keywords, request.criteria);
          sendResponse({ success: true });
          break;
        }

        case 'stopAutoMode': {
          navigator.stop();
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: 'import-profile',
      title: 'Importar perfil para SOS 360',
      contexts: ['link'],
      documentUrlPatterns: [
        '*://*.instagram.com/*',
        '*://*.facebook.com/*',
        '*://*.linkedin.com/*',
      ],
    });
  } catch (error) {
    console.warn('Could not create context menu:', error);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'import-profile') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'extractProfile',
      url: info.linkUrl,
    });
  }
});

console.log('SOS 360 Extension loaded');
