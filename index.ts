/**
 * A2A Protocol Extension for OpenClaw
 * 
 * Extension permettant la communication agent-to-agent via le protocole A2A.
 * 
 * Endpoints exposés :
 * - GET /.well-known/agent.json  : AgentCard pour découverte
 * - POST /a2a                    : Endpoint JSON-RPC A2A
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentCard, JSONRPCResponse } from "./models.js";
import { handleRPC } from "./rpc-handler.js";
import { initializeA2AExtension, getA2AHandler, type A2AConfig, type OpenClawPluginApi } from "./integration.js";

interface A2AExtensionState {
  enabled: boolean;
  port: number;
  authToken?: string;
  agentName: string;
  agentDescription: string;
  skills: Array<{ id: string; name: string; description: string }>;
}

// Stub type for OpenClaw API - will be properly typed when loaded by OpenClaw
interface OpenClawPluginApiStub {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  config: {
    network?: {
      host?: string;
      tls?: { enabled?: boolean };
    };
  };
  pluginConfig?: Record<string, unknown>;
  logger: {
    info: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
  };
  registerHttpRoute: (params: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void }) => void;
  registerService: (service: { id: string; start: () => void | Promise<void>; stop?: () => void | Promise<void> }) => void;
}

export default function register(api: OpenClawPluginApiStub): void {
  const config = api.pluginConfig as A2AExtensionState | undefined;
  
  if (!config?.enabled) {
    api.logger.info('A2A Protocol extension disabled');
    return;
  }

  // Initialize with OpenClaw runtime
  initializeA2AExtension(api as unknown as OpenClawPluginApi);

  const basePath = '/a2a';
  const agentCardPath = '/.well-known/agent.json';

  function buildAgentCard(): AgentCard {
    const cfg = api.config;
    const port = config.port || 18789;
    const host = cfg.network?.host || 'localhost';
    const protocol = cfg.network?.tls?.enabled ? 'https' : 'http';
    const url = `${protocol}://${host}:${port}`;

    return {
      name: config.agentName,
      description: config.agentDescription,
      url: `${url}${basePath}`,
      version: '1.0.0',
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      skills: config.skills.map(skill => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
      })),
    };
  }

  async function handleAgentCard(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const agentCard = buildAgentCard();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(agentCard, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate AgentCard' }));
    }
  }

  async function handleRPCEndpoint(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      if (config.authToken) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
        const token = authHeader.slice(7);
        if (token !== config.authToken) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
      }

      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }

      let rpcRequest: unknown;
      try {
        rpcRequest = JSON.parse(body);
      } catch {
        const errorResponse: JSONRPCResponse = {
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
          id: undefined
        };
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(errorResponse));
        return;
      }

      const response = await handleRPC(rpcRequest);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      const errorResponse: JSONRPCResponse = {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: undefined
      };
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorResponse));
    }
  }

  async function handleA2ARequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.url === agentCardPath && req.method === 'GET') {
      return handleAgentCard(req, res);
    }
    if (req.url === basePath && req.method === 'POST') {
      return handleRPCEndpoint(req, res);
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  api.registerHttpRoute({
    path: '/a2a',
    handler: handleA2ARequest
  });

  api.registerService({
    id: 'a2a-protocol',
    start: async () => {
      api.logger.info('A2A Protocol service started');
    },
    stop: async () => {
      api.logger.info('A2A Protocol service stopped');
    }
  });

  api.logger.info(`A2A Protocol extension registered at ${basePath}`);
}

export type { A2AExtensionState };
