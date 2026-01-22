// LinkedIn content script - SOS 360
// Version 3 - Updated for current LinkedIn UI

(function () {
  'use strict';
  console.log('[SOS 360] Content Script Carregado - Versão CORREÇÃO V3.1 (POSICIONAL + NOVO ALGORITMO) - ' + new Date().toISOString());

  const UI_ID = 'sos360-linkedin-overlay';

  // --- State Management ---
  const state = {
    isAutoScrolling: false,
    isBulkScanning: false, // Novo flag
    qualifiedLeads: new Map(),
    keywords: [],
    totalConnectionsFound: 0,
    scannedHistoryCount: 0, // Contagem acumulada de páginas anteriores
    selectedAudience: null, // { id, name }
    audiences: [], // Lista de audiências disponíveis
    pipelines: [], // Lista de pipelines disponíveis
    selectedPipeline: null, // Pipeline selecionado para import
    selectedStage: null, // Stage selecionado para import
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

  /**
   * Converte métricas abreviadas do LinkedIn (ex: "10M", "5.2K", "1,234") em números inteiros
   * @param {string} value - Valor a ser convertido
   * @returns {number} - Valor numérico
   */
  function parseMetricCount(value) {
    if (!value) return 0;
    const str = value.toString().trim().toUpperCase();

    // Remove vírgulas e pontos usados como separadores de milhares
    const cleanNumber = str.replace(/[,\.]/g, '');

    // Verifica sufixos de abreviação
    if (str.includes('M')) {
      const num = parseFloat(str.replace(/[^0-9.]/g, ''));
      return Math.round(num * 1000000);
    } else if (str.includes('K')) {
      const num = parseFloat(str.replace(/[^0-9.]/g, ''));
      return Math.round(num * 1000);
    }

    return parseInt(cleanNumber.replace(/[^0-9]/g, ''), 10) || 0;
  }

  // --- Bulk Scan & Pagination Persistence ---

  async function saveState() {
    const serializedLeads = Array.from(state.qualifiedLeads.entries());
    const data = {
      isBulkScanning: state.isBulkScanning,
      qualifiedLeads: serializedLeads,
      scannedHistoryCount: state.totalConnectionsFound, // IMPORTANTE: Salva o total corrente como histórico para próxima carga
      selectedAudience: state.selectedAudience,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ 'sos_linkedin_state': data });
    console.log('[SOS 360] Estado salvo para paginação. Total:', state.totalConnectionsFound);
  }

  async function restoreState() {
    try {
      const result = await chrome.storage.local.get('sos_linkedin_state');
      const data = result.sos_linkedin_state;

      if (data && (Date.now() - data.timestamp < 30 * 60 * 1000)) {
        if (data.isBulkScanning) {
          state.isBulkScanning = true;
          state.qualifiedLeads = new Map(data.qualifiedLeads);
          state.scannedHistoryCount = data.scannedHistoryCount || 0; // Restaura a contagem base
          state.totalConnectionsFound = state.scannedHistoryCount; // Inicializa visualmente
          state.selectedAudience = data.selectedAudience;
          console.log(`[SOS 360] Estado restaurado: ${state.qualifiedLeads.size} leads qualificados. Total escaneado prev: ${state.scannedHistoryCount}`);
          return true;
        }
      }
    } catch (e) {
      console.warn('[SOS 360] Erro restaurando estado:', e);
    }
    return false;
  }

  async function clearState() {
    await chrome.storage.local.remove('sos_linkedin_state');
    state.isBulkScanning = false;
    state.scannedHistoryCount = 0;
  }

  function goToNextPage() {
    // Tenta múltiplos seletores para o botão "Próximo"
    const selectors = [
      '[data-testid="pagination-button-next"]',
      'button[aria-label="Avançar"]',
      'button[aria-label="Next"]',
      'button.artdeco-pagination__button--next',
      '.artdeco-pagination__button--next',
      '[data-testid="pagination-controls-list"] + button',
      'button span.artdeco-button__text'
    ];

    let nextBtn = null;

    for (const sel of selectors) {
      if (sel.includes('span')) {
        const spans = Array.from(document.querySelectorAll(sel));
        const nextSpan = spans.find(s => {
          const t = s.textContent?.trim().toLowerCase() || '';
          return t.includes('avançar') || t.includes('next') || t.includes('seguinte');
        });
        if (nextSpan) nextBtn = nextSpan.closest('button');
      } else {
        nextBtn = document.querySelector(sel);
      }

      if (nextBtn) {
        console.log(`[SOS 360] Botão Next encontrado com seletor: ${sel}`);
        break;
      }
    }

    if (nextBtn && !nextBtn.disabled) {
      console.log('[SOS 360] Clicando em Próxima Página...', nextBtn);
      saveState().then(() => {
        nextBtn.click();
      });
      return true;
    }

    console.warn('[SOS 360] Botão Próxima Página NÃO encontrado ou desabilitado.');
    return false;
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
    // Suporta: visualização autenticada (.text-body-medium) e pública (.top-card-layout__headline)
    const headlineEl = document.querySelector('.text-body-medium.break-words') ||
      document.querySelector('.top-card-layout__headline') ||
      document.querySelector('[data-generated-suggestion-target*="headline"]') ||
      document.querySelector('.pv-text-details__left-panel .text-body-medium');
    const headline = getTextContent(headlineEl);

    // Location
    // Suporta: autenticado (.text-body-small.inline.t-black--light) e público (.top-card__subline-item:first-child)
    const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words') ||
      document.querySelector('.pv-text-details__left-panel .text-body-small') ||
      document.querySelector('.top-card-layout__first-subline span:first-child') ||
      document.querySelector('.top-card__subline-item:first-child');
    const location = getTextContent(locationEl);

    // Avatar
    const avatarUrl = document.querySelector('.pv-top-card-profile-picture__image, .profile-photo-edit__preview, img[class*="pv-top-card"]')?.src || null;

    // About section (bio)
    // Suporta: seletores autenticados e públicos
    const aboutSection = document.querySelector('#about ~ .display-flex .pv-shared-text-with-see-more') ||
      document.querySelector('#about ~ div[class*="full-width"] .pv-shared-text-with-see-more') ||
      document.querySelector('[data-section="about"]') ||
      document.querySelector('section.about .about-section__content') ||
      document.querySelector('.about-section .core-section-container__content');
    const bio = getTextContent(aboutSection) || headline;

    // Experience - try to get current company and position
    // Suporta: ID (#experience) para autenticado e data-section para público
    let company = null;
    let currentPosition = null;
    const experienceSection = document.querySelector('#experience') ||
      document.querySelector('[data-section="experience"]') ||
      document.querySelector('section.experience');
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

    // Connection count and followers count extraction
    // Suporta tanto visualização autenticada quanto pública
    let followersCount = null;
    let connectionCount = null;

    // --- ESTRATÉGIA 1: Visualização autenticada (perfil logado) ---
    // Tenta pegar de .pv-top-card--list (estrutura mais comum quando logado)
    const topCardListItems = document.querySelectorAll('.pv-top-card--list > li, .pv-top-card--list > span, .pv-top-card--list-bullet li');
    for (const item of topCardListItems) {
      const text = getTextContent(item);
      if (text) {
        // Followers
        if (text.match(/followers|seguidores/i)) {
          const match = text.match(/([\d,.]+[KMkm]?)/);
          if (match) followersCount = parseMetricCount(match[1]);
        }
        // Connections
        if (text.match(/connections|conexões/i)) {
          if (text.includes('500+')) {
            connectionCount = 500;
          } else {
            const match = text.match(/([\d,.]+)/);
            if (match) connectionCount = parseInt(match[1].replace(/[^\d]/g, ''), 10);
          }
        }
      }
    }

    // --- ESTRATÉGIA 2: Visualização pública (guest view) ---
    // Tenta de .top-card-layout__first-subline (texto completo contendo followers e connections)
    if (!followersCount || !connectionCount) {
      const publicSubline = document.querySelector('.top-card-layout__first-subline');
      if (publicSubline) {
        const text = publicSubline.textContent || '';
        // Extrai followers (ex: "10M followers")
        const followersMatch = text.match(/([\d,.]+[KMkm]?)\s*followers|([\d,.]+[KMkm]?)\s*seguidores/i);
        if (followersMatch && !followersCount) {
          followersCount = parseMetricCount(followersMatch[1] || followersMatch[2]);
        }
        // Extrai connections (ex: "500+ connections")
        const connectionsMatch = text.match(/([\d,.]+\+?)\s*connections|([\d,.]+\+?)\s*conexões/i);
        if (connectionsMatch && !connectionCount) {
          const val = connectionsMatch[1] || connectionsMatch[2];
          if (val.includes('+')) {
            connectionCount = parseInt(val.replace(/[^\d]/g, ''), 10);
          } else {
            connectionCount = parseInt(val.replace(/[^\d]/g, ''), 10);
          }
        }
      }
    }

    // --- ESTRATÉGIA 3: Activity Section header ---
    if (!followersCount) {
      const activityHeaders = document.querySelectorAll('.pvs-header__subtitle, #content_collections span.t-black--light, .pvs-header__optional-link span');
      for (const header of activityHeaders) {
        const text = header.textContent || '';
        if (text.match(/followers|seguidores/i)) {
          const match = text.match(/([\d,.]+[KMkm]?)/);
          if (match) {
            followersCount = parseMetricCount(match[1]);
            break;
          }
        }
      }
    }

    // Fallback para followingCount (conexões) se connectionCount não encontrado
    const followingCount = connectionCount;

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

    // Extract jobTitle from headline (parse "Title at Company" pattern)
    let jobTitle = null;
    if (headline) {
      // Try to extract job title - usually before "at/em" or first part before "|"
      const atMatch = headline.match(/^(.+?)\s+(?:at|@|em|na)\s+/i);
      const pipeMatch = headline.match(/^(.+?)\s*[|·•]/);
      if (atMatch) {
        jobTitle = atMatch[1].trim();
      } else if (pipeMatch) {
        jobTitle = pipeMatch[1].trim();
      } else if (currentPosition) {
        jobTitle = currentPosition;
      }
    }

    // Parse location into address components
    let address = null;
    if (location) {
      const parts = location.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        address = { city: parts[0], state: parts[1], country: parts[2] };
      } else if (parts.length === 2) {
        address = { city: parts[0], country: parts[1] };
      } else if (parts.length === 1) {
        address = { city: parts[0] };
      }
    }

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
      connectionCount: connectionCount || 0,
      followersCount: followersCount || 0,
      followingCount: connectionCount || 0, // LinkedIn "Connections" mapped to followingCount for backward compatibility
      postsCount: recentPosts.length, // We don't have total count easily, just count what we found
      posts: recentPosts,
      // New expanded fields
      jobTitle,      // Parsed from headline or position
      address        // Parsed from location
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

  // ============================================
  // LINKEDIN ENRICHMENT - Deep Extraction Functions
  // ============================================

  /**
   * Scroll to an element and wait for lazy-load content
   */
  async function scrollToElement(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(800 + Math.random() * 400);
  }

  /**
   * Click "Show more" button if exists within a section
   */
  async function expandSection(sectionContainer) {
    if (!sectionContainer) return;
    const showMoreBtn = sectionContainer.querySelector('button[aria-label*="Show more"], button[aria-label*="Ver mais"], button[aria-label*="mostrar"]');
    if (showMoreBtn && !showMoreBtn.disabled) {
      showMoreBtn.click();
      await sleep(600);
    }
  }

  /**
   * Extract Experience section
   */
  async function extractExperienceSection() {
    // Suporta: ID (#experience) para autenticado e data-section para público
    const section = document.querySelector('#experience') ||
      document.querySelector('[data-section="experience"]') ||
      document.querySelector('section.experience');
    if (!section) return [];

    await scrollToElement(section);
    const sectionContainer = section.closest('section');
    if (!sectionContainer) return [];

    await expandSection(sectionContainer);

    const experiences = [];
    const items = sectionContainer.querySelectorAll('.artdeco-list__item, li.pvs-list__paged-list-item');

    for (const item of items) {
      try {
        // Check if this is a grouped experience (multiple roles at same company)
        const subItems = item.querySelectorAll('.pvs-entity__sub-components li');

        if (subItems.length > 0) {
          // Grouped experience - company with multiple roles
          const companyEl = item.querySelector('.t-bold span[aria-hidden="true"]');
          const companyName = getTextContent(companyEl);
          const companyLogoEl = item.querySelector('img');
          const companyLogo = companyLogoEl?.src || null;
          const companyLinkEl = item.querySelector('a[href*="/company/"]');
          const companyUrl = companyLinkEl?.href || null;

          for (const subItem of subItems) {
            const roleTitleEl = subItem.querySelector('.t-bold span[aria-hidden="true"]');
            const roleTitle = getTextContent(roleTitleEl) || 'Unknown Role';
            const dateRangeEl = subItem.querySelector('.t-normal.t-black--light span[aria-hidden="true"]');
            const dateRange = getTextContent(dateRangeEl);
            const locationEl = subItem.querySelectorAll('.t-normal.t-black--light span[aria-hidden="true"]')[1];
            const location = getTextContent(locationEl);
            const descEl = subItem.querySelector('.pvs-list__outer-container .t-14.t-normal');
            const description = getTextContent(descEl);

            let startDate = null, endDate = null, duration = null;
            if (dateRange) {
              const match = dateRange.match(/(.+?)\s*[-–]\s*(.+?)(?:\s*·\s*(.+))?$/);
              if (match) {
                startDate = match[1]?.trim() || null;
                endDate = match[2]?.trim() || null;
                duration = match[3]?.trim() || null;
              }
            }

            experiences.push({
              companyName: companyName || 'Unknown Company',
              companyUrl,
              companyLogo,
              roleTitle,
              employmentType: null,
              location,
              startDate,
              endDate: endDate === 'Present' || endDate === 'Atual' ? null : endDate,
              duration,
              description
            });
          }
        } else {
          // Single experience
          const titleEl = item.querySelector('.t-bold span[aria-hidden="true"]');
          const roleTitle = getTextContent(titleEl) || 'Unknown Role';
          const companyLineEl = item.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]')[0];
          let companyName = getTextContent(companyLineEl) || 'Unknown Company';
          let employmentType = null;

          // Parse "Company · Full-time"
          if (companyName && companyName.includes('·')) {
            const parts = companyName.split('·').map(p => p.trim());
            companyName = parts[0];
            employmentType = parts[1] || null;
          }

          const dateRangeEl = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')[0];
          const dateRange = getTextContent(dateRangeEl);
          const locationEl = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')[1];
          const location = getTextContent(locationEl);

          const companyLogoEl = item.querySelector('img');
          const companyLogo = companyLogoEl?.src || null;
          const companyLinkEl = item.querySelector('a[href*="/company/"]');
          const companyUrl = companyLinkEl?.href || null;

          const descEl = item.querySelector('.pvs-list__outer-container .t-14.t-normal');
          const description = getTextContent(descEl);

          let startDate = null, endDate = null, duration = null;
          if (dateRange) {
            const match = dateRange.match(/(.+?)\s*[-–]\s*(.+?)(?:\s*·\s*(.+))?$/);
            if (match) {
              startDate = match[1]?.trim() || null;
              endDate = match[2]?.trim() || null;
              duration = match[3]?.trim() || null;
            }
          }

          experiences.push({
            companyName,
            companyUrl,
            companyLogo,
            roleTitle,
            employmentType,
            location,
            startDate,
            endDate: endDate === 'Present' || endDate === 'Atual' ? null : endDate,
            duration,
            description
          });
        }
      } catch (e) {
        console.warn('[SOS 360] Error extracting experience item:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${experiences.length} experiences`);
    return experiences;
  }

  /**
   * Extract Education section
   */
  async function extractEducationSection() {
    // Suporta: ID (#education) para autenticado e data-section para público
    const section = document.querySelector('#education') ||
      document.querySelector('[data-section="education"]') ||
      document.querySelector('section.education');
    if (!section) return [];

    await scrollToElement(section);
    const sectionContainer = section.closest('section');
    if (!sectionContainer) return [];

    await expandSection(sectionContainer);

    const educations = [];
    const items = sectionContainer.querySelectorAll('.artdeco-list__item, li.pvs-list__paged-list-item');

    for (const item of items) {
      try {
        const schoolEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const school = getTextContent(schoolEl) || 'Unknown School';

        const degreeEl = item.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]')[0];
        let degree = getTextContent(degreeEl);
        let fieldOfStudy = null;

        // Parse "Degree, Field of Study"
        if (degree && degree.includes(',')) {
          const parts = degree.split(',').map(p => p.trim());
          degree = parts[0];
          fieldOfStudy = parts.slice(1).join(', ');
        }

        const dateRangeEl = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')[0];
        const dateRange = getTextContent(dateRangeEl);

        const logoEl = item.querySelector('img');
        const schoolLogo = logoEl?.src || null;
        const linkEl = item.querySelector('a[href*="/school/"]');
        const schoolUrl = linkEl?.href || null;

        let startDate = null, endDate = null;
        if (dateRange) {
          const match = dateRange.match(/(\d{4})\s*[-–]\s*(\d{4}|Present|Atual)/);
          if (match) {
            startDate = match[1];
            endDate = match[2] === 'Present' || match[2] === 'Atual' ? null : match[2];
          }
        }

        educations.push({
          school,
          schoolUrl,
          schoolLogo,
          degree,
          fieldOfStudy,
          startDate,
          endDate,
          grade: null,
          activities: null,
          description: null
        });
      } catch (e) {
        console.warn('[SOS 360] Error extracting education item:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${educations.length} educations`);
    return educations;
  }

  /**
   * Extract Skills section
   */
  async function extractSkillsSection() {
    // Suporta: ID (#skills) para autenticado e data-section para público
    const section = document.querySelector('#skills') ||
      document.querySelector('[data-section="skills"]') ||
      document.querySelector('section.skills');
    if (!section) return [];

    await scrollToElement(section);
    const sectionContainer = section.closest('section');
    if (!sectionContainer) return [];

    await expandSection(sectionContainer);

    const skills = [];
    const items = sectionContainer.querySelectorAll('.artdeco-list__item, li.pvs-list__paged-list-item');

    for (const item of items) {
      try {
        const nameEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const name = getTextContent(nameEl);
        if (!name) continue;

        // Try to get endorsement count
        const endorsementEl = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
        const endorsementText = getTextContent(endorsementEl);
        let endorsementsCount = null;

        if (endorsementText) {
          const match = endorsementText.match(/(\d+)/);
          if (match) {
            endorsementsCount = parseInt(match[1], 10);
          }
        }

        skills.push({
          name,
          endorsementsCount,
          category: null
        });
      } catch (e) {
        console.warn('[SOS 360] Error extracting skill item:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${skills.length} skills`);
    return skills;
  }

  /**
   * Extract Certifications section
   */
  async function extractCertificationsSection() {
    const section = document.querySelector('#licenses_and_certifications');
    if (!section) return [];

    await scrollToElement(section);
    const sectionContainer = section.closest('section');
    if (!sectionContainer) return [];

    await expandSection(sectionContainer);

    const certifications = [];
    const items = sectionContainer.querySelectorAll('.artdeco-list__item, li.pvs-list__paged-list-item');

    for (const item of items) {
      try {
        const nameEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const name = getTextContent(nameEl);
        if (!name) continue;

        const issuerEl = item.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]')[0];
        const issuer = getTextContent(issuerEl);

        const dateEl = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')[0];
        const dateText = getTextContent(dateEl);

        const logoEl = item.querySelector('img');
        const issuerLogo = logoEl?.src || null;

        const credLinkEl = item.querySelector('a[href*="credential"]');
        const credentialUrl = credLinkEl?.href || null;

        let issueDate = null;
        if (dateText) {
          const match = dateText.match(/Issued\s+(.+)|Emitido em\s+(.+)/i);
          if (match) {
            issueDate = (match[1] || match[2])?.trim();
          }
        }

        certifications.push({
          name,
          issuer,
          issuerUrl: null,
          issuerLogo,
          issueDate,
          expirationDate: null,
          credentialId: null,
          credentialUrl
        });
      } catch (e) {
        console.warn('[SOS 360] Error extracting certification item:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${certifications.length} certifications`);
    return certifications;
  }

  /**
   * Extract Languages section
   */
  async function extractLanguagesSection() {
    const section = document.querySelector('#languages');
    if (!section) return [];

    await scrollToElement(section);
    const sectionContainer = section.closest('section');
    if (!sectionContainer) return [];

    const languages = [];
    const items = sectionContainer.querySelectorAll('.artdeco-list__item, li.pvs-list__paged-list-item');

    for (const item of items) {
      try {
        const nameEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const name = getTextContent(nameEl);
        if (!name) continue;

        const proficiencyEl = item.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]')[0];
        const proficiency = getTextContent(proficiencyEl);

        languages.push({
          name,
          proficiency
        });
      } catch (e) {
        console.warn('[SOS 360] Error extracting language item:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${languages.length} languages`);
    return languages;
  }

  /**
   * Extract Recommendations section
   */
  async function extractRecommendationsSection() {
    const section = document.querySelector('#recommendations');
    if (!section) return [];

    await scrollToElement(section);
    const sectionContainer = section.closest('section');
    if (!sectionContainer) return [];

    const recommendations = [];
    // Get "Received" tab items (not "Given")
    const receivedTab = sectionContainer.querySelector('[id*="received"]');
    const container = receivedTab ? receivedTab.closest('.artdeco-tabpanel') : sectionContainer;
    const items = container?.querySelectorAll('.artdeco-list__item, li.pvs-list__paged-list-item') || [];

    for (const item of items) {
      try {
        const authorEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const authorName = getTextContent(authorEl);
        if (!authorName) continue;

        const authorLinkEl = item.querySelector('a[href*="/in/"]');
        const authorUrl = authorLinkEl?.href || null;

        const headlineEl = item.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]')[0];
        const authorHeadline = getTextContent(headlineEl);

        const avatarEl = item.querySelector('img');
        const authorAvatar = avatarEl?.src || null;

        const textEl = item.querySelector('.pvs-list__outer-container .t-14.t-normal');
        const text = getTextContent(textEl);

        recommendations.push({
          authorName,
          authorUrl,
          authorHeadline,
          authorAvatar,
          relationship: null,
          date: null,
          text
        });
      } catch (e) {
        console.warn('[SOS 360] Error extracting recommendation item:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${recommendations.length} recommendations`);
    return recommendations;
  }

  /**
   * Extract Contact Info from modal
   */
  async function extractContactInfoModal() {
    // Find and click the contact info link
    const contactLink = document.querySelector('a[href*="/overlay/contact-info/"], a[id*="contact-info"]');
    if (!contactLink) {
      console.log('[SOS 360] Contact info link not found');
      return null;
    }

    contactLink.click();
    await sleep(1500);

    const modal = document.querySelector('.artdeco-modal, [role="dialog"]');
    if (!modal) {
      console.log('[SOS 360] Contact info modal did not open');
      return null;
    }

    const contactInfo = {
      email: null,
      phone: null,
      website: null,
      twitter: null,
      birthday: null,
      address: null,
      profileUrl: null
    };

    try {
      // Extract each type of contact info
      const sections = modal.querySelectorAll('.pv-contact-info__contact-type, .ci-email, .ci-phone, .ci-vanity-url, .ci-websites, .ci-twitter');

      for (const section of sections) {
        const headerText = getTextContent(section.querySelector('header, h3, .t-14.t-bold'));
        const valueEl = section.querySelector('a, span.t-14.t-black--light, .pv-contact-info__ci-container a');
        const value = valueEl?.href || getTextContent(valueEl);

        if (!headerText || !value) continue;

        const headerLower = headerText.toLowerCase();

        if (headerLower.includes('email')) {
          contactInfo.email = value.replace('mailto:', '');
        } else if (headerLower.includes('phone') || headerLower.includes('telefone')) {
          contactInfo.phone = value.replace('tel:', '');
        } else if (headerLower.includes('website') || headerLower.includes('site')) {
          contactInfo.website = value;
        } else if (headerLower.includes('twitter')) {
          contactInfo.twitter = value;
        } else if (headerLower.includes('birthday') || headerLower.includes('aniversário')) {
          contactInfo.birthday = value;
        } else if (headerLower.includes('address') || headerLower.includes('endereço')) {
          contactInfo.address = value;
        } else if (headerLower.includes('profile') || headerLower.includes('perfil')) {
          contactInfo.profileUrl = value;
        }
      }
    } catch (e) {
      console.warn('[SOS 360] Error extracting contact info:', e);
    }

    // Close modal
    const closeBtn = modal.querySelector('button[aria-label="Dismiss"], button[aria-label="Fechar"]');
    if (closeBtn) closeBtn.click();
    await sleep(500);

    console.log('[SOS 360] Extracted contact info');
    return contactInfo;
  }

  /**
   * Extract Featured section
   */
  async function extractFeaturedSection() {
    const section = document.querySelector('#featured');
    if (!section) return [];

    await scrollToElement(section);
    const sectionContainer = section.closest('section');
    if (!sectionContainer) return [];

    const featured = [];
    const items = sectionContainer.querySelectorAll('.artdeco-carousel__item, .pvs-list__paged-list-item');

    for (const item of items) {
      try {
        const linkEl = item.querySelector('a');
        const url = linkEl?.href || null;

        const titleEl = item.querySelector('.t-bold span[aria-hidden="true"]');
        const title = getTextContent(titleEl);

        const imgEl = item.querySelector('img');
        const thumbnailUrl = imgEl?.src || null;

        const descEl = item.querySelector('.t-14.t-normal');
        const description = getTextContent(descEl);

        // Determine type based on URL or content
        let type = 'link';
        if (url?.includes('linkedin.com/posts') || url?.includes('linkedin.com/feed')) {
          type = 'post';
        } else if (url?.includes('linkedin.com/pulse')) {
          type = 'article';
        } else if (thumbnailUrl?.includes('media') || thumbnailUrl?.includes('video')) {
          type = 'media';
        }

        featured.push({
          type,
          title,
          url,
          thumbnailUrl,
          description
        });
      } catch (e) {
        console.warn('[SOS 360] Error extracting featured item:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${featured.length} featured items`);
    return featured;
  }

  /**
   * Extract Posts with better data
   */
  async function extractPostsEnriched() {
    const posts = [];

    // Try to get from activity section on profile
    const activitySection = document.querySelector('#content_collections');
    if (activitySection) {
      await scrollToElement(activitySection);
    }

    const postSelectors = [
      '.profile-creator-shared-feed-update__container',
      '.feed-shared-update-v2',
      '.occludable-update'
    ];

    let postElements = [];
    for (const sel of postSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        postElements = Array.from(els);
        break;
      }
    }

    for (const postEl of postElements.slice(0, 5)) {
      try {
        const textEl = postEl.querySelector('.feed-shared-update-v2__description, .update-components-text');
        const content = getTextContent(textEl);

        const socialCounts = postEl.querySelector('.social-details-social-counts');
        const likesEl = socialCounts?.querySelector('.social-details-social-counts__reactions-count');
        const commentsEl = socialCounts?.querySelector('.social-details-social-counts__comments');

        let likes = null, comments = null;
        const likesText = getTextContent(likesEl);
        if (likesText) {
          likes = parseInt(likesText.replace(/[^\\d]/g, ''), 10) || null;
        }
        const commentsText = getTextContent(commentsEl);
        if (commentsText) {
          const match = commentsText.match(/(\\d+)/);
          if (match) comments = parseInt(match[1], 10);
        }

        const timeEl = postEl.querySelector('.update-components-actor__sub-description');
        const date = getTextContent(timeEl);

        // Images
        const imageUrls = [];
        const imgEls = postEl.querySelectorAll('.feed-shared-image__image, .update-components-image img');
        for (const img of imgEls) {
          if (img.src && img.src.includes('licdn.com')) {
            imageUrls.push(img.src);
          }
        }

        // Post link
        const postLinkEl = postEl.querySelector('a[href*="/feed/update/"]');
        const postUrl = postLinkEl?.href || null;

        posts.push({
          content,
          date,
          likes,
          comments,
          shares: null,
          imageUrls: imageUrls.slice(0, 3),
          videoUrls: [],
          linkedUrl: null,
          postUrl,
          postType: 'post'
        });
      } catch (e) {
        console.warn('[SOS 360] Error extracting post:', e);
      }
    }

    console.log(`[SOS 360] Extracted ${posts.length} posts`);
    return posts;
  }

  /**
   * Main enrichment orchestrator - limits to 4 sections per visit
   */
  async function performFullEnrichment() {
    console.log('[SOS 360] Starting full profile enrichment...');

    const sections = [
      { name: 'experiences', fn: extractExperienceSection, priority: 1 },
      { name: 'educations', fn: extractEducationSection, priority: 2 },
      { name: 'skills', fn: extractSkillsSection, priority: 3 },
      { name: 'certifications', fn: extractCertificationsSection, priority: 4 },
      { name: 'languages', fn: extractLanguagesSection, priority: 5 },
      { name: 'recommendations', fn: extractRecommendationsSection, priority: 6 },
      { name: 'featured', fn: extractFeaturedSection, priority: 7 },
      { name: 'posts', fn: extractPostsEnriched, priority: 8 },
      { name: 'contactInfo', fn: extractContactInfoModal, priority: 9 }, // Most invasive, do last if at all
    ];

    const results = {
      experiences: [],
      educations: [],
      certifications: [],
      skills: [],
      languages: [],
      recommendations: [],
      volunteers: [],
      publications: [],
      patents: [],
      projects: [],
      courses: [],
      honors: [],
      organizations: [],
      featured: [],
      contactInfo: null,
      posts: []
    };

    const MAX_SECTIONS = 4;
    let extractedCount = 0;

    for (const section of sections) {
      if (extractedCount >= MAX_SECTIONS) {
        console.log(`[SOS 360] Reached max sections limit (${MAX_SECTIONS}), stopping extraction`);
        break;
      }

      try {
        console.log(`[SOS 360] Extracting ${section.name}...`);
        const data = await section.fn();

        // Only count as extracted if we got data
        if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
          results[section.name] = data;
          extractedCount++;
          console.log(`[SOS 360] ${section.name} extracted successfully`);
        }

        // Random delay between sections to avoid detection
        await sleep(1000 + Math.random() * 800);
      } catch (e) {
        console.warn(`[SOS 360] Failed to extract ${section.name}:`, e);
        // Don't count failed extraction against limit
      }
    }

    console.log(`[SOS 360] Enrichment complete. Extracted ${extractedCount} sections.`);

    // Extract jobTitle from first experience if available
    if (results.experiences && results.experiences.length > 0) {
      results.jobTitle = results.experiences[0].roleTitle || null;
    }

    return results;
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
    const isPeoplePage = window.location.href.includes('/search/results/people/');
    const isMiningPage = isConnectionsPage || isPeoplePage;
    const title = isConnectionsPage ? 'Import: Connections' : isPeoplePage ? 'Import: People Search' : 'Import Status';

    // If not on connections/people page (e.g. Feed), we might want to hide "Auto-Scroll" or "Keywords" if they aren't relevant for the specific batch job.
    // However, if the user IS mining the feed (future feature?), keep them.
    // For now, if it's NOT connections/people page, it's likely just Deep Import progress.
    // Let's keep it simple: Show simplified UI if not connections/people page.

    const displayStyle = isMiningPage ? 'flex' : 'none';

    const overlay = document.createElement('div');
    overlay.id = UI_ID;
    overlay.innerHTML = `
      <div class="sos-header">
        <span class="sos-title">${title}</span>
        <div class="sos-header-actions">
          <button id="sos-menu" class="sos-menu-btn" title="Selecionar Audiência">☰</button>
          <button id="sos-close" class="sos-close">&times;</button>
        </div>
      </div>
      <div id="sos-audience-menu" class="sos-dropdown" style="display:none;">
        <div class="sos-dropdown-header">Selecionar Audiência</div>
        <div id="sos-audience-list" class="sos-dropdown-content">
          <div class="sos-loading">Carregando...</div>
        </div>
      </div>
      <div id="sos-selected-audience" class="sos-selected-audience" style="display:none;">
        <span id="sos-audience-name">Nenhuma selecionada</span>
        <button id="sos-clear-audience" class="sos-clear-btn" title="Remover">&times;</button>
      </div>
      <div class="sos-content">
        <div class="sos-input-group" style="display:${displayStyle}">
          <label for="sos-keywords">Filtrar por Keywords (cargo):</label>
          <input type="text" id="sos-keywords" placeholder="Ex: CEO, Diretor, Gerente">
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
          <button id="sos-bulk-scan-btn" class="sos-btn" style="background: #8b5cf6; color: white; margin-bottom: 8px;">
            <span>📚</span> Minerar Múltiplas Páginas
          </button>
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
      <div id="sos-pipeline-dialog" class="sos-dialog" style="display:none;">
        <div class="sos-dialog-overlay"></div>
        <div class="sos-dialog-content">
          <div class="sos-dialog-header">
            <span>📁 Selecionar Destino</span>
            <button id="sos-dialog-close" class="sos-close">&times;</button>
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
              <div style="font-size: 24px; font-weight: bold; color: #10b981;">0</div>
              <div style="font-size: 11px; color: #9ca3af;">leads serão importados</div>
            </div>
          </div>
          <div class="sos-dialog-footer">
            <button id="sos-cancel-import" class="sos-btn" style="background: #374151;">Cancelar</button>
            <button id="sos-confirm-import" class="sos-btn sos-btn-action" disabled>
              Confirmar Importação
            </button>
          </div>
        </div>
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
      #${UI_ID} .sos-header-actions { display: flex; align-items: center; gap: 8px; }
      #${UI_ID} .sos-menu-btn { background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; padding: 0; line-height: 1; }
      #${UI_ID} .sos-menu-btn:hover { color: #fff; }
      #${UI_ID} .sos-title { font-weight: 600; font-size: 14px; }
      #${UI_ID} .sos-close { background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; }
      #${UI_ID} .sos-close:hover { color: #fff; }
      #${UI_ID} .sos-dropdown { position: absolute; top: 44px; right: 8px; width: 200px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
      #${UI_ID} .sos-dropdown-header { padding: 8px 12px; font-size: 11px; color: #9ca3af; border-bottom: 1px solid #374151; text-transform: uppercase; letter-spacing: 0.5px; }
      #${UI_ID} .sos-dropdown-content { max-height: 180px; overflow-y: auto; }
      #${UI_ID} .sos-audience-item { padding: 10px 12px; cursor: pointer; font-size: 13px; color: #d1d5db; border-bottom: 1px solid #374151; transition: background 0.15s; }
      #${UI_ID} .sos-audience-item:last-child { border-bottom: none; }
      #${UI_ID} .sos-audience-item:hover { background: #374151; color: #fff; }
      #${UI_ID} .sos-audience-item.selected { background: #3b82f6; color: #fff; }
      #${UI_ID} .sos-loading { padding: 12px; color: #9ca3af; font-size: 12px; text-align: center; }
      #${UI_ID} .sos-selected-audience { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #3b82f6; font-size: 12px; }
      #${UI_ID} .sos-clear-btn { background: none; border: none; color: rgba(255,255,255,0.7); font-size: 16px; cursor: pointer; padding: 0; line-height: 1; }
      #${UI_ID} .sos-clear-btn:hover { color: #fff; }
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
      
      /* Dialog Styles */
      #${UI_ID} .sos-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483648;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #${UI_ID} .sos-dialog-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6);
      }
      #${UI_ID} .sos-dialog-content {
        position: relative;
        background: #1f2937;
        border-radius: 12px;
        width: 340px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        animation: sos-dialog-in 0.2s ease;
      }
      @keyframes sos-dialog-in {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      #${UI_ID} .sos-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid #374151;
        font-weight: 600;
      }
      #${UI_ID} .sos-dialog-body {
        padding: 16px;
      }
      #${UI_ID} .sos-form-group {
        margin-bottom: 16px;
      }
      #${UI_ID} .sos-form-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 12px;
        color: #9ca3af;
      }
      #${UI_ID} .sos-form-group select {
        width: 100%;
        padding: 10px 12px;
        background: #374151;
        border: 1px solid #4b5563;
        border-radius: 6px;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
      }
      #${UI_ID} .sos-form-group select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #${UI_ID} .sos-form-group select:focus {
        outline: none;
        border-color: #3b82f6;
      }
      #${UI_ID} .sos-dialog-footer {
        display: flex;
        gap: 8px;
        padding: 16px;
        border-top: 1px solid #374151;
      }
      #${UI_ID} .sos-dialog-footer .sos-btn {
        flex: 1;
      }
      </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sos-close').addEventListener('click', () => {
      document.getElementById(UI_ID).style.display = 'none';
      stopAutoScroll();
      clearState(); // Limpa estado se fechar
    });

    // Menu de audiências
    document.getElementById('sos-menu').addEventListener('click', toggleAudienceMenu);
    document.getElementById('sos-clear-audience').addEventListener('click', clearSelectedAudience);

    document.getElementById('sos-keywords').addEventListener('input', (e) => {
      updateKeywords(e.target.value);
    });

    if (state.keywords.length > 0) {
      document.getElementById('sos-keywords').value = state.keywords.join(', ');
    }

    document.getElementById('sos-scroll-btn').addEventListener('click', () => {
      if (state.isAutoScrolling) stopAutoScroll(true); // Usuário clicou em parar
      else startAutoScroll();
    });

    // Novo Botão de Bulk Scan
    document.getElementById('sos-bulk-scan-btn').addEventListener('click', async () => {
      if (state.isAutoScrolling) {
        stopAutoScroll(true); // Usuário clicou em parar
        return;
      }
      state.isBulkScanning = true;
      await saveState(); // Ativa persistência
      startAutoScroll();
    });

    document.getElementById('sos-import-btn').addEventListener('click', importQualifiedLeads);

    // Event listeners do dialog de pipeline
    document.getElementById('sos-pipeline-select').addEventListener('change', (e) => {
      state.selectedPipeline = e.target.value;
      updateStages(e.target.value);
    });

    document.getElementById('sos-stage-select').addEventListener('change', (e) => {
      state.selectedStage = e.target.value;
      const confirmBtn = document.getElementById('sos-confirm-import');
      if (confirmBtn) confirmBtn.disabled = !e.target.value;
    });

    document.getElementById('sos-confirm-import').addEventListener('click', confirmImport);
    document.getElementById('sos-cancel-import').addEventListener('click', closePipelineDialog);
    document.getElementById('sos-dialog-close').addEventListener('click', closePipelineDialog);
    document.querySelector(`#${UI_ID} .sos-dialog-overlay`)?.addEventListener('click', closePipelineDialog);

    setTimeout(scanConnections, 500);
  }

  // --- Audience Menu Functions ---
  async function toggleAudienceMenu() {
    const menu = document.getElementById('sos-audience-menu');
    if (!menu) return;

    if (menu.style.display === 'none') {
      menu.style.display = 'block';
      await loadAudiences();
    } else {
      menu.style.display = 'none';
    }
  }

  async function loadAudiences() {
    const listEl = document.getElementById('sos-audience-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="sos-loading">Carregando...</div>';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAudiences' });

      if (response.success && response.data) {
        state.audiences = response.data;
        renderAudienceList();
      } else {
        listEl.innerHTML = '<div class="sos-loading">Erro ao carregar</div>';
      }
    } catch (e) {
      console.error('[SOS 360] Error loading audiences:', e);
      listEl.innerHTML = '<div class="sos-loading">Erro ao carregar</div>';
    }
  }

  function renderAudienceList() {
    const listEl = document.getElementById('sos-audience-list');
    if (!listEl) return;

    if (state.audiences.length === 0) {
      listEl.innerHTML = '<div class="sos-loading">Nenhuma audiência</div>';
      return;
    }

    listEl.innerHTML = state.audiences.map((audience, index) => `
      <div class="sos-audience-item ${state.selectedAudience?.id === audience.id ? 'selected' : ''}" 
           data-index="${index}">
        ${audience.name}
      </div>
    `).join('');

    // Add click listeners
    listEl.querySelectorAll('.sos-audience-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        selectAudience(state.audiences[index]);
      });
    });
  }

  function selectAudience(audience) {
    // Armazenar objeto completo da audiência com todos os parâmetros
    state.selectedAudience = audience;

    // Update UI
    const selectedEl = document.getElementById('sos-selected-audience');
    const nameEl = document.getElementById('sos-audience-name');
    const menu = document.getElementById('sos-audience-menu');

    if (selectedEl) selectedEl.style.display = 'flex';
    if (nameEl) nameEl.textContent = audience.name;
    if (menu) menu.style.display = 'none';

    // Update list to show selection
    renderAudienceList();

    // Re-scan connections with new audience criteria
    scanConnections();

    console.log('[SOS 360] Selected audience:', state.selectedAudience);
  }

  function clearSelectedAudience() {
    state.selectedAudience = null;

    const selectedEl = document.getElementById('sos-selected-audience');
    if (selectedEl) selectedEl.style.display = 'none';

    renderAudienceList();
    scanConnections();
    console.log('[SOS 360] Cleared audience selection');
  }

  // --- Pipeline Selection & Import Functions ---
  async function importQualifiedLeads() {
    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) {
      alert('Nenhum lead qualificado para importar.');
      return;
    }

    console.log('[SOS 360] Iniciando importação de', leads.length, 'leads');
    openPipelineDialog();
  }

  function openPipelineDialog() {
    const dialog = document.getElementById('sos-pipeline-dialog');
    if (!dialog) return;

    // Atualizar resumo com quantidade de leads
    const summaryEl = document.getElementById('sos-import-summary');
    if (summaryEl) {
      const count = state.qualifiedLeads.size;
      summaryEl.innerHTML = `
        <div style="font-size: 24px; font-weight: bold; color: #10b981;">${count}</div>
        <div style="font-size: 11px; color: #9ca3af;">leads serão importados</div>
      `;
    }

    dialog.style.display = 'flex';
    loadPipelines();
  }

  async function loadPipelines() {
    const pipelineSelect = document.getElementById('sos-pipeline-select');
    const stageSelect = document.getElementById('sos-stage-select');
    const confirmBtn = document.getElementById('sos-confirm-import');

    if (!pipelineSelect) return;

    pipelineSelect.innerHTML = '<option value="">Carregando...</option>';
    stageSelect.disabled = true;
    confirmBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getPipelines' });

      if (response.success && response.data) {
        state.pipelines = response.data;

        pipelineSelect.innerHTML = '<option value="">Selecione um pipeline</option>';
        state.pipelines.forEach(pipeline => {
          const option = document.createElement('option');
          option.value = pipeline.id;
          option.textContent = pipeline.name + (pipeline.isDefault ? ' ⭐' : '');
          pipelineSelect.appendChild(option);
        });

        // Pré-selecionar pipeline padrão
        const defaultPipeline = state.pipelines.find(p => p.isDefault);
        if (defaultPipeline) {
          pipelineSelect.value = defaultPipeline.id;
          state.selectedPipeline = defaultPipeline.id;
          updateStages(defaultPipeline.id);
        }
      } else {
        pipelineSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        console.error('[SOS 360] Erro ao carregar pipelines:', response?.error);
      }
    } catch (e) {
      console.error('[SOS 360] Erro ao carregar pipelines:', e);
      pipelineSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }

  function updateStages(pipelineId) {
    const stageSelect = document.getElementById('sos-stage-select');
    const confirmBtn = document.getElementById('sos-confirm-import');

    if (!pipelineId) {
      stageSelect.innerHTML = '<option value="">Selecione um pipeline primeiro</option>';
      stageSelect.disabled = true;
      confirmBtn.disabled = true;
      state.selectedStage = null;
      return;
    }

    const pipeline = state.pipelines.find(p => p.id === pipelineId);
    if (!pipeline || !pipeline.stages || pipeline.stages.length === 0) {
      stageSelect.innerHTML = '<option value="">Nenhuma coluna encontrada</option>';
      stageSelect.disabled = true;
      confirmBtn.disabled = true;
      state.selectedStage = null;
      return;
    }

    stageSelect.innerHTML = '';
    pipeline.stages.forEach(stage => {
      const option = document.createElement('option');
      option.value = stage.id;
      option.textContent = stage.name;
      if (stage.color) {
        option.style.borderLeft = `4px solid ${stage.color}`;
      }
      stageSelect.appendChild(option);
    });

    stageSelect.disabled = false;

    // Selecionar primeiro stage por padrão
    if (pipeline.stages.length > 0) {
      stageSelect.value = pipeline.stages[0].id;
      state.selectedStage = pipeline.stages[0].id;
      confirmBtn.disabled = false;
    }
  }

  async function confirmImport() {
    const pipelineSelect = document.getElementById('sos-pipeline-select');
    const stageSelect = document.getElementById('sos-stage-select');
    const confirmBtn = document.getElementById('sos-confirm-import');
    const dialog = document.getElementById('sos-pipeline-dialog');

    const pipelineId = pipelineSelect?.value;
    const stageId = stageSelect?.value;

    if (!stageId) {
      alert('Por favor, selecione uma coluna de destino.');
      return;
    }

    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) {
      alert('Nenhum lead para importar.');
      closePipelineDialog();
      return;
    }

    // Desabilitar botão e mostrar loading
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importando...';

    console.log('[SOS 360] Importando', leads.length, 'leads para pipeline', pipelineId, 'stage', stageId);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'importLeads',
        data: {
          source: 'extension',
          platform: 'linkedin',
          sourceUrl: window.location.href,
          leads: leads,
          pipelineStageId: stageId
        }
      });

      if (response?.success) {
        const result = response.data?.result || {};
        const imported = result.imported || leads.length;

        // Mostrar sucesso
        showImportSuccess(imported);

        // Limpar estado
        state.qualifiedLeads.clear();
        state.totalConnectionsFound = state.scannedHistoryCount;
        updateUI();

        // Fechar dialog
        closePipelineDialog();
      } else {
        console.error('[SOS 360] Erro na importação:', response?.error);
        alert('Falha na importação: ' + (response?.error || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error('[SOS 360] Erro na importação:', e);
      alert('Erro: ' + e.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirmar Importação';
    }
  }

  function closePipelineDialog() {
    const dialog = document.getElementById('sos-pipeline-dialog');
    if (dialog) dialog.style.display = 'none';
    state.selectedPipeline = null;
    state.selectedStage = null;
  }

  function showImportSuccess(count) {
    const notif = document.createElement('div');
    notif.id = 'sos-import-success-notif';
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
            <div style="font-weight:600; font-size:14px;">Importação Concluída!</div>
            <div style="font-size:12px; opacity:0.9;">${count} leads importados com sucesso</div>
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

    // Remover após 5 segundos
    setTimeout(() => {
      notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(100%)';
      setTimeout(() => notif.remove(), 300);
    }, 5000);
  }

  // --- Gender Inference Logic ---
  function inferGenderFromName(fullName) {
    if (!fullName) return null;

    // Lista de primeiros nomes comuns com gênero conhecido
    const maleNames = new Set([
      'joão', 'jose', 'josé', 'carlos', 'pedro', 'paulo', 'lucas', 'marcos', 'rafael',
      'bruno', 'diego', 'thiago', 'tiago', 'gustavo', 'andre', 'andré', 'marcelo',
      'rodrigo', 'felipe', 'leandro', 'alex', 'alexandre', 'guilherme', 'fernando',
      'ricardo', 'roberto', 'daniel', 'flavio', 'flávio', 'eduardo', 'luca', 'matheus'
    ]);
    const femaleNames = new Set([
      'maria', 'ana', 'carla', 'paula', 'julia', 'júlia', 'camila', 'bruna', 'amanda',
      'beatriz', 'larissa', 'jessica', 'jéssica', 'mariana', 'fernanda', 'patricia',
      'patrícia', 'leticia', 'letícia', 'gabriela', 'vanessa', 'sabrina', 'renata',
      'daniela', 'carolina', 'andrea', 'andréa', 'adriana', 'claudia', 'cláudia',
      'natalia', 'natália', 'bianca', 'tatiana', 'priscila', 'aline', 'roberta'
    ]);

    // Extrair primeiro nome
    // Remover emojis e caracteres não alfabéticos do início
    let cleanName = fullName.replace(/^[^a-zA-ZÀ-ÿ]+/, '');
    const firstName = cleanName.trim().split(/[\s-]+/)[0].toLowerCase(); // Split por espaço ou hífen

    if (!firstName) return null;

    // console.log('[SOS 360] Inferindo gênero para:', firstName, `(${fullName})`);

    // 1. Verificar lista de nomes conhecidos
    if (maleNames.has(firstName)) return 'male';
    if (femaleNames.has(firstName)) return 'female';

    // 2. Heurística por terminação (português)
    // Nomes femininos tipicamente terminam em 'a'
    // Nomes masculinos tipicamente terminam em 'o'
    const lastChar = firstName.slice(-1);

    // Exceções comuns à regra de terminação
    const exceptions = ['luca', 'bono'];
    if (exceptions.includes(firstName)) return null;

    if (lastChar === 'a') return 'female';
    if (lastChar === 'o') return 'male';

    // 3. Indeterminado
    return null;
  }

  // --- Country Mapping for Location Matching ---
  function getCountryNames(countryCode) {
    const countryMap = {
      'BR': ['brasil', 'brazil'],
      'US': ['estados unidos', 'united states', 'usa', 'eua'],
      'PT': ['portugal'],
      'ES': ['espanha', 'spain', 'españa'],
      'AR': ['argentina'],
      'MX': ['méxico', 'mexico'],
      'CO': ['colômbia', 'colombia'],
      'CL': ['chile'],
      'PE': ['peru', 'perú'],
      'UY': ['uruguai', 'uruguay'],
      'PY': ['paraguai', 'paraguay'],
      'VE': ['venezuela'],
      'EC': ['equador', 'ecuador'],
      'BO': ['bolívia', 'bolivia'],
      'GB': ['reino unido', 'united kingdom', 'uk', 'england', 'inglaterra'],
      'FR': ['frança', 'france'],
      'DE': ['alemanha', 'germany', 'deutschland'],
      'IT': ['itália', 'italy', 'italia'],
      'CA': ['canadá', 'canada'],
      'AU': ['austrália', 'australia'],
      'JP': ['japão', 'japan'],
      'CN': ['china'],
      'IN': ['índia', 'india'],
      'ZA': ['áfrica do sul', 'south africa'],
      'AO': ['angola'],
      'MZ': ['moçambique', 'mozambique'],
    };
    return countryMap[countryCode] || [countryCode.toLowerCase()];
  }

  // --- Audience Criteria Matching ---
  function matchesAudienceCriteria(lead, audience) {
    // Se não tem audiência selecionada, passa apenas pelos keywords manuais
    if (!audience) return true;

    const text = ((lead.bio || '') + ' ' + (lead.headline || '')).toLowerCase();
    const fullName = (lead.fullName || '').toLowerCase();

    // Verificação de GÊNERO
    if (audience.gender && audience.gender.length > 0) {
      const inferredGender = inferGenderFromName(lead.fullName);

      if (inferredGender === null) {
        // Gênero não pôde ser determinado
        // Se ignoreGenderIfUnknown === true (ou não definido), ignora o critério
        // Se ignoreGenderIfUnknown === false, falha
        if (audience.ignoreGenderIfUnknown === false) {
          console.log('[SOS 360] Lead rejeitado - gênero indeterminado:', lead.fullName);
          return false;
        }
        // Se true ou undefined, simplesmente passa (ignora o critério de gênero)
      } else {
        // Gênero foi determinado - verificar se está na lista permitida
        if (!audience.gender.includes(inferredGender)) {
          console.log('[SOS 360] Lead rejeitado - gênero não match:', lead.fullName, { inferred: inferredGender, allowed: audience.gender });
          return false;
        }
      }
    }

    // Verificação de PAÍS
    if (audience.countries && audience.countries.length > 0) {
      const leadLocation = (lead.location || '').toLowerCase();

      if (!leadLocation) {
        // País/localização não disponível no lead
        // Se ignoreCountryIfUnknown === true (ou não definido), ignora o critério
        // Se ignoreCountryIfUnknown === false, falha
        if (audience.ignoreCountryIfUnknown === false) {
          console.log('[SOS 360] Lead rejeitado - sem localização:', lead.fullName);
          return false;
        }
        // Se true ou undefined, simplesmente passa (ignora o critério de país)
      } else {
        // Localização disponível - verificar se contém algum dos países permitidos
        // Usamos verificação simples por substring já que location pode ser "São Paulo, Brasil"
        const matchesCountry = audience.countries.some(countryCode => {
          // Mapear códigos ISO para nomes comuns em português/inglês
          const countryNames = getCountryNames(countryCode);
          return countryNames.some(name => leadLocation.includes(name.toLowerCase()));
        });
        if (!matchesCountry) {
          console.log('[SOS 360] Lead rejeitado - país não match:', lead.fullName, { location: leadLocation, countries: audience.countries });
          return false;
        }
      }
    }

    // Verificar jobTitleInclude (pelo menos um deve estar presente)
    if (audience.jobTitleInclude && audience.jobTitleInclude.length > 0) {
      // Normalizar texto para remover acentos antes da comparação
      const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedText = normalize(text);

      const hasMatch = audience.jobTitleInclude.some(kw =>
        normalizedText.includes(normalize(kw)) || text.includes(kw.toLowerCase())
      );

      if (!hasMatch) {
        console.log('[SOS 360] Lead rejeitado - jobTitle não match:', lead.fullName, { keywords: audience.jobTitleInclude, text: text.substring(0, 100) });
        return false;
      }
    }

    // Verificar jobTitleExclude (nenhum deve estar presente)
    if (audience.jobTitleExclude && audience.jobTitleExclude.length > 0) {
      const hasExcluded = audience.jobTitleExclude.some(kw =>
        text.includes(kw.toLowerCase())
      );
      if (hasExcluded) return false;
    }

    // Verificar profileInfoInclude
    if (audience.profileInfoInclude && audience.profileInfoInclude.length > 0) {
      const combinedText = text + ' ' + fullName;
      const hasMatch = audience.profileInfoInclude.some(kw =>
        combinedText.includes(kw.toLowerCase())
      );
      if (!hasMatch) return false;
    }

    // Verificar profileInfoExclude
    if (audience.profileInfoExclude && audience.profileInfoExclude.length > 0) {
      const combinedText = text + ' ' + fullName;
      const hasExcluded = audience.profileInfoExclude.some(kw =>
        combinedText.includes(kw.toLowerCase())
      );
      if (hasExcluded) return false;
    }

    // Verificar excludeNoPhoto
    if (audience.excludeNoPhoto && !lead.avatarUrl) {
      console.log('[SOS 360] Lead rejeitado - sem foto:', lead.fullName);
      return false;
    }

    // Verificar verifiedFilter (para LinkedIn, verificados são mais raros)
    // Se tivermos essa info no lead futuro, validar aqui

    console.log('[SOS 360] Lead APROVADO:', lead.fullName, { bio: lead.bio?.substring(0, 50), location: lead.location });
    // Passou em todos os critérios
    return true;
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
    // Estratégia v4.0: Detecção automática de contexto (Conexões vs Busca)
    // Suporta tanto página de conexões quanto página de busca de pessoas

    const isConnectionsPage = window.location.pathname.includes('/connections');
    const isSearchPage = window.location.pathname.includes('/search/results');

    console.log(`[SOS 360] Detectando contexto: Conexões=${isConnectionsPage}, Busca=${isSearchPage}`);

    let profileElements = [];

    if (isConnectionsPage) {
      // PÁGINA DE CONEXÕES: Usar seletor específico
      profileElements = Array.from(document.querySelectorAll('[data-view-name="connections-profile"]'));
      console.log(`[SOS 360] Página de Conexões - Encontrados ${profileElements.length} perfis via connections-profile`);
    } else {
      // PÁGINA DE BUSCA: Usar seletor de busca
      profileElements = Array.from(document.querySelectorAll('[data-view-name="search-result-lockup-title"]'));
      console.log(`[SOS 360] Página de Busca - Encontrados ${profileElements.length} perfis via search-result-lockup-title`);
    }

    // Fallback: Se nenhum seletor específico funcionar, tentar links genéricos de perfil
    if (profileElements.length === 0) {
      const allProfileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      // Filtrar links de navegação/header
      profileElements = allProfileLinks.filter(link => {
        return !link.closest('header') && !link.closest('nav') && !link.closest('.global-nav');
      });
      console.log(`[SOS 360] Fallback genérico - Encontrados ${profileElements.length} links de perfil`);
    }

    // Atualiza total = histórico de outras páginas + leads encontrados nesta página
    state.totalConnectionsFound = state.scannedHistoryCount + profileElements.length;

    console.log(`[SOS 360] Scan iniciado. Perfis nesta pág: ${profileElements.length}. Total Global: ${state.totalConnectionsFound}`);
    console.log('[SOS 360] Estado:', {
      audience: state.selectedAudience?.name,
      keywords: state.keywords,
      bulk: state.isBulkScanning
    });

    profileElements.forEach(linkEl => {
      try {
        // Validar se é um link de perfil real
        const profileUrl = linkEl.href;
        if (!profileUrl || !profileUrl.includes('/in/')) return;

        // Determinar container do card
        let card = null;

        if (isConnectionsPage) {
          // Para página de conexões: subir no DOM até encontrar container com múltiplos filhos
          let parent = linkEl.parentElement;
          let depth = 0;
          while (parent && depth < 10) {
            const childCount = parent.children.length;
            const hasButton = parent.querySelector('button');
            // Card típico tem: avatar, info, botões (3+ filhos)
            if (childCount >= 3 && hasButton) {
              card = parent;
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
          // Fallback: usar o ancestral mais próximo com altura significativa
          if (!card) {
            parent = linkEl.parentElement;
            depth = 0;
            while (parent && depth < 8) {
              if (parent.offsetHeight > 50) {
                card = parent;
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        } else {
          // Para página de busca: usar lógica original
          card = linkEl.closest('li') || linkEl.closest('[role="listitem"]') || linkEl.closest('.reusable-search__result-container');
        }

        if (!card) {
          // Último fallback
          card = linkEl.parentElement?.parentElement?.parentElement;
        }

        if (!card) return;

        // Evita reprocessar se já extraímos e VALIDAMOS este lead
        const cleanUrl = profileUrl.split('?')[0];
        if (state.qualifiedLeads.has(cleanUrl) || card.dataset.sosProcessed) {
          return;
        }

        const username = parseLinkedInUrl(profileUrl);
        if (!username) return;

        // --- EXTRAÇÃO DE DADOS ---
        let fullName = '';
        let bio = '';
        let location = '';
        let avatarUrl = null;

        if (isConnectionsPage) {
          // EXTRAÇÃO PARA PÁGINA DE CONEXÕES (baseada em innerText posicional)
          const cardText = card.innerText || '';
          const lines = cardText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

          // Estrutura típica: [Nome, Headline, "Connected on...", "Message"]
          if (lines.length >= 1) {
            fullName = lines[0];
          }
          if (lines.length >= 2) {
            bio = lines[1];
            // Limpar se for data de conexão
            if (bio.toLowerCase().includes('connected on') || bio.toLowerCase().includes('conectado em')) {
              bio = '';
            }
          }
          if (lines.length >= 3 && !bio) {
            // Se linha 2 era data, talvez linha 1 era o bio
            bio = lines[1];
          }

          // Avatar: buscar img com src do LinkedIn CDN
          const img = card.querySelector('img[src*="licdn.com"]');
          avatarUrl = img?.src || null;

          // Location: geralmente não está visível no card de conexões, mas tentar
          const locationLine = lines.find(l => {
            const lower = l.toLowerCase();
            return (lower.includes(',') && !lower.includes('connected') && !lower.includes('message'));
          });
          if (locationLine && locationLine !== fullName && locationLine !== bio) {
            location = locationLine;
          }

        } else {
          // EXTRAÇÃO PARA PÁGINA DE BUSCA (lógica original)
          const spanHidden = linkEl.querySelector('span[aria-hidden="true"]');
          fullName = (spanHidden ? spanHidden.innerText : linkEl.innerText).trim();

          let anchorBlock = linkEl.closest('.entity-result__title-text');
          if (!anchorBlock) {
            let p = linkEl.parentElement;
            if (p && getComputedStyle(p).display === 'inline') p = p.parentElement;
            anchorBlock = p;
          }

          if (anchorBlock) {
            const bioEl = anchorBlock.nextElementSibling;
            if (bioEl) {
              bio = bioEl.innerText.trim();
              bio = bio.replace(/^(?:\d+[º°] grau|•|·|\s)+/i, '');

              const locEl = bioEl.nextElementSibling;
              if (locEl) {
                location = locEl.innerText.trim();
              }
            }
          }

          // Fallback de segurança
          if (!bio || bio.length < 3) {
            const fullText = card.innerText;
            const nameC = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cleanText = fullText.replace(new RegExp(nameC, 'gi'), '');
            const textLines = cleanText.split('\n').filter(l => l.trim().length > 3);

            for (const line of textLines) {
              const l = line.toLowerCase();
              if (!l.includes('ligações') && !l.includes('seguidores') && !l.includes('conectar') && !l.includes('connect')) {
                bio = line.trim();
                break;
              }
            }
          }

          const img = card.querySelector('img[src*="licdn.com/dms/image"]');
          avatarUrl = img?.src || null;
        }

        // Limpeza Final da Bio
        bio = bio.replace(/(?:é uma conexão|conexão em comum|seguidores| • ).*/gi, '').trim();

        // Fallback para nome se vazio
        if (!fullName) {
          fullName = formatUsernameAsName(username) || username;
        }

        // Parse company (tentativa simples)
        let company = null;
        const headline = bio;

        const atMatch = bio.match(/(?:at|@|em|na)\s+(.+?)(?:\s*[|·•]|$)/i);
        if (atMatch) company = atMatch[1].trim();

        const lead = {
          username,
          fullName,
          profileUrl: cleanUrl,
          headline,
          bio,
          company,
          location,
          avatarUrl,
        };

        console.log(`[SOS 360] Lead Candidato: ${fullName} | Bio: ${bio} | Location: ${location}`);

        // Qualification Logic
        let isQualified = false;
        let reasons = [];

        // 1. Audience Matching
        if (state.selectedAudience) {
          if (matchesAudienceCriteria(lead, state.selectedAudience)) {
            isQualified = true;
          } else {
            reasons.push('Critérios da Audiência');
          }
        }
        // 2. Keyword Matching (Legado)
        else if (state.keywords && state.keywords.length > 0) {
          if (matchesKeywords(bio, state.keywords)) isQualified = true;
          else reasons.push('Keywords');
        }
        else {
          isQualified = true; // Sem filtros = Aceita tudo
        }

        if (isQualified) {
          if (!state.qualifiedLeads.has(username)) {
            state.qualifiedLeads.set(username, lead);
            // Visual Feedback
            card.style.border = '2px solid #10b981';

            if (!card.querySelector('.sos-badge')) {
              const badge = document.createElement('div');
              badge.className = 'sos-badge';
              badge.textContent = '✅ Qualificado';
              badge.style.cssText = 'position:absolute; top:10px; right:10px; background:#10b981; color:white; padding:4px 8px; border-radius:4px; font-size:12px; z-index:100;';
              card.style.position = 'relative';
              card.appendChild(badge);
            }
          }
        } else {
          // Unqualified - Optional Feedback
          console.log(`[SOS 360] Rejeitado: ${fullName} (${reasons.join(', ')})`);
        }

        card.dataset.sosProcessed = 'true';

      } catch (e) {
        console.error('[SOS 360] Erro ao processar card:', e);
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

  // --- Action Handlers ---
  function stopAutoScroll(userInitiated = false) {
    state.isAutoScrolling = false;
    updateUI();
    scanConnections(); // Último scan para garantir

    // Se o usuário clicou em Parar, cancela tudo
    if (userInitiated) {
      console.log('[SOS 360] Mineração cancelada pelo usuário.');
      clearState();
      updateDeepImportProgress(100, 100, `Mineração cancelada. ${state.qualifiedLeads.size} leads qualificados.`);
      setTimeout(() => {
        const container = document.getElementById('sos-progress-container');
        if (container) container.style.display = 'none';
      }, 3000);
      return;
    }

    // Lógica de Paginação em Massa (chamada automática ao fim da rolagem)
    if (state.isBulkScanning) {
      updateDeepImportProgress(100, 100, `Página concluída. Buscando próxima...`);
      const changedPage = goToNextPage();
      if (!changedPage) {
        alert('Mineração em Massa Concluída!\nImporte seus leads agora.');
        clearState(); // Limpa flag para não continuar
        state.isBulkScanning = false;
      }
      return;
    }

    // Reset standard UI if not bulk scanning
    updateDeepImportProgress(100, 100, `Mineração pausada. ${state.totalConnectionsFound} leads.`);
    setTimeout(() => {
      const container = document.getElementById('sos-progress-container');
      if (container) container.style.display = 'none';
    }, 3000);
  }

  // ... (funções intermediárias continuam iguais) ...

  // --- Initialization ---
  async function init() {
    // Tenta restaurar estado de paginação anterior
    const restored = await restoreState();

    const url = location.href;

    if (url.includes('/mynetwork/invite-connect/connections/') || url.includes('/search/results/people/')) {
      const poller = setInterval(() => {
        const cards = findConnectionCards();
        if (cards.length > 0) {
          clearInterval(poller);
          console.log(`[SOS 360] Found ${cards.length} connection cards, creating overlay`);
          createOverlay();
          scanConnections();

          // Se restaurou estado e estava minerando, retoma automaticamente
          if (restored && state.isBulkScanning) {
            console.log('[SOS 360] Retomando mineração em massa...');
            setTimeout(startAutoScroll, 2000); // Delay para carregar DOM
          }
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

  // --- Automation Actions ---

  async function performAutomation(request) {
    const { automationType, config, lead } = request;
    console.log(`[SOS 360] Performing Automation: ${automationType}`, config);

    try {
      if (automationType === 'connection_request') {
        await sendConnectionRequest(config?.message);
      } else if (automationType === 'send_message') {
        await sendDirectMessage(config?.message, lead);
      } else {
        throw new Error('Unknown automation type');
      }
      return { success: true };
    } catch (e) {
      console.error('[SOS 360] Automation Error:', e);
      return { success: false, error: e.message };
    }
  }

  async function sendConnectionRequest(note) {
    // 1. Find Connect Button
    const buttons = Array.from(document.querySelectorAll('button'));
    let connectBtn = buttons.find(b => b.textContent.trim() === 'Connect' || b.textContent.trim() === 'Conectar');

    // If hidden in "More" menu
    if (!connectBtn) {
      const moreBtn = document.querySelector('.artdeco-dropdown__trigger--placement-bottom'); // Simplified selector
      if (moreBtn) {
        moreBtn.click();
        await sleep(500);
        const dropdownItems = Array.from(document.querySelectorAll('.artdeco-dropdown__content span'));
        const connectItem = dropdownItems.find(s => s.textContent.trim() === 'Connect' || s.textContent.trim() === 'Conectar');
        if (connectItem) connectItem.click();
      }
    }

    if (!document.querySelector('.artdeco-modal')) {
      if (connectBtn) connectBtn.click();
    }

    await sleep(1000);

    // 2. Handle Modal - ALWAYS SEND WITHOUT NOTE
    // We explicitly ignore the 'note' parameter now.

    // 3. Send
    // LinkedIn often has "Send without a note" or just "Send" if we didn't add a note.
    const sendBtn = document.querySelector('button[aria-label="Send now"], button[aria-label="Enviar agora"], button[aria-label="Send without a note"], button[aria-label="Enviar sem nota"]');

    if (sendBtn) {
      sendBtn.click();
      console.log('[SOS 360] Connection request sent (without note).');
    } else {
      console.log('[SOS 360] "Send now" button not found. Modal might be different.');
    }
  }

  async function sendDirectMessage(template, lead) {
    // 1. Find Message Button
    const msgBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Message' || b.textContent.trim() === 'Enviar mensagem');
    if (!msgBtn) throw new Error('Message button not found (might not be connected)');

    msgBtn.click();
    await sleep(2000);

    // 2. Type Message
    // Find active chat input
    const editor = document.querySelector('.msg-form__contenteditable');
    if (!editor) throw new Error('Chat editor not found');

    // Replace variables
    let message = template || '';
    message = message.replace('{{firstName}}', lead.fullName?.split(' ')[0] || '');
    message = message.replace('{{fullName}}', lead.fullName || '');
    message = message.replace('{{company}}', lead.company || '');

    // Simulate typing
    editor.innerHTML = `<p>${message}</p>`; // Basic injection
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    await sleep(1000);

    // 3. Send
    const sendBtn = document.querySelector('.msg-form__send-button');
    if (sendBtn && !sendBtn.disabled) {
      // sendBtn.click(); // UNCOMMENT TO ACTUALLY SEND
      console.log('[SOS 360 - Simulation] Would have sent message:', message);
    }
  }


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
      } else if (request.action === 'performAutomation') {
        performAutomation(request).then(sendResponse);
        return true;
      }
      // --- Automation Overlay Handlers ---
      else if (request.action === 'SHOW_OVERLAY') {
        showAutomationOverlay(request.state);
        sendResponse({ success: true });
      }
      else if (request.action === 'START_WAIT') {
        startWaitCountdown(request.duration);
        sendResponse({ success: true });
      }
      else if (request.action === 'HIDE_OVERLAY') {
        hideAutomationOverlay();
        sendResponse({ success: true });
      }
      // --- Enrichment Handler ---
      else if (request.action === 'performEnrichment') {
        try {
          console.log('[SOS 360] Received performEnrichment request');
          const profile = extractCurrentProfile();
          if (!profile) {
            sendResponse({ success: false, error: 'Could not extract profile' });
            return;
          }

          const enrichment = await performFullEnrichment();
          sendResponse({
            success: true,
            data: {
              profile,
              enrichment
            }
          });
        } catch (e) {
          console.error('[SOS 360] Enrichment error:', e);
          sendResponse({ success: false, error: e.message });
        }
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

  // --- AUTOMATION OVERLAY ---
  const AUTOMATION_OVERLAY_ID = 'sos360-automation-overlay';
  let automationLogs = [];
  let countdownInterval = null;

  function createAutomationOverlay() {
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

    // Event Listeners
    document.getElementById('sos-auto-minimize').addEventListener('click', () => {
      overlay.classList.toggle('minimized');
    });

    document.getElementById('sos-auto-stop-btn').addEventListener('click', async () => {
      const stopBtn = document.getElementById('sos-auto-stop-btn');
      stopBtn.disabled = true;
      stopBtn.textContent = '⏳ Stopping...';
      stopBtn.style.opacity = '0.6';

      // Update overlay status
      const statusEl = document.getElementById('sos-auto-status');
      if (statusEl) statusEl.textContent = 'Cancelling automation...';

      addLog('Stop requested by user', 'info');

      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          throw new Error('Extension context lost');
        }

        chrome.runtime.sendMessage({ action: 'STOP_AUTOMATION' }, (response) => {
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            console.error('[SOS 360] Stop error:', chrome.runtime.lastError.message);
            addLog('Extension disconnected - closing overlay', 'warning');
            hideAutomationOverlay();
            return;
          }

          console.log('[SOS 360] Stop response:', response);
          addLog('Automation stopped successfully', 'success');

          // Hide overlay after a short delay
          setTimeout(() => {
            hideAutomationOverlay();
          }, 1500);
        });
      } catch (error) {
        console.error('[SOS 360] Failed to send stop message:', error);
        addLog('Extension context lost - hiding overlay', 'error');
        // Just hide the overlay since we can't communicate with background
        setTimeout(() => {
          hideAutomationOverlay();
        }, 1000);
      }
    });

    document.getElementById('sos-auto-logs-btn').addEventListener('click', () => {
      document.getElementById('sos-auto-logs-panel').style.display = 'flex';
      renderLogs();
    });

    document.getElementById('sos-auto-logs-close').addEventListener('click', () => {
      document.getElementById('sos-auto-logs-panel').style.display = 'none';
    });
  }

  function showAutomationOverlay(state) {
    createAutomationOverlay();

    const overlay = document.getElementById(AUTOMATION_OVERLAY_ID);
    if (!overlay) return;

    overlay.style.display = 'block';
    overlay.classList.remove('minimized');

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
      addLog(`Processing: ${lead.name}`, 'info');
    }
  }

  function hideAutomationOverlay() {
    const overlay = document.getElementById(AUTOMATION_OVERLAY_ID);
    if (overlay) {
      overlay.style.display = 'none';
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function startWaitCountdown(durationSeconds) {
    const leadContainer = document.getElementById('sos-auto-current-lead');
    if (!leadContainer) return;

    // Clear existing countdown
    if (countdownInterval) {
      clearInterval(countdownInterval);
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
        clearInterval(countdownInterval);
        countdownInterval = null;
        if (countdownEl) countdownEl.remove();

        // Signal to continue with error handling
        try {
          if (!chrome.runtime?.id) {
            console.error('[SOS 360] Extension context lost during countdown');
            hideAutomationOverlay();
            return;
          }

          chrome.runtime.sendMessage({ action: 'NEXT_STEP' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[SOS 360] NEXT_STEP error:', chrome.runtime.lastError.message);
              addLog('Extension disconnected', 'error');
              hideAutomationOverlay();
            }
          });
        } catch (error) {
          console.error('[SOS 360] Failed to send NEXT_STEP:', error);
          hideAutomationOverlay();
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

    addLog(`Waiting ${durationSeconds}s before next action`, 'info');
  }

  function addLog(message, type = 'info') {
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
      renderLogs();
    }
  }

  function renderLogs() {
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

  console.log('[SOS 360] LinkedIn Script v3 Loaded');
})();
