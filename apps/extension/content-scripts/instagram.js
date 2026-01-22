// Instagram content script - SOS 360
// Version 3 - With Post Import Support

(function () {
  'use strict';

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

          console.log('[SOS 360] Simulated realistic click at', { x: Math.round(x), y: Math.round(y) });
          return true;
        } catch (error) {
          console.error('[SOS 360] Error simulating click:', error);
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

          console.log('[SOS 360] Simulated wheel scroll:', { steps, totalDistance: distance });
          return true;
        } catch (error) {
          console.error('[SOS 360] Error simulating wheel scroll:', error);
          return false;
        }
      }
    };
  }

  function getTextContent(element) {
    return element?.textContent?.trim() || null;
  }

  function parseCount(text) {
    if (!text) return 0;
    const clean = text.toLowerCase().replace(/,/g, '').replace(/\./g, '');
    if (clean.includes('k')) return parseFloat(clean) * 1000;
    if (clean.includes('m')) return parseFloat(clean) * 1000000;
    if (clean.includes('mi')) return parseFloat(clean) * 1000000; // Portuguese
    if (clean.includes('mil')) return parseFloat(clean) * 1000; // Portuguese
    return parseInt(clean.replace(/\D/g, ''), 10) || 0;
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

      console.log('[SOS 360] Post data extracted:', postData);
      state.postData = postData;
      return postData;

    } catch (error) {
      console.error('[SOS 360] Error extracting post data:', error);
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
        const commentText = commentTextEl ? getTextContent(commentTextEl) : '';

        // Get parent container for more context
        const container = authorLink.closest('div, li');

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
          commentText: commentText.substring(0, 500), // Limit length
          followersCount: null, // Not visible in comments
        };

        commentAuthors.push(authorData);
        state.commentAuthors.set(username, authorData);

      } catch (error) {
        console.error('[SOS 360] Error extracting comment author:', error);
      }
    }

    console.log(`[SOS 360] Extracted ${commentAuthors.length} comment authors`);
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
        console.log('[SOS 360] Clicking comment button via SVG');
        btn.click();
        await sleep(2000);
        return;
      }
    }

    // Strategy 2: Find link to /comments/
    const commentsLink = document.querySelector('a[href*="/comments/"]');
    if (commentsLink) {
      console.log('[SOS 360] Clicking comments link');
      commentsLink.click();
      await sleep(2000);
      return;
    }

    // Strategy 3: Look for text "View all X comments"
    const viewAllBtn = findElementByText('span', ['view all', 'ver todos', 'comments', 'comentários']);
    if (viewAllBtn) {
      const clickable = viewAllBtn.closest('button, div[role="button"], a') || viewAllBtn;
      console.log('[SOS 360] Clicking view all comments');
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
        console.log('[SOS 360] Found UL comment container by class');
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
        console.log(`[SOS 360] Found UL comment container with ${commentLinks.length} profile links`);
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
        console.log(`[SOS 360] Found UL container with ${commentLinks.length} links (fallback)`);
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
        console.log(`[SOS 360] Found DIV comment container with ${commentLinks.length} links`);
        return div;
      }
    }

    console.log('[SOS 360] No comment scroll container found in dialog');
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
          console.log('[SOS 360] Found load more button via SVG:', selector);
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
        console.log('[SOS 360] Found load more button via text:', text.substring(0, 30));
        return btn;
      }
    }

    // Strategy 3: Also check "View more comments" button (existing helper)
    const viewMoreBtn = findViewMoreCommentsButton();
    if (viewMoreBtn) {
      console.log('[SOS 360] Found view more comments button');
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
          console.log('[SOS 360] Found potential expand button');
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
      console.log('[SOS 360] Attempting to click load more button');
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
      console.log('[SOS 360] Already scrolling comments');
      return;
    }

    state.isAutoScrollingComments = true;
    state.targetProfileCount = targetCount;
    state.profilesScanned = 0;

    console.log(`[SOS 360] Starting comment auto-scroll, target: ${targetCount}`);

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
      console.log('[SOS 360] Scroll iteration:', {
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

      // PRIORITY 1: Try clicking "Load more comments" button using realistic simulation
      const loadedMore = await clickLoadMoreComments(simulator);

      let scrolled = false;
      let prevScrollTop = 0;

      if (loadedMore) {
        // Button was clicked, extract new comments that appeared
        console.log('[SOS 360] Load more button clicked via simulation, extracting new comments');
        await sleep(simulator.getHumanDelay(400, 800)); // Small extra delay for DOM update
        extractCommentAuthors();
      } else if (scrollContainer) {
        // PRIORITY 2: Use WheelEvent simulation for scrolling (more realistic)
        prevScrollTop = scrollContainer.scrollTop;

        // Calculate scroll amount with variation
        const scrollAmount = baseScrollAmount + Math.random() * 200;

        // Try WheelEvent simulation first
        const wheelScrolled = await simulator.simulateWheelScroll(scrollContainer, scrollAmount);

        // Wait for scroll animation
        await sleep(simulator.getHumanDelay(300, 600));

        // Check if scroll happened
        let newScrollTop = scrollContainer.scrollTop;

        // Fallback: if WheelEvent didn't work, try scrollBy
        if (newScrollTop === prevScrollTop) {
          console.log('[SOS 360] WheelEvent scroll did not work, trying scrollBy fallback');
          scrollContainer.scrollBy({
            top: scrollAmount,
            behavior: 'smooth'
          });
          await sleep(simulator.getHumanDelay(300, 500));
          newScrollTop = scrollContainer.scrollTop;
        }

        // Final fallback: direct scrollTop manipulation
        if (newScrollTop === prevScrollTop) {
          console.log('[SOS 360] scrollBy did not work, trying direct scrollTop');
          scrollContainer.scrollTop = prevScrollTop + scrollAmount;
          await sleep(200);
          newScrollTop = scrollContainer.scrollTop;
        }

        scrolled = newScrollTop > prevScrollTop;

        // If we've scrolled to the bottom, try scrolling to max
        if (!scrolled && scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight - 10) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
          await sleep(300);
          scrolled = scrollContainer.scrollTop > prevScrollTop;
        }
      } else {
        // No container found - log warning and try window scroll as last resort
        console.log('[SOS 360] Warning: No scroll container found, trying window scroll');
        prevScrollTop = window.scrollY;
        window.scrollBy(0, baseScrollAmount);
        await sleep(300);
        scrolled = window.scrollY > prevScrollTop;
      }

      // Wait for content to load with humanized delay
      await sleep(simulator.getHumanDelay(1000, 2000));

      // Extract any new comments after scrolling
      extractCommentAuthors();

      // Check if we made progress
      const newCount = state.commentAuthors.size;
      const foundNew = newCount > prevCount;

      state.profilesScanned = newCount;

      if (!scrolled && !foundNew && !loadedMore) {
        noChangeCount++;
        console.log(`[SOS 360] No progress, attempt ${noChangeCount}/${maxNoChange}`);

        // Update UI to reflect waiting state
        updatePostScrollStatus(
          `Waiting for more comments... (attempt ${noChangeCount}/${maxNoChange})`,
          Math.min(100, Math.round((newCount / targetCount) * 100))
        );

        if (noChangeCount >= maxNoChange) {
          console.log('[SOS 360] Comment auto-scroll complete - no more content');
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
        console.log(`[SOS 360] Target reached: ${state.commentAuthors.size}`);
        break;
      }
    }

    state.isAutoScrollingComments = false;
    updatePostScrollStatus(
      `Complete! ${state.commentAuthors.size} profiles found`,
      100
    );

    console.log(`[SOS 360] Comment extraction complete: ${state.commentAuthors.size} profiles`);
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
  function injectImportPostButton() {
    // Don't inject if already exists
    if (document.getElementById('sos-import-post-btn')) return;

    // Find the action bar (like, comment, share buttons area)
    const article = document.querySelector(SELECTORS.postContainer);
    if (!article) return;

    // Try multiple approaches to find the action bar
    let actionBar = article.querySelector('section:last-of-type') ||
      article.querySelector('section:last-child') ||
      article.querySelectorAll('section')[1];

    if (!actionBar) return;

    const button = document.createElement('button');
    button.id = 'sos-import-post-btn';
    button.innerHTML = '📥 Import Post';
    button.style.cssText = `
      background: linear-gradient(90deg, #833ab4, #e1306c);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      margin-left: 8px;
      transition: transform 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', async () => {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = '⏳ Importing...';

      try {
        const postData = extractPostData();
        if (!postData) {
          button.textContent = '❌ Error';
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 2000);
          return;
        }

        const response = await chrome.runtime.sendMessage({
          action: 'importPostData',
          data: postData
        });

        if (response?.success) {
          button.textContent = '✅ Imported!';
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 2000);
        } else {
          button.textContent = '❌ Failed';
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 2000);
        }
      } catch (error) {
        console.error('[SOS 360] Import post error:', error);
        button.textContent = '❌ Error';
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      }
    });

    actionBar.appendChild(button);
    console.log('[SOS 360] Import Post button injected');
  }

  /**
   * Removes the injected import button
   */
  function removeImportPostButton() {
    const button = document.getElementById('sos-import-post-btn');
    if (button) {
      button.remove();
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

    console.log('[SOS 360] Post overlay closed and state reset');
  }

  /**
   * Creates the post import overlay UI
   */
  function createPostImportOverlay() {
    if (document.getElementById(POST_UI_ID)) {
      document.getElementById(POST_UI_ID).style.display = 'block';
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
        <!-- Post Info Section -->
        <div class="sos-post-section">
          <div class="sos-post-section-title">Post Info</div>
          <div class="sos-post-info">
            <img src="${postData.authorAvatarUrl || 'https://via.placeholder.com/40'}" class="sos-post-avatar">
            <div class="sos-post-author">
              <div class="sos-post-username">@${postData.authorUsername || 'unknown'}</div>
              <div class="sos-post-fullname">${postData.authorFullName || ''}</div>
            </div>
          </div>
          ${postData.caption ? `<div class="sos-post-caption">${postData.caption.substring(0, 100)}${postData.caption.length > 100 ? '...' : ''}</div>` : ''}
          <div class="sos-post-stats">
            <span>❤️ ${postData.likesCount || 0}</span>
            <span>💬 ${postData.commentsCount || 0}</span>
          </div>
        </div>

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

        <!-- Import This Post Button -->
        <div class="sos-post-section">
          <button id="sos-post-import-this" class="sos-post-btn sos-post-btn-secondary">
            📥 Import This Post Data Only
          </button>
          <div class="sos-post-hint">
            Import post data (caption, image, likes) to existing lead
          </div>
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
      </style>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('sos-post-close').addEventListener('click', () => {
      document.getElementById(POST_UI_ID).style.display = 'none';
      stopCommentAutoScroll();
    });

    document.getElementById('sos-start-scroll').addEventListener('click', () => {
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

    document.getElementById('sos-post-import-selected').addEventListener('click', async () => {
      const selectedProfiles = getSelectedProfiles();
      if (selectedProfiles.length === 0) return;

      const btn = document.getElementById('sos-post-import-selected');
      btn.disabled = true;
      btn.textContent = `⏳ Importing ${selectedProfiles.length} profiles...`;

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'importCommentAuthors',
          data: {
            profiles: selectedProfiles,
            postUrl: postData.postUrl
          }
        });

        if (response?.success) {
          alert(`✅ ${selectedProfiles.length} profiles imported successfully!`);
          state.commentAuthors.clear();
          document.getElementById(POST_UI_ID).style.display = 'none';
        } else {
          alert(`❌ Import failed: ${response?.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('[SOS 360] Import error:', error);
        alert(`❌ Import error: ${error.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = `☁️ Import <span id="sos-post-selected-count">0</span> Selected Profiles`;
      }
    });

    document.getElementById('sos-post-import-this').addEventListener('click', async () => {
      const btn = document.getElementById('sos-post-import-this');
      btn.disabled = true;
      btn.textContent = '⏳ Importing...';

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'importPostData',
          data: postData
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
        console.error('[SOS 360] Import post data error:', error);
        btn.textContent = '❌ Error';
        setTimeout(() => {
          btn.textContent = '📥 Import This Post Data Only';
          btn.disabled = false;
        }, 2000);
      }
    });

    // Audience Menu Events
    const menuBtn = document.getElementById('sos-post-menu');
    const clearAudienceBtn = document.getElementById('sos-post-clear-audience');

    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePostAudienceMenu();
      });
    }

    if (clearAudienceBtn) {
      clearAudienceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPostAudience();
      });
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('sos-post-audience-menu');
      const btn = document.getElementById('sos-post-menu');
      if (menu && menu.style.display === 'block' && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.style.display = 'none';
      }
    });

    console.log('[SOS 360] Post import overlay created');
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

    console.log('[SOS 360] Starting Instagram dialog scan');

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
          console.log('[SOS 360] Scan complete - no more users to load');
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
        console.error('[SOS 360] Error extracting user:', e);
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
        console.error('[SOS 360] AI batch analysis failed:', response?.error);
        updateDebug('\u26a0\ufe0f Erro na an\u00e1lise IA');

        // Fallback: add all to qualified if AI fails
        for (const lead of batch) {
          state.qualifiedLeads.set(lead.username, lead);
        }
      }
    } catch (error) {
      console.error('[SOS 360] AI batch error:', error);
      updateDebug('\u26a0\ufe0f Erro na an\u00e1lise IA');

      // Fallback: add all to qualified if AI fails
      for (const lead of batch) {
        state.qualifiedLeads.set(lead.username, lead);
      }
    }

    state.aiAnalyzing = false;
    updateUI();
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

    // Get stats (posts, followers, following)
    let postsCount = 0, followersCount = 0, followingCount = 0;
    const statItems = document.querySelectorAll('header section ul li');
    if (statItems.length >= 3) {
      postsCount = parseCount(statItems[0]?.textContent);
      followersCount = parseCount(statItems[1]?.textContent);
      followingCount = parseCount(statItems[2]?.textContent);
    }

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

    return {
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
    };
  }

  // --- Import Logic ---
  async function importQualifiedLeads() {
    const leads = Array.from(state.qualifiedLeads.values());
    if (leads.length === 0) return;

    console.log('[SOS 360] Leads to import:', JSON.stringify(leads, null, 2));

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
        console.log('[SOS 360] Starting Instagram Deep Import with criteria:', criteria);

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
          console.error('[SOS 360] Deep Import failed:', response?.error);
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
        console.log('[SOS 360] Sending import request:', JSON.stringify(importData, null, 2));

        const response = await chrome.runtime.sendMessage({
          action: 'importLeads',
          data: importData
        });

        console.log('[SOS 360] Import response:', response);

        if (response?.success) {
          alert(`Sucesso! ${leads.length} leads importados.`);
          // Clear imported leads
          state.qualifiedLeads.clear();
          state.totalUsersFound = 0;
          updateUI();
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

    console.log(`[SOS 360] Instagram Deep Import Progress: ${current}/${total} - ${status}`);
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
    const username = getCurrentProfileUsername();
    const isPost = isInstagramPostPage();
    const currentUrl = window.location.href.split('?')[0]; // Normalize URL without query params

    // Update state
    state.isPostPage = isPost;
    state.currentProfileUsername = username;

    if (isPost) {
      // We're on a post page
      const previousPostUrl = state.currentPostUrl;

      // Check if this is a new/different post
      if (previousPostUrl && previousPostUrl !== currentUrl) {
        console.log('[SOS 360] Navigated to different post, closing old overlay');
        closePostOverlay();
      }

      // Update current post URL
      state.currentPostUrl = currentUrl;

      console.log('[SOS 360] On Instagram post page:', currentUrl);
      // Inject the import button AND open overlay automatically
      setTimeout(() => {
        injectImportPostButton();
        createPostImportOverlay();
      }, 2000);
    } else {
      // Not on a post page - close post overlay if it was open
      if (state.currentPostUrl) {
        console.log('[SOS 360] Left post page, closing overlay');
        closePostOverlay();
        removeImportPostButton();
        state.currentPostUrl = null;
      }

      if (username) {
        // We're on a profile page
        setTimeout(() => {
          console.log(`[SOS 360] On Instagram profile: @${username}`);
          // Don't auto-show, wait for popup trigger
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
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      state.currentProfileUsername = getCurrentProfileUsername();
      state.isPostPage = isInstagramPostPage();

      // Update overlay title if visible
      const titleEl = document.querySelector(`#${UI_ID} .sos-title`);
      if (titleEl && state.currentProfileUsername) {
        titleEl.textContent = `Import: @${state.currentProfileUsername}`;
      }

      init();
    }
  }).observe(document, { subtree: true, childList: true });

  // Also observe DOM changes to inject button on post pages
  const postObserver = new MutationObserver(() => {
    if (state.isPostPage && !document.getElementById('sos-import-post-btn')) {
      injectImportPostButton();
    }
  });
  postObserver.observe(document.body, { childList: true, subtree: true });

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

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[SOS 360] Instagram content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  });

  // --- Legacy Functions (for LeadNavigator compatibility) ---
  async function openSearch() {
    console.log('[SOS 360] Opening search...');
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
    console.log('[SOS 360] Typing search:', keyword);
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
      console.error('[SOS 360] Error loading audiences:', e);
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

    // Re-filter list
    updatePostProfilesList();

    console.log('[SOS 360] Selected post audience:', audience.name);
  }

  function clearPostAudience() {
    state.selectedAudience = null;

    const selectedEl = document.getElementById('sos-post-selected-audience');
    if (selectedEl) selectedEl.style.display = 'none';

    // Re-filter list (show all)
    updatePostProfilesList();
  }

  /**
   * Checks if a profile matches the selected audience criteria
   * @param {Object} profile - Profile object (username, fullName, commentText)
   * @param {Object} audience - Selected audience object
   * @returns {boolean} True if matches
   */
  function matchesAudienceCriteria(profile, audience) {
    if (!audience) return true;

    // Combine available text for matching
    const searchText = `${profile.username} ${profile.fullName || ''} ${profile.commentText || ''}`.toLowerCase();

    // Check required keywords (Must have at least one if defined)
    if (audience.keywords && audience.keywords.length > 0) {
      const hasKeyword = audience.keywords.some(k => searchText.includes(k.toLowerCase()));
      if (!hasKeyword) return false;
    }

    // Check excluded keywords (Must NOT have any)
    if (audience.excludedKeywords && audience.excludedKeywords.length > 0) {
      const hasExcluded = audience.excludedKeywords.some(k => searchText.includes(k.toLowerCase()));
      if (hasExcluded) return false;
    }

    return true;
  }

  console.log('[SOS 360] Instagram Script v3.1 Loaded (with Fixed Comment Auto-Scroll)');
})();
