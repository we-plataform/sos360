/**
 * LRU Map - Lia 360
 * A Map wrapper with size limits and LRU (Least Recently Used) eviction.
 * Designed to prevent memory leaks from unbounded Map growth.
 */
(function () {
    'use strict';

    // Prevent double initialization
    if (window.LiaLRUMap) return;

    /**
     * LRU Map class with automatic eviction
     * @class
     */
    class LRUMap {
        /**
         * Create an LRU Map
         * @param {object} options - Configuration options
         * @param {number} options.maxSize - Maximum number of entries (default: 500)
         * @param {string} options.name - Map name for debugging (default: 'LRUMap')
         */
        constructor(options = {}) {
            const { maxSize = 500, name = 'LRUMap' } = options;

            this.maxSize = maxSize;
            this.name = name;
            this._map = new Map();
            this._accessOrder = new Map(); // Tracks last access time

            console.log(`[Lia LRUMap] Created "${name}" with max size: ${maxSize}`);
        }

        /**
         * Set a value (evicts oldest if at capacity)
         * @param {any} key - The key
         * @param {any} value - The value
         */
        set(key, value) {
            // If at capacity and key doesn't exist, evict oldest
            if (this._map.size >= this.maxSize && !this._map.has(key)) {
                this._evictOldest();
            }

            this._map.set(key, value);
            this._accessOrder.set(key, Date.now());
        }

        /**
         * Get a value (updates access time)
         * @param {any} key - The key
         * @returns {any|undefined} The value or undefined if not found
         */
        get(key) {
            if (this._map.has(key)) {
                this._accessOrder.set(key, Date.now());
                return this._map.get(key);
            }
            return undefined;
        }

        /**
         * Check if key exists
         * @param {any} key - The key
         * @returns {boolean} True if key exists
         */
        has(key) {
            return this._map.has(key);
        }

        /**
         * Delete a key
         * @param {any} key - The key
         * @returns {boolean} True if key existed and was deleted
         */
        delete(key) {
            this._accessOrder.delete(key);
            return this._map.delete(key);
        }

        /**
         * Clear all entries
         */
        clear() {
            this._map.clear();
            this._accessOrder.clear();
            console.log(`[Lia LRUMap] Cleared "${this.name}"`);
        }

        /**
         * Get current size
         * @returns {number} Number of entries
         */
        get size() {
            return this._map.size;
        }

        /**
         * Convert to array (for serialization)
         * @returns {Array} Array of [key, value] pairs
         */
        toArray() {
            return Array.from(this._map.entries());
        }

        /**
         * Load entries from array (for deserialization)
         * @param {Array} entries - Array of [key, value] pairs
         */
        fromArray(entries) {
            this.clear();
            for (const [key, value] of entries) {
                // Bypass set() to avoid eviction during load
                this._map.set(key, value);
                this._accessOrder.set(key, Date.now());
            }
            console.log(`[Lia LRUMap] Loaded "${this.name}" with ${this._map.size} entries`);
        }

        /**
         * Evict the least recently used entry
         * @private
         */
        _evictOldest() {
            let oldestKey = null;
            let oldestTime = Infinity;

            // Find the least recently accessed entry
            for (const [key, time] of this._accessOrder.entries()) {
                if (time < oldestTime) {
                    oldestTime = time;
                    oldestKey = key;
                }
            }

            if (oldestKey !== null) {
                this._map.delete(oldestKey);
                this._accessOrder.delete(oldestKey);

                if (this._map.size % 100 === 0) {
                    console.log(
                        `[Lia LRUMap] Evicted oldest from "${this.name}" ` +
                        `(size: ${this._map.size}/${this.maxSize})`
                    );
                }
            }
        }

        /**
         * Get statistics about the map
         * @returns {object} Stats object
         */
        getStats() {
            return {
                name: this.name,
                size: this._map.size,
                maxSize: this.maxSize,
                usagePercent: ((this._map.size / this.maxSize) * 100).toFixed(1)
            };
        }
    }

    // Expose globally
    window.LiaLRUMap = { LRUMap };
    console.log('[Lia LRUMap] Module loaded');

})();
