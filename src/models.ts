/**
 * A2A Protocol Models
 * 
 * Schémas Zod et types TypeScript pour le protocole A2A
 * Basé sur la spécification : https://google.github.io/A2A/specification/
 */

import { z } from 'zod';

// ============================================================================
// PARTS - Contenu des messages
// ============================================================================

export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string()
});

export const FilePartSchema = z.object({
  type: z.literal('file'),
  file: z.union([
    z.object({
      name: z.string(),
      mimeType: z.string(),
      bytes: z.string()
    }),
    z.object({
      name: z.string(),
      mimeType: z.string(),
      uri: z.string().url()
    })
  ])
});

export const PartSchema = z.any();

// ============================================================================
// MESSAGE
// ============================================================================

export const MessageSchema = z.object({
  role: z.enum(['user', 'agent']),
  parts: z.array(PartSchema),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// ============================================================================
// TASK STATUS
// ============================================================================

export const TaskStateSchema = z.enum([
  'submitted',
  'working',
  'completed',
  'failed',
  'canceled'
]);

export const TaskStatusSchema = z.object({
  state: TaskStateSchema,
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
  message: z.string().optional()
});

// ============================================================================
// ARTIFACT
// ============================================================================

export const ArtifactSchema = z.object({
  parts: z.array(PartSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
  index: z.number().int().optional()
});

// ============================================================================
// TASK
// ============================================================================

export const TaskSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  status: TaskStatusSchema,
  artifacts: z.array(ArtifactSchema).default([]),
  history: z.array(MessageSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// ============================================================================
// AGENT CARD
// ============================================================================

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  inputModes: z.array(z.string()).optional(),
  outputModes: z.array(z.string()).optional()
});

export const AgentCapabilitiesSchema = z.object({
  streaming: z.boolean().default(false),
  pushNotifications: z.boolean().default(false),
  stateTransitionHistory: z.boolean().default(false)
});

export const AgentAuthenticationSchema = z.object({
  schemes: z.array(z.enum(['Bearer', 'OAuth2', 'ApiKey'])),
  credentials: z.string().optional()
});

export const AgentCardSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  version: z.string(),
  capabilities: AgentCapabilitiesSchema,
  authentication: AgentAuthenticationSchema.optional(),
  defaultInputModes: z.array(z.string()).default(['text']),
  defaultOutputModes: z.array(z.string()).default(['text']),
  skills: z.array(SkillSchema)
});

// ============================================================================
// JSON-RPC
// ============================================================================

export const JSONRPCVersionSchema = z.literal('2.0');

export const JSONRPCRequestSchema = z.object({
  jsonrpc: JSONRPCVersionSchema,
  method: z.string(),
  params: z.unknown(),
  id: z.union([z.string(), z.number()])
});

export const JSONRPCResponseSchema = z.object({
  jsonrpc: JSONRPCVersionSchema,
  result: z.unknown().optional(),
  error: z.object({
    code: z.number().int(),
    message: z.string(),
    data: z.unknown().optional()
  }).optional(),
  id: z.union([z.string(), z.number()]).optional()
}).refine(
  (data) => data.result !== undefined || data.error !== undefined,
  {
    message: 'Response must have either result or error'
  }
);

// ============================================================================
// A2A METHODS PARAMS
// ============================================================================

export const TaskSendParamsSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  acceptedOutputModes: z.array(z.string()).optional(),
  message: MessageSchema
});

export const TaskGetParamsSchema = z.object({
  id: z.string()
});

export const TaskCancelParamsSchema = z.object({
  id: z.string()
});

export const TaskSendSubscribeParamsSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  acceptedOutputModes: z.array(z.string()).optional(),
  message: MessageSchema
});

export const TaskListParamsSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
  state: TaskStateSchema.optional()
});

// ============================================================================
// TASK EVENTS (for SSE streaming)
// ============================================================================

export const TaskEventSchema = z.object({
  type: z.enum(['status', 'artifact', 'message']),
  task: TaskSchema,
  artifact: ArtifactSchema.optional(),
  message: MessageSchema.optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TextPart = z.infer<typeof TextPartSchema>;
export type FilePart = z.infer<typeof FilePartSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type TaskState = z.infer<typeof TaskStateSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;
export type AgentAuthentication = z.infer<typeof AgentAuthenticationSchema>;
export type AgentCard = z.infer<typeof AgentCardSchema>;
export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>;
export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>;
export type TaskSendParams = z.infer<typeof TaskSendParamsSchema>;
export type TaskGetParams = z.infer<typeof TaskGetParamsSchema>;
export type TaskCancelParams = z.infer<typeof TaskCancelParamsSchema>;
export type TaskSendSubscribeParams = z.infer<typeof TaskSendSubscribeParamsSchema>;
export type TaskListParams = z.infer<typeof TaskListParamsSchema>;
export type TaskEvent = z.infer<typeof TaskEventSchema>;
