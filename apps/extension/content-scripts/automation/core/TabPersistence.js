import { Logger } from './Logger.js';

/**
 * Tab Persistence
 * Saves automation state to chrome.storage.local keyed by Tab ID.
 * Enables recovery after page reloads.
 */
export class TabPersistence {
    constructor(tabId) {
        this.tabId = tabId; // Pass explicit tab ID or 'current' if running in content script

        // If content script, use window.location as secondary key or allow single-instance
        this.key = `lia_automation_state_${this.tabId || 'local'}`;
        this.logger = new Logger('Persistence');
    }

    async save(state) {
        try {
            const payload = {
                timestamp: Date.now(),
                ...state
            };
            await chrome.storage.local.set({ [this.key]: payload });
            // this.logger.debug('State saved', payload);
        } catch (e) {
            this.logger.error('Failed to save state', e);
        }
    }

    async load() {
        try {
            const result = await chrome.storage.local.get(this.key);
            const data = result[this.key];
            if (data) {
                this.logger.info('State loaded', data);
                return data;
            }
            return null;
        } catch (e) {
            this.logger.error('Failed to load state', e);
            return null;
        }
    }

    async clear() {
        try {
            await chrome.storage.local.remove(this.key);
            this.logger.info('State cleared');
        } catch (e) {
            this.logger.error('Failed to clear state', e);
        }
    }
}
