/**
 * LinkedIn DOM - Lia 360
<<<<<<< HEAD
 * DOM manipulation and interaction utilities for LinkedIn.
=======
 * Main DOM module that integrates selectors and extractors.
>>>>>>> origin/main
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading DOM module...');

<<<<<<< HEAD
    // Wait for dependencies to be available
    function initWhenReady() {
        const Utils = window.LiaUtils;
        const Selectors = window.LiaSelectors;
        const Extractors = window.LiaExtractors;

        if (!Utils) {
            console.log('[Lia 360] DOM: Waiting for LiaUtils...');
            setTimeout(initWhenReady, 50);
            return;
        }

        if (!Selectors) {
            console.log('[Lia 360] DOM: Waiting for LiaSelectors...');
            setTimeout(initWhenReady, 50);
            return;
        }

        if (!Extractors) {
            console.log('[Lia 360] DOM: Waiting for LiaExtractors...');
            setTimeout(initWhenReady, 50);
            return;
        }

        console.log('[Lia 360] DOM: All dependencies OK');

        /**
         * Scroll element into view
         * @param {Element} element - Element to scroll
         */
        async function scrollToElement(element) {
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await Utils.sleep(800 + Math.random() * 400);
            }
        }

        /**
         * Expand "see more" sections
         * @param {Element} card - Card element
         */
        async function expandSection(card) {
            if (!card) return;

            const showMoreButton = card.querySelector(
                'button[aria-label*="Show more"], button[aria-label*="Ver mais"], button[aria-label*="mostrar"]'
            );

            if (showMoreButton && !showMoreButton.disabled) {
                showMoreButton.click();
                await Utils.sleep(600);
            }
        }

        /**
         * Detect if LinkedIn has blocked scrolling
         * @returns {Object} Block status
         */
        function detectLinkedInBlock() {
            // Check for CAPTCHA
            if (document.querySelector('[id*="captcha"], [class*="captcha"]')) {
                return { blocked: true, reason: 'captcha' };
            }

            // Check for rate limit messages
            const bodyText = document.body.innerText.toLowerCase();
            if (bodyText.includes("you've reached the limit") ||
                bodyText.includes('too many requests') ||
                bodyText.includes('rate limit')) {
                return { blocked: true, reason: 'rate_limit' };
            }

            return { blocked: false };
        }

        /**
         * Auto-scroll controller for LinkedIn pages
         */
        class AutoScrollController {
            constructor() {
                this.scrollContainer = null;
                this.lastCardCount = 0;
                this.noChangeCount = 0;
                this.maxNoChangeAttempts = 5;
                this.scrollDelay = 800 + Math.random() * 400;
                this.maxScrolls = 100;
            }

            /**
             * Start auto-scrolling with pagination
             * @param {Object} options - Configuration options
             */
            async startAutoScroll(options = {}) {
                const State = window.LiaState;
                const UI = window.LiaUI;

                this.scrollContainer = Selectors.findScrollableContainer();
                this.maxScrolls = options.maxScrolls || 100;
                const targetCount = options.targetCount || 500;

                let scrollCount = 0;
                const state = State.get();

                console.log('[Lia 360] Starting auto-scroll with pagination...');
                console.log('[Lia 360] Config:', {
                    maxScrolls: this.maxScrolls,
                    targetCount: targetCount
                });

                UI.updateScrollStatus('Starting...', 0);

                while (scrollCount < this.maxScrolls && state.isAutoScrolling) {
                    console.log(`
[Lia 360] ========== ITERATION ${scrollCount} ==========`);

                    const previousQualified = state.qualifiedLeads.size;
                    console.log('[Lia 360] Previous qualified leads:', previousQualified);
                    console.log('[Lia 360] isAutoScrolling:', state.isAutoScrolling);
                    console.log('[Lia 360] scrollCount:', scrollCount, '/', this.maxScrolls);

                    // Check for blocks
                    const blockStatus = detectLinkedInBlock();
                    if (blockStatus.blocked) {
                        state.isAutoScrolling = false;
                        UI.updateScrollStatus('⚠️ Blocked by LinkedIn');
                        alert(
                            `LinkedIn has blocked scrolling: ${blockStatus.reason}

Please wait a few minutes before trying again.`
                        );
                        await State.saveState();
                        options.onStop?.('blocked');
                        break;
                    }

                    // Find current cards
                    const currentCards = Selectors.findConnectionCards().length;
                    console.log('[Lia 360] Current cards on page:', currentCards);
                    console.log('[Lia 360] Scroll iteration:', {
                        scrollCount: scrollCount,
                        totalCards: currentCards,
                        qualifiedLeads: previousQualified,
                        noChangeCount: this.noChangeCount
                    });

                    // First iteration: run debug
                    if (scrollCount === 0) {
                        console.log('[Lia 360] First iteration - running debug...');
                        Selectors.debugPaginationStructure();
                    }

                    UI.updateScrollStatus(
                        'Looking for pagination button...',
                        Math.min(100, Math.round((previousQualified / targetCount) * 100))
                    );

                    console.log('[Lia 360] Calling clickPaginationButton...');
                    const paginationClicked = await this.clickPaginationButton();

                    console.log('[Lia 360] Pagination clicked result:', paginationClicked);

                    if (paginationClicked) {
                        console.log('[Lia 360] ✅ Pagination button clicked successfully!');
                        console.log('[Lia 360] Waiting 3 seconds for new content to load...');
                        UI.updateScrollStatus(
                            'Loading more results...',
                            Math.min(100, Math.round((previousQualified / targetCount) * 100))
                        );
                        await Utils.sleep(3000);

                        const newCards = Selectors.findConnectionCards();
                        console.log('[Lia 360] Cards after pagination:', newCards.length);
                        await this.processNewCards(newCards);
                        this.noChangeCount = 0;

                    } else {
                        console.log('[Lia 360] ❌ No pagination button found - trying scroll to load more...');
                        console.log('[Lia 360] Scrolling to bottom to load more results...');
                        this.scrollToBottom();
                        await Utils.sleep(1500);

                        // Check if pagination appeared after scroll
                        const paginationVisible = !!document.querySelector('.artdeco-pagination');
                        console.log('[Lia 360] Pagination visible after scroll:', paginationVisible);

                        if (await this.clickPaginationButton()) {
                            console.log('[Lia 360] ✅ Pagination found after scroll, clicking...');
                            await Utils.sleep(3000);
                            const newCards = Selectors.findConnectionCards();
                            await this.processNewCards(newCards);
                            this.noChangeCount = 0;

                        } else {
                            console.log('[Lia 360] Processing visible cards after scroll...');
                            const newCards = Selectors.findConnectionCards();
                            await this.processNewCards(newCards);

                            const currentQualified = state.qualifiedLeads.size;
                            const foundNew = currentQualified > previousQualified;
                            const hasMoreCards = newCards.length > this.lastCardCount;

                            if (console.log('[Lia 360] Progress check:', {
                                newLeads: currentQualified,
                                prevLeads: previousQualified,
                                foundNew: foundNew,
                                hasMoreCards: hasMoreCards,
                                lastCardCount: this.lastCardCount,
                                currentCardCount: newCards.length
                            }), !foundNew && !hasMoreCards) {
                                this.noChangeCount++;
                                console.log(
                                    `[Lia 360] ⚠️ No progress, attempt ${this.noChangeCount}/${this.maxNoChangeAttempts}`
                                );
                                UI.updateScrollStatus(
                                    `Waiting for more results... (${this.noChangeCount}/${this.maxNoChangeAttempts})`,
                                    Math.min(100, Math.round((previousQualified / targetCount) * 100))
                                );

                                if (this.noChangeCount >= this.maxNoChangeAttempts) {
                                    console.log('[Lia 360] 🛑 End of results detected (no progress)');
                                    UI.updateScrollStatus('✓ All results loaded', 100);
                                    state.isAutoScrolling = false;
                                    await State.saveState();
                                    options.onStop?.('end_of_results');
                                    break;
                                }

                            } else {
                                this.noChangeCount = 0;
                                this.lastCardCount = newCards.length;
                                console.log('[Lia 360] ✅ Progress made! Continuing...');
                                if (foundNew) {
                                    UI.updateScrollStatus(
                                        `Extracting: ${currentQualified} leads`,
                                        Math.min(100, Math.round((currentQualified / targetCount) * 100))
                                    );
                                }
                            }
                        }
                    }

                    // Periodic save
                    if (scrollCount % 5 === 0) {
                        console.log('[Lia 360] Saving state and updating UI...');
                        await State.saveState();
                        UI.updateUI();
                    }

                    scrollCount++;
                    console.log('[Lia 360] Incremented scrollCount to:', scrollCount);
                    console.log('[Lia 360] Loop condition check:', scrollCount, '<', this.maxScrolls, '&&', state.isAutoScrolling);
                }

                console.log('[Lia 360] 🏁 Auto-scroll completed');
                console.log('[Lia 360] Final stats:', {
                    totalScrolls: scrollCount,
                    qualifiedLeads: state.qualifiedLeads.size,
                    totalCardsFound: state.totalConnectionsFound
                });
                UI.updateScrollStatus(`✓ Completed: ${state.qualifiedLeads.size} leads extracted`, 100);
            }

            /**
             * Scroll to bottom of container
             */
            scrollToBottom() {
                if (!this.scrollContainer) {
                    console.warn('[Lia 360] No scroll container found');
                    return;
                }

                const scrollHeight = this.scrollContainer.scrollHeight;
                const target = scrollHeight - 200;
                this.scrollContainer.scrollTo({ top: target, behavior: 'smooth' });
                console.log('[Lia 360] Scrolled to', target, 'of', scrollHeight);
            }

            /**
             * Click the pagination button
             * @returns {Promise<boolean>} True if clicked successfully
             */
            async clickPaginationButton() {
                console.log('[Lia 360] Looking for pagination button...');
                await Utils.sleep(500);

                // Try finding via data-testid list
                const paginationList = document.querySelector('ul[data-testid="pagination-controls-list"]');
                console.log('[Lia 360] Pagination list found:', !!paginationList);

                if (paginationList) {
                    if (paginationList) {
                        // Method 1: Specific class (often reliable)
                        let nextItem = paginationList.querySelector('.artdeco-pagination__item--next');

                        // Method 2: Aria-label on button itself (most reliable)
                        if (!nextItem) {
                            const buttons = Array.from(paginationList.querySelectorAll('button'));
                            const nextButton = buttons.find(b => {
                                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                                const text = (b.innerText || '').toLowerCase();
                                return label.includes('next') || label.includes('avançar') || label.includes('próxima') || label.includes('seguinte') ||
                                    text.includes('next') || text.includes('avançar') || text.includes('próxima');
                            });
                            if (nextButton) {
                                nextItem = nextButton.parentElement; // usually the LI
                            }
                        }

                        console.log('[Lia 360] Next item in pagination list found:', !!nextItem);

                        if (nextItem) {
                            const button = nextItem.querySelector('button') || nextItem; // maybe nextItem IS the button
                            console.log('[Lia 360] Next button element found:', !!button);

                            if (button) {
                                const isDisabled = button.disabled ||
                                    button.getAttribute('aria-disabled') === 'true' ||
                                    button.classList.contains('artdeco-button--disabled');
                                console.log('[Lia 360] Next button disabled:', isDisabled);

                                if (isDisabled) {
                                    console.log('[Lia 360] Next button is disabled - end of results');
                                } else {
                                    console.log('[Lia 360] Found LinkedIn "Next" pagination button!');
                                    try {
                                        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        await Utils.sleep(500);
                                        button.click();
                                        await Utils.sleep(200);
                                        return true;
                                    } catch (error) {
                                        console.warn('[Lia 360] Failed to click Next button:', error);
                                    }
                                }
                            }
                        }
                    }

                    // Fallback: find next item directly
                    const nextItem = document.querySelector('.artdeco-pagination__item--next');
                    console.log('[Lia 360] Next pagination item found (fallback):', !!nextItem);

                    if (nextItem && !paginationList) { // Only run if main logic missed it
                        const button = nextItem.querySelector('button');
                        console.log('[Lia 360] Button in next item found:', !!button);

                        if (button) {
                            const isDisabled = button.disabled ||
                                button.getAttribute('aria-disabled') === 'true' ||
                                button.classList.contains('artdeco-button--disabled');
                            console.log('[Lia 360] Next button disabled (fallback):', isDisabled);

                            if (!isDisabled) {
                                console.log('[Lia 360] Found LinkedIn "Next" pagination button via fallback!');
                                try {
                                    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    await Utils.sleep(300);
                                    button.click();
                                    await Utils.sleep(500);
                                    return true;
                                } catch (error) {
                                    console.warn('[Lia 360] Failed to click Next button (fallback):', error);
                                }
                            }
                        }
                    }

                    // Fallback: find via data-dev-id
                    const devIdButton = document.querySelector('[data-dev-id="search-pagination__next-button"]');
                    if (devIdButton) {
                        const isDisabled = devIdButton.disabled ||
                            devIdButton.getAttribute('aria-disabled') === 'true';
                        console.log('[Lia 360] Found pagination button via data-dev-id, disabled:', isDisabled);

                        if (!isDisabled) {
                            console.log('[Lia 360] Clicking data-dev-id button');
                            try {
                                devIdButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await Utils.sleep(300);
                                devIdButton.click();
                                await Utils.sleep(500);
                                return true;
                            } catch (error) {
                                console.warn('[Lia 360] Failed to click data-dev-id button:', error);
                            }
                        }
                    }

                }

                console.log('[Lia 360] No pagination button found or all are disabled');
                return false;
            }

            /**
             * Process new cards found on page
             * @param {Element[]} cards - Array of card elements
             */
            async processNewCards(cards) {
                const state = window.LiaState.get();

                for (const card of cards) {
                    const lead = Extractors.extractLeadFromCard(card);
                    if (lead) {
                        if (!state.qualifiedLeads.has(lead.profileUrl)) {
                            const qualified = await this.applyAudienceFilter(lead);
                            if (qualified) {
                                state.qualifiedLeads.set(lead.profileUrl, lead);
                                console.log('[Lia 360] ✓ Qualified lead:', lead.fullName);
                            }
                        }
                    }
                }

                state.totalConnectionsFound = cards.length;
                window.LiaUI.updateUI();
            }

            /**
             * Apply audience filter to lead
             * @param {Object} lead - Lead data
             * @returns {Promise<boolean>} True if lead matches filter
             */
            async applyAudienceFilter(lead) {
                const state = window.LiaState.get();

                if (state.selectedAudience) {
                    return new Utils.AudienceFilter(state.selectedAudience).matches(lead);
                }

                return true;
            }

            /**
             * Stop auto-scrolling
             */
            stop() {
                const state = window.LiaState.get();
                state.isAutoScrolling = false;
                console.log('[Lia 360] Auto-scroll stopped');
            }
        }

        // Expose public API
        window.LiaDOM = {
            sleep: Utils.sleep,
            findScrollableContainer: Selectors.findScrollableContainer,
            findConnectionCards: Selectors.findConnectionCards,
            isElementVisible: Selectors.isElementVisible,
            debugPaginationStructure: Selectors.debugPaginationStructure,
            getQuickStats: Extractors.getQuickStats,
            extractSearchResults: Extractors.extractSearchResults,
            extractContactInfo: Extractors.extractContactInfo,
            extractSkills: Extractors.extractSkills,
            extractExperienceSection: Extractors.extractExperienceSection,
            extractCurrentProfile: Extractors.extractCurrentProfile,
            extractLeadFromCard: Extractors.extractLeadFromCard,
            fetchActivityPage: Extractors.fetchActivityPage,
            parseRecentActivity: Extractors.parseRecentActivity,
            scrollToElement,
            expandSection,
            detectLinkedInBlock,
            AutoScrollController
        };

        console.log('[Lia 360] DOM Module Loaded');
    }

    // Start initialization when dependencies are ready
    initWhenReady();
=======
    // Dependency check
    const Utils = window.LiaUtils;
    const Selectors = window.LiaSelectors;
    const Extractors = window.LiaExtractors;

    if (!Utils) {
        console.error('[Lia 360] LiaUtils not found. Check load order.');
        return;
    }

    if (!Selectors) {
        console.error('[Lia 360] LiaSelectors not found. Check load order.');
        return;
    }

    if (!Extractors) {
        console.error('[Lia 360] LiaExtractors not found. Check load order.');
        return;
    }

    console.log('[Lia 360] All dependencies OK');

    // Helper functions
    async function scrollToElement(element) {
        if (!element) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await Utils.sleep(800 + Math.random() * 400);
    }

    async function expandSection(sectionContainer) {
        if (!sectionContainer) return;
        const showMoreBtn = sectionContainer.querySelector('button[aria-label*="Show more"], button[aria-label*="Ver mais"], button[aria-label*="mostrar"]');
        if (showMoreBtn && !showMoreBtn.disabled) {
            showMoreBtn.click();
            await Utils.sleep(600);
        }
    }

    function detectLinkedInBlock() {
        // Check for CAPTCHA
        if (document.querySelector('[id*="captcha"], [class*="captcha"]')) {
            return { blocked: true, reason: 'captcha' };
        }

        // Check for rate limit message
        const bodyText = document.body.innerText.toLowerCase();
        if (bodyText.includes('you\'ve reached the limit') ||
            bodyText.includes('too many requests') ||
            bodyText.includes('rate limit')) {
            return { blocked: true, reason: 'rate_limit' };
        }

        return { blocked: false };
    }

    // AutoScrollController class
    class AutoScrollController {
        constructor() {
            this.scrollContainer = null;
            this.lastCardCount = 0;
            this.noChangeCount = 0;
            this.maxNoChangeAttempts = 5;
            this.scrollDelay = 800 + Math.random() * 400;
            this.maxScrolls = 100;
        }

        async startAutoScroll(config = {}) {
            const State = window.LiaState;
            const UI = window.LiaUI;

            this.scrollContainer = Selectors.findScrollableContainer();
            this.maxScrolls = config.maxScrolls || 100;
            const targetCount = config.targetCount || 500;

            let scrollCount = 0;
            const state = State.get();

            console.log('[Lia 360] Starting auto-scroll with pagination...');
            console.log('[Lia 360] Config:', { maxScrolls: this.maxScrolls, targetCount });
            UI.updateScrollStatus('Starting...', 0);

            while (scrollCount < this.maxScrolls && state.isAutoScrolling) {
                console.log(`\n[Lia 360] ========== ITERATION ${scrollCount} ==========`);

                const prevCount = state.qualifiedLeads.size;
                console.log('[Lia 360] Previous qualified leads:', prevCount);
                console.log('[Lia 360] isAutoScrolling:', state.isAutoScrolling);
                console.log('[Lia 360] scrollCount:', scrollCount, '/', this.maxScrolls);

                // Check for LinkedIn blocks
                const blockStatus = detectLinkedInBlock();
                if (blockStatus.blocked) {
                    state.isAutoScrolling = false;
                    UI.updateScrollStatus('⚠️ Blocked by LinkedIn');
                    alert(`LinkedIn has blocked scrolling: ${blockStatus.reason}\n\nPlease wait a few minutes before trying again.`);
                    await State.saveState();
                    config.onStop?.('blocked');
                    break;
                }

                // Get current cards
                const cards = Selectors.findConnectionCards();
                const currentCount = cards.length;
                console.log('[Lia 360] Current cards on page:', currentCount);

                console.log('[Lia 360] Scroll iteration:', {
                    scrollCount,
                    totalCards: currentCount,
                    qualifiedLeads: prevCount,
                    noChangeCount: this.noChangeCount
                });

                // Debug pagination structure on first iteration
                if (scrollCount === 0) {
                    console.log('[Lia 360] First iteration - running debug...');
                    Selectors.debugPaginationStructure();
                }

                // PRIORITY 1: Try clicking pagination button FIRST
                UI.updateScrollStatus('Looking for pagination button...', Math.min(100, Math.round((prevCount / targetCount) * 100)));
                console.log('[Lia 360] Calling clickPaginationButton...');

                const paginationClicked = await this.clickPaginationButton();
                console.log('[Lia 360] Pagination clicked result:', paginationClicked);

                if (paginationClicked) {
                    console.log('[Lia 360] ✅ Pagination button clicked successfully!');
                    console.log('[Lia 360] Waiting 3 seconds for new content to load...');
                    UI.updateScrollStatus('Loading more results...', Math.min(100, Math.round((prevCount / targetCount) * 100)));
                    await Utils.sleep(3000);

                    const newCards = Selectors.findConnectionCards();
                    console.log('[Lia 360] Cards after pagination:', newCards.length);
                    await this.processNewCards(newCards);

                    this.noChangeCount = 0;
                } else {
                    console.log('[Lia 360] ❌ No pagination button found - trying scroll to load more...');

                    console.log('[Lia 360] Scrolling to bottom to load more results...');
                    this.scrollToBottom();
                    await Utils.sleep(1500);

                    const paginationFound = document.querySelector('.artdeco-pagination');
                    console.log('[Lia 360] Pagination visible after scroll:', !!paginationFound);

                    const paginationAfterScroll = await this.clickPaginationButton();

                    if (paginationAfterScroll) {
                        console.log('[Lia 360] ✅ Pagination found after scroll, clicking...');
                        await Utils.sleep(3000);
                        const scrolledCards = Selectors.findConnectionCards();
                        await this.processNewCards(scrolledCards);
                        this.noChangeCount = 0;
                    } else {
                        console.log('[Lia 360] Processing visible cards after scroll...');

                        const scrolledCards = Selectors.findConnectionCards();
                        await this.processNewCards(scrolledCards);

                        const newCount = state.qualifiedLeads.size;
                        const foundNew = newCount > prevCount;
                        const hasMoreCards = scrolledCards.length > this.lastCardCount;

                        console.log('[Lia 360] Progress check:', {
                            newLeads: newCount,
                            prevLeads: prevCount,
                            foundNew,
                            hasMoreCards,
                            lastCardCount: this.lastCardCount,
                            currentCardCount: scrolledCards.length
                        });

                        if (!foundNew && !hasMoreCards) {
                            this.noChangeCount++;
                            console.log(`[Lia 360] ⚠️ No progress, attempt ${this.noChangeCount}/${this.maxNoChangeAttempts}`);

                            UI.updateScrollStatus(
                                `Waiting for more results... (${this.noChangeCount}/${this.maxNoChangeAttempts})`,
                                Math.min(100, Math.round((prevCount / targetCount) * 100))
                            );

                            if (this.noChangeCount >= this.maxNoChangeAttempts) {
                                console.log('[Lia 360] 🛑 End of results detected (no progress)');
                                UI.updateScrollStatus('✓ All results loaded', 100);
                                state.isAutoScrolling = false;
                                await State.saveState();
                                config.onStop?.('end_of_results');
                                break;
                            }
                        } else {
                            this.noChangeCount = 0;
                            this.lastCardCount = scrolledCards.length;

                            console.log('[Lia 360] ✅ Progress made! Continuing...');
                            if (foundNew) {
                                UI.updateScrollStatus(
                                    `Extracting: ${newCount} leads`,
                                    Math.min(100, Math.round((newCount / targetCount) * 100))
                                );
                            }
                        }
                    }
                }

                // Periodic state save and UI update
                if (scrollCount % 5 === 0) {
                    console.log('[Lia 360] Saving state and updating UI...');
                    await State.saveState();
                    UI.updateUI();
                }

                scrollCount++;
                console.log('[Lia 360] Incremented scrollCount to:', scrollCount);
                console.log('[Lia 360] Loop condition check:', scrollCount, '<', this.maxScrolls, '&&', state.isAutoScrolling);
            }

            console.log('[Lia 360] 🏁 Auto-scroll completed');
            console.log('[Lia 360] Final stats:', {
                totalScrolls: scrollCount,
                qualifiedLeads: state.qualifiedLeads.size,
                totalCardsFound: state.totalConnectionsFound
            });
            UI.updateScrollStatus(`✓ Completed: ${state.qualifiedLeads.size} leads extracted`, 100);
        }

        scrollToBottom() {
            if (!this.scrollContainer) {
                console.warn('[Lia 360] No scroll container found');
                return;
            }

            const scrollHeight = this.scrollContainer.scrollHeight;
            const targetScroll = scrollHeight - 200;

            this.scrollContainer.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });

            console.log('[Lia 360] Scrolled to', targetScroll, 'of', scrollHeight);
        }

        async clickPaginationButton() {
            console.log('[Lia 360] Looking for pagination button...');

            await Utils.sleep(500);

            // STRATEGY 1: Use data-testid="pagination-controls-list"
            const paginationList = document.querySelector('ul[data-testid="pagination-controls-list"]');
            console.log('[Lia 360] Pagination list found:', !!paginationList);

            if (paginationList) {
                const nextItem = paginationList.querySelector('.artdeco-pagination__item--next');
                console.log('[Lia 360] Next item in pagination list found:', !!nextItem);

                if (nextItem) {
                    const nextButton = nextItem.querySelector('button');
                    console.log('[Lia 360] Button in next item found:', !!nextButton);

                    if (nextButton) {
                        const isDisabled = nextButton.disabled ||
                                         nextButton.getAttribute('aria-disabled') === 'true' ||
                                         nextButton.classList.contains('artdeco-button--disabled');

                        console.log('[Lia 360] Next button disabled:', isDisabled);

                        if (!isDisabled) {
                            console.log('[Lia 360] Found LinkedIn "Next" pagination button!');
                            try {
                                nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await Utils.sleep(300);
                                nextButton.click();
                                await Utils.sleep(200);
                                nextButton.dispatchEvent(new MouseEvent('click', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true
                                }));
                                console.log('[Lia 360] Successfully clicked Next button');
                                return true;
                            } catch (e) {
                                console.warn('[Lia 360] Failed to click Next button:', e);
                            }
                        } else {
                            console.log('[Lia 360] Next button is disabled - end of results');
                        }
                    }
                }
            }

            // STRATEGY 2: Fallback to class-based selector
            const nextPaginationItem = document.querySelector('.artdeco-pagination__item--next');
            console.log('[Lia 360] Next pagination item found (fallback):', !!nextPaginationItem);

            if (nextPaginationItem && !paginationList) {
                const nextButton = nextPaginationItem.querySelector('button');
                console.log('[Lia 360] Button in next item found:', !!nextButton);

                if (nextButton) {
                    const isDisabled = nextButton.disabled ||
                                     nextButton.getAttribute('aria-disabled') === 'true' ||
                                     nextButton.classList.contains('artdeco-button--disabled');

                    console.log('[Lia 360] Next button disabled (fallback):', isDisabled);

                    if (!isDisabled) {
                        console.log('[Lia 360] Found LinkedIn "Next" pagination button via fallback!');
                        try {
                            nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await Utils.sleep(300);
                            nextButton.click();
                            await Utils.sleep(500);
                            return true;
                        } catch (e) {
                            console.warn('[Lia 360] Failed to click Next button (fallback):', e);
                        }
                    }
                }
            }

            // STRATEGY 3: Look for data-dev-id
            const devIdButton = document.querySelector('[data-dev-id="search-pagination__next-button"]');
            if (devIdButton) {
                const isDisabled = devIdButton.disabled ||
                                 devIdButton.getAttribute('aria-disabled') === 'true';

                console.log('[Lia 360] Found pagination button via data-dev-id, disabled:', isDisabled);

                if (!isDisabled) {
                    console.log('[Lia 360] Clicking data-dev-id button');
                    try {
                        devIdButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await Utils.sleep(300);
                        devIdButton.click();
                        await Utils.sleep(500);
                        return true;
                    } catch (e) {
                        console.warn('[Lia 360] Failed to click data-dev-id button:', e);
                    }
                }
            }

            console.log('[Lia 360] No pagination button found or all are disabled');
            return false;
        }

        async processNewCards(cards) {
            const State = window.LiaState;
            const state = State.get();

            for (const card of cards) {
                const leadData = Extractors.extractLeadFromCard(card);
                if (!leadData) continue;

                if (!state.qualifiedLeads.has(leadData.profileUrl)) {
                    const isQualified = await this.applyAudienceFilter(leadData);
                    if (isQualified) {
                        state.qualifiedLeads.set(leadData.profileUrl, leadData);
                        console.log('[Lia 360] ✓ Qualified lead:', leadData.fullName);
                    }
                }
            }

            state.totalConnectionsFound = cards.length;
            window.LiaUI.updateUI();
        }

        async applyAudienceFilter(leadData) {
            const State = window.LiaState;
            const state = State.get();

            if (!state.selectedAudience) return true;

            const filter = new Utils.AudienceFilter(state.selectedAudience);
            return filter.matches(leadData);
        }

        stop() {
            const State = window.LiaState;
            const state = State.get();
            state.isAutoScrolling = false;
            console.log('[Lia 360] Auto-scroll stopped');
        }
    }

    // Main API - exposes all functionality
    window.LiaDOM = {
        sleep: Utils.sleep,

        // Re-export from Selectors
        findScrollableContainer: Selectors.findScrollableContainer,
        findConnectionCards: Selectors.findConnectionCards,
        isElementVisible: Selectors.isElementVisible,
        debugPaginationStructure: Selectors.debugPaginationStructure,

        // Re-export from Extractors
        getQuickStats: Extractors.getQuickStats,
        extractSearchResults: Extractors.extractSearchResults,
        extractContactInfo: Extractors.extractContactInfo,
        extractSkills: Extractors.extractSkills,
        extractExperienceSection: Extractors.extractExperienceSection,
        extractCurrentProfile: Extractors.extractCurrentProfile,
        extractLeadFromCard: Extractors.extractLeadFromCard,
        fetchActivityPage: Extractors.fetchActivityPage,
        parseRecentActivity: Extractors.parseRecentActivity,

        // Local helpers
        scrollToElement,
        expandSection,
        detectLinkedInBlock,

        // AutoScrollController class
        AutoScrollController
    };

    console.log('[Lia 360] DOM Module Loaded');
>>>>>>> origin/main
})();
