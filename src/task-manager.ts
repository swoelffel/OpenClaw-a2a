/**
 * Task Manager
 * 
 * Gestion du cycle de vie des tâches A2A :
 * - Stockage en mémoire
 * - Transitions d'état
 * - Exécution via le runtime OpenClaw
 */

import type { Task, TaskSendParams, Artifact, Message } from './models.js';

export type TaskHandler = (message: Message) => Promise<{
  response: Message;
  artifacts?: Artifact[];
}>;

export class TaskManager {
  private tasks = new Map<string, Task>();
  private handler: TaskHandler | null = null;

  setHandler(handler: TaskHandler): void {
    this.handler = handler;
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

    try {
      const lastMessage = task.history?.[task.history.length - 1];
      if (!lastMessage) {
        throw new Error('No message found in task history');
      }

      const result = await this.handler(lastMessage);
      
      if (task.history) {
        task.history.push(result.response);
      }
      
      if (result.artifacts) {
        task.artifacts = result.artifacts;
      }

      task.status = {
        state: 'completed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      task.status = {
        state: 'failed',
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error'
      };
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

    return true;
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    
    for (const [id, task] of this.tasks) {
      const taskTime = new Date(task.status.timestamp).getTime();
      if (taskTime < cutoff) {
        this.tasks.delete(id);
      }
    }
  }
}

export const taskManager = new TaskManager();
