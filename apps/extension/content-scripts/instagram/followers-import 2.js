// Instagram content script - Followers Import Module
// Lia 360 - Version 5.0 (Cloud Browser)
// Handles followers/following extraction via Cloud Browser tasks
//
// MIGRATION: This module has been transformed to use Cloud Browser tasks
// instead of direct DOM manipulation. All browser automation is now handled
// by Manus.im Cloud Browser API.

(function () {
  'use strict';

  console.log('[Lia 360 Followers] Loading Followers Import module v5.0 (Cloud Browser)...');

  // Cloud Browser dependencies
  const Prompts = window.InstagramPrompts;
  const Mapper = window.LiaInstagramMapper;
  const TaskQueue = window.TaskQueueManager;

  if (!Prompts) {
    console.warn('[Lia 360 Followers] InstagramPrompts not found. Cloud Browser tasks may not work.');
  }

  if (!Mapper) {
    console.warn('[Lia 360 Followers] LiaInstagramMapper not found. Response mapping may not work.');
  }

  if (!TaskQueue) {
    console.warn('[Lia 360 Followers] TaskQueueManager not found. Cloud Browser tasks will not work.');
  }

  // Cloud Browser session ID for Instagram (cached)
  let activeSessionId = null;
  let activeFollowersExtractionTaskId = null;

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
      console.error('[Lia 360 Followers] Error getting Instagram session:', error);
      throw error;
    }
  }

  /**
   * Detect the type of dialog that was opened
   * In Cloud Browser mode, dialog detection is no longer needed
   * Cloud Browser handles page navigation and dialog interaction
   * @deprecated No longer needed in Cloud Browser mode
   */
  function detectDialogType(dialog) {
    console.warn('[Lia 360 Followers] detectDialogType is deprecated in Cloud Browser mode');
  }

  /**
   * Handle dialog close
   * In Cloud Browser mode, dialog close detection is no longer needed
   * @deprecated No longer needed in Cloud Browser mode
   */
  function onDialogClosed() {
    console.warn('[Lia 360 Followers] onDialogClosed is deprecated in Cloud Browser mode');
  }

  /**
   * Start dialog observer
   * In Cloud Browser mode, dialog observation is no longer needed
   * @deprecated No longer needed in Cloud Browser mode
   */
  function startDialogObserver() {
    console.log('[Lia 360 Followers] Cloud Browser mode: Dialog observer not needed');
  }

  /**
   * Stop dialog observer
   * In Cloud Browser mode, dialog observation is no longer needed
   * @deprecated No longer needed in Cloud Browser mode
   */
  function stopDialogObserver() {
    console.log('[Lia 360 Followers] Cloud Browser mode: Dialog observer not needed');
  }

  /**
   * Find dialog scroll container
   * In Cloud Browser mode, scroll container detection is no longer needed
   * @deprecated No longer needed in Cloud Browser mode
   */
  function findDialogScrollContainer() {
    console.warn('[Lia 360 Followers] findDialogScrollContainer is deprecated in Cloud Browser mode');
    return null;
  }

  /**
   * Extract users from dialog with keyword and audience filtering
   * In Cloud Browser mode, use startFollowersScanning instead
   * @deprecated Use startFollowersScanning() for Cloud Browser extraction
   */
  async function extractUsersFromDialog() {
    console.warn('[Lia 360 Followers] extractUsersFromDialog is deprecated in Cloud Browser mode');
    console.warn('[Lia 360 Followers] Use startFollowersScanning() or startFollowingScanning() instead');
    return [];
  }

  /**
   * Start followers scanning with limit using Cloud Browser
   * Creates a Cloud Browser task that handles pagination and extraction
   * @param {string} profileUrl - The Instagram profile URL
   * @param {number} scrollLimit - Maximum number of followers to extract (default: 200)
   * @returns {Promise<Array>} Array of extracted follower profiles
   */
  async function startFollowersScanning(profileUrl, scrollLimit = 200) {
    try {
      if (!Prompts || !Mapper || !TaskQueue) {
        throw new Error('Cloud Browser modules not loaded');
      }

      if (activeFollowersExtractionTaskId) {
        console.log('[Lia 360 Followers] Followers extraction already in progress');
        return [];
      }

      const sessionId = await getInstagramSession();
      if (!sessionId) {
        throw new Error('No active Instagram session');
      }

      const targetUrl = profileUrl || window.location.href;
      const extractPrompt = Prompts.extractFollowers(targetUrl, scrollLimit);

      console.log(`[Lia 360 Followers] Starting followers extraction via Cloud Browser, target: ${scrollLimit}`);

      // Initialize state tracking
      if (window.LiaInstagramState) {
        window.LiaInstagramState.isAutoScrolling = true;
        window.LiaInstagramState.scannedCount = 0;
        window.LiaInstagramState.qualifiedLeads.clear();
        window.LiaInstagramState.totalUsersFound = 0;
        window.LiaInstagramState.followersScrollLimit = scrollLimit;
      }

      return new Promise((resolve, reject) => {
        activeFollowersExtractionTaskId = TaskQueue.enqueue({
          sessionId,
          prompt: extractPrompt,
          metadata: {
            platform: 'instagram',
            extractionType: 'followers',
            targetUrl,
            scrollLimit
          },
          onSuccess: async (result) => {
            // Map and store followers in state
            const followers = Array.isArray(result) ? result : [];

            if (window.LiaInstagramState) {
              for (const follower of followers) {
                const mappedFollower = Mapper.mapToLead(follower);

                if (mappedFollower && mappedFollower.username) {
                  window.LiaInstagramState.qualifiedLeads.set(mappedFollower.username, mappedFollower);
                  window.LiaInstagramState.totalUsersFound++;
                }
              }

              window.LiaInstagramState.isAutoScrolling = false;
              window.LiaInstagramState.scannedCount = window.LiaInstagramState.qualifiedLeads.size;
            }

            activeFollowersExtractionTaskId = null;

            // Update UI if available
            if (window.LiaInstagramUI && window.LiaInstagramUI.updateFollowersStats) {
              window.LiaInstagramUI.updateFollowersStats();
            }

            console.log(`[Lia 360 Followers] Followers extraction complete: ${followers.length} profiles extracted via Cloud Browser`);
            resolve(followers);
          },
          onFailure: async (error) => {
            console.error('[Lia 360 Followers] Followers extraction failed:', error);

            if (window.LiaInstagramState) {
              window.LiaInstagramState.isAutoScrolling = false;
            }

            activeFollowersExtractionTaskId = null;
            reject(error);
          }
        });

        // Poll for task completion with timeout (longer for pagination)
        let elapsed = 0;
        const pollInterval = 2000; // 2 seconds
        const maxWait = 600000; // 10 minutes timeout for pagination

        const pollTimer = setInterval(async () => {
          elapsed += pollInterval;

          const task = TaskQueue.getTask(activeFollowersExtractionTaskId);
          if (!task) {
            clearInterval(pollTimer);
            activeFollowersExtractionTaskId = null;
            reject(new Error('Task not found'));
            return;
          }

          // Update progress in state
          if (window.LiaInstagramState && elapsed > 0 && elapsed % 10000 === 0) {
            // Update every 10 seconds to show progress
            console.log(`[Lia 360 Followers] Followers extraction in progress... (${elapsed / 1000}s elapsed)`);
          }

          if (task.status === TaskQueue.TaskStatus.COMPLETED) {
            clearInterval(pollTimer);
          } else if (task.status === TaskQueue.TaskStatus.FAILED) {
            clearInterval(pollTimer);
            if (window.LiaInstagramState) {
              window.LiaInstagramState.isAutoScrolling = false;
            }
            activeFollowersExtractionTaskId = null;
            reject(new Error(task.error || 'Followers extraction failed'));
          } else if (elapsed >= maxWait) {
            clearInterval(pollTimer);
            TaskQueue.cancelTask(activeFollowersExtractionTaskId);
            if (window.LiaInstagramState) {
              window.LiaInstagramState.isAutoScrolling = false;
            }
            activeFollowersExtractionTaskId = null;
            reject(new Error('Followers extraction timeout'));
          }
        }, pollInterval);
      });
    } catch (error) {
      console.error('[Lia 360 Followers] Error starting followers scanning:', error);

      if (window.LiaInstagramState) {
        window.LiaInstagramState.isAutoScrolling = false;
      }

      activeFollowersExtractionTaskId = null;
      return [];
    }
  }

  /**
   * Start following scanning with limit using Cloud Browser
   * Creates a Cloud Browser task that handles pagination and extraction
   * @param {string} profileUrl - The Instagram profile URL
   * @param {number} scrollLimit - Maximum number of following to extract (default: 200)
   * @returns {Promise<Array>} Array of extracted following profiles
   */
  async function startFollowingScanning(profileUrl, scrollLimit = 200) {
    try {
      if (!Prompts || !Mapper || !TaskQueue) {
        throw new Error('Cloud Browser modules not loaded');
      }

      const sessionId = await getInstagramSession();
      if (!sessionId) {
        throw new Error('No active Instagram session');
      }

      const targetUrl = profileUrl || window.location.href;
      const extractPrompt = Prompts.extractFollowing(targetUrl, scrollLimit);

      console.log(`[Lia 360 Followers] Starting following extraction via Cloud Browser, target: ${scrollLimit}`);

      return new Promise((resolve, reject) => {
        const taskId = TaskQueue.enqueue({
          sessionId,
          prompt: extractPrompt,
          metadata: {
            platform: 'instagram',
            extractionType: 'following',
            targetUrl,
            scrollLimit
          },
          onSuccess: async (result) => {
            // Map and store following in state
            const following = Array.isArray(result) ? result : [];

            console.log(`[Lia 360 Followers] Following extraction complete: ${following.length} profiles extracted via Cloud Browser`);
            resolve(following);
          },
          onFailure: async (error) => {
            console.error('[Lia 360 Followers] Following extraction failed:', error);
            reject(error);
          }
        });

        // Poll for task completion with timeout (longer for pagination)
        let elapsed = 0;
        const pollInterval = 2000; // 2 seconds
        const maxWait = 600000; // 10 minutes timeout for pagination

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
            reject(new Error(task.error || 'Following extraction failed'));
          } else if (elapsed >= maxWait) {
            clearInterval(pollTimer);
            TaskQueue.cancelTask(taskId);
            reject(new Error('Following extraction timeout'));
          }
        }, pollInterval);
      });
    } catch (error) {
      console.error('[Lia 360 Followers] Error starting following scanning:', error);
      return [];
    }
  }

  /**
   * Stop followers scanning
   * Cancels the active Cloud Browser task
   */
  function stopFollowersScanning() {
    if (activeFollowersExtractionTaskId && TaskQueue) {
      console.log('[Lia 360 Followers] Stopping followers scanning...');
      TaskQueue.cancelTask(activeFollowersExtractionTaskId);
      activeFollowersExtractionTaskId = null;
    }

    if (window.LiaInstagramState) {
      window.LiaInstagramState.isAutoScrolling = false;
    }

    if (window.LiaInstagramUI && window.LiaInstagramUI.updateScrollButtonState) {
      window.LiaInstagramUI.updateScrollButtonState(false);
    }

    console.log('[Lia 360 Followers] Followers scanning stopped');
  }

  /**
   * Open followers dialog
   * In Cloud Browser mode, navigation is handled by Cloud Browser prompts
   * @deprecated Use startFollowersScanning() with profile URL instead
   */
  async function openFollowersDialog() {
    console.warn('[Lia 360 Followers] openFollowersDialog is deprecated in Cloud Browser mode');
    console.warn('[Lia 360 Followers] Use startFollowersScanning(profileUrl) instead');
    const profileUrl = window.location.href;
    return startFollowersScanning(profileUrl);
  }

  /**
   * Open following dialog
   * In Cloud Browser mode, navigation is handled by Cloud Browser prompts
   * @deprecated Use startFollowingScanning() with profile URL instead
   */
  async function openFollowingDialog() {
    console.warn('[Lia 360 Followers] openFollowingDialog is deprecated in Cloud Browser mode');
    console.warn('[Lia 360 Followers] Use startFollowingScanning(profileUrl) instead');
    const profileUrl = window.location.href;
    return startFollowingScanning(profileUrl);
  }

  // Expose public API
  window.LiaInstagramFollowers = {
    // Cloud Browser methods
    startFollowersScanning,
    startFollowingScanning,
    stopFollowersScanning,
    getInstagramSession,

    // Deprecated methods (kept for backward compatibility)
    detectDialogType,
    startDialogObserver,
    stopDialogObserver,
    findDialogScrollContainer,
    extractUsersFromDialog,
    openFollowersDialog,
    openFollowingDialog,
  };

  console.log('[Lia 360 Followers] Followers import module loaded v5.0 (Cloud Browser)');
})();
