// Instagram content script - Post Import Module
// Lia 360 - Version 5.0 (Cloud Browser)
// Handles post data extraction and comment author extraction via Cloud Browser tasks
//
// MIGRATION: This module has been transformed to use Cloud Browser tasks
// instead of direct DOM manipulation. All browser automation is now handled
// by Manus.im Cloud Browser API.

(function () {
  'use strict';

  console.log('[Lia 360 Post] Loading Post Import module v5.0 (Cloud Browser)...');

  // Cloud Browser dependencies
  const Prompts = window.InstagramPrompts;
  const Mapper = window.LiaInstagramMapper;
  const TaskQueue = window.TaskQueueManager;

  if (!Prompts) {
    console.warn('[Lia 360 Post] InstagramPrompts not found. Cloud Browser tasks may not work.');
  }

  if (!Mapper) {
    console.warn('[Lia 360 Post] LiaInstagramMapper not found. Response mapping may not work.');
  }

  if (!TaskQueue) {
    console.warn('[Lia 360 Post] TaskQueueManager not found. Cloud Browser tasks will not work.');
  }

  // Cloud Browser session ID for Instagram (cached)
  let activeSessionId = null;
  let activeCommentExtractionTaskId = null;

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
      console.error('[Lia 360 Post] Error getting Instagram session:', error);
      throw error;
    }
  }

  /**
   * Detects if current page is an Instagram post page
   * In Cloud Browser mode, this still checks local URL (no Cloud Browser task needed)
   */
  function isInstagramPostPage() {
    return /\/p\/[\w-]+\/?$/.test(window.location.pathname);
  }

  /**
   * Extracts post data from Instagram post page using Cloud Browser
   * @param {string} postUrl - Optional post URL (defaults to current page)
   * @returns {Promise<Object|null>} Post data object or null if extraction fails
   */
  async function extractPostData(postUrl) {
    try {
      if (!Prompts || !TaskQueue) {
        throw new Error('Cloud Browser modules not loaded');
      }

      const sessionId = await getInstagramSession();
      if (!sessionId) {
        throw new Error('No active Instagram session');
      }

      const targetUrl = postUrl || window.location.href;
      const extractPrompt = Prompts.extractSinglePost(targetUrl);

      return new Promise((resolve, reject) => {
        const taskId = TaskQueue.enqueue({
          sessionId,
          prompt: extractPrompt,
          metadata: {
            platform: 'instagram',
            extractionType: 'post',
            targetUrl
          },
          onSuccess: async (result) => {
            // Map Manus response to post data format
            const postData = {
              postUrl: result.postUrl || targetUrl,
              caption: result.caption || '',
              imageUrls: result.imageUrls || [],
              videoUrl: result.videoUrl || null,
              likesCount: result.likesCount || 0,
              commentsCount: result.commentsCount || 0,
              authorUsername: result.authorUsername || null,
              authorFullName: result.authorFullName || null,
              authorAvatarUrl: result.authorAvatarUrl || null,
              authorVerified: result.authorVerified || false,
              postType: result.postType || 'unknown',
              postedAt: result.postedAt || null,
              extractedAt: new Date().toISOString(),
              method: 'cloud-browser'
            };

            console.log('[Lia 360 Post] Post data extracted via Cloud Browser:', {
              postUrl: postData.postUrl,
              author: postData.authorUsername,
              likesCount: postData.likesCount,
              method: 'cloud-browser'
            });

            resolve(postData);
          },
          onFailure: async (error) => {
            console.error('[Lia 360 Post] Post extraction failed:', error);
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
            reject(new Error(task.error || 'Post extraction failed'));
          } else if (elapsed >= maxWait) {
            clearInterval(pollTimer);
            TaskQueue.cancelTask(taskId);
            reject(new Error('Post extraction timeout'));
          }
        }, pollInterval);
      });
    } catch (error) {
      console.error('[Lia 360 Post] Error extracting post data:', error);
      return null;
    }
  }

  /**
   * Extracts comment authors from Instagram post using Cloud Browser
   * @param {string} postUrl - Optional post URL (defaults to current page)
   * @param {number} maxComments - Maximum number of comment authors to extract
   * @returns {Promise<Array>} Array of comment author data objects
   */
  async function extractCommentAuthors(postUrl, maxComments = 50) {
    try {
      if (!Prompts || !Mapper || !TaskQueue) {
        throw new Error('Cloud Browser modules not loaded');
      }

      const sessionId = await getInstagramSession();
      if (!sessionId) {
        throw new Error('No active Instagram session');
      }

      const targetUrl = postUrl || window.location.href;
      const extractPrompt = Prompts.extractCommentAuthors(targetUrl, maxComments);

      return new Promise((resolve, reject) => {
        const taskId = TaskQueue.enqueue({
          sessionId,
          prompt: extractPrompt,
          metadata: {
            platform: 'instagram',
            extractionType: 'comment-authors',
            targetUrl,
            maxComments
          },
          onSuccess: async (result) => {
            // Map Manus response to comment authors format
            const commentAuthors = Array.isArray(result) ? result : [];

            const mappedAuthors = commentAuthors.map(author => ({
              username: author.username || null,
              fullName: author.fullName || author.username || null,
              avatarUrl: author.profilePictureUrl || author.avatarUrl || null,
              profileUrl: author.profileUrl || `https://instagram.com/${author.username}`,
              platform: 'instagram',
              commentText: author.commentText || '',
              followersCount: author.followerCount || null,
              isFromComment: true,
              verified: author.verified || false
            }));

            console.log(`[Lia 360 Post] Extracted ${mappedAuthors.length} comment authors via Cloud Browser`);
            resolve(mappedAuthors);
          },
          onFailure: async (error) => {
            console.error('[Lia 360 Post] Comment authors extraction failed:', error);
            reject(error);
          }
        });

        // Poll for task completion with timeout (longer for comment extraction)
        let elapsed = 0;
        const pollInterval = 2000; // 2 seconds
        const maxWait = 180000; // 3 minutes timeout for comment extraction

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
            reject(new Error(task.error || 'Comment authors extraction failed'));
          } else if (elapsed >= maxWait) {
            clearInterval(pollTimer);
            TaskQueue.cancelTask(taskId);
            reject(new Error('Comment authors extraction timeout'));
          }
        }, pollInterval);
      });
    } catch (error) {
      console.error('[Lia 360 Post] Error extracting comment authors:', error);
      return [];
    }
  }

  /**
   * Starts auto-scroll through comments using Cloud Browser
   * This creates a Cloud Browser task that handles scrolling and extraction
   * @param {number} targetCount - Target number of comment authors to extract
   * @returns {Promise<void>}
   */
  async function startCommentAutoScroll(targetCount = 300) {
    try {
      if (!Prompts || !Mapper || !TaskQueue) {
        throw new Error('Cloud Browser modules not loaded');
      }

      if (activeCommentExtractionTaskId) {
        console.log('[Lia 360 Post] Comment auto-scroll already in progress');
        return;
      }

      const sessionId = await getInstagramSession();
      if (!sessionId) {
        throw new Error('No active Instagram session');
      }

      const targetUrl = window.location.href;
      const extractPrompt = Prompts.extractCommentAuthors(targetUrl, targetCount);

      console.log(`[Lia 360 Post] Starting comment auto-scroll via Cloud Browser, target: ${targetCount}`);

      // Initialize state tracking
      if (window.LiaInstagramState) {
        window.LiaInstagramState.isAutoScrollingComments = true;
        window.LiaInstagramState.targetProfileCount = targetCount;
        window.LiaInstagramState.profilesScanned = 0;
      }

      return new Promise((resolve, reject) => {
        activeCommentExtractionTaskId = TaskQueue.enqueue({
          sessionId,
          prompt: extractPrompt,
          metadata: {
            platform: 'instagram',
            extractionType: 'comment-authors-scroll',
            targetUrl,
            targetCount
          },
          onSuccess: async (result) => {
            // Map and store comment authors in state
            const commentAuthors = Array.isArray(result) ? result : [];

            if (window.LiaInstagramState) {
              for (const author of commentAuthors) {
                const mappedAuthor = Mapper.mapToLead({
                  username: author.username,
                  fullName: author.fullName,
                  profilePictureUrl: author.profilePictureUrl,
                  profileUrl: author.profileUrl,
                  verified: author.verified,
                  followerCount: author.followerCount,
                  bio: author.commentText // Store comment text as bio for context
                });

                if (mappedAuthor && mappedAuthor.username) {
                  window.LiaInstagramState.commentAuthors.set(mappedAuthor.username, mappedAuthor);
                }
              }

              window.LiaInstagramState.isAutoScrollingComments = false;
              window.LiaInstagramState.profilesScanned = window.LiaInstagramState.commentAuthors.size;
            }

            activeCommentExtractionTaskId = null;

            console.log(`[Lia 360 Post] Comment auto-scroll complete: ${commentAuthors.length} profiles extracted via Cloud Browser`);
            resolve();
          },
          onFailure: async (error) => {
            console.error('[Lia 360 Post] Comment auto-scroll failed:', error);

            if (window.LiaInstagramState) {
              window.LiaInstagramState.isAutoScrollingComments = false;
            }

            activeCommentExtractionTaskId = null;
            reject(error);
          }
        });

        // Poll for task completion with timeout (longer for auto-scroll)
        let elapsed = 0;
        const pollInterval = 2000; // 2 seconds
        const maxWait = 600000; // 10 minutes timeout for auto-scroll

        const pollTimer = setInterval(async () => {
          elapsed += pollInterval;

          const task = TaskQueue.getTask(activeCommentExtractionTaskId);
          if (!task) {
            clearInterval(pollTimer);
            activeCommentExtractionTaskId = null;
            reject(new Error('Task not found'));
            return;
          }

          // Update progress in state
          if (window.LiaInstagramState && elapsed > 0 && elapsed % 10000 === 0) {
            // Update every 10 seconds to show progress
            console.log(`[Lia 360 Post] Comment auto-scroll in progress... (${elapsed / 1000}s elapsed)`);
          }

          if (task.status === TaskQueue.TaskStatus.COMPLETED) {
            clearInterval(pollTimer);
          } else if (task.status === TaskQueue.TaskStatus.FAILED) {
            clearInterval(pollTimer);
            if (window.LiaInstagramState) {
              window.LiaInstagramState.isAutoScrollingComments = false;
            }
            activeCommentExtractionTaskId = null;
            reject(new Error(task.error || 'Comment auto-scroll failed'));
          } else if (elapsed >= maxWait) {
            clearInterval(pollTimer);
            TaskQueue.cancelTask(activeCommentExtractionTaskId);
            if (window.LiaInstagramState) {
              window.LiaInstagramState.isAutoScrollingComments = false;
            }
            activeCommentExtractionTaskId = null;
            reject(new Error('Comment auto-scroll timeout'));
          }
        }, pollInterval);
      });
    } catch (error) {
      console.error('[Lia 360 Post] Error starting comment auto-scroll:', error);

      if (window.LiaInstagramState) {
        window.LiaInstagramState.isAutoScrollingComments = false;
      }

      activeCommentExtractionTaskId = null;
    }
  }

  /**
   * Stops the comment auto-scroll
   * Cancels the active Cloud Browser task
   */
  function stopCommentAutoScroll() {
    if (activeCommentExtractionTaskId && TaskQueue) {
      console.log('[Lia 360 Post] Stopping comment auto-scroll...');
      TaskQueue.cancelTask(activeCommentExtractionTaskId);
      activeCommentExtractionTaskId = null;
    }

    if (window.LiaInstagramState) {
      window.LiaInstagramState.isAutoScrollingComments = false;
      console.log('[Lia 360 Post] Comment auto-scroll stopped');
    }
  }

  // Expose public API
  window.LiaInstagramPost = {
    isInstagramPostPage,
    extractPostData,
    extractCommentAuthors,
    startCommentAutoScroll,
    stopCommentAutoScroll,
    // Cloud Browser specific methods
    getInstagramSession,
  };

  console.log('[Lia 360 Post] Post import module loaded v5.0 (Cloud Browser)');
})();
