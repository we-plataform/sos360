/**
 * LinkedIn UI - Lia 360
 * Visual components (Overlay, Menu, Dialogs)
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading UI module...');

    const UI_ID = 'sos360-linkedin-overlay';
    const AUTOMATION_OVERLAY_ID = 'sos360-automation-overlay';
    const Utils = window.LiaUtils;
    const State = window.LiaState;

    if (!Utils || !State) {
        console.error('[Lia 360] Missing dependencies (Utils/State). Check load order.');
        return;
    }

    console.log('[Lia 360] UI dependencies OK');

    // --- Automation State ---
    let automationLogs = [];
    let countdownInterval = null;
    let isCountingDown = false;  // Flag to prevent multiple countdowns
    let lastNextStepTime = 0;  // For debouncing NEXT_STEP messages
    const NEXT_STEP_DEBOUNCE_MS = 2000;  // Prevent multiple NEXT_STEP within 2 seconds

    window.LiaUI = {
        UI_ID: UI_ID,

        // --- Styles ---
        getMenuStyles: () => `
        .lia-profile-menu { position: fixed; bottom: 20px; right: 20px; z-index: 10000; font-family: -apple-system, system-ui, sans-serif; }
        .lia-profile-menu-card { background: #1f2937; color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); width: 300px; overflow: hidden; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .lia-profile-menu-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #111827; border-radius: 8px 8px 0 0; border-bottom: 1px solid #374151; }
        .lia-profile-menu-title { font-weight: 600; font-size: 14px; color: #fff; }
        .lia-profile-menu-close { background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; transition: color 0.2s; }
        .lia-profile-menu-close:hover { color: #fff; }
        .lia-profile-menu-body { padding: 16px; }
        .lia-profile-import-btn { width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.2s; }
        .lia-profile-import-btn:hover:not(:disabled) { opacity: 0.9; }
        .lia-profile-import-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .lia-profile-status { margin-top: 12px; font-size: 13px; text-align: center; min-height: 20px; }
        .lia-profile-status.success { color: #10b981; }
        .lia-profile-status.error { color: #ef4444; }
        .lia-profile-status.loading { color: #9ca3af; }
    `,


        // --- Pipeline Dialog Class ---
        PipelineDialog: class {
            constructor() {
                this.dialogId = 'sos-pipeline-dialog';
                this.state = {
                    pipelines: [],
                    selectedPipeline: null,
                    selectedStage: null,
                    leadsToImport: []
                };
                this.isRendered = false;
            }

            render() {
                if (document.getElementById(this.dialogId)) return;

                const dialog = document.createElement('div');
                dialog.id = this.dialogId;
                dialog.className = 'sos-dialog';
                dialog.style.display = 'none';
                dialog.innerHTML = `
                <div class="sos-dialog-overlay"></div>
                <div class="sos-dialog-content">
                  <div class="sos-dialog-header">
                    <span>📁 Selecionar Destino</span>
                    <button class="sos-close-btn" id="sos-dialog-close">&times;</button>
                  </div>
                  <div class="sos-dialog-body">
                    <div class="sos-form-group">
                      <label>Pipeline</label>
                      <select id="sos-pipeline-select">
                        <option value="">Carregando...</option>
                      </select>
                    </div>
                    <div class="sos-form-group">
                      <label>Coluna/Estágio</label>
                      <select id="sos-stage-select" disabled>
                        <option value="">Selecione um pipeline primeiro</option>
                      </select>
                    </div>
                    <div id="sos-import-summary" style="margin-top: 12px; padding: 12px; background: #111827; border-radius: 6px; text-align: center;">
                       <!-- Summary injected here -->
                    </div>
                  </div>
                  <div class="sos-dialog-footer">
                    <button id="sos-cancel-import" class="sos-btn" style="background: #374151;">Cancelar</button>
                    <button id="sos-confirm-import" class="sos-btn sos-btn-action" disabled>
                      Confirmar Importação
                    </button>
                  </div>
                </div>
                ${this.getStyles()}
                `;

                document.body.appendChild(dialog);
                this.bindEvents();
                this.isRendered = true;
            }

            getStyles() {
                return `
                <style>
                  #${this.dialogId} { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483648; display: flex; align-items: center; justify-content: center; font-family: -apple-system, system-ui, sans-serif; }
                  #${this.dialogId} .sos-dialog-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); }
                  #${this.dialogId} .sos-dialog-content { position: relative; background: #1f2937; border-radius: 12px; width: 340px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); animation: sos-dialog-in 0.2s ease; color: white; }
                  @keyframes sos-dialog-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                  #${this.dialogId} .sos-dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #374151; font-weight: 600; }
                  #${this.dialogId} .sos-close-btn { background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; }
                  #${this.dialogId} .sos-close-btn:hover { color: #fff; }
                  #${this.dialogId} .sos-dialog-body { padding: 16px; }
                  #${this.dialogId} .sos-form-group { margin-bottom: 16px; }
                  #${this.dialogId} .sos-form-group label { display: block; margin-bottom: 8px; font-size: 12px; color: #9ca3af; }
                  #${this.dialogId} .sos-form-group select { 
                    width: 100%; 
                    height: 44px;
                    padding: 0 12px;
                    line-height: 44px;
                    box-sizing: border-box;
                    background-color: #374151 !important; 
                    border: 1px solid #4b5563 !important; 
                    border-radius: 6px !important; 
                    color: #fff !important; 
                    font-size: 14px !important; 
                    cursor: pointer; 
                    appearance: none; 
                    -webkit-appearance: none;
                    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    background-size: 10px auto;
                  }
                  #${this.dialogId} .sos-form-group select:disabled { opacity: 0.5; cursor: not-allowed; }
                  #${this.dialogId} .sos-form-group select:focus { outline: none; border-color: #3b82f6; }
                  #${this.dialogId} .sos-dialog-footer { display: flex; gap: 8px; padding: 16px; border-top: 1px solid #374151; }
                  #${this.dialogId} .sos-btn { flex: 1; padding: 10px; border: none; border-radius: 4px; font-weight: 600; font-size: 14px; cursor: pointer; color: white; transition: opacity 0.2s; }
                  #${this.dialogId} .sos-btn:hover:not(:disabled) { opacity: 0.9; }
                  #${this.dialogId} .sos-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                  #${this.dialogId} .sos-btn-action { background: #3b82f6; }
                </style>
                `;
            }

            bindEvents() {
                const dialog = document.getElementById(this.dialogId);
                dialog.querySelector('#sos-dialog-close').onclick = () => this.close();
                dialog.querySelector('#sos-cancel-import').onclick = () => this.close();
                dialog.querySelector('.sos-dialog-overlay').onclick = () => this.close();

                dialog.querySelector('#sos-pipeline-select').onchange = (e) => {
                    this.state.selectedPipeline = e.target.value;
                    this.updateStages(e.target.value);
                };

                dialog.querySelector('#sos-stage-select').onchange = (e) => {
                    this.state.selectedStage = e.target.value;
                    const confirmBtn = dialog.querySelector('#sos-confirm-import');
                    confirmBtn.disabled = !e.target.value;
                };

                dialog.querySelector('#sos-confirm-import').onclick = () => this.confirmImport();
            }

            open(leads) {
                this.render();
                this.state.leadsToImport = Array.isArray(leads) ? leads : [leads];

                const dialog = document.getElementById(this.dialogId);
                const summaryEl = document.getElementById('sos-import-summary');

                summaryEl.innerHTML = `
                    <div style="font-size: 24px; font-weight: bold; color: #10b981;">${this.state.leadsToImport.length}</div>
                    <div style="font-size: 11px; color: #9ca3af;">leads serão importados</div>
                `;

                dialog.style.display = 'flex';
                this.loadPipelines();
            }

            close() {
                const dialog = document.getElementById(this.dialogId);
                if (dialog) dialog.style.display = 'none';
                this.state.selectedPipeline = null;
                this.state.selectedStage = null;
            }

            async loadPipelines() {
                const pipelineSelect = document.getElementById('sos-pipeline-select');
                const stageSelect = document.getElementById('sos-stage-select');
                const confirmBtn = document.getElementById('sos-confirm-import');

                pipelineSelect.innerHTML = '<option value="">Carregando...</option>';
                stageSelect.disabled = true;
                confirmBtn.disabled = true;

                try {
                    const response = await chrome.runtime.sendMessage({ action: 'getPipelines' });
                    if (response.success && response.data) {
                        this.state.pipelines = response.data;
                        pipelineSelect.innerHTML = '<option value="">Selecione um pipeline</option>';

                        this.state.pipelines.forEach(pipeline => {
                            const option = document.createElement('option');
                            option.value = pipeline.id;
                            option.textContent = pipeline.name + (pipeline.isDefault ? ' ⭐' : '');
                            pipelineSelect.appendChild(option);
                        });

                        const defaultPipeline = this.state.pipelines.find(p => p.isDefault);
                        if (defaultPipeline) {
                            pipelineSelect.value = defaultPipeline.id;
                            this.state.selectedPipeline = defaultPipeline.id;
                            this.updateStages(defaultPipeline.id);
                        }
                    } else {
                        pipelineSelect.innerHTML = '<option value="">Erro ao carregar</option>';
                    }
                } catch (e) {
                    console.error('[Lia 360] Erro loading pipelines:', e);
                    pipelineSelect.innerHTML = '<option value="">Erro de conexão</option>';
                }
            }

            updateStages(pipelineId) {
                const stageSelect = document.getElementById('sos-stage-select');
                const confirmBtn = document.getElementById('sos-confirm-import');

                if (!pipelineId) {
                    stageSelect.innerHTML = '<option value="">Selecione um pipeline primeiro</option>';
                    stageSelect.disabled = true;
                    confirmBtn.disabled = true;
                    return;
                }

                const pipeline = this.state.pipelines.find(p => p.id === pipelineId);
                if (!pipeline || !pipeline.stages || pipeline.stages.length === 0) {
                    stageSelect.innerHTML = '<option value="">Nenhuma coluna encontrada</option>';
                    stageSelect.disabled = true;
                    confirmBtn.disabled = true;
                    return;
                }

                stageSelect.innerHTML = '';
                pipeline.stages.forEach(stage => {
                    const option = document.createElement('option');
                    option.value = stage.id;
                    option.textContent = stage.name;
                    stageSelect.appendChild(option);
                });

                stageSelect.disabled = false;
                if (pipeline.stages.length > 0) {
                    stageSelect.value = pipeline.stages[0].id;
                    this.state.selectedStage = pipeline.stages[0].id;
                    confirmBtn.disabled = false;
                }
            }

            async confirmImport() {
                const confirmBtn = document.getElementById('sos-confirm-import');
                const stageId = this.state.selectedStage;

                if (!stageId) return;

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Importando...';

                try {
                    const response = await chrome.runtime.sendMessage({
                        action: 'importLeads',
                        data: {
                            source: 'extension',
                            platform: 'linkedin',
                            sourceUrl: window.location.href,
                            leads: this.state.leadsToImport,
                            pipelineStageId: stageId
                        }
                    });

                    if (response && response.success) {
                        this.close();
                        // Dispatch event for ProfileImportMenu to pick up success
                        window.dispatchEvent(new CustomEvent('lia-import-success', {
                            detail: { count: this.state.leadsToImport.length }
                        }));
                    } else {
                        alert('Erro na importação: ' + (response?.error || 'Unknown error'));
                    }
                } catch (e) {
                    alert('Erro: ' + e.message);
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Confirmar Importação';
                }
            }
        },

        // --- Profile Import Menu Class ---
        ProfileImportMenu: class {
            constructor() {
                this.host = null;
                this.shadow = null;
                this.container = null;
                this.createMenu();
                this.attachEvents();

                // Initialize Pipeline Dialog
                if (!window.LiaUI.pipelineDialog) {
                    window.LiaUI.pipelineDialog = new window.LiaUI.PipelineDialog();
                }

                // Listen for success
                window.addEventListener('lia-import-success', () => this.onImportSuccess());
            }

            createMenu() {
                const existingHost = document.getElementById('lia-profile-menu-host');
                if (existingHost && existingHost.shadowRoot) {
                    this.host = existingHost;
                    this.shadow = this.host.shadowRoot;
                    this.container = this.shadow.querySelector('.lia-profile-menu');
                    return;
                }
                if (existingHost) existingHost.remove();

                this.host = document.createElement('div');
                this.host.id = 'lia-profile-menu-host';
                document.body.appendChild(this.host);

                this.shadow = this.host.attachShadow({ mode: 'open' });
                const style = document.createElement('style');
                style.textContent = window.LiaUI.getMenuStyles();
                this.shadow.appendChild(style);

                this.container = document.createElement('div');
                this.container.className = 'lia-profile-menu';
                this.container.innerHTML = `
          <div class="lia-profile-menu-card">
            <div class="lia-profile-menu-header">
              <span class="lia-profile-menu-title">Importar Perfil</span>
              <button class="lia-profile-menu-close" aria-label="Fechar">×</button>
            </div>
            <div class="lia-profile-menu-body">
              <button class="lia-profile-import-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Importar Perfil
              </button>
            <div class="lia-profile-status"></div>
              <div style="margin-top: 8px; font-size: 11px; color: #6b7280; text-align: center; border-top: 1px solid #374151; padding-top: 8px;">
                     Debug Stats: <span id="lia-debug-followers">Loading...</span>
              </div>
            </div>
          </div>
        `;
                this.shadow.appendChild(this.container);

                // Populate debug stats immediately
                setTimeout(() => {
                    if (window.LiaDOM && window.LiaDOM.getQuickStats) {
                        const stats = window.LiaDOM.getQuickStats();
                        const el = this.shadow.querySelector('#lia-debug-followers');
                        if (el) el.textContent = `${stats.followers} seguidores`;
                    }
                }, 500);
            }

            attachEvents() {
                if (!this.shadow) return;
                this.shadow.querySelector('.lia-profile-menu-close').addEventListener('click', () => this.hide());
                this.shadow.querySelector('.lia-profile-import-btn').addEventListener('click', () => this.startImport());
            }

            async startImport() {
                const btn = this.shadow.querySelector('.lia-profile-import-btn');
                const status = this.shadow.querySelector('.lia-profile-status');
                if (!btn || !status) return;

                btn.disabled = true;
                btn.innerHTML = 'Carregando...';
                status.className = 'lia-profile-status loading';
                status.textContent = 'Extraindo dados...';

                try {
                    const profileData = await window.LiaDOM.extractCurrentProfile();
                    if (!profileData) throw new Error('Não foi possível extrair dados do perfil');

                    // Instead of importing logic directly, open Pipeline Dialog
                    status.textContent = '';
                    status.className = 'lia-profile-status';
                    btn.disabled = false;
                    btn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        Importar Perfil
                    `;

                    if (window.LiaUI.pipelineDialog) {
                        window.LiaUI.pipelineDialog.open(profileData);
                    } else {
                        throw new Error('Pipeline dialog not initialized');
                    }

                } catch (error) {
                    console.error('[Lia 360] Erro ao preparar importação:', error);
                    status.className = 'lia-profile-status error';
                    status.textContent = '✗ ' + error.message;
                    btn.disabled = false;
                    btn.innerHTML = `Importar Perfil`;
                }
            }

            onImportSuccess() {
                const btn = this.shadow.querySelector('.lia-profile-import-btn');
                const status = this.shadow.querySelector('.lia-profile-status');

                status.className = 'lia-profile-status success';
                status.textContent = '✓ Perfil importado com sucesso!';
                btn.innerHTML = '✓ Importado';
                btn.disabled = false;
            }

            show() { if (this.container) this.container.style.display = 'block'; }
            hide() { if (this.container) this.container.style.display = 'none'; }
            remove() { if (this.host) this.host.remove(); }
        },


        // --- Overlay Functions ---
        createOverlay: function () {
            console.log('[Lia 360] createOverlay() called');
            if (document.getElementById(UI_ID)) {
                console.log('[Lia 360] Overlay already exists, showing it');
                document.getElementById(UI_ID).style.display = 'block';
                return;
            }

            console.log('[Lia 360] Creating new overlay element');
            const overlay = document.createElement('div');
            overlay.id = UI_ID;
            overlay.innerHTML = `
                <div class="sos-header">
                    <span class="sos-title">⚡ Connections Mining</span>
                    <button id="sos-close" class="sos-close">&times;</button>
                </div>
                <div class="sos-content">
                    <!-- Audience Selector -->
                    <div class="sos-form-group">
                        <label for="sos-audience-select">Filter by Audience</label>
                        <select id="sos-audience-select">
                            <option value="">All Connections (No Filter)</option>
                        </select>
                    </div>

                    <!-- Stats Panel -->
                    <div class="sos-stats-panel">
                        <div class="sos-stat">
                            <div class="sos-stat-value" id="sos-scanned-count">0</div>
                            <div class="sos-stat-label">Scanned</div>
                        </div>
                        <div class="sos-stat">
                            <div class="sos-stat-value" id="sos-qualified-count">0</div>
                            <div class="sos-stat-label">Qualified</div>
                        </div>
                        <div class="sos-stat">
                            <div class="sos-stat-value" id="sos-filter-rate">0%</div>
                            <div class="sos-stat-label">Match Rate</div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="sos-actions">
                        <button id="sos-start-btn" class="sos-btn sos-btn-primary">▶ Start Mining</button>
                        <button id="sos-stop-btn" class="sos-btn sos-btn-danger" style="display: none;">⏸ Stop</button>
                        <button id="sos-import-btn" class="sos-btn sos-btn-success" disabled>📥 Import (0)</button>
                    </div>
                </div>
                ${this.getOverlayStyles()}
            `;
            document.body.appendChild(overlay);
            console.log('[Lia 360] Overlay added to DOM successfully');
        },

        getOverlayStyles: () => `
            <style>
                #${UI_ID} { position: fixed; bottom: 20px; right: 20px; width: 320px; background: #1f2937; color: white; border-radius: 8px; z-index: 10000; font-family: -apple-system, system-ui, sans-serif; }
                #${UI_ID} .sos-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #111827; border-radius: 8px 8px 0 0; border-bottom: 1px solid #374151; }
                #${UI_ID} .sos-title { font-weight: 600; font-size: 14px; }
                #${UI_ID} .sos-close { background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; }
                #${UI_ID} .sos-close:hover { color: #fff; }
                #${UI_ID} .sos-content { padding: 16px; }

                #${UI_ID} .sos-form-group { margin-bottom: 12px; }
                #${UI_ID} .sos-form-group label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
                #${UI_ID} .sos-form-group select {
                    width: 100%;
                    padding: 8px;
                    background: #374151;
                    border: 1px solid #4b5563;
                    border-radius: 4px;
                    color: white;
                    font-size: 14px;
                }

                #${UI_ID} .sos-stats-panel {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin: 12px 0;
                    padding: 12px;
                    background: #111827;
                    border-radius: 6px;
                }
                #${UI_ID} .sos-stat { text-align: center; }
                #${UI_ID} .sos-stat-value { font-size: 20px; font-weight: bold; color: #10b981; }
                #${UI_ID} .sos-stat-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; margin-top: 2px; }

                #${UI_ID} .sos-actions { display: flex; flex-direction: column; gap: 8px; }
                #${UI_ID} .sos-btn {
                    width: 100%;
                    padding: 10px;
                    border: none;
                    border-radius: 4px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    color: white;
                    transition: opacity 0.2s;
                }
                #${UI_ID} .sos-btn:hover:not(:disabled) { opacity: 0.9; }
                #${UI_ID} .sos-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                #${UI_ID} .sos-btn-primary { background: #3b82f6; }
                #${UI_ID} .sos-btn-danger { background: #ef4444; }
                #${UI_ID} .sos-btn-success { background: #10b981; }
            </style>
        `,

        updateUI: function () {
            const state = window.LiaState.get();

            // Update stats
            const scannedEl = document.getElementById('sos-scanned-count');
            const qualifiedEl = document.getElementById('sos-qualified-count');
            const rateEl = document.getElementById('sos-filter-rate');

            if (scannedEl) scannedEl.textContent = state.totalConnectionsFound;
            if (qualifiedEl) qualifiedEl.textContent = state.qualifiedLeads.size;

            // Calculate match rate
            if (rateEl) {
                const rate = state.totalConnectionsFound > 0
                    ? Math.round((state.qualifiedLeads.size / state.totalConnectionsFound) * 100)
                    : 0;
                rateEl.textContent = rate + '%';
            }

            // Update import button
            const importBtn = document.getElementById('sos-import-btn');
            if (importBtn) {
                importBtn.disabled = state.qualifiedLeads.size === 0;
                importBtn.textContent = `📥 Import (${state.qualifiedLeads.size})`;
            }

            // Update button states
            const startBtn = document.getElementById('sos-start-btn');
            const stopBtn = document.getElementById('sos-stop-btn');

            if (startBtn && stopBtn) {
                if (state.isAutoScrolling) {
                    startBtn.style.display = 'none';
                    stopBtn.style.display = 'inline-block';
                } else {
                    startBtn.style.display = 'inline-block';
                    stopBtn.style.display = 'none';
                }
            }
        },

        loadAudiences: async function () {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'getAudiences' });

                if (response?.success && response.data?.length > 0) {
                    const select = document.getElementById('sos-audience-select');
                    if (!select) return;

                    // Keep default option
                    select.innerHTML = '<option value="">All Connections (No Filter)</option>';

                    response.data.forEach(audience => {
                        const option = document.createElement('option');
                        option.value = audience.id;
                        option.textContent = audience.name;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('[Lia 360] Error loading audiences:', error);
            }
        },

        updateScrollStatus: function(message, progress = null) {
            const overlay = document.getElementById(UI_ID);
            if (!overlay) return;

            // Remove existing status if any
            let statusEl = document.getElementById('sos-scroll-status');
            if (!statusEl) {
                statusEl = document.createElement('div');
                statusEl.id = 'sos-scroll-status';
                statusEl.style.cssText = 'margin-top: 8px; font-size: 11px; color: #9ca3af; text-align: center;';
                overlay.querySelector('.sos-content').appendChild(statusEl);
            }

            statusEl.textContent = message;

            if (progress !== null) {
                statusEl.textContent = `${message} (${progress}%)`;
            }
        },

        // --- Automation Overlay Functions ---
        AUTOMATION_OVERLAY_ID: AUTOMATION_OVERLAY_ID,

        isAutomationActive: function() {
            const overlay = document.getElementById(AUTOMATION_OVERLAY_ID);
            return overlay && overlay.style.display !== 'none';
        },

        createAutomationOverlay: function() {
            if (document.getElementById(AUTOMATION_OVERLAY_ID)) return;

            const overlay = document.createElement('div');
            overlay.id = AUTOMATION_OVERLAY_ID;
            overlay.innerHTML = `
              <div class="sos-auto-header">
                <span class="sos-auto-title">Automation in progress</span>
                <button id="sos-auto-minimize" class="sos-auto-minimize-btn" title="Minimize">─</button>
              </div>

              <div class="sos-auto-body" id="sos-auto-body">
                <div class="sos-auto-progress-section">
                  <div class="sos-auto-progress-header">
                    <span class="sos-auto-spinner"></span>
                    <span id="sos-auto-progress-text">Progress: 0 of 0 Leads</span>
                  </div>
                  <div class="sos-auto-progress-bar-container">
                    <div class="sos-auto-progress-bar" id="sos-auto-progress-bar"></div>
                  </div>
                  <div class="sos-auto-progress-percent" id="sos-auto-progress-percent">0%</div>
                  <div class="sos-auto-time-left" id="sos-auto-time-left">Estimated time left: calculating...</div>
                </div>

                <div class="sos-auto-current-lead" id="sos-auto-current-lead">
                  <div class="sos-auto-lead-placeholder">Aguardando...</div>
                </div>

                <div class="sos-auto-actions">
                  <button id="sos-auto-logs-btn" class="sos-auto-btn sos-auto-btn-secondary">
                    📋 Open Detailed Log
                  </button>
                  <button id="sos-auto-stop-btn" class="sos-auto-btn sos-auto-btn-danger">
                    ⏹ Stop Automation
                  </button>
                </div>

                <div class="sos-auto-warnings">
                  <div class="sos-auto-warning">
                    ⚠️ Keep this page open and visible until the task is completed.
                  </div>
                  <div class="sos-auto-warning">
                    Don't resize the window to avoid switching to mobile layout.
                  </div>
                  <div class="sos-auto-warning">
                    Don't close or minimize the window, or the automation will cancel.
                  </div>
                </div>

                <div class="sos-auto-logs-panel" id="sos-auto-logs-panel" style="display: none;">
                  <div class="sos-auto-logs-header">
                    <span>Detailed Logs</span>
                    <button id="sos-auto-logs-close" class="sos-auto-close-btn">×</button>
                  </div>
                  <div class="sos-auto-logs-content" id="sos-auto-logs-content">
                    <div class="sos-auto-log-empty">No logs yet...</div>
                  </div>
                </div>
              </div>

              <style>
                #${AUTOMATION_OVERLAY_ID} {
                  position: fixed;
                  top: 80px;
                  right: 20px;
                  width: 320px;
                  background: #1f2937;
                  color: #fff;
                  border-radius: 12px;
                  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                  z-index: 2147483647;
                  font-family: -apple-system, system-ui, sans-serif;
                  overflow: hidden;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 12px 16px;
                  background: #374151;
                  border-bottom: 1px solid #4b5563;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-title {
                  font-weight: 600;
                  font-size: 14px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-minimize-btn {
                  background: none;
                  border: none;
                  color: #9ca3af;
                  font-size: 16px;
                  cursor: pointer;
                  padding: 4px 8px;
                  border-radius: 4px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-minimize-btn:hover {
                  background: #4b5563;
                  color: #fff;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-body {
                  padding: 16px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-progress-section {
                  margin-bottom: 16px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-progress-header {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-spinner {
                  width: 16px;
                  height: 16px;
                  border: 2px solid #4b5563;
                  border-top-color: #3b82f6;
                  border-radius: 50%;
                  animation: sos-spin 1s linear infinite;
                }

                @keyframes sos-spin {
                  to { transform: rotate(360deg); }
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-progress-bar-container {
                  height: 8px;
                  background: #374151;
                  border-radius: 4px;
                  overflow: hidden;
                  margin-bottom: 4px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-progress-bar {
                  height: 100%;
                  width: 0%;
                  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                  border-radius: 4px;
                  transition: width 0.3s ease;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-progress-percent {
                  font-size: 12px;
                  color: #9ca3af;
                  text-align: right;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-time-left {
                  font-size: 11px;
                  color: #6b7280;
                  margin-top: 4px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-current-lead {
                  background: #374151;
                  border-radius: 8px;
                  padding: 12px;
                  margin-bottom: 16px;
                  min-height: 60px;
                  display: flex;
                  align-items: center;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-lead-info {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  width: 100%;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-lead-avatar {
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  background: #4b5563;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 16px;
                  font-weight: 600;
                  flex-shrink: 0;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-lead-avatar img {
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  object-fit: cover;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-lead-details {
                  flex: 1;
                  overflow: hidden;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-lead-name {
                  font-weight: 600;
                  font-size: 14px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-lead-headline {
                  font-size: 11px;
                  color: #9ca3af;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-lead-placeholder {
                  color: #6b7280;
                  font-size: 13px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-actions {
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                  margin-bottom: 16px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-btn {
                  width: 100%;
                  padding: 10px 16px;
                  border: none;
                  border-radius: 6px;
                  font-size: 13px;
                  font-weight: 500;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: all 0.2s;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-btn-secondary {
                  background: #374151;
                  color: #fff;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-btn-secondary:hover {
                  background: #4b5563;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-btn-danger {
                  background: #dc2626;
                  color: #fff;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-btn-danger:hover {
                  background: #b91c1c;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-warnings {
                  background: #fef2f2;
                  border-radius: 8px;
                  padding: 12px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-warning {
                  color: #991b1b;
                  font-size: 11px;
                  line-height: 1.4;
                  margin-bottom: 6px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-warning:last-child {
                  margin-bottom: 0;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-logs-panel {
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: #1f2937;
                  z-index: 10;
                  display: flex;
                  flex-direction: column;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-logs-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 12px 16px;
                  background: #374151;
                  border-bottom: 1px solid #4b5563;
                  font-weight: 600;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-close-btn {
                  background: none;
                  border: none;
                  color: #9ca3af;
                  font-size: 20px;
                  cursor: pointer;
                  padding: 0;
                  line-height: 1;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-close-btn:hover {
                  color: #fff;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-logs-content {
                  flex: 1;
                  padding: 12px;
                  overflow-y: auto;
                  font-family: monospace;
                  font-size: 11px;
                  line-height: 1.6;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-log-entry {
                  padding: 4px 0;
                  border-bottom: 1px solid #374151;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-log-time {
                  color: #6b7280;
                  margin-right: 8px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-log-success {
                  color: #10b981;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-log-error {
                  color: #ef4444;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-log-info {
                  color: #9ca3af;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-log-warning {
                  color: #f59e0b;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-log-empty {
                  color: #6b7280;
                  text-align: center;
                  padding: 20px;
                }

                #${AUTOMATION_OVERLAY_ID}.minimized .sos-auto-body {
                  display: none;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-countdown {
                  background: #1e40af;
                  color: #fff;
                  padding: 8px 12px;
                  border-radius: 6px;
                  text-align: center;
                  margin-top: 8px;
                  font-size: 12px;
                }

                #${AUTOMATION_OVERLAY_ID} .sos-auto-countdown-time {
                  font-size: 18px;
                  font-weight: 700;
                  display: block;
                  margin-top: 4px;
                }
              </style>
            `;

            document.body.appendChild(overlay);
            console.log('[Lia 360] Automation overlay created');

            // Event Listeners
            document.getElementById('sos-auto-minimize').addEventListener('click', () => {
                overlay.classList.toggle('minimized');
            });

            document.getElementById('sos-auto-stop-btn').addEventListener('click', async () => {
                const stopBtn = document.getElementById('sos-auto-stop-btn');
                stopBtn.disabled = true;
                stopBtn.textContent = '⏳ Stopping...';
                stopBtn.style.opacity = '0.6';

                window.LiaUI.addLog('Stop requested by user', 'info');

                try {
                    if (!chrome.runtime?.id) {
                        throw new Error('Extension context lost');
                    }

                    chrome.runtime.sendMessage({ action: 'STOP_AUTOMATION' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('[Lia 360] Stop error:', chrome.runtime.lastError.message);
                            window.LiaUI.addLog('Extension disconnected - closing overlay', 'warning');
                            window.LiaUI.hideAutomationOverlay();
                            return;
                        }

                        console.log('[Lia 360] Stop response:', response);
                        window.LiaUI.addLog('Automation stopped successfully', 'success');

                        setTimeout(() => {
                            window.LiaUI.hideAutomationOverlay();
                        }, 1500);
                    });
                } catch (error) {
                    console.error('[Lia 360] Failed to send stop message:', error);
                    window.LiaUI.addLog('Extension context lost - hiding overlay', 'error');
                    setTimeout(() => {
                        window.LiaUI.hideAutomationOverlay();
                    }, 1000);
                }
            });

            document.getElementById('sos-auto-logs-btn').addEventListener('click', () => {
                document.getElementById('sos-auto-logs-panel').style.display = 'flex';
                window.LiaUI.renderLogs();
            });

            document.getElementById('sos-auto-logs-close').addEventListener('click', () => {
                document.getElementById('sos-auto-logs-panel').style.display = 'none';
            });
        },

        showAutomationOverlay: function(state) {
            console.log('[Lia 360] SHOW_OVERLAY received', state);
            this.createAutomationOverlay();

            const overlay = document.getElementById(AUTOMATION_OVERLAY_ID);
            if (!overlay) return;

            overlay.style.display = 'block';
            overlay.classList.remove('minimized');
            console.log('[Lia 360] Automation overlay shown');

            // Update progress
            const { total, current, lead, status } = state;
            const percent = total > 0 ? Math.round((current / total) * 100) : 0;

            const progressText = document.getElementById('sos-auto-progress-text');
            const progressBar = document.getElementById('sos-auto-progress-bar');
            const progressPercent = document.getElementById('sos-auto-progress-percent');
            const timeLeft = document.getElementById('sos-auto-time-left');

            if (progressText) progressText.textContent = `Progress: ${current} of ${total} Leads`;
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressPercent) progressPercent.textContent = `${percent}%`;

            // Estimate time left (assuming ~90 seconds per lead average)
            const remaining = total - current;
            const avgTime = 90; // seconds
            const timeRemaining = remaining * avgTime;
            if (timeLeft) {
                if (remaining > 0) {
                    const mins = Math.floor(timeRemaining / 60);
                    const secs = timeRemaining % 60;
                    timeLeft.textContent = `Estimated time left: ${mins}m ${secs}s`;
                } else {
                    timeLeft.textContent = 'Completing...';
                }
            }

            // Update current lead
            const leadContainer = document.getElementById('sos-auto-current-lead');
            if (leadContainer && lead) {
                const initials = lead.name ? lead.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
                const avatarContent = lead.avatar
                    ? `<img src="${lead.avatar}" alt="${lead.name}" />`
                    : initials;

                leadContainer.innerHTML = `
                  <div class="sos-auto-lead-info">
                    <div class="sos-auto-lead-avatar">${avatarContent}</div>
                    <div class="sos-auto-lead-details">
                      <div class="sos-auto-lead-name">${lead.name || 'Unknown'}</div>
                      <div class="sos-auto-lead-headline">${lead.headline || status || 'Processing...'}</div>
                    </div>
                  </div>
                `;
            }

            // Add log entry
            if (lead && lead.name) {
                this.addLog(`Processing: ${lead.name}`, 'info');
            }
        },

        hideAutomationOverlay: function() {
            console.log('[Lia 360] HIDE_OVERLAY received');
            const overlay = document.getElementById(AUTOMATION_OVERLAY_ID);
            if (overlay) {
                overlay.style.display = 'none';
            }

            // Clear countdown state
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }

            // Reset countdown flags
            isCountingDown = false;
            lastNextStepTime = 0;

            // Clear logs for next automation
            automationLogs = [];
        },

        startWaitCountdown: function(durationSeconds) {
            console.log('[Lia 360] START_WAIT received:', durationSeconds);

            // Prevent multiple countdowns
            if (isCountingDown) {
                console.log('[Lia 360] Countdown already running, ignoring duplicate request');
                return;
            }
            isCountingDown = true;

            const leadContainer = document.getElementById('sos-auto-current-lead');
            if (!leadContainer) {
                isCountingDown = false;
                return;
            }

            // Clear existing countdown interval if any
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }

            let remaining = durationSeconds;

            // Add countdown UI
            let countdownEl = document.getElementById('sos-auto-countdown-display');
            if (!countdownEl) {
                countdownEl = document.createElement('div');
                countdownEl.id = 'sos-auto-countdown-display';
                countdownEl.className = 'sos-auto-countdown';
                leadContainer.parentNode.insertBefore(countdownEl, leadContainer.nextSibling);
            }

            const updateCountdown = () => {
                if (remaining <= 0) {
                    // Clear countdown state
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    isCountingDown = false;
                    if (countdownEl) countdownEl.remove();

                    // Debounce NEXT_STEP to prevent duplicate messages
                    const now = Date.now();
                    if (now - lastNextStepTime < NEXT_STEP_DEBOUNCE_MS) {
                        console.log('[Lia 360] NEXT_STEP debounced, ignoring duplicate within', NEXT_STEP_DEBOUNCE_MS, 'ms');
                        return;
                    }
                    lastNextStepTime = now;

                    // Signal to continue with error handling
                    try {
                        if (!chrome.runtime?.id) {
                            console.error('[Lia 360] Extension context lost during countdown');
                            window.LiaUI.hideAutomationOverlay();
                            return;
                        }

                        chrome.runtime.sendMessage({ action: 'NEXT_STEP' }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error('[Lia 360] NEXT_STEP error:', chrome.runtime.lastError.message);
                                window.LiaUI.addLog('Extension disconnected', 'error');
                                window.LiaUI.hideAutomationOverlay();
                            } else {
                                console.log('[Lia 360] NEXT_STEP sent successfully');
                            }
                        });
                    } catch (error) {
                        console.error('[Lia 360] Failed to send NEXT_STEP:', error);
                        window.LiaUI.hideAutomationOverlay();
                    }
                    return;
                }

                countdownEl.innerHTML = `
                  Waiting before next action...
                  <span class="sos-auto-countdown-time">${remaining}s</span>
                `;
                remaining--;
            };

            updateCountdown();
            countdownInterval = setInterval(updateCountdown, 1000);

            this.addLog(`Waiting ${durationSeconds}s before next action`, 'info');
        },

        addLog: function(message, type = 'info') {
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            automationLogs.push({ time: timeStr, message, type });

            // Keep only last 100 logs
            if (automationLogs.length > 100) {
                automationLogs = automationLogs.slice(-100);
            }

            // Update logs panel if visible
            const logsPanel = document.getElementById('sos-auto-logs-panel');
            if (logsPanel && logsPanel.style.display !== 'none') {
                this.renderLogs();
            }
        },

        renderLogs: function() {
            const logsContent = document.getElementById('sos-auto-logs-content');
            if (!logsContent) return;

            if (automationLogs.length === 0) {
                logsContent.innerHTML = '<div class="sos-auto-log-empty">No logs yet...</div>';
                return;
            }

            logsContent.innerHTML = automationLogs.map(log => `
              <div class="sos-auto-log-entry">
                <span class="sos-auto-log-time">[${log.time}]</span>
                <span class="sos-auto-log-${log.type}">${log.message}</span>
              </div>
            `).join('');

            // Scroll to bottom
            logsContent.scrollTop = logsContent.scrollHeight;
        }
    };

    console.log('[Lia 360] UI Module Loaded');
})();
