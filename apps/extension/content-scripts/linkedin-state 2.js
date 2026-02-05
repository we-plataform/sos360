/**
 * LinkedIn State - Lia 360
 * Manages automation state and persistence.
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading State module...');

    // Initial State
    const state = {
        isAutoScrolling: false,
        isBulkScanning: false,
        qualifiedLeads: new Map(), // Note: Map is not directly JSON serializable
        keywords: [],
        totalConnectionsFound: 0,
        scannedHistoryCount: 0,
        selectedAudience: null,
        audiences: [],
        pipelines: [],
        selectedPipeline: null,
        selectedStage: null,
    };

    window.LiaState = {
        get: () => state,

        // Setters for reactive UI updates could go here, but for now we expose direct access patterns
        // to match original script logic, but properly grouped.

        set: (key, value) => {
            state[key] = value;
        },

        saveState: async function () {
            const serializedLeads = Array.from(state.qualifiedLeads.entries());
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
                        state.qualifiedLeads = new Map(data.qualifiedLeads);
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
