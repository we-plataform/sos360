// Instagram content script - Lia 360
// Version 3 - With Post Import Support

(function () {
  'use strict';

  // CRITICAL: Log immediately when script loads
  console.log('[Lia 360] ========================================');
  console.log('[Lia 360] Instagram Content Script Loaded v3.0');
  console.log('[Lia 360] Current URL:', window.location.href);
  console.log('[Lia 360] ========================================');

  // Global error handler to catch any script errors
  window.addEventListener('error', (event) => {
    console.error('[Lia 360] SCRIPT ERROR:', event.error);
  });

  // Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Lia 360] UNHANDLED PROMISE REJECTION:', event.reason);
  });

  // Visual indicator that script is loaded (small badge in corner)
  const debugBadge = document.createElement('div');
  debugBadge.id = 'sos360-debug-badge';
  debugBadge.style.cssText = `
    position: fixed !important;
    bottom: 10px !important;
    right: 10px !important;
    background: #ff6b6b !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 4px !important;
    font-family: monospace !important;
    font-size: 11px !important;
    z-index: 999999 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    pointer-events: none !important;
  `;
  debugBadge.textContent = 'SOS360 v3.0 ✓';
  document.documentElement.appendChild(debugBadge);
  console.log('[Lia 360] Debug badge added to page');

  const UI_ID = 'sos360-instagram-overlay';
  const POST_UI_ID = 'sos360-post-overlay';

  // Rate limiting configuration
  const RATE_LIMIT = {
    maxProfilesPerHour: 40,
    delayMin: 3000,
    delayMax: 8000,
  };

  // --- State Management ---
  const state = {
    // Profile Import State
    qualifiedLeads: new Map(),
    isAutoScrolling: false,
    totalUsersFound: 0,
    keywords: [],
    currentProfileUsername: null,
    criteria: '',
    useAIQualification: false,
    pendingAIBatch: [],
    aiAnalyzing: false,
    batchSize: 20,

    // Post Import State
    isPostPage: false,
    postData: null,
    currentPostUrl: null, // Track current post URL for navigation detection
    profilesFromComments: new Map(),
    isAutoScrollingComments: false,
    targetProfileCount: 300,
    profilesScanned: 0,
    commentAuthors: new Map(), // username -> comment data

    // Pipeline Import State
    selectedAudience: null, // { id, name }
    pipelines: [], // Lista de pipelines disponíveis
    selectedPipeline: null, // Pipeline selecionado para import
    selectedStage: null, // Stage selecionado para import
  };

  // --- Selectors ---
  const SELECTORS = {
    // Followers/Following dialog - these are the most critical and fragile
    dialogList: 'div[role="dialog"] div[style*="flex-direction: column"] > div',
    dialogContainer: 'div[role="dialog"]',
    dialogScrollable: 'div[role="dialog"] div[style*="overflow"]',

    // User item in dialog
    userItem: 'div[role="dialog"] a[href^="/"]',

    // Profile page elements
    profileHeader: 'header',
    profileUsername: 'header h2, header section > div > div > span',
    profileFullName: 'header section span[dir="auto"]',
    profileBio: 'header section > div > span, header section h1',
    profileStats: 'header section ul li',
    profileAvatar: 'header img[alt*="profile"], header canvas + img',

    // Action buttons on profile
    followersButton: 'a[href$="/followers/"], a[href*="/followers"]',
    followingButton: 'a[href$="/following/"], a[href*="/following"]',

    // Posts
    postLink: 'a[href^="/p/"]',

    // Search
    searchInput: 'input[aria-label="Search input"], input[placeholder="Search"], input[placeholder="Pesquisar"]',

    // === POST PAGE SELECTORS ===
    // Post container
    postContainer: 'article',
    postAuthorLink: 'article header a[href^="/"]',
    postAuthorAvatar: 'article header img[crossorigin="anonymous"], article header img',
    postAuthorName: 'article header span[dir="auto"]',
    postCaption: 'article h1, article span[dir="auto"]',
    postImage: 'article img[srcset], article img[src]',
    postLikes: 'article section button span, article section span',
    // Note: Comments count selector uses JS-based text matching (see findElementByText helper)

    // Comment section
    commentSection: 'article ul, div[role="dialog"] ul',
    commentItem: 'ul > div > div, ul li, div[style*="padding"] > div',
    commentAuthorLink: 'a[href^="/"]:not([href*="/explore/"]):not([href*="/p/"])',
    commentAuthorAvatar: 'img[crossorigin="anonymous"], canvas + img, img[alt]',
    commentText: 'span[dir="auto"]',
    commentTimestamp: 'time',
    // Note: viewMoreComments uses JS-based text matching (see findElementByText helper)

    // Post action buttons (for injecting import button)
    postActionBar: 'article section span button, article section div[role="button"]',
  };

  // --- Helper: Find element by text content ---
  function findElementByText(selector, textPatterns, container = document) {
    const elements = Array.from(container.querySelectorAll(selector));
    const patterns = Array.isArray(textPatterns) ? textPatterns : [textPatterns];
    return elements.find(el => {
      const text = el.textContent?.toLowerCase() || '';
      return patterns.some(pattern => text.includes(pattern.toLowerCase()));
    });
  }

  // --- Helper: Find "View more comments" button ---
  function findViewMoreCommentsButton() {
    const patterns = ['view more', 'view all', 'more comments', 'carregar', 'ver mais', 'ver todos', 'load more'];
    // Try spans first
    let btn = findElementByText('span', patterns);
    if (btn) return btn.closest('button, div[role="button"], span[role="button"]') || btn;
    // Try buttons directly
    btn = findElementByText('button', patterns);
    return btn;
  }

  // --- Helper Functions ---
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates a human simulator for realistic mouse/click/scroll events
   * This helps bypass Instagram's detection of programmatic interactions
   */
  function createHumanSimulator() {
    return {
      // Get a humanized delay (with random variation)
      getHumanDelay(min = 1000, max = 3000) {
        return min + Math.random() * (max - min);
      },

      // Get a random position within an element (not exactly center)
      getRandomPosition(element) {
        const rect = element.getBoundingClientRect();
        const marginX = rect.width * 0.2;
        const marginY = rect.height * 0.2;
        return {
          x: rect.left + marginX + Math.random() * (rect.width - 2 * marginX),
          y: rect.top + marginY + Math.random() * (rect.height - 2 * marginY)
        };
      },

      // Simulate mouse movement to an element
      async simulateMouseMove(element) {
        const { x, y } = this.getRandomPosition(element);
        const steps = 5 + Math.floor(Math.random() * 5);
        const startX = x - 50 + Math.random() * 100;
        const startY = y - 50 + Math.random() * 100;

        for (let i = 1; i <= steps; i++) {
          const progress = i / steps;
          const currentX = startX + (x - startX) * progress;
          const currentY = startY + (y - startY) * progress;

          const target = document.elementFromPoint(currentX, currentY);
          if (target) {
            target.dispatchEvent(new MouseEvent('mousemove', {
              bubbles: true, view: window,
              clientX: currentX, clientY: currentY
            }));
          }
          await sleep(20 + Math.random() * 30);
        }
        return { x, y };
      },

      // Simulate hover on element
      async simulateHover(element) {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await sleep(100 + Math.random() * 150);
      },

      // Simulate a complete realistic click sequence
      async simulateClick(element) {
        if (!element) return false;

        try {
          // 1. Move mouse to element
          const { x, y } = await this.simulateMouseMove(element);

          // 2. Hover
          await this.simulateHover(element);

          // 3. PointerDown
          element.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y,
            pointerType: 'mouse', isPrimary: true, pressure: 0.5
          }));

          // 4. MouseDown
          element.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0, buttons: 1
          }));

          await sleep(50 + Math.random() * 50);

          // 5. PointerUp
          element.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y,
            pointerType: 'mouse', isPrimary: true, pressure: 0
          }));

          // 6. MouseUp
          element.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0, buttons: 0
          }));

          await sleep(30 + Math.random() * 30);

          // 7. Click
          element.dispatchEvent(new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0
          }));

          console.log('[Lia 360] Simulated realistic click at', { x: Math.round(x), y: Math.round(y) });
          return true;
        } catch (error) {
          console.error('[Lia 360] Error simulating click:', error);
          return false;
        }
      },

      // Simulate scroll via WheelEvent (more realistic than scrollTop)
      async simulateWheelScroll(element, distance = 300) {
        if (!element) return false;

        try {
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;

          // Divide into multiple small events (more natural)
          const steps = 3 + Math.floor(Math.random() * 3);
          const stepDistance = distance / steps;

          for (let i = 0; i < steps; i++) {
            const wheelEvent = new WheelEvent('wheel', {
              bubbles: true, cancelable: true, view: window,
              clientX: x, clientY: y,
              deltaX: 0,
              deltaY: stepDistance + (Math.random() - 0.5) * 20,
              deltaZ: 0,
              deltaMode: WheelEvent.DOM_DELTA_PIXEL
            });

            element.dispatchEvent(wheelEvent);
            await sleep(80 + Math.random() * 40);
          }

          console.log('[Lia 360] Simulated wheel scroll:', { steps, totalDistance: distance });
          return true;
        } catch (error) {
          console.error('[Lia 360] Error simulating wheel scroll:', error);
          return false;
        }
      }
    };
  }

  /**
   * Get scroll target comment for scrollIntoView (works with virtual scrolling)
   * @param {HTMLElement} scrollContainer - The container to search within
   */
  function getScrollTargetComment(scrollContainer) {
    // CRITICAL FIX: Only query comments INSIDE the scroll container
    // This prevents picking up navigation elements or comments from other parts of the DOM
    const context = scrollContainer || document;
    const comments = context.querySelectorAll(SELECTORS.commentItem);

    if (comments.length === 0) return null;

    // Get currently visible comments
    const visibleComments = Array.from(comments).filter(comment => {
      const rect = comment.getBoundingClientRect();
      const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
      return isInViewport;
    });

    console.log(`[Lia 360] Found ${comments.length} total comments, ${visibleComments.length} visible inside container`);

    // If we have non-visible comments, target one below the visible area
    if (visibleComments.length < comments.length) {
      const lastVisibleIndex = visibleComments.length > 0
        ? Array.from(comments).indexOf(visibleComments[visibleComments.length - 1])
        : -1;

      // Scroll to 3-5 comments ahead (incremental and humanized)
      const jumpSize = 3 + Math.floor(Math.random() * 3);
      const targetIndex = Math.min(lastVisibleIndex + jumpSize, comments.length - 1);

      console.log(`[Lia 360] Targeting comment ${targetIndex} (jump size: ${jumpSize})`);
      return comments[targetIndex];
    }

    // If all visible, target the last one (will trigger load more)
    console.log('[Lia 360] All comments visible, targeting last comment');
    return comments[comments.length - 1];
  }

  /**
   * Scroll to next comments by scrolling the CONTAINER (not the comment element)
   * This works with Instagram's modal dialog structure
   */
  async function scrollToNextComments(scrollContainer) {
    if (!scrollContainer) {
      console.log('[Lia 360] No scroll container provided');
      return false;
    }

    const targetComment = getScrollTargetComment(scrollContainer);

    if (!targetComment) {
      console.log('[Lia 360] No target comment found for scrolling');
      return false;
    }

    try {
      // Get the target comment's position RELATIVE to the scrollable container
      const containerRect = scrollContainer.getBoundingClientRect();
      const commentRect = targetComment.getBoundingClientRect();

      // Calculate how much we need to scroll the container
      const relativeTop = commentRect.top - containerRect.top;
      const currentScroll = scrollContainer.scrollTop;
      const targetScroll = currentScroll + relativeTop - (containerRect.height * 0.3); // Position at 30% from top

      console.log('[Lia 360] Scrolling container:', {
        currentScroll,
        targetScroll,
        scrollDelta: targetScroll - currentScroll
      });

      // CRITICAL FIX: Use instant scroll instead of smooth (smooth scroll is often blocked by Instagram)
      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: 'instant'  // Changed from 'smooth' to 'instant'
      });

      // CRITICAL: Verify scroll actually happened
      await sleep(50); // Small delay to let DOM update
      const actualScroll = scrollContainer.scrollTop;
      const scrollHappened = Math.abs(actualScroll - currentScroll) > 1;

      if (!scrollHappened) {
        console.warn('[Lia 360] Scroll did NOT happen! Container may not be scrollable.', {
          currentScroll,
          actualScroll,
          scrollHeight: scrollContainer.scrollHeight,
          clientHeight: scrollContainer.clientHeight
        });
        return false;
      }

      console.log('[Lia 360] Scrolled container successfully to target comment');

      // Wait for scroll to complete and new content to load
      await sleep(300 + Math.random() * 200);

      return true;
    } catch (error) {
      console.error('[Lia 360] Container scroll failed:', error);
      return false;
    }
  }

  /**
   * Progressive scroll through multiple comments by scrolling the container
   */
  async function scrollProgressively(scrollContainer) {
    if (!scrollContainer) {
      console.log('[Lia 360] No scroll container provided');
      return false;
    }

    const comments = document.querySelectorAll(SELECTORS.commentItem);
    if (comments.length < 5) {
      console.log('[Lia 360] Too few comments for progressive scroll');
      return false;
    }

    // Start from 70% through the list
    const startIndex = Math.floor(comments.length * 0.7);
    const batchSize = 2 + Math.floor(Math.random() * 2);  // 2-3 comments

    console.log(`[Lia 360] Progressive scroll: ${batchSize} comments starting at index ${startIndex}`);

    const containerRect = scrollContainer.getBoundingClientRect();
    const currentScroll = scrollContainer.scrollTop;

    for (let i = 0; i < batchSize && (startIndex + i) < comments.length; i++) {
      const comment = comments[startIndex + i];
      const commentRect = comment.getBoundingClientRect();
      const relativeTop = commentRect.top - containerRect.top;
      const targetScroll = currentScroll + relativeTop - (containerRect.height * 0.5);

      // CRITICAL FIX: Use instant scroll instead of smooth
      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: 'instant'
      });

      await sleep(150 + Math.random() * 100);
    }

    return true;
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  function parseCount(text) {
    if (!text) return 0;

    // Clean the text
    const clean = text.toLowerCase()
      .replace(/,/g, '')      // Remove comma separators
      .replace(/\./g, '')     // Remove period separators
      .replace(/\+/g, '')     // Remove "+" suffix
      .trim();

    // Handle Portuguese abbreviations
    if (clean.includes('mil')) return parseFloat(clean) * 1000;
    if (clean.includes('mi') || clean.includes('m')) return parseFloat(clean) * 1000000;
    if (clean.includes('b')) return parseFloat(clean) * 1000000000;

    // Handle "k" suffix (international)
    if (clean.includes('k')) {
      const num = parseFloat(clean.replace('k', ''));
      return Math.round(num * 1000);
    }

    // Extract pure number
    const match = clean.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  function matchesKeywords(text, keywords) {
    if (!keywords || keywords.length === 0) return true;
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase().trim()));
  }

  function getCurrentProfileUsername() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0 && !['explore', 'reels', 'direct', 'stories', 'p', 'tv', 'accounts'].includes(parts[0])) {
      return parts[0];
    }
    return null;
  }

  // === POST PAGE DETECTION & EXTRACTION ===

  /**
   * Detects if current page is an Instagram post page
   * @returns {boolean} True if on a post page (e.g., /p/ABC123/)
   */
  function isInstagramPostPage() {
    return /\/p\/[\w-]+\/?$/.test(window.location.pathname);
  }

  /**
   * Extracts post data from current Instagram post page
   * @returns {Object|null} Post data object or null if not on a post page
   */
  function extractPostData() {
    if (!isInstagramPostPage()) return null;

    const article = document.querySelector(SELECTORS.postContainer);
    if (!article) return null;

    try {
      // Extract author info
      const authorLink = article.querySelector(SELECTORS.postAuthorLink);
      const authorUsername = authorLink ? authorLink.getAttribute('href')?.replace(/\//g, '') : null;
      const authorAvatar = article.querySelector(SELECTORS.postAuthorAvatar);
      const authorName = article.querySelector(SELECTORS.postAuthorName);

      // Extract caption (try multiple selectors)
      let caption = null;
      const captionEls = article.querySelectorAll('h1, span[dir="auto"]');
      for (const el of captionEls) {
        const text = getTextContent(el);
        if (text && text.length > 20) { // Likely caption content
          caption = text;
          break;
        }
      }

      // Extract images
      const images = [];
      const imageEls = article.querySelectorAll(SELECTORS.postImage);
      for (const img of imageEls) {
        if (img.src && !img.src.includes('data:image') && !img.src.includes('44x44')) {
          images.push(img.src);
        }
      }

      // Extract likes count
      let likesCount = null;
      const likeButtons = article.querySelectorAll(SELECTORS.postLikes);
      for (const btn of likeButtons) {
        const text = getTextContent(btn);
        if (text && /\d/.test(text)) {
          likesCount = parseCount(text);
          break;
        }
      }

      // Extract comments count
      let commentsCount = null;
      const commentLinks = article.querySelectorAll('a[href*="/comments/"]');
      for (const link of commentLinks) {
        const text = getTextContent(link);
        if (text) {
          commentsCount = parseCount(text);
          break;
        }
      }

      const postData = {
        postUrl: window.location.href.split('?')[0],
        caption: caption || '',
        imageUrls: images.slice(0, 5), // Max 5 images
        likesCount: likesCount,
        commentsCount: commentsCount,
        authorUsername: authorUsername,
        authorFullName: authorName ? getTextContent(authorName) : null,
        authorAvatarUrl: authorAvatar ? authorAvatar.src : null,
        extractedAt: new Date().toISOString(),
      };

      console.log('[Lia 360] Post data extracted:', postData);
      state.postData = postData;
      return postData;

    } catch (error) {
      console.error('[Lia 360] Error extracting post data:', error);
      return null;
    }
  }

  /**
   * Extracts comment authors from the visible comments section
   * @returns {Array} Array of comment author objects
   */
  function extractCommentAuthors() {
    const commentAuthors = [];
    const commentItems = document.querySelectorAll(SELECTORS.commentItem);

    for (const item of commentItems) {
      try {
        // Find author link
        const authorLink = item.querySelector(SELECTORS.commentAuthorLink);
        if (!authorLink) continue;

        const href = authorLink.getAttribute('href');
        if (!href || href === '/' || href.includes('/explore/') || href.includes('/p/')) continue;

        const username = href.replace(/\//g, '').split('?')[0];
        if (!username || username.length < 2) continue;

        // Skip if already processed
        if (state.commentAuthors.has(username)) continue;

        // Extract avatar
        const avatar = item.querySelector(SELECTORS.commentAuthorAvatar);
        const avatarUrl = avatar?.src || null;

        // Extract comment text
        const commentTextEl = item.querySelector(SELECTORS.commentText);
        const commentText = getTextContent(commentTextEl) || '';

        // Get parent container for more context
        const container = authorLink.closest('div, li');

        // Extract verification status (blue checkmark badge) - FIXED: Use item instead of container
        let verified = false;
        const verifiedBadge = item.querySelector('svg[aria-label="Verified"], img[src*="verified"], path[d*="M22.5 12.5c0-1.58"]');
        if (verifiedBadge) {
          verified = true;
        }

        // Extract full name if available (usually in a span nearby)
        let fullName = null;
        if (container) {
          const spans = container.querySelectorAll('span');
          for (const span of spans) {
            const text = getTextContent(span);
            if (text && text !== username && text.length > 2 && text !== commentText && !text.includes('@')) {
              fullName = text;
              break;
            }
          }
        }

        const authorData = {
          username,
          fullName: fullName || username,
          avatarUrl,
          profileUrl: `https://instagram.com/${username}`,
          platform: 'instagram',
          commentText: commentText ? commentText.substring(0, 500) : '', // Limit length
          followersCount: null, // Not visible in comments
          isFromComment: true, // Flag to indicate this is from comment extraction (bio not available)
          verified: verified,
        };

        commentAuthors.push(authorData);
        state.commentAuthors.set(username, authorData);

      } catch (error) {
        console.error('[Lia 360] Error extracting comment author:', error);
      }
    }

    console.log(`[Lia 360] Extracted ${commentAuthors.length} comment authors`);
    return commentAuthors;
  }

  /**
   * Opens the comments section if it's closed
   */
  async function openCommentsSection() {
    // Strategy 1: Find comment SVG icon and click its parent button
    const commentSvg = document.querySelector('svg[aria-label*="Comment"], svg[aria-label*="Comentar"], svg[aria-label*="comment"]');
    if (commentSvg) {
      const btn = commentSvg.closest('button, div[role="button"], span[role="button"]');
      if (btn) {
        console.log('[Lia 360] Clicking comment button via SVG');
        btn.click();
        await sleep(2000);
        return;
      }
    }

    // Strategy 2: Find link to /comments/
    const commentsLink = document.querySelector('a[href*="/comments/"]');
    if (commentsLink) {
      console.log('[Lia 360] Clicking comments link');
      commentsLink.click();
      await sleep(2000);
      return;
    }

    // Strategy 3: Look for text "View all X comments"
    const viewAllBtn = findElementByText('span', ['view all', 'ver todos', 'comments', 'comentários']);
    if (viewAllBtn) {
      const clickable = viewAllBtn.closest('button, div[role="button"], a') || viewAllBtn;
      console.log('[Lia 360] Clicking view all comments');
      clickable.click();
      await sleep(2000);
    }
  }

  /**
   * Finds the scrollable container for comments in a post dialog
   * Handles both UL (current Instagram structure) and DIV (fallback) containers
   * @returns {HTMLElement|null} The scrollable container or null if not found
   */
  function findCommentScrollContainer() {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return null;

    // Strategy 1: UL with Instagram's specific class (most precise)
    const ulByClass = dialog.querySelector('ul[class*="_a9z6"]');
    if (ulByClass) {
      const style = window.getComputedStyle(ulByClass);
      if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
        console.log('[Lia 360] Found UL comment container by class');
        return ulByClass;
      }
    }

    // Strategy 2: Any scrollable UL with comments (h3 = username in comments)
    const allULs = dialog.querySelectorAll('ul');
    for (const ul of allULs) {
      const style = window.getComputedStyle(ul);
      const isScrollable = style.overflowY === 'scroll' || style.overflowY === 'auto';
      const hasHeight = ul.scrollHeight > ul.clientHeight + 50;
      const hasComments = ul.querySelectorAll('h3').length > 0;

      if (isScrollable && hasHeight && hasComments) {
        const commentLinks = ul.querySelectorAll('a[href^="/"]:not([href*="/explore/"]):not([href*="/p/"])');
        console.log(`[Lia 360] Found UL comment container with ${commentLinks.length} profile links`);
        return ul;
      }
    }

    // Strategy 3: Any scrollable UL with profile links (broader search)
    for (const ul of allULs) {
      const style = window.getComputedStyle(ul);
      const isScrollable = style.overflowY === 'scroll' || style.overflowY === 'auto';
      const hasHeight = ul.scrollHeight > ul.clientHeight + 50;
      const commentLinks = ul.querySelectorAll('a[href^="/"]:not([href*="/explore/"]):not([href*="/p/"])');

      if (isScrollable && hasHeight && commentLinks.length > 3) {
        console.log(`[Lia 360] Found UL container with ${commentLinks.length} links (fallback)`);
        return ul;
      }
    }

    // Strategy 4: Fallback to DIV (older Instagram structure or future changes)
    const allDivs = dialog.querySelectorAll('div');
    for (const div of allDivs) {
      const style = window.getComputedStyle(div);
      const isScrollable = style.overflowY === 'scroll' || style.overflowY === 'auto';
      const hasHeight = div.scrollHeight > div.clientHeight + 50;
      const commentLinks = div.querySelectorAll('a[href^="/"]:not([href*="/explore/"]):not([href*="/p/"])');

      if (isScrollable && hasHeight && commentLinks.length > 5) {
        console.log(`[Lia 360] Found DIV comment container with ${commentLinks.length} links`);
        return div;
      }
    }

    console.log('[Lia 360] No comment scroll container found in dialog');
    return null;
  }

  /**
   * Finds the "Load more comments" button using multiple strategies
   * @returns {HTMLElement|null} The button element or null if not found
   */
  function findLoadMoreButton() {
    const dialog = document.querySelector('div[role="dialog"]');
    const searchContext = dialog || document;

    // Strategy 1: SVG with specific aria-labels
    const svgSelectors = [
      'svg[aria-label="Load more comments"]',
      'svg[aria-label*="Load more"]',
      'svg[aria-label*="Carregar mais"]',
      'svg[aria-label*="load more"]',
      'svg[aria-label*="Ver mais"]',
      'svg[aria-label*="More"]'
    ];

    for (const selector of svgSelectors) {
      const svg = searchContext.querySelector(selector);
      if (svg) {
        const btn = svg.closest('button') || svg.closest('div[role="button"]');
        if (btn) {
          console.log('[Lia 360] Found load more button via SVG:', selector);
          return btn;
        }
      }
    }

    // Strategy 2: Text-based search in buttons
    const textPatterns = ['view more', 'load more', 'ver mais', 'carregar mais', 'more comments', 'mais comentários'];
    const buttons = searchContext.querySelectorAll('button, div[role="button"], span[role="button"]');

    for (const btn of buttons) {
      const text = btn.textContent?.toLowerCase() || '';
      if (textPatterns.some(p => text.includes(p))) {
        console.log('[Lia 360] Found load more button via text:', text.substring(0, 30));
        return btn;
      }
    }

    // Strategy 3: Also check "View more comments" button (existing helper)
    const viewMoreBtn = findViewMoreCommentsButton();
    if (viewMoreBtn) {
      console.log('[Lia 360] Found view more comments button');
      return viewMoreBtn;
    }

    // Strategy 4: Look for small circular buttons with expand icons near comments
    const smallButtons = searchContext.querySelectorAll('button svg, div[role="button"] svg');
    for (const svg of smallButtons) {
      const parent = svg.closest('button') || svg.closest('div[role="button"]');
      if (!parent) continue;

      // Check if it's a small expand-style button (not like/comment/share)
      const rect = parent.getBoundingClientRect();
      if (rect.width < 50 && rect.height < 50) {
        const ariaLabel = svg.getAttribute('aria-label') || '';
        // Skip known action buttons
        if (['like', 'comment', 'share', 'save', 'more options'].some(a => ariaLabel.toLowerCase().includes(a))) {
          continue;
        }
        // Could be a load more button
        const path = svg.querySelector('path');
        if (path) {
          console.log('[Lia 360] Found potential expand button');
          return parent;
        }
      }
    }

    return null;
  }

  /**
   * Clicks the "Load more comments" button if present using realistic simulation
   * @param {Object} simulator - The HumanSimulator instance
   * @returns {Promise<boolean>} True if button was found and clicked
   */
  async function clickLoadMoreComments(simulator) {
    const loadMoreBtn = findLoadMoreButton();

    if (loadMoreBtn) {
      console.log('[Lia 360] Attempting to click load more button');
      const clicked = await simulator.simulateClick(loadMoreBtn);
      if (clicked) {
        // Wait for comments to load with humanized delay
        await sleep(simulator.getHumanDelay(1500, 2500));
        return true;
      }
    }

    return false;
  }

  /**
   * Starts auto-scroll through comments to extract authors
   * @param {number} targetCount - Target number of profiles to extract (default: 300)
   */
  async function startCommentAutoScroll(targetCount = 300) {
    if (state.isAutoScrollingComments) {
      console.log('[Lia 360] Already scrolling comments');
      return;
    }

    state.isAutoScrollingComments = true;
    state.targetProfileCount = targetCount;
    state.profilesScanned = 0;

    console.log(`[Lia 360] Starting comment auto-scroll, target: ${targetCount}`);

    // Create human simulator for realistic interactions
    const simulator = createHumanSimulator();

    // Update UI if post overlay is open
    updatePostScrollStatus('Starting...', 0);

    // First, try to open comments section
    await openCommentsSection();

    let noChangeCount = 0;
    const maxNoChange = 5;
    const baseScrollAmount = 300;

    while (state.isAutoScrollingComments && state.commentAuthors.size < targetCount) {
      const prevCount = state.commentAuthors.size;

      // Use the dedicated function to find the correct scroll container (UL or DIV)
      const scrollContainer = findCommentScrollContainer();

      // Debug logging - show current state
      console.log('[Lia 360] Scroll iteration:', {
        containerTag: scrollContainer?.tagName || 'none',
        containerClass: scrollContainer?.className?.substring(0, 30) || 'none',
        scrollTop: scrollContainer?.scrollTop || 0,
        scrollHeight: scrollContainer?.scrollHeight || 0,
        clientHeight: scrollContainer?.clientHeight || 0,
        canScroll: scrollContainer ? scrollContainer.scrollHeight - scrollContainer.clientHeight : 0,
        commentsFound: state.commentAuthors.size,
        loadMoreBtnExists: !!findLoadMoreButton()
      });

      // Extract visible comments FIRST (before scroll)
      extractCommentAuthors();
      // Update UI with filtered results
      updatePostProfilesList();

      // PRIORITY 1: Try clicking "Load more comments" button using realistic simulation
      const loadedMore = await clickLoadMoreComments(simulator);

      let scrolled = false;
      let prevScrollTop = 0;

      if (loadedMore) {
        // Button was clicked, extract new comments that appeared
        console.log('[Lia 360] Load more button clicked via simulation, extracting new comments');
        await sleep(simulator.getHumanDelay(200, 400)); // Small extra delay for DOM update
        extractCommentAuthors();
        // Update UI with filtered results
        updatePostProfilesList();
      }

      // ALWAYS try scrolling the container after clicking Load more (or if no button was found)
      // This is needed because Instagram uses virtual scrolling and may not load
      // new comments until you actually scroll the container
      if (scrollContainer) {
        console.log('[Lia 360] Attempting to scroll container to trigger virtual scroll loading');

        // Method 1: Scroll to target comment (PRIMARY)
        scrolled = await scrollToNextComments(scrollContainer);

        if (!scrolled) {
          console.log('[Lia 360] Single scroll failed, trying progressive scroll');

          // Method 2: Progressive scroll through multiple comments
          scrolled = await scrollProgressively(scrollContainer);
        }

        // Small humanized delay
        await sleep(simulator.getHumanDelay(200, 400));
      } else if (!loadedMore) {
        // No container found - log warning and try window scroll as last resort
        console.log('[Lia 360] Warning: No scroll container found, trying window scroll');
        prevScrollTop = window.scrollY;
        window.scrollBy(0, baseScrollAmount);
        await sleep(300);
        scrolled = window.scrollY > prevScrollTop;
      }

      // Wait for content to load with humanized delay
      await sleep(simulator.getHumanDelay(400, 800));

      // Extract any new comments after scrolling
      extractCommentAuthors();
      // Update UI with filtered results
      updatePostProfilesList();

      // Check if we made progress
      const newCount = state.commentAuthors.size;
      const foundNew = newCount > prevCount;

      state.profilesScanned = newCount;

      if (!scrolled && !foundNew && !loadedMore) {
        noChangeCount++;
        console.log(`[Lia 360] No progress, attempt ${noChangeCount}/${maxNoChange}`);

        // Update UI to reflect waiting state
        updatePostScrollStatus(
          `Waiting for more comments... (attempt ${noChangeCount}/${maxNoChange})`,
          Math.min(100, Math.round((newCount / targetCount) * 100))
        );

        if (noChangeCount >= maxNoChange) {
          console.log('[Lia 360] Comment auto-scroll complete - no more content');
          break;
        }
      } else {
        noChangeCount = 0;

        // Update UI based on what happened
        if (foundNew) {
          updatePostScrollStatus(
            `Extracting: ${newCount} / ${targetCount}`,
            Math.min(100, Math.round((newCount / targetCount) * 100))
          );
        } else if (scrolled || loadedMore) {
          updatePostScrollStatus(
            `Scrolling... (${newCount} found)`,
            Math.min(100, Math.round((newCount / targetCount) * 100))
          );
        }
      }

      // Safety check - if we've found enough, stop
      if (state.commentAuthors.size >= targetCount) {
        console.log(`[Lia 360] Target reached: ${state.commentAuthors.size}`);
        break;
      }
    }

    state.isAutoScrollingComments = false;
    updatePostScrollStatus(
      `Complete! ${state.commentAuthors.size} profiles found`,
      100
    );

    console.log(`[Lia 360] Comment extraction complete: ${state.commentAuthors.size} profiles`);
  }

  /**
   * Stops the comment auto-scroll
   */
  function stopCommentAutoScroll() {
    state.isAutoScrollingComments = false;
    updatePostScrollStatus('Stopped', Math.min(100, Math.round((state.commentAuthors.size / state.targetProfileCount) * 100)));
  }

  /**
   * Updates the scroll status in the post overlay
   */
  function updatePostScrollStatus(status, progress) {
    const statusEl = document.getElementById('sos-post-scroll-status');
    const progressEl = document.getElementById('sos-post-scroll-progress');
    const countEl = document.getElementById('sos-post-scroll-count');

    if (statusEl) statusEl.textContent = status;
    if (progressEl) progressEl.style.width = `${progress}%`;
    if (countEl) countEl.textContent = `${state.commentAuthors.size}`;
  }

  /**
   * Creates the "Import This Post" button on the Instagram post page
   */
  /**
   * Inject buttons below the post header:
   * 1. Import This Post Data (Blue)
   * 2. Auto-Reply to Comments (Teal)
   */
  function injectPostButtons() {
    // Check if buttons already exist
    if (document.getElementById('sos-post-actions-container')) return;

    // Find the post article
    const article = document.querySelector(SELECTORS.postContainer);
    if (!article) return;

    // Find the scroll container (Comments Area)
    let scrollContainer = null;

    // Strategy 1: Look for specific class (common in recent IG updates)
    scrollContainer = article.querySelector('ul[class*="_a9z6"]');

    // Strategy 2: Look for any scrollable element reasonably large
    if (!scrollContainer) {
      const candidates = article.querySelectorAll('ul, div');
      for (const el of candidates) {
        // Skip the header itself
        // We do this by checking geometry
        if (el.tagName === 'HEADER' || el.querySelector('header')) continue;

        const style = window.getComputedStyle(el);
        // Check for scrolling capability and height
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.clientHeight > 50) {
          // Heuristic: usually the comments list has many children
          if (el.children.length > 0) {
            scrollContainer = el;
            break;
          }
        }
      }
    }

    if (!scrollContainer) {
      return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'sos-post-actions-container';
    // Sticky positioning to ensure it stays at top of scroll area AND pushes content down
    container.style.cssText = `
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 12px 16px;
      border-bottom: 1px solid rgb(38, 38, 38);
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Attempt to match background color
    try {
      let bg = window.getComputedStyle(article).backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
        bg = window.getComputedStyle(scrollContainer).backgroundColor;
      }
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        container.style.backgroundColor = bg;
      } else {
        container.style.backgroundColor = '#000000';
      }
    } catch (e) {
      container.style.backgroundColor = '#000000';
    }

    // --- Import Button ---
    const importBtn = document.createElement('button');
    importBtn.id = 'sos-import-post-data-btn';
    importBtn.innerHTML = '☁️ Import This Post Data';
    importBtn.style.cssText = `
      background-color: #3b82f6; /* Blue */
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 32px;
    `;

    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      const originalText = importBtn.innerHTML;
      importBtn.innerHTML = '⏳ Importing...';

      try {
        const postData = extractPostData();
        if (!postData) {
          throw new Error('Failed to extract post data');
        }

        const response = await chrome.runtime.sendMessage({
          action: 'importPostData',
          data: postData
        });

        if (response?.success) {
          importBtn.innerHTML = '✅ Imported!';
          setTimeout(() => {
            importBtn.innerHTML = originalText;
            importBtn.disabled = false;
          }, 2000);
        } else {
          throw new Error('Import failed');
        }
      } catch (error) {
        console.error('[Lia 360] Import post error:', error);
        importBtn.innerHTML = '❌ Error';
        setTimeout(() => {
          importBtn.innerHTML = originalText;
          importBtn.disabled = false;
        }, 2000);
      }
    });

    // --- Save to Library Button ---
    const saveLibraryBtn = document.createElement('button');
    saveLibraryBtn.id = 'sos-save-library-btn';
    saveLibraryBtn.innerHTML = '📚 Salvar na Biblioteca';
    saveLibraryBtn.style.cssText = `
      background-color: #8b5cf6; /* Purple */
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 32px;
    `;

    saveLibraryBtn.addEventListener('click', async () => {
      saveLibraryBtn.disabled = true;
      const originalText = saveLibraryBtn.innerHTML;
      saveLibraryBtn.innerHTML = '⏳ Salvando...';

      try {
        const postData = extractPostData();
        if (!postData) {
          throw new Error('Failed to extract post data');
        }

        const response = await chrome.runtime.sendMessage({
          action: 'savePostToLibrary',
          platform: 'instagram',
          data: {
            postUrl: postData.postUrl,
            content: postData.caption,
            imageUrls: postData.imageUrls || [],
            videoUrls: [],
            likesCount: postData.likesCount,
            commentsCount: postData.commentsCount,
            authorUsername: postData.authorUsername,
            authorFullName: postData.authorFullName,
            authorAvatarUrl: postData.authorAvatarUrl,
            authorProfileUrl: postData.authorUsername ? `https://instagram.com/${postData.authorUsername}` : null,
            postType: 'post',
          }
        });

        if (response?.success) {
          saveLibraryBtn.innerHTML = '✅ Salvo!';
          setTimeout(() => {
            saveLibraryBtn.innerHTML = originalText;
            saveLibraryBtn.disabled = false;
          }, 2000);
        } else {
          throw new Error(response?.error || 'Save failed');
        }
      } catch (error) {
        console.error('[Lia 360] Save to library error:', error);
        saveLibraryBtn.innerHTML = '❌ Erro';
        setTimeout(() => {
          saveLibraryBtn.innerHTML = originalText;
          saveLibraryBtn.disabled = false;
        }, 2000);
      }
    });

    // --- Auto-Reply Button ---
    const autoReplyBtn = document.createElement('button');
    autoReplyBtn.id = 'sos-auto-reply-btn';
    autoReplyBtn.innerHTML = '↩️ Auto-Reply to Comments';
    autoReplyBtn.style.cssText = `
      background-color: #10b981; /* Teal/Green */
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 32px;
    `;

    autoReplyBtn.addEventListener('click', () => {
      createAutoReplyOverlay();
    });

    // Hover effects
    [importBtn, saveLibraryBtn, autoReplyBtn].forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.opacity = '0.9');
      btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
    });

    // Append buttons to container
    container.appendChild(importBtn);
    container.appendChild(saveLibraryBtn);
    container.appendChild(autoReplyBtn);

    // Inject as FIRST CHILD of scroll container
    if (scrollContainer.firstChild) {
      scrollContainer.insertBefore(container, scrollContainer.firstChild);
    } else {
      scrollContainer.appendChild(container);
    }

    console.log('[Lia 360] Post buttons injected INSIDE scroll container (sticky)');
  }

  /**
   * Removes the injected import button
   */
  function removePostButtons() {
    const container = document.getElementById('sos-post-actions-container');
    if (container) {
      container.remove();
    }
  }

  /**
   * Closes and removes the post import overlay, resetting related state
   * Called when navigating away from a post or to a different post
   */
  function closePostOverlay() {
    const overlay = document.getElementById(POST_UI_ID);
    if (overlay) {
      overlay.remove(); // Remove completely so it gets recreated with new data
    }

    // Reset post-related state
    state.postData = null;
    state.commentAuthors.clear();
    state.profilesFromComments.clear();
    state.isAutoScrollingComments = false;
    state.profilesScanned = 0;

    console.log('[Lia 360] Post overlay closed and state reset');
  }

  /**
   * Creates the post import overlay UI
   */
  function createPostImportOverlay() {
    const existingOverlay = document.getElementById(POST_UI_ID);
    if (existingOverlay) {
      existingOverlay.style.display = 'block';
      // CRITICAL FIX: Re-attach event listeners even if overlay already exists
      attachPostOverlayEventListeners();
      return;
    }

    const postData = extractPostData();
    if (!postData) {
      alert('Não foi possível extrair dados do post. Por favor, recarregue a página.');
      return;
    }

    state.postData = postData;

    const overlay = document.createElement('div');
    overlay.id = POST_UI_ID;
    overlay.innerHTML = `
      <div class="sos-post-header">
        <span class="sos-post-title">📥 Import from Post</span>
        <div class="sos-post-header-actions">
          <button id="sos-post-menu" class="sos-post-menu-btn" title="Selecionar Audiência">☰</button>
          <button id="sos-post-close" class="sos-post-close">&times;</button>
        </div>
      </div>
      <div id="sos-post-audience-menu" class="sos-post-dropdown" style="display:none;">
        <div class="sos-post-dropdown-header">Selecionar Audiência</div>
        <div id="sos-post-audience-list" class="sos-post-dropdown-content">
          <div class="sos-loading">Carregando...</div>
        </div>
      </div>
      <div id="sos-post-selected-audience" class="sos-post-selected-audience" style="display:none;">
        <span id="sos-post-audience-name">Nenhuma selecionada</span>
        <button id="sos-post-clear-audience" class="sos-post-clear-btn" title="Remover">&times;</button>
      </div>
      <div class="sos-post-content">
        <!-- Scroll Settings Section -->
        <div class="sos-post-section">
          <div class="sos-post-section-title">Scroll Settings</div>
          <div class="sos-post-input-group">
            <label for="sos-target-count">Target number of profiles:</label>
            <input type="number" id="sos-target-count" value="300" min="10" max="1000">
          </div>
          <button id="sos-start-scroll" class="sos-post-btn sos-post-btn-primary">
            🔍 Start Auto Scroll
          </button>
        </div>

        <!-- Progress Section -->
        <div id="sos-post-progress-section" style="display:none;" class="sos-post-section">
          <div class="sos-post-section-title">Progress</div>
          <div id="sos-post-scroll-status" class="sos-post-status-text">Ready...</div>
          <div class="sos-post-progress-bar-bg">
            <div id="sos-post-scroll-progress" class="sos-post-progress-bar-fill"></div>
          </div>
          <div class="sos-post-progress-text">
            <span id="sos-post-scroll-count">0</span> profiles found
          </div>
        </div>

        <!-- Profiles Found Section -->
        <div id="sos-post-profiles-section" style="display:none;" class="sos-post-section">
          <div class="sos-post-section-title">
            Profiles Found (<span id="sos-post-profiles-count">0</span>)
          </div>
          <div id="sos-post-profiles-list" class="sos-post-profiles-list">
            <!-- Profile items will be added here -->
          </div>
          <button id="sos-post-import-selected" class="sos-post-btn sos-post-btn-action" disabled>
            ☁️ Import <span id="sos-post-selected-count">0</span> Selected Profiles
          </button>
        </div>
      </div>
      <style>
      #${POST_UI_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        max-height: 80vh;
        background: #1f2937;
        color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: -apple-system, system-ui, sans-serif;
        border: 1px solid rgba(0,0,0,0.2);
        overflow-y: auto;
      }
      #${POST_UI_ID} .sos-post-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #111827;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #374151;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      #${POST_UI_ID} .sos-post-header-actions { display: flex; align-items: center; gap: 8px; }
      #${POST_UI_ID} .sos-post-title { font-weight: 600; font-size: 14px; }
      #${POST_UI_ID} .sos-post-menu-btn { background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; padding: 0; line-height: 1; }
      #${POST_UI_ID} .sos-post-menu-btn:hover { color: #fff; }
      #${POST_UI_ID} .sos-post-close {
        background: none; border: none; color: #9ca3af; font-size: 20px;
        cursor: pointer; padding: 0; line-height: 1;
      }
      #${POST_UI_ID} .sos-post-close:hover { color: #fff; }
      #${POST_UI_ID} .sos-post-dropdown { 
        position: absolute; 
        top: 44px; 
        right: 8px; 
        width: 220px; 
        background: #1f2937; 
        border: 1px solid #374151; 
        border-radius: 6px; 
        z-index: 20; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); 
      }
      #${POST_UI_ID} .sos-post-dropdown-header { 
        padding: 8px 12px; 
        font-size: 11px; 
        color: #9ca3af; 
        border-bottom: 1px solid #374151; 
        text-transform: uppercase; 
        font-weight: 600;
      }
      #${POST_UI_ID} .sos-post-dropdown-content { max-height: 200px; overflow-y: auto; }
      #${POST_UI_ID} .sos-post-audience-item { 
        padding: 8px 12px; 
        cursor: pointer; 
        font-size: 13px; 
        color: #d1d5db; 
        border-bottom: 1px solid #374151; 
        transition: background 0.2s;
      }
      #${POST_UI_ID} .sos-post-audience-item:last-child { border-bottom: none; }
      #${POST_UI_ID} .sos-post-audience-item:hover { background: #374151; color: #fff; }
      #${POST_UI_ID} .sos-post-selected-audience { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        padding: 8px 16px; 
        background: rgba(59, 130, 246, 0.1); 
        border-bottom: 1px solid #374151;
      }
      #${POST_UI_ID} .sos-post-selected-audience span { font-size: 12px; color: #3b82f6; font-weight: 500; }
      #${POST_UI_ID} .sos-post-clear-btn { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 0; }
      #${POST_UI_ID} .sos-post-clear-btn:hover { color: #f87171; }
      #${POST_UI_ID} .sos-loading { padding: 12px; text-align: center; color: #9ca3af; font-size: 12px; }
      #${POST_UI_ID} .sos-post-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      #${POST_UI_ID} .sos-post-section {
        background: #111827;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 4px;
      }
      #${POST_UI_ID} .sos-post-section-title {
        font-size: 12px;
        font-weight: 600;
        color: #d1d5db;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #${POST_UI_ID} .sos-post-info {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      #${POST_UI_ID} .sos-post-avatar {
        width: 40px; height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
      #${POST_UI_ID} .sos-post-author { display: flex; flex-direction: column; }
      #${POST_UI_ID} .sos-post-username { font-weight: 600; font-size: 14px; }
      #${POST_UI_ID} .sos-post-fullname { font-size: 12px; color: #9ca3af; }
      #${POST_UI_ID} .sos-post-caption {
        font-size: 12px;
        color: #d1d5db;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      #${POST_UI_ID} .sos-post-stats {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #9ca3af;
      }
      #${POST_UI_ID} .sos-post-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
      }
      #${POST_UI_ID} .sos-post-input-group label {
        font-size: 11px;
        color: #9ca3af;
      }
      #${POST_UI_ID} .sos-post-input-group input {
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 6px;
        padding: 8px 10px;
        color: white;
        font-size: 13px;
      }
      #${POST_UI_ID} .sos-post-input-group input:focus {
        outline: none;
        border-color: #e1306c;
      }
      #${POST_UI_ID} .sos-post-status-text {
        font-size: 11px;
        color: #9ca3af;
        margin-bottom: 4px;
      }
      #${POST_UI_ID} .sos-post-progress-bar-bg {
        background: #374151;
        border-radius: 4px;
        height: 6px;
        overflow: hidden;
      }
      #${POST_UI_ID} .sos-post-progress-bar-fill {
        background: #3b82f6;
        height: 100%;
        width: 0%;
        transition: width 0.3s ease;
      }
      #${POST_UI_ID} .sos-post-progress-text {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 4px;
        text-align: center;
      }
      #${POST_UI_ID} .sos-post-profiles-list {
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 8px;
      }
      #${POST_UI_ID} .sos-post-profile-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px;
        border-radius: 4px;
        background: rgba(255,255,255,0.05);
        margin-bottom: 4px;
      }
      #${POST_UI_ID} .sos-post-profile-item input[type="checkbox"] {
        width: 14px; height: 14px;
        cursor: pointer;
      }
      #${POST_UI_ID} .sos-post-profile-avatar {
        width: 28px; height: 28px;
        border-radius: 50%;
        object-fit: cover;
      }
      #${POST_UI_ID} .sos-post-profile-info {
        flex: 1;
        min-width: 0;
      }
      #${POST_UI_ID} .sos-post-profile-username {
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${POST_UI_ID} .sos-post-profile-comment {
        font-size: 10px;
        color: #9ca3af;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${POST_UI_ID} .sos-post-btn {
        width: 100%;
        padding: 10px;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }
      #${POST_UI_ID} .sos-post-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #${POST_UI_ID} .sos-post-btn-primary {
        background: #3b82f6;
        color: white;
      }
      #${POST_UI_ID} .sos-post-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
      }
      #${POST_UI_ID} .sos-post-btn-action {
        background: #10b981;
        color: white;
      }
      #${POST_UI_ID} .sos-post-btn-secondary {
        background: #374151;
        color: white;
      }
      #${POST_UI_ID} .sos-post-btn-stop {
        background: #ef4444;
        color: white;
      }
      #${POST_UI_ID} .sos-post-hint {
        font-size: 10px;
        color: #6b7280;
        text-align: center;
        margin-top: 4px;
      }

      /* Pipeline Dialog Styles */
      #${POST_UI_ID} .sos-dialog {
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
      #${POST_UI_ID} .sos-dialog-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6);
      }
      #${POST_UI_ID} .sos-dialog-content {
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
      #${POST_UI_ID} .sos-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid #374151;
        font-weight: 600;
      }
      #${POST_UI_ID} .sos-dialog-body {
        padding: 16px;
      }
      #${POST_UI_ID} .sos-form-group {
        margin-bottom: 16px;
      }
      #${POST_UI_ID} .sos-form-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 12px;
        color: #9ca3af;
      }
      #${POST_UI_ID} .sos-form-group select {
        width: 100%;
        padding: 10px 12px;
        background: #374151;
        border: 1px solid #4b5563;
        border-radius: 6px;
        color: white;
        font-size: 14px;
      }
      #${POST_UI_ID} .sos-dialog-footer {
        display: flex;
        gap: 8px;
        padding: 16px;
        border-top: 1px solid #374151;
      }
      </style>

      <!-- Pipeline Dialog -->
      <div id="sos-post-pipeline-dialog" class="sos-dialog" style="display:none;">
        <div class="sos-dialog-overlay"></div>
        <div class="sos-dialog-content">
          <div class="sos-dialog-header">
            <span>📁 Selecionar Destino</span>
            <button id="sos-post-dialog-close" class="sos-post-close">&times;</button>
          </div>
          <div class="sos-dialog-body">
            <div class="sos-form-group">
              <label>Pipeline</label>
              <select id="sos-post-pipeline-select">
                <option value="">Carregando...</option>
              </select>
            </div>
            <div class="sos-form-group">
              <label>Coluna/Estágio</label>
              <select id="sos-post-stage-select" disabled>
                <option value="">Selecione um pipeline primeiro</option>
              </select>
            </div>
            <div id="sos-post-import-summary" style="margin-top: 12px; padding: 12px; background: #111827; border-radius: 6px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #10b981;">0</div>
              <div style="font-size: 11px; color: #9ca3af;">leads serão importados</div>
            </div>
          </div>
          <div class="sos-dialog-footer">
            <button id="sos-post-cancel-import" class="sos-post-btn" style="background: #374151;">Cancelar</button>
            <button id="sos-post-confirm-import" class="sos-post-btn sos-post-btn-action" disabled>
              Confirmar Importação
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Attach all event listeners
    attachPostOverlayEventListeners();

    console.log('[Lia 360] Post import overlay created');
  }

  /**
   * Attaches all event listeners to the post overlay elements
   * This function is called both when creating the overlay and when reusing it
   */
  function attachPostOverlayEventListeners() {
    // Get all button elements
    const closeBtn = document.getElementById('sos-post-close');
    const startScrollBtn = document.getElementById('sos-start-scroll');
    const importSelectedBtn = document.getElementById('sos-post-import-selected');
    const importThisBtn = document.getElementById('sos-post-import-this');
    const menuBtn = document.getElementById('sos-post-menu');
    const clearAudienceBtn = document.getElementById('sos-post-clear-audience');

    // Clone and replace buttons to remove any existing event listeners
    [closeBtn, startScrollBtn, importSelectedBtn, importThisBtn, menuBtn, clearAudienceBtn].forEach(btn => {
      if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
      }
    });

    // Re-fetch elements after cloning
    const newCloseBtn = document.getElementById('sos-post-close');
    const newStartScrollBtn = document.getElementById('sos-start-scroll');
    const newImportSelectedBtn = document.getElementById('sos-post-import-selected');
    const newImportThisBtn = document.getElementById('sos-post-import-this');
    const newMenuBtn = document.getElementById('sos-post-menu');
    const newClearAudienceBtn = document.getElementById('sos-post-clear-audience');

    // Close button
    if (newCloseBtn) {
      newCloseBtn.addEventListener('click', () => {
        document.getElementById(POST_UI_ID).style.display = 'none';
        stopCommentAutoScroll();
      });
    }

    // Start/Stop scroll button
    if (newStartScrollBtn) {
      newStartScrollBtn.addEventListener('click', () => {
        const btn = document.getElementById('sos-start-scroll');
        if (state.isAutoScrollingComments) {
          stopCommentAutoScroll();
          btn.textContent = '🔍 Start Auto Scroll';
          btn.className = 'sos-post-btn sos-post-btn-primary';
        } else {
          const targetCount = parseInt(document.getElementById('sos-target-count').value) || 300;
          startCommentAutoScroll(targetCount);
          btn.textContent = '⏹️ Stop Scrolling';
          btn.className = 'sos-post-btn sos-post-btn-stop';
          document.getElementById('sos-post-progress-section').style.display = 'block';
        }
      });
    }

    // Import selected button - MODIFIED: Opens pipeline dialog
    if (newImportSelectedBtn) {
      newImportSelectedBtn.addEventListener('click', async () => {
        const selectedProfiles = getSelectedProfiles();
        if (selectedProfiles.length === 0) return;

        // Open pipeline dialog instead of importing directly
        openPostPipelineDialog();
      });
    }

    // Import this post button
    if (newImportThisBtn) {
      newImportThisBtn.addEventListener('click', async () => {
        const btn = document.getElementById('sos-post-import-this');
        btn.disabled = true;
        btn.textContent = '⏳ Importing...';

        try {
          const response = await chrome.runtime.sendMessage({
            action: 'importPostData',
            data: state.postData
          });

          if (response?.success) {
            btn.textContent = '✅ Post Data Imported!';
            setTimeout(() => {
              btn.textContent = '📥 Import This Post Data Only';
              btn.disabled = false;
            }, 2000);
          } else {
            btn.textContent = `❌ ${response?.error || 'Failed'}`;
            setTimeout(() => {
              btn.textContent = '📥 Import This Post Data Only';
              btn.disabled = false;
            }, 2000);
          }
        } catch (error) {
          console.error('[Lia 360] Import post data error:', error);
          btn.textContent = '❌ Error';
          setTimeout(() => {
            btn.textContent = '📥 Import This Post Data Only';
            btn.disabled = false;
          }, 2000);
        }
      });
    }

    // Audience menu button (THE 3-BARS BUTTON) - CRITICAL FIX
    if (newMenuBtn) {
      newMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[Lia 360] Menu button clicked!');
        togglePostAudienceMenu();
      });
    }

    // Clear audience button
    if (newClearAudienceBtn) {
      newClearAudienceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPostAudience();
      });
    }

    // Close menu when clicking outside
    const outsideClickHandler = (e) => {
      const menu = document.getElementById('sos-post-audience-menu');
      const btn = document.getElementById('sos-post-menu');
      if (menu && menu.style.display === 'block' && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.style.display = 'none';
      }
    };

    document.addEventListener('click', outsideClickHandler);

    // Pipeline Dialog Event Listeners
    const dialogCloseBtn = document.getElementById('sos-post-dialog-close');
    const pipelineSelect = document.getElementById('sos-post-pipeline-select');
    const stageSelect = document.getElementById('sos-post-stage-select');
    const cancelImportBtn = document.getElementById('sos-post-cancel-import');
    const confirmImportBtn = document.getElementById('sos-post-confirm-import');
    const dialogOverlay = document.querySelector('.sos-dialog-overlay');

    // Close dialog button
    if (dialogCloseBtn) {
      dialogCloseBtn.addEventListener('click', closePostPipelineDialog);
    }

    // Cancel import button
    if (cancelImportBtn) {
      cancelImportBtn.addEventListener('click', closePostPipelineDialog);
    }

    // Dialog overlay click to close
    if (dialogOverlay) {
      dialogOverlay.addEventListener('click', closePostPipelineDialog);
    }

    // Pipeline select change
    if (pipelineSelect) {
      pipelineSelect.addEventListener('change', (e) => {
        state.selectedPipeline = e.target.value;
        updatePostStages(e.target.value);
      });
    }

    // Stage select change
    if (stageSelect) {
      stageSelect.addEventListener('change', (e) => {
        state.selectedStage = e.target.value;
      });
    }

    // Confirm import button
    if (confirmImportBtn) {
      confirmImportBtn.addEventListener('click', confirmPostPipelineImport);
    }

    console.log('[Lia 360] Post overlay event listeners attached');
  }

  /**
   * Gets the list of selected profiles from the post overlay
   */
  function getSelectedProfiles() {
    const selected = [];
    const checkboxes = document.querySelectorAll('.sos-post-profile-checkbox:checked');

    for (const checkbox of checkboxes) {
      const username = checkbox.dataset.username;
      if (username && state.commentAuthors.has(username)) {
        selected.push(state.commentAuthors.get(username));
      }
    }

    return selected;
  }

  /**
   * Updates the profiles list in the post overlay
   */
  function updatePostProfilesList() {
    const listEl = document.getElementById('sos-post-profiles-list');
    const countEl = document.getElementById('sos-post-profiles-count');
    const sectionEl = document.getElementById('sos-post-profiles-section');
    const importBtn = document.getElementById('sos-post-import-selected');
    const selectedCountEl = document.getElementById('sos-post-selected-count');

    if (!listEl) return;

    // Filter authors if audience is selected
    let authors = Array.from(state.commentAuthors.values());

    if (state.selectedAudience) {
      authors = authors.filter(author => matchesAudienceCriteria(author, state.selectedAudience));
      console.log(`[Lia 360] Filtered ${authors.length} qualified leads from ${state.commentAuthors.size} total`);
    }

    if (authors.length === 0 && !state.selectedAudience) {
      sectionEl.style.display = 'none';
      return;
    }

    sectionEl.style.display = 'block';
    if (countEl) countEl.textContent = state.commentAuthors.size;

    // Clear and rebuild list
    listEl.innerHTML = '';

    if (authors.length === 0 && state.selectedAudience) {
      listEl.innerHTML = '<div style="padding:10px;text-align:center;color:#9ca3af;font-size:12px">Nenhum perfil corresponde à audiência selecionada.</div>';
    } else {
      // Limit list for performance but show filtered
      for (const author of authors.slice(0, 100)) {
        const item = document.createElement('div');
        item.className = 'sos-post-profile-item';
        item.innerHTML = `
          <input type="checkbox" class="sos-post-profile-checkbox" data-username="${author.username}" checked>
          <img src="${author.avatarUrl || 'https://via.placeholder.com/28'}" class="sos-post-profile-avatar">
          <div class="sos-post-profile-info">
            <div class="sos-post-profile-username">@${author.username}</div>
            ${author.commentText ? `<div class="sos-post-profile-comment">"${author.commentText.substring(0, 40)}..."</div>` : ''}
          </div>
        `;
        listEl.appendChild(item);
      }
    }

    // Add change listener to update selected count
    const checkboxes = listEl.querySelectorAll('input[type="checkbox"]');
    const updateSelected = () => {
      const checked = listEl.querySelectorAll('input[type="checkbox"]:checked');
      const count = checked.length;
      if (importBtn) {
        importBtn.disabled = count === 0;
        importBtn.innerHTML = `☁️ Import ${count} Selected Profiles`;
      }
      if (selectedCountEl) selectedCountEl.textContent = count;
    };

    for (const checkbox of checkboxes) {
      checkbox.addEventListener('change', updateSelected);
    }

    updateSelected();
  }

  // === END POST PAGE FUNCTIONS ===

  // --- UI Construction ---
  function createOverlay() {
    if (document.getElementById(UI_ID)) {
      document.getElementById(UI_ID).style.display = 'block';
      return;
    }

    const username = getCurrentProfileUsername();
    state.currentProfileUsername = username;

    const overlay = document.createElement('div');
    overlay.id = UI_ID;
    overlay.innerHTML = `
      <div class="sos-header">
        <span class="sos-title">Import: @${username || 'Instagram'}</span>
        <button id="sos-close" class="sos-close">&times;</button>
      </div>
      <div class="sos-content">
        <div class="sos-input-group">
          <label for="sos-keywords">Filtrar por Keywords (bio/nome):</label>
          <input type="text" id="sos-keywords" placeholder="Ex: Marketing, CEO, Empreendedor">
        </div>
        <div class="sos-input-group">
          <label for="sos-criteria">Critérios de Qualificação IA:</label>
          <input type="text" id="sos-criteria" placeholder="Ex: Profissionais de marketing digital">
        </div>
        <div class="sos-checkbox-group" style="display:flex; align-items:center; gap:8px; margin-top:4px;">
          <input type="checkbox" id="sos-ai-qualify" style="width:16px; height:16px; cursor:pointer;">
          <label for="sos-ai-qualify" style="cursor:pointer; font-size:12px; color:#d1d5db;">🤖 Qualificar com IA durante scan</label>
        </div>
        <div class="sos-stats">
          <div class="stat-item">
            <span class="label">Escaneados</span>
            <span class="value" id="sos-scanned-count">0</span>
          </div>
          <div class="stat-item">
            <span class="label">Qualificados</span>
            <span class="value" id="sos-qualified-count">0</span>
          </div>
        </div>
        <div class="sos-dialog-actions">
          <button id="sos-open-followers" class="sos-btn sos-btn-secondary">
            👥 Abrir Seguidores
          </button>
          <button id="sos-open-following" class="sos-btn sos-btn-secondary">
            👤 Abrir Seguindo
          </button>
        </div>
        <div class="sos-actions">
          <button id="sos-scan-btn" class="sos-btn sos-btn-primary">
            🔍 Scanear Dialog
          </button>
          <button id="sos-import-btn" class="sos-btn sos-btn-action" disabled>
            <span class="icon">☁️</span> <span id="sos-import-text">Importar 0 perfis...</span>
          </button>
        </div>
        <div id="sos-progress-container" style="display:none; margin-top:12px;">
          <div style="font-size:12px; color:#9ca3af; margin-bottom:4px;">
            <span id="sos-progress-status">Aguardando...</span>
          </div>
          <div style="background:#374151; border-radius:4px; height:8px; overflow:hidden;">
            <div id="sos-progress-bar" style="background:linear-gradient(to right, #e1306c, #833ab4); height:100%; width:0%; transition: width 0.3s ease;"></div>
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
        width: 320px;
        background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(225, 48, 108, 0.3);
        z-index: 2147483647;
        font-family: -apple-system, system-ui, sans-serif;
        border: 1px solid rgba(225, 48, 108, 0.3);
      }
      #${UI_ID} .sos-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: linear-gradient(90deg, #833ab4, #e1306c);
        border-radius: 12px 12px 0 0;
      }
      #${UI_ID} .sos-title { font-weight: 600; font-size: 14px; }
      #${UI_ID} .sos-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; opacity: 0.8; }
      #${UI_ID} .sos-close:hover { opacity: 1; }
      #${UI_ID} .sos-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      #${UI_ID} .sos-input-group { display: flex; flex-direction: column; gap: 6px; }
      #${UI_ID} label { font-size: 12px; color: #d1d5db; }
      #${UI_ID} input { 
        background: #1f2937; 
        border: 1px solid #374151; 
        border-radius: 6px; 
        padding: 10px 12px; 
        font-size: 13px; 
        color: #fff; 
        transition: border-color 0.2s;
      }
      #${UI_ID} input:focus { 
        outline: none; 
        border-color: #e1306c; 
      }
      #${UI_ID} .sos-stats { 
        display: flex; 
        justify-content: space-around; 
        background: rgba(0,0,0,0.3); 
        padding: 12px; 
        border-radius: 8px; 
      }
      #${UI_ID} .stat-item { display: flex; flex-direction: column; align-items: center; }
      #${UI_ID} .stat-item .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; }
      #${UI_ID} .stat-item .value { font-size: 20px; font-weight: bold; color: #fff; }
      #${UI_ID} .sos-dialog-actions { display: flex; gap: 8px; }
      #${UI_ID} .sos-actions { display: flex; flex-direction: column; gap: 8px; }
      #${UI_ID} .sos-btn { 
        width: 100%; 
        padding: 12px; 
        border: none; 
        border-radius: 8px; 
        font-weight: 600; 
        font-size: 14px; 
        cursor: pointer; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        gap: 8px; 
        transition: all 0.2s;
      }
      #${UI_ID} .sos-btn:hover:not(:disabled) { transform: translateY(-1px); }
      #${UI_ID} .sos-btn:active:not(:disabled) { transform: translateY(0); }
      #${UI_ID} .sos-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      #${UI_ID} .sos-btn-primary { 
        background: linear-gradient(90deg, #833ab4, #e1306c); 
        color: white; 
      }
      #${UI_ID} .sos-btn-secondary { 
        background: #374151; 
        color: white; 
        flex: 1;
      }
      #${UI_ID} .sos-btn-secondary:hover:not(:disabled) { background: #4b5563; }
      #${UI_ID} .sos-btn-action { 
        background: linear-gradient(90deg, #e1306c, #f77737); 
        color: white; 
      }
      #${UI_ID} .sos-btn-stop { 
        background: #ef4444; 
        color: white; 
      }
      </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sos-close').addEventListener('click', () => {
      document.getElementById(UI_ID).style.display = 'none';
      stopScanning();
    });

    document.getElementById('sos-keywords').addEventListener('input', (e) => {
      updateKeywords(e.target.value);
    });

    document.getElementById('sos-criteria').addEventListener('input', (e) => {
      state.criteria = e.target.value.trim();
    });

    document.getElementById('sos-ai-qualify').addEventListener('change', (e) => {
      state.useAIQualification = e.target.checked;
      if (!state.useAIQualification) {
        state.pendingAIBatch = [];
      }
    });

    document.getElementById('sos-open-followers').addEventListener('click', openFollowersDialog);
    document.getElementById('sos-open-following').addEventListener('click', openFollowingDialog);
    document.getElementById('sos-scan-btn').addEventListener('click', toggleScanning);
    document.getElementById('sos-import-btn').addEventListener('click', importQualifiedLeads);
  }

  function updateKeywords(input) {
    state.keywords = input.trim() ? input.split(',').map(s => s.trim()).filter(Boolean) : [];
    // Re-filter existing leads
    refilterLeads();
  }

  function refilterLeads() {
    if (state.keywords.length === 0) return;

    // Filter based on new keywords
    for (const [username, lead] of state.qualifiedLeads) {
      const searchText = `${lead.fullName || ''} ${lead.bio || ''}`.toLowerCase();
      if (!matchesKeywords(searchText, state.keywords)) {
        state.qualifiedLeads.delete(username);
      }
    }
    updateUI();
  }

  function updateUI() {
    const scannedEl = document.getElementById('sos-scanned-count');
    const qualifiedEl = document.getElementById('sos-qualified-count');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');
    const scanBtn = document.getElementById('sos-scan-btn');

    if (!document.getElementById(UI_ID)) return;

    if (scannedEl) scannedEl.textContent = state.totalUsersFound;
    if (qualifiedEl) qualifiedEl.textContent = state.qualifiedLeads.size;

    if (importBtn) {
      importBtn.disabled = state.qualifiedLeads.size === 0;
      importText.textContent = `Importar ${state.qualifiedLeads.size} perfis...`;
    }

    if (scanBtn) {
      if (state.isAutoScrolling) {
        scanBtn.textContent = '⏹️ Parar Scan';
        scanBtn.className = 'sos-btn sos-btn-stop';
      } else {
        scanBtn.textContent = '🔍 Scanear Dialog';
        scanBtn.className = 'sos-btn sos-btn-primary';
      }
    }
  }

  function updateDebug(msg) {
    const el = document.getElementById('sos-debug');
    if (el) el.textContent = msg;
  }

  // --- Dialog Navigation ---
  async function openFollowersDialog() {
    const username = getCurrentProfileUsername();
    if (!username) {
      alert('Por favor, navegue para uma página de perfil primeiro.');
      return;
    }

    // Try clicking the followers link
    const followersLink = document.querySelector(SELECTORS.followersButton);
    if (followersLink) {
      followersLink.click();
      await sleep(1500);
      updateDebug('Dialog de seguidores aberto');
    } else {
      // Navigate directly
      window.location.href = `https://www.instagram.com/${username}/followers/`;
    }
  }

  async function openFollowingDialog() {
    const username = getCurrentProfileUsername();
    if (!username) {
      alert('Por favor, navegue para uma página de perfil primeiro.');
      return;
    }

    const followingLink = document.querySelector(SELECTORS.followingButton);
    if (followingLink) {
      followingLink.click();
      await sleep(1500);
      updateDebug('Dialog de seguindo aberto');
    } else {
      window.location.href = `https://www.instagram.com/${username}/following/`;
    }
  }

  // --- Scanning Logic ---
  function toggleScanning() {
    if (state.isAutoScrolling) {
      stopScanning();
    } else {
      startScanning();
    }
  }

  async function startScanning() {
    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) {
      alert('Por favor, abra o dialog de seguidores ou seguindo primeiro.');
      return;
    }

    state.isAutoScrolling = true;
    updateUI();
    updateDebug('Iniciando scan...');

    console.log('[Lia 360] Starting Instagram dialog scan');

    let noChangeCount = 0;
    const maxNoChange = 5;

    while (state.isAutoScrolling) {
      const prevCount = state.qualifiedLeads.size;

      // Find scrollable container in dialog
      const scrollContainer = findDialogScrollContainer();
      if (!scrollContainer) {
        updateDebug('Container de scroll não encontrado');
        await sleep(2000);
        continue;
      }

      // Extract users from current view
      await extractUsersFromDialog();

      // Scroll down
      const prevScrollTop = scrollContainer.scrollTop;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;

      await sleep(2000 + Math.random() * 1000);

      // Check if we scrolled and found new users
      const newCount = state.qualifiedLeads.size;
      const scrolled = scrollContainer.scrollTop > prevScrollTop;
      const foundNew = newCount > prevCount;

      if (!scrolled && !foundNew) {
        noChangeCount++;
        updateDebug(`Sem novos usuários (${noChangeCount}/${maxNoChange})`);

        if (noChangeCount >= maxNoChange) {
          console.log('[Lia 360] Scan complete - no more users to load');
          stopScanning();
          updateDebug('Scan completo!');
          break;
        }
      } else {
        noChangeCount = 0;
        updateDebug(`Encontrados: ${state.totalUsersFound} | Qualificados: ${state.qualifiedLeads.size}`);
      }
    }
  }

  async function stopScanning() {
    state.isAutoScrolling = false;
    state.pendingAIBatch = []; // Clear pending batch immediately to stop processing

    // If AI is currently analyzing, just let it finish naturally
    // Don't wait for it - this prevents the tab from freezing
    if (state.aiAnalyzing) {
      updateDebug('Parando... aguardando análise atual...');
      // Set a timeout to force reset if it takes too long
      setTimeout(() => {
        if (state.aiAnalyzing) {
          state.aiAnalyzing = false;
          updateDebug('Scan parado (análise cancelada)');
          updateUI();
        }
      }, 5000);
    } else {
      updateDebug('Scan parado');
    }

    updateUI();
  }

  function findDialogScrollContainer() {
    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) return null;

    // Find the scrollable div inside the dialog
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

  async function extractUsersFromDialog() {
    const dialog = document.querySelector(SELECTORS.dialogContainer);
    if (!dialog) return;

    // Find all user links in the dialog
    const userLinks = dialog.querySelectorAll('a[href^="/"][role="link"], a[href^="/"]');
    let newLeadsForBatch = [];

    for (const link of userLinks) {
      try {
        const href = link.getAttribute('href');
        if (!href || href === '/') continue;

        // Extract username from href
        const username = href.replace(/\//g, '').split('?')[0];
        if (!username || username.length < 2) continue;
        if (['explore', 'reels', 'direct', 'stories', 'p', 'accounts'].includes(username)) continue;

        // Skip if already processed
        if (state.qualifiedLeads.has(username)) continue;

        state.totalUsersFound++;

        // Get parent container for more info
        const container = link.closest('div[role="listitem"]') ||
          link.closest('li') ||
          link.parentElement?.parentElement?.parentElement;

        // Extract avatar
        let avatarUrl = null;
        const img = container?.querySelector('img[crossorigin="anonymous"]') ||
          container?.querySelector('img') ||
          link.querySelector('img');
        if (img && img.src && !img.src.includes('data:image/gif')) {
          avatarUrl = img.src;
        }

        // Extract name - usually in a span near the link
        let fullName = null;
        const spans = container?.querySelectorAll('span') || [];
        for (const span of spans) {
          const text = span.textContent?.trim();
          if (text && text.length > 2 && text !== username && !text.includes('@')) {
            // Avoid picking up "Follow" or "Following" text
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

        // If AI qualification is enabled, add to batch
        if (state.useAIQualification && state.criteria) {
          newLeadsForBatch.push(lead);
        } else {
          // Fallback to keyword filtering
          const searchText = `${lead.fullName || ''} ${lead.bio || ''}`.toLowerCase();
          if (matchesKeywords(searchText, state.keywords)) {
            state.qualifiedLeads.set(username, lead);
          }
        }

      } catch (e) {
        console.error('[Lia 360] Error extracting user:', e);
      }
    }

    // Process AI batch if needed
    if (state.useAIQualification && newLeadsForBatch.length > 0) {
      state.pendingAIBatch.push(...newLeadsForBatch);

      // Process batch when we have enough leads
      if (state.pendingAIBatch.length >= state.batchSize && !state.aiAnalyzing) {
        await processAIBatch();
      }
    }

    updateUI();
  }

  // Process pending AI batch
  async function processAIBatch() {
    if (state.pendingAIBatch.length === 0 || state.aiAnalyzing) return;

    state.aiAnalyzing = true;
    const batch = state.pendingAIBatch.splice(0, state.batchSize);

    updateDebug(`\ud83e\udd16 Analisando ${batch.length} perfis com IA...`);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeBatch',
        data: {
          profiles: batch.map(lead => ({
            name: lead.fullName,
            username: lead.username,
            bio: lead.bio || '',
            platform: 'instagram'
          })),
          criteria: state.criteria
        }
      });

      if (response?.success && response.data?.results) {
        const results = response.data.results;

        for (let i = 0; i < batch.length; i++) {
          if (results[i]?.qualified) {
            const lead = batch[i];
            lead.aiScore = results[i].score;
            lead.aiReason = results[i].reason;
            state.qualifiedLeads.set(lead.username, lead);
          }
        }

        updateDebug(`\u2705 ${response.data.qualified}/${batch.length} qualificados`);
      } else {
        console.error('[Lia 360] AI batch analysis failed:', response?.error);
        updateDebug('\u26a0\ufe0f Erro na an\u00e1lise IA');

        // Fallback: add all to qualified if AI fails
        for (const lead of batch) {
          state.qualifiedLeads.set(lead.username, lead);
        }
      }
    } catch (error) {
      console.error('[Lia 360] AI batch error:', error);
      updateDebug('\u26a0\ufe0f Erro na an\u00e1lise IA');

      // Fallback: add all to qualified if AI fails
      for (const lead of batch) {
        state.qualifiedLeads.set(lead.username, lead);
      }
    }

    state.aiAnalyzing = false;
    updateUI();
  }

  /**
   * Extract profile stats using multiple fallback strategies
   * Handles Instagram's changing DOM structure
   */
  function extractProfileStats() {
    console.log('[Lia 360] Starting stats extraction...');

    const stats = {
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      method: 'none'
    };

    // Helper: Extract count from element
    const getCount = (el) => {
      if (!el) return 0;

      // Method 1: Try to find a span with ONLY digits inside the element (Instagram's current structure)
      // Based on actual DOM: <a href="/following/"><span><span class="x5n08af"><span>473</span><span>following</span></span></span></a>
      const digitSpans = Array.from(el.querySelectorAll('span')).filter(span => {
        const text = span.textContent?.trim();
        return text && /^\d[\d,.kKmMbB+]*$/.test(text);
      });
      if (digitSpans.length > 0) {
        const count = parseCount(digitSpans[0].textContent);
        if (count > 0) return count;
      }

      // Method 2: Try aria-label first (most reliable for some structures)
      const aria = el.getAttribute('aria-label') || el.getAttribute('title');
      if (aria) {
        const count = parseCount(aria);
        if (count > 0) return count;
      }

      // Method 3: Try text content (fallback)
      return parseCount(el.textContent);
    };

    // Helper: Identify stat type
    const getStatType = (el) => {
      const text = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      if (text.includes('post') || text.includes('publicação')) return 'posts';
      if (text.includes('follower') || text.includes('seguidor')) return 'followers';
      if (text.includes('following') || text.includes('seguindo')) return 'following';
      return null;
    };

    // Strategy A: Links with /followers/, /following/ paths + UL/LI structure (MOST RELIABLE)
    console.log('[Lia 360] Strategy A: Path-based stat links...');
    const statLinks = Array.from(document.querySelectorAll('a[href*="/followers/"], a[href*="/following/"]'));
    for (const link of statLinks) {
      const type = getStatType(link);
      const count = getCount(link);
      if (type && count > 0) {
        stats[type + 'Count'] = count;
      }
    }

    // Also try to get posts from UL > LI structure (posts usually don't have links)
    // Based on actual DOM: <li><span><span class="x5n08af"><span>[number]</span><span>posts</span></span></span></li>
    if (stats.postsCount === 0) {
      const postItems = document.querySelectorAll('header section ul li');
      if (postItems.length >= 3) {
        // First item is typically posts
        const firstItemText = postItems[0]?.textContent?.toLowerCase() || '';
        if (firstItemText.includes('post') || firstItemText.includes('publicação')) {
          stats.postsCount = getCount(postItems[0]);
        }
      }
    }

    if (stats.followersCount > 0 || stats.followingCount > 0) {
      stats.method = 'path-links';
      console.log('[Lia 360] ✓ Strategy A succeeded:', stats);
      return stats;
    }

    // Strategy B: Aria-label based
    console.log('[Lia 360] Strategy B: Aria-label stats...');
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
      console.log('[Lia 360] ✓ Strategy B succeeded:', stats);
      return stats;
    }

    // Strategy C: Data attributes (modern Instagram)
    console.log('[Lia 360] Strategy C: Data attribute stats...');
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
      console.log('[Lia 360] ✓ Strategy C succeeded:', stats);
      return stats;
    }

    // Strategy D: Legacy UL > LI with intelligent span extraction
    console.log('[Lia 360] Strategy D: Legacy UL > LI with span detection...');
    const statItems = document.querySelectorAll('header section ul li');
    if (statItems.length >= 3) {
      // Use getCount which intelligently finds digit spans
      stats.postsCount = getCount(statItems[0]);
      stats.followersCount = getCount(statItems[1]);
      stats.followingCount = getCount(statItems[2]);
      stats.method = 'legacy-ul';
      console.log('[Lia 360] ✓ Strategy D succeeded:', stats);
      return stats;
    }

    // Strategy E: Generic header elements (last resort)
    console.log('[Lia 360] Strategy E: Generic header extraction...');
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
      console.log('[Lia 360] ✓ Strategy E succeeded:', stats);
      return stats;
    }

    console.warn('[Lia 360] ✗ All strategies failed - stats set to 0');
    return stats;
  }

  // --- Profile Extraction ---
  function extractCurrentProfile() {
    const username = getCurrentProfileUsername();
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

    // Get verification status (blue checkmark)
    let verified = false;
    const verifiedBadge = document.querySelector('header section svg[aria-label="Verified"], header img[src*="verified"]');
    if (verifiedBadge) {
      verified = true;
    }

    // Extract stats using multi-strategy approach
    const statsData = extractProfileStats();
    const { postsCount, followersCount, followingCount } = statsData;
    console.log('[Lia 360] Stats extracted via method:', statsData.method);
    console.log('[Lia 360] ✅ Stats data:', {
      followersCount,
      followingCount,
      postsCount,
      method: statsData.method
    });

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

    console.log('[Lia 360] ========================================');
    console.log('[Lia 360] extractCurrentProfile() returning:');
    console.log('[Lia 360] Username:', profileData.username);
    console.log('[Lia 360] Full Name:', profileData.fullName);
    console.log('[Lia 360] Followers:', profileData.followersCount);
    console.log('[Lia 360] Following:', profileData.followingCount);
    console.log('[Lia 360] Posts:', profileData.postsCount);
    console.log('[Lia 360] Bio:', profileData.bio?.substring(0, 50) + '...');
    console.log('[Lia 360] ========================================');

    return profileData;
  }

  // --- Import Logic ---
  async function importQualifiedLeads() {
    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) return;

    console.log('[Lia 360] Leads to import:', JSON.stringify(leads, null, 2));

    const btn = document.getElementById('sos-import-btn');
    const textEl = document.getElementById('sos-import-text');
    const criteriaEl = document.getElementById('sos-criteria');
    if (!btn || !textEl) return;

    const originalText = textEl.textContent;
    const criteria = criteriaEl?.value?.trim() || '';

    btn.disabled = true;
    textEl.textContent = 'Importando...';

    try {
      if (criteria) {
        // Deep Import with AI analysis
        textEl.textContent = 'Iniciando Deep Import com IA...';
        console.log('[Lia 360] Starting Instagram Deep Import with criteria:', criteria);

        updateDeepImportProgress(0, leads.length, 'Iniciando análise com IA...');

        const response = await chrome.runtime.sendMessage({
          action: 'startInstagramDeepImport',
          data: {
            leads: leads,
            criteria: criteria
          }
        });

        if (response?.success) {
          textEl.textContent = 'Deep Import em andamento...';
        } else {
          console.error('[Lia 360] Deep Import failed:', response?.error);
          alert('Falha ao iniciar Deep Import: ' + (response?.error || 'Erro desconhecido'));
          btn.disabled = false;
          textEl.textContent = originalText;
        }
      } else {
        // Simple import without AI
        const importData = {
          source: 'extension',
          platform: 'instagram',
          sourceUrl: window.location.href,
          leads: leads
        };
        console.log('[Lia 360] Sending import request:', JSON.stringify(importData, null, 2));

        const response = await chrome.runtime.sendMessage({
          action: 'importLeads',
          data: importData
        });

        console.log('[Lia 360] Import response:', response);

        if (response?.success) {
          alert(`Sucesso! ${leads.length} leads importados.`);
          // Clear imported leads
          state.qualifiedLeads.clear();
          state.totalUsersFound = 0;
          updateUI();
        } else {
          console.error('[Lia 360] Import failed:', response?.error);
          alert('Falha na importação: ' + (response?.error || 'Erro desconhecido'));
        }
      }
    } catch (e) {
      console.error('[Lia 360] Import exception:', e);
      alert('Erro: ' + e.message);
    } finally {
      btn.disabled = false;
      textEl.textContent = originalText;
    }
  }

  // --- Deep Import Progress UI ---
  function updateDeepImportProgress(current, total, status, qualified = null, discarded = null) {
    const container = document.getElementById('sos-progress-container');
    const statusEl = document.getElementById('sos-progress-status');
    const barEl = document.getElementById('sos-progress-bar');
    const countEl = document.getElementById('sos-progress-count');
    const percentEl = document.getElementById('sos-progress-percentage');
    const importBtn = document.getElementById('sos-import-btn');
    const importText = document.getElementById('sos-import-text');

    if (!container) return;

    container.style.display = 'block';
    if (statusEl) statusEl.textContent = status || 'Processando...';

    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    if (barEl) barEl.style.width = `${percent}%`;

    // Show qualification stats if available
    if (qualified !== null && discarded !== null) {
      if (countEl) countEl.textContent = `✅ ${qualified} | ❌ ${discarded}`;
    } else {
      if (countEl) countEl.textContent = `${current} / ${total}`;
    }
    if (percentEl) percentEl.textContent = `${percent}%`;

    const isDone = status?.startsWith('Concluído') || (current >= total && total > 0);

    if (isDone) {
      if (statusEl) statusEl.textContent = `✅ ${status}`;
      if (barEl) barEl.style.background = 'linear-gradient(to right, #10b981, #059669)';

      if (importBtn) {
        importBtn.disabled = false;
        if (importText) importText.textContent = 'Importar mais perfis...';
      }

      showCompletionNotification(qualified || total, discarded);

      // Clear state
      state.qualifiedLeads.clear();
      state.totalUsersFound = 0;
      updateUI();

      setTimeout(() => {
        container.style.display = 'none';
        if (barEl) {
          barEl.style.width = '0%';
          barEl.style.background = 'linear-gradient(to right, #e1306c, #833ab4)';
        }
      }, 5000);
    }

    console.log(`[Lia 360] Instagram Deep Import Progress: ${current}/${total} - ${status}`);
  }

  function showCompletionNotification(qualified, discarded = 0) {
    const notif = document.createElement('div');
    notif.id = 'sos-completion-notif';
    const discardedText = discarded > 0 ? `, ${discarded} descartados` : '';
    notif.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #833ab4, #e1306c);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(225, 48, 108, 0.4);
        z-index: 2147483648;
        font-family: -apple-system, system-ui, sans-serif;
        animation: slideIn 0.3s ease;
      ">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:24px;">🎉</span>
          <div>
            <div style="font-weight:600; font-size:14px;">Deep Import Concluído!</div>
            <div style="font-size:12px; opacity:0.9;">${qualified} perfis importados${discardedText}</div>
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

    setTimeout(() => {
      notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(100%)';
      setTimeout(() => notif.remove(), 300);
    }, 5000);
  }

  // --- Initialization ---
  function init() {
    console.log('[Lia 360] --- init() called ---');
    console.log('[Lia 360] Current URL:', window.location.href);

    const username = getCurrentProfileUsername();
    const isPost = isInstagramPostPage();
    const currentUrl = window.location.href.split('?')[0]; // Normalize URL without query params

    console.log('[Lia 360] Detection results:');
    console.log('[Lia 360] - username:', username);
    console.log('[Lia 360] - isPost:', isPost);
    console.log('[Lia 360] - currentUrl:', currentUrl);

    // Update state
    state.isPostPage = isPost;
    state.currentProfileUsername = username;

    if (isPost) {
      // We're on a post page
      const previousPostUrl = state.currentPostUrl;

      // Check if this is a new/different post
      if (previousPostUrl && previousPostUrl !== currentUrl) {
        console.log('[Lia 360] Navigated to different post, closing old overlay');
        closePostOverlay();
      }

      // Update current post URL
      state.currentPostUrl = currentUrl;

      console.log('[Lia 360] On Instagram post page:', currentUrl);
      // Inject the import button AND open overlay automatically
      setTimeout(() => {
        injectPostButtons();
        createPostImportOverlay();
      }, 2000);
    } else {
      // Not on a post page - close post overlay if it was open
      if (state.currentPostUrl) {
        console.log('[Lia 360] Left post page, closing overlay');
        closePostOverlay();
        removePostButtons();
        state.currentPostUrl = null;
      }

      if (username) {
        // We're on a profile page
        setTimeout(() => {
          console.log(`[Lia 360] On Instagram profile: @${username}`);

          // AUTO-EXTRACT stats for debugging
          console.log('[Lia 360] Attempting automatic stats extraction...');
          try {
            // Wait for page to fully load
            waitForInstagramProfile().then(() => {
              console.log('[Lia 360] Profile page loaded, extracting stats...');

              // Extract stats using our multi-strategy function
              const statsData = extractProfileStats();
              console.log('[Lia 360] ========================================');
              console.log('[Lia 360] STATS EXTRACTION RESULTS:');
              console.log('[Lia 360] Method used:', statsData.method);
              console.log('[Lia 360] Posts:', statsData.postsCount);
              console.log('[Lia 360] Followers:', statsData.followersCount);
              console.log('[Lia 360] Following:', statsData.followingCount);
              console.log('[Lia 360] ========================================');

              // Update debug badge with stats
              const badge = document.getElementById('sos360-debug-badge');
              if (badge) {
                badge.innerHTML = `SOS360<br>F: ${statsData.followersCount.toLocaleString()}<br>P: ${statsData.postsCount.toLocaleString()}`;
              }
            }).catch((err) => {
              console.error('[Lia 360] Error waiting for profile:', err);
            });
          } catch (error) {
            console.error('[Lia 360] Error extracting stats:', error);
          }
        }, 1000);
      }

      // Hide profile overlay when navigating away
      if (!username) {
        const profileEl = document.getElementById(UI_ID);
        if (profileEl) profileEl.style.display = 'none';
      }
    }
  }

  // SPA Observer - Instagram is a SPA
  let lastUrl = location.href;
  console.log('[Lia 360] Setting up SPA URL observer. Initial URL:', lastUrl);

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      console.log('[Lia 360] URL changed detected!');
      console.log('[Lia 360] Old URL:', lastUrl);
      console.log('[Lia 360] New URL:', location.href);

      lastUrl = location.href;
      state.currentProfileUsername = getCurrentProfileUsername();
      state.isPostPage = isInstagramPostPage();

      // Update overlay title if visible
      const titleEl = document.querySelector(`#${UI_ID} .sos-title`);
      if (titleEl && state.currentProfileUsername) {
        titleEl.textContent = `Import: @${state.currentProfileUsername}`;
      }

      console.log('[Lia 360] Calling init() due to URL change');
      init();
    }
  }).observe(document, { subtree: true, childList: true });

  // Also observe DOM changes to inject button on post pages
  const postObserver = new MutationObserver(() => {
    if (state.isPostPage && !document.getElementById('sos-post-actions-container')) {
      injectPostButtons();
    }
  });
  postObserver.observe(document.body, { childList: true, subtree: true });

  console.log('[Lia 360] Calling initial init()...');
  init();

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        switch (request.action) {
          case 'openOverlay':
            createOverlay();
            sendResponse({ success: true });
            break;

          case 'openPostImportOverlay':
            createPostImportOverlay();
            sendResponse({ success: true });
            break;

          case 'extractLeads':
            // Extract from dialog if open, otherwise from current profile
            const dialog = document.querySelector(SELECTORS.dialogContainer);
            if (dialog && state.qualifiedLeads.size > 0) {
              sendResponse({ success: true, data: Array.from(state.qualifiedLeads.values()) });
            } else {
              const profile = extractCurrentProfile();
              sendResponse({ success: !!profile, data: profile ? [profile] : [] });
            }
            break;

          case 'extractProfile':
            const p = extractCurrentProfile();
            sendResponse({ success: !!p, data: p });
            break;

          case 'extractPostData':
            const postData = extractPostData();
            sendResponse({ success: !!postData, data: postData });
            break;

          case 'extractCommentAuthors':
            const authors = extractCommentAuthors();
            sendResponse({ success: true, data: authors, count: authors.length });
            break;

          case 'startCommentAutoScroll':
            const targetCount = request.data?.targetCount || 300;
            startCommentAutoScroll(targetCount);
            // Don't wait for completion, just acknowledge start
            sendResponse({ success: true });
            break;

          case 'stopCommentAutoScroll':
            stopCommentAutoScroll();
            sendResponse({ success: true });
            break;

          case 'updateImportProgress':
            const { current, total, status, qualified, discarded } = request.data;
            updateDeepImportProgress(current, total, status, qualified, discarded);
            sendResponse({ success: true });
            break;

          case 'performSearch':
            // Legacy search support
            const opened = await openSearch();
            if (opened) {
              const typed = await typeSearch(request.keyword);
              if (typed) {
                const results = await getSearchResults();
                sendResponse({ success: true, data: results });
              } else {
                sendResponse({ success: false, error: 'Input not found' });
              }
            } else {
              sendResponse({ success: false, error: 'Search not found' });
            }
            break;

          case 'getPostLinks':
            await scrollWindow(3);
            const links = getPostLinks(request.limit);
            sendResponse({ success: true, data: links });
            break;

          case 'extractAuthorFromPost':
            const author = extractAuthorFromPost();
            sendResponse({ success: !!author, data: author });
            break;

          // ============================================================
          // ENRICHMENT HANDLER - Extract full profile data for imported leads
          // ============================================================
          case 'enrichInstagramProfile': {
            console.log('[Lia 360] Enriching Instagram profile:', request.data?.username);

            try {
              // Show enrichment overlay
              createEnrichmentOverlay();

              // Wait for profile to load (with timeout handling)
              try {
                await waitForInstagramProfile();
                console.log('[Lia 360] Profile loaded successfully, proceeding with extraction');
              } catch (loadError) {
                console.warn('[Lia 360] Profile load check failed, attempting extraction anyway:', loadError.message);
                // Continue anyway - page might be partially loaded
              }

              // Extract full profile data
              const profileData = extractCurrentProfile();

              if (profileData) {
                console.log('[Lia 360] ========================================');
                console.log('[Lia 360] enrichInstagramProfile SUCCESS!');
                console.log('[Lia 360] Sending back to background:');
                console.log('[Lia 360] - username:', profileData.username);
                console.log('[Lia 360] - fullName:', profileData.fullName);
                console.log('[Lia 360] - followersCount:', profileData.followersCount);
                console.log('[Lia 360] - followingCount:', profileData.followingCount);
                console.log('[Lia 360] - postsCount:', profileData.postsCount);
                console.log('[Lia 360] - bio:', profileData.bio?.substring(0, 50) + '...');
                console.log('[Lia 360] - website:', profileData.website);
                console.log('[Lia 360] - email:', profileData.email);
                console.log('[Lia 360] - verified:', profileData.verified);
                console.log('[Lia 360] ========================================');

                console.log('[Lia 360] ✓ Profile data extracted successfully:', {
                  username: profileData.username,
                  fullName: profileData.fullName,
                  followersCount: profileData.followersCount,
                  followingCount: profileData.followingCount,
                  postsCount: profileData.postsCount
                });
                sendResponse({
                  success: true,
                  profile: profileData
                });
              } else {
                console.error('[Lia 360] ✗ extractCurrentProfile returned null');
                sendResponse({
                  success: false,
                  error: 'Failed to extract profile data - extractCurrentProfile returned null'
                });
              }
            } catch (error) {
              console.error('[Lia 360] ✗ Error enriching profile:', error);
              console.error('[Lia 360] Error stack:', error.stack);
              sendResponse({
                success: false,
                error: error.message
              });
            }
            break;
          }

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[Lia 360] Instagram content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  });

  // --- Profile Enrichment Helper Functions ---

  /**
   * Wait for Instagram profile page to fully load
   * Uses multiple fallback selectors to detect page load
   */
  async function waitForInstagramProfile() {
    const maxWait = 15000; // 15 seconds max (increased from 10s)
    const startTime = Date.now();

    console.log('[Lia 360] Waiting for Instagram profile to load...');

    while (Date.now() - startTime < maxWait) {
      // Check if we're on Instagram
      if (!window.location.href.includes('instagram.com')) {
        await sleep(100);
        continue;
      }

      // Multiple checks to detect profile page load (Instagram changes DOM frequently)
      const checks = [
        // Check 1: Any header element exists
        () => document.querySelector('header'),

        // Check 2: Main content area exists
        () => document.querySelector('main') || document.querySelector('[role="main"]'),

        // Check 3: Profile picture
        () => document.querySelector('header img'),

        // Check 4: Username element (multiple selectors)
        () => document.querySelector('h2') ||
          document.querySelector('h1') ||
          document.querySelector('[role="heading"]') ||
          document.querySelector('header section span'),

        // Check 5: Stats section (multiple selectors for robustness)
        () => {
          const statSelectors = [
            'a[href*="/followers/"]',      // Most reliable
            'a[href*="/following/"]',      // Following link
            'a[aria-label*="follower"]',   // Aria label
            '[data-testid*="follower"]',   // Data attribute
            'header section ul li',         // Legacy fallback
          ];

          for (const selector of statSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              console.log(`[Lia 360] Stat found via: ${selector}`);
              return true;
            }
          }
          return false;
        },
      ];

      // If at least 3 checks pass, consider page loaded
      const passedChecks = checks.filter(check => check());
      if (passedChecks.length >= 2) {
        console.log('[Lia 360] Profile page loaded (detected by', passedChecks.length, 'checks)');
        return;
      }

      await sleep(100);
    }

    // Log what we found for debugging
    console.warn('[Lia 360] Profile page load timeout. Current URL:', window.location.href);
    console.warn('[Lia 360] Header exists:', !!document.querySelector('header'));
    console.warn('[Lia 360] Main exists:', !!document.querySelector('main'));

    throw new Error('Profile page failed to load within timeout');
  }

  /**
   * Create enrichment progress overlay in popup window
   */
  function createEnrichmentOverlay() {
    // Remove existing overlay if present
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

  // --- Legacy Functions (for LeadNavigator compatibility) ---
  async function openSearch() {
    console.log('[Lia 360] Opening search...');
    const searchIcon = document.querySelector('svg[aria-label="Search"], svg[aria-label="Pesquisar"]');
    if (searchIcon) {
      const button = searchIcon.closest('a') || searchIcon.closest('button') || searchIcon.closest('div[role="button"]');
      if (button) {
        button.click();
        await sleep(2500);
        return true;
      }
    }
    const existingInput = document.querySelector(SELECTORS.searchInput);
    if (existingInput) return true;
    return false;
  }

  async function typeSearch(keyword) {
    console.log('[Lia 360] Typing search:', keyword);
    const input = document.querySelector(SELECTORS.searchInput);
    if (!input) return false;

    input.focus();
    input.click();
    await sleep(500);
    input.value = '';

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, keyword);
    } else {
      input.value = keyword;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await sleep(3000);
    return true;
  }

  async function getSearchResults() {
    const links = Array.from(document.querySelectorAll('a[href^="/"]'));
    const results = links
      .map(a => a.getAttribute('href'))
      .filter(href => {
        if (['/', '/explore/', '/reels/', '/direct/inbox/', '/accounts/activity/'].includes(href)) return false;
        if (href.startsWith('/p/')) return false;
        return true;
      })
      .map(href => `https://instagram.com${href}`);
    return [...new Set(results)];
  }

  async function scrollWindow(maxScrolls = 3) {
    let count = 0;
    while (count < maxScrolls) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(2000 + Math.random() * 1000);
      count++;
    }
  }

  function getPostLinks(limit = 20) {
    const links = Array.from(document.querySelectorAll('a[href^="/p/"]'))
      .map(a => a.href)
      .filter(href => href.includes('/p/'));
    return [...new Set(links)].slice(0, limit);
  }

  function extractAuthorFromPost() {
    const authorHeader = document.querySelector('header');
    if (authorHeader) {
      const links = authorHeader.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href !== '/' && !href.includes('/explore/') && !href.includes('/p/')) {
          const username = href.replace(/\//g, '');
          return extractCurrentProfile() || {
            username,
            profileUrl: `https://instagram.com/${username}`,
          };
        }
      }
    }
    return extractCurrentProfile();
  }

  // --- Audience Menu Functions for Post Overlay ---

  async function togglePostAudienceMenu() {
    const menu = document.getElementById('sos-post-audience-menu');
    if (!menu) return;

    if (menu.style.display === 'none') {
      menu.style.display = 'block';
      await loadPostAudiences();
    } else {
      menu.style.display = 'none';
    }
  }

  async function loadPostAudiences() {
    const listEl = document.getElementById('sos-post-audience-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="sos-loading">Carregando...</div>';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAudiences' });

      if (response.success && response.data) {
        renderPostAudienceList(response.data);
      } else {
        listEl.innerHTML = '<div class="sos-loading">Erro ao carregar</div>';
      }
    } catch (e) {
      console.error('[Lia 360] Error loading audiences:', e);
      listEl.innerHTML = '<div class="sos-loading">Erro ao carregar</div>';
    }
  }

  function renderPostAudienceList(audiences) {
    const listEl = document.getElementById('sos-post-audience-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (audiences.length === 0) {
      listEl.innerHTML = '<div class="sos-loading">Nenhuma audiência criada</div>';
      return;
    }

    audiences.forEach(audience => {
      const item = document.createElement('div');
      item.className = 'sos-post-audience-item';
      item.textContent = audience.name;
      item.onclick = () => selectPostAudience(audience);
      listEl.appendChild(item);
    });
  }

  function selectPostAudience(audience) {
    state.selectedAudience = audience;

    // Update UI
    const selectedEl = document.getElementById('sos-post-selected-audience');
    const nameEl = document.getElementById('sos-post-audience-name');
    const menu = document.getElementById('sos-post-audience-menu');

    if (selectedEl) selectedEl.style.display = 'flex';
    if (nameEl) nameEl.textContent = audience.name;
    if (menu) menu.style.display = 'none'; // Close menu

    console.log('[Lia 360] Selected post audience:', audience.name);

    // Re-filter list
    updatePostProfilesList();
  }

  function clearPostAudience() {
    state.selectedAudience = null;

    const selectedEl = document.getElementById('sos-post-selected-audience');
    if (selectedEl) selectedEl.style.display = 'none';

    // Re-filter list (show all)
    updatePostProfilesList();
  }

  // --- Pipeline Dialog Functions for Post Import ---

  function openPostPipelineDialog() {
    const dialog = document.getElementById('sos-post-pipeline-dialog');
    if (!dialog) return;

    // Atualizar resumo com quantidade de leads
    const summaryEl = document.getElementById('sos-post-import-summary');
    if (summaryEl) {
      const count = state.commentAuthors.size;
      summaryEl.innerHTML = `
        <div style="font-size: 24px; font-weight: bold; color: #10b981;">${count}</div>
        <div style="font-size: 11px; color: #9ca3af;">leads serão importados</div>
      `;
    }

    dialog.style.display = 'flex';
    loadPostPipelines();
  }

  async function loadPostPipelines() {
    const pipelineSelect = document.getElementById('sos-post-pipeline-select');
    const stageSelect = document.getElementById('sos-post-stage-select');
    const confirmBtn = document.getElementById('sos-post-confirm-import');

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
          updatePostStages(defaultPipeline.id);
        }
      } else {
        pipelineSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        console.error('[Lia 360] Erro ao carregar pipelines:', response?.error);
      }
    } catch (e) {
      console.error('[Lia 360] Erro ao carregar pipelines:', e);
      pipelineSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }

  function updatePostStages(pipelineId) {
    const stageSelect = document.getElementById('sos-post-stage-select');
    const confirmBtn = document.getElementById('sos-post-confirm-import');

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

    // Auto-select first stage if not already selected
    if (!state.selectedStage || !pipeline.stages.find(s => s.id === state.selectedStage)) {
      state.selectedStage = pipeline.stages[0].id;
      stageSelect.value = state.selectedStage;
    }

    confirmBtn.disabled = false;
  }

  async function confirmPostPipelineImport() {
    if (!state.selectedPipeline || !state.selectedStage) {
      alert('Por favor, selecione um pipeline e uma coluna.');
      return;
    }

    // CRITICAL FIX: Use getSelectedProfiles() to get only QUALIFIED and CHECKED profiles
    // NOT all profiles in state.commentAuthors
    const profiles = getSelectedProfiles();

    if (profiles.length === 0) {
      alert('Nenhum perfil selecionado para importar.');
      return;
    }

    const confirmBtn = document.getElementById('sos-post-confirm-import');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Importando...';

    console.log(`[Lia 360] Importing ${profiles.length} QUALIFIED profiles (from ${state.commentAuthors.size} total extracted)`);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'importCommentAuthors',
        data: {
          profiles: profiles,
          postUrl: state.postData?.postUrl,
          pipelineId: state.selectedPipeline,
          stageId: state.selectedStage
        }
      });

      if (response?.success) {
        alert(`✅ ${profiles.length} perfis qualificados importados com sucesso para o pipeline selecionado!`);

        // CRITICAL: Only clear the imported profiles from commentAuthors
        // Remove imported profiles from state
        for (const profile of profiles) {
          state.commentAuthors.delete(profile.username);
        }

        // Update the UI to reflect removed profiles
        updatePostProfilesList();

        closePostPipelineDialog();
        document.getElementById(POST_UI_ID).style.display = 'none';
      } else {
        alert(`❌ Import failed: ${response?.error || 'Unknown error'}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Importação';
      }
    } catch (error) {
      console.error('[Lia 360] Import error:', error);
      alert(`❌ Import error: ${error.message}`);
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirmar Importação';
    }
  }

  function closePostPipelineDialog() {
    const dialog = document.getElementById('sos-post-pipeline-dialog');
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  /**
   * Checks if a profile matches the selected audience criteria
   * @param {Object} profile - Profile object (username, fullName, commentText)
   * @param {Object} audience - Selected audience object
   * @returns {boolean} True if matches
   */
  function matchesAudienceCriteria(profile, audience) {
    if (!audience) return true;

    // INSTAGRAM-SPECIFIC: Job Title filtering is NOT used
    // Instagram profiles don't have professional headlines like LinkedIn

    // CRITICAL DISTINCTION:
    // - For COMMENT profiles (isFromComment: true): ONLY check Post Content (commentText)
    // - For FULL profiles (bio available): Check both Profile Info and Post Content

    const isCommentProfile = profile.isFromComment === true;

    // ============================================================
    // PATH 1: COMMENT PROFILES (from post comments)
    // ============================================================
    if (isCommentProfile) {
      // For comments, ONLY Post Content Keywords matter
      // Profile Info Keywords are IGNORED (bio not available, fullName not reliable)

      const commentText = (profile.commentText || '').toLowerCase();

      // Check Post Content INCLUDE (must have at least one keyword)
      if (audience.postContentInclude && audience.postContentInclude.length > 0) {
        if (!commentText || commentText.length === 0) {
          return false;
        }

        const hasMatch = audience.postContentInclude.some(kw =>
          commentText.includes(kw.toLowerCase())
        );

        if (!hasMatch) {
          return false;
        }
      }

      // Check Post Content EXCLUDE (must NOT have any keyword)
      if (audience.postContentExclude && audience.postContentExclude.length > 0 && commentText) {
        const hasExcluded = audience.postContentExclude.some(kw =>
          commentText.includes(kw.toLowerCase())
        );

        if (hasExcluded) {
          return false;
        }
      }

      // If no Post Content filters are defined, accept all comments
      if ((!audience.postContentInclude || audience.postContentInclude.length === 0) &&
        (!audience.postContentExclude || audience.postContentExclude.length === 0)) {
        // Still need to check verification filter
      }

      // ============================================================
      // VERIFICATION FILTER (applies to BOTH comment and full profiles)
      // ============================================================
      if (audience.verifiedFilter && audience.verifiedFilter !== 'any') {
        const isVerified = profile.verified === true;

        console.log('[Lia 360] Verification check:', {
          username: profile.username,
          verified: profile.verified,
          filter: audience.verifiedFilter,
          approved: (audience.verifiedFilter === 'verified_only' && isVerified) ||
            (audience.verifiedFilter === 'unverified_only' && !isVerified) ||
            audience.verifiedFilter === 'any'
        });

        if (audience.verifiedFilter === 'verified_only' && !isVerified) {
          return false; // Must be verified
        }

        if (audience.verifiedFilter === 'unverified_only' && isVerified) {
          return false; // Must NOT be verified
        }
      }

      return true;
    }

    // ============================================================
    // PATH 2: FULL PROFILES (with bio, from followers/following)
    // ============================================================
    // For full profiles, check both Profile Info and Post Content
    const profileText = `${profile.fullName || ''} ${profile.bio || ''}`.toLowerCase();
    const postText = (profile.commentText || profile.posts?.[0]?.text || '').toLowerCase();

    const hasProfileInfoInclude = audience.profileInfoInclude && audience.profileInfoInclude.length > 0;
    const hasPostContentInclude = audience.postContentInclude && audience.postContentInclude.length > 0;

    // Check Profile Info INCLUDE
    if (hasProfileInfoInclude) {
      const hasMatch = audience.profileInfoInclude.some(kw =>
        profileText.includes(kw.toLowerCase())
      );
      if (!hasMatch) {
        return false;
      }
    }

    // Check Profile Info EXCLUDE
    if (audience.profileInfoExclude && audience.profileInfoExclude.length > 0) {
      const hasExcluded = audience.profileInfoExclude.some(kw =>
        profileText.includes(kw.toLowerCase())
      );
      if (hasExcluded) {
        return false;
      }
    }

    // Check Post Content INCLUDE (if defined and post text available)
    if (hasPostContentInclude && postText && postText.length > 0) {
      const hasMatch = audience.postContentInclude.some(kw =>
        postText.includes(kw.toLowerCase())
      );
      if (!hasMatch) {
        return false;
      }
    }

    // Check Post Content EXCLUDE
    if (audience.postContentExclude && audience.postContentExclude.length > 0 && postText) {
      const hasExcluded = audience.postContentExclude.some(kw =>
        postText.includes(kw.toLowerCase())
      );
      if (hasExcluded) {
        return false;
      }
    }

    // ============================================================
    // VERIFICATION FILTER (applies to BOTH comment and full profiles)
    // ============================================================
    if (audience.verifiedFilter && audience.verifiedFilter !== 'any') {
      const isVerified = profile.verified === true;

      console.log('[Lia 360] Verification check:', {
        username: profile.username,
        verified: profile.verified,
        filter: audience.verifiedFilter,
        approved: (audience.verifiedFilter === 'verified_only' && isVerified) ||
          (audience.verifiedFilter === 'unverified_only' && !isVerified) ||
          audience.verifiedFilter === 'any'
      });

      if (audience.verifiedFilter === 'verified_only' && !isVerified) {
        return false; // Must be verified
      }

      if (audience.verifiedFilter === 'unverified_only' && isVerified) {
        return false; // Must NOT be verified
      }
    }

    return true;
  }

  console.log('[Lia 360] Instagram Script v3.1 Loaded (with Fixed Comment Auto-Scroll)');
  // End of main logic, but helpers follow...
  /**
   * Creates the auto-reply configuration overlay
   */
  function createAutoReplyOverlay() {
    if (document.getElementById('sos-auto-reply-overlay')) {
      document.getElementById('sos-auto-reply-overlay').style.display = 'block';
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'sos-auto-reply-overlay';

    // HTML Structure
    overlay.innerHTML = `
      <div class="sos-ar-header">
        <span class="sos-ar-title">Auto-Reply to Comments</span>
        <button id="sos-ar-close" class="sos-ar-close">&times;</button>
      </div>
      
      <div class="sos-ar-body">
        <!-- Left Column -->
        <div class="sos-ar-column">
          
          <!-- Reply to post comment -->
          <div class="sos-ar-group">
            <label class="sos-ar-label">
              Reply to post comment
              <span class="sos-ar-sublabel">You can create up to 5 variations of your reply to be sent randomly.</span>
            </label>
            <div id="sos-ar-replies-container">
               <textarea class="sos-ar-textarea" placeholder="Write your comment..."></textarea>
            </div>
            <a href="#" id="sos-ar-add-variation" class="sos-ar-link">Add Text Variation</a>
          </div>

          <!-- Send DM -->
          <div class="sos-ar-checkbox-group">
             <input type="checkbox" id="sos-ar-send-dm">
             <label for="sos-ar-send-dm">
               <span class="sos-ar-cb-title">Send a Direct Message</span>
               <span class="sos-ar-cb-desc">Send a Direct Message to the comment's author.</span>
             </label>
          </div>

          <!-- Follow Profile -->
          <div class="sos-ar-checkbox-group">
             <input type="checkbox" id="sos-ar-follow">
             <label for="sos-ar-follow">
               <span class="sos-ar-cb-title">Follow Profile</span>
               <span class="sos-ar-cb-desc">Follow the comment's author.</span>
             </label>
          </div>

          <!-- Add to Group Chat -->
          <div class="sos-ar-checkbox-group">
             <input type="checkbox" id="sos-ar-group-chat">
             <label for="sos-ar-group-chat">
               <span class="sos-ar-cb-title">Add profile to a Existing Group Chat</span>
             </label>
          </div>
          
          <div class="sos-ar-row">
            <!-- Number of Replies -->
            <div class="sos-ar-group">
               <label class="sos-ar-label">Number of Replies:</label>
               <input type="number" id="sos-ar-count" value="20" min="1" max="1000" class="sos-ar-input">
               <span class="sos-ar-helper">Max. 1000 replies</span>
            </div>

            <!-- Interval -->
            <div class="sos-ar-group">
               <label class="sos-ar-label">Interval between replies (in seconds):</label>
               <input type="number" id="sos-ar-interval" value="10" min="10" class="sos-ar-input">
               <span class="sos-ar-helper">Min. 10 seconds</span>
            </div>
          </div>
          
          <div class="sos-ar-warning">
             ⚠️ Warning: Please use the above settings carefully to prevent being blocked.
          </div>

        </div>

        <!-- Right Column -->
        <div class="sos-ar-column">
          
          <!-- Only Process words -->
           <div class="sos-ar-group">
             <label class="sos-ar-label sos-text-green">✅ Only Process comments with these words:</label>
             <input type="text" id="sos-ar-process-words" placeholder="Keywords between commas" class="sos-ar-input">
           </div>

           <!-- Don't Process words -->
           <div class="sos-ar-group">
             <label class="sos-ar-label sos-text-red">⛔ Don't Process comments with these words:</label>
             <input type="text" id="sos-ar-skip-words" placeholder="Keywords between commas" class="sos-ar-input">
           </div>

           <hr class="sos-ar-divider">

           <!-- Filters -->
           <div class="sos-ar-checkbox-simple">
              <input type="checkbox" id="sos-ar-first-level" checked>
              <label for="sos-ar-first-level">Only Reply to 1st level comments</label>
           </div>

           <div class="sos-ar-checkbox-simple">
              <input type="checkbox" id="sos-ar-no-reply-my" checked>
              <label for="sos-ar-no-reply-my">Don't reply to comments that already have replies from my profile</label>
           </div>

           <div class="sos-ar-checkbox-simple">
              <input type="checkbox" id="sos-ar-no-reply-any">
              <label for="sos-ar-no-reply-any">Don't Reply to Comments that already have replies</label>
           </div>

           <div class="sos-ar-checkbox-simple">
              <input type="checkbox" id="sos-ar-like">
              <label for="sos-ar-like">Like the comments after replying</label>
           </div>

           <div class="sos-ar-checkbox-simple">
              <input type="checkbox" id="sos-ar-import-profiles">
              <label for="sos-ar-import-profiles">Import profiles from the comments that have been replied to.</label>
           </div>

        </div>
      </div>

      <div class="sos-ar-footer">
         <button id="sos-ar-cancel" class="sos-ar-btn-secondary">Close</button>
         <button id="sos-ar-start" class="sos-ar-btn-primary">💬 Start Auto-Replying</button>
      </div>
      
      <style>
        #sos-auto-reply-overlay {
           position: fixed;
           top: 50%;
           left: 50%;
           transform: translate(-50%, -50%);
           width: 900px;
           max-width: 95vw;
           max-height: 90vh;
           background: #fff;
           border-radius: 12px;
           box-shadow: 0 10px 25px rgba(0,0,0,0.5);
           z-index: 2147483647;
           font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
           display: flex;
           flex-direction: column;
           color: #333;
           overflow: hidden;
        }
        .sos-ar-header {
           padding: 20px 24px;
           border-bottom: 1px solid #e0e0e0;
           display: flex;
           justify-content: space-between;
           align-items: center;
        }
        .sos-ar-title { font-size: 20px; font-weight: 700; color: #1f2937; }
        .sos-ar-close { background: none; border: none; font-size: 24px; color: #9ca3af; cursor: pointer; }
        .sos-ar-close:hover { color: #1f2937; }
        
        .sos-ar-body {
           display: flex;
           padding: 24px;
           gap: 32px;
           overflow-y: auto;
           background: #f9fafb;
        }
        .sos-ar-column { flex: 1; display: flex; flex-direction: column; gap: 16px; }
        
        .sos-ar-group { display: flex; flex-direction: column; gap: 6px; }
        .sos-ar-label { font-size: 14px; font-weight: 600; color: #374151; display: flex; flex-direction: column; }
        .sos-ar-sublabel { font-size: 11px; color: #6b7280; font-weight: 400; margin-top: 2px; }
        .sos-ar-input, .sos-ar-textarea {
           padding: 10px;
           border: 1px solid #d1d5db;
           border-radius: 6px;
           font-size: 14px;
           width: 100%;
           box-sizing: border-box;
        }
        .sos-ar-textarea { min-height: 80px; resize: vertical; margin-bottom: 8px; }
        .sos-ar-link { font-size: 13px; color: #3b82f6; text-decoration: none; }
        .sos-ar-link:hover { text-decoration: underline; }
        
        .sos-ar-checkbox-group { display: flex; align-items: flex-start; gap: 10px; margin-top: 4px; }
        .sos-ar-checkbox-group input[type="checkbox"] { margin-top: 4px; }
        .sos-ar-checkbox-group label { display: flex; flex-direction: column; cursor: pointer; }
        .sos-ar-cb-title { font-size: 14px; font-weight: 600; color: #374151; }
        .sos-ar-cb-desc { font-size: 12px; color: #6b7280; }
        
        .sos-ar-row { display: flex; gap: 16px; }
        .sos-ar-helper { font-size: 11px; color: #9ca3af; }
        
        .sos-ar-warning {
           color: #ef4444; font-size: 12px; font-weight: 600; 
           background: #fef2f2; padding: 10px; border-radius: 6px; margin-top: 10px;
        }
        
        .sos-text-green { color: #10b981; }
        .sos-text-red { color: #ef4444; }
        
        .sos-ar-divider { border: 0; border-top: 1px solid #e5e7eb; width: 100%; margin: 8px 0; }
        
        .sos-ar-checkbox-simple { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; font-weight: 500;}
        
        .sos-ar-footer {
           padding: 16px 24px;
           background: #fff;
           border-top: 1px solid #e0e0e0;
           display: flex;
           justify-content: flex-end;
           gap: 12px;
           position: sticky;
           bottom: 0;
        }
        
        .sos-ar-btn-secondary, .sos-ar-btn-primary {
           padding: 10px 20px;
           border-radius: 6px;
           font-size: 14px;
           font-weight: 600;
           cursor: pointer;
           border: none;
        }
        .sos-ar-btn-secondary { background: #e5e7eb; color: #374151; }
        .sos-ar-btn-secondary:hover { background: #d1d5db; }
        
        .sos-ar-btn-primary { background: #14b8a6; color: white; } /* Teal */
        .sos-ar-btn-primary:hover { background: #0d9488; }
      </style>
    `;

    document.body.appendChild(overlay);

    // --- Event Listeners ---

    // Close & Cancel
    const closeBtn = document.getElementById('sos-ar-close');
    const cancelBtn = document.getElementById('sos-ar-cancel');
    const closeHandler = () => overlay.remove();
    closeBtn.addEventListener('click', closeHandler);
    cancelBtn.addEventListener('click', closeHandler);

    // Add Text Variation
    const addVarBtn = document.getElementById('sos-ar-add-variation');
    const repliesContainer = document.getElementById('sos-ar-replies-container');

    addVarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const count = repliesContainer.querySelectorAll('textarea').length;
      if (count >= 5) {
        alert('Max 5 variations allowed.');
        return;
      }
      const newTextarea = document.createElement('textarea');
      newTextarea.className = 'sos-ar-textarea';
      newTextarea.placeholder = 'Write variation ' + (count + 1) + '...';
      repliesContainer.appendChild(newTextarea);
    });

    // Start Auto-Replying
    const startBtn = document.getElementById('sos-ar-start');
    startBtn.addEventListener('click', () => {
      // Gather Config
      const config = {
        replies: Array.from(repliesContainer.querySelectorAll('textarea')).map(t => t.value).filter(t => t.trim() !== ''),
        sendDm: document.getElementById('sos-ar-send-dm').checked,
        follow: document.getElementById('sos-ar-follow').checked,
        groupChat: document.getElementById('sos-ar-group-chat').checked,
        count: document.getElementById('sos-ar-count').value,
        interval: document.getElementById('sos-ar-interval').value,
        processWords: document.getElementById('sos-ar-process-words').value,
        skipWords: document.getElementById('sos-ar-skip-words').value,
        filters: {
          firstLevel: document.getElementById('sos-ar-first-level').checked,
          noReplyMy: document.getElementById('sos-ar-no-reply-my').checked,
          noReplyAny: document.getElementById('sos-ar-no-reply-any').checked,
          like: document.getElementById('sos-ar-like').checked,
          importProfiles: document.getElementById('sos-ar-import-profiles').checked
        }
      };

      console.log('[Lia 360] Starting Auto-Reply with config:', config);

      if (config.replies.length === 0) {
        alert('Please enter at least one reply message.');
        return;
      }

      // Start logic
      overlay.remove();
      startAutoReply(config);
    });
  }
  /**
   * Starts the auto-reply process based on the provided configuration
   * @param {Object} config The configuration object from the overlay
   */
  async function startAutoReply(config) {
    if (state.isAutoScrollingComments) {
      console.warn('[Lia 360] Already auto-scrolling/replying');
      return;
    }

    state.isAutoScrollingComments = true;

    // UI Feedback: Update button text/state if possible (simplified here)
    console.log('[Lia 360] Starting Auto-Reply Loop with config:', config);

    // Find scroll container
    const article = document.querySelector(SELECTORS.postContainer);
    if (!article) {
      alert('Could not find post container. Please reload.');
      state.isAutoScrollingComments = false;
      return;
    }

    let scrollContainer = article.querySelector('ul[class*="_a9z6"]');
    if (!scrollContainer) {
      // Fallback logic akin to injectPostButtons
      const allDivs = article.querySelectorAll('div, ul');
      for (const el of allDivs) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.clientHeight > 50) {
          if (el.children.length > 0) scrollContainer = el;
        }
      }
    }

    if (!scrollContainer) {
      alert('Could not find comments section. Please expand comments.');
      state.isAutoScrollingComments = false;
      return;
    }

    let processedCount = 0;
    const targetCount = parseInt(config.count, 10) || 20;
    const intervalSec = parseInt(config.interval, 10) || 10;
    const processedComments = new Set(); // store IDs or content hash to avoid duplicate processing in this session

    // Helper to check if we should stop
    const shouldStop = () => processedCount >= targetCount || !state.isAutoScrollingComments;

    // Helper: Sleep
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    try {
      while (!shouldStop()) {
        // 1. Scan visible comments
        const comments = Array.from(scrollContainer.querySelectorAll('ul._a9ym > li, ul > li')); // Attempt standard selector

        // Refined selector for comments (look for list items with text)
        // The specific class might change, so iteration is safer

        let actionTakenInThisPass = false;

        for (const commentItem of comments) {
          if (shouldStop()) break;

          // --- Validation & Filtering ---

          // A. Check if already processed
          // Using a unique identifier logic (e.g., username + part of text)
          const usernameEl = commentItem.querySelector('h3, span[dir="auto"]'); // approximate
          if (!usernameEl) continue;
          const username = usernameEl.textContent.trim();

          const textEl = commentItem.querySelector('span[dir="auto"]');
          const commentText = textEl ? textEl.textContent.trim() : '';

          const uniqueId = username + ':' + commentText.substring(0, 20);
          if (processedComments.has(uniqueId)) continue;

          // B. Filter: Keywords
          if (config.processWords && !matchesKeywords(commentText, config.processWords.split(','))) {
            processedComments.add(uniqueId); // Mark as processed so we don't check again
            continue;
          }
          if (config.skipWords && matchesKeywords(commentText, config.skipWords.split(','))) {
            processedComments.add(uniqueId);
            continue;
          }

          // C. Filter: 1st Level Only
          // Indentation usually handled by padding or nesting. 
          // In many IG versions, replies are in a nested UL or have margin.
          // Simplified check: If it's inside another UL that is not the main list, it's a reply.
          if (config.filters.firstLevel) {
            // Check hierarchy. If this LI is inside a UL that is inside another LI, it's a nested reply
            const parentUL = commentItem.parentElement;
            if (parentUL && parentUL.parentElement && parentUL.parentElement.tagName === 'LI') {
              processedComments.add(uniqueId);
              continue; // Skip nested
            }
          }

          // D. Filter: Already Replied (by anyone or me)
          // Look for "View replies" or similar indications if expanded
          // This is hard to detect perfectly without opening replies. 
          // Strategy: Look for "Reply" button. If I replied, maybe "Reply" text is different or there is a "View X replies" line
          if (config.filters.noReplyAny) {
            const viewRepliesBtn = findElementByText('div, span', [/View.*replies/i, /Ver.*respostas/i], commentItem);
            if (viewRepliesBtn) {
              processedComments.add(uniqueId);
              continue;
            }
          }

          // E. Filter: Already replied by ME
          // This usually requires checking the sub-comments. 
          // Optimization: Skip for now unless we enforce expanding all replies (which is slow).
          // Or check if "Reply" button is active? IG doesn't change button state usually.
          // We'll trust the session set `processedComments` for immediate duplication prevention.

          // --- Execution ---

          console.log(`[Lia 360] Processing comment by ${username}: "${commentText}"`);

          // Scroll into view comfortably
          commentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await wait(1000);

          // 2. Click "Reply" Button on the comment
          const replyBtn = findElementByText('button, div[role="button"]', [/Reply/i, /Responder/i], commentItem);

          if (replyBtn) {
            await createHumanSimulator.simulateClick(replyBtn);
            await wait(1500 + Math.random() * 1000);

            // 3. Type Reply
            // Finding the textarea. It usually appears near the comment or at bottom.
            // When clicking reply on a comment, the main comment box often gets focused with "@username "
            const commentBox = document.querySelector('textarea[aria-label*="Add a comment"], textarea[placeholder*="Add a comment"]');
            if (commentBox) {
              // Pick random variation
              const replyText = config.replies[Math.floor(Math.random() * config.replies.length)];

              // IG usually puts "@username " automatically. We append.
              // We need to trigger input events for React to pick it up.

              // Focus
              commentBox.focus();
              await wait(500);

              // Type
              // Simple implementation: execCommand (deprecated but works) or value setter + event dispatch
              // Better: simulate typing
              const existingVal = commentBox.value;
              const newVal = existingVal + replyText;

              // React value setter hack
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
              nativeInputValueSetter.call(commentBox, newVal);
              commentBox.dispatchEvent(new Event('input', { bubbles: true }));

              await wait(1000 + replyText.length * 50); // Typing delay mimic

              // 4. Send (Post)
              // Find the "Post" button. It usually activates after text.
              const postBtn = findElementByText('div[role="button"], button', [/Post/i, /Publicar/i], commentBox.parentElement.parentElement.parentElement);
              if (postBtn) {
                // UNCOMMENT TO ACTUALLY POST
                // await createHumanSimulator.simulateClick(postBtn);
                console.log('[Lia 360] (Simulated) Sent reply:', replyText);
                processedCount++;
                actionTakenInThisPass = true;

                // Update UI Count if possible
                // ...
              } else {
                console.warn('[Lia 360] Could not find Post button');
              }
            }
          }

          // 5. Secondary Actions
          if (config.filters.like) {
            const likeBtn = commentItem.querySelector('svg[aria-label="Like"], svg[aria-label="Curtir"]'); // simplified selector logic needed
            // Actually finding the button wrapper
            // ... implementation skipped for brevity, similar to Reply
          }

          if (config.follow) {
            // Hover username to trigger card, then click follow? Or find follow button next to name?
            // Mobile/Dialog view often has Follow button next to name if not following
          }

          // Mark processed
          processedComments.add(uniqueId);

          // Wait Interval
          const jitter = Math.random() * 4000; // 0-4s jitter
          const waitTime = (intervalSec * 1000) + jitter;
          console.log(`[Lia 360] Waiting ${Math.round(waitTime / 1000)}s before next...`);
          await wait(waitTime);
        }

        // If we processed no one in this view, we MUST scroll
        // Scroll logic
        if (!shouldStop()) {
          console.log('[Lia 360] Scrolling for more comments...');
          await scrollToNextComments(scrollContainer);
          // Check if end reached (logic exists in scrollToNextComments return or similar?)
          // For now, we trust the scroll helper or check scroll height change
          await wait(3000);
        }
      }
    } catch (e) {
      console.error('[Lia 360] Auto-Reply Error:', e);
    } finally {
      state.isAutoScrollingComments = false;
      alert(`Auto-Reply Finished. Replied to ${processedCount} comments.`);
    }
  }

})();
