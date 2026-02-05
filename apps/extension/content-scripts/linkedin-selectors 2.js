/**
 * LinkedIn Selectors - Lia 360
 * DOM traversal and element finding functions.
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading Selectors module...');

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
                '.scaffold-layout__main',
                '.scaffold-finite-scroll__content',
                'main',
                '.authentication-outlet',
                '[data-finite-scroll-hotkey-context]',
                '.qa-scaffold-layout__main',
                '#voyager-feed'
            ];

            for (const selector of candidates) {
                const el = document.querySelector(selector);
                if (el) {
                    const style = window.getComputedStyle(el);
                    const overflowY = style.overflowY;
                    const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;

                    if (isScrollable && el.scrollHeight > 500) {
                        console.log(`[Lia 360] Found scrollable via selector ${selector}: scrollHeight=${el.scrollHeight}`);
                        return el;
                    }
                }
            }

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
                    }
                }
            }

            if (bestCandidate) {
                console.log(`[Lia 360] Found largest scrollable element: ${bestCandidate.className.substring(0, 50)}...`);
                return bestCandidate;
            }

            if (document.body.scrollHeight > window.innerHeight) {
                return document.documentElement;
            }

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

                let card = link.closest('li');
                if (!card) {
                    card = link.closest('[class*="card"]') ||
                        link.closest('[class*="entity"]') ||
                        link.closest('[class*="list-item"]') ||
                        link.closest('.artdeco-list__item');
                }
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
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        },

        /**
         * Debug pagination structure - helps identify LinkedIn's pagination elements
         */
        debugPaginationStructure: function() {
            console.log('[Lia 360] === Pagination Debug ===');

            // STRATEGY 1: Check for data-testid="pagination-controls-list" (PRIMARY)
            const paginationList = document.querySelector('ul[data-testid="pagination-controls-list"]');
            console.log('[Lia 360] Pagination list (data-testid) found:', !!paginationList);

            if (paginationList) {
                console.log('[Lia 360] Pagination list details:', {
                    tagName: paginationList.tagName,
                    dataTestId: paginationList.getAttribute('data-testid'),
                    classes: paginationList.className,
                    childCount: paginationList.children.length
                });

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
                    });
                });
            }

            // STRATEGY 2: Check for next button item
            const nextItem = document.querySelector('.artdeco-pagination__item--next');
            console.log('[Lia 360] Next pagination item found:', !!nextItem);
            if (nextItem) {
                console.log('[Lia 360] Next item classes:', nextItem.className);
                console.log('[Lia 360] Next item parent:', nextItem.parentElement?.getAttribute('data-testid'));
            }

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
                    isDisabled: isDisabled,
                    inPaginationList: inPaginationList,
                    parentLiClass: parentLi?.className,
                    parentUlDataTestId: parentUl?.getAttribute('data-testid'),
                    devId: btn.getAttribute('data-dev-id'),
                    classes: btn.className
                });
            });

            // Check if pagination is visible
            const paginationVisible = paginationList && this.isElementVisible(paginationList);
            console.log('[Lia 360] Pagination visible in viewport:', paginationVisible);

            // Check if pagination is at bottom of page
            const bodyHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            console.log('[Lia 360] Page dimensions:', {
                bodyHeight,
                viewportHeight,
                ratio: viewportHeight / bodyHeight
            });

            console.log('[Lia 360] === End Pagination Debug ===');
        }
    };

    console.log('[Lia 360] Selectors module loaded');
})();
