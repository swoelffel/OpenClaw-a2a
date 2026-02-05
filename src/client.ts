/**
 * A2A Client
 * 
 * Client HTTP pour communiquer avec d'autres agents A2A
 */

import type { AgentCard, Task, TaskSendParams, JSONRPCResponse } from './models.js';

export interface A2AClientOptions {
  authToken?: string;
  timeout?: number;
}

export class A2AClient {
  private baseUrl: string;
  private options: A2AClientOptions;
  
  constructor(baseUrl: string, options: A2AClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.options = {
      timeout: 30000,
      ...options
    };
  }
  
  private createAbortController(): { controller: AbortController; clear: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
    return {
      controller,
      clear: () => clearTimeout(timeoutId)
    };
  }

  async getAgentCard(): Promise<AgentCard> {
    const url = `${this.baseUrl}/.well-known/agent.json`;
    const { controller, clear } = this.createAbortController();
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch AgentCard: ${response.status} ${response.statusText}`);
      }
      
      return response.json() as Promise<AgentCard>;
    } finally {
      clear();
    }
  }
  
  async sendTask(params: TaskSendParams): Promise<Task> {
    const requestId = crypto.randomUUID();
    const { controller, clear } = this.createAbortController();
    
    const rpcRequest = {
      jsonrpc: '2.0' as const,
      method: 'tasks/send',
      params,
      id: requestId
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.options.authToken) {
      headers['Authorization'] = `Bearer ${this.options.authToken}`;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/a2a`, {
        method: 'POST',
        headers,
        body: JSON.stringify(rpcRequest),
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const rpcResponse = await response.json() as JSONRPCResponse;
      
      if (rpcResponse.error) {
        throw new Error(`RPC error ${rpcResponse.error.code}: ${rpcResponse.error.message}`);
      }
      
      if (!rpcResponse.result) {
        throw new Error('RPC response missing result');
      }
      
      return rpcResponse.result as Task;
    } finally {
      clear();
    }
  }
  
  async getTask(taskId: string): Promise<Task> {
    const requestId = crypto.randomUUID();
    const { controller, clear } = this.createAbortController();
    
    const rpcRequest = {
      jsonrpc: '2.0' as const,
      method: 'tasks/get',
      params: { id: taskId },
      id: requestId
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.options.authToken) {
      headers['Authorization'] = `Bearer ${this.options.authToken}`;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/a2a`, {
        method: 'POST',
        headers,
        body: JSON.stringify(rpcRequest),
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const rpcResponse = await response.json() as JSONRPCResponse;
      
      if (rpcResponse.error) {
        throw new Error(`RPC error ${rpcResponse.error.code}: ${rpcResponse.error.message}`);
      }
      
      if (!rpcResponse.result) {
        throw new Error('RPC response missing result');
      }
      
      return rpcResponse.result as Task;
    } finally {
      clear();
    }
  }
  
  async cancelTask(taskId: string): Promise<boolean> {
    const requestId = crypto.randomUUID();
    const { controller, clear } = this.createAbortController();
    
    const rpcRequest = {
      jsonrpc: '2.0' as const,
      method: 'tasks/cancel',
      params: { id: taskId },
      id: requestId
    };
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.options.authToken) {
      headers['Authorization'] = `Bearer ${this.options.authToken}`;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/a2a`, {
        method: 'POST',
        headers,
        body: JSON.stringify(rpcRequest),
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const rpcResponse = await response.json() as JSONRPCResponse;
      
      if (rpcResponse.error) {
        throw new Error(`RPC error ${rpcResponse.error.code}: ${rpcResponse.error.message}`);
      }
      
      return (rpcResponse.result as { canceled: boolean })?.canceled ?? false;
    } finally {
      clear();
    }
  }
}

export function createA2AClient(baseUrl: string, options?: A2AClientOptions): A2AClient {
  return new A2AClient(baseUrl, options);
}
