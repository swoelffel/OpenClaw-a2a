/**
 * Unit tests for A2A Protocol Models
 */

import { describe, it, expect } from 'vitest';
import {
  TextPartSchema,
  FilePartSchema,
  MessageSchema,
  TaskStateSchema,
  TaskStatusSchema,
  TaskSchema,
  ArtifactSchema,
  AgentCardSchema,
  SkillSchema,
  AgentCapabilitiesSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseSchema,
  TaskSendParamsSchema,
  TaskGetParamsSchema,
  TaskCancelParamsSchema,
} from '../src/models.js';

describe('A2A Models', () => {
  describe('TextPartSchema', () => {
    it('should validate a valid text part', () => {
      const result = TextPartSchema.safeParse({
        type: 'text',
        text: 'Hello, world!'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('Hello, world!');
      }
    });

    it('should reject a text part without type', () => {
      const result = TextPartSchema.safeParse({
        text: 'No type'
      });
      expect(result.success).toBe(false);
    });

    it('should reject a text part with wrong type', () => {
      const result = TextPartSchema.safeParse({
        type: 'file',
        text: 'Wrong type'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('FilePartSchema', () => {
    it('should validate a file part with inline data', () => {
      const result = FilePartSchema.safeParse({
        type: 'file',
        file: {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          bytes: 'JVBERi0xLjQKJeLjz9MK...'
        }
      });
      expect(result.success).toBe(true);
    });

    it('should validate a file part with URI', () => {
      const result = FilePartSchema.safeParse({
        type: 'file',
        file: {
          name: 'image.png',
          mimeType: 'image/png',
          uri: 'https://example.com/image.png'
        }
      });
      expect(result.success).toBe(true);
    });
  });

  describe('MessageSchema', () => {
    it('should validate a valid user message', () => {
      const result = MessageSchema.safeParse({
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' }
        ]
      });
      expect(result.success).toBe(true);
    });

    it('should validate a valid agent message', () => {
      const result = MessageSchema.safeParse({
        role: 'agent',
        parts: [
          { type: 'text', text: 'Hello, how can I help?' }
        ]
      });
      expect(result.success).toBe(true);
    });

    it('should reject a message with invalid role', () => {
      const result = MessageSchema.safeParse({
        role: 'invalid',
        parts: [{ type: 'text', text: 'Hello' }]
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional metadata', () => {
      const result = MessageSchema.safeParse({
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
        metadata: { source: 'a2a' }
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TaskStateSchema', () => {
    it('should accept all valid states', () => {
      const states = ['submitted', 'working', 'completed', 'failed', 'canceled'];
      for (const state of states) {
        const result = TaskStateSchema.safeParse(state);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid states', () => {
      const result = TaskStateSchema.safeParse('invalid-state');
      expect(result.success).toBe(false);
    });
  });

  describe('TaskStatusSchema', () => {
    it('should validate a status with state and timestamp', () => {
      const result = TaskStatusSchema.safeParse({
        state: 'working',
        timestamp: '2026-02-01T12:00:00.000Z'
      });
      expect(result.success).toBe(true);
    });

    it('should provide default timestamp', () => {
      const result = TaskStatusSchema.safeParse({
        state: 'submitted'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toBeDefined();
      }
    });

    it('should accept optional message', () => {
      const result = TaskStatusSchema.safeParse({
        state: 'failed',
        message: 'Something went wrong'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TaskSchema', () => {
    it('should validate a complete task', () => {
      const result = TaskSchema.safeParse({
        id: 'task-123',
        sessionId: 'session-456',
        status: {
          state: 'completed',
          timestamp: '2026-02-01T12:00:00.000Z'
        },
        artifacts: [],
        history: [
          { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
        ]
      });
      expect(result.success).toBe(true);
    });

    it('should accept task without optional fields', () => {
      const result = TaskSchema.safeParse({
        id: 'task-123',
        sessionId: 'session-456',
        status: { state: 'submitted' }
      });
      expect(result.success).toBe(true);
    });

    it('should provide default empty artifacts', () => {
      const result = TaskSchema.safeParse({
        id: 'task-123',
        sessionId: 'session-456',
        status: { state: 'submitted' }
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
      }
    });
  });

  describe('ArtifactSchema', () => {
    it('should validate a valid artifact', () => {
      const result = ArtifactSchema.safeParse({
        parts: [{ type: 'text', text: 'Result' }],
        metadata: { type: 'output' }
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional index', () => {
      const result = ArtifactSchema.safeParse({
        parts: [{ type: 'text', text: 'Result' }],
        index: 0
      });
      expect(result.success).toBe(true);
    });
  });

  describe('AgentCardSchema', () => {
    it('should validate a valid agent card', () => {
      const result = AgentCardSchema.safeParse({
        name: 'OpenClaw Agent',
        description: 'An AI agent with A2A support',
        url: 'https://example.com/a2a',
        version: '1.0.0',
        capabilities: {
          streaming: false,
          pushNotifications: false,
          stateTransitionHistory: true
        },
        skills: []
      });
      expect(result.success).toBe(true);
    });

    it('should provide default input/output modes', () => {
      const result = AgentCardSchema.safeParse({
        name: 'Test Agent',
        description: 'Test',
        url: 'https://test.com/a2a',
        version: '1.0.0',
        capabilities: {},
        skills: []
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultInputModes).toEqual(['text']);
        expect(result.data.defaultOutputModes).toEqual(['text']);
      }
    });

    it('should validate skills array', () => {
      const result = AgentCardSchema.safeParse({
        name: 'Test Agent',
        description: 'Test',
        url: 'https://test.com/a2a',
        version: '1.0.0',
        capabilities: {},
        skills: [
          { id: 'skill-1', name: 'Test Skill', description: 'A test skill' }
        ]
      });
      expect(result.success).toBe(true);
    });
  });

  describe('SkillSchema', () => {
    it('should validate a valid skill', () => {
      const result = SkillSchema.safeParse({
        id: 'my-skill',
        name: 'My Skill',
        description: 'Does amazing things',
        tags: ['utility', 'test'],
        examples: ['Do something']
      });
      expect(result.success).toBe(true);
    });

    it('should accept skill with only required fields', () => {
      const result = SkillSchema.safeParse({
        id: 'minimal',
        name: 'Minimal',
        description: 'Just enough'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('AgentCapabilitiesSchema', () => {
    it('should provide default capability values', () => {
      const result = AgentCapabilitiesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.streaming).toBe(false);
        expect(result.data.pushNotifications).toBe(false);
        expect(result.data.stateTransitionHistory).toBe(false);
      }
    });
  });

  describe('JSONRPCRequestSchema', () => {
    it('should validate a valid JSON-RPC request', () => {
      const result = JSONRPCRequestSchema.safeParse({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: { id: 'task-1' },
        id: 'req-123'
      });
      expect(result.success).toBe(true);
    });

    it('should accept numeric id', () => {
      const result = JSONRPCRequestSchema.safeParse({
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: 'task-1' },
        id: 42
      });
      expect(result.success).toBe(true);
    });

    it('should reject request without jsonrpc version', () => {
      const result = JSONRPCRequestSchema.safeParse({
        method: 'tasks/send',
        params: {},
        id: '1'
      });
      expect(result.success).toBe(false);
    });

    it('should reject request with wrong jsonrpc version', () => {
      const result = JSONRPCRequestSchema.safeParse({
        jsonrpc: '1.0',
        method: 'tasks/send',
        params: {},
        id: '1'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('JSONRPCResponseSchema', () => {
    it('should validate a successful response', () => {
      const result = JSONRPCResponseSchema.safeParse({
        jsonrpc: '2.0',
        result: { taskId: '123' },
        id: 'req-1'
      });
      expect(result.success).toBe(true);
    });

    it('should validate an error response', () => {
      const result = JSONRPCResponseSchema.safeParse({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid request'
        },
        id: 'req-1'
      });
      expect(result.success).toBe(true);
    });

    it('should reject response without result or error', () => {
      const result = JSONRPCResponseSchema.safeParse({
        jsonrpc: '2.0',
        id: 'req-1'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TaskSendParamsSchema', () => {
    it('should validate valid send params', () => {
      const result = TaskSendParamsSchema.safeParse({
        id: 'task-123',
        sessionId: 'session-456',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      });
      expect(result.success).toBe(true);
    });

    it('should accept params without sessionId', () => {
      const result = TaskSendParamsSchema.safeParse({
        id: 'task-123',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      });
      expect(result.success).toBe(true);
    });

    it('should reject params without message', () => {
      const result = TaskSendParamsSchema.safeParse({
        id: 'task-123'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TaskGetParamsSchema', () => {
    it('should validate valid get params', () => {
      const result = TaskGetParamsSchema.safeParse({
        id: 'task-123'
      });
      expect(result.success).toBe(true);
    });

    it('should reject get params without id', () => {
      const result = TaskGetParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('TaskCancelParamsSchema', () => {
    it('should validate valid cancel params', () => {
      const result = TaskCancelParamsSchema.safeParse({
        id: 'task-123'
      });
      expect(result.success).toBe(true);
    });

    it('should reject cancel params without id', () => {
      const result = TaskCancelParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
