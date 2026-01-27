/**
 * LinkedIn State - Lia 360
 * Manages automation state and persistence.
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading State module...');

    // Check if LRUMap is available (loaded by bootstrap before this module)
    const LRUMap = window.LiaLRUMap?.LRUMap;
    if (!LRUMap) {
        console.warn('[Lia 360] LRUMap not available, using regular Map (potential memory leak)');
    }

    // Initial State
    const state = {
        isAutoScrolling: false,
        isBulkScanning: false,
        qualifiedLeads: LRUMap
            ? new LRUMap({ maxSize: 500, name: 'LinkedInQualifiedLeads' })
            : new Map(), // Note: Map is not directly JSON serializable
        keywords: [],
        totalConnectionsFound: 0,
        scannedHistoryCount: 0,
        selectedAudience: null,
        audiences: [],
        pipelines: [],
        selectedPipeline: null,
        selectedStage: null,
    };

    if (LRUMap) {
        console.log('[Lia 360] Using LRU Map for qualifiedLeads (max 500 entries)');
    }

    window.LiaState = {
        get: () => state,

        // Setters for reactive UI updates could go here, but for now we expose direct access patterns
        // to match original script logic, but properly grouped.

        set: (key, value) => {
            state[key] = value;
        },

        saveState: async function () {
            // Use toArray() if LRUMap, otherwise use Array.from
            const serializedLeads = state.qualifiedLeads.toArray
                ? state.qualifiedLeads.toArray()
                : Array.from(state.qualifiedLeads.entries());

            const data = {
                isBulkScanning: state.isBulkScanning,
                qualifiedLeads: serializedLeads,
                scannedHistoryCount: state.totalConnectionsFound,
                selectedAudience: state.selectedAudience,
                timestamp: Date.now()
            };
            await chrome.storage.local.set({ 'sos_linkedin_state': data });
            console.log('[Lia 360] Estado salvo para paginação. Total:', state.totalConnectionsFound);
        },

        restoreState: async function () {
            try {
                const result = await chrome.storage.local.get('sos_linkedin_state');
                const data = result.sos_linkedin_state;

                if (data && (Date.now() - data.timestamp < 30 * 60 * 1000)) {
                    if (data.isBulkScanning) {
                        state.isBulkScanning = true;

                        // Use fromArray() if LRUMap, otherwise use new Map()
                        if (state.qualifiedLeads.fromArray) {
                            state.qualifiedLeads.fromArray(data.qualifiedLeads);
                        } else {
                            state.qualifiedLeads = new Map(data.qualifiedLeads);
                        }

                        state.scannedHistoryCount = data.scannedHistoryCount || 0;
                        state.totalConnectionsFound = state.scannedHistoryCount;
                        state.selectedAudience = data.selectedAudience;
                        console.log(`[Lia 360] Estado restaurado: ${state.qualifiedLeads.size} leads qualificados. Total escaneado prev: ${state.scannedHistoryCount}`);
                        return true;
                    }
                }
            } catch (e) {
                console.warn('[Lia 360] Erro restaurando estado:', e);
            }
            return false;
        },

        clearState: async function () {
            await chrome.storage.local.remove('sos_linkedin_state');
            state.isBulkScanning = false;
            state.scannedHistoryCount = 0;
            state.totalConnectionsFound = 0;
            state.qualifiedLeads.clear();
            // Logic to update UI would need to be triggered here or by caller
            console.log('[Lia 360] Estado completamente limpo');
        }
    };

    console.log('[Lia 360] State Module Loaded');
})();
