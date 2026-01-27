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

    // --- Core Logic ---

    function detectProfilePage() {
        const url = window.location.href;
        const isProfile = url.includes('/in/') && url.match(/\/in\/[^\/]+/);

        if (isProfile && !profileMenu) {
            console.log('[Lia 360] Perfil detectado, criando menu');
            profileMenu = new UI.ProfileImportMenu();
        } else if (!isProfile && profileMenu) {
            profileMenu.remove();
            profileMenu = null;
        }
    }

    function initProfileDetection() {
        detectProfilePage();
        checkForSavedState();

        // Check if we're already on a connections/search page on initial load
        const currentUrl = location.href;
        if (currentUrl.includes('/connections/') || currentUrl.includes('/search/results/')) {
            console.log('[Lia 360] Initial load: connections/search page detected');
            initOverlay();
        }

        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                console.log('[Lia 360] URL changed to:', url);
                detectProfilePage();
                // Also re-init Overlay logic if needed
                if (url.includes('/connections/') || url.includes('/search/results/')) {
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
            const cards = DOM.findConnectionCards();
            console.log('[Lia 360] Polling for cards... found:', cards.length);
            if (cards.length > 0) {
                clearInterval(poller);
                console.log('[Lia 360] Cards found! Creating overlay...');
                UI.createOverlay();

                // Load audiences
                UI.loadAudiences();

                // Initialize auto-scroll controller
                let autoScrollController = null;

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
