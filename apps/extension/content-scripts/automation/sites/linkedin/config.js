/**
 * LinkedIn Connection Mining Config (v2)
 * Declarative state machine for mining connections.
 */
export const LinkedInConnectionMiningConfig = {
    initialState: 'SCROLL_BOTTOM',
    states: {
        SCROLL_BOTTOM: {
            // Action: Scroll to bottom to ensure pagination is visible/loaded
            action: 'scroll',
            resolve: { selector: 'body' }, // Target body to scroll window
            next: 'EXTRACT_CARDS'
        },
        EXTRACT_CARDS: {
            // Action: Run custom extraction logic
            action: 'custom',
            params: {
                execute: async (element, context) => {
                    const Extractors = window.LiaExtractors; // Legacy bridge
                    const State = window.LiaState;
                    const UI = window.LiaUI;

                    if (!Extractors || !State) {
                        console.error('Lia globals missing');
                        return false;
                    }

                    // Re-use legacy findConnectionCards as it has complex logic
                    const cards = window.LiaSelectors.findConnectionCards();
                    const state = State.get();

                    // Instantiate Audience Filter if audience is selected
                    const filter = state.selectedAudience ? new window.LiaUtils.AudienceFilter(state.selectedAudience) : null;

                    let newLeads = 0;
                    for (const card of cards) {
                        const lead = Extractors.extractLeadFromCard(card);

                        if (lead) {
                            // Apply Filter if active
                            if (filter) {
                                const isQualified = filter.matches(lead);
                                if (!isQualified) {
                                    // Optional: Debug log
                                    // console.log('[Lia 360] Lead filtered out:', lead.fullName);
                                    continue;
                                }
                            }

                            if (!state.qualifiedLeads.has(lead.profileUrl)) {
                                state.qualifiedLeads.set(lead.profileUrl, lead);
                                newLeads++;

                                // Visual feedback for qualified leads
                                try {
                                    card.style.border = '2px solid #10b981';
                                    if (!card.querySelector('.sos-badge')) {
                                        const badge = document.createElement('div');
                                        badge.className = 'sos-badge';
                                        badge.textContent = '✅';
                                        badge.style.cssText = 'position:absolute; top:5px; right:5px; background:#10b981; color:white; padding:2px 6px; border-radius:4px; font-size:10px; z-index:100;';
                                        card.style.position = 'relative';
                                        card.appendChild(badge);
                                    }
                                } catch (e) { }
                            }
                        }
                    }

                    state.totalConnectionsFound += newLeads;

                    // Update UI (Bridge)
                    if (UI) {
                        if (UI.updateScrollStatus) {
                            UI.updateScrollStatus(`Cards encontrados: ${state.totalConnectionsFound}`, 0);
                        }
                        if (UI.updateUI) {
                            UI.updateUI();
                        }
                    }

                    return true;
                }
            },
            next: 'CHECK_NEXT_PAGE'
        },
        CHECK_NEXT_PAGE: {
            // Decision: Find next button using Resolver v2
            resolve: {
                target: 'next_button',
                // Semantic Layer
                role: 'button',
                name: /next|avançar|próxima|seguinte/i,
                // Text Layer
                text: /next|avançar|próxima|seguinte/i,
                tag: 'button',
                // Selector Layer (Fallback)
                selector: '.artdeco-pagination__item--next button, [aria-label="Next"], [aria-label="Avançar"]'
            },
            onMissing: 'FINISH', // No next button -> Done
            next: 'CLICK_NEXT'   // Found -> Click it
        },
        CLICK_NEXT: {
            action: 'click',
            // re-resolve to get element for clicking
            resolve: {
                role: 'button',
                name: /next|avançar|próxima|seguinte/i,
                text: /next|avançar|próxima|seguinte/i,
                tag: 'button',
                selector: '.artdeco-pagination__item--next button'
            },
            next: 'WAIT_FOR_LOAD'
        },
        WAIT_FOR_LOAD: {
            action: 'wait',
            params: { ms: 4000 }, // Wait for new page load
            next: 'SCROLL_BOTTOM'
        },
        FINISH: {
            action: 'custom',
            params: {
                execute: () => {
                    const UI = window.LiaUI;
                    if (UI) UI.updateScrollStatus('Mineração concluída (v2)', 100);
                    alert('Lia 360: Automação concluída com sucesso!');
                    return true;
                }
            }
        }
    }
};
