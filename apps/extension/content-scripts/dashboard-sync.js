// Dashboard Sync Content Script - Lia 360
// This script runs on the Lia 360 dashboard to sync authentication and trigger automations

(function () {
  'use strict';

  console.log('[Lia 360 Sync] Dashboard sync script loaded on:', window.location.href);

  // --- AUTH SYNC ---
  // Automatically sync authentication from frontend to extension

  async function syncAuth() {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (accessToken) {
        console.log('[Lia 360 Sync] Found tokens in localStorage, syncing to extension...');

        // Send tokens to background script
        const response = await chrome.runtime.sendMessage({
          action: 'syncAuth',
          data: {
            accessToken,
            refreshToken
          }
        });

        if (response?.success) {
          console.log('[Lia 360 Sync] Auth synced successfully!');
          showSyncNotification('Extension sincronizada!', 'success');
        } else {
          console.warn('[Lia 360 Sync] Auth sync failed:', response?.error);
        }
      } else {
        console.log('[Lia 360 Sync] No tokens found in localStorage');
      }
    } catch (error) {
      console.error('[Lia 360 Sync] Error syncing auth:', error);
    }
  }

  // --- AUTOMATION TRIGGER LISTENER ---
  // Listen for automation triggers from the dashboard

  window.addEventListener('message', async (event) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;

    const { type, jobId } = event.data || {};

    if (type === 'SOS360_TRIGGER_AUTOMATION') {
      console.log('[Lia 360 Sync] Received automation trigger for job:', jobId);

      try {
        // Trigger immediate poll in background
        const response = await chrome.runtime.sendMessage({
          action: 'triggerImmediatePoll'
        });

        if (response?.success) {
          console.log('[Lia 360 Sync] Immediate poll triggered');
          showSyncNotification('Automação detectada! Abrindo LinkedIn...', 'info');
        }
      } catch (error) {
        console.error('[Lia 360 Sync] Error triggering poll:', error);

        if (error.message.includes('Extension context invalidated')) {
          showSyncNotification('Extensão atualizada. Por favor, recarregue a página.', 'error');
        } else {
          showSyncNotification('Erro ao comunicar com a extensão.', 'error');
        }
      }
    }
  });

  // --- VISUAL FEEDBACK ---

  function showSyncNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('sos360-sync-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'sos360-sync-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, system-ui, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease;
      ">
        <span style="font-size: 18px;">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
        <span>${message}</span>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-100%)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // --- EXTENSION STATUS INDICATOR ---

  async function checkExtensionStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });

      if (response?.success) {
        console.log('[Lia 360 Sync] Extension status:', response);

        // Add visual indicator if not authenticated
        if (!response.isAuthenticated) {
          showAuthWarning();
        }
      }
    } catch (error) {
      console.log('[Lia 360 Sync] Could not check extension status:', error);
    }
  }

  function showAuthWarning() {
    // Check if warning already exists
    if (document.getElementById('sos360-auth-warning')) return;

    const warning = document.createElement('div');
    warning.id = 'sos360-auth-warning';
    warning.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #92400e;
        padding: 16px 20px;
        border-radius: 8px;
        font-family: -apple-system, system-ui, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 999998;
        max-width: 320px;
      ">
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 20px;">⚠️</span>
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">Extensão não autenticada</div>
            <div style="font-size: 12px; opacity: 0.9;">
              A extensão Lia 360 precisa estar logada para executar automações. 
              Clique no ícone da extensão e faça login.
            </div>
            <button id="sos360-sync-now-btn" style="
              margin-top: 8px;
              background: #f59e0b;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
            ">Sincronizar Agora</button>
          </div>
          <button id="sos360-close-warning" style="
            background: none;
            border: none;
            color: #92400e;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            opacity: 0.7;
          ">×</button>
        </div>
      </div>
    `;

    document.body.appendChild(warning);

    // Event listeners
    document.getElementById('sos360-close-warning').addEventListener('click', () => {
      warning.remove();
    });

    document.getElementById('sos360-sync-now-btn').addEventListener('click', async () => {
      await syncAuth();
      warning.remove();
    });
  }

  // --- INITIALIZATION ---

  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  async function init() {
    console.log('[Lia 360 Sync] Initializing...');

    // Small delay to ensure localStorage is populated
    await new Promise(r => setTimeout(r, 500));

    // Sync auth
    await syncAuth();

    // Check extension status
    await checkExtensionStatus();

    // Watch for localStorage changes (e.g., when user logs in)
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
      originalSetItem.apply(this, arguments);

      if (key === 'accessToken' || key === 'refreshToken') {
        console.log('[Lia 360 Sync] Token changed, re-syncing...');
        setTimeout(syncAuth, 100);
      }
    };

    console.log('[Lia 360 Sync] Initialization complete');
  }
})();
