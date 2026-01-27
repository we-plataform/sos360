// Instagram content script - Post Import Module
// Lia 360
// Handles post data extraction, comment author extraction, and auto-scroll

(function () {
  'use strict';

  const utils = window.LiaInstagramUtils;
  if (!utils) {
    console.error('[Lia 360 Post] Utils not loaded');
    return;
  }

  // Constants
  const SELECTORS = {
    postContainer: 'article',
    postAuthorLink: 'article header a[href^="/"]',
    postAuthorAvatar: 'article header img[crossorigin="anonymous"], article header img',
    postAuthorName: 'article header span[dir="auto"]',
    postCaption: 'article h1, article span[dir="auto"]',
    postImage: 'article img[srcset], article img[src]',
    postLikes: 'article section button span, article section span',
    commentSection: 'article ul, div[role="dialog"] ul',
    commentItem: 'ul > div > div, ul li, div[style*="padding"] > div',
    commentAuthorLink: 'a[href^="/"]:not([href*="/explore/"]):not([href*="/p/"])',
    commentAuthorAvatar: 'img[crossorigin="anonymous"], canvas + img, img[alt]',
    commentText: 'span[dir="auto"]',
    commentTimestamp: 'time',
  };

  /**
   * Detects if current page is an Instagram post page
   */
  function isInstagramPostPage() {
    return /\/p\/[\w-]+\/?$/.test(window.location.pathname);
  }

  /**
   * Extracts post data from current Instagram post page
   */
  function extractPostData() {
    if (!isInstagramPostPage()) return null;

    const article = document.querySelector(SELECTORS.postContainer);
    if (!article) return null;

    try {
      const authorLink = article.querySelector(SELECTORS.postAuthorLink);
      const authorUsername = authorLink ? authorLink.getAttribute('href')?.replace(/\//g, '') : null;
      const authorAvatar = article.querySelector(SELECTORS.postAuthorAvatar);
      const authorName = article.querySelector(SELECTORS.postAuthorName);

      let caption = null;
      const captionEls = article.querySelectorAll('h1, span[dir="auto"]');
      for (const el of captionEls) {
        const text = utils.getTextContent(el);
        if (text && text.length > 20) {
          caption = text;
          break;
        }
      }

      const images = [];
      const imageEls = article.querySelectorAll(SELECTORS.postImage);
      for (const img of imageEls) {
        if (img.src && !img.src.includes('data:image') && !img.src.includes('44x44')) {
          images.push(img.src);
        }
      }

      let likesCount = null;
      const likeButtons = article.querySelectorAll(SELECTORS.postLikes);
      for (const btn of likeButtons) {
        const text = utils.getTextContent(btn);
        if (text && /\d/.test(text)) {
          likesCount = utils.parseCount(text);
          break;
        }
      }

      let commentsCount = null;
      const commentLinks = article.querySelectorAll('a[href*="/comments/"]');
      for (const link of commentLinks) {
        const text = utils.getTextContent(link);
        if (text) {
          commentsCount = utils.parseCount(text);
          break;
        }
      }

      const postData = {
        postUrl: window.location.href.split('?')[0],
        caption: caption || '',
        imageUrls: images.slice(0, 5),
        likesCount: likesCount,
        commentsCount: commentsCount,
        authorUsername: authorUsername,
        authorFullName: authorName ? utils.getTextContent(authorName) : null,
        authorAvatarUrl: authorAvatar ? authorAvatar.src : null,
        extractedAt: new Date().toISOString(),
      };

      console.log('[Lia 360 Post] Post data extracted:', postData);
      return postData;

    } catch (error) {
      console.error('[Lia 360 Post] Error extracting post data:', error);
      return null;
    }
  }

  /**
   * Extracts comment authors from the visible comments section
   */
  function extractCommentAuthors() {
    const commentAuthors = [];
    const commentItems = document.querySelectorAll(SELECTORS.commentItem);

    for (const item of commentItems) {
      try {
        const authorLink = item.querySelector(SELECTORS.commentAuthorLink);
        if (!authorLink) continue;

        const href = authorLink.getAttribute('href');
        if (!href || href === '/' || href.includes('/explore/') || href.includes('/p/')) continue;

        const username = href.replace(/\//g, '').split('?')[0];
        if (!username || username.length < 2) continue;

        if (window.LiaInstagramState && window.LiaInstagramState.commentAuthors.has(username)) continue;

        const avatar = item.querySelector(SELECTORS.commentAuthorAvatar);
        const avatarUrl = avatar?.src || null;

        const commentTextEl = item.querySelector(SELECTORS.commentText);
        const commentText = utils.getTextContent(commentTextEl) || '';

        const container = authorLink.closest('div, li');

        let verified = false;
        const verifiedBadge = item.querySelector('svg[aria-label="Verified"], img[src*="verified"], path[d*="M22.5 12.5c0-1.58"]');
        if (verifiedBadge) {
          verified = true;
        }

        let fullName = null;
        if (container) {
          const spans = container.querySelectorAll('span');
          for (const span of spans) {
            const text = utils.getTextContent(span);
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
          commentText: commentText ? commentText.substring(0, 500) : '',
          followersCount: null,
          isFromComment: true,
          verified: verified,
        };

        commentAuthors.push(authorData);
        if (window.LiaInstagramState) {
          window.LiaInstagramState.commentAuthors.set(username, authorData);
        }

      } catch (error) {
        console.error('[Lia 360 Post] Error extracting comment author:', error);
      }
    }

    console.log(`[Lia 360 Post] Extracted ${commentAuthors.length} comment authors`);
    return commentAuthors;
  }

  /**
   * Finds the scrollable container for comments
   */
  function findCommentScrollContainer() {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return null;

    const ulByClass = dialog.querySelector('ul[class*="_a9z6"]');
    if (ulByClass) {
      const style = window.getComputedStyle(ulByClass);
      if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
        console.log('[Lia 360 Post] Found UL comment container by class');
        return ulByClass;
      }
    }

    const allULs = dialog.querySelectorAll('ul');
    for (const ul of allULs) {
      const style = window.getComputedStyle(ul);
      const isScrollable = style.overflowY === 'scroll' || style.overflowY === 'auto';
      const hasHeight = ul.scrollHeight > ul.clientHeight + 50;
      const hasComments = ul.querySelectorAll('h3').length > 0;

      if (isScrollable && hasHeight && hasComments) {
        console.log(`[Lia 360 Post] Found UL comment container`);
        return ul;
      }
    }

    for (const ul of allULs) {
      const style = window.getComputedStyle(ul);
      const isScrollable = style.overflowY === 'scroll' || style.overflowY === 'auto';
      const hasHeight = ul.scrollHeight > ul.clientHeight + 50;
      const commentLinks = ul.querySelectorAll('a[href^="/"]:not([href*="/explore/"]):not([href*="/p/"])');

      if (isScrollable && hasHeight && commentLinks.length > 3) {
        console.log(`[Lia 360 Post] Found UL container (fallback)`);
        return ul;
      }
    }

    console.log('[Lia 360 Post] No comment scroll container found');
    return null;
  }

  /**
   * Get scroll target comment
   */
  function getScrollTargetComment(scrollContainer) {
    const context = scrollContainer || document;
    const comments = context.querySelectorAll(SELECTORS.commentItem);

    if (comments.length === 0) return null;

    const visibleComments = Array.from(comments).filter(comment => {
      const rect = comment.getBoundingClientRect();
      const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
      return isInViewport;
    });

    if (visibleComments.length < comments.length) {
      const lastVisibleIndex = visibleComments.length > 0
        ? Array.from(comments).indexOf(visibleComments[visibleComments.length - 1])
        : -1;

      const jumpSize = 3 + Math.floor(Math.random() * 3);
      const targetIndex = Math.min(lastVisibleIndex + jumpSize, comments.length - 1);

      return comments[targetIndex];
    }

    return comments[comments.length - 1];
  }

  /**
   * Scroll to next comments
   */
  async function scrollToNextComments(scrollContainer) {
    if (!scrollContainer) {
      console.log('[Lia 360 Post] No scroll container provided');
      return false;
    }

    const targetComment = getScrollTargetComment(scrollContainer);

    if (!targetComment) {
      console.log('[Lia 360 Post] No target comment found');
      return false;
    }

    try {
      const containerRect = scrollContainer.getBoundingClientRect();
      const commentRect = targetComment.getBoundingClientRect();

      const relativeTop = commentRect.top - containerRect.top;
      const currentScroll = scrollContainer.scrollTop;
      const targetScroll = currentScroll + relativeTop - (containerRect.height * 0.3);

      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: 'instant'
      });

      await utils.sleep(50);
      const actualScroll = scrollContainer.scrollTop;
      const scrollHappened = Math.abs(actualScroll - currentScroll) > 1;

      if (!scrollHappened) {
        console.warn('[Lia 360 Post] Scroll did NOT happen');
        return false;
      }

      await utils.sleep(300 + Math.random() * 200);
      return true;
    } catch (error) {
      console.error('[Lia 360 Post] Container scroll failed:', error);
      return false;
    }
  }

  /**
   * Find "Load more comments" button
   */
  function findLoadMoreButton() {
    const dialog = document.querySelector('div[role="dialog"]');
    const searchContext = dialog || document;

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
        if (btn) return btn;
      }
    }

    const textPatterns = ['view more', 'load more', 'ver mais', 'carregar mais', 'more comments', 'mais comentários'];
    const buttons = searchContext.querySelectorAll('button, div[role="button"], span[role="button"]');

    for (const btn of buttons) {
      const text = btn.textContent?.toLowerCase() || '';
      if (textPatterns.some(p => text.includes(p))) {
        return btn;
      }
    }

    const viewMoreBtn = utils.findViewMoreCommentsButton();
    if (viewMoreBtn) {
      return viewMoreBtn;
    }

    return null;
  }

  /**
   * Clicks the "Load more comments" button
   */
  async function clickLoadMoreComments(simulator) {
    const loadMoreBtn = findLoadMoreButton();

    if (loadMoreBtn) {
      console.log('[Lia 360 Post] Clicking load more button');
      const clicked = await simulator.simulateClick(loadMoreBtn);
      if (clicked) {
        await utils.sleep(simulator.getHumanDelay(1500, 2500));
        return true;
      }
    }

    return false;
  }

  /**
   * Open comments section
   */
  async function openCommentsSection() {
    const commentSvg = document.querySelector('svg[aria-label*="Comment"], svg[aria-label*="Comentar"], svg[aria-label*="comment"]');
    if (commentSvg) {
      const btn = commentSvg.closest('button, div[role="button"], span[role="button"]');
      if (btn) {
        console.log('[Lia 360 Post] Clicking comment button');
        btn.click();
        await utils.sleep(2000);
        return;
      }
    }

    const commentsLink = document.querySelector('a[href*="/comments/"]');
    if (commentsLink) {
      console.log('[Lia 360 Post] Clicking comments link');
      commentsLink.click();
      await utils.sleep(2000);
      return;
    }

    const viewAllBtn = utils.findElementByText('span', ['view all', 'ver todos', 'comments', 'comentários']);
    if (viewAllBtn) {
      const clickable = viewAllBtn.closest('button, div[role="button"], a') || viewAllBtn;
      console.log('[Lia 360 Post] Clicking view all comments');
      clickable.click();
      await utils.sleep(2000);
    }
  }

  /**
   * Starts auto-scroll through comments
   */
  async function startCommentAutoScroll(targetCount = 300) {
    const state = window.LiaInstagramState;
    if (!state) {
      console.error('[Lia 360 Post] State not initialized');
      return;
    }

    if (state.isAutoScrollingComments) {
      console.log('[Lia 360 Post] Already scrolling comments');
      return;
    }

    state.isAutoScrollingComments = true;
    state.targetProfileCount = targetCount;
    state.profilesScanned = 0;

    console.log(`[Lia 360 Post] Starting comment auto-scroll, target: ${targetCount}`);

    const simulator = utils.createHumanSimulator();

    await openCommentsSection();

    let noChangeCount = 0;
    const maxNoChange = 5;

    while (state.isAutoScrollingComments && state.commentAuthors.size < targetCount) {
      const prevCount = state.commentAuthors.size;

      const scrollContainer = findCommentScrollContainer();

      console.log('[Lia 360 Post] Scroll iteration:', {
        containerTag: scrollContainer?.tagName || 'none',
        commentsFound: state.commentAuthors.size,
        loadMoreBtnExists: !!findLoadMoreButton()
      });

      extractCommentAuthors();

      const loadedMore = await clickLoadMoreComments(simulator);

      let scrolled = false;

      if (loadedMore) {
        console.log('[Lia 360 Post] Load more button clicked');
        await utils.sleep(simulator.getHumanDelay(200, 400));
        extractCommentAuthors();
      }

      if (scrollContainer) {
        console.log('[Lia 360 Post] Attempting to scroll container');
        scrolled = await scrollToNextComments(scrollContainer);
        await utils.sleep(simulator.getHumanDelay(200, 400));
      } else if (!loadedMore) {
        console.log('[Lia 360 Post] No scroll container found');
      }

      await utils.sleep(simulator.getHumanDelay(400, 800));

      extractCommentAuthors();

      const newCount = state.commentAuthors.size;
      const foundNew = newCount > prevCount;

      state.profilesScanned = newCount;

      if (!scrolled && !foundNew && !loadedMore) {
        noChangeCount++;
        console.log(`[Lia 360 Post] No progress (${noChangeCount}/${maxNoChange})`);

        if (noChangeCount >= maxNoChange) {
          console.log('[Lia 360 Post] Comment auto-scroll complete');
          break;
        }
      } else {
        noChangeCount = 0;
      }

      if (state.commentAuthors.size >= targetCount) {
        console.log(`[Lia 360 Post] Target reached: ${state.commentAuthors.size}`);
        break;
      }
    }

    state.isAutoScrollingComments = false;
    console.log(`[Lia 360 Post] Comment extraction complete: ${state.commentAuthors.size} profiles`);
  }

  /**
   * Stops the comment auto-scroll
   */
  function stopCommentAutoScroll() {
    const state = window.LiaInstagramState;
    if (state) {
      state.isAutoScrollingComments = false;
      console.log('[Lia 360 Post] Comment auto-scroll stopped');
    }
  }

  // Expose public API
  window.LiaInstagramPost = {
    isInstagramPostPage,
    extractPostData,
    extractCommentAuthors,
    findCommentScrollContainer,
    scrollToNextComments,
    findLoadMoreButton,
    clickLoadMoreComments,
    openCommentsSection,
    startCommentAutoScroll,
    stopCommentAutoScroll,
  };

  console.log('[Lia 360 Post] Post import module loaded');
})();
