"use strict";
/**
 * RPC Handler
 *
 * Gestion des méthodes JSON-RPC A2A :
 * - tasks/send
 * - tasks/get
 * - tasks/cancel
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRPC = handleRPC;
const models_js_1 = require("./models.js");
const task_manager_js_1 = require("./task-manager.js");
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
};
// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================
async function handleTaskSend(params) {
    const parseResult = models_js_1.TaskSendParamsSchema.safeParse(params);
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
    const task = await task_manager_js_1.taskManager.createTask(parseResult.data);
    return {
        jsonrpc: '2.0',
        result: task,
        id: undefined
    };
}
async function handleTaskGet(params) {
    const parseResult = models_js_1.TaskGetParamsSchema.safeParse(params);
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
    const task = task_manager_js_1.taskManager.getTask(parseResult.data.id);
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
async function handleTaskCancel(params) {
    const parseResult = models_js_1.TaskCancelParamsSchema.safeParse(params);
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
    const success = task_manager_js_1.taskManager.cancelTask(parseResult.data.id);
    if (!success) {
        return {
            jsonrpc: '2.0',
            error: {
                code: ErrorCodes.TASK_CANNOT_BE_CANCELED,
                message: `Task cannot be canceled: ${parseResult.data.id}`
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
// ============================================================================
// MAIN HANDLER
// ============================================================================
async function handleRPC(request) {
    const parseResult = models_js_1.JSONRPCRequestSchema.safeParse(request);
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
    let response;
    switch (method) {
        case 'tasks/send':
            response = await handleTaskSend(params);
            break;
        case 'tasks/get':
            response = await handleTaskGet(params);
            break;
        case 'tasks/cancel':
            response = await handleTaskCancel(params);
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
