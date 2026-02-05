/**
 * LinkedIn Selectors - Lia 360
<<<<<<< HEAD
 * DOM selector utilities for finding elements on LinkedIn pages.
=======
 * DOM traversal and element finding functions.
>>>>>>> origin/main
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading Selectors module...');

<<<<<<< HEAD
    // Wait for LiaUtils to be available
    function initWhenReady() {
        if (!window.LiaUtils) {
            console.log('[Lia 360] Waiting for LiaUtils...');
            setTimeout(initWhenReady, 50);
            return;
        }

        console.log('[Lia 360] LiaUtils available, initializing Selectors...');

        /**
         * Find the scrollable container on LinkedIn pages
         * @returns {Element|null} The scrollable container element
         */
        function findScrollableContainer() {
            const selectors = [
=======
    // Dependency check
    const Utils = window.LiaUtils;

    if (!Utils) {
        console.error('[Lia 360] LiaUtils not found. Check load order.');
        return;
    }

    window.LiaSelectors = {
        /**
         * Find the main scrollable container on the page
         */
        findScrollableContainer: function () {
            // Strategy 1: Specific known selectors
            const candidates = [
>>>>>>> origin/main
                '.scaffold-layout__main',
                '.scaffold-finite-scroll__content',
                'main',
                '.authentication-outlet',
                '[data-finite-scroll-hotkey-context]',
                '.qa-scaffold-layout__main',
                '#voyager-feed'
            ];

<<<<<<< HEAD
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const overflowY = window.getComputedStyle(element).overflowY;
                    if ((overflowY === 'auto' || overflowY === 'scroll') &&
                        element.scrollHeight > element.clientHeight &&
                        element.scrollHeight > 500) {
                        console.log(`[Lia 360] Found scrollable via selector ${selector}: scrollHeight=${element.scrollHeight}`);
                        return element;
=======
            for (const selector of candidates) {
                const el = document.querySelector(selector);
                if (el) {
                    const style = window.getComputedStyle(el);
                    const overflowY = style.overflowY;
                    const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;

                    if (isScrollable && el.scrollHeight > 500) {
                        console.log(`[Lia 360] Found scrollable via selector ${selector}: scrollHeight=${el.scrollHeight}`);
                        return el;
>>>>>>> origin/main
                    }
                }
            }

<<<<<<< HEAD
            console.log('[Lia 360] Selectors failed, searching for largest scrollable element...');

            let bestElement = null;
            let maxScrollHeight = 0;

            const elements = document.querySelectorAll('div, main, section, ul');
            for (const element of elements) {
                if (element.clientHeight < 100) continue;

                const scrollHeight = element.scrollHeight;
                const clientHeight = element.clientHeight;

                if (scrollHeight > clientHeight + 100) {
                    const overflowY = window.getComputedStyle(element).overflowY;
                    if ((overflowY === 'auto' || overflowY === 'scroll') && scrollHeight > maxScrollHeight) {
                        maxScrollHeight = scrollHeight;
                        bestElement = element;
=======
            // Strategy 2: Find the element with the LARGEST scrollHeight
            console.log('[Lia 360] Selectors failed, searching for largest scrollable element...');
            let bestCandidate = null;
            let maxScrollHeight = 0;
            const allElements = document.querySelectorAll('div, main, section, ul');

            for (const el of allElements) {
                if (el.clientHeight < 100) continue;
                const scrollHeight = el.scrollHeight;
                const clientHeight = el.clientHeight;

                if (scrollHeight > clientHeight + 100) {
                    const style = window.getComputedStyle(el);
                    const overflowY = style.overflowY;
                    if (overflowY === 'auto' || overflowY === 'scroll') {
                        if (scrollHeight > maxScrollHeight) {
                            maxScrollHeight = scrollHeight;
                            bestCandidate = el;
                        }
>>>>>>> origin/main
                    }
                }
            }

<<<<<<< HEAD
            if (bestElement) {
                console.log(`[Lia 360] Found largest scrollable element: ${bestElement.className.substring(0, 50)}...`);
                return bestElement;
            }

            // Fallback to document element
=======
            if (bestCandidate) {
                console.log(`[Lia 360] Found largest scrollable element: ${bestCandidate.className.substring(0, 50)}...`);
                return bestCandidate;
            }

>>>>>>> origin/main
            if (document.body.scrollHeight > window.innerHeight) {
                return document.documentElement;
            }

<<<<<<< HEAD
            return null;
        }

        /**
         * Find connection cards on the LinkedIn connections page
         * @returns {Element[]} Array of card elements
         */
        function findConnectionCards() {
            console.log('[Lia 360] findConnectionCards() called');

            // Strategy 1: Top-Down (Specific Containers) - More reliable for Search/Connections
            const containerSelectors = [
                '.entity-result__item', // Search results
                '.reusable-search__result-container', // Generic search
                '.mn-connection-card', // Connections page
                '.artdeco-list__item', // Generic list
                'li.grid-grid__item' // Grid view
            ];

            const cards = new Set();

            for (const selector of containerSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`[Lia 360] Found ${elements.length} cards via selector: ${selector}`);
                    elements.forEach(el => {
                        // Validation: Must contain a profile link
                        if (el.querySelector('a[href*="/in/"]')) {
                            cards.add(el);
                        }
                    });
                }
            }

            if (cards.size > 0) {
                console.log(`[Lia 360] Total unique cards found (Top-Down): ${cards.size}`);
                return Array.from(cards);
            }

            // Strategy 2: Bottom-Up (Link Backtracking) - Fallback
            console.log('[Lia 360] Top-Down failed, trying Bottom-Up...');
            const profileLinks = document.querySelectorAll('a[href*="/in/"]');

            for (const link of profileLinks) {
                // Skip links in header/nav/sidebar
                if (link.closest('header') ||
                    link.closest('nav') ||
                    link.closest('.global-nav') ||
                    link.closest('.artdeco-card__actions') || // Actions bar
                    link.closest('.right-rail') ||
                    link.closest('aside')) {
                    continue;
                }

                // Find the closest card container
=======
            return document.documentElement;
        },

        /**
         * Find all connection cards on the current page
         */
        findConnectionCards: function () {
            console.log('[Lia 360] findConnectionCards() called');
            const profileLinks = document.querySelectorAll('a[href*="/in/"]');
            console.log('[Lia 360] Found profile links:', profileLinks.length);

            if (profileLinks.length === 0) {
                console.log('[Lia 360] No profile links found');
                return [];
            }

            const cardMap = new Map();

            for (const link of profileLinks) {
                if (link.closest('header') || link.closest('nav') || link.closest('.global-nav')) continue;

>>>>>>> origin/main
                let card = link.closest('li');
                if (!card) {
                    card = link.closest('[class*="card"]') ||
                        link.closest('[class*="entity"]') ||
                        link.closest('[class*="list-item"]') ||
                        link.closest('.artdeco-list__item');
                }
<<<<<<< HEAD

                if (!card) {
                    // If no specific container, use a reasonable parent (2 levels up)
                    // e.g. div > a
                    card = link.parentElement?.parentElement;
                }

                if (card && !cards.has(card)) {
                    // Heuristic: A card should probably not be the entire body or main
                    if (card.tagName !== 'BODY' && card.tagName !== 'MAIN' && card.tagName !== 'HTML') {
                        cards.add(card);
                    }
                }
            }

            console.log(`[Lia 360] Total unique cards found (Bottom-Up): ${cards.size}`);
            return Array.from(cards);
        }

        /**
         * Check if an element is visible in the viewport
         * @param {Element} element - The element to check
         * @returns {boolean} True if visible
         */
        function isElementVisible(element) {
            if (!element) return false;

            const rect = element.getBoundingClientRect();
=======
                if (!card) card = link.parentElement?.parentElement;

                if (card && !cardMap.has(card)) {
                    cardMap.set(card, link);
                }
            }

            console.log('[Lia 360] Found cards:', cardMap.size);
            return Array.from(cardMap.keys());
        },

        /**
         * Check if element is visible in viewport
         */
        isElementVisible: function(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
>>>>>>> origin/main
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
<<<<<<< HEAD
        }

        /**
         * Debug pagination structure on LinkedIn pages
         */
        function debugPaginationStructure() {
            console.log('[Lia 360] === Pagination Debug ===');

            // Check for pagination list with data-testid
=======
        },

        /**
         * Debug pagination structure - helps identify LinkedIn's pagination elements
         */
        debugPaginationStructure: function() {
            console.log('[Lia 360] === Pagination Debug ===');

            // STRATEGY 1: Check for data-testid="pagination-controls-list" (PRIMARY)
>>>>>>> origin/main
            const paginationList = document.querySelector('ul[data-testid="pagination-controls-list"]');
            console.log('[Lia 360] Pagination list (data-testid) found:', !!paginationList);

            if (paginationList) {
                console.log('[Lia 360] Pagination list details:', {
                    tagName: paginationList.tagName,
                    dataTestId: paginationList.getAttribute('data-testid'),
                    classes: paginationList.className,
                    childCount: paginationList.children.length
                });

<<<<<<< HEAD
                const items = paginationList.querySelectorAll('li');
                console.log('[Lia 360] Pagination items in list:', items.length);

                items.forEach((item, index) => {
                    const button = item.querySelector('button');
                    console.log(`[Lia 360] Item ${index}:`, {
                        classes: item.className,
                        buttonAriaLabel: button?.getAttribute('aria-label'),
                        buttonDisabled: button?.disabled,
                        devId: button?.getAttribute('data-dev-id')
=======
                // List all items in pagination list
                const items = paginationList.querySelectorAll('li');
                console.log('[Lia 360] Pagination items in list:', items.length);
                items.forEach((item, index) => {
                    const btn = item.querySelector('button');
                    console.log(`[Lia 360] Item ${index}:`, {
                        classes: item.className,
                        buttonAriaLabel: btn?.getAttribute('aria-label'),
                        buttonDisabled: btn?.disabled,
                        devId: btn?.getAttribute('data-dev-id')
>>>>>>> origin/main
                    });
                });
            }

<<<<<<< HEAD
            // Check for next pagination item
            const nextItem = document.querySelector('.artdeco-pagination__item--next');
            console.log('[Lia 360] Next pagination item found:', !!nextItem);

=======
            // STRATEGY 2: Check for next button item
            const nextItem = document.querySelector('.artdeco-pagination__item--next');
            console.log('[Lia 360] Next pagination item found:', !!nextItem);
>>>>>>> origin/main
            if (nextItem) {
                console.log('[Lia 360] Next item classes:', nextItem.className);
                console.log('[Lia 360] Next item parent:', nextItem.parentElement?.getAttribute('data-testid'));
            }

<<<<<<< HEAD
            // Check for Next buttons with aria-label
            const nextButtons = document.querySelectorAll('button[aria-label="Next"]');
            console.log('[Lia 360] Total Next buttons found:', nextButtons.length);

            nextButtons.forEach((button, index) => {
                const isDisabled = button.disabled ||
                    button.getAttribute('aria-disabled') === 'true' ||
                    button.classList.contains('artdeco-button--disabled');
                const parentLi = button.closest('li');
                const parentUl = button.closest('ul');
                const inPaginationList = parentUl && parentUl.getAttribute('data-testid') === 'pagination-controls-list';

                console.log(`[Lia 360] Next button ${index}:`, {
                    disabled: button.disabled,
                    ariaDisabled: button.getAttribute('aria-disabled'),
                    hasDisabledClass: button.classList.contains('artdeco-button--disabled'),
=======
            // STRATEGY 3: Check for next button
            const allNextButtons = document.querySelectorAll('button[aria-label="Next"]');
            console.log('[Lia 360] Total Next buttons found:', allNextButtons.length);

            allNextButtons.forEach((btn, index) => {
                const isDisabled = btn.disabled ||
                                 btn.getAttribute('aria-disabled') === 'true' ||
                                 btn.classList.contains('artdeco-button--disabled');

                const parentLi = btn.closest('li');
                const parentUl = btn.closest('ul');
                const inPaginationList = parentUl && parentUl.getAttribute('data-testid') === 'pagination-controls-list';

                console.log(`[Lia 360] Next button ${index}:`, {
                    disabled: btn.disabled,
                    ariaDisabled: btn.getAttribute('aria-disabled'),
                    hasDisabledClass: btn.classList.contains('artdeco-button--disabled'),
>>>>>>> origin/main
                    isDisabled: isDisabled,
                    inPaginationList: inPaginationList,
                    parentLiClass: parentLi?.className,
                    parentUlDataTestId: parentUl?.getAttribute('data-testid'),
<<<<<<< HEAD
                    devId: button.getAttribute('data-dev-id'),
                    classes: button.className
=======
                    devId: btn.getAttribute('data-dev-id'),
                    classes: btn.className
>>>>>>> origin/main
                });
            });

            // Check if pagination is visible
<<<<<<< HEAD
            const paginationVisible = paginationList && isElementVisible(paginationList);
            console.log('[Lia 360] Pagination visible in viewport:', paginationVisible);

            // Check page dimensions
            const bodyHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            console.log('[Lia 360] Page dimensions:', {
                bodyHeight: bodyHeight,
                viewportHeight: viewportHeight,
=======
            const paginationVisible = paginationList && this.isElementVisible(paginationList);
            console.log('[Lia 360] Pagination visible in viewport:', paginationVisible);

            // Check if pagination is at bottom of page
            const bodyHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            console.log('[Lia 360] Page dimensions:', {
                bodyHeight,
                viewportHeight,
>>>>>>> origin/main
                ratio: viewportHeight / bodyHeight
            });

            console.log('[Lia 360] === End Pagination Debug ===');
        }
<<<<<<< HEAD

        // Expose public API
        window.LiaSelectors = {
            findScrollableContainer,
            findConnectionCards,
            isElementVisible,
            debugPaginationStructure
        };

        console.log('[Lia 360] Selectors module loaded');
    }

    // Start initialization when dependencies are ready
    initWhenReady();
=======
    };

    console.log('[Lia 360] Selectors module loaded');
>>>>>>> origin/main
})();
