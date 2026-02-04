/**
 * RPC Handler
 * 
 * Gestion des méthodes JSON-RPC A2A :
 * - tasks/send
 * - tasks/get
 * - tasks/cancel
 */

import {
  JSONRPCRequestSchema,
  TaskSendParamsSchema,
  TaskGetParamsSchema,
  TaskCancelParamsSchema,
  TaskSendSubscribeParamsSchema,
  TaskListParamsSchema,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type TaskSendSubscribeParams
} from './models.js';
import { taskManager } from './task-manager.js';

// Marker for SSE stream responses
export const SSE_STREAM_MARKER = '__sse_stream__';

export interface SSEStreamResponse extends JSONRPCResponse {
  [SSE_STREAM_MARKER]: true;
  params: TaskSendSubscribeParams;
}

// ============================================================================
// ERROR CODES (JSON-RPC 2.0 + A2A)
// ============================================================================

const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TASK_NOT_FOUND: -32001,
  TASK_CANNOT_BE_CANCELED: -32002
} as const;

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function handleTaskSend(params: unknown): Promise<JSONRPCResponse> {
  const parseResult = TaskSendParamsSchema.safeParse(params);
  
  if (!parseResult.success) {
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Invalid task send parameters',
        data: parseResult.error.issues
      },
      id: undefined
    };
  }

  const task = await taskManager.createTask(parseResult.data);
  
  return {
    jsonrpc: '2.0',
    result: task,
    id: undefined
  };
}

async function handleTaskGet(params: unknown): Promise<JSONRPCResponse> {
  const parseResult = TaskGetParamsSchema.safeParse(params);
  
  if (!parseResult.success) {
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Invalid task get parameters',
        data: parseResult.error.issues
      },
      id: undefined
    };
  }

  const task = taskManager.getTask(parseResult.data.id);
  
  if (!task) {
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.TASK_NOT_FOUND,
        message: `Task not found: ${parseResult.data.id}`
      },
      id: undefined
    };
  }

  return {
    jsonrpc: '2.0',
    result: task,
    id: undefined
  };
}

async function handleTaskCancel(params: unknown): Promise<JSONRPCResponse> {
  const parseResult = TaskCancelParamsSchema.safeParse(params);
  
  if (!parseResult.success) {
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Invalid task cancel parameters',
        data: parseResult.error.issues
      },
      id: undefined
    };
  }

  const result = taskManager.cancelTask(parseResult.data.id);
  
  if (!result.success) {
    if (result.reason === 'not_found') {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCodes.TASK_NOT_FOUND,
          message: `Task not found: ${parseResult.data.id}`
        },
        id: undefined
      };
    }
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.TASK_CANNOT_BE_CANCELED,
        message: `Task cannot be canceled: ${parseResult.data.id} (current state: ${result.state})`
      },
      id: undefined
    };
  }

  return {
    jsonrpc: '2.0',
    result: { canceled: true },
    id: undefined
  };
}

/**
 * Handle tasks/sendSubscribe - returns SSE marker for streaming response
 */
async function handleTaskSendSubscribe(params: unknown): Promise<JSONRPCResponse | SSEStreamResponse> {
  const parseResult = TaskSendSubscribeParamsSchema.safeParse(params);
  
  if (!parseResult.success) {
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Invalid task sendSubscribe parameters',
        data: parseResult.error.issues
      },
      id: undefined
    };
  }

  // Return SSE marker - the HTTP layer will handle actual streaming
  return {
    jsonrpc: '2.0',
    result: null,
    id: undefined,
    [SSE_STREAM_MARKER]: true,
    params: parseResult.data
  } as SSEStreamResponse;
}

/**
 * Handle tasks/list - list tasks with pagination
 */
async function handleTaskList(params: unknown): Promise<JSONRPCResponse> {
  const parseResult = TaskListParamsSchema.safeParse(params || {});
  
  if (!parseResult.success) {
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Invalid task list parameters',
        data: parseResult.error.issues
      },
      id: undefined
    };
  }

  const result = taskManager.listTasks(parseResult.data);
  
  return {
    jsonrpc: '2.0',
    result,
    id: undefined
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handleRPC(request: unknown): Promise<JSONRPCResponse | SSEStreamResponse> {
  const parseResult = JSONRPCRequestSchema.safeParse(request);
  
  if (!parseResult.success) {
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCodes.INVALID_REQUEST,
        message: 'Invalid JSON-RPC request',
        data: parseResult.error.issues
      },
      id: undefined
    };
  }

  const { method, params, id } = parseResult.data;

  let response: JSONRPCResponse | SSEStreamResponse;
  
  switch (method) {
    case 'tasks/send':
      response = await handleTaskSend(params);
      break;
    case 'tasks/sendSubscribe':
      response = await handleTaskSendSubscribe(params);
      break;
    case 'tasks/get':
      response = await handleTaskGet(params);
      break;
    case 'tasks/cancel':
      response = await handleTaskCancel(params);
      break;
    case 'tasks/list':
      response = await handleTaskList(params);
      break;
    default:
      response = {
        jsonrpc: '2.0',
        error: {
          code: ErrorCodes.METHOD_NOT_FOUND,
          message: `Method not found: ${method}`
        },
        id: undefined
      };
  }

  response.id = id;
  
  return response;
}
