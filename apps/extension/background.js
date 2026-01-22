// Background service worker

// Default API URL - can be overridden via chrome.storage.local
const DEFAULT_API_URL = 'http://localhost:3001';

// --- JWT HELPERS ---
// Helper to decode JWT without verification (for expiration check only)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    console.error('[SOS 360] Failed to decode JWT:', e);
    return null;
  }
}

// Check if token is expired or will expire soon (within 1 hour)
function isTokenExpiringSoon(token) {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;

  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  // Return true if token expires within 1 hour
  return expirationTime - now < oneHour;
}

// Get token expiration time in milliseconds
function getTokenExpirationTime(token) {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return 0;
  return payload.exp * 1000;
}

// --- Utility helpers ---

// Sleep utility function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Storage helpers ---
async function getApiUrl() {
  const result = await chrome.storage.local.get(['apiUrl']);
  return result.apiUrl || DEFAULT_API_URL;
}

async function setApiUrl(url) {
  await chrome.storage.local.set({ apiUrl: url });
}

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

// Test API connectivity before making requests
async function testApiConnectivity() {
  const apiUrl = await getApiUrl();

  try {
    console.log('[SOS 360] Testing API connectivity to:', apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

    // Try /health endpoint first (preferred)
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: controller.signal
    }).catch(() => {
      // Fallback to /api/v1/health if /health doesn't work
      return fetch(`${apiUrl}/api/v1/health`, {
        method: 'GET',
        signal: controller.signal
      });
    });

    clearTimeout(timeoutId);

    const isHealthy = response.ok || response.status < 500;
    console.log('[SOS 360] API connectivity test result:', response.status, isHealthy);
    return isHealthy;
  } catch (error) {
    console.warn('[SOS 360] API connectivity test failed:', error.message);
    return false;
  }
}

async function refreshAccessToken() {
  const result = await chrome.storage.local.get(['refreshToken']);
  if (!result.refreshToken) {
    console.log('[SOS 360] No refresh token available');
    return null;
  }

  try {
    console.log('[SOS 360] Attempting token refresh...');
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: result.refreshToken }),
    });

    if (!response.ok) {
      console.log('[SOS 360] Token refresh failed, clearing auth');
      await clearToken();
      return null;
    }

    const data = await response.json();
    if (data.success && data.data?.accessToken) {
      console.log('[SOS 360] Token refreshed successfully');
      // Save both access and refresh token (API may issue a new refresh token too)
      await chrome.storage.local.set({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken || result.refreshToken,
      });
      return data.data.accessToken;
    }
    return null;
  } catch (error) {
    console.error('[SOS 360] Token refresh error:', error);
    return null;
  }
}

async function apiRequest(endpoint, options = {}, isRetry = false) {
  const token = await getToken();
  const apiUrl = await getApiUrl();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const url = `${apiUrl}${endpoint}`;
  console.log('[SOS 360] API Request:', url, { method: options.method || 'GET' });

  // Validate API URL before attempting fetch
  if (!apiUrl || apiUrl === 'undefined' || apiUrl === 'null') {
    throw new Error('API URL não configurada. Por favor, configure a URL da API nas configurações da extensão.');
  }

  try {
    // Add timeout to fetch to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`API returned non-JSON: ${text.substring(0, 100)}`);
      }
      data = { message: text };
    }

    // Handle 401 - try to refresh token and retry once
    if (response.status === 401 && !isRetry) {
      console.log('[SOS 360] Got 401, attempting token refresh...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        return apiRequest(endpoint, options, true);
      }
      throw new Error('Token inválido ou expirado. Por favor, faça login novamente.');
    }

    if (!response.ok) {
      const errorMessage = data?.error?.detail || data?.error?.message || data?.message || 'API request failed';
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('[SOS 360] API Error:', error);

    // Handle timeout errors
    if (error.name === 'AbortError') {
      throw new Error(`Timeout ao conectar à API (${apiUrl}). Verifique sua conexão ou tente novamente.`);
    }

    // Handle network/fetch errors
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      throw new Error(
        `Não foi possível conectar à API em: ${apiUrl}\n\n` +
        `Possíveis causas:\n` +
        `1. A API não está rodando (execute 'npm run api:dev')\n` +
        `2. URL incorreta configurada na extensão\n` +
        `3. Problema de rede ou CORS\n\n` +
        `URL configurada: ${apiUrl}\n` +
        `Endpoint: ${endpoint}`
      );
    }

    // Handle CORS errors
    if (error.message.includes('CORS') || error.message.includes('Not allowed')) {
      throw new Error(
        `Erro de CORS ao acessar ${apiUrl}\n\n` +
        `Verifique se:\n` +
        `1. A API permite requisições da origem da extensão\n` +
        `2. O domínio está configurado em host_permissions no manifest.json`
      );
    }

    // Re-throw other errors
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
    this.loadState().catch(err => console.error('[SOS 360] LeadNavigator loadState failed:', err));
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
      console.log('[LeadNavigator] Collecting posts...');
      let posts = [];

      // Attempt 1
      let response = await chrome.tabs.sendMessage(this.state.currentTabId, {
        action: 'getPostLinks',
        limit: this.config.postsPerKeyword
      });
      posts = response?.data || [];

      // Retry if 0 - sometimes the page is just slow or infinite scroll didn't trigger
      if (posts.length === 0) {
        console.log('[LeadNavigator] No posts found, waiting and retrying collection...');
        await this.sleep(5000);
        response = await chrome.tabs.sendMessage(this.state.currentTabId, {
          action: 'getPostLinks',
          limit: this.config.postsPerKeyword
        });
        posts = response?.data || [];
      }

      this.state.totalPostsForKeyword = posts.length;
      console.log(`[LeadNavigator] Collected ${posts.length} posts.`);
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

// --- LINKEDIN DEEP EXTRACTOR ---

class LinkedInNavigator {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.results = [];
    this.originalTabId = null;
    this.processedCount = 0;
    this.criteria = ''; // Qualification criteria for AI analysis
    this.deepScan = false;
  }

  async start(leads, originalTabId, criteria = '', deepScan = false) {
    if (this.isProcessing) return;
    this.queue = [...leads];
    this.isProcessing = true;
    this.results = [];
    this.originalTabId = originalTabId;
    this.processedCount = 0;
    this.total = leads.length;
    this.criteria = criteria;
    this.deepScan = deepScan;

    console.log(`[LinkedInNavigator] Starting deep import for ${this.total} leads (DeepScan: ${deepScan})`);
    this.processQueue();
  }

  async processQueue() {
    if (!this.isProcessing) return;

    if (this.queue.length === 0) {
      this.finish();
      return;
    }

    const lead = this.queue.shift();
    this.processedCount++;

    // Update progress on original tab
    this.updateProgress(`Visiting ${lead.fullName}...`);

    try {
      // Open new tab
      const tab = await chrome.tabs.create({ url: lead.profileUrl, active: false });

      // Wait for load + random delay (mimic reading)
      await this.sleep(8000 + Math.random() * 5000);

      // Extract data
      console.log(`[LinkedInNavigator] Extracting data for ${lead.fullName} (Deep: ${this.deepScan})`);
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractProfile',
        deep: this.deepScan
      });

      let richLead = { ...lead };

      if (response && response.success && response.data) {
        // Merge new data with basic lead data
        richLead = { ...lead, ...response.data, platform: 'linkedin' };
      }

      // AI Analysis - call OpenAI to qualify and score the lead
      if (this.criteria) {
        this.updateProgress(`Analyzing ${lead.fullName} with AI...`);
        try {
          const analysis = await this.analyzeLead(richLead);
          if (analysis) {
            richLead.score = analysis.score;
            richLead.analysisReason = analysis.reason;
            console.log(`[LinkedInNavigator] AI Score for ${lead.fullName}: ${analysis.score} - ${analysis.reason}`);
          }
        } catch (analysisError) {
          console.warn(`[LinkedInNavigator] AI analysis failed for ${lead.fullName}:`, analysisError);
        }
      }

      this.results.push(richLead);

      // Save immediately to avoid data loss
      await this.saveLead(richLead);

      // Close tab
      await chrome.tabs.remove(tab.id);

      // Random delay between profiles
      await this.sleep(3000 + Math.random() * 3000);

    } catch (e) {
      console.error(`[LinkedInNavigator] Error processing ${lead.fullName}:`, e);
      // Save basic data anyway
      await this.saveLead(lead);
    }

    this.processQueue();
  }

  async analyzeLead(lead) {
    // Only analyze if we have criteria
    if (!this.criteria) return null;

    try {
      const result = await apiRequest('/api/v1/leads/analyze', {
        method: 'POST',
        body: JSON.stringify({
          profile: {
            ...lead,
            platform: 'linkedin'
          },
          criteria: this.criteria
        })
      });
      return result.data;
    } catch (e) {
      console.error('[LinkedInNavigator] Analysis API error:', e);
      return null;
    }
  }

  async saveLead(lead) {
    try {
      const response = await apiRequest('/api/v1/leads/import', {
        method: 'POST',
        body: JSON.stringify({
          source: 'extension',
          platform: 'linkedin',
          sourceUrl: lead.profileUrl,
          leads: [lead]
        })
      });

      // If Deep Scan is enabled and we have a lead ID, triggering Behavioral Analysis
      if (this.deepScan && response.data?.leadResults?.[0]?.id) {
        const leadId = response.data.leadResults[0].id;
        console.log(`[LinkedInNavigator] Triggering Deep Behavioral Analysis for ${leadId}...`);

        try {
          await apiRequest('/api/v1/leads/analyze-deep', {
            method: 'POST',
            body: JSON.stringify({
              leadId: leadId,
              profile: lead,
              posts: lead.posts || []
            })
          });
          console.log(`[LinkedInNavigator] Deep Analysis completed for ${lead.fullName}`);
        } catch (deepError) {
          console.error(`[LinkedInNavigator] Deep Analysis failed for ${lead.fullName}:`, deepError);
        }
      }

    } catch (e) {
      console.error('Failed to save lead', e);
    }
  }

  async updateProgress(status) {
    if (!this.originalTabId) return;
    try {
      await chrome.tabs.sendMessage(this.originalTabId, {
        action: 'updateImportProgress',
        data: {
          current: this.processedCount,
          total: this.total,
          status
        }
      });
    } catch (e) { }
  }

  finish() {
    this.isProcessing = false;
    this.updateProgress('Done!');
    console.log('[LinkedInNavigator] Finished work');
  }


  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// --- INSTAGRAM DEEP EXTRACTOR ---

class InstagramNavigator {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.results = [];
    this.originalTabId = null;
    this.processedCount = 0;
    this.criteria = '';
    this.profilesThisSession = 0;
    this.sessionStartTime = null;
    // Deep analysis settings
    this.onlyQualified = true;  // Only save leads that pass AI analysis
    this.minScore = 60;         // Minimum score to be considered qualified
    this.qualifiedCount = 0;
    this.discardedCount = 0;
  }

  // Rate limit config - Instagram is more aggressive with anti-automation
  config = {
    maxProfilesPerHour: 40,
    delayBetweenProfiles: { min: 8000, max: 15000 },
    longBreakEveryN: 10,
    longBreakDuration: { min: 30000, max: 60000 },
    pageLoadWait: { min: 5000, max: 10000 },
  };

  async start(leads, originalTabId, criteria = '', options = {}) {
    if (this.isProcessing) {
      console.log('[InstagramNavigator] Already processing');
      return;
    }

    this.queue = [...leads];
    this.isProcessing = true;
    this.results = [];
    this.originalTabId = originalTabId;
    this.processedCount = 0;
    this.total = leads.length;
    this.criteria = criteria;
    this.sessionStartTime = Date.now();
    this.profilesThisSession = 0;
    // Deep analysis options
    this.onlyQualified = options.onlyQualified !== false; // default true
    this.minScore = options.minScore || 60;
    this.qualifiedCount = 0;
    this.discardedCount = 0;

    console.log(`[InstagramNavigator] Starting deep import for ${this.total} leads`);
    console.log(`[InstagramNavigator] AI filter: ${this.onlyQualified ? `score >= ${this.minScore}` : 'disabled'}`);
    console.log(`[InstagramNavigator] Rate limit: ${this.config.maxProfilesPerHour} profiles/hour`);

    this.processQueue();
  }

  async processQueue() {
    if (!this.isProcessing) return;

    if (this.queue.length === 0) {
      this.finish();
      return;
    }

    // Rate limit check
    const elapsed = Date.now() - this.sessionStartTime;
    const hourInMs = 60 * 60 * 1000;
    if (elapsed < hourInMs && this.profilesThisSession >= this.config.maxProfilesPerHour) {
      const waitTime = hourInMs - elapsed + 60000; // Wait until next hour + 1 min buffer
      console.log(`[InstagramNavigator] Rate limit reached.Waiting ${Math.round(waitTime / 60000)} minutes...`);
      this.updateProgress(`Rate limit atingido.Aguardando ${Math.round(waitTime / 60000)}min...`);
      await this.sleep(waitTime);
      this.sessionStartTime = Date.now();
      this.profilesThisSession = 0;
    }

    const lead = this.queue.shift();
    this.processedCount++;
    this.profilesThisSession++;

    this.updateProgress(`Visitando @${lead.username}...`);

    try {
      // Open new tab with profile
      const tab = await chrome.tabs.create({
        url: lead.profileUrl,
        active: false
      });

      // Wait for page load + random delay to mimic human reading
      const loadWait = this.randomDelay(
        this.config.pageLoadWait.min,
        this.config.pageLoadWait.max
      );
      await this.sleep(loadWait);

      // Extract detailed profile data
      console.log(`[InstagramNavigator] Extracting data for @${lead.username}`);
      let richLead = { ...lead };

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractProfile' });

        if (response && response.success && response.data) {
          richLead = {
            ...lead,
            ...response.data,
            platform: 'instagram'
          };
          console.log(`[InstagramNavigator] Extracted: ${richLead.fullName}, followers: ${richLead.followersCount} `);
        }
      } catch (extractError) {
        console.warn(`[InstagramNavigator] Extract failed for @${lead.username}: `, extractError);
      }

      // AI Analysis if criteria provided
      if (this.criteria) {
        this.updateProgress(`Analisando @${lead.username} com IA...`);
        try {
          const analysis = await this.analyzeLead(richLead);
          if (analysis) {
            richLead.score = analysis.score;
            richLead.analysisReason = analysis.reason;
            console.log(`[InstagramNavigator] AI Score for @${lead.username}: ${analysis.score} - ${analysis.reason}`);
          }
        } catch (analysisError) {
          console.warn(`[InstagramNavigator] AI analysis failed for @${lead.username}:`, analysisError);
        }
      }

      // Check if lead passes deep analysis filter
      const passesFilter = !this.onlyQualified || !this.criteria ||
        (richLead.score && richLead.score >= this.minScore);

      if (passesFilter) {
        this.results.push(richLead);
        this.qualifiedCount++;
        await this.saveLead(richLead);
        this.updateProgress(`✅ @${lead.username} qualificado (${this.qualifiedCount}/${this.processedCount})`);
      } else {
        this.discardedCount++;
        console.log(`[InstagramNavigator] Discarding @${lead.username} - score ${richLead.score} < ${this.minScore}`);
        this.updateProgress(`❌ @${lead.username} descartado (score: ${richLead.score || 0})`);
      }

      // Close tab
      try {
        await chrome.tabs.remove(tab.id);
      } catch (e) {
        // Tab might already be closed
      }

      // Regular delay between profiles
      const delay = this.randomDelay(
        this.config.delayBetweenProfiles.min,
        this.config.delayBetweenProfiles.max
      );
      console.log(`[InstagramNavigator] Waiting ${Math.round(delay / 1000)}s before next profile...`);
      await this.sleep(delay);

      // Long break every N profiles
      if (this.profilesThisSession % this.config.longBreakEveryN === 0) {
        const longBreak = this.randomDelay(
          this.config.longBreakDuration.min,
          this.config.longBreakDuration.max
        );
        console.log(`[InstagramNavigator] Taking a long break: ${Math.round(longBreak / 1000)} s`);
        this.updateProgress(`Pausa de segurança(${Math.round(longBreak / 1000)}s)...`);
        await this.sleep(longBreak);
      }

    } catch (e) {
      console.error(`[InstagramNavigator] Error processing @${lead.username}: `, e);
      // Still try to save basic lead data
      await this.saveLead(lead);
    }

    this.processQueue();
  }

  async analyzeLead(lead) {
    if (!this.criteria) return null;

    try {
      const result = await apiRequest('/api/v1/leads/analyze', {
        method: 'POST',
        body: JSON.stringify({
          profile: {
            ...lead,
            platform: 'instagram'
          },
          criteria: this.criteria
        })
      });
      return result.data;
    } catch (e) {
      console.error('[InstagramNavigator] Analysis API error:', e);
      return null;
    }
  }

  async saveLead(lead) {
    try {
      await apiRequest('/api/v1/leads/import', {
        method: 'POST',
        body: JSON.stringify({
          source: 'extension',
          platform: 'instagram',
          sourceUrl: lead.profileUrl,
          leads: [lead]
        })
      });

      // Update local stats
      const stats = await chrome.storage.local.get(['leadsToday', 'leadsMonth']);
      await chrome.storage.local.set({
        leadsToday: (stats.leadsToday || 0) + 1,
        leadsMonth: (stats.leadsMonth || 0) + 1,
      });
    } catch (e) {
      console.error('[InstagramNavigator] Failed to save lead:', e);
    }
  }

  async updateProgress(status) {
    if (!this.originalTabId) return;
    try {
      await chrome.tabs.sendMessage(this.originalTabId, {
        action: 'updateImportProgress',
        data: {
          current: this.processedCount,
          total: this.total,
          status,
          qualified: this.qualifiedCount,
          discarded: this.discardedCount
        }
      });
    } catch (e) {
      // Tab might be closed
    }
  }

  stop() {
    console.log('[InstagramNavigator] Stopping...');
    this.isProcessing = false;
    this.updateProgress('Parado pelo usuário');
  }

  finish() {
    this.isProcessing = false;
    const statsMsg = `Concluído! ${this.qualifiedCount} importados, ${this.discardedCount} descartados`;
    this.updateProgress(statsMsg);
    console.log(`[InstagramNavigator] Finished! ${this.qualifiedCount} qualified, ${this.discardedCount} discarded of ${this.total}`);
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}

const instagramNavigator = new InstagramNavigator();
const linkedInNavigator = new LinkedInNavigator();
const navigator = new LeadNavigator();

// --- INSTAGRAM POST IMPORT HANDLERS ---

/**
 * Handles import of Instagram post data
 * Creates/updates a LeadPost with the post data
 * Assumes the author Lead already exists
 */
async function handleInstagramPostImport(postData) {
  console.log('[SOS 360] Importing Instagram post data:', postData);

  try {
    // First, find the author's Lead by Instagram username
    const response = await apiRequest('/api/v1/leads/import-post', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'instagram',
        postData: postData,
      })
    });

    // Update local stats
    const stats = await chrome.storage.local.get(['leadsToday', 'leadsMonth']);
    await chrome.storage.local.set({
      leadsToday: (stats.leadsToday || 0) + 1,
      leadsMonth: (stats.leadsMonth || 0) + 1,
    });

    console.log('[SOS 360] Post data imported successfully:', response.data);
    return response.data;

  } catch (error) {
    console.error('[SOS 360] Failed to import post data:', error);

    // Show notification to user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'SOS 360 - Import Error',
      message: error.message || 'Failed to import post data. Make sure the author is already imported.',
    });

    throw error;
  }
}

/**
 * Handles import of Instagram comment authors
 * Imports the profiles as leads using the standard import endpoint
 */
async function handleInstagramCommentAuthors(data) {
  const { profiles, postUrl, pipelineId, stageId } = data;

  console.log(`[SOS 360] Importing ${profiles.length} Instagram comment authors to pipeline ${pipelineId}, stage ${stageId}`);

  try {
    const requestBody = {
      source: 'extension',
      platform: 'instagram',
      sourceUrl: postUrl,
      leads: profiles,
    };

    // API expects pipelineStageId, not pipelineId/stageId
    // Convert stageId to pipelineStageId
    if (stageId) {
      requestBody.pipelineStageId = stageId;
      console.log(`[SOS 360] Setting pipelineStageId: ${stageId}`);
    }

    const response = await apiRequest('/api/v1/leads/import', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    console.log('[SOS 360] Import response:', response);

    // Update local stats
    const stats = await chrome.storage.local.get(['leadsToday', 'leadsMonth']);
    await chrome.storage.local.set({
      leadsToday: (stats.leadsToday || 0) + profiles.length,
      leadsMonth: (stats.leadsMonth || 0) + profiles.length,
    });

    console.log('[SOS 360] Comment authors imported successfully');

    // ============================================================
    // START AUTOMATIC PROFILE ENRICHMENT
    // ============================================================
    // API returns leadResults with { id, profileUrl }, need to enrich with original profile data
    if (response.data?.leadResults && response.data.leadResults.length > 0) {
      console.log(`[SOS 360] Starting automatic profile enrichment for ${response.data.leadResults.length} imported leads`);

      // Merge lead results with original profile data
      const leadsForEnrichment = response.data.leadResults
        .map((result) => {
          // Find original profile by matching profileUrl or username
          const originalProfile = profiles.find(p =>
            p.profileUrl === result.profileUrl ||
            p.username === result.profileUrl?.replace('instagram:', '') ||
            p.username === result.profileUrl
          );

          // Skip if no valid username found
          const username = originalProfile?.username || result.profileUrl?.replace('instagram:', '');
          if (!username || username === result.profileUrl) {
            console.warn('[SOS 360] No valid username found for lead:', result);
            return null;
          }

          return {
            id: result.id,
            username: username,
            instagramProfileUrl: originalProfile?.profileUrl || `https://www.instagram.com/${username}/`,
            profileUrl: result.profileUrl,
            avatarUrl: originalProfile?.avatarUrl,
          };
        })
        .filter(lead => lead !== null); // Remove null entries

      console.log('[SOS 360] Leads for enrichment:', leadsForEnrichment);

      if (leadsForEnrichment.length === 0) {
        console.warn('[SOS 360] No valid leads for enrichment, skipping');
        return;
      }

      // Start enrichment in background (don't await)
      instagramCommentEnricher.start(leadsForEnrichment).catch(error => {
        console.error('[SOS 360] Enrichment process error:', error);
      });
    } else {
      console.log('[SOS 360] No leadResults in response, skipping enrichment');
    }

    return response.data;

  } catch (error) {
    console.error('[SOS 360] Failed to import comment authors:', error);
    throw error;
  }
}


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

        case 'getAudiences': {
          const response = await apiRequest('/api/v1/audiences', { method: 'GET' });
          sendResponse({ success: true, data: response.data });
          break;
        }

        case 'getPipelines': {
          const response = await apiRequest('/api/v1/pipelines', { method: 'GET' });
          sendResponse({ success: true, data: response.data });
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

        case 'importPostData': {
          await handleInstagramPostImport(request.data);
          sendResponse({ success: true, message: 'Post data imported successfully' });
          break;
        }

        case 'savePostToLibrary': {
          try {
            const postData = {
              platform: request.platform || 'instagram',
              postUrl: request.data.postUrl,
              content: request.data.content || null,
              imageUrls: request.data.imageUrls || [],
              videoUrls: request.data.videoUrls || [],
              linkedUrl: request.data.linkedUrl || null,
              postType: request.data.postType || 'post',
              likesCount: request.data.likesCount || null,
              commentsCount: request.data.commentsCount || null,
              sharesCount: request.data.sharesCount || null,
              viewsCount: request.data.viewsCount || null,
              authorUsername: request.data.authorUsername,
              authorFullName: request.data.authorFullName || null,
              authorAvatarUrl: request.data.authorAvatarUrl || null,
              authorProfileUrl: request.data.authorProfileUrl || null,
            };

            const response = await apiRequest('/api/v1/posts', {
              method: 'POST',
              body: JSON.stringify(postData),
            });

            console.log('[SOS 360] Post saved to library:', response.data);
            sendResponse({ success: true, data: response.data });
          } catch (error) {
            console.error('[SOS 360] Error saving post to library:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
        }

        case 'importCommentAuthors': {
          await handleInstagramCommentAuthors(request.data);
          sendResponse({ success: true, message: 'Comment authors imported successfully' });
          break;
        }

        // --- Instagram Enrichment Control ---
        case 'stopInstagramEnrichment': {
          instagramCommentEnricher.stop();
          sendResponse({ success: true });
          break;
        }

        case 'getInstagramEnrichmentStats': {
          const stats = instagramCommentEnricher.getStats();
          sendResponse({ success: true, stats });
          break;
        }

        case 'startAutoMode': {
          navigator.start(request.keywords, request.criteria);
          sendResponse({ success: true });
          break;
        }

        case 'startDeepImport': {
          // Pass criteria for AI analysis if provided
          const criteria = request.data.criteria || '';
          const deepScan = request.data.deepScan || false;
          const response = await apiRequest('/api/v1/leads/analyze-batch', {
            method: 'POST',
            body: JSON.stringify({
              profiles: request.data.profiles,
              criteria: request.data.criteria
            })
          });
          sendResponse({ success: true, data: response.data });
          break;
        }

        case 'setApiUrl': {
          await setApiUrl(request.url);
          console.log('[SOS 360] API URL set to:', request.url);
          sendResponse({ success: true });
          break;
        }

        case 'getApiUrl': {
          const url = await getApiUrl();
          sendResponse({ success: true, url });
          break;
        }

        case 'testApiConnectivity': {
          const isConnected = await testApiConnectivity();
          const url = await getApiUrl();
          sendResponse({ success: true, isConnected, apiUrl: url });
          break;
        }

        case 'stopAutoMode': {
          navigator.stop();
          sendResponse({ success: true });
          break;
        }

        // --- Dashboard Sync Handlers ---
        case 'syncAuth': {
          const { accessToken, refreshToken } = request.data || {};
          if (accessToken) {
            await chrome.storage.local.set({
              accessToken,
              refreshToken: refreshToken || null
            });
            console.log('[SOS 360] Auth synced from dashboard');

            // Trigger immediate poll after sync
            setTimeout(() => executor.poll(), 1000);

            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No token provided' });
          }
          break;
        }

        case 'triggerImmediatePoll': {
          console.log('[SOS 360] Immediate poll triggered from dashboard');
          executor.poll();
          sendResponse({ success: true });
          break;
        }

        case 'getExtensionStatus': {
          const token = await getToken();
          const apiUrl = await getApiUrl();
          const isRunning = executor.state && executor.state.status === 'RUNNING';
          sendResponse({
            success: true,
            isAuthenticated: !!token,
            apiUrl: apiUrl,
            isAutomationRunning: isRunning,
            currentJobId: executor.state?.jobId || null
          });
          break;
        }

        // --- Automation Control Messages (delegated to executor) ---
        case 'STOP_AUTOMATION': {
          console.log('[SOS 360] STOP_AUTOMATION received in main handler');
          await executor.finishJob('cancelled');
          sendResponse({ success: true, message: 'Automation stopped' });
          break;
        }

        case 'NEXT_STEP': {
          console.log('[SOS 360] NEXT_STEP received in main handler');
          if (executor.state && executor.state.status === 'RUNNING') {
            executor.state.currentIndex++;
            await executor.saveState();
            await executor.processCurrentLead();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, message: 'No running automation' });
          }
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

// --- AUTOMATION EXECUTOR (Background Job Processor) ---

class AutomationExecutor {
  constructor() {
    this.isPolling = false;
    this.pollInterval = 10000; // 10 seconds
    this.isStopping = false; // Flag to prevent race conditions during stop
    this.finishedJobIds = new Set(); // Track finished jobs to prevent restart

    // Initialize asynchronously
    this.initialize();

    // Listen for tab updates to inject overlay/execute actions
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
  }

  async initialize() {
    // Load finished job IDs FIRST
    await this.loadFinishedJobs();
    // Then restore state
    await this.restoreState();
  }

  async loadFinishedJobs() {
    const { finishedJobIds } = await chrome.storage.local.get(['finishedJobIds']);
    if (finishedJobIds && Array.isArray(finishedJobIds)) {
      this.finishedJobIds = new Set(finishedJobIds);
      console.log('[SOS 360] Loaded finished job IDs:', this.finishedJobIds.size);
    }
  }

  async saveFinishedJob(jobId) {
    this.finishedJobIds.add(jobId);
    // Keep only last 100 jobs to prevent unlimited growth
    if (this.finishedJobIds.size > 100) {
      const arr = Array.from(this.finishedJobIds);
      this.finishedJobIds = new Set(arr.slice(-100));
    }
    await chrome.storage.local.set({ finishedJobIds: Array.from(this.finishedJobIds) });
    console.log('[SOS 360] Saved finished job ID:', jobId);
  }

  // Utility method for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async restoreState() {
    const { automationState } = await chrome.storage.local.get(['automationState']);
    if (automationState && automationState.status === 'RUNNING') {
      console.log('[SOS 360] Found saved automation state, validating...');

      // Check if job was already finished
      if (automationState.jobId && this.finishedJobIds.has(automationState.jobId)) {
        console.log('[SOS 360] Job was already finished, clearing state');
        await chrome.storage.local.remove(['automationState']);
        this.state = null;
        return;
      }

      // Validate that the tab/window still exists before restoring
      if (automationState.tabId) {
        try {
          await chrome.tabs.get(automationState.tabId);
          console.log('[SOS 360] Tab still exists, restoring state');
          this.state = automationState;
        } catch (e) {
          // Tab no longer exists, mark job as finished and clear state
          console.log('[SOS 360] Tab no longer exists, marking job as finished');
          if (automationState.jobId) {
            await this.saveFinishedJob(automationState.jobId);
          }
          await chrome.storage.local.remove(['automationState']);
          this.state = null;
        }
      } else {
        // No tabId, state is incomplete, clear it
        console.log('[SOS 360] Incomplete state (no tabId), clearing');
        await chrome.storage.local.remove(['automationState']);
        this.state = null;
      }
    } else {
      this.state = null;
    }
  }

  async saveState() {
    if (this.state) {
      await chrome.storage.local.set({ automationState: this.state });
    } else {
      await chrome.storage.local.remove(['automationState']);
    }
  }

  async poll() {
    // Only poll if not already running or stopping
    if (this.isStopping) {
      console.log('[SOS 360] Poll skipped: Automation is stopping');
      return;
    }

    if (this.state && this.state.status === 'RUNNING') {
      console.log('[SOS 360] Poll skipped: Automation already running');
      return;
    }

    const token = await getToken();
    if (!token) {
      console.warn('[SOS 360] Polling skipped: No auth token. Please login to the extension first.');
      return;
    }

    const apiUrl = await getApiUrl();
    console.log('[SOS 360] Polling for jobs at:', apiUrl);

    try {
      const response = await apiRequest('/api/v1/automations/jobs', { method: 'GET' });
      console.log('[SOS 360] Poll response:', response);

      if (response && response.success && response.data && response.data.length > 0) {
        // Find first job that hasn't been finished locally
        const job = response.data.find(j => !this.finishedJobIds.has(j.id));

        if (!job) {
          console.log('[SOS 360] All pending jobs were already finished locally');
          return;
        }

        console.log('[SOS 360] Found pending job:', job.id, 'with', job.result?.leadsToProcess?.length || 0, 'leads');

        // Notify user that automation is starting
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-128.png',
          title: 'SOS 360 - Automation Starting',
          message: `Starting automation with ${job.result?.leadsToProcess?.length || 0} leads...`
        });

        await this.startJob(job);
      } else {
        console.log('[SOS 360] No pending jobs found');
      }
    } catch (error) {
      console.error('[SOS 360] Poll error:', error.message);

      // Show notification on persistent errors
      if (error.message.includes('401') || error.message.includes('token')) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-128.png',
          title: 'SOS 360 - Auth Error',
          message: 'Please login to the extension to run automations.'
        });
      }
    }
  }

  async startJob(job) {
    console.log('[SOS 360] Starting job:', job.id);
    console.log('[SOS 360] Job result:', JSON.stringify(job.result, null, 2));

    const leadsToProcess = job.result?.leadsToProcess || [];
    console.log('[SOS 360] Leads to process:', leadsToProcess.length);

    if (leadsToProcess.length === 0) {
      console.error('[SOS 360] No leads to process in job!');
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'SOS 360 - No Leads',
        message: 'The automation job has no leads to process.'
      });
      return;
    }

    // Log first lead for debugging
    console.log('[SOS 360] First lead:', JSON.stringify(leadsToProcess[0], null, 2));

    this.state = {
      jobId: job.id,
      status: 'RUNNING',
      leads: leadsToProcess,
      actions: job.result?.actions || [],
      config: job.result?.config || {},
      currentIndex: 0,
      currentLead: null,
      tabId: null,
      logs: []
    };

    // Parse Interval
    let min = 60000, max = 90000;
    if (this.state.config.interval) {
      const p = this.state.config.interval.split('-');
      if (p.length === 2) { min = parseInt(p[0]) * 1000; max = parseInt(p[1]) * 1000; }
    }
    this.state.minDelay = min;
    this.state.maxDelay = max;

    await this.saveState();

    // Update API status
    try {
      await apiRequest(`/api/v1/automations/jobs/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'running' })
      });
      console.log('[SOS 360] Job status updated to running');
    } catch (e) {
      console.error('[SOS 360] Failed to update job status to RUNNING. Aborting job to prevent loop:', e);
      this.state = null;
      await this.saveState();
      return; // CRITICAL: Do not proceed if we can't lock the job
    }

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Automation Started',
      message: `Processing ${this.state.leads.length} leads...`
    });

    console.log('[SOS 360] Calling processCurrentLead...');
    await this.processCurrentLead();
  }

  async processCurrentLead() {
    if (!this.state || this.state.status !== 'RUNNING' || this.isStopping) {
      console.log('[SOS 360] processCurrentLead: State not running or stopping, aborting');
      return;
    }

    const { leads, currentIndex } = this.state;
    console.log(`[SOS 360] processCurrentLead: index=${currentIndex}, total leads=${leads?.length || 0}`);

    // FINISHED
    if (currentIndex >= leads.length) {
      console.log('[SOS 360] All leads processed, finishing job');
      await this.finishJob('success');
      return;
    }

    const lead = leads[currentIndex];

    // Validate lead has profileUrl
    if (!lead || !lead.profileUrl) {
      console.error('[SOS 360] Lead missing profileUrl, skipping:', lead);
      this.state.currentIndex++;
      await this.saveState();
      await this.processCurrentLead(); // Skip to next
      return;
    }

    this.state.currentLead = lead;

    console.log(`[SOS 360] Processing lead ${currentIndex + 1}/${leads.length}: ${lead.fullName || lead.username || 'Unknown'}`);
    console.log(`[SOS 360] Profile URL: ${lead.profileUrl}`);

    try {
      // Open or Update Tab
      if (this.state.tabId) {
        try {
          // Check if tab exists
          await chrome.tabs.get(parseInt(this.state.tabId));
          console.log('[SOS 360] Updating existing tab:', this.state.tabId);
          await chrome.tabs.update(parseInt(this.state.tabId), { url: lead.profileUrl, active: true });
        } catch (e) {
          // Tab closed by user, stop automation
          console.log('[SOS 360] Automation tab/window was closed by user. Stopping automation.');

          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon-128.png',
            title: 'Automation Stopped',
            message: 'Automation was stopped because the window was closed.'
          });

          await this.finishJob('cancelled');
          return;
        }
      } else {
        console.log('[SOS 360] No existing tab, creating new window for:', lead.profileUrl);
        const win = await chrome.windows.create({
          url: lead.profileUrl,
          focused: true,
          type: 'popup',
          width: 1200,
          height: 800
        });

        // Save window ID for close detection
        this.state.windowId = win.id;

        if (!win.tabs || win.tabs.length === 0) {
          console.log('[SOS 360] Window created but tabs not returned, fetching...');
          const tabs = await chrome.tabs.query({ windowId: win.id });
          this.state.tabId = tabs[0].id;
        } else {
          this.state.tabId = win.tabs[0].id;
        }

        console.log('[SOS 360] Window created successfully:', { windowId: win.id, tabId: this.state.tabId });
      }

      await this.saveState();
      // "onTabUpdated" will trigger next steps once Loaded
    } catch (error) {
      console.error('[SOS 360] Error opening tab:', error);
      // Skip this lead and try next
      this.state.currentIndex++;
      await this.saveState();
      setTimeout(() => this.processCurrentLead(), 2000);
    }
  }

  async onTabUpdated(tabId, changeInfo, tab) {
    if (!this.state || this.state.status !== 'RUNNING' || tabId !== this.state.tabId) return;

    if (changeInfo.status === 'complete') {
      console.log('[SOS 360] Tab loaded, injecting overlay...');

      // 1. Show Overlay with full lead info
      const lead = this.state.currentLead;
      await chrome.tabs.sendMessage(tabId, {
        action: 'SHOW_OVERLAY',
        state: {
          total: this.state.leads.length,
          current: this.state.currentIndex + 1,
          lead: {
            name: lead.fullName || lead.username || 'Unknown',
            headline: lead.bio || lead.headline || lead.position || 'Processing...',
            avatar: lead.avatarUrl || null
          },
          status: 'Sending connection request...'
        }
      }).catch(() => console.log('Content script not ready yet'));

      // 2. Perform Actions
      await this.executeActionsInTab(tabId);
    }
  }

  async executeActionsInTab(tabId) {
    // Check if state still exists (might have been cancelled)
    if (!this.state || this.isStopping) {
      console.log('[SOS 360] executeActionsInTab: State cleared or stopping, aborting');
      return;
    }

    const lead = this.state.currentLead;
    const actions = this.state.actions || [];
    const totalLeads = this.state.leads?.length || 0;
    const currentIndex = this.state.currentIndex || 0;

    // If no actions defined but we had legacy behavior, support it? 
    // For now assuming actions array is populated.
    if (actions.length === 0) {
      console.log('[SOS 360] No actions to execute');
      return;
    }

    try {
      // Wait a bit for page to fully render
      await new Promise(r => setTimeout(r, 2000));

      for (let i = 0; i < actions.length; i++) {
        // Check if state still exists before each action
        if (!this.state || this.isStopping) {
          console.log('[SOS 360] Automation cancelled during action execution');
          return;
        }

        const action = actions[i];
        console.log(`[SOS 360] Executing action ${i + 1}/${actions.length}: ${action.type}`);

        // Update overlay
        await chrome.tabs.sendMessage(tabId, {
          action: 'SHOW_OVERLAY',
          state: {
            total: totalLeads,
            current: currentIndex + 1,
            lead: {
              name: lead.fullName || lead.username || 'Unknown',
              headline: this.getActionStatusMessage(action),
              avatar: lead.avatarUrl || null
            },
            status: `Action ${i + 1}/${actions.length} in progress...`
          }
        }).catch(() => { });

        let actionSuccess = false;

        if (action.type === 'connection_request') {
          // === ENRICHMENT PHASE ===
          // Perform profile enrichment BEFORE sending connection request
          try {
            console.log('[SOS 360] Starting profile enrichment before connection request...');

            // Update overlay to show enrichment status
            await chrome.tabs.sendMessage(tabId, {
              action: 'SHOW_OVERLAY',
              state: {
                total: totalLeads,
                current: currentIndex + 1,
                lead: {
                  name: lead.fullName || lead.username || 'Unknown',
                  headline: 'Extracting profile data...',
                  avatar: lead.avatarUrl || null
                },
                status: 'Enriching profile...'
              }
            }).catch(() => { });

            // Call content script to perform enrichment
            const enrichmentResult = await chrome.tabs.sendMessage(tabId, {
              action: 'performEnrichment'
            });

            if (enrichmentResult && enrichmentResult.success && enrichmentResult.data) {
              console.log('[SOS 360] Enrichment successful, persisting data...');

              // Persist enriched data via API
              try {
                await apiRequest(`/api/v1/leads/${lead.id}/enrich`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    enrichment: enrichmentResult.data.enrichment
                  })
                });
                console.log('[SOS 360] Enrichment data persisted for lead:', lead.id);
              } catch (apiError) {
                console.warn('[SOS 360] Failed to persist enrichment data:', apiError);
                // Continue anyway - enrichment failure shouldn't block connection
              }
            } else {
              console.warn('[SOS 360] Enrichment returned no data or failed:', enrichmentResult?.error);
            }
          } catch (enrichError) {
            console.warn('[SOS 360] Enrichment failed:', enrichError);
            // Continue anyway - enrichment failure shouldn't block connection
          }

          // Update overlay before sending connection
          await chrome.tabs.sendMessage(tabId, {
            action: 'SHOW_OVERLAY',
            state: {
              total: totalLeads,
              current: currentIndex + 1,
              lead: {
                name: lead.fullName || lead.username || 'Unknown',
                headline: 'Sending connection request...',
                avatar: lead.avatarUrl || null
              },
              status: 'Connecting...'
            }
          }).catch(() => { });

          // === CONNECTION REQUEST PHASE ===
          const result = await chrome.tabs.sendMessage(tabId, {
            action: 'performAutomation',
            automationType: 'connection_request',
            config: action.config || {},
            lead: lead
          });
          actionSuccess = result?.success !== false;

        } else if (action.type === 'send_message') {
          // TODO: Implement message sending
          console.log('[SOS 360] Send message action triggered (mock success)');
          actionSuccess = true;

        } else if (action.type === 'move_pipeline_stage') {
          try {
            const targetStageId = action.config?.pipelineStageId;
            if (targetStageId) {
              await apiRequest(`/api/v1/leads/${lead.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ pipelineStageId: targetStageId })
              });
              console.log('[SOS 360] Lead moved to stage:', targetStageId);
              actionSuccess = true;
            } else {
              throw new Error('Target pipeline stage ID is missing');
            }
          } catch (e) {
            console.error('[SOS 360] Failed to move lead:', e);
            actionSuccess = false;
          }
        }

        // Log result (only if state still exists)
        if (this.state && this.state.logs) {
          this.state.logs.push({
            leadId: lead.id,
            leadName: lead.fullName,
            action: action.type,
            status: actionSuccess ? 'success' : 'failed',
            time: new Date().toISOString()
          });
        }

        // Delay between actions (only if not cancelled)
        if (i < actions.length - 1 && this.state && !this.isStopping) {
          await this.sleep(2000);
        }
      }

      // Final success update (only if state still exists)
      if (this.state && !this.isStopping) {
        await chrome.tabs.sendMessage(tabId, {
          action: 'SHOW_OVERLAY',
          state: {
            total: totalLeads,
            current: currentIndex + 1,
            lead: {
              name: lead.fullName || lead.username || 'Unknown',
              headline: '✓ All actions completed',
              avatar: lead.avatarUrl || null
            },
            status: 'Waiting before next...'
          }
        }).catch(() => { });
      }

    } catch (e) {
      console.error('[SOS 360] Action execution failed:', e);
      // Only log if state still exists
      if (this.state && this.state.logs) {
        this.state.logs.push({
          leadId: lead.id,
          leadName: lead.fullName,
          status: 'error',
          error: e.message,
          time: new Date().toISOString()
        });
      }
    }

    // Check if state still exists before continuing
    if (!this.state || this.isStopping) {
      console.log('[SOS 360] Automation cancelled, skipping wait');
      return;
    }

    // START WAIT - Random delay before next LEAD
    const delayMs = Math.floor(Math.random() * (this.state.maxDelay - this.state.minDelay + 1) + this.state.minDelay);
    const delaySec = Math.round(delayMs / 1000);

    await chrome.tabs.sendMessage(tabId, {
      action: 'START_WAIT',
      duration: delaySec
    }).catch(() => { });

    await this.saveState();
  }

  getActionStatusMessage(action) {
    switch (action.type) {
      case 'connection_request': return 'Sending connection request...';
      case 'send_message': return 'Sending message...';
      case 'move_pipeline_stage': return 'Moving to next stage...';
      default: return 'Processing...';
    }
  }

  onMessage(request, sender, sendResponse) {
    // Only handle automation-related messages
    if (request.action !== 'NEXT_STEP' && request.action !== 'STOP_AUTOMATION') {
      return; // Let other handlers process this message
    }

    console.log('[SOS 360] AutomationExecutor received message:', request.action);

    // Handle STOP even if not running (to clean up state)
    if (request.action === 'STOP_AUTOMATION') {
      console.log('[SOS 360] User requested STOP - cancelling automation');
      (async () => {
        await this.finishJob('cancelled');
        sendResponse({ success: true, message: 'Automation stopped' });
      })();
      return true;
    }

    if (!this.state || this.state.status !== 'RUNNING') {
      console.log('[SOS 360] No running automation to process');
      sendResponse({ success: false, message: 'No running automation' });
      return true;
    }

    (async () => {
      if (request.action === 'NEXT_STEP') {
        console.log('[SOS 360] Received NEXT_STEP from overlay');
        this.state.currentIndex++;
        await this.saveState();
        await this.processCurrentLead(); // Navigation happens here
        sendResponse({ success: true });
      }
    })();

    return true; // Keep message channel open for async operations
  }

  async finishJob(status) {
    // Prevent double-finish or race conditions
    if (!this.state || this.isStopping) {
      console.log('[SOS 360] finishJob called but already stopping or no state');
      return;
    }

    this.isStopping = true; // Set flag to prevent concurrent calls
    console.log('[SOS 360] Finishing job with status:', status);

    const jobId = this.state.jobId;
    const tabId = this.state.tabId;
    const windowId = this.state.windowId;
    const totalProcessed = this.state.currentIndex || 0;
    const totalLeads = this.state.leads?.length || 0;

    // FIRST: Mark job as finished BEFORE clearing state (prevents re-polling)
    if (jobId) {
      await this.saveFinishedJob(jobId);
    }

    // Clear state to prevent re-processing
    const savedState = { ...this.state };
    this.state = null;
    await this.saveState();
    console.log('[SOS 360] State cleared');

    // Hide overlay
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'HIDE_OVERLAY' });
      } catch (e) {
        console.log('[SOS 360] Could not hide overlay (tab might be closed):', e.message);
      }
    }

    // Close automation window if it was created by the automation
    if (windowId) {
      try {
        await chrome.windows.remove(windowId);
        console.log('[SOS 360] Automation window closed:', windowId);
      } catch (e) {
        console.log('[SOS 360] Could not close automation window (might already be closed):', e.message);
      }
    }

    // Update API - mark as completed/failed to prevent re-polling
    try {
      const apiStatus = status === 'cancelled' ? 'failed' : (status === 'success' ? 'success' : 'failed');
      await apiRequest(`/api/v1/automations/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: apiStatus,
          result: {
            logs: savedState.logs || [],
            processedCount: totalProcessed,
            cancelledByUser: status === 'cancelled'
          }
        })
      });
      console.log('[SOS 360] Job status updated in API:', apiStatus);
    } catch (e) {
      console.error('[SOS 360] Failed to update job status in API:', e.message);
    }

    const statusMsg = status === 'success'
      ? `Completed! ${totalProcessed}/${totalLeads} leads processed.`
      : status === 'cancelled'
        ? 'Automation cancelled by user.'
        : `Automation finished with status: ${status}`;

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Automation Finished',
      message: statusMsg
    });

    console.log('[SOS 360] Job finished:', statusMsg);
    this.isStopping = false; // Reset flag
  }
}

/**
 * InstagramCommentEnricher - Manages profile enrichment for imported comment authors
 *
 * Opens popup windows for each imported lead, extracts additional profile data,
 * and updates the lead record in the database.
 */
class InstagramCommentEnricher {
  constructor() {
    this.active = false;
    this.queue = [];
    this.currentWindow = null;
    this.currentLead = null;
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0
    };
    this.rateLimit = {
      minDelay: 10000,    // 10 seconds between profiles (conservative)
      maxPerHour: 30,     // Instagram strict rate limit
      lastProcessed: 0
    };
  }

  /**
   * Start enrichment process for a list of imported leads
   * @param {Array} leads - Array of lead objects with username and instagramProfileUrl
   */
  async start(leads) {
    if (this.active) {
      console.warn('[SOS 360] Instagram enrichment already active');
      return;
    }

    if (!leads || leads.length === 0) {
      console.log('[SOS 360] No leads to enrich');
      return;
    }

    console.log(`[SOS 360] Starting Instagram enrichment for ${leads.length} leads`);
    this.active = true;
    this.queue = leads;
    this.stats.total = leads.length;
    this.stats.completed = 0;
    this.stats.failed = 0;

    // Process leads sequentially
    while (this.queue.length > 0 && this.active) {
      const lead = this.queue.shift();
      await this.processLead(lead);
    }

    console.log(`[SOS 360] Instagram enrichment complete: ${this.stats.completed} succeeded, ${this.stats.failed} failed`);
    this.active = false;
  }

  /**
   * Process a single lead - open window, extract data, update record
   */
  async processLead(lead) {
    let windowClosed = false;
    let windowId = null;

    try {
      // Validate lead data
      if (!lead || !lead.username) {
        throw new Error('Invalid lead: missing username');
      }

      // Rate limiting check
      const timeSinceLast = Date.now() - this.rateLimit.lastProcessed;
      if (timeSinceLast < this.rateLimit.minDelay) {
        const waitTime = this.rateLimit.minDelay - timeSinceLast;
        console.log(`[SOS 360] Rate limit: waiting ${waitTime}ms before processing ${lead.username}`);
        await sleep(waitTime);
      }

      this.currentLead = lead;
      console.log(`[SOS 360] ==================================================`);
      console.log(`[SOS 360] Enriching profile: ${lead.username} (ID: ${lead.id})`);
      console.log(`[SOS 360] Lead data:`, JSON.stringify(lead, null, 2));

      // Construct profile URL
      const profileUrl = lead.instagramProfileUrl || `https://www.instagram.com/${lead.username}/`;
      console.log(`[SOS 360] Profile URL: ${profileUrl}`);

      // Validate URL
      if (!profileUrl || profileUrl === 'https://www.instagram.com//') {
        throw new Error(`Invalid profile URL: ${profileUrl}`);
      }

      // Open popup window with Instagram profile
      console.log(`[SOS 360] Opening popup window...`);

      this.currentWindow = await chrome.windows.create({
        url: profileUrl,
        type: 'popup',
        width: 1200,
        height: 800,
        focused: false
      });

      windowId = this.currentWindow.id;
      console.log(`[SOS 360] Window ${windowId} created successfully`);

      // Wait for page to load
      console.log('[SOS 360] Waiting 5s for page to load...');
      await sleep(5000);

      // Check if window still exists
      try {
        await chrome.windows.get(windowId);
      } catch (e) {
        throw new Error('Window was closed by user or failed to load');
      }

      // Get tab from window
      const tabs = await chrome.tabs.query({ windowId });
      if (tabs.length === 0) {
        throw new Error('No tabs found in enrichment window');
      }

      const tab = tabs[0];
      console.log(`[SOS 360] Tab ${tab.id} found, current URL: ${tab.url}`);

      // Check if tab navigated to Instagram successfully
      if (!tab.url.includes('instagram.com')) {
        throw new Error(`Tab did not navigate to Instagram. Current URL: ${tab.url}`);
      }

      // Inject content script
      console.log('[SOS 360] Injecting content script...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/instagram.js']
        });
        console.log('[SOS 360] Content script injected successfully');
      } catch (injectError) {
        console.error('[SOS 360] Script injection failed:', injectError);
        throw new Error(`Failed to inject content script: ${injectError.message}`);
      }

      // Wait for script initialization
      console.log('[SOS 360] Waiting 1s for script initialization...');
      await sleep(1000);

      // Send message to content script
      console.log('[SOS 360] Sending enrichInstagramProfile message...');
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'enrichInstagramProfile',
          data: { username: lead.username }
        });
      } catch (messageError) {
        console.error('[SOS 360] Message sending failed:', messageError);
        throw new Error(`Failed to send message to content script: ${messageError.message}`);
      }

      console.log('[SOS 360] Response received:', response);

      if (!response) {
        throw new Error('No response from content script');
      }

      if (response?.success && response?.profile) {
        console.log('[SOS 360] Profile data extracted successfully');
        console.log('[SOS 360] Updating lead...');
        await this.updateLead(lead.id, response.profile);
        this.stats.completed++;
        console.log(`[SOS 360] ✓ Successfully enriched ${lead.username}`);
      } else {
        throw new Error(response?.error || 'Failed to extract profile data');
      }

    } catch (error) {
      console.error(`[SOS 360] ✗ Error enriching ${lead?.username}:`, error);
      this.stats.failed++;
    } finally {
      // Close the popup window
      if (windowId && !windowClosed) {
        try {
          console.log(`[SOS 360] Closing window ${windowId}...`);
          await chrome.windows.remove(windowId);
          console.log('[SOS 360] Window closed');
        } catch (e) {
          console.log('[SOS 360] Window already closed or error:', e.message);
        }
      }
      this.currentWindow = null;
      this.currentLead = null;
      this.rateLimit.lastProcessed = Date.now();
    }
  }

  /**
   * Update lead record with enriched profile data
   */
  async updateLead(leadId, profileData) {
    try {
      console.log(`[SOS 360] ========================================`);
      console.log(`[SOS 360] updateLead() called for lead ${leadId}`);
      console.log(`[SOS 360] Full profileData received:`, JSON.stringify(profileData, null, 2));

      // Filter out undefined/null values to avoid overwriting with null
      const updateData = {};
      if (profileData.bio !== undefined && profileData.bio !== null) updateData.bio = profileData.bio;
      if (profileData.followersCount !== undefined && profileData.followersCount !== null) {
        updateData.followersCount = profileData.followersCount;
        console.log(`[SOS 360] ✅ Including followersCount: ${profileData.followersCount}`);
      }
      if (profileData.followingCount !== undefined && profileData.followingCount !== null) {
        updateData.followingCount = profileData.followingCount;
        console.log(`[SOS 360] ✅ Including followingCount: ${profileData.followingCount}`);
      }
      if (profileData.postsCount !== undefined && profileData.postsCount !== null) {
        updateData.postsCount = profileData.postsCount;
        console.log(`[SOS 360] ✅ Including postsCount: ${profileData.postsCount}`);
      }
      if (profileData.website !== undefined && profileData.website !== null) updateData.website = profileData.website;
      if (profileData.email !== undefined && profileData.email !== null) updateData.email = profileData.email;

      console.log(`[SOS 360] Update data (filtered):`, JSON.stringify(updateData, null, 2));
      console.log(`[SOS 360] ========================================`);

      const response = await apiRequest(`/api/v1/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      console.log(`[SOS 360] ========================================`);
      console.log(`[SOS 360] Update API response:`, JSON.stringify(response, null, 2));

      if (!response?.success) {
        throw new Error('Failed to update lead');
      }

      console.log(`[SOS 360] ✅✅✅ Lead ${leadId} updated successfully!`);
      console.log(`[SOS 360] ✅✅✅ Stats saved to database:`);
      console.log(`[SOS 360]     - followersCount: ${updateData.followersCount || '(not set)'}`);
      console.log(`[SOS 360]     - followingCount: ${updateData.followingCount || '(not set)'}`);
      console.log(`[SOS 360]     - postsCount: ${updateData.postsCount || '(not set)'}`);
      console.log(`[SOS 360] ========================================`);
    } catch (error) {
      console.error(`[SOS 360] Error updating lead ${leadId}:`, error);
      throw error;
    }
  }

  /**
   * Stop the enrichment process
   */
  stop() {
    console.log('[SOS 360] Stopping Instagram enrichment');
    this.active = false;
  }

  /**
   * Get current stats
   */
  getStats() {
    return { ...this.stats };
  }
}

const executor = new AutomationExecutor();
const instagramCommentEnricher = new InstagramCommentEnricher();

// --- TAB/WINDOW CLOSE DETECTION ---
// Cancel automation when user closes the tab
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (executor.state && executor.state.tabId === tabId) {
    console.log('[SOS 360] Automation tab closed by user, cancelling automation');
    executor.finishJob('cancelled');
  }
});

// Cancel automation when user closes the window
chrome.windows.onRemoved.addListener((windowId) => {
  if (executor.state && executor.state.windowId === windowId) {
    console.log('[SOS 360] Automation window closed by user, cancelling automation');
    executor.finishJob('cancelled');
  }
});

// --- PERSISTENT ALARM SETUP ---
// In Manifest V3, alarms need to be set up properly to persist across service worker restarts

async function setupPollingAlarm() {
  // Check if alarm already exists
  const existingAlarm = await chrome.alarms.get('automationPoll');
  if (!existingAlarm) {
    console.log('[SOS 360] Creating polling alarm...');
    chrome.alarms.create('automationPoll', {
      delayInMinutes: 0.1, // Start after 6 seconds
      periodInMinutes: 0.2  // Then every 12 seconds
    });
  } else {
    console.log('[SOS 360] Polling alarm already exists');
  }
}

// Set up alarms on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SOS 360] Extension installed/updated');
  setupPollingAlarm();
  setupTokenRefreshAlarm();
});

// Set up alarms on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[SOS 360] Browser started');
  setupPollingAlarm();
  setupTokenRefreshAlarm();
});

// Also set up alarms immediately when service worker loads
setupPollingAlarm();
setupTokenRefreshAlarm();

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'automationPoll') {
    console.log('[SOS 360] Polling for automation jobs...');
    executor.poll();
  }
});

// --- IMMEDIATE TRIGGER FROM FRONTEND ---
// Allow frontend to trigger immediate poll via external message
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('[SOS 360] External message received:', request);

  if (request.action === 'TRIGGER_AUTOMATION_POLL') {
    console.log('[SOS 360] Immediate poll triggered from frontend');
    executor.poll().then(() => {
      sendResponse({ success: true, message: 'Poll triggered' });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'CHECK_EXTENSION_STATUS') {
    (async () => {
      const token = await getToken();
      const apiUrl = await getApiUrl();
      sendResponse({
        success: true,
        isAuthenticated: !!token,
        apiUrl: apiUrl
      });
    })();
    return true;
  }
});

// --- FORCE IMMEDIATE POLL ON SERVICE WORKER WAKE ---
// When service worker wakes up, immediately check for pending jobs
(async () => {
  console.log('[SOS 360] Service worker active, checking for pending jobs...');
  // Small delay to ensure everything is initialized
  await new Promise(r => setTimeout(r, 1000));
  executor.poll();
})();

// --- PROACTIVE TOKEN REFRESH ---
// Ensure the extension never loses session by proactively refreshing tokens

async function setupTokenRefreshAlarm() {
  // Check if alarm already exists
  const existingAlarm = await chrome.alarms.get('tokenRefresh');
  if (!existingAlarm) {
    console.log('[SOS 360] Creating token refresh alarm...');
    // Check every 30 minutes
    chrome.alarms.create('tokenRefresh', {
      delayInMinutes: 1, // Start after 1 minute
      periodInMinutes: 30 // Then every 30 minutes
    });
  } else {
    console.log('[SOS 360] Token refresh alarm already exists');
  }
}

// Check and refresh token if needed
async function checkAndRefreshToken() {
  const result = await chrome.storage.local.get(['accessToken', 'refreshToken']);

  if (!result.accessToken) {
    console.log('[SOS 360] No access token to check');
    return;
  }

  if (!result.refreshToken) {
    console.log('[SOS 360] No refresh token available, cannot refresh');
    return;
  }

  // Check if token is expiring soon (within 1 day)
  const payload = decodeJWT(result.accessToken);
  if (payload && payload.exp) {
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const timeUntilExpiry = expirationTime - now;

    if (timeUntilExpiry < oneDay) {
      console.log('[SOS 360] Token expiring soon, refreshing proactively...');
      console.log(`[SOS 360] Time until expiry: ${Math.round(timeUntilExpiry / (1000 * 60 * 60))} hours`);

      const newToken = await refreshAccessToken();
      if (newToken) {
        console.log('[SOS 360] Token refreshed proactively');
        const newPayload = decodeJWT(newToken);
        if (newPayload && newPayload.exp) {
          const newExpiry = new Date(newPayload.exp * 1000);
          console.log('[SOS 360] New token expires at:', newExpiry.toISOString());
        }
      } else {
        console.warn('[SOS 360] Proactive token refresh failed');
      }
    } else {
      console.log('[SOS 360] Token is still valid, no refresh needed');
      const daysRemaining = Math.round(timeUntilExpiry / (1000 * 60 * 60 * 24));
      console.log(`[SOS 360] Token expires in ${daysRemaining} days`);
    }
  }
}

// Listen for token refresh alarm (extends the existing alarm listener)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tokenRefresh') {
    await checkAndRefreshToken();
  }
});

// Also check token on service worker wake
(async () => {
  console.log('[SOS 360] Checking token status on wake...');
  await checkAndRefreshToken();
})();

