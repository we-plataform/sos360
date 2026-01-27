/**
 * Bootstrap Loader - Lia 360
 * Lightweight script that dynamically loads platform-specific modules.
 * Implements lazy loading to reduce initial load time and memory usage.
 */
(function () {
    'use strict';

    // Prevent double initialization
    if (window.LiaBootstrap) {
        console.log('[Lia Bootstrap] Already initialized, skipping...');
        return;
    }

    /**
     * Platform detection and module configuration
     */
    const PLATFORM_CONFIG = {
        instagram: {
            patterns: [/instagram\.com/, /instagram\.com\/.+/],
            scripts: [
                'content-scripts/instagram/utils.js',
                'content-scripts/instagram/profile-import.js',
                'content-scripts/instagram/post-import.js',
                'content-scripts/instagram/followers-import.js',
                'content-scripts/instagram/ui.js',
                'content-scripts/instagram.js'
            ],
            name: 'Instagram'
        },
        linkedin: {
            patterns: [/linkedin\.com/, /linkedin\.com\/.+/],
            scripts: [
                'content-scripts/linkedin-utils.js',
                'content-scripts/linkedin-state.js',
                'content-scripts/linkedin-selectors.js',
                'content-scripts/linkedin-extractors.js',
                'content-scripts/linkedin-dom.js',
                'content-scripts/linkedin-ui.js',
                'content-scripts/linkedin-core.js'
            ],
            name: 'LinkedIn'
        },
        facebook: {
            patterns: [/facebook\.com/, /facebook\.com\/.+/],
            scripts: [
                'content-scripts/facebook.js'
            ],
            name: 'Facebook'
        },
        dashboard: {
            patterns: [
                /localhost:3000/,
                /vercel\.app/,
                /render\.com/,
                /onrender\.com/
            ],
            scripts: [
                'content-scripts/dashboard-sync.js'
            ],
            name: 'Dashboard'
        }
    };

    class BootstrapLoader {
        constructor() {
            this.loadedScripts = new Set();
            this.currentPlatform = null;
            this.loadStartTime = performance.now();
        }

        /**
         * Detect current platform based on hostname
         */
        detectPlatform() {
            const hostname = window.location.hostname;
            const href = window.location.href;

            for (const [platformKey, config] of Object.entries(PLATFORM_CONFIG)) {
                for (const pattern of config.patterns) {
                    if (pattern.test(hostname) || pattern.test(href)) {
                        console.log(`[Lia Bootstrap] Platform detected: ${config.name}`);
                        return platformKey;
                    }
                }
            }

            console.log('[Lia Bootstrap] No matching platform detected');
            return null;
        }

        /**
         * Dynamically load a script file
         * @param {string} scriptPath - Path relative to extension root
         * @returns {Promise<void>}
         */
        async loadScript(scriptPath) {
            // Skip if already loaded
            if (this.loadedScripts.has(scriptPath)) {
                console.log(`[Lia Bootstrap] Script already loaded: ${scriptPath}`);
                return;
            }

            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                const scriptUrl = chrome.runtime.getURL(scriptPath);

                script.src = scriptUrl;
                script.onload = () => {
                    this.loadedScripts.add(scriptPath);
                    console.log(`[Lia Bootstrap] ✓ Loaded: ${scriptPath}`);
                    resolve();
                };

                script.onerror = (error) => {
                    console.error(`[Lia Bootstrap] ✗ Failed to load: ${scriptPath}`, error);
                    reject(error);
                };

                // Insert script into DOM
                (document.head || document.documentElement).appendChild(script);
            });
        }

        /**
         * Load all scripts for a platform sequentially
         * Scripts are loaded in order to ensure dependencies are available
         * @param {string} platformKey - Platform identifier
         * @returns {Promise<void>}
         */
        async loadPlatformScripts(platformKey) {
            const config = PLATFORM_CONFIG[platformKey];

            if (!config) {
                console.error(`[Lia Bootstrap] Unknown platform: ${platformKey}`);
                return;
            }

            console.log(`[Lia Bootstrap] Loading ${config.scripts.length} ${config.name} modules sequentially...`);

            for (const scriptPath of config.scripts) {
                try {
                    await this.loadScript(scriptPath);
                } catch (error) {
                    console.error(`[Lia Bootstrap] Error loading ${scriptPath}:`, error);
                    // Continue loading other scripts even if one fails
                }
            }

            console.log(`[Lia Bootstrap] ${config.name} platform loaded successfully`);
        }

        /**
         * Initialize the bootstrap loader
         */
        async init() {
            try {
                // Detect platform
                this.currentPlatform = this.detectPlatform();

                if (!this.currentPlatform) {
                    console.log('[Lia Bootstrap] Not a supported platform, exiting...');
                    return;
                }

                // Load platform-specific scripts
                await this.loadPlatformScripts(this.currentPlatform);

                // Report load time
                const loadTime = performance.now() - this.loadStartTime;
                console.log(`[Lia Bootstrap] Platform initialization completed in ${loadTime.toFixed(2)}ms`);

                // Notify that loading is complete
                window.dispatchEvent(new CustomEvent('lia-bootstrap-complete', {
                    detail: {
                        platform: this.currentPlatform,
                        loadTime: loadTime,
                        scriptsLoaded: Array.from(this.loadedScripts)
                    }
                }));

            } catch (error) {
                console.error('[Lia Bootstrap] Initialization failed:', error);

                // Dispatch error event
                window.dispatchEvent(new CustomEvent('lia-bootstrap-error', {
                    detail: { error: error.message }
                }));
            }
        }

        /**
         * Get current platform information
         */
        getPlatformInfo() {
            return {
                platform: this.currentPlatform,
                scriptsLoaded: Array.from(this.loadedScripts),
                loadTime: performance.now() - this.loadStartTime
            };
        }
    }

    // Expose globally
    window.LiaBootstrap = new BootstrapLoader();

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.LiaBootstrap.init();
        });
    } else {
        // DOM already ready
        window.LiaBootstrap.init();
    }

    console.log('[Lia Bootstrap] Manager initialized');

})();
