// Instagram content script - Shared utilities
// Lia 360

(function () {
  'use strict';

  // Expose utilities to window for sharing between modules
  window.LiaInstagramUtils = {
    // --- Helper: Find element by text content ---
    findElementByText(selector, textPatterns, container = document) {
      const elements = Array.from(container.querySelectorAll(selector));
      const patterns = Array.isArray(textPatterns) ? textPatterns : [textPatterns];
      return elements.find(el => {
        const text = el.textContent?.toLowerCase() || '';
        return patterns.some(pattern => text.includes(pattern.toLowerCase()));
      });
    },

    // --- Helper: Find "View more comments" button ---
    findViewMoreCommentsButton() {
      const patterns = ['view more', 'view all', 'more comments', 'carregar', 'ver mais', 'ver todos', 'load more'];
      let btn = this.findElementByText('span', patterns);
      if (btn) return btn.closest('button, div[role="button"], span[role="button"]') || btn;
      btn = this.findElementByText('button', patterns);
      return btn;
    },

    // --- Helper Functions ---
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    getTextContent(element) {
      return element?.textContent?.trim() || null;
    },

    parseCount(text) {
      if (!text) return 0;

      const clean = text.toLowerCase()
        .replace(/,/g, '')
        .replace(/\./g, '')
        .replace(/\+/g, '')
        .trim();

      if (clean.includes('mil')) return parseFloat(clean) * 1000;
      if (clean.includes('mi') || clean.includes('m')) return parseFloat(clean) * 1000000;
      if (clean.includes('b')) return parseFloat(clean) * 1000000000;

      if (clean.includes('k')) {
        const num = parseFloat(clean.replace('k', ''));
        return Math.round(num * 1000);
      }

      const match = clean.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    },

    matchesKeywords(text, keywords) {
      if (!keywords || keywords.length === 0) return true;
      if (!text) return false;
      const lowerText = text.toLowerCase();
      return keywords.some(keyword => lowerText.includes(keyword.toLowerCase().trim()));
    },

    getCurrentProfileUsername() {
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0 && !['explore', 'reels', 'direct', 'stories', 'p', 'tv', 'accounts'].includes(parts[0])) {
        return parts[0];
      }
      return null;
    },

    /**
     * Creates a human simulator for realistic mouse/click/scroll events
     */
    createHumanSimulator() {
      const self = this;
      return {
        getHumanDelay(min = 1000, max = 3000) {
          return min + Math.random() * (max - min);
        },

        getRandomPosition(element) {
          const rect = element.getBoundingClientRect();
          const marginX = rect.width * 0.2;
          const marginY = rect.height * 0.2;
          return {
            x: rect.left + marginX + Math.random() * (rect.width - 2 * marginX),
            y: rect.top + marginY + Math.random() * (rect.height - 2 * marginY)
          };
        },

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
            await self.sleep(20 + Math.random() * 30);
          }
          return { x, y };
        },

        async simulateHover(element) {
          element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
          element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await self.sleep(100 + Math.random() * 150);
        },

        async simulateClick(element) {
          if (!element) return false;

          try {
            const { x, y } = await this.simulateMouseMove(element);
            await this.simulateHover(element);

            element.dispatchEvent(new PointerEvent('pointerdown', {
              bubbles: true, cancelable: true, view: window,
              clientX: x, clientY: y,
              pointerType: 'mouse', isPrimary: true, pressure: 0.5
            }));

            element.dispatchEvent(new MouseEvent('mousedown', {
              bubbles: true, cancelable: true, view: window,
              clientX: x, clientY: y, button: 0, buttons: 1
            }));

            await self.sleep(50 + Math.random() * 50);

            element.dispatchEvent(new PointerEvent('pointerup', {
              bubbles: true, cancelable: true, view: window,
              clientX: x, clientY: y,
              pointerType: 'mouse', isPrimary: true, pressure: 0
            }));

            element.dispatchEvent(new MouseEvent('mouseup', {
              bubbles: true, cancelable: true, view: window,
              clientX: x, clientY: y, button: 0, buttons: 0
            }));

            await self.sleep(30 + Math.random() * 30);

            element.dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, view: window,
              clientX: x, clientY: y, button: 0
            }));

            return true;
          } catch (error) {
            console.error('[Lia 360] Error simulating click:', error);
            return false;
          }
        },

        async simulateWheelScroll(element, distance = 300) {
          if (!element) return false;

          try {
            const rect = element.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

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
              await self.sleep(80 + Math.random() * 40);
            }

            return true;
          } catch (error) {
            console.error('[Lia 360] Error simulating wheel scroll:', error);
            return false;
          }
        }
      };
    },

    /**
     * Check if a lead matches audience criteria
     */
    matchesAudienceCriteria(lead, audience) {
      if (!audience) return true;

      const isCommentProfile = lead.isFromComment === true;

      if (isCommentProfile) {
        const commentText = (lead.commentText || '').toLowerCase();

        if (audience.postContentInclude && audience.postContentInclude.length > 0) {
          if (!commentText || commentText.length === 0) return false;
          const hasMatch = audience.postContentInclude.some(kw =>
            commentText.includes(kw.toLowerCase())
          );
          if (!hasMatch) return false;
        }

        if (audience.postContentExclude && audience.postContentExclude.length > 0 && commentText) {
          const hasExcluded = audience.postContentExclude.some(kw =>
            commentText.includes(kw.toLowerCase())
          );
          if (hasExcluded) return false;
        }

        if (audience.verifiedFilter && audience.verifiedFilter !== 'any') {
          const isVerified = lead.verified === true;
          if (audience.verifiedFilter === 'verified_only' && !isVerified) return false;
          if (audience.verifiedFilter === 'unverified_only' && isVerified) return false;
        }

        return true;
      }

      const profileText = `${lead.fullName || ''} ${lead.bio || ''}`.toLowerCase();
      const postText = (lead.commentText || lead.posts?.[0]?.text || '').toLowerCase();

      const hasProfileInfoInclude = audience.profileInfoInclude && audience.profileInfoInclude.length > 0;
      const hasPostContentInclude = audience.postContentInclude && audience.postContentInclude.length > 0;

      if (hasProfileInfoInclude) {
        const hasMatch = audience.profileInfoInclude.some(kw =>
          profileText.includes(kw.toLowerCase())
        );
        if (!hasMatch) return false;
      }

      if (audience.profileInfoExclude && audience.profileInfoExclude.length > 0) {
        const hasExcluded = audience.profileInfoExclude.some(kw =>
          profileText.includes(kw.toLowerCase())
        );
        if (hasExcluded) return false;
      }

      if (hasPostContentInclude && postText && postText.length > 0) {
        const hasMatch = audience.postContentInclude.some(kw =>
          postText.includes(kw.toLowerCase())
        );
        if (!hasMatch) return false;
      }

      if (audience.postContentExclude && audience.postContentExclude.length > 0 && postText) {
        const hasExcluded = audience.postContentExclude.some(kw =>
          postText.includes(kw.toLowerCase())
        );
        if (hasExcluded) return false;
      }

      if (audience.verifiedFilter && audience.verifiedFilter !== 'any') {
        const isVerified = lead.verified === true;
        if (audience.verifiedFilter === 'verified_only' && !isVerified) return false;
        if (audience.verifiedFilter === 'unverified_only' && isVerified) return false;
      }

      return true;
    }
  };

  console.log('[Lia 360] Instagram utils loaded');
})();
