import { Logger } from './Logger.js';

/**
 * Action Executor
 * Deterministic execution of actions (Click, Type, Scroll).
 * Handles human-like delays and pre-action scrolling.
 */
export class ActionExecutor {
    constructor() {
        this.logger = new Logger('Executor');
    }

    /**
     * Click an element safely
     * @param {Element} element 
     */
    async click(element) {
        if (!element) {
            this.logger.error('Attempted to click null element');
            return false;
        }

        try {
            await this.scrollTo(element);

            // Visual feedback (optional highlight)
            // const originalBorder = element.style.border;
            // element.style.border = '2px solid red';

            await this.sleep(100, 300); // Pre-click pause

            // Try native click first
            element.click();

            // Dispatch synth events just in case (React sometimes needs bubbles)
            /*
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            */

            this.logger.info('Clicked element', {
                tag: element.tagName,
                text: element.innerText?.substring(0, 20)
            });

            await this.sleep(200, 500); // Post-click pause
            return true;
        } catch (e) {
            this.logger.error('Click failed', e);
            return false;
        }
    }

    /**
     * Type text into an input
     * @param {Element} element 
     * @param {string} text 
     */
    async type(element, text) {
        if (!element) return false;

        try {
            await this.scrollTo(element);
            element.focus();

            // Clear first if needed (simple approach)
            element.value = '';

            // Simulate typing char by char
            for (const char of text) {
                element.value += char;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await this.sleep(20, 80);
            }

            element.dispatchEvent(new Event('change', { bubbles: true }));
            this.logger.info('Typed text', { length: text.length });
            return true;
        } catch (e) {
            this.logger.error('Type failed', e);
            return false;
        }
    }

    /**
     * Scroll element into view
     */
    async scrollTo(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300, 600); // Wait for scroll animation
    }

    /**
     * Random sleep
     */
    async sleep(min, max = min) {
        const ms = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
