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
async function refreshAccessToken() {
  const result = await chrome.storage.local.get(['refreshToken']);
  if (!result.refreshToken) {
    console.log('[SOS 360] No refresh token available');
    return null;
  }

  try {
    console.log('[SOS 360] Attempting token refresh...');
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
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

        case 'startDeepImport': {
          // Pass criteria for AI analysis if provided
          const criteria = request.data.criteria || '';
          const deepScan = request.data.deepScan || false;
          // FIX: Use explicitly passed tabId or fallback to sender (sender might be popup)
          const targetTabId = request.data.tabId || sender.tab?.id;

          if (!targetTabId) {
            console.error('[Background] No target tab ID for Deep Import');
            sendResponse({ success: false, error: 'No active tab found' });
            return;
          }

          linkedInNavigator.start(request.data.leads, targetTabId, criteria, deepScan);
          sendResponse({ success: true });
          break;
        }

        case 'stopAutoMode': {
          navigator.stop();
          sendResponse({ success: true });
          break;
        }

        case 'startInstagramDeepImport': {
          // Instagram Deep Import with AI analysis
          const instaCriteria = request.data.criteria || '';
          const options = {
            onlyQualified: request.data.onlyQualified !== false,
            minScore: request.data.minScore || 60
          };
          instagramNavigator.start(request.data.leads, sender.tab.id, instaCriteria, options);
          sendResponse({ success: true });
          break;
        }

        case 'stopInstagramDeepImport': {
          instagramNavigator.stop();
          sendResponse({ success: true });
          break;
        }

        case 'analyzeBatch': {
          // Batch analysis with AI
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
