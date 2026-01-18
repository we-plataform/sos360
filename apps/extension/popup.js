// Popup script

const SUPPORTED_PLATFORMS = {
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'linkedin.com': 'linkedin',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
};

let currentPlatform = null;
let currentTab = null;

// DOM elements
const loggedOutEl = document.getElementById('logged-out');
const loggedInEl = document.getElementById('logged-in');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const platformBadge = document.getElementById('platform-badge');
const importBtn = document.getElementById('import-btn');
const openDashboardBtn = document.getElementById('open-dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');
const actionMessage = document.getElementById('action-message');
const leadsTodayEl = document.getElementById('leads-today');
const leadsMonthEl = document.getElementById('leads-month');

// Auto Mode Elements
const autoKeywordsInput = document.getElementById('auto-keywords');
const autoCriteriaInput = document.getElementById('auto-criteria');
const startAutoBtn = document.getElementById('start-auto-btn');
const stopAutoBtn = document.getElementById('stop-auto-btn');
const autoStatusBadge = document.getElementById('auto-status-badge');
const autoStatusMsg = document.getElementById('auto-status-msg');
const autoProgressBar = document.getElementById('auto-progress-bar');
const autoProgressContainer = document.getElementById('auto-progress');
const autoDetailedStatus = document.getElementById('auto-detailed-status');

// Initialize popup
async function init() {
  // Check if user is logged in
  const response = await chrome.runtime.sendMessage({ action: 'getUser' });

  if (response.success) {
    showLoggedIn(response.data);
    await checkCurrentTab();
    await loadStats();
    await loadAutoCheck();
  } else {
    showLoggedOut();
  }
}

function showLoggedIn(user) {
  loggedOutEl.classList.remove('active');
  loggedInEl.classList.add('active');

  const initials = user.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  userAvatar.textContent = initials;
  userName.textContent = user.fullName;
  userEmail.textContent = user.email;
}

function showLoggedOut() {
  loggedOutEl.classList.add('active');
  loggedInEl.classList.remove('active');
}

async function checkCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab?.url) {
    updateStatus('disconnected', 'Nenhuma página detectada');
    return;
  }

  const url = new URL(tab.url);
  const host = url.hostname.replace('www.', '');

  for (const [domain, platform] of Object.entries(SUPPORTED_PLATFORMS)) {
    if (host.includes(domain)) {
      currentPlatform = platform;
      updateStatus('connected', 'Plataforma detectada');
      platformBadge.textContent = platform.charAt(0).toUpperCase() + platform.slice(1);
      platformBadge.style.display = 'inline-flex';
      importBtn.disabled = false;
      return;
    }
  }

  updateStatus('disconnected', 'Plataforma não suportada');
  platformBadge.style.display = 'none';
  importBtn.disabled = true;
}

function updateStatus(status, text) {
  statusDot.className = `status-dot ${status}`;
  statusText.textContent = text;
}

function showMessage(type, text) {
  actionMessage.className = type;
  actionMessage.textContent = text;
  actionMessage.style.display = 'block';

  setTimeout(() => {
    actionMessage.style.display = 'none';
  }, 3000);
}

async function loadStats() {
  // Load stats from storage
  const result = await chrome.storage.local.get(['leadsToday', 'leadsMonth']);
  leadsTodayEl.textContent = result.leadsToday || 0;
  leadsMonthEl.textContent = result.leadsMonth || 0;
}

// Auto Mode Logic
async function loadAutoCheck() {
  const result = await chrome.storage.local.get(['autoModeState', 'autoKeywords', 'autoCriteria']);
  const state = result.autoModeState || { status: 'IDLE', message: '' };

  if (result.autoKeywords) {
    autoKeywordsInput.value = result.autoKeywords;
  }

  if (result.autoCriteria) {
    autoCriteriaInput.value = result.autoCriteria;
  }

  updateAutoUI(state);
}

function updateAutoUI(state) {
  const isRunning = state.status !== 'IDLE' && state.status !== 'STOPPED';

  if (isRunning) {
    startAutoBtn.style.display = 'none';
    stopAutoBtn.style.display = 'block';
    importBtn.disabled = true;
    autoKeywordsInput.disabled = true;
    autoCriteriaInput.disabled = true;
    autoStatusBadge.textContent = 'Rodando';
    autoStatusBadge.className = 'auto-mode-status active';
    autoStatusMsg.textContent = state.message || getStatusMessage(state.status);

    // Update progress
    autoProgressContainer.style.display = 'block';

    if (state.progress !== undefined) {
      autoProgressBar.style.width = `${state.progress}%`;
    } else {
      autoProgressBar.style.width = '100%';
      autoProgressBar.classList.add('indeterminate'); // If we had animation
    }

    autoDetailedStatus.style.display = 'block';
    autoDetailedStatus.textContent = state.detailedStatus || '';

  } else {
    startAutoBtn.style.display = 'block';
    stopAutoBtn.style.display = 'none';
    importBtn.disabled = false;
    autoKeywordsInput.disabled = false;
    autoCriteriaInput.disabled = false;
    autoStatusBadge.textContent = 'Parado';
    autoStatusBadge.className = 'auto-mode-status';
    autoStatusMsg.textContent = state.message || '';

    // Hide progress
    autoProgressContainer.style.display = 'none';
    autoDetailedStatus.style.display = 'none';
  }
}

function getStatusMessage(status) {
  switch (status) {
    case 'NAVIGATING_TO_SEARCH': return 'Navegando para busca...';
    case 'COLLECTING_POSTS': return 'Coletando posts...';
    case 'VISITING_PROFILE': return 'Visitando perfil...';
    case 'EXTRACTING_DATA': return 'Extraindo dados...';
    case 'ANALYZING_LEAD': return 'Analisando qualificação com AI...';
    case 'NEXT_KEYWORD': return 'Próxima palavra-chave...';
    default: return '';
  }
}

// Event listeners
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Entrando...';
  loginError.style.display = 'none';

  const response = await chrome.runtime.sendMessage({
    action: 'login',
    data: { email, password },
  });

  if (response.success) {
    showLoggedIn(response.data.user);
    await checkCurrentTab();
    loadStats();
  } else {
    loginError.textContent = response.error || 'Erro ao fazer login';
    loginError.style.display = 'block';
  }

  loginBtn.disabled = false;
  loginBtn.textContent = 'Entrar';
});

importBtn.addEventListener('click', async () => {
  if (!currentPlatform || !currentTab) return;

  importBtn.disabled = true;
  importBtn.textContent = 'Importando...';

  try {
    // Send message to content script to extract leads
    const extractResponse = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'extractLeads',
    });

    if (!extractResponse.success || !extractResponse.data?.length) {
      showMessage('error', 'Nenhum lead encontrado nesta página');
      return;
    }

    // Send leads to API
    const importResponse = await chrome.runtime.sendMessage({
      action: 'importLeads',
      data: {
        source: 'extension',
        platform: currentPlatform,
        sourceUrl: currentTab.url,
        leads: extractResponse.data,
      },
    });

    if (importResponse.success) {
      const result = importResponse.data.result || { imported: extractResponse.data.length };
      showMessage('success', `${result.imported} leads importados com sucesso!`);

      // Update stats
      const stats = await chrome.storage.local.get(['leadsToday', 'leadsMonth']);
      await chrome.storage.local.set({
        leadsToday: (stats.leadsToday || 0) + result.imported,
        leadsMonth: (stats.leadsMonth || 0) + result.imported,
      });
      loadStats();
    } else {
      showMessage('error', importResponse.error || 'Erro ao importar leads');
    }
  } catch (error) {
    showMessage('error', 'Erro ao extrair leads da página');
    console.error(error);
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = 'Importar Leads desta Página';
  }
});

openDashboardBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
});

logoutBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.runtime.sendMessage({ action: 'logout' });
  showLoggedOut();
});

// Auto Mode Event Listeners
startAutoBtn.addEventListener('click', async () => {
  const keywords = autoKeywordsInput.value.trim();
  const criteria = autoCriteriaInput.value.trim();

  if (!keywords) {
    alert('Por favor, insira pelo menos uma palavra-chave.');
    return;
  }

  await chrome.storage.local.set({ autoKeywords: keywords, autoCriteria: criteria });

  chrome.runtime.sendMessage({
    action: 'startAutoMode',
    keywords: keywords.split('\n').map(k => k.trim()).filter(Boolean),
    criteria: criteria
  });

  updateAutoUI({ status: 'STARTING', message: 'Iniciando...' });
});

stopAutoBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopAutoMode' });
  updateAutoUI({ status: 'IDLE', message: 'Parando...' });
});

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'autoModeUpdate') {
    updateAutoUI(message.state);
  }
});

// Initialize
init();
