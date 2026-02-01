/**
 * Task Manager
 * 
 * Gestion du cycle de vie des tâches A2A :
 * - Stockage en mémoire
 * - Transitions d'état
 * - Exécution via le runtime OpenClaw
 * - Event emission for SSE streaming
 */

import { EventEmitter } from 'events';
import type { Task, TaskSendParams, TaskListParams, TaskEvent, TaskState, Artifact, Message } from './models.js';

export type TaskHandler = (message: Message) => Promise<{
  response: Message;
  artifacts?: Artifact[];
}>;

export interface TaskListResult {
  tasks: Task[];
  nextCursor?: string;
  hasMore: boolean;
}

export class TaskManager extends EventEmitter {
  private tasks = new Map<string, Task>();
  private taskOrder: string[] = []; // Track insertion order for pagination
  private handler: TaskHandler | null = null;

  setHandler(handler: TaskHandler): void {
    this.handler = handler;
  }

  private emitTaskEvent(type: TaskEvent['type'], task: Task, extra?: { artifact?: Artifact; message?: Message }): void {
    const event: TaskEvent = {
      type,
      task,
      ...extra
    };
    this.emit('task', event);
  }

  async createTask(params: TaskSendParams): Promise<Task> {
    const taskId = params.id;
    const sessionId = params.sessionId || crypto.randomUUID();
    
    const now = new Date().toISOString();
    
    const task: Task = {
      id: taskId,
      sessionId,
      status: {
        state: 'submitted',
        timestamp: now
      },
      artifacts: [],
      history: [params.message],
      metadata: {}
    };

    this.tasks.set(taskId, task);
    this.taskOrder.push(taskId);
    
    // Emit status event for task creation
    this.emitTaskEvent('status', task);
    
    this.executeTask(taskId).catch(error => {
      console.error(`Task execution failed for ${taskId}:`, error);
    });
    
    return task;
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !this.handler) {
      return;
    }

    task.status = {
      state: 'working',
      timestamp: new Date().toISOString()
    };
    this.emitTaskEvent('status', task);

    try {
      const lastMessage = task.history?.[task.history.length - 1];
      if (!lastMessage) {
        throw new Error('No message found in task history');
      }

      const result = await this.handler(lastMessage);
      
      if (task.history) {
        task.history.push(result.response);
        this.emitTaskEvent('message', task, { message: result.response });
      }
      
      if (result.artifacts) {
        task.artifacts = result.artifacts;
        // Emit artifact events
        for (const artifact of result.artifacts) {
          this.emitTaskEvent('artifact', task, { artifact });
        }
      }

      task.status = {
        state: 'completed',
        timestamp: new Date().toISOString()
      };
      this.emitTaskEvent('status', task);
    } catch (error) {
      task.status = {
        state: 'failed',
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      this.emitTaskEvent('status', task);
    }
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return false;
    }

    if (task.status.state === 'completed' || task.status.state === 'failed') {
      return false;
    }

    task.status = {
      state: 'canceled',
      timestamp: new Date().toISOString()
    };
    this.emitTaskEvent('status', task);

    return true;
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * List tasks with pagination and optional state filter
   */
  listTasks(params: TaskListParams = { limit: 50 }): TaskListResult {
    const { limit = 50, cursor, state } = params;
    
    // Find starting index
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = this.taskOrder.indexOf(cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    // Collect tasks with optional state filter
    const tasks: Task[] = [];

    for (let i = startIndex; i < this.taskOrder.length && tasks.length < limit; i++) {
      const taskId = this.taskOrder[i];
      if (!taskId) continue;
      
      const task = this.tasks.get(taskId);
      if (task) {
        if (!state || task.status.state === state) {
          tasks.push(task);
        }
      }
    }

    // Check if there are more
    const lastTask = tasks[tasks.length - 1];
    const lastTaskId = lastTask?.id;
    const lastTaskIndex = lastTaskId ? this.taskOrder.indexOf(lastTaskId) : -1;
    const hasMore = lastTaskIndex >= 0 && lastTaskIndex < this.taskOrder.length - 1;

    const result: TaskListResult = {
      tasks,
      hasMore
    };
    
    if (hasMore && lastTaskId) {
      result.nextCursor = lastTaskId;
    }

    return result;
  }

  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    
    for (const [id, task] of this.tasks) {
      const taskTime = new Date(task.status.timestamp).getTime();
      if (taskTime < cutoff) {
        this.tasks.delete(id);
        const orderIndex = this.taskOrder.indexOf(id);
        if (orderIndex !== -1) {
          this.taskOrder.splice(orderIndex, 1);
        }
      }
    }
  }
}

export const taskManager = new TaskManager();
