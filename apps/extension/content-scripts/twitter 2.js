// X/Twitter content script - Main Entry Point
// Lia 360 - Version 5.0 (Cloud Browser)
// This file manages Twitter/X automation via Cloud Browser tasks
//
// MIGRATION: This module has been transformed to use Cloud Browser tasks
// instead of direct DOM manipulation. All browser automation is now handled
// by Manus.im Cloud Browser API.

(function() {
  'use strict';

  console.log('[Lia 360] ========================================');
  console.log('[Lia 360] X/Twitter Content Script Loading v5.0 (Cloud Browser)');
  console.log('[Lia 360] Current URL:', window.location.href);
  console.log('[Lia 360] ========================================');

  // Global error handlers
  window.addEventListener('error', (event) => {
    console.error('[Lia 360] SCRIPT ERROR:', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Lia 360] UNHANDLED PROMISE REJECTION:', event.reason);
  });

  // Visual indicator (debug badge)
  const debugBadge = document.createElement('div');
  debugBadge.id = 'sos360-debug-badge';
  debugBadge.style.cssText = `
    position: fixed !important;
    bottom: 10px !important;
    right: 10px !important;
    background: #1da1f2 !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 4px !important;
    font-family: monospace !important;
    font-size: 11px !important;
    z-index: 999999 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    pointer-events: none !important;
  `;
  debugBadge.textContent = 'SOS360 v5.0 (Cloud Browser) ✓';
  document.documentElement.appendChild(debugBadge);

  // Cloud Browser session ID for Twitter/X
  let activeSessionId = null;

  // --- Cloud Browser Dependencies ---
  const Prompts = window.TwitterPrompts;
  const Mapper = window.LiaTwitterMapper;
  const TaskQueue = window.TaskQueueManager;

  if (!Prompts) {
    console.warn('[Lia 360] TwitterPrompts not found. Cloud Browser tasks may not work.');
  }

  if (!Mapper) {
    console.warn('[Lia 360] LiaTwitterMapper not found. Response mapping may not work.');
  }

  if (!TaskQueue) {
    console.warn('[Lia 360] TaskQueueManager not found. Cloud Browser tasks will not work.');
  }

  /**
   * Get or create Cloud Browser session for Twitter/X
   * @returns {Promise<string>} Session ID
   * @private
   */
  async function getTwitterSession() {
    if (activeSessionId) {
      return activeSessionId;
    }

    try {
      // Check if we have a stored session
      const result = await chrome.storage.local.get('twitter_session_id');
      if (result.twitter_session_id) {
        activeSessionId = result.twitter_session_id;
        return activeSessionId;
      }

      // Create new session via background script
      const response = await chrome.runtime.sendMessage({
        action: 'getCloudBrowserSession',
        data: { platform: 'twitter' }
      });

      if (response?.success && response.data?.sessionId) {
        activeSessionId = response.data.sessionId;
        await chrome.storage.local.set({ twitter_session_id: activeSessionId });
        return activeSessionId;
      }

      throw new Error('Failed to get or create Twitter/X session');
    } catch (error) {
      console.error('[Lia 360] Error getting Twitter/X session:', error);
      throw error;
    }
  }

  /**
   * Extract current Twitter/X profile from URL
   * @returns {object|null} Profile info {username, profileUrl} or null
   * @private
   */
  function getCurrentProfileInfo() {
    const url = window.location.href;

    // Only process profile pages (not home, explore, notifications, etc.)
    if (!url.match(/^https?:\/\/(twitter\.com|x\.com)\/[^\/]+\/?$/)) {
      // Check if it's a profile page with tab (like /with_replies)
      if (!url.match(/^https?:\/\/(twitter\.com|x\.com)\/[^\/]+\/(with_replies|media|likes)\/?$/)) {
        return null;
      }
    }

    // Skip non-profile pages
    const skipPaths = ['/home', '/explore', '/notifications', '/messages', '/i/', '/search', '/settings', '/compose', 'status'];
    if (skipPaths.some(path => url.includes(path))) {
      return null;
    }

    // Extract username from URL
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/').filter(Boolean);
      const username = parts[0] || null;

      if (!username) {
        return null;
      }

      // Normalize URL to twitter.com format
      const profileUrl = `https://twitter.com/${username}`;

      return {
        username,
        profileUrl,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Detect if we're on a tweet/status page
   * @returns {boolean}
   * @private
   */
  function isTweetPage() {
    return window.location.href.includes('/status/') || window.location.href.includes('/status/');
  }

  /**
   * Detect if we're on a followers page
   * @returns {boolean}
   * @private
   */
  function isFollowersPage() {
    const url = window.location.href;
    return (url.includes('/followers') || url.includes('/verified_followers')) && !url.includes('/status/');
  }

  /**
   * Detect if we're on a following page
   * @returns {boolean}
   * @private
   */
  function isFollowingPage() {
    const url = window.location.href;
    return url.includes('/following') && !url.includes('/status/');
  }

  // --- Message Listener (Cloud Browser Mode) ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        switch (request.action) {
          case 'extractLeads': {
            // Cloud Browser: Create extraction task based on page type
            try {
              if (!Prompts || !Mapper || !TaskQueue) {
                sendResponse({ success: false, error: 'Cloud Browser modules not loaded' });
                return;
              }

              const sessionId = await getTwitterSession();
              if (!sessionId) {
                sendResponse({ success: false, error: 'No active Twitter/X session' });
                return;
              }

              const currentUrl = window.location.href;
              let extractPrompt;
              let extractionType;

              // Determine extraction type based on current page
              if (isFollowersPage()) {
                const profileInfo = getCurrentProfileInfo();
                if (!profileInfo) {
                  sendResponse({ success: false, error: 'Cannot determine profile from current page' });
                  return;
                }
                extractPrompt = Prompts.extractFollowers(profileInfo.profileUrl, 100);
                extractionType = 'followers';
              } else if (isFollowingPage()) {
                const profileInfo = getCurrentProfileInfo();
                if (!profileInfo) {
                  sendResponse({ success: false, error: 'Cannot determine profile from current page' });
                  return;
                }
                extractPrompt = Prompts.extractFollowing(profileInfo.profileUrl, 100);
                extractionType = 'following';
              } else {
                // Default to profile extraction
                const profileInfo = getCurrentProfileInfo();
                if (!profileInfo) {
                  sendResponse({ success: false, error: 'Not on a Twitter/X profile page' });
                  return;
                }
                extractPrompt = Prompts.extractProfile(profileInfo.profileUrl);
                extractionType = 'profile';
              }

              const taskId = await TaskQueue.enqueue({
                sessionId,
                prompt: extractPrompt,
                metadata: {
                  platform: 'twitter',
                  extractionType,
                  targetUrl: currentUrl
                },
                onSuccess: async (result) => {
                  // Handle different response types
                  let leads = [];

                  if (Array.isArray(result)) {
                    // Multiple leads (followers, following)
                    leads = result.map(item => Mapper.mapToLead(item)).filter(Boolean);
                  } else {
                    // Single lead (profile)
                    const lead = Mapper.mapToLead(result);
                    leads = lead ? [lead] : [];
                  }

                  sendResponse({ success: true, data: leads });
                },
                onFailure: async (error) => {
                  sendResponse({ success: false, error: error.message });
                }
              });

              // Wait for task completion with polling
              const pollInterval = setInterval(async () => {
                const task = TaskQueue.getTask(taskId);
                if (!task) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: 'Task not found' });
                  return;
                }

                if (task.status === TaskQueue.TaskStatus.COMPLETED) {
                  clearInterval(pollInterval);
                } else if (task.status === TaskQueue.TaskStatus.FAILED) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: task.error || 'Extraction failed' });
                }
              }, 2000);
            } catch (error) {
              console.error('[Lia 360] Cloud Browser extraction error:', error);
              sendResponse({ success: false, error: error.message });
            }
            break;
          }

          case 'extractProfile': {
            // Cloud Browser: Create profile extraction task
            try {
              if (!Prompts || !Mapper || !TaskQueue) {
                sendResponse({ success: false, error: 'Cloud Browser modules not loaded' });
                return;
              }

              const sessionId = await getTwitterSession();
              if (!sessionId) {
                sendResponse({ success: false, error: 'No active Twitter/X session' });
                return;
              }

              const profileInfo = getCurrentProfileInfo();
              if (!profileInfo) {
                sendResponse({ success: false, error: 'Not on a Twitter/X profile page' });
                return;
              }

              const profileUrl = request.data?.profileUrl || profileInfo.profileUrl;
              const extractPrompt = Prompts.extractProfile(profileUrl);

              const taskId = await TaskQueue.enqueue({
                sessionId,
                prompt: extractPrompt,
                metadata: {
                  platform: 'twitter',
                  extractionType: 'profile',
                  targetUrl: profileUrl
                },
                onSuccess: async (result) => {
                  const profile = Mapper.mapToLead(result);
                  sendResponse({ success: !!profile, data: profile });
                },
                onFailure: async (error) => {
                  sendResponse({ success: false, error: error.message });
                }
              });

              // Wait for task completion with polling
              const pollInterval = setInterval(async () => {
                const task = TaskQueue.getTask(taskId);
                if (!task) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: 'Task not found' });
                  return;
                }

                if (task.status === TaskQueue.TaskStatus.COMPLETED) {
                  clearInterval(pollInterval);
                } else if (task.status === TaskQueue.TaskStatus.FAILED) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: task.error || 'Extraction failed' });
                }
              }, 2000);
            } catch (error) {
              console.error('[Lia 360] Cloud Browser profile extraction error:', error);
              sendResponse({ success: false, error: error.message });
            }
            break;
          }

          case 'extractFollowers': {
            // Cloud Browser: Create followers extraction task
            try {
              if (!Prompts || !Mapper || !TaskQueue) {
                sendResponse({ success: false, error: 'Cloud Browser modules not loaded' });
                return;
              }

              const sessionId = await getTwitterSession();
              if (!sessionId) {
                sendResponse({ success: false, error: 'No active Twitter/X session' });
                return;
              }

              const profileInfo = getCurrentProfileInfo();
              if (!profileInfo) {
                sendResponse({ success: false, error: 'Cannot determine profile from current page' });
                return;
              }

              const profileUrl = request.data?.profileUrl || profileInfo.profileUrl;
              const maxFollowers = request.data?.maxFollowers || 100;
              const extractPrompt = Prompts.extractFollowers(profileUrl, maxFollowers);

              const taskId = await TaskQueue.enqueue({
                sessionId,
                prompt: extractPrompt,
                metadata: {
                  platform: 'twitter',
                  extractionType: 'followers',
                  targetUrl: profileUrl,
                  maxCount: maxFollowers
                },
                onSuccess: async (result) => {
                  const followers = Array.isArray(result)
                    ? result.map(item => Mapper.mapToLead(item)).filter(Boolean)
                    : [];
                  sendResponse({ success: true, data: followers });
                },
                onFailure: async (error) => {
                  sendResponse({ success: false, error: error.message });
                }
              });

              // Wait for task completion with polling
              const pollInterval = setInterval(async () => {
                const task = TaskQueue.getTask(taskId);
                if (!task) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: 'Task not found' });
                  return;
                }

                if (task.status === TaskQueue.TaskStatus.COMPLETED) {
                  clearInterval(pollInterval);
                } else if (task.status === TaskQueue.TaskStatus.FAILED) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: task.error || 'Extraction failed' });
                }
              }, 2000);
            } catch (error) {
              console.error('[Lia 360] Cloud Browser followers extraction error:', error);
              sendResponse({ success: false, error: error.message });
            }
            break;
          }

          case 'extractFollowing': {
            // Cloud Browser: Create following extraction task
            try {
              if (!Prompts || !Mapper || !TaskQueue) {
                sendResponse({ success: false, error: 'Cloud Browser modules not loaded' });
                return;
              }

              const sessionId = await getTwitterSession();
              if (!sessionId) {
                sendResponse({ success: false, error: 'No active Twitter/X session' });
                return;
              }

              const profileInfo = getCurrentProfileInfo();
              if (!profileInfo) {
                sendResponse({ success: false, error: 'Cannot determine profile from current page' });
                return;
              }

              const profileUrl = request.data?.profileUrl || profileInfo.profileUrl;
              const maxFollowing = request.data?.maxFollowing || 100;
              const extractPrompt = Prompts.extractFollowing(profileUrl, maxFollowing);

              const taskId = await TaskQueue.enqueue({
                sessionId,
                prompt: extractPrompt,
                metadata: {
                  platform: 'twitter',
                  extractionType: 'following',
                  targetUrl: profileUrl,
                  maxCount: maxFollowing
                },
                onSuccess: async (result) => {
                  const following = Array.isArray(result)
                    ? result.map(item => Mapper.mapToLead(item)).filter(Boolean)
                    : [];
                  sendResponse({ success: true, data: following });
                },
                onFailure: async (error) => {
                  sendResponse({ success: false, error: error.message });
                }
              });

              // Wait for task completion with polling
              const pollInterval = setInterval(async () => {
                const task = TaskQueue.getTask(taskId);
                if (!task) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: 'Task not found' });
                  return;
                }

                if (task.status === TaskQueue.TaskStatus.COMPLETED) {
                  clearInterval(pollInterval);
                } else if (task.status === TaskQueue.TaskStatus.FAILED) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: task.error || 'Extraction failed' });
                }
              }, 2000);
            } catch (error) {
              console.error('[Lia 360] Cloud Browser following extraction error:', error);
              sendResponse({ success: false, error: error.message });
            }
            break;
          }

          case 'extractTweets': {
            // Cloud Browser: Create tweets extraction task
            try {
              if (!Prompts || !Mapper || !TaskQueue) {
                sendResponse({ success: false, error: 'Cloud Browser modules not loaded' });
                return;
              }

              const sessionId = await getTwitterSession();
              if (!sessionId) {
                sendResponse({ success: false, error: 'No active Twitter/X session' });
                return;
              }

              const profileInfo = getCurrentProfileInfo();
              if (!profileInfo) {
                sendResponse({ success: false, error: 'Not on a Twitter/X profile page' });
                return;
              }

              const profileUrl = request.data?.profileUrl || profileInfo.profileUrl;
              const maxTweets = request.data?.maxTweets || 50;
              const extractPrompt = Prompts.extractTweets(profileUrl, maxTweets);

              const taskId = await TaskQueue.enqueue({
                sessionId,
                prompt: extractPrompt,
                metadata: {
                  platform: 'twitter',
                  extractionType: 'tweets',
                  targetUrl: profileUrl,
                  maxCount: maxTweets
                },
                onSuccess: async (result) => {
                  // Tweets are returned as enrichment data, not leads
                  sendResponse({ success: true, data: result || [] });
                },
                onFailure: async (error) => {
                  sendResponse({ success: false, error: error.message });
                }
              });

              // Wait for task completion with polling
              const pollInterval = setInterval(async () => {
                const task = TaskQueue.getTask(taskId);
                if (!task) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: 'Task not found' });
                  return;
                }

                if (task.status === TaskQueue.TaskStatus.COMPLETED) {
                  clearInterval(pollInterval);
                } else if (task.status === TaskQueue.TaskStatus.FAILED) {
                  clearInterval(pollInterval);
                  sendResponse({ success: false, error: task.error || 'Extraction failed' });
                }
              }, 2000);
            } catch (error) {
              console.error('[Lia 360] Cloud Browser tweets extraction error:', error);
              sendResponse({ success: false, error: error.message });
            }
            break;
          }

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[Lia 360] X/Twitter content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  });

  console.log('[Lia 360] X/Twitter content script loaded (v5.0 Cloud Browser)');
})();
