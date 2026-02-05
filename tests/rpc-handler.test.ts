/**
 * Unit tests for RPC Handler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleRPC } from '../src/rpc-handler.js';
import { taskManager } from '../src/task-manager.js';

describe('RPC Handler', () => {
  beforeEach(() => {
    taskManager.setHandler(async (msg) => ({
      response: { role: 'agent', parts: [{ type: 'text', text: 'Processed' }] }
    }));
  });

  describe('handleRPC', () => {
    it('should handle tasks/send request', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: 'rpc-task-1',
          message: {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }]
          }
        },
        id: 'req-1'
      };

      const response = await handleRPC(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-1');
      expect(response.result).toBeDefined();
      if (response.result) {
        expect(response.result.id).toBe('rpc-task-1');
        expect(response.result.history).toHaveLength(2);
      }
    });

    it('should handle tasks/get request', async () => {
      const sendRequest = {
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: 'rpc-task-2',
          message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
        },
        id: 'req-send'
      };
      await handleRPC(sendRequest);

      const getRequest = {
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: 'rpc-task-2' },
        id: 'req-get'
      };

      const response = await handleRPC(getRequest);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-get');
      expect(response.result).toBeDefined();
      if (response.result) {
        expect(response.result.id).toBe('rpc-task-2');
      }
    });

    it('should return error for non-existent task in tasks/get', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: 'non-existent' },
        id: 'req-1'
      };

      const response = await handleRPC(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
      expect(response.error!.message).toContain('Task not found');
    });

    it('should handle tasks/cancel request for completed task', async () => {
      const sendRequest = {
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: 'rpc-task-3',
          message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
        },
        id: 'req-send'
      };
      await handleRPC(sendRequest);

      const cancelRequest = {
        jsonrpc: '2.0',
        method: 'tasks/cancel',
        params: { id: 'rpc-task-3' },
        id: 'req-cancel'
      };

      const response = await handleRPC(cancelRequest);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-cancel');
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32002);
    });

    it('should return error for non-existent task in tasks/cancel', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tasks/cancel',
        params: { id: 'non-existent' },
        id: 'req-1'
      };

      const response = await handleRPC(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
      expect(response.error!.message).toContain('not found');
    });

    it('should return error for unknown method', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'unknown/method',
        params: {},
        id: 'req-1'
      };

      const response = await handleRPC(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
      expect(response.error!.message).toContain('Method not found');
    });

    it('should return invalid request error for non-object input', async () => {
      const response = await handleRPC('not valid json');

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32600);
    });

    it('should return invalid request error for malformed request', async () => {
      const response = await handleRPC({
        method: 'tasks/send',
        params: {}
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32600);
    });

    it('should return invalid params error for malformed params', async () => {
      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: { invalid: 'params' },
        id: 'req-1'
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
    });

    it('should handle missing id in request', async () => {
      const response = await handleRPC({
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: 'test' }
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeUndefined();
    });

    it('should propagate id from request to response', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: 'rpc-task-4',
          message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
        },
        id: 42
      };

      const response = await handleRPC(request);

      expect(response.id).toBe(42);
    });
  });
});
