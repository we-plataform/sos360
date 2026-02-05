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
    let isAutomationMode = false; // Flag to track if we're in automation mode

    // --- Core Logic ---

    // Check if this tab is part of an automation on startup
    async function checkAutomationState() {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            if (result.automationState && result.automationState.status === 'RUNNING') {
                const currentTabId = await getCurrentTabId();
                if (currentTabId && result.automationState.tabId === currentTabId) {
                    console.log('[Lia 360] This tab is the automation tab, suppressing ProfileImportMenu');
                    isAutomationMode = true;
                    return true;
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

    function detectProfilePage() {
        const url = window.location.href;
        const isProfile = url.includes('/in/') && url.match(/\/in\/[^\/]+/);

        // Don't create ProfileImportMenu if automation is active (either overlay visible or automation mode flag)
        if (isAutomationMode || (UI.isAutomationActive && UI.isAutomationActive())) {
            console.log('[Lia 360] Automation active, skipping ProfileImportMenu');
            if (profileMenu) {
                profileMenu.remove();
                profileMenu = null;
            }
            return;
        }

        if (isProfile && !profileMenu) {
            console.log('[Lia 360] Perfil detectado, criando menu');
            profileMenu = new UI.ProfileImportMenu();
        } else if (!isProfile && profileMenu) {
            profileMenu.remove();
            profileMenu = null;
        }
    }

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
            console.log('[Lia 360] Initial load: connections/search page detected');
            initOverlay();
        }

        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                console.log('[Lia 360] URL changed to:', url);
                if (!isAutomationMode) {
                    detectProfilePage();
                }
                // Also re-init Overlay logic if needed
                if (!isAutomationMode && (url.includes('/connections/') || url.includes('/search/results/'))) {
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

    // --- Automation Functions ---
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function performAutomation(request) {
        const { automationType, config, lead } = request;
        console.log(`[Lia 360] Performing Automation: ${automationType}`, config);

        try {
            if (automationType === 'connection_request') {
                await sendConnectionRequest(config?.message);
            } else if (automationType === 'send_message') {
                await sendDirectMessage(config?.message, lead);
            } else {
                throw new Error('Unknown automation type');
            }
            return { success: true };
        } catch (e) {
            console.error('[Lia 360] Automation Error:', e);
            return { success: false, error: e.message };
        }
    }

    async function sendConnectionRequest(note) {
        console.log('[Lia 360] sendConnectionRequest: Starting connection request flow');

        // 0. Check if already connected (Connect button changed to "Message")
        const buttons = Array.from(document.querySelectorAll('button'));
        const messageBtn = buttons.find(b => {
            const text = b.textContent.trim();
            return text === 'Message' || text === 'Enviar mensagem' || text === 'Mensagem';
        });

        if (messageBtn) {
            console.log('[Lia 360] Already connected to this user (Message button found)');
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
                // Close modal and return success
                const closeBtn = existingModal.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
                if (closeBtn) {
                    closeBtn.click();
                    await sleep(500);
                }
                return { success: true, alreadyPending: true };
            }

            // Modal is open but not pending - might be from previous failed attempt
            // Close it and try fresh
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
                    // Click anywhere to close dropdown
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

        // Check for modal again
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

            // Verify modal closed or state changed
            const modalStillOpen = document.querySelector('.artdeco-modal');

            if (modalStillOpen) {
                // Modal still open - check if it shows success state
                const modalText = modalStillOpen.textContent || '';
                const successText = modalText.includes('Pending') || modalText.includes('Pendente') ||
                                   modalText.includes('invitation has been sent') ||
                                   modalText.includes('convite foi enviado');

                if (successText) {
                    console.log('[Lia 360] Connection request sent successfully (modal shows success)');
                    // Close modal
                    const closeBtn = modalStillOpen.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
                    if (closeBtn) {
                        closeBtn.click();
                        await sleep(500);
                    }
                    return { success: true, sent: true };
                } else {
                    console.warn('[Lia 360] Modal still open after clicking send, may need manual intervention');
                    return { success: false, error: 'Modal did not close after sending' };
                }
            }

            console.log('[Lia 360] Connection request sent successfully (modal closed)');
            return { success: true, sent: true };
        } else if (sendBtn && sendBtn.disabled) {
            console.error('[Lia 360] Send button is disabled, may already be pending');
            return { success: false, error: 'Send button disabled (already pending?)' };
        } else {
            console.error('[Lia 360] Send button not found in modal');
            // Try to close modal
            const closeBtn = modal.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
            if (closeBtn) {
                closeBtn.click();
            }
            return { success: false, error: 'Send button not found in modal' };
        }
    }

    async function sendDirectMessage(template, lead) {
        // 1. Find Message Button
        const msgBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Message' || b.textContent.trim() === 'Enviar mensagem');
        if (!msgBtn) throw new Error('Message button not found (might not be connected)');

        msgBtn.click();
        await sleep(2000);

        // 2. Type Message
        const editor = document.querySelector('.msg-form__contenteditable');
        if (!editor) throw new Error('Chat editor not found');

        // Replace variables
        let message = template || '';
        message = message.replace('{{firstName}}', lead?.fullName?.split(' ')[0] || '');
        message = message.replace('{{fullName}}', lead?.fullName || '');
        message = message.replace('{{company}}', lead?.company || '');

        // Simulate typing
        editor.textContent = message;
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        await sleep(1000);

        // 3. Send
        const sendBtn = document.querySelector('.msg-form__send-button');
        if (sendBtn && !sendBtn.disabled) {
            // sendBtn.click(); // UNCOMMENT TO ACTUALLY SEND
            console.log('[Lia 360 - Simulation] Would have sent message:', message);
        }
    }

    async function performEnrichment() {
        console.log('[Lia 360] Received performEnrichment request');
        const profile = await DOM.extractCurrentProfile();
        if (!profile) {
            return { success: false, error: 'Could not extract profile' };
        }

        // For now, just return the profile data
        // Full enrichment could be added later
        return {
            success: true,
            data: {
                profile,
                enrichment: {}
            }
        };
    }

    // --- Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        (async () => {
            console.log('[Lia 360] Message received:', request.action);

            if (request.action === 'extractProfile') {
                const p = await DOM.extractCurrentProfile();
                sendResponse({ success: !!p, data: p });
            }
            // --- Automation Overlay Handlers ---
            else if (request.action === 'SHOW_OVERLAY') {
                console.log('[Lia 360] SHOW_OVERLAY received - setting automation mode');
                // Set automation mode flag
                isAutomationMode = true;
                // Hide profile menu if showing automation overlay
                if (profileMenu) {
                    profileMenu.remove();
                    profileMenu = null;
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
                // Clear automation mode flag
                isAutomationMode = false;
                UI.hideAutomationOverlay();
                // Re-detect profile page to show import menu if applicable
                setTimeout(() => detectProfilePage(), 500);
                sendResponse({ success: true });
            }
            else if (request.action === 'ADD_LOG') {
                UI.addLog(request.message, request.type || 'info');
                sendResponse({ success: true });
            }
            // --- Automation Action Handlers ---
            else if (request.action === 'performAutomation') {
                const result = await performAutomation(request);
                sendResponse(result);
            }
            else if (request.action === 'performEnrichment') {
                const result = await performEnrichment();
                sendResponse(result);
            }
            else {
                // Unknown action
                sendResponse({ success: false, error: 'Unknown action' });
            }
        })();
        return true;
    });

})();
