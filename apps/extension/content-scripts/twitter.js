// X/Twitter content script

(function() {
  'use strict';

  const SELECTORS = {
    // Profile page elements (X/Twitter uses data-testid attributes)
    profileName: '[data-testid="UserName"]',
    profileDisplayName: '[data-testid="UserName"] > div > div > div > div > span > span',
    profileUsername: '[data-testid="UserName"] > div > div:nth-child(2) > div > span',
    profileBio: '[data-testid="UserDescription"]',
    profileLocation: '[data-testid="UserLocation"]',
    profileWebsite: '[data-testid="UserUrl"]',
    profileAvatar: 'div[data-testid="UserAvatar-Container-unknown"] img',

    // Follower/following counts
    followingCount: 'a[href$="/following"] span[class*="css-"]',
    followersCount: 'a[href$="/verified_followers"] span[class*="css-"]',

    // Alternative selectors for follower counts
    followingLink: 'a[href$="/following"]',
    followersLink: 'a[href$="/verified_followers"]',
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  function parseCount(countStr) {
    if (!countStr) return null;

    // Remove commas and handle K/M suffixes
    countStr = countStr.toLowerCase().trim();

    if (countStr.includes('k')) {
      return Math.floor(parseFloat(countStr) * 1000);
    } else if (countStr.includes('m')) {
      return Math.floor(parseFloat(countStr) * 1000000);
    } else {
      return parseInt(countStr.replace(/,/g, ''), 10) || null;
    }
  }

  function extractUsernameFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/').filter(Boolean);

      // Skip status/photo/etc URLs
      if (parts.length > 1 && ['status', 'photo', 'with_replies', 'media', 'likes'].includes(parts[1])) {
        return parts[0];
      }

      return parts[0] || null;
    } catch (e) {
      return null;
    }
  }

  // Extract current profile
  function extractCurrentProfile() {
    const url = window.location.href;

    // Only process profile pages (not home, explore, notifications, etc.)
    if (!url.match(/^https?:\/\/(twitter\.com|x\.com)\/[^\/]+\/?$/)) {
      // Check if it's a profile page with tab (like /with_replies)
      if (!url.match(/^https?:\/\/(twitter\.com|x\.com)\/[^\/]+\/(with_replies|media|likes)\/?$/)) {
        return null;
      }
    }

    // Skip non-profile pages
    const skipPaths = ['/home', '/explore', '/notifications', '/messages', '/i/', '/search', '/settings', '/compose'];
    if (skipPaths.some(path => url.includes(path))) {
      return null;
    }

    const username = extractUsernameFromUrl(url);
    if (!username) return null;

    // Wait a bit for profile to load
    const profileNameEl = document.querySelector(SELECTORS.profileName);
    if (!profileNameEl) return null;

    // Extract display name
    const displayNameEl = document.querySelector(SELECTORS.profileDisplayName);
    const fullName = getTextContent(displayNameEl);

    // Extract bio
    const bioEl = document.querySelector(SELECTORS.profileBio);
    const bio = getTextContent(bioEl);

    // Extract location
    const locationEl = document.querySelector(SELECTORS.profileLocation);
    const location = getTextContent(locationEl);

    // Extract website
    const websiteEl = document.querySelector(SELECTORS.profileWebsite);
    const website = websiteEl?.querySelector('a')?.href || null;

    // Extract avatar
    const avatarEl = document.querySelector(SELECTORS.profileAvatar);
    const avatarUrl = avatarEl?.src || null;

    // Extract follower/following counts
    let followersCount = null;
    let followingCount = null;

    try {
      const followersLink = document.querySelector(SELECTORS.followersLink);
      const followingLink = document.querySelector(SELECTORS.followingLink);

      if (followersLink) {
        const followersText = getTextContent(followersLink);
        const match = followersText?.match(/([\d,.]+[KMB]?)\s*Followers?/i);
        if (match) {
          followersCount = parseCount(match[1]);
        }
      }

      if (followingLink) {
        const followingText = getTextContent(followingLink);
        const match = followingText?.match(/([\d,.]+[KMB]?)\s*Following/i);
        if (match) {
          followingCount = parseCount(match[1]);
        }
      }
    } catch (e) {
      console.error('Error extracting counts:', e);
    }

    // Normalize URL to twitter.com format
    const profileUrl = `https://twitter.com/${username}`;

    return {
      platform: 'twitter',
      username,
      fullName,
      profileUrl,
      avatarUrl,
      bio,
      location,
      website,
      followersCount,
      followingCount,
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
            // For Twitter, we primarily extract the current profile
            const profile = extractCurrentProfile();
            const leads = profile ? [profile] : [];

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
        console.error('X/Twitter content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  });

  console.log('Lia 360 X/Twitter content script loaded');
})();
