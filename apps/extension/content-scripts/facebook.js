// Facebook content script

(function() {
  'use strict';

  const SELECTORS = {
    // Group members
    membersList: '[data-pagelet="GroupMembers"]',
    memberCard: 'div[role="listitem"]',
    memberName: 'a[role="link"] span',
    memberLink: 'a[role="link"]',
    memberAvatar: 'img[data-imgperflogname]',
    
    // Page likes
    likesList: '[data-pagelet="ProfileAppSection_0"]',
    
    // Profile
    profileName: 'h1',
    profileBio: '[data-pagelet="ProfileTilesFeed_0"]',
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  // Extract from group members page
  async function extractGroupMembers() {
    const leads = [];
    const memberCards = document.querySelectorAll(SELECTORS.memberCard);
    
    for (const card of memberCards) {
      try {
        const nameEl = card.querySelector(SELECTORS.memberName);
        const linkEl = card.querySelector(SELECTORS.memberLink);
        const avatarEl = card.querySelector(SELECTORS.memberAvatar);
        
        if (!linkEl) continue;
        
        const profileUrl = linkEl.href;
        const username = profileUrl?.split('/').filter(Boolean).pop() || null;
        
        if (!username) continue;
        
        const lead = {
          username,
          fullName: getTextContent(nameEl),
          profileUrl,
          avatarUrl: avatarEl?.src || null,
        };
        
        if (!leads.some(l => l.profileUrl === lead.profileUrl)) {
          leads.push(lead);
        }
      } catch (e) {
        console.error('Error extracting member:', e);
      }
    }
    
    return leads;
  }

  // Extract current profile
  function extractCurrentProfile() {
    const url = window.location.href;
    
    // Skip non-profile pages
    if (url.includes('/groups/') || url.includes('/events/') || url.includes('/marketplace/')) {
      return null;
    }
    
    const nameEl = document.querySelector(SELECTORS.profileName);
    
    if (!nameEl) return null;
    
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const username = pathParts[0] || null;
    
    if (!username || ['profile.php', 'watch', 'gaming', 'marketplace'].includes(username)) {
      return null;
    }
    
    return {
      username,
      fullName: getTextContent(nameEl),
      profileUrl: `https://facebook.com/${username}`,
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
            
            // Check if we're on a group members page
            if (window.location.href.includes('/groups/') && window.location.href.includes('/members')) {
              await scrollPage(3);
              leads = await extractGroupMembers();
            } else {
              // Extract current profile
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
        console.error('Facebook content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  });

  console.log('SOS 360 Facebook content script loaded');
})();
