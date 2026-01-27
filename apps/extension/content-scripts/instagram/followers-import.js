// Instagram content script - Followers Import Module
// Lia 360
// Handles followers/following dialog detection and user extraction

(function () {
  'use strict';

  const utils = window.LiaInstagramUtils;
  if (!utils) {
    console.error('[Lia 360 Followers] Utils not loaded');
    return;
  }

  // Constants
  const SELECTORS = {
    dialogList: 'div[role="dialog"] div[style*="flex-direction: column"] > div',
    dialogContainer: 'div[role="dialog"]',
    dialogScrollable: 'div[role="dialog"] div[style*="overflow"]',
    userItem: 'div[role="dialog"] a[href^="/"]',
    followersButton: 'a[href$="/followers/"], a[href*="/followers"]',
    followingButton: 'a[href$="/following/"], a[href*="/following"]',
  };

  const FOLLOWERS_UI_ID = 'sos360-followers-overlay';
  let dialogObserver = null;

  /**
   * Detect the type of dialog that was opened
   */
  function detectDialogType(dialog) {
    const url = window.location.href;
    const isFollowersDialog = url.includes('/followers');
    const isFollowingDialog = url.includes('/following');

    const hasUserList = dialog.querySelectorAll('a[href^="/"][role="link"]').length > 3 ||
      dialog.querySelectorAll('a[href^="/"]').length > 5;

    if ((isFollowersDialog || isFollowingDialog) && hasUserList) {
      const state = window.LiaInstagramState;
      if (state) {
        state.dialogType = isFollowersDialog ? 'followers' : 'following';
        state.dialogDetected = true;

        console.log(`[Lia 360 Followers] Detected ${state.dialogType} dialog`);

        if (window.LiaInstagramUI && window.LiaInstagramUI.createFollowersOverlay) {
          setTimeout(() => window.LiaInstagramUI.createFollowersOverlay(), 500);
        }
      }
    }
  }

  /**
   * Handle dialog close
   */
  function onDialogClosed() {
    console.log('[Lia 360 Followers] Dialog closed');
    const state = window.LiaInstagramState;
    if (state) {
      state.dialogDetected = false;
      state.dialogType = null;
    }
    if (window.LiaInstagramUI && window.LiaInstagramUI.removeFollowersOverlay) {
      window.LiaInstagramUI.removeFollowersOverlay();
    }
  }

  /**
   * Create the dialog observer for auto-detection
   */
  function startDialogObserver() {
    if (dialogObserver) return;

    console.log('[Lia 360 Followers] Starting dialog observer');

    dialogObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          const dialog = document.querySelector('div[role="dialog"]');
          const state = window.LiaInstagramState;
          if (dialog && state && !state.dialogDetected) {
            setTimeout(() => detectDialogType(dialog), 300);
          }
        }

        if (mutation.removedNodes.length > 0) {
          const dialogStillExists = document.querySelector('div[role="dialog"]');
          const state = window.LiaInstagramState;
          if (!dialogStillExists && state && state.dialogDetected) {
            onDialogClosed();
          }
        }
      }
    });

    dialogObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Stop dialog observer
   */
  function stopDialogObserver() {
    if (dialogObserver) {
      dialogObserver.disconnect();
      dialogObserver = null;
      console.log('[Lia 360 Followers] Dialog observer stopped');
    }
  }

  /**
   * Find dialog scroll container
   */
  function findDialogScrollContainer() {
    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) return null;

    const scrollables = dialog.querySelectorAll('div');
    let bestMatch = null;
    let maxHeight = 0;

    for (const div of scrollables) {
      const style = window.getComputedStyle(div);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        div.scrollHeight > div.clientHeight + 50) {
        if (div.scrollHeight > maxHeight) {
          maxHeight = div.scrollHeight;
          bestMatch = div;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Extract users from dialog with keyword and audience filtering
   */
  async function extractUsersFromDialog() {
    const state = window.LiaInstagramState;
    if (!state) return;

    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) return;

    const userLinks = dialog.querySelectorAll('a[href^="/"][role="link"], a[href^="/"]');
    let newLeadsForBatch = [];

    for (const link of userLinks) {
      try {
        const href = link.getAttribute('href');
        if (!href || href === '/') continue;

        const username = href.replace(/\//g, '').split('?')[0];
        if (!username || username.length < 2) continue;
        if (['explore', 'reels', 'direct', 'stories', 'p', 'accounts'].includes(username)) continue;

        if (state.qualifiedLeads.has(username)) continue;

        state.totalUsersFound++;

        const container = link.closest('div[role="listitem"]') ||
          link.closest('li') ||
          link.parentElement?.parentElement?.parentElement;

        let avatarUrl = null;

        let img = container?.querySelector('img[crossorigin="anonymous"]');
        if (!img) {
          img = container?.querySelector('img');
        }
        if (!img) {
          img = link.querySelector('img') || link.parentElement?.querySelector('img');
        }
        if (!img && container) {
          const canvas = container.querySelector('canvas');
          if (canvas) {
            img = canvas.parentElement?.querySelector('img') || canvas.nextElementSibling;
          }
        }

        if (img) {
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const srcsetParts = srcset.split(',').map(s => s.trim());
            const lastPart = srcsetParts[srcsetParts.length - 1];
            const srcUrl = lastPart.split(' ')[0];
            if (srcUrl && !srcUrl.includes('data:image/gif')) {
              avatarUrl = srcUrl;
            }
          }

          if (!avatarUrl && img.src && !img.src.includes('data:image/gif') && !img.src.includes('data:image/png;base64')) {
            avatarUrl = img.src;
          }
        }

        let fullName = null;
        const spans = container?.querySelectorAll('span') || [];
        for (const span of spans) {
          const text = span.textContent?.trim();
          if (text && text.length > 2 && text !== username && !text.includes('@')) {
            if (!['Follow', 'Following', 'Seguir', 'Seguindo', 'Remove', 'Remover'].includes(text)) {
              fullName = text;
              break;
            }
          }
        }

        const lead = {
          username,
          profileUrl: `https://instagram.com/${username}`,
          avatarUrl,
          fullName: fullName || username,
          platform: 'instagram',
        };

        const searchText = `${lead.fullName || ''} ${lead.bio || ''}`.toLowerCase();
        const passesKeywords = utils.matchesKeywords(searchText, state.keywords);
        const passesAudience = utils.matchesAudienceCriteria(lead, state.selectedAudience);

        if (passesKeywords && passesAudience) {
          state.qualifiedLeads.set(username, lead);
        }

      } catch (e) {
        console.error('[Lia 360 Followers] Error extracting user:', e);
      }
    }

    // Update UI if available
    if (window.LiaInstagramUI && window.LiaInstagramUI.updateFollowersStats) {
      window.LiaInstagramUI.updateFollowersStats();
    }
  }

  /**
   * Start followers scanning with limit
   */
  async function startFollowersScanning() {
    const state = window.LiaInstagramState;
    if (!state) return;

    const scrollLimit = state.followersScrollLimit;

    state.isAutoScrolling = true;
    state.scannedCount = 0;
    state.qualifiedLeads.clear();
    state.totalUsersFound = 0;

    if (window.LiaInstagramUI && window.LiaInstagramUI.updateScrollButtonState) {
      window.LiaInstagramUI.updateScrollButtonState(true);
    }

    console.log(`[Lia 360 Followers] Starting scan with limit: ${scrollLimit}`);

    let noChangeCount = 0;
    const maxNoChange = 5;

    while (state.isAutoScrolling && state.scannedCount < scrollLimit) {
      const scrollContainer = findDialogScrollContainer();
      if (!scrollContainer) {
        console.warn('[Lia 360 Followers] Dialog scroll container not found');
        await utils.sleep(2000);
        continue;
      }

      const prevCount = state.qualifiedLeads.size;
      const prevScroll = scrollContainer.scrollTop;

      await extractUsersFromDialog();

      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      await utils.sleep(2000 + Math.random() * 1000);

      const scrolled = scrollContainer.scrollTop > prevScroll;
      const foundNew = state.qualifiedLeads.size > prevCount;

      if (!scrolled && !foundNew) {
        noChangeCount++;
        console.log(`[Lia 360 Followers] No new users (${noChangeCount}/${maxNoChange})`);

        if (noChangeCount >= maxNoChange) {
          console.log('[Lia 360 Followers] Scan complete');
          break;
        }
      } else {
        noChangeCount = 0;
      }

      state.scannedCount = state.totalUsersFound;
    }

    stopFollowersScanning();
  }

  /**
   * Stop followers scanning
   */
  function stopFollowersScanning() {
    const state = window.LiaInstagramState;
    if (state) {
      state.isAutoScrolling = false;
    }
    if (window.LiaInstagramUI && window.LiaInstagramUI.updateScrollButtonState) {
      window.LiaInstagramUI.updateScrollButtonState(false);
    }
    console.log('[Lia 360 Followers] Scan stopped');
  }

  /**
   * Open followers dialog
   */
  async function openFollowersDialog() {
    const username = utils.getCurrentProfileUsername();
    if (!username) {
      alert('Por favor, navegue para uma página de perfil primeiro.');
      return;
    }

    const followersLink = document.querySelector(SELECTORS.followersButton);
    if (followersLink) {
      followersLink.click();
      await utils.sleep(1500);
    } else {
      window.location.href = `https://www.instagram.com/${username}/followers/`;
    }
  }

  /**
   * Open following dialog
   */
  async function openFollowingDialog() {
    const username = utils.getCurrentProfileUsername();
    if (!username) {
      alert('Por favor, navegue para uma página de perfil primeiro.');
      return;
    }

    const followingLink = document.querySelector(SELECTORS.followingButton);
    if (followingLink) {
      followingLink.click();
      await utils.sleep(1500);
    } else {
      window.location.href = `https://www.instagram.com/${username}/following/`;
    }
  }

  // Expose public API
  window.LiaInstagramFollowers = {
    detectDialogType,
    startDialogObserver,
    stopDialogObserver,
    findDialogScrollContainer,
    extractUsersFromDialog,
    startFollowersScanning,
    stopFollowersScanning,
    openFollowersDialog,
    openFollowingDialog,
  };

  console.log('[Lia 360 Followers] Followers import module loaded');
})();
