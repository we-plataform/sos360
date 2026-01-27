/**
 * LiaChrome Bridge Helper - Lia 360 Extension
 * Bridges page context to Chrome extension APIs
 * Provides window.LiaChrome API for page-level scripts
 */
(function() {
    'use strict';

    // Prevent double initialization
    if (window.LiaChrome) {
        console.log('[LiaChrome Bridge] Already initialized, skipping...');
        return;
    }

    /**
     * LiaChrome Bridge API
     * Provides access to Chrome extension APIs from page context
     */
    const LiaChrome = {
        /**
         * Runtime messaging API
         */
        runtime: {
            /**
             * Send message to background script
             * @param {string|object} message - Message to send
             * @returns {Promise<any>} Response from background script
             */
            sendMessage: function(message) {
                return new Promise((resolve, reject) => {
                    const messageId = 'lia-chrome-msg-' + Date.now() + '-' + Math.random();

                    // Set up one-time listener for response
                    const responseHandler = function(event) {
                        if (event.data && event.data.type === 'lia-chrome-response' && event.data.messageId === messageId) {
                            window.removeEventListener('message', responseHandler);
                            if (event.data.error) {
                                reject(new Error(event.data.error));
                            } else {
                                resolve(event.data.response);
                            }
                        }
                    };

                    window.addEventListener('message', responseHandler);

                    // Send message to content script via postMessage
                    window.postMessage({
                        type: 'lia-chrome-message',
                        messageId: messageId,
                        message: message
                    }, '*');

                    // Timeout after 10 seconds
                    setTimeout(() => {
                        window.removeEventListener('message', responseHandler);
                        reject(new Error('LiaChrome: Message timeout'));
                    }, 10000);
                });
            }
        },

        /**
         * Storage API (local)
         */
        storage: {
            local: {
                /**
                 * Get items from storage
                 * @param {string|string[]} keys - Keys to retrieve
                 * @returns {Promise<object>} Storage items
                 */
                get: function(keys) {
                    return LiaChrome.runtime.sendMessage({
                        action: 'storage.get',
                        keys: keys
                    });
                },

                /**
                 * Set items in storage
                 * @param {object} items - Items to store
                 * @returns {Promise<void>}
                 */
                set: function(items) {
                    return LiaChrome.runtime.sendMessage({
                        action: 'storage.set',
                        items: items
                    });
                },

                /**
                 * Remove items from storage
                 * @param {string|string[]} keys - Keys to remove
                 * @returns {Promise<void>}
                 */
                remove: function(keys) {
                    return LiaChrome.runtime.sendMessage({
                        action: 'storage.remove',
                        keys: keys
                    });
                },

                /**
                 * Clear all items from storage
                 * @returns {Promise<void>}
                 */
                clear: function() {
                    return LiaChrome.runtime.sendMessage({
                        action: 'storage.clear'
                    });
                }
            }
        },

        /**
         * Event forwarding for Chrome extension events
         */
        onMessage: {
            addListener: function(callback) {
                window.addEventListener('message', function(event) {
                    if (event.data && event.data.type === 'lia-chrome-event') {
                        callback(event.data.event, event.data.sender);
                    }
                });
            }
        }
    };

    // Expose to page context
    window.LiaChrome = LiaChrome;

    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('lia-chrome-ready', {
        detail: {
            version: '1.0.0',
            timestamp: Date.now()
        }
    }));

    console.log('[LiaChrome Bridge] Initialized successfully');

})();
