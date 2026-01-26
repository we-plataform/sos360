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
        }
    };

    console.log('[Lia 360] UI Module Loaded');
})();
