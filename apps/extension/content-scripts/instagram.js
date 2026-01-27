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

  function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    script.onerror = () => console.error('[Lia 360] Failed to load:', url);
    document.head.appendChild(script);
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
        // Post overlay would be closed here
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
        if (window.LiaInstagramUI) {
          window.LiaInstagramUI.removePostButtons();
        }
        state.currentPostUrl = null;
      }

      if (username) {
        console.log(`[Lia 360] On Instagram profile: @${username}`);
      }
    }
  }

  // SPA Observer - Instagram is a SPA
  let lastUrl = location.href;
  console.log('[Lia 360] Setting up SPA URL observer. Initial URL:', lastUrl);

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      console.log('[Lia 360] URL changed detected!');
      console.log('[Lia 360] Old URL:', lastUrl);
      console.log('[Lia 360] New URL:', location.href);

      lastUrl = location.href;

      const state = window.LiaInstagramState;
      if (state) {
        state.currentProfileUsername = window.LiaInstagramUtils?.getCurrentProfileUsername();
        state.isPostPage = window.LiaInstagramPost?.isInstagramPostPage();
      }

      console.log('[Lia 360] Re-initializing due to URL change');
      initialize();
    }
  }).observe(document, { subtree: true, childList: true });

  // Post observer to inject buttons
  const postObserver = new MutationObserver(() => {
    const state = window.LiaInstagramState;
    if (state && state.isPostPage && !document.getElementById('sos-post-actions-container')) {
      if (window.LiaInstagramUI) {
        window.LiaInstagramUI.injectPostButtons();
      }
    }
  });
  postObserver.observe(document.body, { childList: true, subtree: true });

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
