// Instagram content script - Profile Import Module
// Lia 360 - Version 5.0 (Cloud Browser)
// Handles profile extraction via Cloud Browser tasks
//
// MIGRATION: This module has been transformed to use Cloud Browser tasks
// instead of direct DOM manipulation. All browser automation is now handled
// by Manus.im Cloud Browser API.

(function () {
  'use strict';

  console.log('[Lia 360 Profile] Loading Profile Import module v5.0 (Cloud Browser)...');

  // Cloud Browser dependencies
  const Prompts = window.InstagramPrompts;
  const Mapper = window.LiaInstagramMapper;
  const TaskQueue = window.TaskQueueManager;

  if (!Prompts) {
    console.warn('[Lia 360 Profile] InstagramPrompts not found. Cloud Browser tasks may not work.');
  }

  if (!Mapper) {
    console.warn('[Lia 360 Profile] LiaInstagramMapper not found. Response mapping may not work.');
  }

  if (!TaskQueue) {
    console.warn('[Lia 360 Profile] TaskQueueManager not found. Cloud Browser tasks will not work.');
  }

  // Cloud Browser session ID for Instagram (cached)
  let activeSessionId = null;

  /**
   * Get or create Cloud Browser session for Instagram
   * @returns {Promise<string>} Session ID
   * @private
   */
  async function getInstagramSession() {
    if (activeSessionId) {
      return activeSessionId;
    }

    try {
      // Check if we have a stored session
      const result = await chrome.storage.local.get('instagram_session_id');
      if (result.instagram_session_id) {
        activeSessionId = result.instagram_session_id;
        return activeSessionId;
      }

      // Create new session via background script
      const response = await chrome.runtime.sendMessage({
        action: 'getCloudBrowserSession',
        data: { platform: 'instagram' }
      });

      if (response?.success && response.data?.sessionId) {
        activeSessionId = response.data.sessionId;
        await chrome.storage.local.set({ instagram_session_id: activeSessionId });
        return activeSessionId;
      }

      throw new Error('Failed to get or create Instagram session');
    } catch (error) {
      console.error('[Lia 360 Profile] Error getting Instagram session:', error);
      throw error;
    }
  }

  /**
   * Extract profile stats using Cloud Browser
   * @param {string} profileUrl - The Instagram profile URL
   * @returns {Promise<Object>} Profile stats with postsCount, followersCount, followingCount
   * @deprecated Cloud Browser extracts full profile data, use extractCurrentProfile() instead
   */
  async function extractProfileStats(profileUrl) {
    try {
      if (!Prompts || !Mapper || !TaskQueue) {
        throw new Error('Cloud Browser modules not loaded');
      }

      const sessionId = await getInstagramSession();
      if (!sessionId) {
        throw new Error('No active Instagram session');
      }

      const targetUrl = profileUrl || window.location.href;
      const extractPrompt = Prompts.extractProfile(targetUrl);

      return new Promise((resolve, reject) => {
        TaskQueue.enqueue({
          sessionId,
          prompt: extractPrompt,
          metadata: {
            platform: 'instagram',
            extractionType: 'profile-stats',
            targetUrl
          },
          onSuccess: async (result) => {
            const profile = Mapper.mapToLead(result);
            if (profile) {
              resolve({
                postsCount: profile.postsCount || 0,
                followersCount: profile.followersCount || 0,
                followingCount: profile.followingCount || 0,
                method: 'cloud-browser'
              });
            } else {
              reject(new Error('Failed to map profile response'));
            }
          },
          onFailure: async (error) => {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('[Lia 360 Profile] Error extracting profile stats:', error);
      throw error;
    }
  }

  /**
   * Extract current profile data using Cloud Browser
   * @param {string} profileUrl - Optional Instagram profile URL (defaults to current page)
   * @returns {Promise<Object|null>} Profile data object or null if extraction fails
   */
  async function extractCurrentProfile(profileUrl) {
    try {
      if (!Prompts || !Mapper || !TaskQueue) {
        throw new Error('Cloud Browser modules not loaded');
      }

      const sessionId = await getInstagramSession();
      if (!sessionId) {
        throw new Error('No active Instagram session');
      }

      const targetUrl = profileUrl || window.location.href;
      const extractPrompt = Prompts.extractProfile(targetUrl);

      return new Promise((resolve, reject) => {
        const taskId = TaskQueue.enqueue({
          sessionId,
          prompt: extractPrompt,
          metadata: {
            platform: 'instagram',
            extractionType: 'profile',
            targetUrl
          },
          onSuccess: async (result) => {
            const profile = Mapper.mapToLead(result);
            if (profile) {
              console.log('[Lia 360 Profile] Profile extracted via Cloud Browser:', {
                username: profile.username,
                followersCount: profile.followersCount,
                method: 'cloud-browser'
              });
              resolve(profile);
            } else {
              reject(new Error('Failed to map profile response'));
            }
          },
          onFailure: async (error) => {
            console.error('[Lia 360 Profile] Profile extraction failed:', error);
            reject(error);
          }
        });

        // Poll for task completion with timeout
        let elapsed = 0;
        const pollInterval = 2000; // 2 seconds
        const maxWait = 60000; // 60 seconds timeout

        const pollTimer = setInterval(async () => {
          elapsed += pollInterval;

          const task = TaskQueue.getTask(taskId);
          if (!task) {
            clearInterval(pollTimer);
            reject(new Error('Task not found'));
            return;
          }

          if (task.status === TaskQueue.TaskStatus.COMPLETED) {
            clearInterval(pollTimer);
          } else if (task.status === TaskQueue.TaskStatus.FAILED) {
            clearInterval(pollTimer);
            reject(new Error(task.error || 'Profile extraction failed'));
          } else if (elapsed >= maxWait) {
            clearInterval(pollTimer);
            TaskQueue.cancelTask(taskId);
            reject(new Error('Profile extraction timeout'));
          }
        }, pollInterval);
      });
    } catch (error) {
      console.error('[Lia 360 Profile] Error extracting current profile:', error);
      return null;
    }
  }

  /**
   * Wait for Instagram profile page to fully load
   * In Cloud Browser mode, this is a no-op since Cloud Browser handles page loading
   * @returns {Promise<void>}
   */
  async function waitForInstagramProfile() {
    // Cloud Browser mode: No need to wait for DOM elements
    // Cloud Browser ensures page is loaded before returning results
    console.log('[Lia 360 Profile] Cloud Browser mode: Skipping DOM wait');
    return Promise.resolve();
  }

  /**
   * Create enrichment progress overlay
   * Shows a visual indicator while Cloud Browser task is processing
   * @returns {void}
   */
  function createEnrichmentOverlay() {
    const existing = document.getElementById('sos-enrichment-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sos-enrichment-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span style="font-weight: 600;">Lia 360</span>
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        Extraindo perfil via Cloud Browser...
      </div>
    `;

    document.body.appendChild(overlay);

    // Auto-remove after 30 seconds (safety timeout)
    setTimeout(() => {
      if (document.getElementById('sos-enrichment-overlay')) {
        overlay.remove();
      }
    }, 30000);
  }

  /**
   * Remove enrichment progress overlay
   * @returns {void}
   */
  function removeEnrichmentOverlay() {
    const existing = document.getElementById('sos-enrichment-overlay');
    if (existing) {
      existing.remove();
    }
  }

  // Expose public API
  window.LiaInstagramProfile = {
    extractCurrentProfile,
    extractProfileStats,
    waitForInstagramProfile,
    createEnrichmentOverlay,
    removeEnrichmentOverlay,
    // Cloud Browser specific methods
    getInstagramSession,
  };

  console.log('[Lia 360 Profile] Profile import module loaded v5.0 (Cloud Browser)');
})();
