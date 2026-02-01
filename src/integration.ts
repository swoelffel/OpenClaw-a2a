/**
 * OpenClaw Integration
 * 
 * Connexion entre le Task Manager A2A et le runtime OpenClaw
 * pour traiter les tâches via le système de messaging existant.
 */

import type { MsgContext } from "../../auto-reply/templating.js";
import type { OpenClawPluginApi } from "../../plugins/types.js";
import type { PluginRuntime } from "../../plugins/runtime/types.js";
import type { TaskHandler, Message, Artifact, TextPart } from "./models.js";
import { taskManager } from "./task-manager.js";
import { TextPartSchema } from "./models.js";

interface A2AConfig {
  enabled: boolean;
  port: number;
  authToken?: string;
  agentName: string;
  agentDescription: string;
  skills: Array<{ id: string; name: string; description: string }>;
}

export class OpenClawTaskHandler implements TaskHandler {
  private runtime: PluginRuntime;
  private config: A2AConfig;
  private agentId: string = "default";

  constructor(runtime: PluginRuntime, config: A2AConfig) {
    this.runtime = runtime;
    this.config = config;
  }

  async handle(a2aMessage: Message): Promise<{ response: Message; artifacts?: Artifact[] }> {
    const textContent = this.extractTextFromMessage(a2aMessage);
    
    if (!textContent) {
      return {
        response: {
          role: 'agent',
          parts: [{ type: 'text', text: 'Cannot process empty message' }]
        }
      };
    }

    const ctx = this.createMsgContext(a2aMessage, textContent);
    const cfg = this.runtime.config.loadConfig();

    try {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        response: {
          role: 'agent',
          parts: [{ type: 'text', text: `Error processing request: ${errorMessage}` }]
        }
      };
    }
  }

  private extractTextFromMessage(message: Message): string {
    const textParts = message.parts
      .filter((part): part is TextPart => {
        const parsed = TextPartSchema.safeParse(part);
        return parsed.success && parsed.data.type === 'text';
      })
      .map(part => part.text);

    return textParts.join('\n');
  }

  private createMsgContext(a2aMessage: Message, textContent: string): MsgContext {
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

  private extractResponseFromResult(result: { queuedFinal?: Array<{ text: string }> }): string {
    if (result.queuedFinal && result.queuedFinal.length > 0) {
      return result.queuedFinal.map(msg => msg.text).join('\n');
    }
    return 'No response generated';
  }
}

let a2aHandler: OpenClawTaskHandler | null = null;

export function initializeA2AExtension(api: OpenClawPluginApi): void {
  const pluginConfig = api.pluginConfig as A2AConfig | undefined;
  
  if (!pluginConfig?.enabled) {
    api.logger.info('A2A Protocol extension disabled');
    return;
  }

  const config: A2AConfig = {
    enabled: true,
    port: pluginConfig.port || 0,
    authToken: pluginConfig.authToken,
    agentName: pluginConfig.agentName || 'OpenClaw Agent',
    agentDescription: pluginConfig.agentDescription || 'OpenClaw AI Agent with A2A support',
    skills: pluginConfig.skills || [],
  };

  a2aHandler = new OpenClawTaskHandler(api.runtime, config);
  taskManager.setHandler(a2aHandler);

  api.logger.info(`A2A Protocol extension initialized: ${config.agentName}`);
}

export function getA2AHandler(): OpenClawTaskHandler | null {
  return a2aHandler;
}

export type { A2AConfig };
