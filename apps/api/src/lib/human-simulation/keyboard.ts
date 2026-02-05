/**
 * Human-like keyboard typing simulation with variable speed and typos
 */

import type { Page, ElementHandle } from 'puppeteer';
import { sleep, randomDelay, gaussianRandom } from './timing.js';

/**
 * Options for human-like typing
 */
export interface HumanTypeOptions {
  /** Typing speed in words per minute (default: 60) */
  wpm?: number;
  /** Rate of typos as percentage (default: 0.02 = 2%) */
  mistakeRate?: number;
  /** Whether to add random pauses while typing (default: true) */
  addPauses?: boolean;
  /** Chance of pausing per character (default: 0.1 = 10%) */
  pauseChance?: number;
  /** Whether to focus element before typing (default: true) */
  focusFirst?: boolean;
}

/**
 * Type text with human-like characteristics
 *
 * Features:
 * - Variable typing speed (not mechanical)
 * - Occasional typos with backspace correction
 * - Random pauses (simulating thinking)
 * - Speed variation based on character difficulty
 *
 * @param page - Puppeteer page instance
 * @param selector - CSS selector or element handle
 * @param text - Text to type
 * @param options - Typing options
 *
 * @example
 * ```typescript
 * // Type with default human-like behavior
 * await humanType(page, 'textarea[name="message"]', 'Hello, world!');
 *
 * // Type with custom speed (slower = more realistic)
 * await humanType(page, '#input', 'Slow typing', { wpm: 40 });
 *
 * // Type with higher typo rate
 * await humanType(page, 'textarea', 'Error-prone typing', { mistakeRate: 0.05 });
 * ```
 */
export async function humanType(
  page: Page,
  selector: string | ElementHandle,
  text: string,
  options: HumanTypeOptions = {}
): Promise<void> {
  const {
    wpm = 60,
    mistakeRate = 0.02,
    addPauses = true,
    pauseChance = 0.1,
    focusFirst = true,
  } = options;

  // Get element
  const element =
    typeof selector === 'string'
      ? await page.$(selector)
      : selector;

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Focus element if requested
  if (focusFirst) {
    await element.click();
    await sleep(randomDelay(200, 400));
  }

  // Calculate base delay per character
  // Average word length = 5 characters
  const charsPerMinute = wpm * 5;
  const baseDelay = (60 / charsPerMinute) * 1000; // ms per character

  const chars = text.split('');

  for (const char of chars) {
    // Calculate delay for this character with variation
    const charDelay = calculateCharacterDelay(char, baseDelay);

    // Check if we should make a typo
    if (Math.random() < mistakeRate) {
      await simulateTypo(page, char, charDelay);
    } else {
      // Type the character normally
      await page.keyboard.type(char);
    }

    // Random pause (thinking time)
    if (addPauses && Math.random() < pauseChance) {
      const thinkingTime = randomDelay(500, 1500);
      await sleep(thinkingTime);
    }

    // Wait before next character
    const finalDelay = charDelay + gaussianRandom(0, charDelay * 0.3);
    await sleep(Math.max(0, finalDelay));
  }
}

/**
 * Calculate typing delay for a specific character
 * Some characters take longer to type than others
 *
 * @param char - Character to type
 * @param baseDelay - Base delay in milliseconds
 * @returns Delay for this character
 */
function calculateCharacterDelay(char: string, baseDelay: number): number {
  // Uppercase letters take longer (Shift + key)
  if (char >= 'A' && char <= 'Z') {
    return baseDelay * 1.5;
  }

  // Numbers take longer
  if (char >= '0' && char <= '9') {
    return baseDelay * 1.3;
  }

  // Special characters take even longer
  if (!char.match(/[a-z]/)) {
    return baseDelay * 1.7;
  }

  // Spaces are quick
  if (char === ' ') {
    return baseDelay * 0.8;
  }

  return baseDelay;
}

/**
 * Simulate a typing mistake and correction
 *
 * @param page - Puppeteer page instance
 * @param correctChar - The character that should be typed
 * @param baseDelay - Base delay for typing
 */
async function simulateTypo(
  page: Page,
  correctChar: string,
  baseDelay: number
): Promise<void> {
  // Type wrong character (next or previous ASCII character)
  const wrongChar = String.fromCharCode(correctChar.charCodeAt(0) + 1);
  await page.keyboard.type(wrongChar);

  // Pause to notice the mistake
  await sleep(baseDelay * 3);

  // Backspace to delete
  await page.keyboard.press('Backspace');

  // Pause before correction
  await sleep(randomDelay(100, 300));

  // Type correct character
  await page.keyboard.type(correctChar);
}

/**
 * Type text and press Enter
 *
 * @param page - Puppeteer page instance
 * @param selector - CSS selector or element handle
 * @param text - Text to type
 * @param options - Typing options
 */
export async function humanTypeAndSubmit(
  page: Page,
  selector: string | ElementHandle,
  text: string,
  options: HumanTypeOptions = {}
): Promise<void> {
  await humanType(page, selector, text, options);

  // Pause before submitting (human reviews what they typed)
  await sleep(randomDelay(500, 1500));

  await page.keyboard.press('Enter');
}

/**
 * Press a key combination with human-like delay
 *
 * @param page - Puppeteer page instance
 * @param keys - Keys to press (e.g., 'Control+a', 'Meta+c')
 * @param delay - Delay before pressing (default: random)
 */
export async function humanKeyPress(
  page: Page,
  keys: string,
  delay?: number
): Promise<void> {
  if (delay === undefined) {
    delay = randomDelay(200, 500);
  }

  await sleep(delay);
  await page.keyboard.down(keys.split('+')[0]);

  const subKeys = keys.split('+').slice(1);
  for (const key of subKeys) {
    await sleep(randomDelay(50, 150));
    await page.keyboard.down(key);
  }

  for (let i = subKeys.length - 1; i >= 0; i--) {
    await sleep(randomDelay(50, 150));
    await page.keyboard.up(subKeys[i]);
  }

  await sleep(randomDelay(50, 150));
  await page.keyboard.up(keys.split('+')[0]);
}

/**
 * Select all text (Ctrl/Cmd + A)
 *
 * @param page - Puppeteer page instance
 */
export async function selectAll(page: Page): Promise<void> {
  const isMac = await page.evaluate(() => navigator.platform.includes('Mac'));
  const shortcut = isMac ? 'Meta+a' : 'Control+a';
  await humanKeyPress(page, shortcut);
}

/**
 * Copy text (Ctrl/Cmd + C)
 *
 * @param page - Puppeteer page instance
 */
export async function copyText(page: Page): Promise<void> {
  const isMac = await page.evaluate(() => navigator.platform.includes('Mac'));
  const shortcut = isMac ? 'Meta+c' : 'Control+c';
  await humanKeyPress(page, shortcut);
}

/**
 * Paste text (Ctrl/Cmd + V)
 *
 * @param page - Puppeteer page instance
 */
export async function pasteText(page: Page): Promise<void> {
  const isMac = await page.evaluate(() => navigator.platform.includes('Mac'));
  const shortcut = isMac ? 'Meta+v' : 'Control+v';
  await humanKeyPress(page, shortcut);
}
