// Background service worker

const API_URL = 'http://localhost:3001';

// Storage helpers
async function getToken() {
  const result = await chrome.storage.local.get(['accessToken']);
  return result.accessToken;
}

async function setToken(token) {
  await chrome.storage.local.set({ accessToken: token });
}

async function clearToken() {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'user']);
}

// API helpers
async function apiRequest(endpoint, options = {}) {
  const token = await getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const url = `${API_URL}${endpoint}`;
  console.log('[SOS 360] API Request:', url, { method: options.method || 'GET' });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    console.log('[SOS 360] API Response:', response.status, response.statusText);

    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`API returned non-JSON: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      const errorMessage = data?.error?.detail || data?.error?.message || data?.message || 'API request failed';
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('[SOS 360] API Error:', error);
    
    // Network errors, CORS errors, etc.
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      throw new Error('Não foi possível conectar à API. Verifique se a API está rodando em http://localhost:3001');
    }
    // CORS errors
    if (error.message.includes('CORS') || error.message.includes('Not allowed')) {
      throw new Error('Erro de CORS. Verifique se a API permite requisições da extensão.');
    }
    throw error;
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'login': {
          const response = await apiRequest('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify(request.data),
          });
          await chrome.storage.local.set({
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            user: response.data.user,
          });
          sendResponse({ success: true, data: response.data });
          break;
        }

        case 'logout': {
          await clearToken();
          sendResponse({ success: true });
          break;
        }

        case 'getUser': {
          const result = await chrome.storage.local.get(['user', 'accessToken']);
          if (result.accessToken && result.user) {
            sendResponse({ success: true, data: result.user });
          } else {
            sendResponse({ success: false, error: 'Not logged in' });
          }
          break;
        }

        case 'importLeads': {
          const response = await apiRequest('/api/v1/leads/import', {
            method: 'POST',
            body: JSON.stringify(request.data),
          });
          sendResponse({ success: true, data: response.data });
          break;
        }

        case 'getTags': {
          const response = await apiRequest('/api/v1/tags');
          sendResponse({ success: true, data: response.data });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: 'import-profile',
      title: 'Importar perfil para SOS 360',
      contexts: ['link'],
      documentUrlPatterns: [
        '*://*.instagram.com/*',
        '*://*.facebook.com/*',
        '*://*.linkedin.com/*',
      ],
    });
  } catch (error) {
    console.warn('Could not create context menu:', error);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'import-profile') {
    // Send message to content script to extract profile
    chrome.tabs.sendMessage(tab.id, {
      action: 'extractProfile',
      url: info.linkUrl,
    });
  }
});

console.log('SOS 360 Extension loaded');
