/**
 * Settings Overlay Controller
 * Injected into the active tab to display settings interface
 */

(function () {
    // --- Check if already injected ---
    if (window.LiaOverlay) {
        window.LiaOverlay.toggle();
        return;
    }

    // --- Constants ---
    const SOCIAL_NETWORKS = [
        {
            id: 'facebook',
            name: 'Facebook',
            color: '#1877f2',
            icon: '<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.6c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.438C19.612 23.094 24 18.1 24 12.073z" fill="currentColor"/>'
        },
        {
            id: 'instagram',
            name: 'Instagram',
            color: '#E1306C',
            icon: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" fill="currentColor"/>'
        },
        {
            id: 'linkedin',
            name: 'LinkedIn',
            color: '#0077b5',
            icon: '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="currentColor"/>'
        },
        {
            id: 'twitter',
            name: 'X / Twitter',
            color: '#000000',
            icon: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" fill="currentColor"/>'
        },
        {
            id: 'tiktok',
            name: 'TikTok',
            color: '#000000',
            icon: '<path d="M16.6 5.82C15.6 5.82 15 5.22 15 4.02V0H11.2V14.82C11.2 17.92 9.00001 20.22 6.00001 20.22C3.10001 20.22 0.900009 18.02 0.900009 15.02C0.900009 12.02 3.00001 9.82 6.00001 9.82C6.30001 9.82 6.70001 9.82 7.00001 10.02V13.72C6.70001 13.62 6.50001 13.52 6.10001 13.52C5.30001 13.52 4.80001 14.12 4.80001 15.02C4.80001 16.02 5.40001 16.62 6.20001 16.62C7.50001 16.62 8.40001 15.42 8.40001 13.62V5.82C9.90001 7.12 11.8 7.62 14.3 7.82V4.22C14.3 5.32 15.1 5.82 16.6 5.82Z" transform="translate(4 2)" fill="currentColor"/>'
        },
        {
            id: 'telegram',
            name: 'Telegram',
            color: '#0088cc',
            icon: '<path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.568 8.077l-2.074 9.947c-.156.741-.607.921-1.229.573l-3.413-2.52-1.646 1.589c-.183.183-.337.337-.69.337l.246-3.473 6.32-5.71c.275-.245-.06-.38-.427-.136l-7.81 4.92-3.37-.803c-.732-.229-.747-.732.153-1.084l13.16-5.07c.609-.228 1.14.137.78.83z" fill="currentColor"/>'
        },
        {
            id: 'whatsapp',
            name: 'WhatsApp',
            color: '#25D366',
            icon: '<path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.985a9.96 9.96 0 0 0 1.503 5.31l-1.639 5.912 6.115-1.59a9.924 9.924 0 0 0 4.011.854h.004c5.505 0 9.988-4.478 9.989-9.985A9.99 9.99 0 0 0 12.012 2zm5.955 14.372c-.245.688-1.424 1.314-1.954 1.357-.502.04-.77.086-1.782-.33a10.57 10.57 0 0 1-5.187-4.52c-1.12-1.666-.025-2.89.569-3.497.23-.23.502-.45.753-.45.207 0 .42.003.555.334.205.495.69 1.688.75 1.81.06.124.1.272.013.435-.084.159-.142.23-.27.382-.128.152-.284.218-.127.48.337.564 1.488 2.06 2.622 3.064.442.392.836.43 1.11.43.14-.143.606-.704.77-.946.216-.316.432-.258.736-.145.305.112 1.957.922 2.292 1.087.335.166.559.248.64.389.08.139.08.81-.166 1.498z" fill="currentColor"/>'
        },
    ];

    const SETTINGS_schema = {
        facebook: {
            imports: [
                { id: 'comments', label: 'Comments' },
                { id: 'events', label: 'Events' },
                { id: 'friends', label: 'Friends' },
                { id: 'friendRequests', label: 'Friend Requests Sent' },
                { id: 'groupMembers', label: 'Group Members' },
                { id: 'likes', label: 'Likes' },
                { id: 'messages', label: 'Messages' },
                { id: 'messengerOverlay', label: 'Messenger Overlay' },
                { id: 'metaAdsSearch', label: 'Meta Ads Search', new: true },
                { id: 'pages', label: 'Page' },
                { id: 'poll', label: 'Poll' },
                { id: 'posts', label: 'Post' },
                { id: 'profile', label: 'Profile' },
                { id: 'searchPages', label: 'Search Pages' },
                { id: 'searchPeople', label: 'Search People' },
                { id: 'storyViewers', label: 'Story Viewers', new: true },
            ],
            other: [
                { id: 'autoEnrich', label: 'Automatically Enrich Lead Information when opening a Profile' }
            ]
        },
        instagram: {
            imports: [
                { id: 'followers', label: 'Followers' },
                { id: 'following', label: 'Following' },
                { id: 'comments', label: 'Post Comments' },
                { id: 'likes', label: 'Post Likes' },
                { id: 'hashtags', label: 'Hashtag Search' },
                { id: 'locations', label: 'Location Search' },
            ],
            other: [
                { id: 'autoScroll', label: 'Enable Auto-Scroll for long list extraction' }
            ]
        },
        linkedin: {
            imports: [
                { id: 'connections', label: 'Connections' },
                { id: 'searchPeople', label: 'Search People' },
                { id: 'postLikes', label: 'Post Likes' },
                { id: 'postComments', label: 'Post Comments' },
                { id: 'events', label: 'Event Attendees' },
            ],
            other: [
                { id: 'deepScan', label: 'Deep Scan (Visit profile for full details)' }
            ]
        }
    };

    class SettingsOverlay {
        constructor() {
            this.init();
        }

        async init() {
            // Create Shadow Host
            this.host = document.createElement('div');
            this.host.id = 'lia-overlay-host';
            document.body.appendChild(this.host);

            // Create Shadow Root
            this.shadow = this.host.attachShadow({ mode: 'open' });

            // Load CSS
            const link = document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute('href', chrome.runtime.getURL('styles/overlay.css'));
            this.shadow.appendChild(link);

            // Open Overlay
            await this.checkAuthStatus();
            this.toggle(true);
        }

        async checkAuthStatus() {
            const { accessToken, user } = await chrome.storage.local.get(['accessToken', 'user']);
            this.isLoggedIn = !!accessToken;
            this.user = user || {};

            if (this.isLoggedIn) {
                // Fetch fresh user profile
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'GET_USER_PROFILE' });
                    if (response && response.success && response.user) {
                        this.user = response.user;
                    } else if (response && response.loggedOut) {
                        // Background claims we are logged out (e.g. 401)
                        this.isLoggedIn = false;
                        this.user = {};
                    }
                } catch (e) {
                    console.error('[Lia 360] Failed to refresh user profile:', e);
                }
            }

            this.render();
            if (this.isLoggedIn) {
                this.fetchLeadCount();
                this.loadSettings();
            }
        }

        async loadSettings() {
            try {
                if (window.LiaSettings) {
                    this.settings = await window.LiaSettings.getAll();
                    this.render(); // Re-render to show correct checkbox states
                }
            } catch (e) {
                console.error('[Lia 360] Failed to load settings:', e);
            }
        }

        async fetchLeadCount() {
            try {
                console.log('[Lia 360] Fetching lead count...');
                const response = await chrome.runtime.sendMessage({ action: 'GET_LEAD_COUNT' });
                console.log('[Lia 360] Lead count response:', response);

                if (response && response.success) {
                    const statsEl = this.shadow.querySelector('.lia-user-stats');
                    if (statsEl) {
                        statsEl.textContent = `Leads: ${response.count}`;
                    } else {
                        console.error('[Lia 360] Stats element not found');
                    }
                } else {
                    console.error('[Lia 360] Lead count fetch failed:', response?.error);
                    const statsEl = this.shadow.querySelector('.lia-user-stats');
                    if (statsEl) statsEl.textContent = `Leads: Error`;
                }
            } catch (e) {
                console.error('[Lia 360] Error fetching lead count:', e);
            }
        }

        render() {
            // Preserve visibility state
            const existingContainer = this.shadow.querySelector('.lia-overlay-container');
            const wasVisible = existingContainer && existingContainer.style.display !== 'none';

            // Clean previous render if any (except CSS)
            if (existingContainer) existingContainer.remove();

            const container = document.createElement('div');
            container.className = 'lia-overlay-container';
            // Logic: if it was visible, keep it visible. If undefined (first render), start hidden unless managed by toggle
            container.style.display = wasVisible ? 'flex' : 'none';

            // Inner HTML based on Auth Status
            const cardClass = this.isLoggedIn ? 'lia-overlay-card lia-card-wide' : 'lia-overlay-card';

            container.innerHTML = `
        <div class="lia-overlay-backdrop"></div>
        <div class="${cardClass}">
          ${this.isLoggedIn ? this.renderLoggedInUI() : this.renderLoginUI()}
        </div>
      `;

            this.shadow.appendChild(container);
            this.container = container;

            // Attach Event Listeners
            this.attachEvents();

            // Select first tab if logged in
            if (this.isLoggedIn) {
                this.selectTab('facebook');
            }
        }

        renderHeader(title) {
            return `
        <div class="lia-overlay-header">
            <div class="lia-header-left">
              <div class="lia-logo">LIA</div>
              <div class="lia-user-info">
                ${this.isLoggedIn
                    ? `<span class="lia-user-name">Welcome, ${this.user.fullName || this.user.name || 'User'}</span>
                     <span class="lia-user-stats">Leads: Loading...</span>`
                    : `<span class="lia-user-name">Lia 360</span>
                     <span class="lia-user-stats">Importador de Leads</span>`
                }
              </div>
            </div>
            <button class="lia-close-btn" id="closeBtn">✕</button>
          </div>
        `;
        }

        renderLoginUI() {
            return `
        <div class="lia-login-frame">
            <div class="lia-login-navbar">
                <span></span>
                <button class="lia-close-btn-ghost" id="closeBtn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            
            <div class="lia-login-header-section">
                <div class="lia-brand-mark">LIA</div>
                <h1 class="lia-login-title">System Access</h1>
                <p class="lia-login-subtitle">Initialize session to continue</p>
            </div>
            
            <div class="lia-login-body">
                <div class="lia-error-msg" id="loginError"></div>
                <form id="loginForm" class="lia-login-form">
                    <div class="lia-input-group">
                        <input type="email" class="lia-input" id="emailInput" placeholder=" " required autocomplete="off" />
                        <label class="lia-floating-label">Email identifier</label>
                        <div class="lia-input-border"></div>
                    </div>
                    
                    <div class="lia-input-group">
                        <input type="password" class="lia-input" id="passwordInput" placeholder=" " required autocomplete="off" />
                        <label class="lia-floating-label">Passkey</label>
                        <div class="lia-input-border"></div>
                    </div>
                    
                    <button type="submit" class="lia-btn-submit">
                        <span class="lia-btn-content">Authenticate</span>
                        <div class="lia-btn-shine"></div>
                    </button>
                </form>
            </div>
            
            <div class="lia-login-footer">
                <div class="lia-status-indicator">
                    <div class="lia-pulse-dot"></div>
                    <span>Secure Connection</span>
                </div>
            </div>
        </div>
      `;
        }

        renderLoggedInUI() {
            const tabsHtml = SOCIAL_NETWORKS.map(net => `
        <div class="lia-tab" data-tab="${net.id}" title="${net.name}" style="--active-color: ${net.color}">
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor; overflow: visible;">${net.icon}</svg>
        </div>
      `).join('');

            return `
          ${this.renderHeader('Extension Settings')}
          
          <div class="lia-quick-toggles">
            <span class="lia-toggle-label">EXTENSION SETTINGS:</span>
            <div class="lia-setting-item">
                <input type="checkbox" id="enableAllFeatures" checked>
                <label for="enableAllFeatures" style="font-weight: 600; color: #111827;">Enable All Features</label>
            </div>
          </div>

          <div class="lia-tabs">
            ${tabsHtml}
          </div>

          <div class="lia-tab-content-container" id="tabContent">
            <!-- Dynamic Content -->
          </div>

          <div class="lia-overlay-footer">
             <button class="lia-overlay-settings-btn">MESSAGES OVERLAY SETTINGS</button>
             <div class="lia-footer-actions">
                <button class="lia-btn-primary" id="applyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                    Apply Changes
                </button>
                <button class="lia-btn-secondary" id="resetBtn">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                    Reset
                </button>
             </div>
          </div>
      `;
        }

        renderTabContent(networkId) {
            const schema = SETTINGS_schema[networkId];
            const netInfo = SOCIAL_NETWORKS.find(n => n.id === networkId);

            if (!schema) {
                return `<div style="text-align: center; color: #9ca3af; padding: 40px;">No settings available for ${netInfo.name} yet.</div>`;
            }

            const renderItems = (items) => items.map(item => {
                const settingKey = `${networkId}_${item.id}`;
                // Default to true if settings not loaded yet, or if setting is true
                const isChecked = this.settings ? this.settings[settingKey] !== false : true;

                return `
            <div class="lia-setting-item">
                <input type="checkbox" id="set-${networkId}-${item.id}" ${isChecked ? 'checked' : ''}>
                <label for="set-${networkId}-${item.id}">
                    ${item.label}
                    ${item.new ? '<span class="lia-badge-new">New</span>' : ''}
                </label>
            </div>
        `}).join('');

            return `
            <div class="lia-panel-card">
                 <div class="lia-panel-header">
                    <input type="checkbox" id="enable-all-${networkId}" checked>
                    <strong class="lia-panel-title">Enable All for ${netInfo.name}</strong>
                 </div>
                 <div class="lia-panel-body">
                    <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">Or choose which features to enable:</p>
                    
                    <div class="lia-settings-grid">
                        ${schema.imports && schema.imports.length > 0 ? `
                            <div class="lia-section-title">Imports</div>
                            ${renderItems(schema.imports)}
                        ` : ''}
                        
                        ${schema.other && schema.other.length > 0 ? `
                             <div class="lia-section-title" style="margin-top: 16px;">Other Settings</div>
                             ${renderItems(schema.other)}
                        ` : ''}
                    </div>
                 </div>
            </div>
        `;
        }

        selectTab(tabId) {
            // UI
            this.shadow.querySelectorAll('.lia-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === tabId);
                if (t.dataset.tab === tabId) {
                    // Set color via JS because pseudo-elements/custom-props in shadow dom can be tricky with complex selectors
                    t.style.color = t.style.getPropertyValue('--active-color');
                } else {
                    t.style.color = '';
                }
            });

            // Content
            const contentContainer = this.shadow.getElementById('tabContent');
            if (contentContainer) {
                contentContainer.innerHTML = this.renderTabContent(tabId);
            }
        }

        attachEvents() {
            // Close Button
            const closeBtn = this.shadow.getElementById('closeBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('[Lia 360] Close button clicked');
                    this.toggle(false);
                });
            }

            // Backdrop Click
            const backdrop = this.shadow.querySelector('.lia-overlay-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', (e) => {
                    console.log('[Lia 360] Backdrop clicked');
                    this.toggle(false);
                });
            }

            // Escape Key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.container && this.container.style.display !== 'none') {
                    this.toggle(false);
                }
            });

            // Tabs
            this.shadow.querySelectorAll('.lia-tab').forEach(tab => {
                tab.onclick = () => this.selectTab(tab.dataset.tab);
            });

            // Login
            const loginForm = this.shadow.getElementById('loginForm');
            if (loginForm) {
                loginForm.onsubmit = (e) => this.handleLogin(e);
            }
            // Settings Buttons
            const applyBtn = this.shadow.getElementById('applyBtn');
            if (applyBtn) {
                applyBtn.onclick = () => this.saveSettings();
            }

            const resetBtn = this.shadow.getElementById('resetBtn');
            if (resetBtn) {
                resetBtn.onclick = () => this.resetSettings();
            }
        }

        async saveSettings() {
            const applyBtn = this.shadow.getElementById('applyBtn');
            const originalText = applyBtn.innerHTML;
            applyBtn.textContent = 'Saving...';
            applyBtn.disabled = true;

            try {
                const updates = {};

                // Iterate through schema to find checkboxes
                for (const [networkId, schema] of Object.entries(SETTINGS_schema)) {
                    const allItems = [...(schema.imports || []), ...(schema.other || [])];
                    for (const item of allItems) {
                        const checkboxId = `set-${networkId}-${item.id}`;
                        const checkbox = this.shadow.getElementById(checkboxId);
                        if (checkbox) {
                            updates[`${networkId}_${item.id}`] = checkbox.checked;
                        }
                    }
                }

                if (window.LiaSettings) {
                    await window.LiaSettings.setMultiple(updates);
                    // Update local cache
                    this.settings = await window.LiaSettings.getAll();
                }

                applyBtn.innerHTML = '<span style="display:flex;align-items:center;gap:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Saved!</span>';

                setTimeout(() => {
                    applyBtn.disabled = false;
                    applyBtn.innerHTML = originalText;
                }, 1500);

            } catch (e) {
                console.error('Failed to save settings:', e);
                applyBtn.textContent = 'Error';
                setTimeout(() => {
                    applyBtn.disabled = false;
                    applyBtn.innerHTML = originalText;
                }, 2000);
            }
        }

        async resetSettings() {
            if (confirm('Are you sure you want to reset all settings to default?')) {
                if (window.LiaSettings) {
                    this.settings = await window.LiaSettings.reset();
                    this.render();
                }
            }
        }

        async handleLogin(e) {
            e.preventDefault();
            const email = this.shadow.getElementById('emailInput').value;
            const password = this.shadow.getElementById('passwordInput').value;
            const errorDiv = this.shadow.getElementById('loginError');

            try {
                // Basic validation
                if (!email || !password) throw new Error('Fill all fields');

                const storageData = await chrome.storage.local.get(['apiUrl']);
                const apiUrl = (storageData.apiUrl || 'http://localhost:3001') + '/api/v1/auth/login';

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) throw new Error(data.message || 'Login failed');

                // Save token
                await chrome.storage.local.set({
                    accessToken: data.data.accessToken,
                    refreshToken: data.data.refreshToken,
                    user: data.data.user
                });

                // Get dynamic API URL if available
                const stored = await chrome.storage.local.get(['apiUrl']);
                if (stored.apiUrl) {
                    await chrome.storage.local.set({ apiUrl: stored.apiUrl });
                }

                // Refresh UI
                await this.checkAuthStatus();

            } catch (err) {
                errorDiv.textContent = err.message;
                errorDiv.style.display = 'block';
            }
        }

        async toggle(forceState) {
            if (this.container) {
                const isHidden = this.container.style.display === 'none';
                const newState = forceState !== undefined ? forceState : isHidden;

                if (newState) {
                    await this.checkAuthStatus(); // Refresh status before showing
                }

                this.container.style.display = newState ? 'flex' : 'none';
            }
        }
    }

    // --- Singleton ---
    if (!window.LiaOverlay) {
        window.LiaOverlay = new SettingsOverlay();
    } else {
        window.LiaOverlay.toggle(true);
    }

    // Listen for background messages
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'toggleSettingsOverlay') {
            if (window.LiaOverlay) window.LiaOverlay.toggle();
        }
    });

})();
