/**
 * Integration tests for A2A Protocol Extension
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleRPC } from '../src/rpc-handler.js';
import { taskManager } from '../src/task-manager.js';

describe('A2A Integration', () => {
  beforeEach(() => {
    taskManager.setHandler(async (msg) => ({
      response: {
        role: 'agent',
        parts: [{ type: 'text', text: `Agent received: ${msg.parts[0]?.text || ''}` }]
      }
    }));
  });

  describe('Agent to Agent Communication', () => {
    it('should handle complete task lifecycle', async () => {
      const taskId = `integration-task-${Date.now()}`;

      const sendRequest = {
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: taskId,
          sessionId: 'test-session',
          message: {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello from agent A' }]
          }
        },
        id: 'req-1'
      };

      const sendResponse = await handleRPC(sendRequest);

      expect(sendResponse.jsonrpc).toBe('2.0');
      expect(sendResponse.result).toBeDefined();
      expect(sendResponse.result!.id).toBe(taskId);

      const getResponse = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: taskId },
        id: 'req-2'
      });

      expect(getResponse.result).toBeDefined();
      expect(getResponse.result!.history).toHaveLength(2);
      expect(getResponse.result!.history![1].role).toBe('agent');
      expect(getResponse.result!.history![1].parts[0].text).toContain('Agent received');
    });

    it('should handle task cancellation before completion', async () => {
      taskManager.setHandler(async (msg) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { response: { role: 'agent', parts: [{ type: 'text', text: 'Slow response' }] } };
      });

      const sendResponse = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: `cancel-task-${Date.now()}`,
          message: { role: 'user', parts: [{ type: 'text', text: 'Cancel me' }] }
        },
        id: 'req-1'
      });

      expect(sendResponse.result).toBeDefined();

      const cancelResponse = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/cancel',
        params: { id: sendResponse.result!.id },
        id: 'req-2'
      });

      expect(cancelResponse.result).toEqual({ canceled: true });

      const getResponse = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: sendResponse.result!.id },
        id: 'req-3'
      });

      expect(getResponse.result!.status.state).toBe('canceled');
    });

    it('should handle session continuity', async () => {
      const sessionId = `session-${Date.now()}`;

      const tasks = [];
      for (let i = 0; i < 3; i++) {
        const response = await handleRPC({
          jsonrpc: '2.0',
          method: 'tasks/send',
          params: {
            id: `session-task-${i}-${Date.now()}`,
            sessionId,
            message: { role: 'user', parts: [{ type: 'text', text: `Message ${i}` }] }
          },
          id: `req-${i}`
        });
        tasks.push(response.result);
      }

      expect(tasks).toHaveLength(3);
      expect(tasks.every(t => t?.sessionId === sessionId)).toBe(true);
    });

    it('should handle error responses', async () => {
      taskManager.setHandler(async () => {
        throw new Error('Intentional error');
      });

      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: `error-task-${Date.now()}`,
          message: { role: 'user', parts: [{ type: 'text', text: 'This will fail' }] }
        },
        id: 'req-1'
      });

      expect(response.result).toBeDefined();

      await new Promise(resolve => setTimeout(resolve, 50));

      const getResponse = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: response.result!.id },
        id: 'req-2'
      });

      expect(getResponse.result!.status.state).toBe('failed');
      expect(getResponse.result!.status.message).toBe('Intentional error');
    });
  });

  describe('Message Format Compatibility', () => {
    it('should handle multi-part messages', async () => {
      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: `multipart-task-${Date.now()}`,
          message: {
            role: 'user',
            parts: [
              { type: 'text', text: 'First part' },
              { type: 'text', text: 'Second part' }
            ]
          }
        },
        id: 'req-1'
      });

      expect(response.result).toBeDefined();
      expect(response.result!.history![0].parts).toHaveLength(2);
    });

    it('should preserve message metadata', async () => {
      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: `metadata-task-${Date.now()}`,
          message: {
            role: 'user',
            parts: [{ type: 'text', text: 'With metadata' }],
            metadata: { source: 'test', priority: 'high' }
          }
        },
        id: 'req-1'
      });

      expect(response.result).toBeDefined();
      expect(response.result!.history![0].metadata).toEqual({ source: 'test', priority: 'high' });
    });

    it('should handle task metadata', async () => {
      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: `task-meta-task-${Date.now()}`,
          sessionId: 'session-1',
          message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
        },
        id: 'req-1'
      });

      expect(response.result).toBeDefined();
      expect(response.result!.metadata).toEqual({});
    });
  });

  describe('RPC Error Handling', () => {
    it('should return error for unknown method', async () => {
      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'unknown/method',
        params: {},
        id: 'req-1'
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
    });

    it('should return error for non-existent task', async () => {
      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: 'non-existent' },
        id: 'req-1'
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
    });
  });
});
