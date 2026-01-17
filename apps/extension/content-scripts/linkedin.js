// LinkedIn content script

(function() {
  'use strict';

  const SELECTORS = {
    // Search results / connections
    searchResultCard: '.entity-result__item',
    personName: '.entity-result__title-text a span[aria-hidden="true"]',
    personLink: '.entity-result__title-text a',
    personHeadline: '.entity-result__primary-subtitle',
    personAvatar: '.entity-result__image img',
    
    // Profile page
    profileName: 'h1.text-heading-xlarge',
    profileHeadline: '.text-body-medium',
    profileLocation: '.text-body-small',
    profileAbout: '#about ~ .display-flex span[aria-hidden="true"]',
    profileAvatar: '.pv-top-card-profile-picture__image',
    connectionsCount: '.pv-top-card--list li:last-child span',
    
    // Connections page
    connectionCard: '.mn-connection-card',
    connectionName: '.mn-connection-card__name',
    connectionLink: '.mn-connection-card__link',
    connectionOccupation: '.mn-connection-card__occupation',
    connectionAvatar: '.mn-connection-card__picture img',
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  function parseLinkedInUrl(url) {
    if (!url) return null;
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? match[1] : null;
  }

  // Extract from search results
  async function extractSearchResults() {
    const leads = [];
    const cards = document.querySelectorAll(SELECTORS.searchResultCard);
    
    for (const card of cards) {
      try {
        const nameEl = card.querySelector(SELECTORS.personName);
        const linkEl = card.querySelector(SELECTORS.personLink);
        const headlineEl = card.querySelector(SELECTORS.personHeadline);
        const avatarEl = card.querySelector(SELECTORS.personAvatar);
        
        if (!linkEl) continue;
        
        const profileUrl = linkEl.href?.split('?')[0];
        const username = parseLinkedInUrl(profileUrl);
        
        if (!username) continue;
        
        const lead = {
          username,
          fullName: getTextContent(nameEl),
          profileUrl,
          bio: getTextContent(headlineEl),
          avatarUrl: avatarEl?.src || null,
        };
        
        if (!leads.some(l => l.username === lead.username)) {
          leads.push(lead);
        }
      } catch (e) {
        console.error('Error extracting search result:', e);
      }
    }
    
    return leads;
  }

  // Extract from connections page
  async function extractConnections() {
    const leads = [];
    const cards = document.querySelectorAll(SELECTORS.connectionCard);
    
    for (const card of cards) {
      try {
        const nameEl = card.querySelector(SELECTORS.connectionName);
        const linkEl = card.querySelector(SELECTORS.connectionLink);
        const occupationEl = card.querySelector(SELECTORS.connectionOccupation);
        const avatarEl = card.querySelector(SELECTORS.connectionAvatar);
        
        if (!linkEl) continue;
        
        const profileUrl = linkEl.href?.split('?')[0];
        const username = parseLinkedInUrl(profileUrl);
        
        if (!username) continue;
        
        const lead = {
          username,
          fullName: getTextContent(nameEl),
          profileUrl,
          bio: getTextContent(occupationEl),
          avatarUrl: avatarEl?.src || null,
        };
        
        if (!leads.some(l => l.username === lead.username)) {
          leads.push(lead);
        }
      } catch (e) {
        console.error('Error extracting connection:', e);
      }
    }
    
    return leads;
  }

  // Extract current profile
  function extractCurrentProfile() {
    const url = window.location.href;
    
    // Only extract from profile pages
    if (!url.includes('/in/')) return null;
    
    const username = parseLinkedInUrl(url);
    if (!username) return null;
    
    const nameEl = document.querySelector(SELECTORS.profileName);
    const headlineEl = document.querySelector(SELECTORS.profileHeadline);
    const locationEl = document.querySelector(SELECTORS.profileLocation);
    const aboutEl = document.querySelector(SELECTORS.profileAbout);
    const avatarEl = document.querySelector(SELECTORS.profileAvatar);
    const connectionsEl = document.querySelector(SELECTORS.connectionsCount);
    
    return {
      username,
      fullName: getTextContent(nameEl),
      profileUrl: `https://linkedin.com/in/${username}`,
      bio: getTextContent(headlineEl),
      location: getTextContent(locationEl),
      avatarUrl: avatarEl?.src || null,
      followersCount: parseInt(getTextContent(connectionsEl)?.replace(/\D/g, ''), 10) || 0,
    };
  }

  // Scroll page to load more
  async function scrollPage(maxScrolls = 5) {
    let lastHeight = 0;
    let scrollCount = 0;
    
    while (scrollCount < maxScrolls) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(2000 + Math.random() * 1000);
      
      const newHeight = document.body.scrollHeight;
      if (newHeight === lastHeight) break;
      
      lastHeight = newHeight;
      scrollCount++;
    }
  }

  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        switch (request.action) {
          case 'extractLeads': {
            let leads = [];
            const url = window.location.href;
            
            if (url.includes('/search/results/')) {
              // Search results page
              await scrollPage(3);
              leads = await extractSearchResults();
            } else if (url.includes('/mynetwork/invite-connect/connections/')) {
              // Connections page
              await scrollPage(3);
              leads = await extractConnections();
            } else if (url.includes('/in/')) {
              // Profile page
              const profile = extractCurrentProfile();
              if (profile) {
                leads = [profile];
              }
            }
            
            sendResponse({ success: true, data: leads });
            break;
          }
          
          case 'extractProfile': {
            const profile = extractCurrentProfile();
            sendResponse({ success: !!profile, data: profile });
            break;
          }
          
          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('LinkedIn content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  });

  console.log('SOS 360 LinkedIn content script loaded');
})();
