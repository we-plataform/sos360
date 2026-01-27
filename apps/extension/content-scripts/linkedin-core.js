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
     * Cleanup function to clear state when leaving profile/connection pages
     */
    function cleanup() {
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

        const urlObserver = new MutationObserver(() => {
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

        if (document.body) {
            urlObserver.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                urlObserver.observe(document.body, { childList: true, subtree: true });
            }, { once: true });
        }
    }

    function initOverlay() {
        console.log('[Lia 360] initOverlay() called - starting card poller');
        // Polling for connection cards to show extraction overlay
        const poller = setInterval(() => {
            // Double-check we're still on a valid page before creating overlay
            if (!isConnectionsOrSearchPage()) {
                console.log('[Lia 360] No longer on connections/search page, stopping poller');
                clearInterval(poller);
                return;
            }

            const cards = DOM.findConnectionCards();
            console.log('[Lia 360] Polling for cards... found:', cards.length);
            if (cards.length > 0) {
                clearInterval(poller);
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
            }
        }, 1000);
        setTimeout(() => clearInterval(poller), 30000);
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
        document.addEventListener('DOMContentLoaded', initProfileDetection);
    } else {
        initProfileDetection();
    }

    // --- beforeunload handler ---
    window.addEventListener('beforeunload', async () => {
        const state = State.get();
        if (state.isAutoScrolling) {
            state.isAutoScrolling = false;
            await State.saveState();
        }
    });

    // --- Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        (async () => {
            if (request.action === 'extractProfile') {
                const p = await DOM.extractCurrentProfile();
                sendResponse({ success: !!p, data: p });
            }
            // ... other handlers
        })();
        return true;
    });

})();
