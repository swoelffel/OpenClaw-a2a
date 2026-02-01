"use strict";
/**
 * Task Manager
 *
 * Gestion du cycle de vie des tâches A2A :
 * - Stockage en mémoire
 * - Transitions d'état
 * - Exécution via le runtime OpenClaw
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskManager = exports.TaskManager = void 0;
class TaskManager {
    tasks = new Map();
    handler = null;
    setHandler(handler) {
        this.handler = handler;
    }
    async createTask(params) {
        const taskId = params.id;
        const sessionId = params.sessionId || crypto.randomUUID();
        const now = new Date().toISOString();
        const task = {
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
    async executeTask(taskId) {
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
        }
        catch (error) {
            task.status = {
                state: 'failed',
                timestamp: new Date().toISOString(),
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    cancelTask(taskId) {
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
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    cleanup(maxAgeMs = 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - maxAgeMs;
        for (const [id, task] of this.tasks) {
            const taskTime = new Date(task.status.timestamp).getTime();
            if (taskTime < cutoff) {
                this.tasks.delete(id);
            }
        }
    }
}
exports.TaskManager = TaskManager;
exports.taskManager = new TaskManager();
