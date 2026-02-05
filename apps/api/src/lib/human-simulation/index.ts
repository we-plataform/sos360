/**
 * Human simulation library for browser automation
 *
 * Provides realistic human-like behavior simulation:
 * - Mouse movement with Bezier curves
 * - Keyboard typing with variable speed and typos
 * - Scroll with momentum and overshoot
 * - Timing with Gaussian randomization
 */

// Export all timing functions
export {
  gaussianRandom,
  sleep,
  randomDelay,
  smartDelay,
  DELAYS,
  calculateReadTime,
  shouldAddDistraction,
  getDistractionDelay,
} from './timing.js';

// Export all mouse functions
export {
  humanClick,
  humanHover,
  randomMouseMovement,
  type HumanClickOptions,
} from './mouse.js';

// Export all keyboard functions
export {
  humanType,
  humanTypeAndSubmit,
  humanKeyPress,
  selectAll,
  copyText,
  pasteText,
  type HumanTypeOptions,
} from './keyboard.js';

// Export all scroll functions
export {
  humanScroll,
  scrollToElement,
  scrollToBottom,
  randomScroll,
  lazyScroll,
  smoothScroll,
  scrollElementIntoView,
  type HumanScrollOptions,
} from './scroll.js';
