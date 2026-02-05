import { Logger } from './Logger.js';

/**
 * Element Resolver
 * Robust strategy to find elements using layered heuristics.
 * Priority: Semantic (A11y) > Text > CSS Selector.
 */
export class ElementResolver {
    constructor() {
        this.logger = new Logger('Resolver');
    }

    /**
     * Resolve an element based on a definition object
     * @param {Object} definition - { role, name, text, selector, all: boolean }
     * @param {Element} root - Root element to search in (default: document)
     * @returns {Element|Element[]|null}
     */
    resolve(definition, root = document) {
        let result = null;

        // Layer 1: Semantic (Role + Name) -- Best for buttons/links
        if (definition.role && definition.name) {
            result = this._findByRole(definition.role, definition.name, root);
            if (result) {
                // this.logger.debug('Resolved via Semantic Layer', definition);
                return result;
            }
        }

        // Layer 2: Text Content -- Good for buttons/spans
        if (definition.text) {
            result = this._findByText(definition.text, definition.tag || '*', root);
            if (result) {
                // this.logger.debug('Resolved via Text Layer', definition);
                return result;
            }
        }

        // Layer 3: CSS Selector -- Fallback
        if (definition.selector) {
            if (definition.all) {
                return Array.from(root.querySelectorAll(definition.selector));
            }
            result = root.querySelector(definition.selector);
            if (result) {
                // this.logger.debug('Resolved via Selector Layer', definition);
                return result;
            }
        }

        return null;
    }

    // --- Private Helpers ---

    _findByRole(role, nameMatcher, root) {
        // Approximate querySelector for role (not perfect, but fast)
        // role="button" or tag matches semantic role
        const candidates = Array.from(root.querySelectorAll(`[role="${role}"], ${this._tagsForRole(role)}`));

        return candidates.find(el => {
            if (!this._isVisible(el)) return false;
            const name = this._getAccName(el);
            return this._matchText(name, nameMatcher);
        });
    }

    _findByText(textMatcher, tag, root) {
        // XPath is efficient for text search
        const snapshot = document.evaluate(
            `.//${tag}[contains(text(), '${typeof textMatcher === 'string' ? textMatcher : ''}')]`,
            root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
        );

        for (let i = 0; i < snapshot.snapshotLength; i++) {
            const el = snapshot.snapshotItem(i);
            if (this._isVisible(el) && this._matchText(el.textContent, textMatcher)) {
                return el;
            }
        }
        return null;
    }

    _tagsForRole(role) {
        const map = {
            'button': 'button, input[type="button"], input[type="submit"], a[role="button"]',
            'link': 'a',
            'textbox': 'input[type="text"], textarea',
            'heading': 'h1, h2, h3, h4, h5, h6'
        };
        return map[role] || role;
    }

    _getAccName(el) {
        return el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '';
    }

    _matchText(text, matcher) {
        if (!text) return false;
        const normalized = text.trim().toLowerCase();

        if (matcher instanceof RegExp) {
            return matcher.test(normalized);
        }
        return normalized.includes(matcher.toLowerCase());
    }

    _isVisible(el) {
        if (!el) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }
}
