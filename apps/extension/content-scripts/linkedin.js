// LinkedIn content script - SOS 360
// Version 3 - Updated for current LinkedIn UI

(function () {
  'use strict';

  const UI_ID = 'sos360-linkedin-overlay';

  // --- State Management ---
  const state = {
    isAutoScrolling: false,
    qualifiedLeads: new Map(),
    keywords: [],
    totalConnectionsFound: 0,
  };

  // --- Helper Functions ---
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  function parseLinkedInUrl(url) {
    if (!url) return null;
    const href = url.startsWith('http') ? url : `https://www.linkedin.com${url}`;
    const match = href.match(/linkedin\.com\/in\/([^/?]+)/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1]; // Fallback if decoding fails
    }
  }

  /**
   * Formats a LinkedIn username slug into a readable name
   * e.g., "natália-ávila-2062b5251" -> "Natália Ávila"
   */
  function formatUsernameAsName(username) {
    if (!username) return null;
    return username
      .replace(/-[a-f0-9]{6,}$/i, '')  // Remove ID hash at the end
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function matchesKeywords(text, keywords) {
    if (!keywords || keywords.length === 0) return true;
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase().trim()));
  }

  // --- Find scrollable container ---
  function findScrollableContainer() {
    // Strategy 1: Specific known selectors
    const candidates = [
      '.scaffold-layout__main',
      '.scaffold-finite-scroll__content',
      'main',
      '.authentication-outlet',
      '[data-finite-scroll-hotkey-context]',
      '.qa-scaffold-layout__main', // Added potential QA selector
      '#voyager-feed' // Common feed ID
    ];

    for (const selector of candidates) {
      const el = document.querySelector(selector);
      if (el) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;

        if (isScrollable && el.scrollHeight > 500) { // Minimal height sanity check
          console.log(`[SOS 360] Found scrollable via selector ${selector}: scrollHeight=${el.scrollHeight}`);
          return el;
        }
      }
    }

    // Strategy 2: Find the element with the LARGEST scrollHeight in the entire document
    console.log('[SOS 360] Selectors failed, searching for largest scrollable element...');

    let bestCandidate = null;
    let maxScrollHeight = 0;

    // Scan all potential containers
    const allElements = document.querySelectorAll('div, main, section, ul');

    for (const el of allElements) {
      // Micro-optimization: skip elements that obviously aren't containers
      if (el.clientHeight < 100) continue;

      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;

      // Must have scrollable content
      if (scrollHeight > clientHeight + 100) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;

        if (overflowY === 'auto' || overflowY === 'scroll') {
          if (scrollHeight > maxScrollHeight) {
            maxScrollHeight = scrollHeight;
            bestCandidate = el;
          }
        }
      }
    }

    if (bestCandidate) {
      console.log(`[SOS 360] Found largest scrollable element: ${bestCandidate.className.substring(0, 50)}... (Height: ${maxScrollHeight})`);
      return bestCandidate;
    }

    // Fallback to window/document only if body itself is scrollable
    if (document.body.scrollHeight > window.innerHeight) {
      console.log('[SOS 360] No specific container found, using window/document (Body is scrollable)');
      return document.documentElement;
    }

    console.warn('[SOS 360] CRITICAL: Could not find ANY scrollable container. Defaulting to documentElement but scroll may fail.');
    return document.documentElement;
  }

  // --- Find connection cards by finding profile links first ---
  function findConnectionCards() {
    // Find ALL links to LinkedIn profiles on the page
    const profileLinks = document.querySelectorAll('a[href*="/in/"]');
    console.log(`[SOS 360] Found ${profileLinks.length} profile links on page`);

    if (profileLinks.length === 0) {
      return [];
    }

    // Group by closest list item or card container
    const cardMap = new Map();

    for (const link of profileLinks) {
      // Skip if it's a navigation/header link
      if (link.closest('header') || link.closest('nav') || link.closest('.global-nav')) {
        continue;
      }

      // Find the closest containing element that looks like a card
      // LinkedIn uses li elements for list items
      let card = link.closest('li');

      // If no li, try common card container patterns
      if (!card) {
        card = link.closest('[class*="card"]') ||
          link.closest('[class*="entity"]') ||
          link.closest('[class*="list-item"]') ||
          link.closest('.artdeco-list__item');
      }

      // If still nothing, use the link's parent's parent as a reasonable container
      if (!card) {
        card = link.parentElement?.parentElement;
      }

      if (card && !cardMap.has(card)) {
        cardMap.set(card, link);
      }
    }

    const cards = Array.from(cardMap.keys());
    console.log(`[SOS 360] Found ${cards.length} unique card containers`);
    return cards;
  }


  // --- Extraction Logic ---
  function extractSearchResults() {
    const leads = [];
    const cards = document.querySelectorAll('.entity-result__item, .search-result__wrapper');
    cards.forEach(card => {
      try {
        const linkEl = card.querySelector('a[href*="/in/"]');
        if (!linkEl) return;
        const profileUrl = linkEl.href?.split('?')[0];
        const username = parseLinkedInUrl(profileUrl);
        if (!username || leads.some(l => l.username === username)) return;

        leads.push({
          username,
          fullName: getTextContent(card.querySelector('span[aria-hidden="true"]')) || getTextContent(linkEl) || formatUsernameAsName(username),
          profileUrl,
          bio: getTextContent(card.querySelector('.entity-result__primary-subtitle, .search-result__subtitle')),
          avatarUrl: card.querySelector('img')?.src || null,
        });
      } catch (e) { }
    });
    return leads;
  }

  function extractCurrentProfile() {
    const url = window.location.href;
    if (!url.includes('/in/')) return null;
    const username = parseLinkedInUrl(url);
    if (!username) return null;

    // Basic info
    const fullName = getTextContent(document.querySelector('h1')) || formatUsernameAsName(username);

    // Headline/Bio - the professional title under the name
    const headlineEl = document.querySelector('.text-body-medium.break-words');
    const headline = getTextContent(headlineEl);

    // Location
    const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words') ||
      document.querySelector('[class*="top-card"][class*="location"]') ||
      document.querySelector('.pv-text-details__left-panel .text-body-small');
    const location = getTextContent(locationEl);

    // Avatar
    const avatarUrl = document.querySelector('.pv-top-card-profile-picture__image, .profile-photo-edit__preview, img[class*="pv-top-card"]')?.src || null;

    // About section (bio)
    const aboutSection = document.querySelector('#about ~ .display-flex .pv-shared-text-with-see-more, #about ~ div[class*="full-width"] .pv-shared-text-with-see-more');
    const bio = getTextContent(aboutSection) || headline;

    // Experience - try to get current company and position
    let company = null;
    let currentPosition = null;
    const experienceSection = document.querySelector('#experience');
    if (experienceSection) {
      const experienceContainer = experienceSection.closest('section');
      if (experienceContainer) {
        // Get first experience item (most recent)
        const firstExperience = experienceContainer.querySelector('.artdeco-list__item, li[class*="experience"]');
        if (firstExperience) {
          // Company name is usually in a span with specific styling
          const companyEl = firstExperience.querySelector('.t-bold span[aria-hidden="true"]') ||
            firstExperience.querySelector('.hoverable-link-text span[aria-hidden="true"]');
          company = getTextContent(companyEl);

          // Position/title
          const positionEl = firstExperience.querySelector('.t-bold span[aria-hidden="true"]');
          currentPosition = getTextContent(positionEl);
        }
      }
    }

    // If no company from experience, try from headline (often "Position at Company")
    if (!company && headline) {
      const atMatch = headline.match(/(?:at|@|em|na)\s+(.+?)(?:\s*[|·•]|$)/i);
      if (atMatch) {
        company = atMatch[1].trim();
      }
    }

    // Connection count (often synonymous with "Following" or "Network" in early stages, but distinct on profile)
    // We will try to get exact "X followers" which is more valuable than "500+ connections"
    let followersCount = null;
    let followingCount = null; // LinkedIn doesn't always show "Following" count publicly on the main card

    // 1. Try "Followers" from the top card list (usually under location/company)
    // e.g. "5,234 followers" or "500+ connections"
    const topCardListItems = document.querySelectorAll('.pv-top-card--list > li, .pv-top-card--list > span');
    for (const item of topCardListItems) {
      const text = getTextContent(item);
      if (text) {
        if (text.includes('followers') || text.includes('seguidores')) {
          const match = text.match(/(\d+[\d,.]*)/);
          if (match) followersCount = parseInt(match[1].replace(/[^\d]/g, ''), 10);
        } else if (text.includes('connections') || text.includes('conexões')) {
          // If 500+, we set it as 500 if we haven't found exact number yet
          if (text.includes('500+')) {
            if (!followingCount) followingCount = 500;
          } else {
            const match = text.match(/(\d+[\d,.]*)/);
            if (match) followingCount = parseInt(match[1].replace(/[^\d]/g, ''), 10);
          }
        }
      }
    }

    // 2. Try the Activity Section header (often "X followers")
    // This is often more accurate for creators
    if (!followersCount) {
      const activityCountEl = document.querySelector('.pvs-header__subtitle, #content_collections span.t-black--light');
      if (activityCountEl) {
        const text = activityCountEl.textContent;
        if (text.includes('followers') || text.includes('seguidores')) {
          const match = text.match(/(\d+[\d,.]*)/);
          if (match) followersCount = parseInt(match[1].replace(/[^\d]/g, ''), 10);
        }
      }
    }

    // Recent Posts Extraction
    // We try to find the activity section and get the last few posts
    const recentPosts = [];
    const activitySection = document.querySelector('#content_collections, .pv-recent-activity-detail__feed-container');

    // Note: LinkedIn structure varies wildy. We look for generic feed update containers.
    // Try to find post containers within the document if activity section isn't isolated, 
    // or scoped to activity section if found.
    const searchRoot = activitySection || document;

    // Selectors for posts on profile activity
    const postSelectors = [
      '.profile-creator-shared-feed-update__container',
      '.feed-shared-update-v2',
      '.occludable-update'
    ];

    let postElements = [];
    for (const sel of postSelectors) {
      const els = searchRoot.querySelectorAll(sel);
      if (els.length > 0) {
        postElements = Array.from(els);
        break;
      }
    }

    // Limit to 3 most recent posts
    postElements.slice(0, 3).forEach(postEl => {
      try {
        // Text content
        const textEl = postEl.querySelector('.feed-shared-update-v2__description, .update-components-text');
        const content = getTextContent(textEl);

        // Meta (likes/comments) - approximate
        const socialCounts = postEl.querySelector('.social-details-social-counts, .feed-shared-social-counts');
        const reactionCountStr = getTextContent(socialCounts?.querySelector('.social-details-social-counts__reactions-count, .social-details-social-activity__detail-button'));
        const commentCountStr = getTextContent(socialCounts?.querySelector('.social-details-social-counts__comments, .social-details-social-activity__detail-button--comments'));

        let likes = 0;
        if (reactionCountStr) {
          likes = parseInt(reactionCountStr.replace(/[^\d]/g, ''), 10) || 0;
        }

        // Date/Time (e.g. "2d", "1w")
        const timeEl = postEl.querySelector('.update-components-actor__sub-description, .feed-shared-actor__sub-description');
        const dateStr = getTextContent(timeEl);

        if (content) {
          recentPosts.push({
            content,
            date: dateStr,
            likes,
            platform: 'linkedin'
          });
        }
      } catch (e) { /* ignore individual post failure */ }
    });


    // Industry (sometimes in the profile header area)
    let industry = null;
    const industryEl = document.querySelector('.pv-text-details__left-panel span[class*="industry"]');
    industry = getTextContent(industryEl);

    return {
      username,
      fullName,
      profileUrl: `https://linkedin.com/in/${username}`,
      headline,      // Professional title/position
      bio: bio || headline,
      location,
      avatarUrl,
      company,       // Current company
      industry,      // Industry sector
      connectionCount: followingCount || 0, // Mapping "Connections" to "Following" loosely or keeping separate? API has connectionCount.
      followersCount: followersCount || 0,
      followingCount: followingCount || 0, // LinkedIn "Connections"
      postsCount: recentPosts.length, // We don't have total count easily, just count what we found
      posts: recentPosts
    };
  }

  // --- Deep Profiling Logic ---
  async function fetchActivityPage(username) {
    try {
      // Use the "all activity" page which contains posts, comments, etc.
      // We prioritize "posts" if possible, but "recent-activity/all/" is a good catch-all.
      const url = `https://www.linkedin.com/in/${username}/recent-activity/all/`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const text = await response.text();
      const parser = new DOMParser();
      return parser.parseFromString(text, 'text/html');
    } catch (e) {
      console.warn('Error fetching activity page:', e);
      return null;
    }
  }

  function parseRecentActivity(doc) {
    if (!doc) return [];

    const posts = [];
    // Selectors for feed updates in the activity page
    const postElements = doc.querySelectorAll('.profile-creator-shared-feed-update__container, .feed-shared-update-v2, .occludable-update, li.activity-results__list-item');

    postElements.forEach(postEl => {
      // Text
      const textEl = postEl.querySelector('.feed-shared-update-v2__description, .update-components-text, .feed-shared-text-view, .commentary');
      const text = getTextContent(textEl);

      // Images
      const images = [];
      const imgEls = postEl.querySelectorAll('img');
      imgEls.forEach(img => {
        if (img.src && img.src.includes('licdn.com') && (img.width > 50 || img.naturalWidth > 50)) {
          images.push(img.src);
        }
      });

      // Date/Time
      const dateEl = postEl.querySelector('.update-components-actor__sub-description, .feed-shared-actor__sub-description, .time-badge');
      const date = getTextContent(dateEl);

      // Only add if we have content
      if (text || images.length > 0) {
        posts.push({
          content: text,
          imageUrls: images.slice(0, 3), // Limit images per post
          date: date,
          platform: 'linkedin'
        });
      }
    });

    return posts.slice(0, 5); // Limit to 5 recent posts
  }

  async function extractDeepProfile() {
    const basicProfile = extractCurrentProfile();
    if (!basicProfile) return null;

    console.log('[SOS 360] Performing Deep Scan for:', basicProfile.username);

    // Fetch detailed activity
    let detailedPosts = [];
    try {
      const doc = await fetchActivityPage(basicProfile.username);
      if (doc) {
        detailedPosts = parseRecentActivity(doc);
        console.log(`[SOS 360] Fetched ${detailedPosts.length} detailed posts`);
      }
    } catch (e) {
      console.warn('[SOS 360] Deep scan activity fetch failed:', e);
    }

    // Merge posts (prefer detailed ones, fallback to basic ones found on profile)
    const finalPosts = detailedPosts.length > 0 ? detailedPosts : basicProfile.posts;

    return {
      ...basicProfile,
      posts: finalPosts,
      isDeepAnalyzed: true
    };
  }

  // --- UI Construction ---
  function createOverlay() {
    if (document.getElementById(UI_ID)) {
      document.getElementById(UI_ID).style.display = 'block';
      return;
    }

    const isConnectionsPage = window.location.href.includes('/mynetwork/invite-connect/connections/');
    const title = isConnectionsPage ? 'Import: Connections' : 'Import Status';

    // If not on connections page (e.g. Feed), we might want to hide "Auto-Scroll" or "Keywords" if they aren't relevant for the specific batch job.
    // However, if the user IS mining the feed (future feature?), keep them.
    // For now, if it's NOT connections page, it's likely just Deep Import progress.
    // Let's keep it simple: Show simplified UI if not connections page.

    const displayStyle = isConnectionsPage ? 'flex' : 'none';

    const overlay = document.createElement('div');
    overlay.id = UI_ID;
    overlay.innerHTML = `
      <div class="sos-header">
        <span class="sos-title">${title}</span>
        <button id="sos-close" class="sos-close">&times;</button>
      </div>
      <div class="sos-content">
        <div class="sos-input-group" style="display:${displayStyle}">
          <label for="sos-keywords">Filtrar por Keywords (cargo):</label>
          <input type="text" id="sos-keywords" placeholder="Ex: CEO, Diretor, Gerente">
        </div>
        <div class="sos-input-group" style="display:${displayStyle}">
          <label for="sos-criteria">Critérios de Qualificação IA:</label>
          <input type="text" id="sos-criteria" placeholder="Ex: Profissionais de marketing com empresa">
        </div>
        <div class="sos-input-group" style="display:${displayStyle}; flex-direction:row; align-items:center; gap:8px;">
          <input type="checkbox" id="sos-deep-scan" style="width:auto; margin:0;">
          <label for="sos-deep-scan" style="margin:0; cursor:pointer;">Deep Scan (Análise Comportamental)</label>
        </div>
        <div class="sos-stats">
          <div class="stat-item">
            <span class="label">Total Escaneados</span>
            <span class="value" id="sos-scanned-count">0</span>
          </div>
          <div class="stat-item">
            <span class="label">Qualificados</span>
            <span class="value" id="sos-qualified-count">0</span>
          </div>
        </div>
        <div class="sos-actions" style="display:${displayStyle}">
          <button id="sos-scroll-btn" class="sos-btn sos-btn-primary">
            <span>&raquo;</span> Iniciar Auto-Scroll
          </button>
          <button id="sos-import-btn" class="sos-btn sos-btn-action" disabled>
            <span class="icon">☁️</span> <span id="sos-import-text">Importar 0 perfis...</span>
          </button>
        </div>
        <div id="sos-progress-container" style="display:none; margin-top:12px;">
          <div style="font-size:12px; color:#9ca3af; margin-bottom:4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <span id="sos-progress-status">Aguardando...</span>
          </div>
          <div style="background:#374151; border-radius:4px; height:8px; overflow:hidden;">
            <div id="sos-progress-bar" style="background:linear-gradient(to right, #3b82f6, #8b5cf6); height:100%; width:0%; transition: width 0.3s ease;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:11px; color:#6b7280;">
            <span id="sos-progress-count">0 / 0</span>
            <span id="sos-progress-percentage">0%</span>
          </div>
        </div>
        <div id="sos-debug" style="font-size:10px;color:#888;margin-top:8px;"></div>
      </div>
      <style>
      #${UI_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background: #1f2937;
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: -apple-system, system-ui, sans-serif;
      }
      #${UI_ID} .sos-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #111827;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #374151;
      }
      #${UI_ID} .sos-title { font-weight: 600; font-size: 14px; }
      #${UI_ID} .sos-close { background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; }
      #${UI_ID} .sos-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      #${UI_ID} .sos-input-group { display: flex; flex-direction: column; gap: 6px; }
      #${UI_ID} label { font-size: 12px; color: #d1d5db; }
      #${UI_ID} input { background: #374151; border: 1px solid #4b5563; border-radius: 4px; padding: 8px; font-size: 13px; color: #fff; }
      #${UI_ID} .sos-stats { display: flex; justify-content: space-between; background: #111827; padding: 8px; border-radius: 4px; }
      #${UI_ID} .stat-item { display: flex; flex-direction: column; align-items: center; }
      #${UI_ID} .stat-item .label { font-size: 10px; color: #9ca3af; }
      #${UI_ID} .stat-item .value { font-size: 16px; font-weight: bold; color: #fff; }
      #${UI_ID} .sos-btn { width: 100%; padding: 10px; border: none; border-radius: 4px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px; }
      #${UI_ID} .sos-btn:hover:not(:disabled) { opacity: 0.9; }
      #${UI_ID} .sos-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      #${UI_ID} .sos-btn-primary { background: #ec4899; color: white; margin-bottom: 8px; }
      #${UI_ID} .sos-btn-action { background: #3b82f6; color: white; }
      #${UI_ID} .sos-btn-stop { background: #ef4444; color: white; margin-bottom: 8px; }
      </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sos-close').addEventListener('click', () => {
      document.getElementById(UI_ID).style.display = 'none';
      stopAutoScroll();
    });

    document.getElementById('sos-keywords').addEventListener('input', (e) => {
      updateKeywords(e.target.value);
    });

    if (state.keywords.length > 0) {
      document.getElementById('sos-keywords').value = state.keywords.join(', ');
    }

    document.getElementById('sos-scroll-btn').addEventListener('click', () => {
      if (state.isAutoScrolling) stopAutoScroll();
      else startAutoScroll();
    });

    document.getElementById('sos-import-btn').addEventListener('click', importQualifiedLeads);

    setTimeout(scanConnections, 500);
  }

  function updateKeywords(input) {
    state.keywords = input.trim() ? input.split(',').map(s => s.trim()).filter(Boolean) : [];
    scanConnections();
  }

  function updateUI() {
    const scannedEl = document.getElementById('sos-scanned-count');
    const qualifiedEl = document.getElementById('sos-qualified-count');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');
    const scrollBtn = document.getElementById('sos-scroll-btn');

    if (!document.getElementById(UI_ID)) return;

    if (scannedEl) scannedEl.textContent = state.totalConnectionsFound;
    if (qualifiedEl) qualifiedEl.textContent = state.qualifiedLeads.size;

    if (importBtn) {
      importBtn.disabled = state.qualifiedLeads.size === 0;
      importText.textContent = `Importar ${state.qualifiedLeads.size} perfis...`;
    }

    if (scrollBtn) {
      if (state.isAutoScrolling) {
        scrollBtn.textContent = 'Parar Auto-Scroll';
        scrollBtn.className = 'sos-btn sos-btn-stop';
      } else {
        scrollBtn.innerHTML = '<span>&raquo;</span> Iniciar Auto-Scroll';
        scrollBtn.className = 'sos-btn sos-btn-primary';
      }
    }
  }

  function updateDebug(msg) {
    const el = document.getElementById('sos-debug');
    if (el) el.textContent = msg;
  }

  // --- Core Logic ---
  function scanConnections() {
    const cards = findConnectionCards();
    state.totalConnectionsFound = cards.length;

    cards.forEach(card => {
      try {
        // Find profile link
        const linkEl = card.querySelector('a[href*="/in/"]');
        if (!linkEl) return;

        const profileUrl = linkEl.href?.split('?')[0];
        const username = parseLinkedInUrl(profileUrl);
        if (!username) return;

        // Find occupation/bio - try multiple selectors
        const bioSelectors = [
          '.mn-connection-card__occupation',
          '[class*="occupation"]',
          '.entity-result__primary-subtitle',
          '.artdeco-entity-lockup__subtitle',
          'p',
          'span:not([aria-hidden])'
        ];

        let bio = '';
        for (const sel of bioSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim().length > 5) {
            bio = el.textContent.trim();
            break;
          }
        }

        if (matchesKeywords(bio, state.keywords)) {
          // Find name
          const nameSelectors = [
            '.mn-connection-card__name',
            '[class*="connection-card__name"]',
            '.entity-result__title-text',
            '.artdeco-entity-lockup__title',
            'span[aria-hidden="true"]'
          ];

          let fullName = '';
          for (const sel of nameSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim().length > 1) {
              fullName = el.textContent.trim();
              break;
            }
          }

          // Fallback: format username as name if fullName not found
          if (!fullName && username) {
            fullName = formatUsernameAsName(username);
          }

          // Parse company and headline from bio
          // Common formats: "Position at Company" or "Company · Position"
          let headline = bio;
          let company = null;

          if (bio) {
            // Try "at Company" pattern
            const atMatch = bio.match(/(?:at|@|em|na)\s+(.+?)(?:\s*[|·•]|$)/i);
            if (atMatch) {
              company = atMatch[1].trim();
            }

            // Try "Company · Position" pattern
            const dotMatch = bio.match(/^(.+?)\s*[·•|]\s*(.+)$/);
            if (dotMatch && !company) {
              // First part might be company or position - heuristic: shorter is usually company
              if (dotMatch[1].length < dotMatch[2].length) {
                company = dotMatch[1].trim();
              } else {
                company = dotMatch[2].trim();
              }
            }
          }

          // Enhanced Image Extraction
          function findAvatarUrl(cardElement) {
            const imgSelectors = [
              'figure[data-view-name="image"] img', // Specific LinkedIn selector
              '.presence-entity__image',
              '.ivm-view-attr__img--centered',
              '.mn-connection-card__picture img',
              '.entity-result__image img',
              '.artdeco-entity-lockup__image img',
              'img[loading="lazy"]'
            ];

            // 1. Try specific selectors
            for (const sel of imgSelectors) {
              const imgs = cardElement.querySelectorAll(sel);
              for (const img of imgs) {
                if (isValidImage(img)) return img.src;
              }
            }

            // 2. Fallback: Search all images
            const allImgs = cardElement.querySelectorAll('img');
            for (const img of allImgs) {
              if (isValidImage(img)) return img.src;
            }

            return null;
          }

          function isValidImage(img) {
            if (!img || !img.src) return false;
            const src = img.src;

            // Reject obvious placeholders
            if (src.includes('data:image/gif')) return false;
            if (src.includes('ghost')) return false;
            if (src.includes('data:image/svg')) return false;
            if (img.closest('svg')) return false; // Ignore images inside SVGs

            // POSITIVE validation: LinkedIn profile images come from their CDN
            // This is more reliable than dimension checks which fail for lazy-loaded images
            if (src.includes('media.licdn.com') || src.includes('licdn.com/dms/image')) {
              return true;
            }

            // For non-LinkedIn URLs, be more strict - require actual dimensions
            // (but this is a fallback, LinkedIn images should match above)
            if (img.naturalWidth > 30 && img.naturalHeight > 30) {
              return true;
            }

            return false;
          }

          const avatarUrl = findAvatarUrl(card);

          state.qualifiedLeads.set(username, {
            username,
            fullName,
            profileUrl,
            headline,    // Headline/professional title
            bio,
            company,     // Parsed company name
            avatarUrl: avatarUrl || null,
          });
        } else {
          state.qualifiedLeads.delete(username);
        }
      } catch (e) {
        console.warn('[SOS 360] Error parsing card', e);
      }
    });

    updateUI();
  }

  async function startAutoScroll() {
    if (state.isAutoScrolling) return;
    state.isAutoScrolling = true;
    updateUI();

    console.log('[SOS 360] Auto-scroll started (Fluid Mode)');

    let noChangeCount = 0;
    const scrollContainer = findScrollableContainer();
    const isWindow = scrollContainer === document.documentElement;

    console.log(`[SOS 360] Using scroll container: ${scrollContainer.tagName}`);
    updateDebug(`Container: ${scrollContainer.tagName}`);

    // Configurable parameters for fluid scrolling
    const SCROLL_STEP = window.innerHeight * 0.8; // Scroll 80% of viewport height
    const MIN_WAIT_MS = 1500;
    const MAX_WAIT_MS = 2500;
    const MAX_NO_CHANGE_ATTEMPTS = 5;

    // SHOW PROGRESS ON START
    const progressContainer = document.getElementById('sos-progress-container');
    if (progressContainer) progressContainer.style.display = 'block';
    updateDeepImportProgress(0, 100, 'Iniciando mineração...');

    while (state.isAutoScrolling) {
      const prevCount = state.totalConnectionsFound;

      // Get current scroll position
      const currentScrollTop = isWindow ? window.scrollY : scrollContainer.scrollTop;
      const maxScroll = isWindow ? document.body.scrollHeight : scrollContainer.scrollHeight;
      const clientHeight = isWindow ? window.innerHeight : scrollContainer.clientHeight;

      // Determine new scroll position (incremental)
      let nextScrollTop = currentScrollTop + SCROLL_STEP;

      // If we are close to the bottom, aim for the very bottom
      if (nextScrollTop + clientHeight >= maxScroll - 50) {
        nextScrollTop = maxScroll;
      }

      console.log(`[SOS 360] Scrolling from ${Math.round(currentScrollTop)} to ${Math.round(nextScrollTop)} (Max: ${maxScroll})`);

      // Perform smooth scroll
      if (isWindow) {
        window.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
      } else {
        scrollContainer.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
      }

      // Also dispatch scroll event just in case listeners need it
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

      // Wait for scroll + specific content loading time
      // Random delay to mimic human behavior
      const waitTime = Math.floor(Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS + 1)) + MIN_WAIT_MS;
      await sleep(waitTime);

      // Check for "Show more results" button
      const showMoreBtn = document.querySelector('button.scaffold-finite-scroll__load-button');
      if (showMoreBtn && showMoreBtn.offsetParent !== null) { // Check if visible
        console.log('[SOS 360] Found "Show more" button, clicking...');
        showMoreBtn.click();
        await sleep(2000); // Wait extra for button load
      }

      // Scan for new connections
      scanConnections();

      const newCount = state.totalConnectionsFound;
      const newScrollTop = isWindow ? window.scrollY : scrollContainer.scrollTop;
      const newMaxScroll = isWindow ? document.body.scrollHeight : scrollContainer.scrollHeight;

      updateDebug(`Scanned: ${newCount}, Scroll: ${Math.round(newScrollTop)}`);

      // UPDATE PROGRESS BAR
      const percentage = Math.min(Math.round((newScrollTop / (newMaxScroll - clientHeight)) * 100), 99);
      updateDeepImportProgress(percentage, 100, `Minerando... ${newCount} leads encontrados`);

      // Check for progress
      // We check if we found new leads OR if the page height increased (content loaded)
      const contentLoaded = newMaxScroll > maxScroll;
      const leadsFound = newCount > prevCount;
      const moved = Math.abs(newScrollTop - currentScrollTop) > 10;

      // If we are at the bottom and nothing new loaded
      const isAtBottom = newScrollTop + clientHeight >= newMaxScroll - 10;

      if (!leadsFound && !contentLoaded && isAtBottom) {
        noChangeCount++;
        console.log(`[SOS 360] No new content (${noChangeCount}/${MAX_NO_CHANGE_ATTEMPTS})`);

        // Try a small wiggle to trigger lazy load if stuck at bottom
        if (noChangeCount < MAX_NO_CHANGE_ATTEMPTS) {
          if (isWindow) window.scrollBy({ top: -200, behavior: 'smooth' });
          else scrollContainer.scrollBy({ top: -200, behavior: 'smooth' });
          await sleep(1000);
          if (isWindow) window.scrollBy({ top: 200, behavior: 'smooth' });
          else scrollContainer.scrollBy({ top: 200, behavior: 'smooth' });
          await sleep(1000);
        }

        if (noChangeCount >= MAX_NO_CHANGE_ATTEMPTS) {
          console.log('[SOS 360] Stop: No more content loading.');
          stopAutoScroll();
        }
      } else {
        // Reset counter if we found leads, loaded content, or successfully scrolled
        if (leadsFound || contentLoaded) {
          noChangeCount = 0;
        } else if (!moved && !isAtBottom) {
          // We tried to scroll but didn't move, and we aren't at the bottom? 
          // Maybe stuck or strict throttle. Count it properly.
          // But if we just scrolled and waiting for load, we might be fine.
          // Let's assume valid scroll unless we are stuck.
        }
      }
    }
  }

  function stopAutoScroll() {
    state.isAutoScrolling = false;
    updateUI();
    scanConnections();

    // Reset or hide progress
    updateDeepImportProgress(100, 100, `Mineração pausada. ${state.totalConnectionsFound} leads.`);
    setTimeout(() => {
      const container = document.getElementById('sos-progress-container');
      if (container) container.style.display = 'none';
    }, 3000);
  }

  async function importQualifiedLeads() {
    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) return;

    // DEBUG: Log leads data before sending
    console.log('[SOS 360] Leads to import:', JSON.stringify(leads, null, 2));

    const btn = document.getElementById('sos-import-btn');
    const textEl = document.getElementById('sos-import-text');
    const criteriaEl = document.getElementById('sos-criteria');
    if (!btn || !textEl) return;

    const originalText = textEl.textContent;
    const criteria = criteriaEl?.value?.trim() || '';
    const isDeepScan = document.getElementById('sos-deep-scan')?.checked || false;

    btn.disabled = true;
    textEl.textContent = 'Importando...';

    try {
      // Use Deep Import with AI analysis if criteria provided
      if (criteria) {
        textEl.textContent = 'Iniciando Deep Import com IA...';
        console.log('[SOS 360] Starting Deep Import with criteria:', criteria);

        // Show progress bar immediately
        updateDeepImportProgress(0, leads.length, 'Iniciando análise com IA...');

        const response = await chrome.runtime.sendMessage({
          action: 'startDeepImport',
          data: {
            leads: leads,
            criteria: criteria,
            deepScan: isDeepScan // Pass the flag
          }
        });

        if (response?.success) {
          // Don't re-enable button yet - it will be re-enabled when Deep Import completes
          textEl.textContent = 'Deep Import em andamento...';
        } else {
          console.error('[SOS 360] Deep Import failed:', response?.error);
          alert('Falha ao iniciar Deep Import: ' + (response?.error || 'Erro desconhecido'));
          btn.disabled = false;
          textEl.textContent = originalText;
        }
      } else {
        // Simple import without AI analysis
        const importData = {
          source: 'extension',
          platform: 'linkedin',
          sourceUrl: window.location.href,
          leads: leads
        };
        console.log('[SOS 360] Sending import request:', JSON.stringify(importData, null, 2));

        const response = await chrome.runtime.sendMessage({
          action: 'importLeads',
          data: importData
        });

        console.log('[SOS 360] Import response:', response);

        if (response?.success) {
          alert(`Sucesso! ${leads.length} leads importados.`);
        } else {
          console.error('[SOS 360] Import failed:', response?.error);
          alert('Falha na importação: ' + (response?.error || 'Erro desconhecido'));
        }
      }
    } catch (e) {
      console.error('[SOS 360] Import exception:', e);
      alert('Erro: ' + e.message);
    } finally {
      btn.disabled = false;
      textEl.textContent = originalText;
    }
  }

  // --- Initialization ---
  function init() {
    const url = location.href;

    if (url.includes('/mynetwork/invite-connect/connections/')) {
      const poller = setInterval(() => {
        const cards = findConnectionCards();
        if (cards.length > 0) {
          clearInterval(poller);
          console.log(`[SOS 360] Found ${cards.length} connection cards, creating overlay`);
          createOverlay();
          scanConnections();
        }
      }, 1000);
      setTimeout(() => clearInterval(poller), 30000);
    } else {
      const el = document.getElementById(UI_ID);
      if (el) el.style.display = 'none';
      state.isAutoScrolling = false;
    }
  }

  // SPA Observer
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      init();
    }
  }).observe(document, { subtree: true, childList: true });

  init();

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      if (request.action === 'extractLeads') {
        const url = window.location.href;
        if (url.includes('/connections/') && state.qualifiedLeads.size > 0) {
          sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
        } else if (url.includes('/search/results/')) {
          sendResponse({ success: true, data: extractSearchResults() });
        } else if (url.includes('/in/')) {
          const profile = extractCurrentProfile();
          sendResponse({ success: !!profile, data: profile ? [profile] : [] });
        } else {
          scanConnections();
          sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
        }
      } else if (request.action === 'extractProfile') {
        if (request.deep) {
          const p = await extractDeepProfile(); // Async
          sendResponse({ success: !!p, data: p });
        } else {
          const p = extractCurrentProfile();
          sendResponse({ success: !!p, data: p });
        }
      } else if (request.action === 'openOverlay') {
        createOverlay();
        sendResponse({ success: true });
      } else if (request.action === 'updateImportProgress') {
        // Handle deep import progress updates
        const { current, total, status } = request.data;
        updateDeepImportProgress(current, total, status);
        sendResponse({ success: true });
      }
    })();
    return true;
  });

  // --- Deep Import Progress UI ---
  function updateDeepImportProgress(current, total, status) {
    let container = document.getElementById('sos-progress-container');

    // If container doesn't exist (overlay not open), create it
    if (!container) {
      createOverlay();
      container = document.getElementById('sos-progress-container');
    }

    const statusEl = document.getElementById('sos-progress-status');
    const barEl = document.getElementById('sos-progress-bar');
    const countEl = document.getElementById('sos-progress-count');
    const percentEl = document.getElementById('sos-progress-percentage');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');

    if (!container) return;

    // Show progress container
    container.style.display = 'block';

    // Update status text
    if (statusEl) statusEl.textContent = status || 'Processando...';

    // Calculate and update progress
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    if (barEl) barEl.style.width = `${percent}%`;
    if (countEl) {
      // If total is 100 and we are just treating it as percentage, hide the fraction
      if (total === 100) countEl.textContent = '';
      else countEl.textContent = `${current} / ${total}`;
    }
    if (percentEl) percentEl.textContent = `${percent}%`;

    // Check if completed
    if (status === 'Done!' || (current >= total && total > 0)) {
      // Mark as complete
      if (statusEl) statusEl.textContent = '✅ Deep Import Concluído!';
      if (barEl) barEl.style.background = 'linear-gradient(to right, #10b981, #059669)';

      // Re-enable import button
      if (importBtn) {
        importBtn.disabled = false;
        if (importText) importText.textContent = 'Importar mais perfis...';
      }

      // Show completion notification
      showCompletionNotification(total);

      // Hide progress after 5 seconds
      setTimeout(() => {
        container.style.display = 'none';
        if (barEl) {
          barEl.style.width = '0%';
          barEl.style.background = 'linear-gradient(to right, #3b82f6, #8b5cf6)';
        }
      }, 5000);
    }

    console.log(`[SOS 360] Deep Import Progress: ${current}/${total} - ${status}`);
  }

  function showCompletionNotification(total) {
    // Create a nice notification
    const notif = document.createElement('div');
    notif.id = 'sos-completion-notif';
    notif.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
        z-index: 2147483648;
        font-family: -apple-system, system-ui, sans-serif;
        animation: slideIn 0.3s ease;
      ">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:24px;">🎉</span>
          <div>
            <div style="font-weight:600; font-size:14px;">Deep Import Concluído!</div>
            <div style="font-size:12px; opacity:0.9;">${total} perfis analisados com IA</div>
          </div>
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    document.body.appendChild(notif);

    // Remove after 5 seconds
    setTimeout(() => {
      notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(100%)';
      setTimeout(() => notif.remove(), 300);
    }, 5000);
  }

  console.log('[SOS 360] LinkedIn Script v3 Loaded');
})();
