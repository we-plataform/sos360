/**
 * Human-like mouse movement simulation using Bezier curves
 */

import type { Page, ElementHandle } from 'puppeteer';
import { sleep, randomDelay } from './timing.js';

/**
 * Options for human-like mouse click
 */
export interface HumanClickOptions {
  /** Speed of mouse movement (0-1, default: 0.5) */
  speed?: number;
  /** Randomness of movement path (0-1, default: 0.2) */
  randomness?: number;
  /** Whether to move to random starting position first (default: false) */
  moveToStartingPosition?: boolean;
  /** Starting position for mouse movement */
  startingPosition?: { x: number; y: number };
  /** Offset from element center (pixels) */
  offset?: { x: number; y: number };
}

/**
 * Get element center position with optional offset
 *
 * @param element - Puppeteer element handle
 * @param offset - Optional offset from center
 * @returns Element center position
 */
async function getElementCenter(
  element: ElementHandle,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): Promise<{ x: number; y: number }> {
  const box = await element.boundingBox();
  if (!box) {
    throw new Error('Could not get element bounding box');
  }

  return {
    x: box.x + box.width / 2 + offset.x,
    y: box.y + box.height / 2 + offset.y,
  };
}

/**
 * Generate a random control point for Bezier curve
 *
 * @param start - Start point
 * @param end - End point
 * @param randomness - Randomness factor (0-1)
 * @returns Random control point
 */
function generateControlPoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  randomness: number
): { x: number; y: number } {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  // Calculate distance and direction
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular offset (creates curve)
  const maxOffset = distance * randomness;

  return {
    x: midX + (Math.random() - 0.5) * maxOffset,
    y: midY + (Math.random() - 0.5) * maxOffset,
  };
}

/**
 * Move mouse along a Bezier curve path
 *
 * @param page - Puppeteer page instance
 * @param start - Start position
 * @param end - End position
 * @param control - Control point for curve
 * @param steps - Number of steps in the movement
 * @param speed - Speed of movement (inverse: higher = slower)
 */
async function moveAlongBezier(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  control: { x: number; y: number },
  steps: number = 20,
  speed: number = 0.5
): Promise<void> {
  const stepDelay = 10 / speed; // Base delay between steps

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Quadratic Bezier formula
    const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
    const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;

    await page.mouse.move(x, y);

    // Variable speed (slower at start and end)
    const speedFactor = 1 - Math.sin(t * Math.PI); // Slower at ends
    await sleep(stepDelay * speedFactor);
  }
}

/**
 * Perform a human-like mouse click on an element
 *
 * Features:
 * - Bezier curve mouse movement (not straight line)
 * - Random offset from element center (humans don't click dead center)
 * - Variable speed (slower at start and end)
 * - Random starting position (simulates mouse entering from edge)
 *
 * @param page - Puppeteer page instance
 * @param selector - CSS selector or element handle
 * @param options - Click options
 *
 * @example
 * ```typescript
 * // Click with default human-like behavior
 * await humanClick(page, 'button[type="submit"]');
 *
 * // Click with custom speed and randomness
 * await humanClick(page, '#submit-btn', { speed: 0.7, randomness: 0.3 });
 *
 * // Click with random offset from center
 * await humanClick(page, '.btn', { offset: { x: 5, y: -3 } });
 * ```
 */
export async function humanClick(
  page: Page,
  selector: string | ElementHandle,
  options: HumanClickOptions = {}
): Promise<void> {
  const {
    speed = 0.5,
    randomness = 0.2,
    moveToStartingPosition = false,
    startingPosition,
    offset = { x: 0, y: 0 },
  } = options;

  // Get element
  const element =
    typeof selector === 'string'
      ? await page.$(selector)
      : selector;

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Get target position (center + offset)
  const target = await getElementCenter(element, offset);

  // Add random offset if not specified (humans don't click dead center)
  if (!options.offset) {
    const randomOffset = 10; // 10 pixel radius
    target.x += (Math.random() - 0.5) * randomOffset;
    target.y += (Math.random() - 0.5) * randomOffset;
  }

  // Get current mouse position or use starting position
  let currentPosition = startingPosition;

  if (moveToStartingPosition && !currentPosition) {
    // Start from random edge position
    const viewport = page.viewport();
    if (viewport) {
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      switch (edge) {
        case 0: // top
          currentPosition = { x: Math.random() * viewport.width, y: 0 };
          break;
        case 1: // right
          currentPosition = { x: viewport.width, y: Math.random() * viewport.height };
          break;
        case 2: // bottom
          currentPosition = { x: Math.random() * viewport.width, y: viewport.height };
          break;
        case 3: // left
          currentPosition = { x: 0, y: Math.random() * viewport.height };
          break;
      }
      await page.mouse.move(currentPosition.x, currentPosition.y);
      await sleep(randomDelay(100, 300));
    }
  }

  // If no current position, get from page
  if (!currentPosition) {
    // Assume current position (can't actually get this from Puppeteer easily)
    // Start from a random position near target
    currentPosition = {
      x: target.x + (Math.random() - 0.5) * 200,
      y: target.y + (Math.random() - 0.5) * 200,
    };
  }

  // Generate control point for Bezier curve
  const controlPoint = generateControlPoint(currentPosition, target, randomness);

  // Move mouse along curve
  await moveAlongBezier(page, currentPosition, target, controlPoint, 20, speed);

  // Small pause before click (human decision time)
  await sleep(randomDelay(100, 300));

  // Click
  await page.mouse.click(target.x, target.y);

  // Small pause after click (reaction time)
  await sleep(randomDelay(100, 200));
}

/**
 * Hover over an element with human-like movement
 *
 * @param page - Puppeteer page instance
 * @param selector - CSS selector or element handle
 * @param options - Hover options
 */
export async function humanHover(
  page: Page,
  selector: string | ElementHandle,
  options: HumanClickOptions = {}
): Promise<void> {
  const {
    speed = 0.5,
    randomness = 0.2,
  } = options;

  const element =
    typeof selector === 'string'
      ? await page.$(selector)
      : selector;

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const target = await getElementCenter(element);

  // Get current position (assume random position)
  const currentPosition = {
    x: target.x + (Math.random() - 0.5) * 200,
    y: target.y + (Math.random() - 0.5) * 200,
  };

  // Generate control point
  const controlPoint = generateControlPoint(currentPosition, target, randomness);

  // Move along curve
  await moveAlongBezier(page, currentPosition, target, controlPoint, 20, speed);
}

/**
 * Perform a random mouse movement (simulates human looking around)
 *
 * @param page - Puppeteer page instance
 * @param viewport - Viewport dimensions
 */
export async function randomMouseMovement(
  page: Page,
  viewport: { width: number; height: number }
): Promise<void> {
  const startX = Math.random() * viewport.width;
  const startY = Math.random() * viewport.height;

  const endX = Math.random() * viewport.width;
  const endY = Math.random() * viewport.height;

  const controlPoint = {
    x: (startX + endX) / 2 + (Math.random() - 0.5) * 200,
    y: (startY + endY) / 2 + (Math.random() - 0.5) * 200,
  };

  await moveAlongBezier(
    page,
    { x: startX, y: startY },
    { x: endX, y: endY },
    controlPoint,
    15,
    0.6
  );
}
