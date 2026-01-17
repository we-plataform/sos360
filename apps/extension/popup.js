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

// Initialize popup
async function init() {
  // Check if user is logged in
  const response = await chrome.runtime.sendMessage({ action: 'getUser' });
  
  if (response.success) {
    showLoggedIn(response.data);
    await checkCurrentTab();
    loadStats();
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

// Initialize
init();
