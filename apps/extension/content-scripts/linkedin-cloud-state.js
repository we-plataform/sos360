/**
 * LinkedIn Cloud State Manager - Lia 360
 * State management and persistence for Cloud Browser
 *
 * Features:
 * - Save/load state to chrome.storage.local
 * - Resume detection after page refresh
 * - Automatic state expiration (30 min)
 */
(function () {
  'use strict';

  console.log('[Lia 360 Cloud] Loading State module...');

  const STORAGE_KEY = 'lia_cloud_browser_state';
  const STATE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

  window.LiaCloudState = {
    state: {
      isActive: false,
      currentUrl: '',
      startTime: null,
      config: {
        keywords: [],
        audienceId: null,
        targetCount: 20,
        maxScrolls: 5,
        scrollDelay: 3,
      },
      progress: {
        scrolledCount: 0,
        qualifiedLeads: [],
        scannedUrls: new Set(),
      },
      pagination: {
        currentPage: 1,
        hasNextPage: false,
        nextButtonUrl: null,
      },
    },

    /**
     * Initialize state manager
     */
    init: async function () {
      // Check if we should resume
      const savedState = await this.load();
      if (savedState && this.shouldResume(savedState)) {
        console.log('[Lia 360 Cloud] Resuming previous session');
        this.state = savedState;

        // Ask user if they want to resume
        const timeElapsed = Date.now() - savedState.timestamp;
        const minutesElapsed = Math.floor(timeElapsed / 60000);

        const shouldResume = confirm(
          `Resume previous scraping session?\n\n` +
          `Started ${minutesElapsed} minutes ago\n` +
          `Qualified leads: ${savedState.progress.qualifiedLeads.length}\n\n` +
          `Click OK to resume or Cancel to start fresh.`
        );

        if (shouldResume) {
          return true; // Resuming
        } else {
          await this.clear();
        }
      }

      // Initialize fresh state
      this.state.currentUrl = window.location.href;
      this.state.startTime = Date.now();
      return false; // Not resuming
    },

    /**
     * Save current state to chrome.storage
     */
    save: async function () {
      const serializableState = {
        isActive: this.state.isActive,
        currentUrl: this.state.currentUrl,
        startTime: this.state.startTime,
        timestamp: Date.now(),
        config: this.state.config,
        progress: {
          scrolledCount: this.state.progress.scrolledCount,
          qualifiedLeads: this.state.progress.qualifiedLeads,
          scannedUrls: Array.from(this.state.progress.scannedUrls),
        },
        pagination: this.state.pagination,
      };

      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ [STORAGE_KEY]: serializableState }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
          console.log('[Lia 360 Cloud] State saved');
        }
      } catch (error) {
        console.error('[Lia 360 Cloud] Error saving state:', error);
      }
    },

    /**
     * Load state from chrome.storage
     */
    load: async function () {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get([STORAGE_KEY], (data) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(data);
              }
            });
          });

          const savedState = result[STORAGE_KEY];
          if (savedState) {
            // Convert scannedUrls back to Set
            savedState.progress.scannedUrls = new Set(savedState.progress.scannedUrls || []);
            return savedState;
          }
        }
      } catch (error) {
        console.error('[Lia 360 Cloud] Error loading state:', error);
      }

      return null;
    },

    /**
     * Clear saved state
     */
    clear: async function () {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await new Promise((resolve, reject) => {
            chrome.storage.local.remove([STORAGE_KEY], () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
          console.log('[Lia 360 Cloud] State cleared');
        }
      } catch (error) {
        console.error('[Lia 360 Cloud] Error clearing state:', error);
      }
    },

    /**
     * Check if we should resume the previous session
     */
    shouldResume: function (savedState) {
      if (!savedState || !savedState.isActive) return false;

      // Check if state is too old
      const age = Date.now() - savedState.timestamp;
      if (age > STATE_MAX_AGE) {
        console.log('[Lia 360 Cloud] State too old, not resuming');
        return false;
      }

      // Check if URL matches
      const currentUrl = window.location.href;
      if (savedState.currentUrl !== currentUrl) {
        console.log('[Lia 360 Cloud] URL changed, not resuming');
        return false;
      }

      return true;
    },

    /**
     * Start a new scraping session
     */
    startSession: function (config) {
      this.state.isActive = true;
      this.state.currentUrl = window.location.href;
      this.state.startTime = Date.now();
      this.state.config = { ...this.state.config, ...config };
      this.state.progress = {
        scrolledCount: 0,
        qualifiedLeads: [],
        scannedUrls: new Set(),
      };
      this.state.pagination = {
        currentPage: 1,
        hasNextPage: false,
        nextButtonUrl: null,
      };

      this.save();
      console.log('[Lia 360 Cloud] Session started:', config);
    },

    /**
     * Stop the current session
     */
    stopSession: async function () {
      this.state.isActive = false;
      await this.save();
      console.log('[Lia 360 Cloud] Session stopped');
    },

    /**
     * Add a qualified lead
     */
    addLead: async function (lead) {
      if (!this.state.isActive) return;

      // Check for duplicates
      const existingIndex = this.state.progress.qualifiedLeads.findIndex(
        l => l.linkedinProfileUrl === lead.linkedinProfileUrl
      );

      if (existingIndex === -1) {
        this.state.progress.qualifiedLeads.push(lead);
        await this.save();
        console.log('[Lia 360 Cloud] Lead added:', lead.name);
      }
    },

    /**
     * Mark a URL as scanned
     */
    markScanned: async function (url) {
      if (!this.state.isActive) return;
      this.state.progress.scannedUrls.add(url);
      this.state.progress.scrolledCount++;
      await this.save();
    },

    /**
     * Check if URL has been scanned
     */
    isScanned: function (url) {
      return this.state.progress.scannedUrls.has(url);
    },

    /**
     * Update pagination info
     */
    updatePagination: async function (paginationData) {
      if (!this.state.isActive) return;
      this.state.pagination = { ...this.state.pagination, ...paginationData };
      await this.save();
    },

    /**
     * Get current session stats
     */
    getStats: function () {
      return {
        isActive: this.state.isActive,
        qualifiedCount: this.state.progress.qualifiedLeads.length,
        scrolledCount: this.state.progress.scrolledCount,
        targetCount: this.state.config.targetCount,
        currentPage: this.state.pagination.currentPage,
        hasNextPage: this.state.pagination.hasNextPage,
      };
    },

    /**
     * Get qualified leads
     */
    getLeads: function () {
      return this.state.progress.qualifiedLeads;
    },

    /**
     * Check if target count has been reached
     */
    isTargetReached: function () {
      return this.state.progress.qualifiedLeads.length >= this.state.config.targetCount;
    },

    /**
     * Reset the session (clear leads but keep config)
     */
    resetSession: async function () {
      this.state.progress = {
        scrolledCount: 0,
        qualifiedLeads: [],
        scannedUrls: new Set(),
      };
      this.state.pagination = {
        currentPage: 1,
        hasNextPage: false,
        nextButtonUrl: null,
      };
      await this.save();
      console.log('[Lia 360 Cloud] Session reset');
    },
  };

  console.log('[Lia 360 Cloud] State module loaded');
})();
