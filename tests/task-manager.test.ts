/**
 * Unit tests for Task Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../src/task-manager.js';
import type { Message, TaskSendParams } from '../src/models.js';

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager();
  });

  describe('setHandler', () => {
    it('should set the task handler', async () => {
      const handler = vi.fn();
      manager.setHandler(handler);
      expect(manager).toBeDefined();
    });
  });

  describe('createTask', () => {
    it('should create a new task with generated sessionId', async () => {
      const handler = vi.fn().mockResolvedValue({
        response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] }
      });
      manager.setHandler(handler);

      const params: TaskSendParams = {
        id: 'test-task-1',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      const task = await manager.createTask(params);

      expect(task.id).toBe('test-task-1');
      expect(task.sessionId).toBeDefined();
      expect(task.history).toHaveLength(2);
      expect(task.history![0].role).toBe('user');
      expect(task.history![1].role).toBe('agent');
    });

    it('should use provided sessionId', async () => {
      const handler = vi.fn().mockResolvedValue({
        response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] }
      });
      manager.setHandler(handler);

      const params: TaskSendParams = {
        id: 'test-task-2',
        sessionId: 'my-custom-session',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      const task = await manager.createTask(params);

      expect(task.sessionId).toBe('my-custom-session');
    });

    it('should store task in internal map', async () => {
      const handler = vi.fn().mockResolvedValue({
        response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] }
      });
      manager.setHandler(handler);

      const params: TaskSendParams = {
        id: 'test-task-3',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      await manager.createTask(params);
      const storedTask = manager.getTask('test-task-3');

      expect(storedTask).toBeDefined();
      expect(storedTask!.id).toBe('test-task-3');
    });

    it('should execute task asynchronously', async () => {
      const handler = vi.fn().mockImplementation(async (msg: Message) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] } };
      });
      manager.setHandler(handler);

      const params: TaskSendParams = {
        id: 'test-task-4',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      const task = await manager.createTask(params);
      expect(task.status.state).toBe('working');

      await new Promise(resolve => setTimeout(resolve, 100));

      const completedTask = manager.getTask('test-task-4');
      expect(completedTask!.status.state).toBe('completed');
    });

    it('should handle task without handler gracefully', async () => {
      const params: TaskSendParams = {
        id: 'test-task-5',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      const task = await manager.createTask(params);
      expect(task.status.state).toBe('submitted');
    });
  });

  describe('getTask', () => {
    it('should return undefined for non-existent task', () => {
      const task = manager.getTask('non-existent');
      expect(task).toBeUndefined();
    });

    it('should return stored task', async () => {
      const handler = vi.fn().mockResolvedValue({
        response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] }
      });
      manager.setHandler(handler);

      const params: TaskSendParams = {
        id: 'test-task-6',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      await manager.createTask(params);
      const task = manager.getTask('test-task-6');

      expect(task).toBeDefined();
      expect(task!.id).toBe('test-task-6');
    });
  });

  describe('cancelTask', () => {
    it('should return not_found for non-existent task', () => {
      const result = manager.cancelTask('non-existent');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should cancel a task without handler (stays submitted)', async () => {
      const params: TaskSendParams = {
        id: 'test-task-7',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      await manager.createTask(params);
      const result = manager.cancelTask('test-task-7');

      expect(result.success).toBe(true);
      const task = manager.getTask('test-task-7');
      expect(task!.status.state).toBe('canceled');
    });

    it('should not cancel a completed task', async () => {
      const handler = vi.fn().mockResolvedValue({
        response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] }
      });
      manager.setHandler(handler);

      const params: TaskSendParams = {
        id: 'test-task-8',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      await manager.createTask(params);
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = manager.cancelTask('test-task-8');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('terminal_state');
      expect(result.state).toBe('completed');
    });

    it('should not cancel a failed task', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Failed'));
      manager.setHandler(handler);

      const params: TaskSendParams = {
        id: 'test-task-9',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      };

      await manager.createTask(params);
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = manager.cancelTask('test-task-9');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('terminal_state');
      expect(result.state).toBe('failed');
    });
  });

  describe('getAllTasks', () => {
    it('should return empty array when no tasks', () => {
      const tasks = manager.getAllTasks();
      expect(tasks).toEqual([]);
    });

    it('should return all stored tasks', async () => {
      const handler = vi.fn().mockResolvedValue({
        response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] }
      });
      manager.setHandler(handler);

      for (let i = 0; i < 3; i++) {
        await manager.createTask({
          id: `task-${i}`,
          message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
        });
      }

      const tasks = manager.getAllTasks();
      expect(tasks).toHaveLength(3);
    });
  });

  describe('cleanup', () => {
    it('should remove old completed tasks', async () => {
      const handler = vi.fn().mockResolvedValue({
        response: { role: 'agent', parts: [{ type: 'text', text: 'Done' }] }
      });
      manager.setHandler(handler);

      await manager.createTask({
        id: 'old-task',
        message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      const oldTask = manager.getTask('old-task');
      expect(oldTask).toBeDefined();

      manager.cleanup(0);

      const cleanedTask = manager.getTask('old-task');
      expect(cleanedTask).toBeUndefined();
    });
  });
});
