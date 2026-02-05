import { Logger } from './Logger.js';
import { ElementResolver } from './ElementResolver.js';
import { ActionExecutor } from './ActionExecutor.js';
import { TabPersistence } from './TabPersistence.js';

export class StateMachine {
    constructor(config) {
        this.config = config;
        this.state = {
            current: config.initialState,
            context: {}, // User data (counts, leads, etc)
            history: []
        };

        this.logger = new Logger('Engine');
        this.resolver = new ElementResolver();
        this.executor = new ActionExecutor();
        this.persistence = new TabPersistence('linkedin_v2'); // TODO: Dynamic ID

        this.isRunning = false;
        this.abortController = null;
    }

    async start(initialContext = {}) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.state.context = { ...initialContext };
        this.logger.info('Engine started', { state: this.state.current });

        await this._loop();
    }

    async stop() {
        this.isRunning = false;
        this.logger.info('Engine stopped');
        await this.persistence.save(this.state);
    }

    async _loop() {
        while (this.isRunning) {
            const stateName = this.state.current;
            const stateDef = this.config.states[stateName];

            if (!stateDef) {
                this.logger.error(`State definition not found: ${stateName}`);
                this.isRunning = false;
                break;
            }

            this.logger.info(`Entering State: ${stateName}`);

            try {
                // 1. Resolve Target (if defined)
                let element = null;
                if (!this.isRunning) break;

                if (stateDef.resolve) {
                    element = this.resolver.resolve(stateDef.resolve);
                    if (!element && stateDef.onMissing) {
                        this._transition(stateDef.onMissing);
                        continue;
                    }
                    if (!element && !stateDef.optional) {
                        throw new Error(`Target not found for state ${stateName}`);
                    }
                }

                // 2. Execute Action (if defined)
                if (stateDef.action) {
                    if (!this.isRunning) break;
                    const result = await this._executeAction(stateDef.action, element, stateDef.params);
                    if (!this.isRunning) break;

                    if (!result && stateDef.fallback) {
                        this._transition(stateDef.fallback);
                        continue;
                    }
                }

                // 3. User Check / Predicate
                if (stateDef.check) {
                    if (!this.isRunning) break;
                    const result = await stateDef.check(this.state.context);
                    if (!this.isRunning) break;

                    const next = result ? stateDef.onTrue : stateDef.onFalse;
                    this._transition(next);
                    continue;
                }

                // 4. Default Transition
                if (!this.isRunning) break;
                if (stateDef.next) {
                    this._transition(stateDef.next);
                } else {
                    this.logger.info('No next state defined. Finished.');
                    this.isRunning = false;
                }

            } catch (e) {
                this.logger.error('Error in loop', e);
                this.isRunning = false;
            }

            // Persistence checkpoint
            if (!this.isRunning) break;
            await this.persistence.save(this.state);

            // Loop throttle
            if (!this.isRunning) break;
            await this.executor.sleep(500, 1000);
        }
    }

    _transition(nextState) {
        if (this.config.states[nextState]) {
            this.state.history.push(this.state.current);
            this.state.current = nextState;
        } else {
            this.logger.error(`Invalid transition to: ${nextState}`);
            this.isRunning = false;
        }
    }

    async _executeAction(actionType, element, params) {
        switch (actionType) {
            case 'click':
                return await this.executor.click(element);
            case 'type':
                return await this.executor.type(element, params?.text);
            case 'scroll':
                return await this.executor.scrollTo(element || document.body); // Fix scroll target
            case 'wait':
                await this.executor.sleep(params?.ms || 1000);
                return true;
            case 'custom':
                if (typeof params?.execute === 'function') {
                    return await params.execute(element, this.state.context);
                }
                this.logger.error('Custom action missing execute function');
                return false;
            case 'extract':
                // This would call external extractor logic
                return true;
            default:
                this.logger.warn(`Unknown action: ${actionType}`);
                return false;
        }
    }
}
