"use strict";
/**
 * A2A Client
 *
 * Client HTTP pour communiquer avec d'autres agents A2A
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AClient = void 0;
exports.createA2AClient = createA2AClient;
class A2AClient {
    baseUrl;
    options;
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.options = {
            timeout: 30000,
            ...options
        };
    }
    async getAgentCard() {
        const url = `${this.baseUrl}/.well-known/agent.json`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch AgentCard: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async sendTask(params) {
        const requestId = crypto.randomUUID();
        const rpcRequest = {
            jsonrpc: '2.0',
            method: 'tasks/send',
            params,
            id: requestId
        };
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (this.options.authToken) {
            headers['Authorization'] = `Bearer ${this.options.authToken}`;
        }
        const response = await fetch(`${this.baseUrl}/a2a`, {
            method: 'POST',
            headers,
            body: JSON.stringify(rpcRequest)
        });
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        const rpcResponse = await response.json();
        if (rpcResponse.error) {
            throw new Error(`RPC error ${rpcResponse.error.code}: ${rpcResponse.error.message}`);
        }
        if (!rpcResponse.result) {
            throw new Error('RPC response missing result');
        }
        return rpcResponse.result;
    }
    async getTask(taskId) {
        const requestId = crypto.randomUUID();
        const rpcRequest = {
            jsonrpc: '2.0',
            method: 'tasks/get',
            params: { id: taskId },
            id: requestId
        };
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (this.options.authToken) {
            headers['Authorization'] = `Bearer ${this.options.authToken}`;
        }
        const response = await fetch(`${this.baseUrl}/a2a`, {
            method: 'POST',
            headers,
            body: JSON.stringify(rpcRequest)
        });
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        const rpcResponse = await response.json();
        if (rpcResponse.error) {
            throw new Error(`RPC error ${rpcResponse.error.code}: ${rpcResponse.error.message}`);
        }
        if (!rpcResponse.result) {
            throw new Error('RPC response missing result');
        }
        return rpcResponse.result;
    }
    async cancelTask(taskId) {
        const requestId = crypto.randomUUID();
        const rpcRequest = {
            jsonrpc: '2.0',
            method: 'tasks/cancel',
            params: { id: taskId },
            id: requestId
        };
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (this.options.authToken) {
            headers['Authorization'] = `Bearer ${this.options.authToken}`;
        }
        const response = await fetch(`${this.baseUrl}/a2a`, {
            method: 'POST',
            headers,
            body: JSON.stringify(rpcRequest)
        });
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
        const rpcResponse = await response.json();
        if (rpcResponse.error) {
            throw new Error(`RPC error ${rpcResponse.error.code}: ${rpcResponse.error.message}`);
        }
        return rpcResponse.result?.canceled ?? false;
    }
}
exports.A2AClient = A2AClient;
function createA2AClient(baseUrl, options) {
    return new A2AClient(baseUrl, options);
}
