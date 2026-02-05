/**
 * Automation Logger (v2)
 * Structured logging for the local automation engine.
 */
export class Logger {
    constructor(scope = 'Core') {
        this.scope = scope;
    }

    /**
     * persistent log history for debug export
     */
    static history = [];

    static _log(level, scope, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            scope,
            message,
            data
        };

        // Keep last 1000 logs
        if (Logger.history.length > 1000) {
            Logger.history.shift();
        }
        Logger.history.push(entry);

        const prefix = `[Lia360:${scope}]`;

        switch (level) {
            case 'INFO':
                if (data) console.log(prefix, message, data);
                else console.log(prefix, message);
                break;
            case 'WARN':
                if (data) console.warn(prefix, message, data);
                else console.warn(prefix, message);
                break;
            case 'ERROR':
                if (data) console.error(prefix, message, data);
                else console.error(prefix, message);
                break;
            case 'DEBUG':
                // Uncomment for verbose debugging
                // if (data) console.debug(prefix, message, data);
                // else console.debug(prefix, message);
                break;
        }

        // TODO: Emit event to Overlay if needed
        // window.dispatchEvent(new CustomEvent('lia-log', { detail: entry }));
    }

    info(message, data) {
        Logger._log('INFO', this.scope, message, data);
    }

    warn(message, data) {
        Logger._log('WARN', this.scope, message, data);
    }

    error(message, data) {
        Logger._log('ERROR', this.scope, message, data);
    }

    debug(message, data) {
        Logger._log('DEBUG', this.scope, message, data);
    }

    static getHistory() {
        return Logger.history;
    }

    static clearHistory() {
        Logger.history = [];
    }
}
