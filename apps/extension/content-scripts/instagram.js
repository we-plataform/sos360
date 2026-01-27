// Instagram content script - Main Entry Point
// Lia 360 - Version 4.0 (Modular)
// This file loads all modules and manages shared state

(function () {
  'use strict';

  console.log('[Lia 360] ========================================');
  console.log('[Lia 360] Instagram Content Script Loading v4.0');
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
    background: #ff6b6b !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 4px !important;
    font-family: monospace !important;
    font-size: 11px !important;
    z-index: 999999 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    pointer-events: none !important;
  `;
  debugBadge.textContent = 'SOS360 v4.0 ✓';
  document.documentElement.appendChild(debugBadge);

  // Rate limiting configuration
  const RATE_LIMIT = {
    maxProfilesPerHour: 40,
    delayMin: 3000,
    delayMax: 8000,
  };

  // --- Shared State ---
  window.LiaInstagramState = {
    // Profile Import State
    qualifiedLeads: new Map(),
    isAutoScrolling: false,
    totalUsersFound: 0,
    keywords: [],
    currentProfileUsername: null,
    criteria: '',
    useAIQualification: false,
    pendingAIBatch: [],
    aiAnalyzing: false,
    batchSize: 20,

    // Post Import State
    isPostPage: false,
    postData: null,
    currentPostUrl: null,
    profilesFromComments: new Map(),
    isAutoScrollingComments: false,
    targetProfileCount: 300,
    profilesScanned: 0,
    commentAuthors: new Map(),

    // Pipeline Import State
    selectedAudience: null,
    pipelines: [],
    selectedPipeline: null,
    selectedStage: null,

    // Followers/Following Dialog State
    dialogDetected: false,
    dialogType: null,
    followersScrollLimit: 300,
    scannedCount: 0,
    audiences: [],
  };

  // --- Load LRU Map utility first (needed for state) ---
  loadScript(chrome.runtime.getURL('content-scripts/lru-map.js'), () => {
    console.log('[Lia 360] LRU Map module loaded');

    // Initialize Maps with LRU wrapper after module loads
    const LRUMap = window.LiaLRUMap?.LRUMap;
    if (LRUMap) {
      // Replace Maps with LRU Maps (max 500 entries each for memory control)
      window.LiaInstagramState.qualifiedLeads = new LRUMap({ maxSize: 500, name: 'InstagramQualifiedLeads' });
      window.LiaInstagramState.commentAuthors = new LRUMap({ maxSize: 500, name: 'InstagramCommentAuthors' });
      console.log('[Lia 360] LRU Maps initialized for qualifiedLeads and commentAuthors');
    } else {
      console.warn('[Lia 360] LRUMap not available, using regular Maps (potential memory leak)');
    }

    // --- Load Modules ---
    const moduleDir = chrome.runtime.getURL('content-scripts/instagram/');

    // Load utility module first (others depend on it)
    loadScript(`${moduleDir}utils.js`, () => {
      console.log('[Lia 360] Utils module loaded');

      // Load feature modules in order
      loadScript(`${moduleDir}profile-import.js`, () => {
        console.log('[Lia 360] Profile import module loaded');

        loadScript(`${moduleDir}post-import.js`, () => {
          console.log('[Lia 360] Post import module loaded');

          loadScript(`${moduleDir}followers-import.js`, () => {
            console.log('[Lia 360] Followers import module loaded');

            loadScript(`${moduleDir}ui.js`, () => {
              console.log('[Lia 360] UI module loaded');

              // All modules loaded, initialize
              initialize();
            });
          });
        });
      });
    });
  });

  function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    script.onerror = () => console.error('[Lia 360] Failed to load:', url);
    document.head.appendChild(script);
  }

  /**
   * Cleanup function to clear state when leaving profile/post pages
   */
  function cleanup() {
    const state = window.LiaInstagramState;
    if (!state) return;

    // Stop any ongoing operations
    state.isAutoScrolling = false;
    state.isAutoScrollingComments = false;

    // Clear profile-specific state
    state.currentProfileUsername = null;
    state.keywords = [];
    state.criteria = '';
    state.useAIQualification = false;

    // Clear post-specific state
    state.isPostPage = false;
    state.postData = null;
    state.currentPostUrl = null;
    state.targetProfileCount = 300;
    state.profilesScanned = 0;

    // Clear Maps to free memory
    if (state.qualifiedLeads && typeof state.qualifiedLeads.clear === 'function') {
      const sizeBefore = state.qualifiedLeads.size;
      state.qualifiedLeads.clear();
      console.log('[Lia 360] Cleanup: cleared qualifiedLeads map (' + sizeBefore + ' entries)');
    }

    if (state.profilesFromComments && typeof state.profilesFromComments.clear === 'function') {
      const sizeBefore = state.profilesFromComments.size;
      state.profilesFromComments.clear();
      console.log('[Lia 360] Cleanup: cleared profilesFromComments map (' + sizeBefore + ' entries)');
    }

    if (state.commentAuthors && typeof state.commentAuthors.clear === 'function') {
      const sizeBefore = state.commentAuthors.size;
      state.commentAuthors.clear();
      console.log('[Lia 360] Cleanup: cleared commentAuthors map (' + sizeBefore + ' entries)');
    }

    // Clear arrays
    state.pendingAIBatch = [];

    // Clear counters
    state.totalUsersFound = 0;
    state.scannedCount = 0;

    // Remove UI overlays
    const overlay = document.getElementById('sos360-instagram-overlay');
    if (overlay) {
      overlay.remove();
    }

    const postButtons = document.getElementById('sos-post-actions-container');
    if (postButtons) {
      postButtons.remove();
    }

    // Stop any AI analysis
    state.aiAnalyzing = false;

    // Clear dialog state
    state.dialogDetected = false;
    state.dialogType = null;

    // Clear any saved state from storage
    chrome.storage.local.remove(['instagramState']);

    console.log('[Lia 360] Cleanup completed');
  }

  /**
   * Initialize the Instagram content script
   */
  function initialize() {
    console.log('[Lia 360] All modules loaded, initializing...');

    const state = window.LiaInstagramState;

    // Start dialog observer
    if (window.LiaInstagramFollowers) {
      window.LiaInstagramFollowers.startDialogObserver();
    }

    const username = window.LiaInstagramUtils?.getCurrentProfileUsername();
    const isPost = window.LiaInstagramPost?.isInstagramPostPage();
    const currentUrl = window.location.href.split('?')[0];

    console.log('[Lia 360] Detection:', { username, isPost, currentUrl });

    state.isPostPage = isPost;
    state.currentProfileUsername = username;

    if (isPost) {
      const previousPostUrl = state.currentPostUrl;

      if (previousPostUrl && previousPostUrl !== currentUrl) {
        console.log('[Lia 360] Navigated to different post');
        // Clean up when navigating to a different post
        cleanup();
      }

      state.currentPostUrl = currentUrl;

      console.log('[Lia 360] On Instagram post page');
      setTimeout(() => {
        if (window.LiaInstagramUI) {
          window.LiaInstagramUI.injectPostButtons();
        }
      }, 2000);
    } else {
      if (state.currentPostUrl) {
        console.log('[Lia 360] Left post page');
        // Clean up when leaving post page
        cleanup();
      }

      if (username) {
        console.log(`[Lia 360] On Instagram profile: @${username}`);
      }
    }
  }

  // SPA Observer - Instagram is a SPA
  let lastUrl = location.href;
  console.log('[Lia 360] Setting up SPA URL observer. Initial URL:', lastUrl);

  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      const oldUrl = lastUrl;
      const newUrl = location.href;

      console.log('[Lia 360] URL changed detected!');
      console.log('[Lia 360] Old URL:', oldUrl);
      console.log('[Lia 360] New URL:', newUrl);

      lastUrl = newUrl;

      // Cleanup when navigating away from profile or post pages
      const state = window.LiaInstagramState;
      if (state) {
        const wasPostPage = state.isPostPage;
        const wasProfilePage = state.currentProfileUsername !== null;

        // Update state for new page
        state.currentProfileUsername = window.LiaInstagramUtils?.getCurrentProfileUsername();
        state.isPostPage = window.LiaInstagramPost?.isInstagramPostPage();

        // If we're leaving a profile/post page and going to a different type of page
        const isNowProfilePage = state.currentProfileUsername !== null;
        const isNowPostPage = state.isPostPage;

        if ((wasPostPage && !isNowPostPage) || (wasProfilePage && !isNowProfilePage && !isNowPostPage)) {
          console.log('[Lia 360] Leaving profile/post page, cleaning up');
          cleanup();
        }
      }

      console.log('[Lia 360] Re-initializing due to URL change');
      initialize();
    }
  });

  // Observe title element instead of entire document for better performance
  const observeUrl = () => {
    const titleElement = document.querySelector('title');
    if (titleElement) {
      urlObserver.observe(titleElement, { subtree: true, childList: true });
    } else {
      // Fallback to observing head if title not available yet
      const headElement = document.head;
      if (headElement) {
        urlObserver.observe(headElement, { childList: true });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeUrl, { once: true });
  } else {
    observeUrl();
  }

  // Post observer to inject buttons
  const postObserver = new MutationObserver(() => {
    const state = window.LiaInstagramState;
    if (state && state.isPostPage && !document.getElementById('sos-post-actions-container')) {
      if (window.LiaInstagramUI) {
        window.LiaInstagramUI.injectPostButtons();
      }
    }
  });

  // Observe main content area instead of entire body for better performance
  const observePostButtons = () => {
    // Target the main article container where posts are rendered
    const mainContainer = document.querySelector('main') || document.querySelector('article') || document.body;
    postObserver.observe(mainContainer, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observePostButtons, { once: true });
  } else {
    observePostButtons();
  }

  console.log('[Lia 360] Calling initial initialize()...');
  initialize();

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        switch (request.action) {
          case 'openOverlay':
            if (window.LiaInstagramUI) {
              window.LiaInstagramUI.createOverlay();
            }
            sendResponse({ success: true });
            break;

          case 'extractLeads':
            const dialog = document.querySelector('div[role="dialog"]');
            const state = window.LiaInstagramState;
            if (dialog && state && state.qualifiedLeads.size > 0) {
              sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
            } else {
              if (window.LiaInstagramProfile) {
                const profile = window.LiaInstagramProfile.extractCurrentProfile();
                sendResponse({ success: !!profile, data: profile ? [profile] : [] });
              } else {
                sendResponse({ success: false, data: [] });
              }
            }
            break;

          case 'extractProfile':
            if (window.LiaInstagramProfile) {
              const p = window.LiaInstagramProfile.extractCurrentProfile();
              sendResponse({ success: !!p, data: p });
            } else {
              sendResponse({ success: false, data: null });
            }
            break;

          case 'extractPostData':
            if (window.LiaInstagramPost) {
              const postData = window.LiaInstagramPost.extractPostData();
              sendResponse({ success: !!postData, data: postData });
            } else {
              sendResponse({ success: false, data: null });
            }
            break;

          case 'extractCommentAuthors':
            if (window.LiaInstagramPost) {
              const authors = window.LiaInstagramPost.extractCommentAuthors();
              sendResponse({ success: true, data: authors, count: authors.length });
            } else {
              sendResponse({ success: false, data: [], count: 0 });
            }
            break;

          case 'startCommentAutoScroll':
            if (window.LiaInstagramPost) {
              const targetCount = request.data?.targetCount || 300;
              window.LiaInstagramPost.startCommentAutoScroll(targetCount);
            }
            sendResponse({ success: true });
            break;

          case 'stopCommentAutoScroll':
            if (window.LiaInstagramPost) {
              window.LiaInstagramPost.stopCommentAutoScroll();
            }
            sendResponse({ success: true });
            break;

          case 'enrichInstagramProfile': {
            console.log('[Lia 360] Enriching Instagram profile:', request.data?.username);

            try {
              if (window.LiaInstagramProfile) {
                window.LiaInstagramProfile.createEnrichmentOverlay();
              }

              try {
                if (window.LiaInstagramProfile) {
                  await window.LiaInstagramProfile.waitForInstagramProfile();
                }
              } catch (loadError) {
                console.warn('[Lia 360] Profile load check failed, attempting anyway:', loadError.message);
              }

              if (window.LiaInstagramProfile) {
                const profileData = window.LiaInstagramProfile.extractCurrentProfile();

                if (profileData) {
                  console.log('[Lia 360] Profile data extracted successfully');
                  sendResponse({
                    success: true,
                    profile: profileData
                  });
                } else {
                  sendResponse({
                    success: false,
                    error: 'Failed to extract profile data'
                  });
                }
              } else {
                sendResponse({
                  success: false,
                  error: 'Profile module not loaded'
                });
              }
            } catch (error) {
              console.error('[Lia 360] Error enriching profile:', error);
              sendResponse({
                success: false,
                error: error.message
              });
            }
            break;
          }

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[Lia 360] Instagram content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  });

  console.log('[Lia 360] Instagram Script v4.0 Loaded (Modular)');
})();
