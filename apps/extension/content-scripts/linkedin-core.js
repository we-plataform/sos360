/**
 * LinkedIn Core - Lia 360
 * Main entry point, event orchestration, and the fix for `lastUrl` bug.
 */
<<<<<<< HEAD
// V2 Automation Imports (Static for Bundling)
import { StateMachine } from './automation/core/StateMachine.js';
import { LinkedInConnectionMiningConfig } from './automation/sites/linkedin/config.js';

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
    let engine = null; // Singleton automation instance
    let isAutomationMode = false; // Flag to track if we're in automation mode
    let profileMenuCreationPending = false; // Flag to prevent duplicate menu creation

    // --- Core Logic ---

    // Check if this tab is part of an automation on startup
    // Uses multiple strategies to detect automation mode reliably
    async function checkAutomationState() {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            const state = result.automationState;

            if (state && state.status === 'RUNNING') {
                const currentTabId = await getCurrentTabId();

                // Strategy 1: Check if tabId matches (for existing tabs)
                if (currentTabId && state.tabId === currentTabId) {
                    console.log('[Lia 360] This tab is the automation tab (tabId match)');
                    isAutomationMode = true;
                    return true;
                }

                // Strategy 2: Check if automation just started and tab is being created
                // (tabId might be null or different during window creation race condition)
                if (state.pendingTabCreation === true) {
                    console.log('[Lia 360] Automation pending tab creation, suppressing ProfileImportMenu');
                    isAutomationMode = true;
                    return true;
                }

                // Strategy 3: If automation is RUNNING and we're on a LinkedIn profile,
                // check if the current URL matches the expected lead profile URL
                if (state.currentLead && state.currentLead.profileUrl) {
                    const currentUrl = window.location.href;
                    const expectedUrl = state.currentLead.profileUrl;
                    // Normalize URLs for comparison (remove trailing slashes, query params)
                    const normalizeUrl = (url) => url.split('?')[0].replace(/\/$/, '').toLowerCase();
                    if (normalizeUrl(currentUrl).includes(normalizeUrl(expectedUrl).split('/in/')[1]?.split('/')[0] || '')) {
                        console.log('[Lia 360] URL matches automation lead, suppressing ProfileImportMenu');
                        isAutomationMode = true;
                        return true;
                    }
                }

                // Strategy 4: Check windowId if available
                if (state.windowId) {
                    try {
                        const windowInfo = await getWindowId();
                        if (windowInfo && windowInfo === state.windowId) {
                            console.log('[Lia 360] Window ID matches automation window');
                            isAutomationMode = true;
                            return true;
                        }
                    } catch (e) {
                        // Ignore window check errors
                    }
                }
            }
        } catch (e) {
            console.log('[Lia 360] Could not check automation state:', e);
        }
        return false;
    }

    // Get current tab ID via background script
    async function getCurrentTabId() {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    } else {
                        resolve(response?.tabId || null);
                    }
                });
            } catch (e) {
                resolve(null);
            }
        });
    }

    // Get current window ID via background script
    async function getWindowId() {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ action: 'getWindowId' }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    } else {
                        resolve(response?.windowId || null);
                    }
                });
            } catch (e) {
                resolve(null);
            }
        });
    }

=======

    // --- Core Logic ---

>>>>>>> origin/main
    function detectProfilePage() {
        const url = window.location.href;
        const isProfile = url.includes('/in/') && url.match(/\/in\/[^\/]+/);

<<<<<<< HEAD
        // Don't create ProfileImportMenu if automation is active (either overlay visible or automation mode flag)
        if (isAutomationMode || (UI.isAutomationActive && UI.isAutomationActive())) {
            console.log('[Lia 360] Automation active, skipping ProfileImportMenu');
            if (profileMenu) {
                profileMenu.remove();
                profileMenu = null;
            }
            return;
        }

        if (isProfile && !profileMenu && !profileMenuCreationPending) {
            // Delay menu creation to allow SHOW_OVERLAY message to arrive first
            // This prevents the race condition where the import menu shows briefly before automation overlay
            profileMenuCreationPending = true;
            console.log('[Lia 360] Profile detected, scheduling menu creation with delay...');

            setTimeout(async () => {
                // Re-check automation state before creating menu
                const stillInAutomation = await checkAutomationState();

                if (stillInAutomation || isAutomationMode || (UI.isAutomationActive && UI.isAutomationActive())) {
                    console.log('[Lia 360] Automation detected during delay, skipping ProfileImportMenu');
                    profileMenuCreationPending = false;
                    return;
                }

                // Double-check URL hasn't changed
                const currentUrl = window.location.href;
                const stillIsProfile = currentUrl.includes('/in/') && currentUrl.match(/\/in\/[^\/]+/);

                if (stillIsProfile && !profileMenu && !isAutomationMode) {
                    console.log('[Lia 360] Creating ProfileImportMenu after delay');
                    profileMenu = new UI.ProfileImportMenu();
                }
                profileMenuCreationPending = false;
            }, 1500); // 1.5 second delay to allow SHOW_OVERLAY to arrive

=======
        if (isProfile && !profileMenu) {
            console.log('[Lia 360] Perfil detectado, criando menu');
            profileMenu = new UI.ProfileImportMenu();
>>>>>>> origin/main
        } else if (!isProfile && profileMenu) {
            profileMenu.remove();
            profileMenu = null;
        }
    }

<<<<<<< HEAD
    async function initProfileDetection() {
        // First check if we're in automation mode - this prevents ProfileImportMenu from appearing
        await checkAutomationState();

        // Only detect profile page and create menu if NOT in automation mode
        if (!isAutomationMode) {
            detectProfilePage();
            checkForSavedState();
        } else {
            console.log('[Lia 360] Skipping profile detection - in automation mode');
        }

        // Check if we're already on a connections/search page on initial load
        const currentUrl = location.href;
        if (!isAutomationMode && (currentUrl.includes('/connections/') || currentUrl.includes('/search/results/'))) {
=======
    function initProfileDetection() {
        detectProfilePage();
        checkForSavedState();

        // Check if we're already on a connections/search page on initial load
        const currentUrl = location.href;
        if (currentUrl.includes('/connections/') || currentUrl.includes('/search/results/')) {
>>>>>>> origin/main
            console.log('[Lia 360] Initial load: connections/search page detected');
            initOverlay();
        }

        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                console.log('[Lia 360] URL changed to:', url);
<<<<<<< HEAD
                if (!isAutomationMode) {
                    detectProfilePage();
                }
                // Also re-init Overlay logic if needed
                if (!isAutomationMode && (url.includes('/connections/') || url.includes('/search/results/'))) {
=======
                detectProfilePage();
                // Also re-init Overlay logic if needed
                if (url.includes('/connections/') || url.includes('/search/results/')) {
>>>>>>> origin/main
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

<<<<<<< HEAD
                // V2 STATE MACHINE ENGINE
                // engine is now global


=======
>>>>>>> origin/main
                // Start button
                const startBtn = document.getElementById('sos-start-btn');
                if (startBtn) {
                    startBtn.onclick = async () => {
<<<<<<< HEAD
                        console.log('[Lia 360] === Starting LOCAL Automation v2 ===');

                        if (!engine) {
                            engine = new StateMachine(LinkedInConnectionMiningConfig);
                        }

                        // Update UI
                        UI.updateScrollStatus('Local Automation Starting...', 0);
=======
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
>>>>>>> origin/main

                        const state = State.get();
                        state.isAutoScrolling = true;
                        state.isBulkScanning = true;
                        UI.updateUI();

<<<<<<< HEAD
                        try {
                            await engine.start({
                                startTime: Date.now()
                            });
                        } catch (e) {
                            console.error('[Lia 360] Automation Error:', e);
                            UI.updateScrollStatus('Erro na automação', 0);
                        }
=======
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
>>>>>>> origin/main
                    };
                }

                // Stop button
                const stopBtn = document.getElementById('sos-stop-btn');
                if (stopBtn) {
<<<<<<< HEAD
                    stopBtn.onclick = async () => {
                        console.log('[Lia 360] Stopping Local Automation...');

                        if (engine) {
                            await engine.stop();
                        }

=======
                    stopBtn.onclick = () => {
                        if (autoScrollController) {
                            autoScrollController.stop();
                        }
>>>>>>> origin/main
                        const state = State.get();
                        state.isAutoScrolling = false;
                        state.isBulkScanning = false;
                        UI.updateUI();
<<<<<<< HEAD
                        UI.updateScrollStatus('Parado pelo usuário', 0);
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
                setTimeout(() => {
                    if (typeof poller !== 'undefined') clearInterval(poller);
                }, 30000);
            }
        }, 1000);
=======
            }
        }, 1000);
        setTimeout(() => clearInterval(poller), 30000);
>>>>>>> origin/main
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

<<<<<<< HEAD
    // --- Automation Functions ---
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function performConnectionAutomation(request) {
        const { automationType, config, lead } = request;
        console.log(`[Lia 360] Performing Automation: ${automationType}`, config);

        try {
            if (automationType === 'connection_request') {
                return await sendConnectionRequest(config?.message);
            } else if (automationType === 'send_message') {
                await sendDirectMessage(config?.message, lead);
                return { success: true };
            } else {
                throw new Error('Unknown automation type');
            }
        } catch (e) {
            console.error('[Lia 360] Automation Error:', e);
            return { success: false, error: e.message };
        }
    }

    async function sendConnectionRequest(note) {
        console.log('[Lia 360] sendConnectionRequest: Starting connection request flow');

        // 0. Check if connection was already attempted in this session
        const sessionKey = `connection_attempted_${window.location.href}`;
        try {
            const alreadyAttempted = await chrome.storage.session.get(sessionKey);
            if (alreadyAttempted[sessionKey]) {
                console.log('[Lia 360] Connection already attempted for this profile in current session, skipping');
                return { success: true, skipped: true, alreadyAttempted: true };
            }
        } catch (e) {
            console.warn('[Lia 360] Could not check session storage:', e);
            // Continue anyway if session storage fails
        }

        // Helper function to mark connection as attempted
        const markConnectionAttempted = async () => {
            try {
                await chrome.storage.session.set({ [sessionKey]: true });
                console.log('[Lia 360] Marked connection as attempted for this profile');
            } catch (e) {
                console.warn('[Lia 360] Could not save to session storage:', e);
            }
        };

        // 1. Check if already connected (Connect button changed to "Message")
        const buttons = Array.from(document.querySelectorAll('button'));
        const messageBtn = buttons.find(b => {
            const text = b.textContent.trim();
            return text === 'Message' || text === 'Enviar mensagem' || text === 'Mensagem';
        });

        if (messageBtn) {
            console.log('[Lia 360] Already connected to this user (Message button found)');
            await markConnectionAttempted();
            return { success: true, alreadyConnected: true };
        }

        // 1. Check if modal is already open from previous attempt
        const existingModal = document.querySelector('.artdeco-modal');
        if (existingModal) {
            console.log('[Lia 360] Connection modal already open, checking state...');

            // Check if request was already sent (modal shows "Pending" text)
            const modalText = existingModal.textContent || '';
            const pendingText = modalText.includes('Pending') || modalText.includes('Pendente') ||
                               modalText.includes('invitation has been sent') ||
                               modalText.includes('convite foi enviado');

            if (pendingText) {
                console.log('[Lia 360] Connection request already pending, closing modal');
                const closeBtn = existingModal.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
                if (closeBtn) {
                    closeBtn.click();
                    await sleep(500);
                }
                await markConnectionAttempted();
                return { success: true, alreadyPending: true };
            }

            // Modal is open but not pending - close it and try fresh
            console.log('[Lia 360] Stale modal detected, closing before retry');
            const closeBtn = existingModal.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
            if (closeBtn) {
                closeBtn.click();
                await sleep(500);
            }
        }

        // 2. Find Connect Button
        let connectBtn = buttons.find(b => {
            const text = b.textContent.trim();
            return text === 'Connect' || text === 'Conectar' || text === 'Connectar';
        });

        // If hidden in "More" menu
        if (!connectBtn) {
            const moreBtn = document.querySelector('.artdeco-dropdown__trigger--placement-bottom, .artdeco-dropdown__trigger');
            if (moreBtn) {
                console.log('[Lia 360] Connect button not visible, checking "More" menu');
                moreBtn.click();
                await sleep(500);

                const dropdownItems = Array.from(document.querySelectorAll('.artdeco-dropdown__content span, .artdeco-dropdown__content button'));
                const connectItem = dropdownItems.find(s => {
                    const text = s.textContent.trim();
                    return text === 'Connect' || text === 'Conectar' || text === 'Connectar';
                });

                if (connectItem) {
                    console.log('[Lia 360] Found Connect in More menu');
                    connectItem.click();
                    await sleep(500);
                } else {
                    document.body.click();
                    await sleep(300);
                }
            }
        }

        // 3. Open modal if not already open
        const modalOpen = document.querySelector('.artdeco-modal');
        if (!modalOpen && connectBtn) {
            console.log('[Lia 360] Clicking Connect button to open modal');
            connectBtn.click();
            await sleep(1000);
        } else if (connectBtn) {
            console.log('[Lia 360] Modal already open or connect button found');
        } else {
            console.error('[Lia 360] Connect button not found and no modal open');
            return { success: false, error: 'Connect button not found' };
        }

        // 4. Handle Modal - ALWAYS SEND WITHOUT NOTE
        await sleep(500);

        const modal = document.querySelector('.artdeco-modal');
        if (!modal) {
            console.error('[Lia 360] Modal did not open after clicking Connect');
            return { success: false, error: 'Modal did not open' };
        }

        // Look for send button with various selectors
        const sendBtnSelectors = [
            'button[aria-label="Send now"]',
            'button[aria-label="Enviar agora"]',
            'button[aria-label="Send without a note"]',
            'button[aria-label="Enviar sem nota"]',
            'button[aria-label="Send"]',
            'button[aria-label="Enviar"]'
        ];

        let sendBtn = null;
        for (const selector of sendBtnSelectors) {
            sendBtn = modal.querySelector(selector);
            if (sendBtn) {
                console.log('[Lia 360] Found send button with selector:', selector);
                break;
            }
        }

        if (sendBtn && !sendBtn.disabled) {
            console.log('[Lia 360] Clicking send button (without note)');
            sendBtn.click();
            await sleep(1000);

            const modalStillOpen = document.querySelector('.artdeco-modal');

            if (modalStillOpen) {
                const modalText = modalStillOpen.textContent || '';
                const successText = modalText.includes('Pending') || modalText.includes('Pendente') ||
                                   modalText.includes('invitation has been sent') ||
                                   modalText.includes('convite foi enviado');

                if (successText) {
                    console.log('[Lia 360] Connection request sent successfully (modal shows success)');
                    const closeBtn = modalStillOpen.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
                    if (closeBtn) {
                        closeBtn.click();
                        await sleep(500);
                    }
                    await markConnectionAttempted();
                    return { success: true, sent: true };
                } else {
                    console.warn('[Lia 360] Modal still open after clicking send, may need manual intervention');
                    return { success: false, error: 'Modal did not close after sending' };
                }
            }

            console.log('[Lia 360] Connection request sent successfully (modal closed)');
            await markConnectionAttempted();
            return { success: true, sent: true };
        } else if (sendBtn && sendBtn.disabled) {
            console.error('[Lia 360] Send button is disabled, may already be pending');
            return { success: false, error: 'Send button disabled (already pending?)' };
        } else {
            console.error('[Lia 360] Send button not found in modal');
            const closeBtn = modal.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
            if (closeBtn) {
                closeBtn.click();
            }
            return { success: false, error: 'Send button not found in modal' };
        }
    }

    async function sendDirectMessage(template, lead) {
        const msgBtn = Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent.trim() === 'Message' || b.textContent.trim() === 'Enviar mensagem'
        );
        if (!msgBtn) throw new Error('Message button not found (might not be connected)');

        msgBtn.click();
        await sleep(2000);

        const editor = document.querySelector('.msg-form__contenteditable');
        if (!editor) throw new Error('Chat editor not found');

        let message = template || '';
        message = message.replace('{{firstName}}', lead?.fullName?.split(' ')[0] || '');
        message = message.replace('{{fullName}}', lead?.fullName || '');
        message = message.replace('{{company}}', lead?.company || '');

        editor.textContent = message;
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        await sleep(1000);

        const sendBtn = document.querySelector('.msg-form__send-button');
        if (sendBtn && !sendBtn.disabled) {
            console.log('[Lia 360 - Simulation] Would have sent message:', message);
        }
    }

    // --- Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        (async () => {
            console.log('[Lia 360] Message received:', request.action);

=======
    // --- Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        (async () => {
>>>>>>> origin/main
            if (request.action === 'extractProfile') {
                const p = await DOM.extractCurrentProfile();
                sendResponse({ success: !!p, data: p });
            }
<<<<<<< HEAD
            // --- Automation Overlay Handlers ---
            else if (request.action === 'SHOW_OVERLAY') {
                console.log('[Lia 360] SHOW_OVERLAY received - setting automation mode');
                isAutomationMode = true;
                profileMenuCreationPending = false; // Cancel any pending menu creation

                // Remove ProfileImportMenu if it exists
                if (profileMenu) {
                    console.log('[Lia 360] Removing existing ProfileImportMenu');
                    profileMenu.remove();
                    profileMenu = null;
                }

                // Also try to force remove the menu host element directly
                // in case the reference was lost
                const existingMenuHost = document.getElementById('lia-profile-menu-host');
                if (existingMenuHost) {
                    console.log('[Lia 360] Force removing ProfileImportMenu host element');
                    existingMenuHost.remove();
                }

                UI.showAutomationOverlay(request.state);
                sendResponse({ success: true });
            }
            else if (request.action === 'START_WAIT') {
                UI.startWaitCountdown(request.duration);
                sendResponse({ success: true });
            }
            else if (request.action === 'HIDE_OVERLAY') {
                console.log('[Lia 360] HIDE_OVERLAY received - clearing automation mode');
                isAutomationMode = false;
                UI.hideAutomationOverlay();
                setTimeout(() => detectProfilePage(), 500);
                sendResponse({ success: true });
            }
            else if (request.action === 'ADD_LOG') {
                UI.addLog(request.message, request.type || 'info');
                sendResponse({ success: true });
            }
            // --- Automation Action Handlers ---
            else if (request.action === 'performAutomation') {
                const result = await performConnectionAutomation(request);
                sendResponse(result);
            }
            else if (request.action === 'performEnrichment') {
                const data = await DOM.extractCurrentProfile();
                sendResponse({ success: !!data, data: data ? { enrichment: data } : null });
            }
            else {
                sendResponse({ success: false, error: 'Unknown action' });
            }
=======
            // ... other handlers
>>>>>>> origin/main
        })();
        return true;
    });

})();
