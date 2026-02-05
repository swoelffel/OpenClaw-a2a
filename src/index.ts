/**
 * A2A Protocol Extension for OpenClaw
 * 
 * Extension permettant la communication agent-to-agent via le protocole A2A.
 * 
 * Endpoints exposés :
 * - GET /.well-known/agent.json  : AgentCard pour découverte
 * - POST /a2a                    : Endpoint JSON-RPC A2A
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { AgentCard, JSONRPCResponse, TaskEvent, TaskSendSubscribeParams } from "./models.js";
import { handleRPC, SSE_STREAM_MARKER, type SSEStreamResponse } from "./rpc-handler.js";
import { taskManager } from "./task-manager.js";
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
  const config = api.pluginConfig as unknown as A2AExtensionState | undefined;
  
  if (!config?.enabled) {
    api.logger.info('A2A Protocol extension disabled');
    return;
  }

  // After this point, config is guaranteed to be defined (early return above)
  const a2aConfig = config as A2AExtensionState;

  // Initialize with OpenClaw runtime
  initializeA2AExtension(api as unknown as OpenClawPluginApi);

  const basePath = '/a2a';
  const agentCardPath = '/.well-known/agent.json';

  function buildAgentCard(): AgentCard {
    const cfg = api.config;
    const port = a2aConfig.port || 18789;
    const host = cfg.network?.host || 'localhost';
    const protocol = cfg.network?.tls?.enabled ? 'https' : 'http';
    const url = `${protocol}://${host}:${port}`;

    return {
      name: a2aConfig.agentName,
      description: a2aConfig.agentDescription,
      url: `${url}${basePath}`,
      version: '1.0.0',
      capabilities: {
        streaming: true,  // SSE streaming via tasks/sendSubscribe
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      skills: a2aConfig.skills.map(skill => ({
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

  /**
   * Handle SSE streaming for task subscription
   */
  async function handleSSEStream(
    req: IncomingMessage,
    res: ServerResponse,
    params: TaskSendSubscribeParams
  ): Promise<void> {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Create the task
    const task = await taskManager.createTask(params);

    // Send SSE event
    const sendEvent = (event: TaskEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Handler for task events
    const eventHandler = (event: TaskEvent) => {
      if (event.task.id === task.id) {
        sendEvent(event);
        
        // Close stream when task is terminal
        if (['completed', 'failed', 'canceled'].includes(event.task.status.state)) {
          taskManager.off('task', eventHandler);
          res.end();
        }
      }
    };

    // Subscribe to events
    taskManager.on('task', eventHandler);

    // Cleanup on connection close
    res.on('close', () => {
      taskManager.off('task', eventHandler);
    });
  }

  async function handleRPCEndpoint(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      if (a2aConfig.authToken) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
        const token = authHeader.slice(7);
        if (token !== a2aConfig.authToken) {
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
      
      // Check if this is an SSE stream response
      if (SSE_STREAM_MARKER in response && (response as SSEStreamResponse)[SSE_STREAM_MARKER]) {
        const sseResponse = response as SSEStreamResponse;
        return handleSSEStream(req, res, sseResponse.params);
      }
      
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

  // =========================================================================
  // REST ENDPOINTS for tasks
  // =========================================================================

  /**
   * GET /a2a/tasks - List all tasks with pagination
   */
  async function handleListTasks(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const cursor = url.searchParams.get('cursor') || undefined;
      const state = url.searchParams.get('state') as TaskEvent['task']['status']['state'] | undefined;

      const result = taskManager.listTasks({ limit, cursor, state });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        result
      }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal error' }
      }));
    }
  }

  /**
   * GET /a2a/tasks/:id - Get a task by ID
   */
  async function handleGetTask(req: IncomingMessage, res: ServerResponse, taskId: string): Promise<void> {
    try {
      const task = taskManager.getTask(taskId);

      if (!task) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32001, message: 'Task not found' }
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        result: task
      }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal error' }
      }));
    }
  }

  /**
   * POST /a2a/tasks/:id/cancel - Cancel a task
   */
  async function handleCancelTask(req: IncomingMessage, res: ServerResponse, taskId: string): Promise<void> {
    try {
      const result = taskManager.cancelTask(taskId);

      if (!result.success) {
        if (result.reason === 'not_found') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32001, message: 'Task not found' }
          }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32002, message: `Task cannot be canceled (current state: ${result.state})` }
          }));
        }
        return;
      }

      const task = taskManager.getTask(taskId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        result: task
      }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal error' }
      }));
    }
  }

  async function handleA2ARequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '';
    
    // Agent card
    if (url === agentCardPath && req.method === 'GET') {
      return handleAgentCard(req, res);
    }
    
    // JSON-RPC endpoint
    if (url === basePath && req.method === 'POST') {
      return handleRPCEndpoint(req, res);
    }
    
    // REST: List tasks
    if (url.startsWith(`${basePath}/tasks`) && req.method === 'GET') {
      const taskIdMatch = url.match(/\/a2a\/tasks\/([^/]+)$/);
      if (taskIdMatch && taskIdMatch[1]) {
        return handleGetTask(req, res, taskIdMatch[1]);
      }
      if (url === `${basePath}/tasks` || url.startsWith(`${basePath}/tasks?`)) {
        return handleListTasks(req, res);
      }
    }
    
    // REST: Cancel task
    const cancelMatch = url.match(/\/a2a\/tasks\/([^/]+)\/cancel$/);
    if (cancelMatch && cancelMatch[1] && req.method === 'POST') {
      return handleCancelTask(req, res, cancelMatch[1]);
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
