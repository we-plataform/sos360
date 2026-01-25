/**
 * Settings Manager - Lia 360
 * Handles storage, retrieval, and defaults for extension settings.
 * Designed to be shared across content scripts.
 */
(function () {
    // Prevent double initialization
    if (window.LiaSettings) return;

    const DEFAULT_SETTINGS = {
        // Facebook
        facebook_comments: true,
        facebook_events: true,
        facebook_friends: true,
        facebook_friendRequests: true,
        facebook_groupMembers: true,
        facebook_likes: true,
        facebook_messages: true,
        facebook_messengerOverlay: true,
        facebook_metaAdsSearch: true,
        facebook_pages: true,
        facebook_poll: true,
        facebook_posts: true,
        facebook_profile: true,
        facebook_searchPages: true,
        facebook_searchPeople: true,
        facebook_storyViewers: true,
        facebook_autoEnrich: true,

        // Instagram
        instagram_followers: true,
        instagram_following: true,
        instagram_comments: true,
        instagram_likes: true,
        instagram_hashtags: true,
        instagram_locations: true,
        instagram_autoScroll: true,

        // LinkedIn
        linkedin_connections: true,
        linkedin_searchPeople: true,
        linkedin_postLikes: true,
        linkedin_postComments: true,
        linkedin_events: true,
        linkedin_deepScan: false
    };

    class SettingsManager {
        constructor() {
            this.defaults = DEFAULT_SETTINGS;
            this.cache = null;
            this.initPromise = this.refreshCache();
        }

        /**
         * Refresh local cache from storage
         */
        async refreshCache() {
            try {
                const stored = await chrome.storage.local.get('settings');
                this.cache = { ...this.defaults, ...(stored.settings || {}) };
                return this.cache;
            } catch (e) {
                console.error('[Lia Settings] Failed to refresh settings:', e);
                this.cache = { ...this.defaults };
                return this.cache;
            }
        }

        /**
         * Get all settings, merging with defaults
         */
        async getAll() {
            if (!this.cache) await this.initPromise;
            return this.cache;
        }

        /**
         * Get a specific setting (synchronous-like preference if cached)
         * Returns promise to be safe
         * @param {string} key
         */
        async get(key) {
            const all = await this.getAll();
            return all[key];
        }

        /**
         * Save a specific setting
         * @param {string} key
         * @param {any} value
         */
        async set(key, value) {
            const all = await this.getAll();
            all[key] = value;
            this.cache = all; // Optimistic update
            await chrome.storage.local.set({ settings: all });
            this.notifyChange(all);
        }

        /**
         * Save multiple settings
         * @param {object} updates
         */
        async setMultiple(updates) {
            const all = await this.getAll();
            const newSettings = { ...all, ...updates };
            this.cache = newSettings;
            await chrome.storage.local.set({ settings: newSettings });
            this.notifyChange(newSettings);
        }

        /**
         * Reset to defaults
         */
        async reset() {
            this.cache = { ...this.defaults };
            await chrome.storage.local.set({ settings: this.defaults });
            this.notifyChange(this.defaults);
            return this.defaults;
        }

        notifyChange(settings) {
            console.log('[Lia Settings] Settings updated:', settings);
            window.dispatchEvent(new CustomEvent('lia-settings-changed', { detail: settings }));
        }

        /**
         * Utility to cleanup keys for UI mapping
         * e.g. "facebook_comments" -> { network: "facebook", id: "comments" }
         */
        static parseKey(key) {
            const parts = key.split('_');
            if (parts.length < 2) return null;
            return {
                network: parts[0],
                id: parts.slice(1).join('_')
            };
        }
    }

    // Expose globally
    window.LiaSettings = new SettingsManager();
    console.log('[Lia Settings] Manager initialized');

})();
