/**
 * LinkedIn Cloud UI - Lia 360
 * Modern control panel for Cloud Browser scraping
 *
 * Features:
 * - 3-tab interface (Configuration, Progress, Results)
 * - Keyword filtering
 * - Audience selection
 * - Pipeline/Stage dialog
 * - Real-time statistics
 * - Import controls
 */
(function () {
  'use strict';

  console.log('[Lia 360 Cloud] Loading UI module...');

  const UI_ID = 'lia-cloud-browser-ui';

  window.LiaCloudUI = {
    state: {
      isOpen: false,
      currentTab: 'config', // config | progress | results
      config: {
        keywords: '',
        audienceId: '',
        targetCount: 20,
        maxScrolls: 5,
        scrollDelay: 3,
      },
      progress: {
        scanned: 0,
        qualified: 0,
        currentScroll: 0,
        isRunning: false,
        logs: [],
      },
      results: {
        leads: [],
        selectedPipeline: null,
        selectedStage: null,
      },
    },

    /**
     * Initialize the control panel
     */
    init: function () {
      this.createButton();
      this.loadAudiences();
      console.log('[Lia 360 Cloud] UI initialized');
    },

    /**
     * Create the main button
     */
    createButton: function () {
      if (document.getElementById('lia-cloud-browser-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'lia-cloud-browser-btn';
      btn.innerHTML = '☁️ Cloud Browser';
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', 'Cloud Browser Control Panel');

      Object.assign(btn.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: '2147483647',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
        transition: 'all 0.2s ease',
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
      });

      btn.addEventListener('click', () => this.open());

      document.body.appendChild(btn);
    },

    /**
     * Open the control panel
     */
    open: function () {
      if (this.state.isOpen) {
        this.close();
        return;
      }

      this.createPanel();
      this.state.isOpen = true;
      this.switchTab('config');
    },

    /**
     * Close the control panel
     */
    close: function () {
      const panel = document.getElementById(UI_ID);
      if (panel) panel.remove();
      this.state.isOpen = false;
    },

    /**
     * Create the control panel dialog
     */
    createPanel: function () {
      if (document.getElementById(UI_ID)) return;

      const panel = document.createElement('div');
      panel.id = UI_ID;
      panel.innerHTML = `
        <div class="lia-overlay-backdrop"></div>
        <div class="lia-panel">
          <div class="lia-panel-header">
            <span class="lia-panel-title">☁️ Cloud Browser</span>
            <button class="lia-close-btn" id="lia-close-panel">&times;</button>
          </div>

          <!-- Tabs -->
          <div class="lia-tabs">
            <button class="lia-tab ${this.state.currentTab === 'config' ? 'active' : ''}" data-tab="config">
              ⚙️ Config
            </button>
            <button class="lia-tab ${this.state.currentTab === 'progress' ? 'active' : ''}" data-tab="progress">
              📊 Progress
            </button>
            <button class="lia-tab ${this.state.currentTab === 'results' ? 'active' : ''}" data-tab="results">
              📦 Results
            </button>
          </div>

          <!-- Tab Content -->
          <div class="lia-panel-body">
            <div class="lia-tab-content" id="lia-tab-config">
              ${this.getConfigTabHTML()}
            </div>
            <div class="lia-tab-content" id="lia-tab-progress" style="display: none;">
              ${this.getProgressTabHTML()}
            </div>
            <div class="lia-tab-content" id="lia-tab-results" style="display: none;">
              ${this.getResultsTabHTML()}
            </div>
          </div>

          ${this.getStyles()}
        </div>
      `;

      document.body.appendChild(panel);
      this.bindEvents();
    },

    /**
     * Get configuration tab HTML
     */
    getConfigTabHTML: function () {
      return `
        <div class="lia-form-group">
          <label>Keywords</label>
          <input type="text" id="lia-keywords-input" placeholder="sales, marketing, founder..."
                 value="${this.state.config.keywords}">
          <small>Separate by comma</small>
        </div>

        <div class="lia-form-group">
          <label>Audience</label>
          <select id="lia-audience-select">
            <option value="">All leads (no filter)</option>
          </select>
        </div>

        <div class="lia-row">
          <div class="lia-form-group" style="flex: 1;">
            <label>Target Count</label>
            <input type="number" id="lia-target-count" value="${this.state.config.targetCount}" min="1" max="100">
          </div>
          <div class="lia-form-group" style="flex: 1;">
            <label>Max Scrolls</label>
            <input type="number" id="lia-max-scrolls" value="${this.state.config.maxScrolls}" min="1" max="20">
          </div>
        </div>

        <div class="lia-form-group">
          <label>Scroll Delay: <span id="lia-delay-value">${this.state.config.scrollDelay}s</span></label>
          <input type="range" id="lia-scroll-delay" min="1" max="5" step="1"
                 value="${this.state.config.scrollDelay}">
        </div>

        <div class="lia-actions">
          <button class="lia-btn lia-btn-primary" id="lia-start-btn">
            ▶️ Start Scraping
          </button>
        </div>
      `;
    },

    /**
     * Get progress tab HTML
     */
    getProgressTabHTML: function () {
      return `
        <div class="lia-stats-grid">
          <div class="lia-stat-card">
            <div class="lia-stat-value" id="lia-scanned-count">0</div>
            <div class="lia-stat-label">Scanned</div>
          </div>
          <div class="lia-stat-card">
            <div class="lia-stat-value" id="lia-qualified-count">0</div>
            <div class="lia-stat-label">Qualified</div>
          </div>
          <div class="lia-stat-card">
            <div class="lia-stat-value" id="lia-progress-percent">0%</div>
            <div class="lia-stat-label">Progress</div>
          </div>
        </div>

        <div class="lia-progress-bar-container">
          <div class="lia-progress-bar" id="lia-progress-bar" style="width: 0%"></div>
        </div>

        <div class="lia-log-container" id="lia-log-container">
          <div class="lia-log-entry">Ready to start...</div>
        </div>

        <div class="lia-actions">
          <button class="lia-btn lia-btn-danger" id="lia-stop-btn">
            ⏹️ Stop Scraping
          </button>
        </div>
      `;
    },

    /**
     * Get results tab HTML
     */
    getResultsTabHTML: function () {
      const leadCount = this.state.results.leads.length;
      return `
        <div class="lia-summary-card">
          <div class="lia-summary-count">${leadCount}</div>
          <div class="lia-summary-label">leads qualified</div>
        </div>

        <div class="lia-preview-section">
          <label>Preview (first 5)</label>
          <div class="lia-preview-list" id="lia-preview-list">
            ${this.getPreviewHTML()}
          </div>
        </div>

        <div class="lia-form-group">
          <label>Destination Pipeline</label>
          <select id="lia-pipeline-select" disabled>
            <option value="">Loading pipelines...</option>
          </select>
        </div>

        <div class="lia-form-group">
          <label>Stage</label>
          <select id="lia-stage-select" disabled>
            <option value="">Select pipeline first</option>
          </select>
        </div>

        <div class="lia-actions">
          <button class="lia-btn lia-btn-secondary" id="lia-back-btn">
            ← Back to Config
          </button>
          <button class="lia-btn lia-btn-success" id="lia-import-btn" disabled>
            📥 Import (${leadCount})
          </button>
        </div>
      `;
    },

    /**
     * Get preview HTML for results tab
     */
    getPreviewHTML: function () {
      const preview = this.state.results.leads.slice(0, 5);
      if (preview.length === 0) {
        return '<div class="lia-empty-state">No leads yet</div>';
      }

      return preview.map(lead => `
        <div class="lia-preview-item">
          <div class="lia-preview-name">${lead.name || 'Unknown'}</div>
          <div class="lia-preview-headline">${lead.headline || lead.bio || 'No headline'}</div>
        </div>
      `).join('');
    },

    /**
     * Bind panel events
     */
    bindEvents: function () {
      const panel = document.getElementById(UI_ID);

      // Close button
      panel.querySelector('#lia-close-panel').addEventListener('click', () => this.close());
      panel.querySelector('.lia-overlay-backdrop').addEventListener('click', () => this.close());

      // Tab switching
      panel.querySelectorAll('.lia-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          this.switchTab(e.target.dataset.tab);
        });
      });

      // Config tab events
      const scrollDelayInput = panel.querySelector('#lia-scroll-delay');
      scrollDelayInput?.addEventListener('input', (e) => {
        this.state.config.scrollDelay = parseInt(e.target.value);
        panel.querySelector('#lia-delay-value').textContent = e.target.value + 's';
      });

      panel.querySelector('#lia-start-btn')?.addEventListener('click', () => {
        this.startScraping();
      });

      // Progress tab events
      panel.querySelector('#lia-stop-btn')?.addEventListener('click', () => {
        this.stopScraping();
      });

      // Results tab events
      panel.querySelector('#lia-back-btn')?.addEventListener('click', () => {
        this.switchTab('config');
      });

      panel.querySelector('#lia-pipeline-select')?.addEventListener('change', (e) => {
        this.state.results.selectedPipeline = e.target.value;
        this.updateStages(e.target.value);
      });

      panel.querySelector('#lia-stage-select')?.addEventListener('change', (e) => {
        this.state.results.selectedStage = e.target.value;
        const importBtn = panel.querySelector('#lia-import-btn');
        importBtn.disabled = !e.target.value;
      });

      panel.querySelector('#lia-import-btn')?.addEventListener('click', () => {
        this.importLeads();
      });
    },

    /**
     * Switch to a different tab
     */
    switchTab: function (tabName) {
      this.state.currentTab = tabName;

      const panel = document.getElementById(UI_ID);
      if (!panel) return;

      // Update tab buttons
      panel.querySelectorAll('.lia-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });

      // Update tab content
      panel.querySelectorAll('.lia-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      const activeTab = panel.querySelector(`#lia-tab-${tabName}`);
      if (activeTab) activeTab.style.display = 'block';

      // Special actions for tabs
      if (tabName === 'results') {
        this.loadPipelines();
      }
    },

    /**
     * Update progress in the UI
     */
    updateProgress: function (data) {
      this.state.progress = { ...this.state.progress, ...data };

      const panel = document.getElementById(UI_ID);
      if (!panel) return;

      // Update stats
      const scannedEl = panel.querySelector('#lia-scanned-count');
      const qualifiedEl = panel.querySelector('#lia-qualified-count');
      const percentEl = panel.querySelector('#lia-progress-percent');
      const progressBar = panel.querySelector('#lia-progress-bar');

      if (scannedEl) scannedEl.textContent = this.state.progress.scanned;
      if (qualifiedEl) qualifiedEl.textContent = this.state.progress.qualified;

      const percent = this.state.config.targetCount > 0
        ? Math.min(100, Math.round((this.state.progress.qualified / this.state.config.targetCount) * 100))
        : 0;
      if (percentEl) percentEl.textContent = percent + '%';
      if (progressBar) progressBar.style.width = percent + '%';

      // Update log
      if (data.log) {
        this.state.progress.logs.push(data.log);
        const logContainer = panel.querySelector('#lia-log-container');
        if (logContainer) {
          const logEntry = document.createElement('div');
          logEntry.className = 'lia-log-entry';
          logEntry.textContent = data.log;
          logContainer.appendChild(logEntry);
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }
    },

    /**
     * Add log entry
     */
    addLog: function (message) {
      this.updateProgress({ log: message });
    },

    /**
     * Load audiences from API
     */
    loadAudiences: async function () {
      try {
        const token = await this.getStorage('accessToken');
        if (!token) return;

        const response = await fetch(`${window.location.origin}/api/v1/audiences`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const select = document.querySelector('#lia-audience-select');
          if (select && data.data) {
            select.innerHTML = '<option value="">All leads (no filter)</option>';
            data.data.forEach(audience => {
              const option = document.createElement('option');
              option.value = audience.id;
              option.textContent = audience.name;
              select.appendChild(option);
            });
          }
        }
      } catch (error) {
        console.error('[Lia 360 Cloud] Error loading audiences:', error);
      }
    },

    /**
     * Load pipelines from API
     */
    loadPipelines: async function () {
      const panel = document.getElementById(UI_ID);
      if (!panel) return;

      const select = panel.querySelector('#lia-pipeline-select');
      if (!select) return;

      select.innerHTML = '<option value="">Loading pipelines...</option>';
      select.disabled = true;

      try {
        const response = await chrome.runtime.sendMessage({ action: 'getPipelines' });
        if (response.success && response.data) {
          select.innerHTML = '<option value="">Select a pipeline</option>';
          response.data.forEach(pipeline => {
            const option = document.createElement('option');
            option.value = pipeline.id;
            option.textContent = pipeline.name + (pipeline.isDefault ? ' ⭐' : '');
            select.appendChild(option);
          });

          const defaultPipeline = response.data.find(p => p.isDefault);
          if (defaultPipeline) {
            select.value = defaultPipeline.id;
            this.state.results.selectedPipeline = defaultPipeline.id;
            this.updateStages(defaultPipeline.id);
          }

          select.disabled = false;
        }
      } catch (error) {
        console.error('[Lia 360 Cloud] Error loading pipelines:', error);
        select.innerHTML = '<option value="">Error loading pipelines</option>';
      }
    },

    /**
     * Update stages dropdown
     */
    updateStages: function (pipelineId) {
      const panel = document.getElementById(UI_ID);
      if (!panel) return;

      const stageSelect = panel.querySelector('#lia-stage-select');
      const importBtn = panel.querySelector('#lia-import-btn');

      if (!pipelineId) {
        stageSelect.innerHTML = '<option value="">Select pipeline first</option>';
        stageSelect.disabled = true;
        importBtn.disabled = true;
        return;
      }

      // Load stages (simplified - in real implementation would cache pipelines)
      chrome.runtime.sendMessage({ action: 'getPipelines' }).then(response => {
        if (response.success && response.data) {
          const pipeline = response.data.find(p => p.id === pipelineId);
          if (pipeline && pipeline.stages) {
            stageSelect.innerHTML = '';
            pipeline.stages.forEach(stage => {
              const option = document.createElement('option');
              option.value = stage.id;
              option.textContent = stage.name;
              stageSelect.appendChild(option);
            });

            stageSelect.disabled = false;
            if (pipeline.stages.length > 0) {
              stageSelect.value = pipeline.stages[0].id;
              this.state.results.selectedStage = pipeline.stages[0].id;
              importBtn.disabled = false;
            }
          }
        }
      });
    },

    /**
     * Start scraping (delegated to main script)
     */
    startScraping: function () {
      const panel = document.getElementById(UI_ID);
      if (!panel) return;

      // Collect config
      this.state.config.keywords = panel.querySelector('#lia-keywords-input').value;
      this.state.config.audienceId = panel.querySelector('#lia-audience-select').value;
      this.state.config.targetCount = parseInt(panel.querySelector('#lia-target-count').value) || 20;
      this.state.config.maxScrolls = parseInt(panel.querySelector('#lia-max-scrolls').value) || 5;
      this.state.config.scrollDelay = parseInt(panel.querySelector('#lia-scroll-delay').value) || 3;

      // Switch to progress tab
      this.switchTab('progress');

      // Trigger scraping in main script
      if (window.LinkedInCloud && window.LinkedInCloud.startScraping) {
        window.LinkedInCloud.startScraping(this.state.config);
      }
    },

    /**
     * Stop scraping (delegated to main script)
     */
    stopScraping: function () {
      if (window.LinkedInCloud && window.LinkedInCloud.stopScraping) {
        window.LinkedInCloud.stopScraping();
      }
    },

    /**
     * Import leads (delegated to main script)
     */
    importLeads: async function () {
      const { leads, selectedStage } = this.state.results;

      if (!selectedStage || leads.length === 0) {
        alert('No leads to import');
        return;
      }

      const importBtn = document.querySelector('#lia-import-btn');
      importBtn.disabled = true;
      importBtn.textContent = '⏳ Importing...';

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'importLeads',
          data: {
            source: 'cloud-browser',
            platform: 'linkedin',
            sourceUrl: window.location.href,
            leads: leads,
            pipelineStageId: selectedStage
          }
        });

        if (response && response.success) {
          alert(`✅ Successfully imported ${leads.length} leads!`);
          this.close();
        } else {
          alert('❌ Import failed: ' + (response?.error || 'Unknown error'));
        }
      } catch (error) {
        alert('❌ Error: ' + error.message);
      } finally {
        importBtn.disabled = false;
        importBtn.textContent = `📥 Import (${leads.length})`;
      }
    },

    /**
     * Show results after scraping completes
     */
    showResults: function (leads) {
      this.state.results.leads = leads;
      this.switchTab('results');

      const panel = document.getElementById(UI_ID);
      if (panel) {
        // Update preview
        const previewList = panel.querySelector('#lia-preview-list');
        if (previewList) {
          previewList.innerHTML = this.getPreviewHTML();
        }

        // Update import button
        const importBtn = panel.querySelector('#lia-import-btn');
        if (importBtn) {
          importBtn.textContent = `📥 Import (${leads.length})`;
        }
      }
    },

    /**
     * Get styles for the panel
     */
    getStyles: function () {
      return `
        <style>
          #${UI_ID} { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483648; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          #${UI_ID} .lia-overlay-backdrop { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); }
          #${UI_ID} .lia-panel { position: relative; background: #1f2937; border-radius: 12px; width: 480px; max-height: 80vh; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; color: white; }
          #${UI_ID} .lia-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #374151; }
          #${UI_ID} .lia-panel-title { font-size: 16px; font-weight: 600; }
          #${UI_ID} .lia-close-btn { background: none; border: none; color: #9ca3af; font-size: 24px; cursor: pointer; padding: 0; line-height: 1; }
          #${UI_ID} .lia-close-btn:hover { color: white; }

          #${UI_ID} .lia-tabs { display: flex; border-bottom: 1px solid #374151; }
          #${UI_ID} .lia-tab { flex: 1; padding: 12px; background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.2s; }
          #${UI_ID} .lia-tab:hover { color: white; }
          #${UI_ID} .lia-tab.active { color: #667eea; border-bottom-color: #667eea; }

          #${UI_ID} .lia-panel-body { padding: 20px; overflow-y: auto; flex: 1; }
          #${UI_ID} .lia-tab-content { display: block; }

          #${UI_ID} .lia-form-group { margin-bottom: 16px; }
          #${UI_ID} .lia-form-group label { display: block; font-size: 12px; font-weight: 600; color: #9ca3af; margin-bottom: 6px; text-transform: uppercase; }
          #${UI_ID} .lia-form-group input[type="text"],
          #${UI_ID} .lia-form-group input[type="number"],
          #${UI_ID} .lia-form-group select {
            width: 100%; padding: 10px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: white; font-size: 14px; box-sizing: border-box;
          }
          #${UI_ID} .lia-form-group input:focus,
          #${UI_ID} .lia-form-group select:focus { outline: none; border-color: #667eea; }
          #${UI_ID} .lia-form-group small { display: block; margin-top: 4px; font-size: 11px; color: #6b7280; }
          #${UI_ID} .lia-row { display: flex; gap: 12px; }
          #${UI_ID} .lia-form-group input[type="range"] { width: 100%; }

          #${UI_ID} .lia-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
          #${UI_ID} .lia-stat-card { background: #111827; padding: 16px; border-radius: 8px; text-align: center; }
          #${UI_ID} .lia-stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
          #${UI_ID} .lia-stat-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; margin-top: 4px; }

          #${UI_ID} .lia-progress-bar-container { height: 8px; background: #374151; border-radius: 4px; overflow: hidden; margin-bottom: 16px; }
          #${UI_ID} .lia-progress-bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s; }

          #${UI_ID} .lia-log-container { background: #111827; border-radius: 6px; padding: 12px; height: 150px; overflow-y: auto; font-family: 'Monaco', 'Courier New', monospace; font-size: 11px; margin-bottom: 16px; }
          #${UI_ID} .lia-log-entry { padding: 4px 0; color: #d1d5db; border-bottom: 1px solid #1f2937; }
          #${UI_ID} .lia-log-entry:last-child { border-bottom: none; }

          #${UI_ID} .lia-summary-card { background: linear-gradient(135deg, #667eea, #764ba2); padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 16px; }
          #${UI_ID} .lia-summary-count { font-size: 48px; font-weight: bold; }
          #${UI_ID} .lia-summary-label { font-size: 14px; opacity: 0.9; }

          #${UI_ID} .lia-preview-section { margin-bottom: 16px; }
          #${UI_ID} .lia-preview-list { background: #111827; border-radius: 6px; overflow: hidden; }
          #${UI_ID} .lia-preview-item { padding: 12px; border-bottom: 1px solid #1f2937; }
          #${UI_ID} .lia-preview-item:last-child { border-bottom: none; }
          #${UI_ID} .lia-preview-name { font-weight: 600; font-size: 14px; }
          #${UI_ID} .lia-preview-headline { font-size: 12px; color: #9ca3af; margin-top: 2px; }
          #${UI_ID} .lia-empty-state { padding: 24px; text-align: center; color: #6b7280; font-size: 13px; }

          #${UI_ID} .lia-actions { display: flex; gap: 8px; margin-top: 16px; }
          #${UI_ID} .lia-btn { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; color: white; transition: opacity 0.2s; }
          #${UI_ID} .lia-btn:hover:not(:disabled) { opacity: 0.9; }
          #${UI_ID} .lia-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          #${UI_ID} .lia-btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); }
          #${UI_ID} .lia-btn-secondary { background: #374151; }
          #${UI_ID} .lia-btn-success { background: #10b981; }
          #${UI_ID} .lia-btn-danger { background: #ef4444; }
        </style>
      `;
    },

    /**
     * Helper: Get value from chrome.storage
     */
    getStorage: function (key) {
      return new Promise((resolve) => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([key], (result) => {
              resolve(result[key] || null);
            });
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('[Lia 360 Cloud] Storage error:', error);
          resolve(null);
        }
      });
    },
  };

  console.log('[Lia 360 Cloud] UI module loaded');
})();
