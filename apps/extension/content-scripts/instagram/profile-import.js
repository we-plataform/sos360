// Instagram content script - Profile Import Module
// Lia 360
// Handles profile extraction, stats, and enrichment

(function () {
  'use strict';

  const utils = window.LiaInstagramUtils;
  if (!utils) {
    console.error('[Lia 360 Profile] Utils not loaded');
    return;
  }

  // Constants
  const SELECTORS = {
    profileHeader: 'header',
    profileUsername: 'header h2, header section > div > div > span',
    profileFullName: 'header section span[dir="auto"]',
    profileBio: 'header section > div > span, header section h1',
    profileStats: 'header section ul li',
    profileAvatar: 'header img[alt*="profile"], header canvas + img',
    followersButton: 'a[href$="/followers/"], a[href*="/followers"]',
    followingButton: 'a[href$="/following/"], a[href*="/following"]',
    websiteLink: 'header a[href*="l.instagram.com"]',
  };

  /**
   * Extract profile stats using multiple fallback strategies
   */
  function extractProfileStats() {
    console.log('[Lia 360 Profile] Starting stats extraction...');

    const stats = {
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      method: 'none'
    };

    const getCount = (el) => {
      if (!el) return 0;

      const digitSpans = Array.from(el.querySelectorAll('span')).filter(span => {
        const text = span.textContent?.trim();
        return text && /^\d[\d,.kKmMbB+]*$/.test(text);
      });
      if (digitSpans.length > 0) {
        const count = utils.parseCount(digitSpans[0].textContent);
        if (count > 0) return count;
      }

      const aria = el.getAttribute('aria-label') || el.getAttribute('title');
      if (aria) {
        const count = utils.parseCount(aria);
        if (count > 0) return count;
      }

      return utils.parseCount(el.textContent);
    };

    const getStatType = (el) => {
      const text = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      if (text.includes('post') || text.includes('publicação')) return 'posts';
      if (text.includes('follower') || text.includes('seguidor')) return 'followers';
      if (text.includes('following') || text.includes('seguindo')) return 'following';
      return null;
    };

    // Strategy A: Path-based stat links
    console.log('[Lia 360 Profile] Strategy A: Path-based stat links...');
    const statLinks = Array.from(document.querySelectorAll('a[href*="/followers/"], a[href*="/following/"]'));
    for (const link of statLinks) {
      const type = getStatType(link);
      const count = getCount(link);
      if (type && count > 0) {
        stats[type + 'Count'] = count;
      }
    }

    if (stats.postsCount === 0) {
      const postItems = document.querySelectorAll('header section ul li');
      if (postItems.length >= 3) {
        const firstItemText = postItems[0]?.textContent?.toLowerCase() || '';
        if (firstItemText.includes('post') || firstItemText.includes('publicação')) {
          stats.postsCount = getCount(postItems[0]);
        }
      }
    }

    if (stats.followersCount > 0 || stats.followingCount > 0) {
      stats.method = 'path-links';
      console.log('[Lia 360 Profile] ✓ Strategy A succeeded:', stats);
      return stats;
    }

    // Strategy B: Aria-label based
    console.log('[Lia 360 Profile] Strategy B: Aria-label stats...');
    const ariaStats = Array.from(document.querySelectorAll(
      'a[aria-label*="follower"], a[aria-label*="following"], button[aria-label*="post"]'
    ));
    for (const el of ariaStats) {
      const type = getStatType(el);
      const count = getCount(el);
      if (type && count > 0) {
        stats[type + 'Count'] = count;
      }
    }
    if (stats.followersCount > 0 || stats.followingCount > 0) {
      stats.method = 'aria-label';
      console.log('[Lia 360 Profile] ✓ Strategy B succeeded:', stats);
      return stats;
    }

    // Strategy C: Data attributes
    console.log('[Lia 360 Profile] Strategy C: Data attribute stats...');
    const dataStats = document.querySelectorAll('[data-testid*="follower"], [data-testid*="following"], [data-testid*="post"]');
    for (const el of dataStats) {
      const type = getStatType(el);
      const count = getCount(el);
      if (type && count > 0) {
        stats[type + 'Count'] = count;
      }
    }
    if (stats.followersCount > 0 || stats.followingCount > 0) {
      stats.method = 'data-attr';
      console.log('[Lia 360 Profile] ✓ Strategy C succeeded:', stats);
      return stats;
    }

    // Strategy D: Legacy UL > LI
    console.log('[Lia 360 Profile] Strategy D: Legacy UL > LI...');
    const statItems = document.querySelectorAll('header section ul li');
    if (statItems.length >= 3) {
      stats.postsCount = getCount(statItems[0]);
      stats.followersCount = getCount(statItems[1]);
      stats.followingCount = getCount(statItems[2]);
      stats.method = 'legacy-ul';
      console.log('[Lia 360 Profile] ✓ Strategy D succeeded:', stats);
      return stats;
    }

    // Strategy E: Generic header elements
    console.log('[Lia 360 Profile] Strategy E: Generic header extraction...');
    const allHeaderEls = Array.from(document.querySelectorAll('header a, header button, header [role="button"]'))
      .filter(el => /\d+/.test(el.textContent));

    for (const el of allHeaderEls) {
      const type = getStatType(el);
      const count = getCount(el);
      if (type && count > 0 && stats[type + 'Count'] === 0) {
        stats[type + 'Count'] = count;
      }
    }
    if (stats.followersCount > 0 || stats.followingCount > 0) {
      stats.method = 'generic-header';
      console.log('[Lia 360 Profile] ✓ Strategy E succeeded:', stats);
      return stats;
    }

    console.warn('[Lia 360 Profile] ✗ All strategies failed');
    return stats;
  }

  /**
   * Extract current profile data
   */
  function extractCurrentProfile() {
    const username = utils.getCurrentProfileUsername();
    if (!username) return null;

    // Get avatar
    let avatarUrl = null;
    const avatarImg = document.querySelector('header img[alt*="profile"], header img');
    if (avatarImg && avatarImg.src && !avatarImg.src.includes('44x44')) {
      avatarUrl = avatarImg.src;
    }

    // Get full name
    let fullName = null;
    const nameEl = document.querySelector('header section span[dir="auto"]');
    if (nameEl) {
      fullName = nameEl.textContent?.trim();
    }

    // Get bio
    let bio = null;
    const bioContainer = document.querySelector('header section > div > span');
    if (bioContainer) {
      bio = bioContainer.textContent?.trim();
    }

    // Get verification status
    let verified = false;
    const verifiedBadge = document.querySelector('header section svg[aria-label="Verified"], header img[src*="verified"]');
    if (verifiedBadge) {
      verified = true;
    }

    // Extract stats
    const statsData = extractProfileStats();
    const { postsCount, followersCount, followingCount } = statsData;

    // Try to extract website
    let website = null;
    const websiteLink = document.querySelector('header a[href*="l.instagram.com"]');
    if (websiteLink) {
      website = websiteLink.textContent?.trim();
    }

    // Try to extract email from bio
    let email = null;
    if (bio) {
      const emailMatch = bio.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        email = emailMatch[0];
      }
    }

    const profileData = {
      username,
      profileUrl: `https://instagram.com/${username}`,
      fullName: fullName || username,
      bio,
      avatarUrl,
      website,
      email,
      followersCount,
      followingCount,
      postsCount,
      platform: 'instagram',
      verified: verified,
    };

    console.log('[Lia 360 Profile] Profile extracted:', {
      username: profileData.username,
      followersCount: profileData.followersCount,
      method: statsData.method
    });

    return profileData;
  }

  /**
   * Wait for Instagram profile page to fully load
   */
  async function waitForInstagramProfile() {
    const maxWait = 15000;
    const startTime = Date.now();

    console.log('[Lia 360 Profile] Waiting for Instagram profile to load...');

    while (Date.now() - startTime < maxWait) {
      if (!window.location.href.includes('instagram.com')) {
        await utils.sleep(100);
        continue;
      }

      const checks = [
        () => document.querySelector('header'),
        () => document.querySelector('main') || document.querySelector('[role="main"]'),
        () => document.querySelector('header img'),
        () => document.querySelector('h2') || document.querySelector('h1') || document.querySelector('[role="heading"]'),
        () => {
          const statSelectors = [
            'a[href*="/followers/"]',
            'a[href*="/following/"]',
            'a[aria-label*="follower"]',
            '[data-testid*="follower"]',
            'header section ul li',
          ];
          for (const selector of statSelectors) {
            if (document.querySelector(selector)) return true;
          }
          return false;
        },
      ];

      const passedChecks = checks.filter(check => check());
      if (passedChecks.length >= 2) {
        console.log('[Lia 360 Profile] Profile page loaded');
        return;
      }

      await utils.sleep(100);
    }

    console.warn('[Lia 360 Profile] Profile page load timeout');
    throw new Error('Profile page failed to load within timeout');
  }

  /**
   * Create enrichment progress overlay
   */
  function createEnrichmentOverlay() {
    const existing = document.getElementById('sos-enrichment-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sos-enrichment-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span style="font-weight: 600;">Lia 360</span>
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        Enriquecendo perfil...
      </div>
    `;

    document.body.appendChild(overlay);
  }

  // Expose public API
  window.LiaInstagramProfile = {
    extractCurrentProfile,
    extractProfileStats,
    waitForInstagramProfile,
    createEnrichmentOverlay,
  };

  console.log('[Lia 360 Profile] Profile import module loaded');
})();
