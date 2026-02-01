/**
 * OpenClaw Integration
 * 
 * Connexion entre le Task Manager A2A et le runtime OpenClaw
 * pour traiter les tâches via le système de messaging existant.
 * 
 * This file handles both standalone mode and OpenClaw-integrated mode.
 */

import type { Message, Artifact, TextPart } from "./models.js";
import { taskManager, type TaskHandler } from "./task-manager.js";
import { TextPartSchema } from "./models.js";

// Type definitions for OpenClaw integration (optional)
interface A2AConfig {
  enabled: boolean;
  port: number;
  authToken?: string;
  agentName: string;
  agentDescription: string;
  skills: Array<{ id: string; name: string; description: string }>;
}

// Stub types for OpenClaw integration - these will be properly typed when loaded by OpenClaw
interface MsgContext {
  Body?: string;
  BodyForAgent?: string;
  RawBody?: string;
  CommandBody?: string;
  From?: string;
  To?: string;
  SessionKey?: string;
  Provider?: string;
  Surface?: string;
  ConversationLabel?: string;
  Timestamp?: number;
  CommandAuthorized?: boolean;
  [key: string]: unknown;
}

interface PluginRuntime {
  config: {
    loadConfig: () => Record<string, unknown>;
  };
  channel: {
    reply: {
      dispatchReplyWithBufferedBlockDispatcher: (params: {
        ctx: MsgContext;
        cfg: Record<string, unknown>;
        dispatcherOptions: {
          provider: string;
          to: string;
          enrichedContext: MsgContext;
        };
      }) => Promise<{ queuedFinal?: Array<{ text: string }> }>;
    };
  };
}

interface OpenClawPluginApi {
  id: string;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
}

export class OpenClawTaskHandler {
  private runtime?: PluginRuntime;
  private config: A2AConfig;
  private agentId: string = "default";

  constructor(config: A2AConfig, runtime?: PluginRuntime) {
    this.config = config;
    this.runtime = runtime;
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

export function initializeA2AExtension(api?: OpenClawPluginApi): void {
  // Standalone mode - no OpenClaw runtime
  if (!api) {
    console.log('A2A Protocol extension running in standalone mode');
    const config: A2AConfig = {
      enabled: true,
      port: 0,
      authToken: undefined,
      agentName: 'OpenClaw A2A Agent (Standalone)',
      agentDescription: 'A2A Protocol Agent running in standalone mode',
      skills: [],
    };
    
    a2aHandler = new OpenClawTaskHandler(config);
    taskManager.setHandler((message) => a2aHandler!.handle(message));
    return;
  }

  // OpenClaw integrated mode
  const pluginConfig = api.pluginConfig as unknown as A2AConfig | undefined;
  
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

  a2aHandler = new OpenClawTaskHandler(config, api.runtime);
  taskManager.setHandler((message) => a2aHandler!.handle(message));

  api.logger.info(`A2A Protocol extension initialized: ${config.agentName}`);
}

export function getA2AHandler(): OpenClawTaskHandler | null {
  return a2aHandler;
}

export type { A2AConfig, PluginRuntime, OpenClawPluginApi };
