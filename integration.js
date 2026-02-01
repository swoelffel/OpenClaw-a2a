"use strict";
/**
 * OpenClaw Integration
 *
 * Connexion entre le Task Manager A2A et le runtime OpenClaw
 * pour traiter les tâches via le système de messaging existant.
 *
 * This file handles both standalone mode and OpenClaw-integrated mode.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawTaskHandler = void 0;
exports.initializeA2AExtension = initializeA2AExtension;
exports.getA2AHandler = getA2AHandler;
const task_manager_js_1 = require("./task-manager.js");
const models_js_1 = require("./models.js");
class OpenClawTaskHandler {
    runtime;
    config;
    agentId = "default";
    constructor(config, runtime) {
        this.config = config;
        this.runtime = runtime;
    }
    async handle(a2aMessage) {
        const textContent = this.extractTextFromMessage(a2aMessage);
        if (!textContent) {
            return {
                response: {
                    role: 'agent',
                    parts: [{ type: 'text', text: 'Cannot process empty message' }]
                }
            };
        }
        // If no OpenClaw runtime, return a mock response for testing
        if (!this.runtime) {
            return {
                response: {
                    role: 'agent',
                    parts: [{ type: 'text', text: `Received: ${textContent}` }]
                }
            };
        }
        const ctx = this.createMsgContext(a2aMessage, textContent);
        try {
            const cfg = this.runtime.config.loadConfig();
            const result = await this.runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                ctx,
                cfg,
                dispatcherOptions: {
                    provider: 'a2a',
                    to: 'a2a-agent',
                    enrichedContext: ctx,
                }
            });
            const agentResponse = this.extractResponseFromResult(result);
            return {
                response: {
                    role: 'agent',
                    parts: [{ type: 'text', text: agentResponse }]
                }
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                response: {
                    role: 'agent',
                    parts: [{ type: 'text', text: `Error processing request: ${errorMessage}` }]
                }
            };
        }
    }
    extractTextFromMessage(message) {
        const textParts = message.parts
            .filter((part) => {
            const parsed = models_js_1.TextPartSchema.safeParse(part);
            return parsed.success && parsed.data.type === 'text';
        })
            .map(part => part.text);
        return textParts.join('\n');
    }
    createMsgContext(a2aMessage, textContent) {
        const sessionKey = `a2a-${a2aMessage.metadata?.sessionId || crypto.randomUUID()}`;
        return {
            Body: textContent,
            BodyForAgent: textContent,
            RawBody: textContent,
            CommandBody: textContent,
            From: 'a2a-remote',
            To: 'local-agent',
            SessionKey: sessionKey,
            Provider: 'a2a',
            Surface: 'a2a',
            ConversationLabel: `A2A Session`,
            Timestamp: Date.now(),
            CommandAuthorized: true,
        };
    }
    extractResponseFromResult(result) {
        if (result.queuedFinal && result.queuedFinal.length > 0) {
            return result.queuedFinal.map(msg => msg.text).join('\n');
        }
        return 'No response generated';
    }
}
exports.OpenClawTaskHandler = OpenClawTaskHandler;
let a2aHandler = null;
function initializeA2AExtension(api) {
    // Standalone mode - no OpenClaw runtime
    if (!api) {
        console.log('A2A Protocol extension running in standalone mode');
        const config = {
            enabled: true,
            port: 0,
            authToken: undefined,
            agentName: 'OpenClaw A2A Agent (Standalone)',
            agentDescription: 'A2A Protocol Agent running in standalone mode',
            skills: [],
        };
        a2aHandler = new OpenClawTaskHandler(config);
        task_manager_js_1.taskManager.setHandler((message) => a2aHandler.handle(message));
        return;
    }
    // OpenClaw integrated mode
    const pluginConfig = api.pluginConfig;
    if (!pluginConfig?.enabled) {
        api.logger.info('A2A Protocol extension disabled');
        return;
    }
    const config = {
        enabled: true,
        port: pluginConfig.port || 0,
        authToken: pluginConfig.authToken,
        agentName: pluginConfig.agentName || 'OpenClaw Agent',
        agentDescription: pluginConfig.agentDescription || 'OpenClaw AI Agent with A2A support',
        skills: pluginConfig.skills || [],
    };
    a2aHandler = new OpenClawTaskHandler(config, api.runtime);
    task_manager_js_1.taskManager.setHandler((message) => a2aHandler.handle(message));
    api.logger.info(`A2A Protocol extension initialized: ${config.agentName}`);
}
function getA2AHandler() {
    return a2aHandler;
}
