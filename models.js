"use strict";
/**
 * A2A Protocol Models
 *
 * Schémas Zod et types TypeScript pour le protocole A2A
 * Basé sur la spécification : https://google.github.io/A2A/specification/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskCancelParamsSchema = exports.TaskGetParamsSchema = exports.TaskSendParamsSchema = exports.JSONRPCResponseSchema = exports.JSONRPCRequestSchema = exports.JSONRPCVersionSchema = exports.AgentCardSchema = exports.AgentAuthenticationSchema = exports.AgentCapabilitiesSchema = exports.SkillSchema = exports.TaskSchema = exports.ArtifactSchema = exports.TaskStatusSchema = exports.TaskStateSchema = exports.MessageSchema = exports.PartSchema = exports.FilePartSchema = exports.TextPartSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// PARTS - Contenu des messages
// ============================================================================
exports.TextPartSchema = zod_1.z.object({
    type: zod_1.z.literal('text'),
    text: zod_1.z.string()
});
exports.FilePartSchema = zod_1.z.object({
    type: zod_1.z.literal('file'),
    file: zod_1.z.union([
        zod_1.z.object({
            name: zod_1.z.string(),
            mimeType: zod_1.z.string(),
            bytes: zod_1.z.string()
        }),
        zod_1.z.object({
            name: zod_1.z.string(),
            mimeType: zod_1.z.string(),
            uri: zod_1.z.string().url()
        })
    ])
});
exports.PartSchema = zod_1.z.any();
// ============================================================================
// MESSAGE
// ============================================================================
exports.MessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['user', 'agent']),
    parts: zod_1.z.array(exports.PartSchema),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
// ============================================================================
// TASK STATUS
// ============================================================================
exports.TaskStateSchema = zod_1.z.enum([
    'submitted',
    'working',
    'completed',
    'failed',
    'canceled'
]);
exports.TaskStatusSchema = zod_1.z.object({
    state: exports.TaskStateSchema,
    timestamp: zod_1.z.string().datetime().default(() => new Date().toISOString()),
    message: zod_1.z.string().optional()
});
// ============================================================================
// ARTIFACT
// ============================================================================
exports.ArtifactSchema = zod_1.z.object({
    parts: zod_1.z.array(exports.PartSchema),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    index: zod_1.z.number().int().optional()
});
// ============================================================================
// TASK
// ============================================================================
exports.TaskSchema = zod_1.z.object({
    id: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    status: exports.TaskStatusSchema,
    artifacts: zod_1.z.array(exports.ArtifactSchema).default([]),
    history: zod_1.z.array(exports.MessageSchema).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
// ============================================================================
// AGENT CARD
// ============================================================================
exports.SkillSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    examples: zod_1.z.array(zod_1.z.string()).optional(),
    inputModes: zod_1.z.array(zod_1.z.string()).optional(),
    outputModes: zod_1.z.array(zod_1.z.string()).optional()
});
exports.AgentCapabilitiesSchema = zod_1.z.object({
    streaming: zod_1.z.boolean().default(false),
    pushNotifications: zod_1.z.boolean().default(false),
    stateTransitionHistory: zod_1.z.boolean().default(false)
});
exports.AgentAuthenticationSchema = zod_1.z.object({
    schemes: zod_1.z.array(zod_1.z.enum(['Bearer', 'OAuth2', 'ApiKey'])),
    credentials: zod_1.z.string().optional()
});
exports.AgentCardSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    url: zod_1.z.string().url(),
    version: zod_1.z.string(),
    capabilities: exports.AgentCapabilitiesSchema,
    authentication: exports.AgentAuthenticationSchema.optional(),
    defaultInputModes: zod_1.z.array(zod_1.z.string()).default(['text']),
    defaultOutputModes: zod_1.z.array(zod_1.z.string()).default(['text']),
    skills: zod_1.z.array(exports.SkillSchema)
});
// ============================================================================
// JSON-RPC
// ============================================================================
exports.JSONRPCVersionSchema = zod_1.z.literal('2.0');
exports.JSONRPCRequestSchema = zod_1.z.object({
    jsonrpc: exports.JSONRPCVersionSchema,
    method: zod_1.z.string(),
    params: zod_1.z.unknown(),
    id: zod_1.z.union([zod_1.z.string(), zod_1.z.number()])
});
exports.JSONRPCResponseSchema = zod_1.z.object({
    jsonrpc: exports.JSONRPCVersionSchema,
    result: zod_1.z.unknown().optional(),
    error: zod_1.z.object({
        code: zod_1.z.number().int(),
        message: zod_1.z.string(),
        data: zod_1.z.unknown().optional()
    }).optional(),
    id: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional()
}).refine((data) => data.result !== undefined || data.error !== undefined, {
    message: 'Response must have either result or error'
});
// ============================================================================
// A2A METHODS PARAMS
// ============================================================================
exports.TaskSendParamsSchema = zod_1.z.object({
    id: zod_1.z.string(),
    sessionId: zod_1.z.string().optional(),
    acceptedOutputModes: zod_1.z.array(zod_1.z.string()).optional(),
    message: exports.MessageSchema
});
exports.TaskGetParamsSchema = zod_1.z.object({
    id: zod_1.z.string()
});
exports.TaskCancelParamsSchema = zod_1.z.object({
    id: zod_1.z.string()
});
