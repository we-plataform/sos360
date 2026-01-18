// Instagram content script

(function () {
  'use strict';

  // Rate limiting
  const RATE_LIMIT = {
    maxRequests: 100,
    windowMs: 3600000, // 1 hour
  };

  // Selectors (may need updates as Instagram changes)
  const SELECTORS = {
    // Followers/Following dialog
    dialogList: 'div[role="dialog"] ul',
    dialogItem: 'div[role="dialog"] ul li',
    username: 'a span',
    profileLink: 'a[href^="/"]',
    avatar: 'img',

    // Profile page
    profileUsername: 'header section h2',
    profileFullName: 'header section span',
    profileBio: 'header section > div:last-child',
    followersCount: 'header section ul li:nth-child(2) span',
    followingCount: 'header section ul li:nth-child(3) span',
    postsCount: 'header section ul li:nth-child(1) span',

    // Post likers
    likersDialog: 'div[role="dialog"]',
    likerItem: 'div[role="dialog"] div[style*="flex-direction: column"] > div',

    // Feed / Explore
    postLink: 'a[href^="/p/"]',

    // Post Detail
    postAuthor: 'div > span > a[href*="/"]', // Rough approximation, needs robustness
  };

  // Helper functions
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function parseCount(text) {
    if (!text) return 0;
    const clean = text.toLowerCase().replace(/,/g, '');
    if (clean.includes('k')) return parseFloat(clean) * 1000;
    if (clean.includes('m')) return parseFloat(clean) * 1000000;
    return parseInt(clean, 10) || 0;
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  // Extract leads from followers/following dialog
  async function extractFromDialog() {
    const leads = [];
    const items = document.querySelectorAll(SELECTORS.dialogItem);

    for (const item of items) {
      try {
        const link = item.querySelector('a[href^="/"]');
        const img = item.querySelector('img');
        const spans = item.querySelectorAll('span');

        if (!link) continue;

        const username = link.getAttribute('href')?.replace(/\//g, '') || null;
        if (!username) continue;

        const lead = {
          username,
          profileUrl: `https://instagram.com/${username}`,
          avatarUrl: img?.src || null,
          fullName: spans[0]?.textContent?.trim() || null,
        };

        // Check for duplicates
        if (!leads.some(l => l.username === lead.username)) {
          leads.push(lead);
        }
      } catch (e) {
        console.error('Error extracting lead:', e);
      }
    }

    return leads;
  }

  // Extract profile from current page
  function extractCurrentProfile() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;

    const username = pathParts[0];
    if (['explore', 'reels', 'direct', 'stories', 'p', 'tv'].includes(username)) {
      return null;
    }

    // Try to get more info from the page
    const fullNameEl = document.querySelector('header section span');
    const bioEl = document.querySelector('header section > div:last-child');
    const avatarEl = document.querySelector('header img');

    // Get counts
    const statsList = document.querySelector('header section ul');
    let followersCount = 0;
    let followingCount = 0;
    let postsCount = 0;

    if (statsList) {
      const stats = statsList.querySelectorAll('li span');
      if (stats.length >= 3) {
        postsCount = parseCount(stats[0]?.textContent);
        followersCount = parseCount(stats[1]?.textContent);
        followingCount = parseCount(stats[2]?.textContent);
      }
    }

    return {
      username,
      profileUrl: `https://instagram.com/${username}`,
      fullName: getTextContent(fullNameEl),
      bio: getTextContent(bioEl),
      avatarUrl: avatarEl?.src || null,
      followersCount,
      followingCount,
      postsCount,
    };
  }

  // Extract Author from Post page
  function extractAuthorFromPost() {
    // Usually the top left of the post OR the right side bar on desktop
    // Header > div > div > div > a
    const authorHeader = document.querySelector('header');
    if (authorHeader) {
      const links = authorHeader.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href !== '/' && !href.includes('/explore/') && !href.includes('/p/')) {
          const username = href.replace(/\//g, '');
          // We can return a basic partial profile to be filled later or just the user data
          return extractCurrentProfile() || {
            username,
            profileUrl: `https://instagram.com/${username}`,
          };
        }
      }
    }

    // Fallback: look for the first bold link in the comment section (usually the author description)
    const captionLink = document.querySelector('li div div div h2 a'); // Very fragile selector
    if (captionLink) {
      const username = captionLink.textContent;
      return {
        username,
        profileUrl: `https://instagram.com/${username}`,
      };
    }

    return extractCurrentProfile(); // Might work if on profile page or mixed context
  }

  // Scroll dialog to load more
  async function scrollDialog(maxScrolls = 10) {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return;

    const scrollContainer = dialog.querySelector('ul')?.parentElement;
    if (!scrollContainer) return;

    let lastHeight = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      await sleep(1500 + Math.random() * 1000); // Random delay

      const newHeight = scrollContainer.scrollHeight;
      if (newHeight === lastHeight) break;

      lastHeight = newHeight;
      scrollCount++;
    }
  }

  // Scroll Main Window
  async function scrollWindow(maxScrolls = 3) {
    let count = 0;
    while (count < maxScrolls) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(2000 + Math.random() * 1000);
      count++;
    }
  }

  // Get post links from Explore/Tag page
  function getPostLinks(limit = 20) {
    const links = Array.from(document.querySelectorAll(SELECTORS.postLink))
      .map(a => a.href)
      .filter(href => href.includes('/p/'));

    return [...new Set(links)].slice(0, limit);
  }

  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        if (request.action === 'scrollWindow') {
          window.scrollBy(0, 500);
          sendResponse({ success: true });
        } else if (request.action === 'getPostLinks') {
          await scrollWindow(3); // Scroll a bit to load
          const links = getPostLinks(request.limit);
          sendResponse({ success: true, data: links });
        } else if (request.action === 'extractAuthorFromPost') {
          const author = extractAuthorFromPost();
          sendResponse({ success: !!author, data: author });
        } else if (request.action === 'performSearch') {
          // Orchestrate the search content script side
          const opened = await openSearch();
          if (!opened) {
            // Maybe we are already on search page?
          }

          const typed = await typeSearch(request.keyword);
          if (!typed) {
            sendResponse({ success: false, error: 'Input not found' });
            return;
          }

          const results = await getSearchResults();
          sendResponse({ success: true, data: results });
        } else if (request.action === 'extractLeads') {
          let leads = [];
          // Check if we're in a dialog (followers/following/likers)
          const dialog = document.querySelector('div[role="dialog"]');
          if (dialog) {
            // Scroll to load more
            await scrollDialog(5);
            leads = await extractFromDialog();
          } else {
            // Extract current profile
            const profile = extractCurrentProfile();
            if (profile) {
              leads = [profile];
            }
          }
          sendResponse({ success: true, data: leads });
        } else if (request.action === 'extractProfile') {
          const profile = extractCurrentProfile();
          sendResponse({ success: !!profile, data: profile });
        } else {
          sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Instagram content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  });

  console.log('SOS 360 Instagram content script loaded');
})();
