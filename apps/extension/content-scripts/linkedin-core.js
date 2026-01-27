/**
 * LinkedIn Core - Lia 360
 * Main entry point, event orchestration, and the fix for `lastUrl` bug.
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading Core module...');

    const Utils = window.LiaUtils;
    const State = window.LiaState;
    const DOM = window.LiaDOM;
    const UI = window.LiaUI;

    if (!Utils || !State || !DOM || !UI) {
        console.error('[Lia 360] Missing dependencies. Check load order.');
        console.error('[Lia 360] Utils:', !!Utils, 'State:', !!State, 'DOM:', !!DOM, 'UI:', !!UI);
        return;
    }

    console.log('[Lia 360] All dependencies OK');
    console.log('[Lia 360] Core Module Loaded');

    // --- Global Variables ---
    let profileMenu = null;
    let lastUrl = location.href; // THE FIX: Declared ONCE here in module scope.
    let autoScrollController = null;

    // --- Event Listener & Cleanup Tracking ---
    let urlObserver = null;
    let beforeUnloadHandler = null;
    let messageListener = null;
    let domContentLoadedHandler = null;
    let overlayTimers = {
        timeout: null,
        idle: null
    };

    // --- Core Logic ---

    /**
     * Check if current page is a connections/search page where overlay should load
     * @param {string} url - Optional URL to check, defaults to current page
     */
    function isConnectionsOrSearchPage(url) {
        const checkUrl = url || window.location.href;
        return checkUrl.includes('/connections/') || checkUrl.includes('/search/results/');
    }

    /**
     * Check if current page is a profile page
     */
    function isProfilePage() {
        const url = window.location.href;
        return url.includes('/in/') && url.match(/\/in\/[^\/]+/);
    }

    /**
     * Cleanup function to clear state and remove event listeners when leaving profile/connection pages
     */
    function cleanup() {
        console.log('[Lia 360] Running cleanup...');

        // Stop any ongoing auto-scroll
        if (autoScrollController) {
            autoScrollController.stop();
            autoScrollController = null;
        }

        // Remove profile menu if it exists
        if (profileMenu) {
            profileMenu.remove();
            profileMenu = null;
        }

        // Remove overlay if it exists
        const overlay = document.getElementById('sos360-linkedin-overlay');
        if (overlay) {
            overlay.remove();
        }

        // Disconnect MutationObserver to prevent memory leaks
        if (urlObserver) {
            urlObserver.disconnect();
            urlObserver = null;
            console.log('[Lia 360] Disconnected URL observer');
        }

        // Remove beforeunload event listener
        if (beforeUnloadHandler) {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            beforeUnloadHandler = null;
            console.log('[Lia 360] Removed beforeunload handler');
        }

        // Remove chrome.runtime.onMessage listener
        if (messageListener) {
            chrome.runtime.onMessage.removeListener(messageListener);
            messageListener = null;
            console.log('[Lia 360] Removed message listener');
        }

        // Cancel any pending timers from overlay initialization
        if (overlayTimers.timeout) {
            clearTimeout(overlayTimers.timeout);
            overlayTimers.timeout = null;
        }
        if (overlayTimers.idle) {
            cancelIdleCallback(overlayTimers.idle);
            overlayTimers.idle = null;
        }

        // Clear state but preserve session storage
        const state = State.get();
        if (state) {
            // Stop auto-scrolling flags
            state.isAutoScrolling = false;
            state.isBulkScanning = false;

            // Clear qualified leads map to free memory
            if (state.qualifiedLeads && typeof state.qualifiedLeads.clear === 'function') {
                state.qualifiedLeads.clear();
            }

            // Clear other large data structures
            state.scannedUrls = new Set();
            state.totalConnectionsFound = 0;
        }

        // Clear any saved state from session storage
        chrome.storage.local.remove(['linkedinState']);

        console.log('[Lia 360] Cleanup complete');
    }

    function detectProfilePage() {
        const isProfile = isProfilePage();

        if (isProfile && !profileMenu) {
            console.log('[Lia 360] Perfil detectado, criando menu');
            profileMenu = new UI.ProfileImportMenu();
        } else if (!isProfile && profileMenu) {
            // Clean up when leaving profile page
            cleanup();
        }
    }

    function initProfileDetection() {
        detectProfilePage();
        checkForSavedState();

        // Check if we're already on a connections/search page on initial load
        if (isConnectionsOrSearchPage()) {
            console.log('[Lia 360] Initial load: connections/search page detected');
            initOverlay();
        }

        // Create and store URL observer for cleanup
        urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                const oldUrl = lastUrl;
                lastUrl = url;
                console.log('[Lia 360] URL changed to:', url);

                // Cleanup if leaving connections/search page
                if (isConnectionsOrSearchPage(oldUrl) && !isConnectionsOrSearchPage(url)) {
                    console.log('[Lia 360] Leaving connections/search page, cleaning up');
                    cleanup();
                }

                detectProfilePage();
                // Also re-init Overlay logic if needed
                if (isConnectionsOrSearchPage()) {
                    console.log('[Lia 360] URL change: connections/search page detected');
                    initOverlay();
                }
            }
        });

        // Observe title element instead of entire body for better performance
        // The title changes on every navigation in SPAs, making it a reliable proxy for URL changes
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
            // Store reference to DOMContentLoaded handler for cleanup
            domContentLoadedHandler = observeUrl;
            document.addEventListener('DOMContentLoaded', domContentLoadedHandler, { once: true });
        } else {
            observeUrl();
        }
    }

    function initOverlay() {
        console.log('[Lia 360] initOverlay() called - starting idle callback card checker');

        // Clear any existing timers before starting new ones
        if (overlayTimers.timeout) {
            clearTimeout(overlayTimers.timeout);
            overlayTimers.timeout = null;
        }
        if (overlayTimers.idle) {
            cancelIdleCallback(overlayTimers.idle);
            overlayTimers.idle = null;
        }

        // Use requestIdleCallback for non-critical background task of checking for cards
        const maxWaitTime = 30000; // 30 seconds max wait
        const startTime = Date.now();

        function checkForCards() {
            // Double-check we're still on a valid page before creating overlay
            if (!isConnectionsOrSearchPage()) {
                console.log('[Lia 360] No longer on connections/search page, stopping card checker');
                return;
            }

            // Check if we've exceeded max wait time
            if (Date.now() - startTime > maxWaitTime) {
                console.log('[Lia 360] Card checker timeout reached');
                return;
            }

            const cards = DOM.findConnectionCards();
            console.log('[Lia 360] Checking for cards... found:', cards.length);
            if (cards.length > 0) {
                console.log('[Lia 360] Cards found! Creating overlay...');
                UI.createOverlay();

                // Load audiences
                UI.loadAudiences();

                // Start button
                const startBtn = document.getElementById('sos-start-btn');
                if (startBtn) {
                    startBtn.onclick = async () => {
                        console.log('[Lia 360] === Starting mining ===');
                        console.log('[Lia 360] Checking for cards on page...');

                        // Check if there are cards on the page first
                        const initialCards = DOM.findConnectionCards();
                        console.log('[Lia 360] Initial cards found:', initialCards.length);

                        if (initialCards.length === 0) {
                            alert('No connection cards found on this page.\n\nPlease navigate to a LinkedIn connections or search results page.');
                            return;
                        }

                        // Debug pagination structure
                        DOM.debugPaginationStructure();

                        const state = State.get();
                        state.isAutoScrolling = true;
                        state.isBulkScanning = true;
                        UI.updateUI();

                        // Get selected audience
                        const audienceSelect = document.getElementById('sos-audience-select');
                        if (audienceSelect?.value) {
                            // Load full audience data
                            const response = await chrome.runtime.sendMessage({
                                action: 'getAudience',
                                data: { id: audienceSelect.value }
                            });
                            if (response?.success) {
                                state.selectedAudience = response.data;
                                console.log('[Lia 360] Audience filter applied:', response.data.name);
                            }
                        }

                        console.log('[Lia 360] Starting auto-scroll controller...');
                        UI.updateScrollStatus('Initializing...', 0);

                        // Start auto-scroll with target count
                        autoScrollController = new DOM.AutoScrollController();
                        await autoScrollController.startAutoScroll({
                            maxScrolls: 100,
                            targetCount: 500, // Target: 500 leads
                            onStop: (reason) => {
                                console.log('[Lia 360] Mining stopped:', reason);
                                state.isAutoScrolling = false;
                                state.isBulkScanning = false;
                                UI.updateUI();
                            }
                        });

                        console.log('[Lia 360] Auto-scroll controller finished');
                    };
                }

                // Test pagination button (for debugging)
                const testPaginationBtn = document.createElement('button');
                testPaginationBtn.className = 'sos-btn';
                testPaginationBtn.style.cssText = 'background: #f59e0b; margin-top: 8px; font-size: 12px; padding: 6px;';
                testPaginationBtn.textContent = '🔍 Test Pagination';
                testPaginationBtn.onclick = async () => {
                    console.log('[Lia 360] === Manual Pagination Test ===');
                    DOM.debugPaginationStructure();

                    const controller = new DOM.AutoScrollController();
                    const clicked = await controller.clickPaginationButton();

                    console.log('[Lia 360] Pagination button clicked:', clicked);

                    if (!clicked) {
                        alert('Pagination button NOT found! Check console for details.');
                    } else {
                        alert('Pagination button clicked successfully! Check console.');
                    }
                };

                const actionsDiv = document.querySelector('#sos360-linkedin-overlay .sos-actions');
                if (actionsDiv) {
                    actionsDiv.appendChild(testPaginationBtn);
                }

                // Stop button
                const stopBtn = document.getElementById('sos-stop-btn');
                if (stopBtn) {
                    stopBtn.onclick = () => {
                        if (autoScrollController) {
                            autoScrollController.stop();
                        }
                        const state = State.get();
                        state.isAutoScrolling = false;
                        state.isBulkScanning = false;
                        UI.updateUI();
                    };
                }

                // Import button
                const importBtn = document.getElementById('sos-import-btn');
                if (importBtn) {
                    importBtn.onclick = () => {
                        const state = State.get();
                        const leads = Array.from(state.qualifiedLeads.values());

                        if (leads.length === 0) {
                            alert('No qualified leads to import');
                            return;
                        }

                        // Use existing PipelineDialog
                        if (!window.LiaUI.pipelineDialog) {
                            window.LiaUI.pipelineDialog = new UI.PipelineDialog();
                        }
                        window.LiaUI.pipelineDialog.open(leads);

                        // Clear state after import (handled by dialog success)
                        window.addEventListener('lia-import-success', async () => {
                            await State.clearState();
                            UI.updateUI();
                        }, { once: true });
                    };
                }

                // Audience selector change
                const audienceSelect = document.getElementById('sos-audience-select');
                if (audienceSelect) {
                    audienceSelect.onchange = async (e) => {
                        const state = State.get();
                        if (e.target.value) {
                            const response = await chrome.runtime.sendMessage({
                                action: 'getAudience',
                                data: { id: e.target.value }
                            });
                            if (response?.success) {
                                state.selectedAudience = response.data;
                            }
                        } else {
                            state.selectedAudience = null;
                        }
                    };
                }

                // Close button
                const closeBtn = document.getElementById('sos-close');
                if (closeBtn) {
                    closeBtn.onclick = () => {
                        document.getElementById(UI.UI_ID).style.display = 'none';
                    };
                }
                return; // Exit checkForCards - overlay created successfully
            }

            // No cards found yet, schedule next check during idle time
            if (typeof requestIdleCallback !== 'undefined') {
                overlayTimers.idle = requestIdleCallback(checkForCards, { timeout: 2000 });
            } else {
                // Fallback for browsers that don't support requestIdleCallback
                overlayTimers.timeout = setTimeout(checkForCards, 1000);
            }
        }

        // Start the idle callback loop
        if (typeof requestIdleCallback !== 'undefined') {
            overlayTimers.idle = requestIdleCallback(checkForCards, { timeout: 2000 });
        } else {
            // Fallback for browsers that don't support requestIdleCallback
            overlayTimers.timeout = setTimeout(checkForCards, 1000);
        }
    }

    async function checkForSavedState() {
        const hasState = await State.restoreState();

        if (hasState) {
            const state = State.get();

            if (state.qualifiedLeads.size > 0) {
                // Only restore overlay if we're on a connections/search page
                if (!isConnectionsOrSearchPage()) {
                    console.log('[Lia 360] Saved state found but not on connections/search page, skipping overlay restore');
                    // Keep the state saved for when user navigates to a valid page
                    return;
                }

                const resume = confirm(
                    `You have ${state.qualifiedLeads.size} qualified leads from a previous session.\n\n` +
                    `Scanned: ${state.totalConnectionsFound} connections\n` +
                    `Resume mining?`
                );

                if (resume) {
                    UI.createOverlay();
                    UI.loadAudiences();
                    UI.updateUI();

                    // Auto-resume scrolling with target count
                    const autoScrollController = new DOM.AutoScrollController();
                    await autoScrollController.startAutoScroll({
                        maxScrolls: 100,
                        targetCount: 500,
                        onStop: (reason) => {
                            state.isAutoScrolling = false;
                            state.isBulkScanning = false;
                            UI.updateUI();
                        }
                    });
                } else {
                    await State.clearState();
                }
            }
        }
    }

    // --- Initialization ---

    if (document.readyState === 'loading') {
        domContentLoadedHandler = initProfileDetection;
        document.addEventListener('DOMContentLoaded', domContentLoadedHandler);
    } else {
        initProfileDetection();
    }

    // --- beforeunload handler (store reference for cleanup) ---
    beforeUnloadHandler = async () => {
        const state = State.get();
        if (state.isAutoScrolling) {
            state.isAutoScrolling = false;
            await State.saveState();
        }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // --- Message Listener (store reference for cleanup) ---
    messageListener = (request, sender, sendResponse) => {
        (async () => {
            if (request.action === 'extractProfile') {
                const p = await DOM.extractCurrentProfile();
                sendResponse({ success: !!p, data: p });
            }
            // ... other handlers
        })();
        return true;
    };
    chrome.runtime.onMessage.addListener(messageListener);

})();
