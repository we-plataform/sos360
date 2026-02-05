/**
 * LRU Map - Lia 360
 * Least Recently Used (LRU) cache implementation.
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading LRU Map module...');

    /**
     * LRU Cache implementation
     */
    class LRUMap {
        /**
         * @param {number} maxSize - Maximum number of entries
         */
        constructor(maxSize = 100) {
            this.maxSize = maxSize;
            this.cache = new Map();
        }

        /**
         * Get a value from the cache
         * @param {string} key - Cache key
         * @returns {*} Cached value or undefined
         */
        get(key) {
            if (!this.cache.has(key)) {
                return undefined;
            }

            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }

        /**
         * Set a value in the cache
         * @param {string} key - Cache key
         * @param {*} value - Value to cache
         */
        set(key, value) {
            // Remove if exists (will be re-added at end)
            if (this.cache.has(key)) {
                this.cache.delete(key);
            }

            // Add to cache
            this.cache.set(key, value);

            // Evict oldest if at capacity
            if (this.cache.size > this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
        }

        /**
         * Check if key exists in cache
         * @param {string} key - Cache key
         * @returns {boolean} True if key exists
         */
        has(key) {
            return this.cache.has(key);
        }

        /**
         * Delete a key from cache
         * @param {string} key - Cache key
         * @returns {boolean} True if key was deleted
         */
        delete(key) {
            return this.cache.delete(key);
        }

        /**
         * Clear all entries from cache
         */
        clear() {
            this.cache.clear();
        }

        /**
         * Get current cache size
         * @returns {number} Number of entries
         */
        get size() {
            return this.cache.size;
        }

        /**
         * Get all keys in cache
         * @returns {string[]} Array of keys
         */
        keys() {
            return Array.from(this.cache.keys());
        }

        /**
         * Get all values in cache
         * @returns {Array} Array of values
         */
        values() {
            return Array.from(this.cache.values());
        }

        /**
         * Get all entries in cache
         * @returns {Array} Array of [key, value] pairs
         */
        entries() {
            return Array.from(this.cache.entries());
        }
    }

    // Expose globally
    window.LRUMap = LRUMap;

    console.log('[Lia 360] LRU Map module loaded');
})();
